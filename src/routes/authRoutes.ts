import { OpenAPIHono } from "@hono/zod-openapi";

import {
	getAuthenticatedMailboxEmail,
	loginMailbox,
	logoutMailbox,
	buildLogoutCookie,
} from "@/utils/mailboxAuth";

const authRoutes = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

interface LoginRequest {
	email?: string;
	password?: string;
}

/**
 * POST /auth/login
 *
 * Authenticate a Vaqz Mobiz mailbox account.
 */
authRoutes.post("/auth/login", async (c) => {
	try {
		const body = (await c.req.json()) as LoginRequest;

		const email = String(body?.email || "").trim();
		const password = String(body?.password || "");

		if (!email || !password) {
			return c.json(
				{
					success: false,
					error: "Email and password are required",
				},
				400,
			);
		}

		const result = await loginMailbox(
			c.env.D1,
			email,
			password,
		);

		if (!result.success) {
			return c.json(
				{
					success: false,
					error: result.error,
				},
				401,
			);
		}

		c.header("Set-Cookie", result.cookie);

		return c.json({
			success: true,
			email: result.accountEmail,
		});
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: String(error);

		console.error("Mailbox login error:", message);

		return c.json(
			{
				success: false,
				error: "Unable to process login",
			},
			500,
		);
	}
});

/**
 * GET /auth/me
 *
 * Return the currently authenticated mailbox.
 */
authRoutes.get("/auth/me", async (c) => {
	try {
		const email = await getAuthenticatedMailboxEmail(
			c.req.raw,
			c.env.D1,
		);

		if (!email) {
			return c.json(
				{
					authenticated: false,
				},
				401,
			);
		}

		return c.json({
			authenticated: true,
			email,
		});
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: String(error);

		console.error("Mailbox session check error:", message);

		return c.json(
			{
				authenticated: false,
			},
			401,
		);
	}
});

/**
 * POST /auth/logout
 *
 * Delete the current mailbox session.
 */
authRoutes.post("/auth/logout", async (c) => {
	try {
		await logoutMailbox(
			c.req.raw,
			c.env.D1,
		);

		c.header(
			"Set-Cookie",
			buildLogoutCookie(),
		);

		return c.json({
			success: true,
		});
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: String(error);

		console.error("Mailbox logout error:", message);

		/*
		 * Even if the database lookup fails, expire the
		 * browser cookie so the client is logged out locally.
		 */
		c.header(
			"Set-Cookie",
			buildLogoutCookie(),
		);

		return c.json({
			success: true,
		});
	}
});

export default authRoutes;
