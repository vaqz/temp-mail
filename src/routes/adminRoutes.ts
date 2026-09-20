import { Hono } from "hono";
import { createDatabaseService } from "@/database";
import { ERR, OK } from "@/utils/http";

const adminRoutes = new Hono<{ Bindings: CloudflareBindings }>();

/**
 * Check admin authentication.
 *
 * The token must be stored as a Cloudflare Worker secret:
 * ADMIN_TOKEN
 *
 * Send it using:
 * Authorization: Bearer YOUR_ADMIN_TOKEN
 */
function isAuthorized(c: any): boolean {
	const authorization = c.req.header("Authorization");
	const adminToken = c.env.ADMIN_TOKEN;

	if (!authorization || !adminToken) {
		return false;
	}

	if (!authorization.startsWith("Bearer ")) {
		return false;
	}

	const token = authorization.slice(7).trim();

	return token === adminToken;
}

/**
 * GET /admin/emails
 *
 * Returns all emails, including private emails.
 */
adminRoutes.get("/admin/emails", async (c) => {
	if (!isAuthorized(c)) {
		return c.json(ERR("Unauthorized", "Unauthorized"), 401);
	}

	try {
		const results = await c.env.D1
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
				ORDER BY received_at DESC
				LIMIT 500`,
			)
			.all();

		const convertedResults = results.results.map((row: any) => ({
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

/**
 * PATCH /admin/emails/:emailId/visibility
 *
 * Change an email between public and private.
 *
 * Body:
 * {
 *   "is_public": true
 * }
 */
adminRoutes.patch("/admin/emails/:emailId/visibility", async (c) => {
	if (!isAuthorized(c)) {
		return c.json(ERR("Unauthorized", "Unauthorized"), 401);
	}

	const emailId = c.req.param("emailId");

	let body: { is_public?: boolean };

	try {
		body = await c.req.json();
	} catch {
		return c.json(ERR("Invalid JSON body", "ValidationError"), 400);
	}

	if (typeof body.is_public !== "boolean") {
		return c.json(
			ERR("is_public must be true or false", "ValidationError"),
			400,
		);
	}

	try {
		const result = await c.env.D1
			.prepare(
				`UPDATE emails
				 SET is_public = ?
				 WHERE id = ?`,
			)
			.bind(body.is_public ? 1 : 0, emailId)
			.run();

		if (result.meta.changes === 0) {
			return c.json(ERR("Email not found", "NotFound"), 404);
		}

		return c.json(
			OK({
				message: body.is_public
					? "Email is now public"
					: "Email is now private",
				id: emailId,
				is_public: body.is_public,
			}),
		);
	} catch (e: unknown) {
		const error = e instanceof Error ? e : new Error(String(e));
		return c.json(ERR(error.message, "D1Error"), 500);
	}
});

/**
 * DELETE /admin/emails/:emailId
 *
 * Permanently delete an email.
 * This is protected by ADMIN_TOKEN.
 */
adminRoutes.delete("/admin/emails/:emailId", async (c) => {
	if (!isAuthorized(c)) {
		return c.json(ERR("Unauthorized", "Unauthorized"), 401);
	}

	const emailId = c.req.param("emailId");

	try {
		const dbService = createDatabaseService(c.env.D1);

		const { meta, error } = await dbService.deleteEmailById(emailId);

		if (error) {
			return c.json(ERR(error.message, "D1Error"), 500);
		}

		if (!meta || meta.changes === 0) {
			return c.json(ERR("Email not found", "NotFound"), 404);
		}

		return c.json(
			OK({
				message: "Email deleted successfully",
				id: emailId,
			}),
		);
	} catch (e: unknown) {
		const error = e instanceof Error ? e : new Error(String(e));
		return c.json(ERR(error.message, "D1Error"), 500);
	}
});

export default adminRoutes;
