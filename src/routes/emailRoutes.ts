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
import {
	getAuthenticatedMailboxEmail,
} from "@/utils/mailboxAuth";
import { ERR, OK } from "@/utils/http";
import { validateEmailDomain } from "@/utils/validation";

const emailRoutes = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

/**
 * GET /emails/{emailAddress}
 *
 * Returns public emails belonging only to the
 * authenticated mailbox owner.
 */
emailRoutes.openapi(getEmailsRoute, async (c) => {
	const { emailAddress } = c.req.valid("param");
	const { limit, offset } = c.req.valid("query");

	const domainValidation = validateEmailDomain(emailAddress);

	if (!domainValidation.valid) {
		return c.json(domainValidation.error, 404);
	}

	const authenticatedEmail =
		await getAuthenticatedMailboxEmail(
			c.req.raw,
			c.env.D1,
		);

	if (!authenticatedEmail) {
		return c.json(
			ERR("Authentication required", "Unauthorized"),
			401,
		);
	}

	if (
		authenticatedEmail.toLowerCase() !==
		emailAddress.toLowerCase()
	) {
		return c.json(
			ERR("Mailbox access denied", "Forbidden"),
			403,
		);
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

		const convertedResults = results.map((row: any) => ({
			...row,
			has_attachments: Boolean(row.has_attachments),
			is_public: Boolean(row.is_public),
		}));

		return c.json(OK(convertedResults));
	} catch (e: unknown) {
		const error =
			e instanceof Error
				? e
				: new Error(String(e));

		return c.json(
			ERR(error.message, "D1Error"),
			500,
		);
	}
});

/**
 * GET /emails/count/{emailAddress}
 */
emailRoutes.openapi(getEmailsCountRoute, async (c) => {
	const { emailAddress } = c.req.valid("param");

	const domainValidation = validateEmailDomain(emailAddress);

	if (!domainValidation.valid) {
		return c.json(domainValidation.error, 404);
	}

	const authenticatedEmail =
		await getAuthenticatedMailboxEmail(
			c.req.raw,
			c.env.D1,
		);

	if (!authenticatedEmail) {
		return c.json(
			ERR("Authentication required", "Unauthorized"),
			401,
		);
	}

	if (
		authenticatedEmail.toLowerCase() !==
		emailAddress.toLowerCase()
	) {
		return c.json(
			ERR("Mailbox access denied", "Forbidden"),
			403,
		);
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

		return c.json(
			OK({
				count: Number(result?.count || 0),
			}),
		);
	} catch (e: unknown) {
		const error =
			e instanceof Error
				? e
				: new Error(String(e));

		return c.json(
			ERR(error.message, "D1Error"),
			500,
		);
	}
});

/**
 * DELETE /inbox/{emailId}
 *
 * Only the authenticated mailbox owner can delete
 * their own public email.
 */
emailRoutes.openapi(deleteEmailRoute, async (c) => {
	const { emailId } = c.req.valid("param");

	const authenticatedEmail =
		await getAuthenticatedMailboxEmail(
			c.req.raw,
			c.env.D1,
		);

	if (!authenticatedEmail) {
		return c.json(
			ERR("Authentication required", "Unauthorized"),
			401,
		);
	}

	try {
		const email = await c.env.D1
			.prepare(
				`SELECT id, to_address
				 FROM emails
				 WHERE id = ?
				   AND is_public = 1`,
			)
			.bind(emailId)
			.first<{
				id: string;
				to_address: string;
			}>();

		if (!email) {
			return c.json(
				ERR("Email not found", "NotFound"),
				404,
			);
		}

		if (
			email.to_address.toLowerCase() !==
			authenticatedEmail.toLowerCase()
		) {
			return c.json(
				ERR("Mailbox access denied", "Forbidden"),
				403,
			);
		}

		const { success, error } = await c.env.D1
			.prepare(
				`DELETE FROM emails
				 WHERE id = ?
				   AND is_public = 1
				   AND to_address = ?`,
			)
			.bind(
				emailId,
				authenticatedEmail,
			)
			.run();

		if (!success) {
			return c.json(
				ERR(
					error?.message ||
						"Unable to delete email",
					"D1Error",
				),
				500,
			);
		}

		return c.json(
			OK({
				deleted: true,
			}),
		);
	} catch (e: unknown) {
		const error =
			e instanceof Error
				? e
				: new Error(String(e));

		return c.json(
			ERR(error.message, "D1Error"),
			500,
		);
	}
});

/**
 * GET /inbox/{emailId}
 *
 * Only the authenticated mailbox owner can open
 * their own public email.
 */
emailRoutes.openapi(getEmailRoute, async (c) => {
	const { emailId } = c.req.valid("param");

	const authenticatedEmail =
		await getAuthenticatedMailboxEmail(
			c.req.raw,
			c.env.D1,
		);

	if (!authenticatedEmail) {
		return c.json(
			ERR("Authentication required", "Unauthorized"),
			401,
		);
	}

	const dbService = createDatabaseService(c.env.D1);

	const {
		result,
		error,
	} = await dbService.getEmailById(emailId);

	if (error) {
		return c.json(
			ERR(error.message, "D1Error"),
			500,
		);
	}

	if (!result || result.is_public !== true) {
		return c.json(
			ERR("Email not found", "NotFound"),
			404,
		);
	}

	if (
		result.to_address.toLowerCase() !==
		authenticatedEmail.toLowerCase()
	) {
		return c.json(
			ERR("Mailbox access denied", "Forbidden"),
			403,
		);
	}

	return c.json(OK(result));
});

/**
 * DELETE /emails/{emailAddress}
 *
 * Mailbox-wide deletion remains disabled.
 */
emailRoutes.openapi(deleteEmailsRoute, async (c) => {
	const authenticatedEmail =
		await getAuthenticatedMailboxEmail(
			c.req.raw,
			c.env.D1,
		);

	if (!authenticatedEmail) {
		return c.json(
			ERR("Authentication required", "Unauthorized"),
			401,
		);
	}

	return c.json(
		ERR(
			"Mailbox-wide deletion is not available",
			"NotFound",
		),
		404,
	);
});

/**
 * GET /domains
 *
 * Domain list is public and does not require login.
 */
emailRoutes.openapi(getDomainsRoute, async (c) => {
	c.header(
		"Cache-Control",
		`public, max-age=${CACHE.DOMAINS_TTL}`,
	);

	c.header(
		"ETag",
		`"domains-1"`,
	);

	return c.json(
		OK(["vaqzmobiz.com"]),
	);
});

export default emailRoutes;
