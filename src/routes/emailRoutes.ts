import { OpenAPIHono } from "@hono/zod-openapi";

// Configuration imports
import { CACHE } from "@/config/constants";

// Database imports
import { createDatabaseService } from "@/database";

// Schema imports
import {
	deleteEmailRoute,
	deleteEmailsRoute,
	getDomainsRoute,
	getEmailRoute,
	getEmailsCountRoute,
	getEmailsRoute,
} from "@/schemas/emails/routeDefinitions";

// Utility imports
import { ERR, OK } from "@/utils/http";
import { validateEmailDomain } from "@/utils/validation";

const emailRoutes = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

// GET /emails/{emailAddress}
// Public inbox: only return emails marked as public
// @ts-ignore - OpenAPI route handler type mismatch with error response status codes
emailRoutes.openapi(getEmailsRoute, async (c) => {
	const { emailAddress } = c.req.valid("param");
	const { limit, offset } = c.req.valid("query");

	const domainValidation = validateEmailDomain(emailAddress);
	if (!domainValidation.valid) {
		return c.json(domainValidation.error, 404);
	}

	try {
		const { results } = await c.env.D1
			.prepare(
				`SELECT
					id,
					from_address,
					to_address,
					subject,
					received_at,
					has_attachments,
					attachment_count,
					is_public
				FROM emails
				WHERE to_address = ?
				  AND is_public = 1
				ORDER BY received_at DESC
				LIMIT ? OFFSET ?`,
			)
			.bind(emailAddress, limit, offset)
			.all();

		// Convert SQLite integer booleans to proper booleans
		const convertedResults = results.map((row: any) => ({
			...row,
			has_attachments: Boolean(row.has_attachments),
			is_public: Boolean(row.is_public),
		}));

		return c.json(OK(convertedResults));
	} catch (e: unknown) {
		const error = e instanceof Error ? e : new Error(String(e));
		return c.json(ERR(error.message, "D1Error"), 500);
	}
});

// GET /emails/count/{emailAddress}
// Public inbox count: only count public emails
// @ts-ignore - OpenAPI route handler type mismatch with error response status codes
emailRoutes.openapi(getEmailsCountRoute, async (c) => {
	const { emailAddress } = c.req.valid("param");

	const domainValidation = validateEmailDomain(emailAddress);
	if (!domainValidation.valid) {
		return c.json(domainValidation.error, 404);
	}

	try {
		const result = await c.env.D1
			.prepare(
				`SELECT COUNT(*) AS count
				 FROM emails
				 WHERE to_address = ?
				   AND is_public = 1`,
			)
			.bind(emailAddress)
			.first<{ count: number }>();

		return c.json(OK({ count: Number(result?.count || 0) }));
	} catch (e: unknown) {
		const error = e instanceof Error ? e : new Error(String(e));
		return c.json(ERR(error.message, "D1Error"), 500);
	}
});

// DELETE /emails/{emailAddress}
//
// Public deletion is intentionally disabled for now.
// We will later move deletion behind admin authentication.
// @ts-ignore - OpenAPI route handler type mismatch with error response status codes
emailRoutes.openapi(deleteEmailsRoute, async (c) => {
	return c.json(
		ERR("Email deletion is not available", "NotFound"),
		404,
	);
});

// GET /inbox/{emailId}
// Only publicly visible emails may be opened
// @ts-ignore - OpenAPI route handler type mismatch with error response status codes
emailRoutes.openapi(getEmailRoute, async (c) => {
	const { emailId } = c.req.valid("param");

	const dbService = createDatabaseService(c.env.D1);
	const { result, error } = await dbService.getEmailById(emailId);

	if (error) {
		return c.json(ERR(error.message, "D1Error"), 500);
	}

	if (!result || result.is_public !== true) {
		return c.json(ERR("Email not found", "NotFound"), 404);
	}

	return c.json(OK(result));
});

// DELETE /inbox/{emailId}
//
// Public deletion is intentionally disabled for now.
// We will later move deletion behind admin authentication.
// @ts-ignore - OpenAPI route handler type mismatch with error response status codes
emailRoutes.openapi(deleteEmailRoute, async (c) => {
	return c.json(
		ERR("Email deletion is not available", "NotFound"),
		404,
	);
});

// GET /domains
// Only expose your own public domain.
// Other domains from the original repository are intentionally hidden.
emailRoutes.openapi(getDomainsRoute, async (c) => {
	c.header("Cache-Control", `public, max-age=${CACHE.DOMAINS_TTL}`);
	c.header("ETag", `"domains-1"`);

	return c.json(OK(["vaqzmobiz.com"]));
});

export default emailRoutes;
