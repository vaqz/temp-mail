import { OpenAPIHono } from "@hono/zod-openapi";
import { classifyForwardedOtpEmail } from "@/utils/classifyForwardedOtpEmail";
import { extractForwardedEmailMetadata } from "@/utils/forwardedEmailMetadata";

const chatraceEmailRoutes = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function authorized(c: any) {
	const expected = String(c.env.CHATRACE_API_TOKEN || "");
	const supplied = String(c.req.header("Authorization") || "").replace(/^Bearer\\s+/i, "");
	return Boolean(expected && supplied && supplied === expected);
}

chatraceEmailRoutes.post("/api/chatrace/email-classification", async (c) => {
	if (!authorized(c)) return c.json({ error: { message: "Unauthorized" } }, 401);

	const body = await c.req.json().catch(() => ({}));
	const email = String(body?.email || body?.net_acct_email || "")
		.trim()
		.toLowerCase();
	if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || email.length > 254) {
		return c.json({ status: "error", message: "A valid email address is required." }, 400);
	}

	const mailbox = String(c.env.CHATRACE_FORWARDING_MAILBOX || "").trim().toLowerCase();
	if (!mailbox) {
		return c.json({ status: "not_configured", message: "Forwarding mailbox is not configured." }, 503);
	}

	try {
		const cutoff = Math.floor(Date.now() / 1000) - 15 * 60;
		const rows = await c.env.D1.prepare(
			`SELECT id, from_address, to_address, subject, received_at, text_content
			 FROM emails
			 WHERE lower(to_address) = ? AND is_public = 1 AND received_at >= ?
			 ORDER BY received_at DESC LIMIT 100`,
		)
			.bind(mailbox, cutoff)
			.all<{
				id: string;
				from_address: string | null;
				to_address: string | null;
				subject: string | null;
				received_at: number;
				text_content: string | null;
			}>();

		for (const row of rows.results || []) {
			const bodyText = row.text_content || "";
			const forwarded = extractForwardedEmailMetadata(bodyText);
			const recipients = forwarded.toAddresses.map((value) => value.toLowerCase());
			const directMatch = String(row.to_address || "").toLowerCase() === email;
			if (!directMatch && !recipients.includes(email)) continue;

			const classification = classifyForwardedOtpEmail({
				fromAddress: row.from_address || "",
				outerSubject: row.subject || "",
				body: bodyText,
			});
			return c.json(
				{
					status: "matched",
					service: classification.service,
					service_name: classification.serviceName,
					message_type: classification.messageType,
					subject: classification.matchedSubject || row.subject || "",
					received_at: new Date(row.received_at * 1000).toISOString(),
				},
				200,
				{ "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
			);
		}

		return c.json({ status: "not_found", message: "No matching recent email was found." }, 404, {
			"Cache-Control": "no-store",
		});
	} catch (error) {
		console.error("ChatRace email classification failed:", error);
		return c.json({ status: "error", message: "Unable to check recent email." }, 500, {
			"Cache-Control": "no-store",
		});
	}
});

export default chatraceEmailRoutes;
