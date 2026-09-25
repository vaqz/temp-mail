import { OpenAPIHono } from "@hono/zod-openapi";

const syncRoutes = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

const ALLOWED_DOMAIN = "@vaqzmobiz.com";

interface SyncAccount {
	email: string;
	password: string;
}

interface SyncRequest {
	accounts: SyncAccount[];
}

function isAuthorized(c: any): boolean {
	const auth = c.req.header("Authorization");
	const token = c.env.SHEET_SYNC_TOKEN;

	if (!token || !auth) {
		return false;
	}

	return auth === `Bearer ${token}`;
}

function normalizeEmail(value: unknown): string {
	return String(value || "").trim().toLowerCase();
}

async function hashPassword(
	password: string,
	saltBytes?: Uint8Array,
): Promise<{ hash: string; salt: string }> {
	const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));

	const encoder = new TextEncoder();

	const passwordKey = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt,
			iterations: 100000,
			hash: "SHA-256",
		},
		passwordKey,
		256,
	);

	return {
		hash: bytesToBase64(new Uint8Array(derivedBits)),
		salt: bytesToBase64(salt),
	};
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";

	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);

	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return bytes;
}

async function verifyPassword(
	password: string,
	hash: string,
	salt: string,
): Promise<boolean> {
	const encoder = new TextEncoder();

	const passwordKey = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: base64ToBytes(salt),
			iterations: 100000,
			hash: "SHA-256",
		},
		passwordKey,
		256,
	);

	const derived = new Uint8Array(derivedBits);
	const stored = base64ToBytes(hash);

	if (derived.length !== stored.length) {
		return false;
	}

	let difference = 0;

	for (let i = 0; i < derived.length; i++) {
		difference |= derived[i] ^ stored[i];
	}

	return difference === 0;
}

/*
 * POST /sync/mailbox-accounts
 *
 * Called by Google Apps Script.
 *
 * Authorization:
 * Bearer SHEET_SYNC_TOKEN
 *
 * Only @vaqzmobiz.com accounts are accepted.
 */
syncRoutes.post("/sync/mailbox-accounts", async (c) => {
	if (!isAuthorized(c)) {
		return c.json(
			{
				error: {
					message: "Unauthorized",
				},
			},
			401,
		);
	}

	try {
		const body = (await c.req.json()) as SyncRequest;

		if (!body || !Array.isArray(body.accounts)) {
			return c.json(
				{
					error: {
						message: "accounts must be an array",
					},
				},
				400,
			);
		}

		if (body.accounts.length > 1500) {
			return c.json(
				{
					error: {
						message: "Too many accounts in one sync request",
					},
				},
				400,
			);
		}

		const normalizedAccounts = new Map<
			string,
			string
		>();

		for (const account of body.accounts) {
			const email = normalizeEmail(account?.email);
			const password = String(account?.password || "");

			if (!email) {
				continue;
			}

			if (!email.endsWith(ALLOWED_DOMAIN)) {
				continue;
			}

			if (email.length > 320) {
				continue;
			}

			/*
			 * Blank passwords are deliberately retained as disabled
			 * accounts. They will not be able to log in.
			 */
			normalizedAccounts.set(email, password);
		}

		const accounts = Array.from(normalizedAccounts.entries());

		const now = Date.now();

		let created = 0;
		let updated = 0;
		let disabled = 0;
		let unchanged = 0;

		/*
		 * Get all existing Vaqz Mobiz accounts.
		 */
		const existingResult = await c.env.D1
			.prepare(
				`SELECT
					email,
					password_hash,
					password_salt,
					is_active
				FROM mailbox_accounts
				WHERE email LIKE ?`,
			)
			.bind("%" + ALLOWED_DOMAIN)
			.all<{
				email: string;
				password_hash: string | null;
				password_salt: string | null;
				is_active: number;
			}>();

		const existingMap = new Map(
			existingResult.results.map((row) => [
				row.email.toLowerCase(),
				row,
			]),
		);

		/*
		 * Process incoming accounts.
		 */
		for (const [email, password] of accounts) {
			const existing = existingMap.get(email);

			/*
			 * No password:
			 * Keep the account but disable login.
			 */
			if (!password) {
				if (!existing) {
					await c.env.D1
						.prepare(
							`INSERT INTO mailbox_accounts
								(email, password_hash, password_salt, is_active, created_at, updated_at)
							 VALUES (?, NULL, NULL, 0, ?, ?)`,
						)
						.bind(email, now, now)
						.run();

					created++;
				} else if (existing.is_active !== 0) {
					await c.env.D1
						.prepare(
							`UPDATE mailbox_accounts
							 SET is_active = 0,
								 updated_at = ?
							 WHERE email = ?`,
						)
						.bind(now, email)
						.run();

					disabled++;
				}

				continue;
			}

			/*
			 * Existing account with a stored password:
			 * verify the Sheet password against the existing hash.
			 *
			 * If it matches, nothing needs to be re-hashed.
			 */
			if (
				existing &&
				existing.password_hash &&
				existing.password_salt
			) {
				const matches = await verifyPassword(
					password,
					existing.password_hash,
					existing.password_salt,
				);

				if (matches) {
					if (existing.is_active !== 1) {
						await c.env.D1
							.prepare(
								`UPDATE mailbox_accounts
								 SET is_active = 1,
									 updated_at = ?
								 WHERE email = ?`,
							)
							.bind(now, email)
							.run();

						updated++;
					} else {
						unchanged++;
					}

					continue;
				}
			}

			/*
			 * New account or changed password.
			 */
			const passwordData = await hashPassword(password);

			if (!existing) {
				await c.env.D1
					.prepare(
						`INSERT INTO mailbox_accounts
							(email, password_hash, password_salt, is_active, created_at, updated_at)
						 VALUES (?, ?, ?, 1, ?, ?)`,
					)
					.bind(
						email,
						passwordData.hash,
						passwordData.salt,
						now,
						now,
					)
					.run();

				created++;
			} else {
				await c.env.D1
					.prepare(
						`UPDATE mailbox_accounts
						 SET password_hash = ?,
							 password_salt = ?,
							 is_active = 1,
							 updated_at = ?
						 WHERE email = ?`,
					)
					.bind(
						passwordData.hash,
						passwordData.salt,
						now,
						email,
					)
					.run();

				updated++;
			}
		}

		/*
		 * Accounts that exist in D1 but were not included in the Sheet
		 * are disabled rather than deleted.
		 *
		 * This prevents accidental loss of account records.
		 */
		for (const [email, existing] of existingMap) {
			if (!normalizedAccounts.has(email) && existing.is_active !== 0) {
				await c.env.D1
					.prepare(
						`UPDATE mailbox_accounts
						 SET is_active = 0,
							 updated_at = ?
						 WHERE email = ?`,
					)
					.bind(now, email)
					.run();

				disabled++;
			}
		}

		return c.json({
			success: true,
			synced: accounts.length,
			created,
			updated,
			disabled,
			unchanged,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : String(error);

		return c.json(
			{
				error: {
					message,
				},
			},
			500,
		);
	}
});

export default syncRoutes;
