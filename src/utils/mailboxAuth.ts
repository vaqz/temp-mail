import {
	createMailboxSession,
	deleteMailboxSession,
	getMailboxAccount,
	getMailboxSessionByTokenHash,
	updateMailboxSessionLastUsed,
} from "@/database/d1";

const SESSION_COOKIE_NAME = "vm_mailbox_session";

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

const ALLOWED_DOMAIN = "@vaqzmobiz.com";

interface MailboxSession {
	id: string;
	account_email: string;
	token_hash: string;
	expires_at: number;
	created_at: number;
	last_used_at: number;
}

function normalizeEmail(value: string): string {
	return value.trim().toLowerCase();
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * SHA-256 hash of a UTF-8 string.
 */
async function sha256(value: string): Promise<string> {
	const data = new TextEncoder().encode(value);

	const digest = await crypto.subtle.digest(
		"SHA-256",
		data,
	);

	return bytesToHex(new Uint8Array(digest));
}

/**
 * Verify a password against the PBKDF2 hash stored in D1.
 */
export async function verifyMailboxPassword(
	password: string,
	passwordHash: string,
	passwordSalt: string,
): Promise<boolean> {
	try {
		const passwordKey = await crypto.subtle.importKey(
			"raw",
			new TextEncoder().encode(password),
			"PBKDF2",
			false,
			["deriveBits"],
		);

		const derivedBits = await crypto.subtle.deriveBits(
			{
				name: "PBKDF2",
				salt: base64ToBytes(passwordSalt),
				iterations: 100000,
				hash: "SHA-256",
			},
			passwordKey,
			256,
		);

		const derived = new Uint8Array(derivedBits);
		const stored = base64ToBytes(passwordHash);

		if (derived.length !== stored.length) {
			return false;
		}

		let difference = 0;

		for (let i = 0; i < derived.length; i++) {
			difference |= derived[i] ^ stored[i];
		}

		return difference === 0;
	} catch {
		return false;
	}
}

function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes;
}

/**
 * Create a random session token.
 */
function generateSessionToken(): string {
	return bytesToBase64(
		crypto.getRandomValues(new Uint8Array(32)),
	);
}

/**
 * Create a random session ID.
 */
function generateSessionId(): string {
	return bytesToHex(
		crypto.getRandomValues(new Uint8Array(16)),
	);
}

/**
 * Get the session cookie value from the request.
 */
function getSessionCookie(request: Request): string | null {
	const cookieHeader = request.headers.get("Cookie");

	if (!cookieHeader) {
		return null;
	}

	const cookies = cookieHeader.split(";");

	for (const cookie of cookies) {
		const [name, ...valueParts] = cookie.trim().split("=");

		if (name === SESSION_COOKIE_NAME) {
			return valueParts.join("=") || null;
		}
	}

	return null;
}

/**
 * Create the browser session cookie.
 */
function buildSessionCookie(
	token: string,
	maxAgeSeconds: number,
): string {
	return [
		`${SESSION_COOKIE_NAME}=${token}`,
		"Path=/",
		"HttpOnly",
		"Secure",
		"SameSite=Lax",
		`Max-Age=${maxAgeSeconds}`,
	].join("; ");
}

/**
 * Create a login session for a mailbox account.
 */
export async function loginMailbox(
	db: D1Database,
	email: string,
	password: string,
): Promise<
	| {
			success: true;
			accountEmail: string;
			cookie: string;
	  }
	| {
			success: false;
			error: string;
	  }
> {
	const normalizedEmail = normalizeEmail(email);

	if (!normalizedEmail.endsWith(ALLOWED_DOMAIN)) {
		return {
			success: false,
			error: "Invalid email or password",
		};
	}

	if (!password) {
		return {
			success: false,
			error: "Invalid email or password",
		};
	}

	const {
		result: account,
		error: accountError,
	} = await getMailboxAccount(db, normalizedEmail);

	if (accountError) {
		return {
			success: false,
			error: "Unable to verify account",
		};
	}

	if (
		!account ||
		account.is_active !== 1 ||
		!account.password_hash ||
		!account.password_salt
	) {
		return {
			success: false,
			error: "Invalid email or password",
		};
	}

	const passwordMatches = await verifyMailboxPassword(
		password,
		account.password_hash,
		account.password_salt,
	);

	if (!passwordMatches) {
		return {
			success: false,
			error: "Invalid email or password",
		};
	}

	const token = generateSessionToken();
	const tokenHash = await sha256(token);

	const sessionId = generateSessionId();

	const now = Date.now();
	const expiresAt = now + SESSION_DURATION_MS;

	const {
		success,
		error: sessionError,
	} = await createMailboxSession(
		db,
		sessionId,
		normalizedEmail,
		tokenHash,
		expiresAt,
		now,
	);

	if (!success) {
		return {
			success: false,
			error:
				sessionError?.message ||
				"Unable to create session",
		};
	}

	return {
		success: true,
		accountEmail: normalizedEmail,
		cookie: buildSessionCookie(
			token,
			SESSION_DURATION_MS / 1000,
		),
	};
}

/**
 * Get the currently authenticated mailbox session.
 */
export async function getMailboxSession(
	request: Request,
	db: D1Database,
): Promise<MailboxSession | null> {
	const token = getSessionCookie(request);

	if (!token) {
		return null;
	}

	const tokenHash = await sha256(token);

	const {
		result: session,
		error,
	} = await getMailboxSessionByTokenHash(
		db,
		tokenHash,
	);

	if (error || !session) {
		return null;
	}

	const mailboxSession = session as MailboxSession;

	await updateMailboxSessionLastUsed(
		db,
		mailboxSession.id,
		Date.now(),
	);

	return mailboxSession;
}

/**
 * Get the currently authenticated mailbox email.
 */
export async function getAuthenticatedMailboxEmail(
	request: Request,
	db: D1Database,
): Promise<string | null> {
	const session = await getMailboxSession(request, db);

	if (!session) {
		return null;
	}

	return session.account_email;
}

/**
 * Log out the current mailbox session.
 */
export async function logoutMailbox(
	request: Request,
	db: D1Database,
): Promise<void> {
	const token = getSessionCookie(request);

	if (!token) {
		return;
	}

	const tokenHash = await sha256(token);

	const {
		result: session,
	} = await getMailboxSessionByTokenHash(
		db,
		tokenHash,
	);

	if (!session) {
		return;
	}

	await deleteMailboxSession(
		db,
		session.id,
	);
}

/**
 * Build a cookie that removes the current session.
 */
export function buildLogoutCookie(): string {
	return [
		`${SESSION_COOKIE_NAME}=`,
		"Path=/",
		"HttpOnly",
		"Secure",
		"SameSite=Lax",
		"Max-Age=0",
	].join("; ");
}
