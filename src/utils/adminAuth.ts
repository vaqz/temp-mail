import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";

const ADMIN_SESSION_COOKIE = "__Host-vm_admin_session";
const ADMIN_SESSION_VALUE = "authenticated";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export async function isAdminAuthorized(c: any): Promise<boolean> {
	const configuredToken = String(c.env.ADMIN_TOKEN || "");
	if (!configuredToken) return false;

	const authorization = c.req.header("Authorization") || "";
	if (authorization === `Bearer ${configuredToken}`) {
		await setSignedCookie(c, ADMIN_SESSION_COOKIE, ADMIN_SESSION_VALUE, configuredToken, {
			path: "/",
			secure: true,
			httpOnly: true,
			sameSite: "Lax",
			maxAge: ADMIN_SESSION_MAX_AGE,
			prefix: "host",
		});
		return true;
	}

	const session = await getSignedCookie(c, configuredToken, ADMIN_SESSION_COOKIE, "host");

	return session === ADMIN_SESSION_VALUE;
}

export function clearAdminSession(c: any): void {
	deleteCookie(c, ADMIN_SESSION_COOKIE, {
		path: "/",
		secure: true,
		prefix: "host",
	});
}
