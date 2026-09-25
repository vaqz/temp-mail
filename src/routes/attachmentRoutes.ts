import { OpenAPIHono } from "@hono/zod-openapi";
import { createDatabaseService } from "@/database";
import * as r2 from "@/database/r2";
import {
	deleteAttachmentRoute,
	getAttachmentRoute,
	getAttachmentsRoute,
	getEmailAttachmentsRoute,
} from "@/schemas/attachments/routeDefinitions";
import {
	getAuthenticatedMailboxEmail,
} from "@/utils/mailboxAuth";
import { ERR, OK } from "@/utils/http";
import { validateEmailDomain } from "@/utils/validation";

const attachmentRoutes = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

/**
 * GET /emails/{emailAddress}/attachments
 *
 * Returns attachments belonging only to the
 * authenticated mailbox owner.
 */
attachmentRoutes.openapi(
	getEmailAttachmentsRoute,
	async (c) => {
		const { emailAddress } = c.req.valid("param");
		const { limit, offset } = c.req.valid("query");

		const domainValidation =
			validateEmailDomain(emailAddress);

		if (!domainValidation.valid) {
			return c.json(
				domainValidation.error,
				404,
			);
		}

		const authenticatedEmail =
			await getAuthenticatedMailboxEmail(
				c.req.raw,
				c.env.D1,
			);

		if (!authenticatedEmail) {
			return c.json(
				ERR(
					"Authentication required",
					"Unauthorized",
				),
				401,
			);
		}

		if (
			authenticatedEmail.toLowerCase() !==
			emailAddress.toLowerCase()
		) {
			return c.json(
				ERR(
					"Mailbox access denied",
					"Forbidden",
				),
				403,
			);
		}

		const dbService =
			createDatabaseService(c.env.D1);

		const {
			results: allAttachments,
			error: queryError,
		} = await dbService.getEmailsWithAttachments(
			emailAddress,
			1000,
			0,
		);

		if (queryError) {
			return c.json(
				ERR(
					queryError.message,
					"ValidationError",
				),
				400,
			);
		}

		const publicAttachments = [];

		for (const attachment of allAttachments) {
			const {
				result: email,
				error: emailError,
			} = await dbService.getEmailById(
				attachment.email_id,
			);

			if (emailError) {
				console.error(
					`Failed to check email visibility for attachment ${attachment.id}:`,
					emailError,
				);
				continue;
			}

			if (
				email?.is_public === true &&
				email.to_address.toLowerCase() ===
					authenticatedEmail.toLowerCase()
			) {
				publicAttachments.push(
					attachment,
				);
			}
		}

		const sortedAttachments =
			publicAttachments
				.sort(
					(a, b) =>
						b.created_at -
						a.created_at,
				)
				.slice(
					offset,
					offset + limit,
				);

		return c.json(
			OK(sortedAttachments),
		);
	},
);

/**
 * GET /inbox/{emailId}/attachments
 */
attachmentRoutes.openapi(
	getAttachmentsRoute,
	async (c) => {
		const { emailId } =
			c.req.valid("param");

		const authenticatedEmail =
			await getAuthenticatedMailboxEmail(
				c.req.raw,
				c.env.D1,
			);

		if (!authenticatedEmail) {
			return c.json(
				ERR(
					"Authentication required",
					"Unauthorized",
				),
				401,
			);
		}

		const dbService =
			createDatabaseService(c.env.D1);

		const {
			result: email,
			error: emailError,
		} = await dbService.getEmailById(
			emailId,
		);

		if (emailError) {
			return c.json(
				ERR(
					emailError.message,
					"ValidationError",
				),
				400,
			);
		}

		if (
			!email ||
			email.is_public !== true
		) {
			return c.json(
				ERR(
					"Email not found",
					"NotFound",
				),
				404,
			);
		}

		if (
			email.to_address.toLowerCase() !==
			authenticatedEmail.toLowerCase()
		) {
			return c.json(
				ERR(
					"Mailbox access denied",
					"Forbidden",
				),
				403,
			);
		}

		const {
			results,
			error,
		} =
			await dbService.getAttachmentsByEmailId(
				emailId,
			);

		if (error) {
			return c.json(
				ERR(
					error.message,
					"ValidationError",
				),
				400,
			);
		}

		return c.json(OK(results));
	},
);

/**
 * GET /attachments/{attachmentId}
 *
 * Download only attachments belonging to
 * the authenticated mailbox owner.
 */
attachmentRoutes.openapi(
	getAttachmentRoute,
	async (c) => {
		const { attachmentId } =
			c.req.valid("param");

		const authenticatedEmail =
			await getAuthenticatedMailboxEmail(
				c.req.raw,
				c.env.D1,
			);

		if (!authenticatedEmail) {
			return c.json(
				ERR(
					"Authentication required",
					"Unauthorized",
				),
				401,
			);
		}

		const dbService =
			createDatabaseService(c.env.D1);

		const {
			result: attachment,
			error: dbError,
		} =
			await dbService.getAttachmentById(
				attachmentId,
			);

		if (dbError) {
			return c.json(
				ERR(
					dbError.message,
					"ValidationError",
				),
				400,
			);
		}

		if (!attachment) {
			return c.json(
				ERR(
					"Attachment not found",
					"NotFound",
				),
				404,
			);
		}

		const {
			result: email,
			error: emailError,
		} =
			await dbService.getEmailById(
				attachment.email_id,
			);

		if (emailError) {
			return c.json(
				ERR(
					emailError.message,
					"ValidationError",
				),
				400,
			);
		}

		if (
			!email ||
			email.is_public !== true
		) {
			return c.json(
				ERR(
					"Attachment not found",
					"NotFound",
				),
				404,
			);
		}

		if (
			email.to_address.toLowerCase() !==
			authenticatedEmail.toLowerCase()
		) {
			return c.json(
				ERR(
					"Mailbox access denied",
					"Forbidden",
				),
				403,
			);
		}

		const {
			success,
			data,
			error: r2Error,
		} = await r2.getAttachment(
			c.env.R2,
			attachment.r2_key,
		);

		if (!success || !data) {
			return c.json(
				ERR(
					r2Error?.message ||
						"Failed to retrieve attachment",
					"NotFound",
				),
				404,
			);
		}

		c.header(
			"Content-Type",
			attachment.content_type,
		);

		c.header(
			"Content-Disposition",
			`attachment; filename="${attachment.filename}"`,
		);

		c.header(
			"Content-Length",
			attachment.size.toString(),
		);

		return c.body(data.body);
	},
);

/**
 * DELETE /attachments/{attachmentId}
 *
 * Attachment deletion remains disabled.
 */
attachmentRoutes.openapi(
	deleteAttachmentRoute,
	async (c) => {
		const authenticatedEmail =
			await getAuthenticatedMailboxEmail(
				c.req.raw,
				c.env.D1,
			);

		if (!authenticatedEmail) {
			return c.json(
				ERR(
					"Authentication required",
					"Unauthorized",
				),
				401,
			);
		}

		return c.json(
			ERR(
				"Attachment deletion is not available",
				"NotFound",
			),
			404,
		);
	},
);

export default attachmentRoutes;
