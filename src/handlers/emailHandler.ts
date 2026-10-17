import { createId } from "@paralleldrive/cuid2";
import PostalMime from "postal-mime";
import { ATTACHMENT_LIMITS } from "@/config/constants";
import * as db from "@/database/d1";
import * as r2 from "@/database/r2";
import { emailSchema } from "@/schemas/emails";
import { now } from "@/utils/helpers";
import { processEmailContent } from "@/utils/mail";
import { PerformanceTimer } from "@/utils/performance";

interface EmailAttachment {
	filename: string | null;
	mimeType?: string;
	content?: string | ArrayBuffer;
}

async function matchesPublicVisibilityRule(
	dbConnection: D1Database,
	fromAddress: string,
	toAddress: string,
	subject: string | null,
): Promise<boolean> {
	try {
		const { results } = await dbConnection
			.prepare(
				`SELECT sender_pattern, subject_pattern, recipient_pattern, action
			 FROM email_visibility_rules WHERE action = 'public'`,
			)
			.all();
		const sender = fromAddress.trim().toLowerCase();
		const recipient = toAddress.trim().toLowerCase();
		const emailSubject = (subject || "").trim().toLowerCase();

		for (const rule of results as Array<{
			sender_pattern: string | null;
			subject_pattern: string | null;
			recipient_pattern: string | null;
			action: string;
		}>) {
			const senderPattern = String(rule.sender_pattern || "")
				.trim()
				.toLowerCase();
			const subjectPattern = String(rule.subject_pattern || "")
				.trim()
				.toLowerCase();
			const recipientPattern = String(rule.recipient_pattern || "")
				.trim()
				.toLowerCase();
			if (senderPattern && sender !== senderPattern) continue;
			if (recipientPattern && recipient !== recipientPattern) continue;
			if (subjectPattern && !emailSubject.includes(subjectPattern)) continue;
			return true;
		}
		return false;
	} catch (error) {
		console.error("Failed to check email visibility rules:", error);
		return false;
	}
}

function validateAttachments(attachments: EmailAttachment[], emailId: string): EmailAttachment[] {
	const validAttachments: EmailAttachment[] = [];
	let totalAttachmentSize = 0;

	for (const attachment of attachments) {
		if (!attachment.filename) {
			console.warn(`Email ${emailId}: Attachment without filename, skipping`);
			continue;
		}
		if (validAttachments.length >= ATTACHMENT_LIMITS.MAX_COUNT_PER_EMAIL) {
			console.warn(`Email ${emailId}: Too many attachments, skipping remaining`);
			break;
		}

		const attachmentSize =
			attachment.content instanceof ArrayBuffer
				? attachment.content.byteLength
				: new TextEncoder().encode(attachment.content || "").byteLength;
		const contentType = attachment.mimeType || "application/octet-stream";
		if (
			!ATTACHMENT_LIMITS.ALLOWED_TYPES.includes(
				contentType as (typeof ATTACHMENT_LIMITS.ALLOWED_TYPES)[number],
			)
		) {
			console.warn(
				`Email ${emailId}: Attachment ${attachment.filename} has unsupported type (${contentType}), skipping`,
			);
			continue;
		}
		if (attachmentSize > ATTACHMENT_LIMITS.MAX_SIZE) {
			console.warn(
				`Email ${emailId}: Attachment ${attachment.filename} too large (${attachmentSize} bytes), skipping`,
			);
			continue;
		}
		totalAttachmentSize += attachmentSize;
		if (totalAttachmentSize > ATTACHMENT_LIMITS.MAX_SIZE * ATTACHMENT_LIMITS.MAX_COUNT_PER_EMAIL) {
			console.warn(
				`Email ${emailId}: Total attachment size too large, skipping remaining attachments`,
			);
			break;
		}
		validAttachments.push(attachment);
	}
	return validAttachments;
}

export async function handleEmail(
	message: ForwardableEmailMessage,
	env: CloudflareBindings,
	ctx: ExecutionContext,
) {
	try {
		const timer = new PerformanceTimer("email-processing");
		const emailId = createId();
		const email = await PostalMime.parse(message.raw);
		const { htmlContent, textContent } = processEmailContent(
			email.html ?? null,
			email.text ?? null,
		);
		const validAttachments = validateAttachments(email.attachments || [], emailId);
		const fromAddress = email.from?.address || message.from;
		const subject = email.subject || null;
		const isPublic = await matchesPublicVisibilityRule(env.D1, fromAddress, message.to, subject);

		const emailData = emailSchema.parse({
			id: emailId,
			from_address: fromAddress,
			to_address: message.to,
			subject,
			received_at: now(),
			html_content: htmlContent,
			text_content: textContent,
			has_attachments: validAttachments.length > 0,
			attachment_count: validAttachments.length,
			is_public: isPublic,
		});

		const { success, error } = await db.insertEmail(env.D1, emailData);
		if (!success) throw new Error(`Failed to insert email: ${error}`);
		console.log(`Email ${emailId} stored as ${isPublic ? "PUBLIC" : "PRIVATE"}`);

		// Automatically process public Netflix Household Update emails on arrival.
		// The Browserless token must be configured as a Cloudflare Worker secret.
		if (
			isPublic &&
			subject &&
			subject.toLowerCase().includes("important: how to update your netflix household")
		) {
			ctx.waitUntil(processHouseholdUpdateEmail(env, htmlContent || "", textContent || "", emailId));
		}

		if (validAttachments.length > 0) {
			ctx.waitUntil(processAttachments(env, emailId, validAttachments));
		}
		timer.end();
	} catch (error) {
		console.error("Failed to process email:", error);
		throw error;
	}
}

async function processSingleAttachment(
	env: CloudflareBindings,
	emailId: string,
	attachment: EmailAttachment,
): Promise<void> {
	if (!attachment.filename) {
		console.warn(`Skipping attachment without filename in email ${emailId}`);
		return;
	}

	const attachmentId = createId();
	let content: ArrayBuffer;
	let attachmentSize: number;
	if (attachment.content instanceof ArrayBuffer) {
		content = attachment.content;
		attachmentSize = content.byteLength;
	} else {
		const encodedContent = new TextEncoder().encode(attachment.content || "");
		content = encodedContent.buffer as ArrayBuffer;
		attachmentSize = encodedContent.byteLength;
	}

	const r2Key = r2.generateR2Key(emailId, attachmentId, attachment.filename);
	const { success: r2Success, error: r2Error } = await r2.storeAttachment(
		env.R2,
		r2Key,
		content,
		attachment.mimeType || "application/octet-stream",
		attachment.filename,
	);
	if (!r2Success) {
		console.error(`Failed to store attachment ${attachment.filename}:`, r2Error);
		return;
	}

	const attachmentData = {
		id: attachmentId,
		email_id: emailId,
		filename: attachment.filename,
		content_type: attachment.mimeType || "application/octet-stream",
		size: attachmentSize,
		r2_key: r2Key,
		created_at: now(),
	};
	const { success: dbSuccess, error: dbError } = await db.insertAttachment(env.D1, attachmentData);
	if (!dbSuccess) {
		console.error(`Failed to store attachment metadata for ${attachment.filename}:`, dbError);
		await r2.deleteAttachment(env.R2, r2Key);
	}
}

async function processAttachments(
	env: CloudflareBindings,
	emailId: string,
	attachments: EmailAttachment[],
) {
	try {
		for (const attachment of attachments) {
			await processSingleAttachment(env, emailId, attachment);
		}
	} catch (error) {
		console.error("Failed to process attachments:", error);
	}
}


async function processHouseholdUpdateEmail(
	env: CloudflareBindings & { BROWSERLESS_API_KEY?: string },
	html: string,
	text: string,
	emailId: string,
): Promise<void> {
	const apiKey = env.BROWSERLESS_API_KEY;
	if (!apiKey) {
		console.error("Household Update automation skipped: BROWSERLESS_API_KEY secret is not configured.");
		return;
	}

	const rawMatch =
		html.match(/https:\/\/www\.netflix\.com\/account\/update-primary-location\?[^"\'\s<]+/i) ||
		text.match(/https:\/\/www\.netflix\.com\/account\/update-primary-location\?[^"\'\s<>]+/i);
	const targetUrl = rawMatch?.[0]?.replace(/&amp;/gi, "&");
	if (!targetUrl) {
		console.warn(`Household Update email ${emailId} did not contain the expected URL.`);
		return;
	}

	try {
		const parsed = new URL(targetUrl);
		if (
			parsed.protocol !== "https:" ||
			parsed.hostname !== "www.netflix.com" ||
			parsed.pathname !== "/account/update-primary-location"
		) {
			console.warn(`Household Update email ${emailId} had an unexpected URL; action skipped.`);
			return;
		}
	} catch {
		console.warn(`Household Update email ${emailId} had an invalid URL; action skipped.`);
		return;
	}

	const code = `
		export default async ({ page }) => {
			const targetUrl = ${JSON.stringify(targetUrl)};
			await page.goto(targetUrl, { waitUntil: 'networkidle2' });
			const buttonSelector = '[data-uia="set-primary-location-action"]';
			await page.waitForSelector(buttonSelector, { timeout: 15000 });
			await page.click(buttonSelector);
			await new Promise(resolve => setTimeout(resolve, 5000));
			return { status: 'success' };
		};
	`;

	try {
		const response = await fetch(
			"https://chrome.browserless.io/function?token=" + encodeURIComponent(apiKey),
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code }),
			},
		);
		const responseText = await response.text();
		if (!response.ok) {
			console.error(`Browserless household update failed for email ${emailId}: HTTP ${response.status}: ${responseText.slice(0, 500)}`);
			return;
		}
		console.log(`Browserless household update request completed for email ${emailId}.`);
	} catch (error) {
		console.error(`Browserless household update error for email ${emailId}:`, error);
	}
}
