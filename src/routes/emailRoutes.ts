import { OpenAPIHono } from "@hono/zod-openapi";
import { CACHE } from "@/config/constants";
import { createDatabaseService } from "@/database";
import {
	deleteEmailRoute,
	deleteEmailsRoute,
	getDomainsRoute,
	getEmailRoute,
	getEmailsCountRoute,
	getEmailsRoute,
} from "@/schemas/emails/routeDefinitions";
import { getAuthenticatedMailboxEmail } from "@/utils/mailboxAuth";
import { getActiveMailboxDomains } from "@/utils/mailboxDomains";
import { ERR, OK } from "@/utils/http";
import { validateEmailDomain } from "@/utils/validation";

const emailRoutes = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

emailRoutes.openapi(getEmailsRoute, async (c) => {
	const { emailAddress } = c.req.valid("param");
	const { limit, offset } = c.req.valid("query");
	const validation = await validateEmailDomain(c.env.D1, emailAddress);
	if (!validation.valid) return c.json(validation.error, 404);

	const authenticatedEmail = await getAuthenticatedMailboxEmail(c.req.raw, c.env.D1);
	if (!authenticatedEmail) return c.json(ERR("Authentication required", "Unauthorized"), 401);
	if (authenticatedEmail.toLowerCase() !== emailAddress.toLowerCase()) {
		return c.json(ERR("Mailbox access denied", "Forbidden"), 403);
	}

	try {
		const { results } = await c.env.D1.prepare(
			`SELECT id, from_address, to_address, subject, received_at,
				has_attachments, attachment_count, is_public
			 FROM emails
			 WHERE to_address = ? AND is_public = 1
			 ORDER BY received_at DESC
			 LIMIT ? OFFSET ?`,
		)
			.bind(emailAddress, limit, offset)
			.all();

		return c.json(
			OK(
				results.map((row: any) => ({
					...row,
					has_attachments: Boolean(row.has_attachments),
					is_public: Boolean(row.is_public),
				})),
			),
		);
	} catch (e) {
		return c.json(ERR(e instanceof Error ? e.message : String(e), "D1Error"), 500);
	}
});

emailRoutes.openapi(getEmailsCountRoute, async (c) => {
	const { emailAddress } = c.req.valid("param");
	const validation = await validateEmailDomain(c.env.D1, emailAddress);
	if (!validation.valid) return c.json(validation.error, 404);

	const authenticatedEmail = await getAuthenticatedMailboxEmail(c.req.raw, c.env.D1);
	if (!authenticatedEmail) return c.json(ERR("Authentication required", "Unauthorized"), 401);
	if (authenticatedEmail.toLowerCase() !== emailAddress.toLowerCase()) {
		return c.json(ERR("Mailbox access denied", "Forbidden"), 403);
	}

	try {
		const result = await c.env.D1.prepare(
			`SELECT COUNT(*) AS count FROM emails WHERE to_address = ? AND is_public = 1`,
		)
			.bind(emailAddress)
			.first<{ count: number }>();
		return c.json(OK({ count: Number(result?.count || 0) }));
	} catch (e) {
		return c.json(ERR(e instanceof Error ? e.message : String(e), "D1Error"), 500);
	}
});

emailRoutes.openapi(deleteEmailRoute, async (c) => {
	const { emailId } = c.req.valid("param");
	const authenticatedEmail = await getAuthenticatedMailboxEmail(c.req.raw, c.env.D1);
	if (!authenticatedEmail) return c.json(ERR("Authentication required", "Unauthorized"), 401);

	try {
		const email = await c.env.D1.prepare(
			`SELECT id, to_address FROM emails WHERE id = ? AND is_public = 1`,
		)
			.bind(emailId)
			.first<{ id: string; to_address: string }>();
		if (!email) return c.json(ERR("Email not found", "NotFound"), 404);
		if (email.to_address.toLowerCase() !== authenticatedEmail.toLowerCase()) {
			return c.json(ERR("Mailbox access denied", "Forbidden"), 403);
		}

		const { success, error } = await c.env.D1.prepare(
			`DELETE FROM emails WHERE id = ? AND is_public = 1 AND to_address = ?`,
		)
			.bind(emailId, authenticatedEmail)
			.run();
		if (!success) return c.json(ERR(error?.message || "Unable to delete email", "D1Error"), 500);
		return c.json(OK({ deleted: true }));
	} catch (e) {
		return c.json(ERR(e instanceof Error ? e.message : String(e), "D1Error"), 500);
	}
});

emailRoutes.openapi(getEmailRoute, async (c) => {
	const { emailId } = c.req.valid("param");
	const authenticatedEmail = await getAuthenticatedMailboxEmail(c.req.raw, c.env.D1);
	if (!authenticatedEmail) return c.json(ERR("Authentication required", "Unauthorized"), 401);

	const { result, error } = await createDatabaseService(c.env.D1).getEmailById(emailId);
	if (error) return c.json(ERR(error.message, "D1Error"), 500);
	if (!result || result.is_public !== true) return c.json(ERR("Email not found", "NotFound"), 404);
	if (result.to_address.toLowerCase() !== authenticatedEmail.toLowerCase()) {
		return c.json(ERR("Mailbox access denied", "Forbidden"), 403);
	}
	return c.json(OK(result));
});

emailRoutes.openapi(deleteEmailsRoute, async (c) => {
	const authenticatedEmail = await getAuthenticatedMailboxEmail(c.req.raw, c.env.D1);
	if (!authenticatedEmail) return c.json(ERR("Authentication required", "Unauthorized"), 401);
	return c.json(ERR("Mailbox-wide deletion is not available", "NotFound"), 404);
});

emailRoutes.openapi(getDomainsRoute, async (c) => {
	try {
		const domains = await getActiveMailboxDomains(c.env.D1);
		c.header("Cache-Control", `public, max-age=${CACHE.DOMAINS_TTL}`);
		c.header("ETag", `"domains-${domains.join("-") || "empty"}"`);
		return c.json(OK(domains));
	} catch (e) {
		return c.json(ERR(e instanceof Error ? e.message : String(e), "D1Error"), 500);
	}
});

// Access Code PWA: expose profile metadata only; never return Netflix bearer links.
// Results are cached in D1 so each one-time link is fetched at most once.
const ensureAccessCodeResults = async (db: D1Database) => {
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
};

const parseAccessCodeEmail = (htmlContent: string, textContent: string) => {
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
		if (parsed.protocol !== "https:" || parsed.hostname !== "www.netflix.com" ||
				parsed.pathname !== "/account/travel/verify" || !profile) return null;
	} catch {
		return null;
	}
	return { profile, link };
};

emailRoutes.get("/api/access-codes", async (c) => {
	const cutoff = Math.floor(Date.now() / 1000) - 15 * 60;
	try {
		await ensureAccessCodeResults(c.env.D1);
		await c.env.D1.prepare("DELETE FROM access_code_results WHERE updated_at < ?")
			.bind(cutoff)
			.run();
		const { results } = await c.env.D1.prepare(
			`SELECT e.id, e.subject, e.received_at, e.html_content, e.text_content,
							r.status AS code_status, r.access_code
			FROM emails e
			LEFT JOIN access_code_results r ON r.email_id = e.id
			WHERE e.is_public = 1
				AND lower(e.subject) LIKE '%netflix%'
				AND lower(e.subject) LIKE '%temporary access code%'
				AND e.received_at >= ?
			ORDER BY e.received_at DESC LIMIT 100`,
		)
			.bind(cutoff)
			.all<{
				id: string;
				subject: string | null;
				received_at: number;
				html_content: string | null;
				text_content: string | null;
				code_status: string | null;
				access_code: string | null;
			}>();

		const codes = results.flatMap((email) => {
			const parsed = parseAccessCodeEmail(email.html_content || "", email.text_content || "");
			if (!parsed) return [];
			return [
				{
					id: email.id,
					profile: parsed.profile,
					timestamp: new Date(email.received_at * 1000).toISOString(),
					status: email.code_status || "ready",
					accessCode: email.code_status === "success" ? email.access_code : null,
				},
			];
		});
		return c.json({ codes }, 200, {
			"Cache-Control": "no-store, max-age=0",
			Pragma: "no-cache",
		});
	} catch (error) {
		console.error("Access Code PWA feed failed:", error);
		return c.json({ error: "Unable to load access codes." }, 500, { "Cache-Control": "no-store" });
	}
});

// Fetch a one-time Netflix verification link only after the customer selects a profile.
// The link is never returned to the browser and a D1 claim prevents duplicate fetches.
emailRoutes.post("/api/access-codes/:id/retrieve", async (c) => {
	const id = c.req.param("id");
	if (!id || id.length > 64)
			return c.json({ error: "Invalid access-code ID." }, 400, { "Cache-Control": "no-store" });
	const now = Math.floor(Date.now() / 1000);
	const cutoff = now - 15 * 60;
	try {
		await ensureAccessCodeResults(c.env.D1);
		const email = await c.env.D1.prepare(
			`SELECT id, subject, received_at, html_content, text_content FROM emails
			WHERE id = ? AND is_public = 1 AND received_at >= ?
				AND lower(subject) LIKE '%netflix%'
				AND lower(subject) LIKE '%temporary access code%'`,
		)
			.bind(id, cutoff)
			.first<{
				id: string;
				subject: string | null;
				received_at: number;
				html_content: string | null;
				text_content: string | null;
			}>();
		if (!email)
			return c.json(
				{ status: "not_found", message: "Code not found or expired." },
				404,
				{ "Cache-Control": "no-store" },
			);

		const parsed = parseAccessCodeEmail(email.html_content || "", email.text_content || "");
		if (!parsed)
			return c.json(
				{ status: "error", message: "Verification link could not be extracted." },
				422,
				{ "Cache-Control": "no-store" },
			);

		const claim = await c.env.D1.prepare(
			`INSERT OR IGNORE INTO access_code_results
			(email_id, profile, status, access_code, message, created_at, updated_at)
			VALUES (?, ?, 'processing', NULL, NULL, ?, ?)`,
		)
			.bind(id, parsed.profile, now, now)
			.run();

		let saved = await c.env.D1.prepare(
			"SELECT status, access_code, message, profile FROM access_code_results WHERE email_id = ?",
		)
			.bind(id)
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
				const codeMatch =
			html.match(/class="[^"]*"[^>]*>\s*(\d{4})\s*<\/div>/i) ||
					html.match(/>(\d{4})</);
				const accessCode = response.ok && codeMatch?.[1] ? codeMatch[1] : null;
				const status = accessCode ? "success" : "failed";
				const message = accessCode
			? "Code retrieved."
			: "Code not found; the link may be expired or Netflix may have changed its page.";
				await c.env.D1.prepare(
					"UPDATE access_code_results SET status = ?, access_code = ?, message = ?, updated_at = ? WHERE email_id = ?",
				)
					.bind(status, accessCode, message, Math.floor(Date.now() / 1000), id)
					.run();
				saved = { status, access_code: accessCode, message, profile: parsed.profile };
			} catch (error) {
				const message = "Unable to retrieve code from Netflix.";
				await c.env.D1.prepare(
					"UPDATE access_code_results SET status = 'failed', message = ?, updated_at = ? WHERE email_id = ?",
				)
					.bind(message, Math.floor(Date.now() / 1000), id)
					.run();
				saved = { status: "failed", access_code: null, message, profile: parsed.profile };
				console.error("Netflix access-code retrieval failed:", error);
			}
		}

		return c.json({
			status: saved?.status || "processing",
			profile: saved?.profile || parsed.profile,
			accessCode: saved?.status === "success" ? saved.access_code : null,
			message: saved?.message || "Retrieval is in progress. Try again shortly.",
		}, 200, { "Cache-Control": "no-store, max-age=0", "Pragma": "no-cache" });
	} catch (error) {
		console.error("Access Code retrieval failed:", error);
		return c.json({ error: "Unable to retrieve access code." }, 500, { "Cache-Control": "no-store" });
	}
});

export default emailRoutes;
