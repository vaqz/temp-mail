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


// Read-only, minimal feed for the Access Code PWA.
// Only returns recent messages matching the dedicated Netflix temporary-access-code rule.
emailRoutes.get("/api/access-codes", async (c) => {
  const cutoff = Math.floor(Date.now() / 1000) - 15 * 60;
  try {
    const { results } = await c.env.D1.prepare(
      `SELECT id, subject, received_at, html_content, text_content
       FROM emails
       WHERE is_public = 1
         AND lower(subject) LIKE '%netflix%'
         AND lower(subject) LIKE '%temporary access code%'
         AND received_at >= ?
       ORDER BY received_at DESC
       LIMIT 100`,
    )
      .bind(cutoff)
      .all<{
        id: string;
        subject: string | null;
        received_at: number;
        html_content: string | null;
        text_content: string | null;
      }>();

    const items = results.flatMap((email) => {
      const html = email.html_content || "";
      const text = email.text_content || "";
      const profileMatch =
        html.match(/Hi\s*<[^>]*>([^<]+)<\/span>/i) ||
        text.match(/Hi\s+([^,\r\n]+)/i);
      const profile = (profileMatch?.[1] || "").replace(/&amp;/gi, "&").trim();

      const linkMatch =
        html.match(/<td class="h5 button-td"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"/i) ||
        html.match(/href="(https:\/\/www\.netflix\.com\/account\/travel\/verify[^"]*)"/i) ||
        text.match(/(https:\/\/www\.netflix\.com\/account\/travel\/verify[^\s"'<>]+)/i);

      const link = (linkMatch?.[1] || "").replace(/&amp;/gi, "&").trim();
      try {
        const parsed = new URL(link);
        if (
          !profile ||
          parsed.protocol !== "https:" ||
          parsed.hostname !== "www.netflix.com" ||
          parsed.pathname !== "/account/travel/verify"
        ) return [];
      } catch {
        return [];
      }

      return [{
        id: email.id,
        profile,
        link,
        timestamp: new Date(email.received_at * 1000).toISOString(),
      }];
    });

    return c.json({ codes: items }, 200, {
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
    });
  } catch (error) {
    console.error("Access Code PWA feed failed:", error);
    return c.json({ error: "Unable to load access codes." }, 500, {
      "Cache-Control": "no-store",
    });
  }
});

export default emailRoutes;
