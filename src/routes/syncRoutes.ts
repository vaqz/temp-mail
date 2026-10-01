import { OpenAPIHono } from "@hono/zod-openapi";

const syncRoutes = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

const ALLOWED_DOMAINS = [
	"@vaqzmobiz.com",
	"@vmhub.top",
];

const MAX_BATCH_SIZE = 50;

interface SyncAccount {
	email: string;
	password: string;
}

interface SyncRequest {
	mode?: "accounts" | "reconcile" | "test";
	accounts?: SyncAccount[];
	emails?: string[];
	partial?: boolean;
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
	return String(value || "")
		.trim()
		.toLowerCase();
}

function isAllowedDomain(email: string): boolean {
	return ALLOWED_DOMAINS.some((domain) =>
		email.endsWith(domain)
	);
}

async function hashPassword(
	password: string,
	saltBytes?: Uint8Array,
): Promise<{ hash: string; salt: string }> {
	const salt =
		saltBytes ||
		crypto.getRandomValues(new Uint8Array(16));

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

async function getExistingAccounts(c: any) {
	const result = await c.env.D1
		.prepare(
			`SELECT
				email,
				password_hash,
				password_salt,
				is_active
			FROM mailbox_accounts
			WHERE email LIKE ? OR email LIKE ?`,
		)
		.bind(
			"%" + ALLOWED_DOMAINS[0],
			"%" + ALLOWED_DOMAINS[1],
		)
		.all<{
			email: string;
			password_hash: string | null;
			password_salt: string | null;
			is_active: number;
		}>();

	return result.results;
}


/* =========================================================
 * POST /sync/mailbox-accounts
 *
 * Modes:
 *
 * accounts:
 *   Process one batch of accounts.
 *
 * reconcile:
 *   Disable accounts that exist in D1 but are no longer
 *   present in the Google Sheet.
 *
 * test:
 *   Safe connectivity test. Does not modify D1.
 * ========================================================= */

syncRoutes.post(
	"/sync/mailbox-accounts",
	async (c) => {
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
			const body =
				(await c.req.json()) as SyncRequest;

			const mode = body.mode || "accounts";


			/* =================================================
			 * SAFE TEST
			 * ================================================= */

			if (mode === "test") {
				return c.json({
					success: true,
					message:
						"Cloudflare mailbox sync connection is working.",
				});
			}


			/* =================================================
			 * RECONCILE
			 * ================================================= */

			if (mode === "reconcile") {
				if (!Array.isArray(body.emails)) {
					return c.json(
						{
							error: {
								message:
									"emails must be an array",
							},
						},
						400,
					);
				}

				const allowedEmails =
					new Set<string>();

				for (const value of body.emails) {
					const email =
						normalizeEmail(value);

					if (
						email &&
						isAllowedDomain(email) &&
						email.length <= 320
					) {
						allowedEmails.add(email);
					}
				}

				const existing =
					await getExistingAccounts(c);

				const statements: any[] = [];

				for (const row of existing) {
					const email =
						row.email.toLowerCase();

					if (
						!allowedEmails.has(email) &&
						row.is_active !== 0
					) {
						statements.push(
							c.env.D1
								.prepare(
									`UPDATE mailbox_accounts
									 SET is_active = 0,
										 updated_at = ?
									 WHERE email = ?`,
								)
								.bind(
									Date.now(),
									email,
								),
						);
					}
				}

				/*
				 * D1 batch keeps reconciliation efficient.
				 * Process in groups to avoid creating an
				 * unnecessarily large batch.
				 */
				const BATCH_SIZE = 100;

				for (
					let i = 0;
					i < statements.length;
					i += BATCH_SIZE
				) {
					const chunk =
						statements.slice(
							i,
							i + BATCH_SIZE,
						);

					if (chunk.length > 0) {
						await c.env.D1.batch(
							chunk,
						);
					}
				}

				return c.json({
					success: true,
					mode: "reconcile",
					checked: allowedEmails.size,
					disabled:
						statements.length,
				});
			}


			/* =================================================
			 * ACCOUNT BATCH
			 * ================================================= */

			if (!Array.isArray(body.accounts)) {
				return c.json(
					{
						error: {
							message:
								"accounts must be an array",
						},
					},
					400,
				);
			}

			if (
				body.accounts.length >
				MAX_BATCH_SIZE
			) {
				return c.json(
					{
						error: {
							message:
								`Maximum ${MAX_BATCH_SIZE} accounts per batch`,
						},
					},
					400,
				);
			}

			const normalizedAccounts =
				new Map<string, string>();

			for (
				const account of body.accounts
			) {
				const email =
					normalizeEmail(
						account?.email,
					);

				const password =
					String(
						account?.password || "",
					);

				if (!email) {
					continue;
				}

				if (!isAllowedDomain(email)) {
					continue;
				}

				if (email.length > 320) {
					continue;
				}

				normalizedAccounts.set(
					email,
					password,
				);
			}

			const accounts =
				Array.from(
					normalizedAccounts.entries(),
				);

			const existing =
				await getExistingAccounts(c);

			const existingMap =
				new Map(
					existing.map((row) => [
						row.email.toLowerCase(),
						row,
					]),
				);

			const now = Date.now();

			let created = 0;
			let updated = 0;
			let disabled = 0;
			let unchanged = 0;

			const statements: any[] = [];


			/* =================================================
			 * PROCESS ACCOUNTS
			 * ================================================= */

			for (
				const [email, password]
				of accounts
			) {
				const current =
					existingMap.get(email);


				/*
				 * Blank password:
				 *
				 * Keep account record but disable login.
				 */

				if (!password) {
					if (!current) {
						statements.push(
							c.env.D1
								.prepare(
									`INSERT INTO mailbox_accounts
										(
											email,
											password_hash,
											password_salt,
											is_active,
											created_at,
											updated_at
										)
									 VALUES (?, NULL, NULL, 0, ?, ?)`,
								)
								.bind(
									email,
									now,
									now,
								),
						);

						created++;
					} else if (
						current.is_active !== 0
					) {
						statements.push(
							c.env.D1
								.prepare(
									`UPDATE mailbox_accounts
									 SET is_active = 0,
										 updated_at = ?
									 WHERE email = ?`,
								)
								.bind(
									now,
									email,
								),
						);

						disabled++;
					}

					continue;
				}


				/*
				 * Existing account:
				 *
				 * Verify Sheet password against
				 * existing password hash.
				 */

				if (
					current &&
					current.password_hash &&
					current.password_salt
				) {
					const matches =
						await verifyPassword(
							password,
							current.password_hash,
							current.password_salt,
						);

					if (matches) {
						if (
							current.is_active !==
							1
						) {
							statements.push(
								c.env.D1
									.prepare(
										`UPDATE mailbox_accounts
										 SET is_active = 1,
											 updated_at = ?
										 WHERE email = ?`,
									)
									.bind(
										now,
										email,
									),
							);

							updated++;
						} else {
							unchanged++;
						}

						continue;
					}
				}


				/*
				 * New account OR changed password.
				 */

				const passwordData =
					await hashPassword(
						password,
					);

				if (!current) {
					statements.push(
						c.env.D1
							.prepare(
								`INSERT INTO mailbox_accounts
									(
										email,
										password_hash,
										password_salt,
										is_active,
										created_at,
										updated_at
									)
								 VALUES (?, ?, ?, 1, ?, ?)`,
							)
							.bind(
								email,
								passwordData.hash,
								passwordData.salt,
								now,
								now,
							),
					);

					created++;
				} else {
					statements.push(
						c.env.D1
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
							),
					);

					updated++;
				}
			}


			/* =================================================
			 * WRITE ACCOUNT CHANGES
			 * ================================================= */

			if (statements.length > 0) {
				await c.env.D1.batch(
					statements,
				);
			}


			return c.json({
				success: true,
				mode: "accounts",
				partial:
					body.partial === true,
				synced: accounts.length,
				created,
				updated,
				disabled,
				unchanged,
			});

		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: String(error);

			return c.json(
				{
					error: {
						message,
					},
				},
				500,
			);
		}
	},
);

export default syncRoutes;
