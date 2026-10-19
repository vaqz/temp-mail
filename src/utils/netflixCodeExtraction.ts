/**
 * Netflix code extraction helpers.
 *
 * - sign_in emails: the 4-digit code is embedded in the message body.
 * - temporary_access emails: the body contains a one-time verification link;
 *   the code is obtained by fetching that link (never returned to callers).
 *
 * These helpers never log or return verification URLs.
 */

export interface TemporaryAccessParseResult {
	profile: string;
	link: string;
}

/** Strip HTML / entities into plain text suitable for code regexes. */
export function stripToPlainText(input: string): string {
	return input
		.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
		.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
		.replace(/<\s*br\s*\/?\s*>/gi, "\n")
		.replace(/<\s*\/(?:p|div|tr|li|h[1-6])\s*>/gi, "\n")
		.replace(/<[^>]+>/g, " ")
		.replace(/&nbsp;|&#160;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Extract a 4-digit Netflix sign-in / OTP code from email body text.
 * Prefers digits near code-related wording; falls back to a single unambiguous group.
 */
export function extractSignInCodeFromBody(htmlContent: string, textContent: string): string | null {
	const pageText = stripToPlainText(`${textContent || ""}\n${htmlContent || ""}`);
	if (!pageText) return null;

	const contextual =
		pageText.match(/(?:sign[-\s]?in\s+)?(?:verification\s+)?\bcode\b[^0-9]{0,80}(\d{4})\b/i) ||
		pageText.match(
			/\b(\d{4})\b[^a-z0-9]{0,40}(?:is your )?(?:sign[-\s]?in |verification )?\bcode\b/i,
		) ||
		pageText.match(/(?:enter|use)\s+(?:this\s+)?\bcode\b[^0-9]{0,40}\b(\d{4})\b/i);

	if (contextual?.[1]) return contextual[1];

	const allFourDigitGroups = pageText.match(/\b\d{4}\b/g) || [];
	if (allFourDigitGroups.length === 1) return allFourDigitGroups[0];

	return null;
}

/**
 * Parse profile name and one-time travel-verify link from a temporary-access email.
 * Returns null when the link is missing or is not a trusted Netflix URL.
 */
export function parseTemporaryAccessEmail(
	htmlContent: string,
	textContent: string,
): TemporaryAccessParseResult | null {
	const profileMatch =
		htmlContent.match(/Hi\s*<[^>]*>([^<]+)<\/span>/i) || textContent.match(/Hi\s+([^,\r\n]+)/i);
	const profile = (profileMatch?.[1] || "").replace(/&amp;/gi, "&").trim();

	const linkMatch =
		htmlContent.match(/<td class="h5 button-td"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"/i) ||
		htmlContent.match(/href="(https:\/\/www\.netflix\.com\/account\/travel\/verify[^"]*)"/i) ||
		textContent.match(/(https:\/\/www\.netflix\.com\/account\/travel\/verify[^\s"'<>]+)/i);
	const link = (linkMatch?.[1] || "").replace(/&amp;/gi, "&").trim();

	try {
		const parsed = new URL(link);
		if (
			parsed.protocol !== "https:" ||
			parsed.hostname !== "www.netflix.com" ||
			parsed.pathname !== "/account/travel/verify" ||
			!profile
		) {
			return null;
		}
	} catch {
		return null;
	}

	return { profile, link };
}

/** Extract a 4-digit code from a Netflix travel-verify HTML page body. */
export function extractCodeFromNetflixPage(html: string): string | null {
	const pageText = stripToPlainText(html);
	const contextualCode =
		pageText.match(/(?:verification\s+)?code[^0-9]{0,80}(\d{4})/i) ||
		pageText.match(/(\d{4})[^a-z0-9]{0,40}(?:is your )?(?:verification )?code/i);
	const allFourDigitGroups = pageText.match(/\b\d{4}\b/g) || [];
	const codeMatch =
		contextualCode ||
		(allFourDigitGroups.length === 1 ? [allFourDigitGroups[0], allFourDigitGroups[0]] : null);
	return codeMatch?.[1] || null;
}

export async function ensureAccessCodeResultsTable(db: D1Database): Promise<void> {
	await db
		.prepare(`
		CREATE TABLE IF NOT EXISTS access_code_results (
			email_id TEXT PRIMARY KEY,
			profile TEXT NOT NULL,
			status TEXT NOT NULL,
			access_code TEXT,
			message TEXT,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)
	`)
		.run();
}

export interface TemporaryAccessRetrievalResult {
	status: "success" | "failed" | "processing";
	code: string | null;
	profile: string;
	message: string;
}

/**
 * Claim + fetch a temporary-access verification link at most once.
 * Returns a previously cached result when the claim was already taken.
 */
export async function retrieveTemporaryAccessCode(
	db: D1Database,
	emailId: string,
	parsed: TemporaryAccessParseResult,
): Promise<TemporaryAccessRetrievalResult> {
	const now = Math.floor(Date.now() / 1000);
	await ensureAccessCodeResultsTable(db);

	const claim = await db
		.prepare(
			`INSERT OR IGNORE INTO access_code_results
			(email_id, profile, status, access_code, message, created_at, updated_at)
			VALUES (?, ?, 'processing', NULL, NULL, ?, ?)`,
		)
		.bind(emailId, parsed.profile, now, now)
		.run();

	let saved = await db
		.prepare(
			"SELECT status, access_code, message, profile FROM access_code_results WHERE email_id = ?",
		)
		.bind(emailId)
		.first<{
			status: string;
			access_code: string | null;
			message: string | null;
			profile: string;
		}>();

	if (claim.meta.changes > 0) {
		try {
			const response = await fetch(parsed.link, {
				method: "GET",
				redirect: "follow",
				headers: { "User-Agent": "Mozilla/5.0 (compatible; VaqzMobizAccessCode/1.0)" },
				signal: AbortSignal.timeout(12000),
			});
			const html = await response.text();
			const accessCode = response.ok ? extractCodeFromNetflixPage(html) : null;
			const status = accessCode ? "success" : "failed";
			const message = accessCode
				? "Code retrieved."
				: "Code not found; the link may be expired or Netflix may have changed its page.";
			await db
				.prepare(
					`UPDATE access_code_results
					 SET status = ?, access_code = ?, message = ?, updated_at = ?
					 WHERE email_id = ?`,
				)
				.bind(status, accessCode, message, Math.floor(Date.now() / 1000), emailId)
				.run();
			saved = { status, access_code: accessCode, message, profile: parsed.profile };
		} catch (error) {
			const message = "Unable to retrieve code from Netflix.";
			await db
				.prepare(
					`UPDATE access_code_results
					 SET status = 'failed', message = ?, updated_at = ?
					 WHERE email_id = ?`,
				)
				.bind(message, Math.floor(Date.now() / 1000), emailId)
				.run();
			saved = { status: "failed", access_code: null, message, profile: parsed.profile };
			console.error("Netflix access-code retrieval failed:", error);
		}
	}

	const status =
		saved?.status === "success" || saved?.status === "failed" || saved?.status === "processing"
			? saved.status
			: "processing";

	return {
		status,
		code: status === "success" ? saved?.access_code || null : null,
		profile: saved?.profile || parsed.profile,
		message: saved?.message || "Retrieval is in progress. Try again shortly.",
	};
}
