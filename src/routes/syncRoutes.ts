import { OpenAPIHono } from "@hono/zod-openapi";
import { getActiveMailboxDomains } from "@/routes/domainRoutes";

const syncRoutes = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

const MAX_BATCH_SIZE = 50;

interface SyncAccount { email: string; password: string }
interface SyncRequest { mode?: "accounts" | "reconcile" | "test"; accounts?: SyncAccount[]; emails?: string[]; partial?: boolean }

function isAuthorized(c: any): boolean {
	const auth = c.req.header("Authorization");
	const token = c.env.SHEET_SYNC_TOKEN;
	return Boolean(token && auth === `Bearer ${token}`);
}

function normalizeEmail(value: unknown): string {
	return String(value || "").trim().toLowerCase();
}

function isAllowedDomain(email: string, domains: string[]): boolean {
	return domains.some((domain) => email.endsWith(`@${domain}`));
}

async function hashPassword(password: string, saltBytes?: Uint8Array): Promise<{ hash: string; salt: string }> {
	const salt = saltBytes || crypto.getRandomValues(new Uint8Array(16));
	const passwordKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
	const derivedBits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, passwordKey, 256);
	return { hash: bytesToBase64(new Uint8Array(derivedBits)), salt: bytesToBase64(salt) };
}

function bytesToBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
	const passwordKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
	const derivedBits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: base64ToBytes(salt), iterations: 100000, hash: "SHA-256" }, passwordKey, 256);
	const derived = new Uint8Array(derivedBits);
	const stored = base64ToBytes(hash);
	if (derived.length !== stored.length) return false;
	let difference = 0;
	for (let i = 0; i < derived.length; i++) difference |= derived[i] ^ stored[i];
	return difference === 0;
}

async function getExistingAccounts(c: any, domains: string[]) {
	if (domains.length === 0) return [];
	const placeholders = domains.map(() => "email LIKE ?").join(" OR ");
	const query = `SELECT email, password_hash, password_salt, is_active FROM mailbox_accounts WHERE ${placeholders}`;
	const result = await c.env.D1.prepare(query).bind(...domains.map((domain) => `%@${domain}`)).all<{
		email: string;
		password_hash: string | null;
		password_salt: string | null;
		is_active: number;
	}>();
	return result.results;
}

/* =========================================================
 * SUPPORTED DOMAINS
 * Apps Script can call this endpoint to keep its filter dynamic.
 * ========================================================= */
syncRoutes.get("/sync/supported-domains", async (c) => {
	if (!isAuthorized(c)) return c.json({ error: { message: "Unauthorized" } }, 401);
	const domains = await getActiveMailboxDomains(c.env.D1);
	return c.json({ success: true, domains });
});

syncRoutes.post("/sync/mailbox-accounts", async (c) => {
	if (!isAuthorized(c)) return c.json({ error: { message: "Unauthorized" } }, 401);

	try {
		const domains = await getActiveMailboxDomains(c.env.D1);
		const body = (await c.req.json()) as SyncRequest;
		const mode = body.mode || "accounts";

		if (mode === "test") {
			return c.json({ success: true, message: "Cloudflare mailbox sync connection is working.", domains });
		}

		if (mode === "reconcile") {
			if (!Array.isArray(body.emails)) return c.json({ error: { message: "emails must be an array" } }, 400);
			const allowedEmails = new Set<string>();
			for (const value of body.emails) {
				const email = normalizeEmail(value);
				if (email && isAllowedDomain(email, domains) && email.length <= 320) allowedEmails.add(email);
			}
			const existing = await getExistingAccounts(c, domains);
			const statements: any[] = [];
			for (const row of existing) {
				const email = row.email.toLowerCase();
				if (!allowedEmails.has(email) && row.is_active !== 0) {
					statements.push(c.env.D1.prepare(`UPDATE mailbox_accounts SET is_active = 0, updated_at = ? WHERE email = ?`).bind(Date.now(), email));
				}
			}
			for (let i = 0; i < statements.length; i += 100) {
				const chunk = statements.slice(i, i + 100);
				if (chunk.length) await c.env.D1.batch(chunk);
			}
			return c.json({ success: true, mode: "reconcile", checked: allowedEmails.size, disabled: statements.length, domains });
		}

		if (!Array.isArray(body.accounts)) return c.json({ error: { message: "accounts must be an array" } }, 400);
		if (body.accounts.length > MAX_BATCH_SIZE) return c.json({ error: { message: `Maximum ${MAX_BATCH_SIZE} accounts per batch` } }, 400);

		const normalizedAccounts = new Map<string, string>();
		for (const account of body.accounts) {
			const email = normalizeEmail(account?.email);
			const password = String(account?.password || "");
			if (!email || email.length > 320 || !isAllowedDomain(email, domains)) continue;
			normalizedAccounts.set(email, password);
		}

		const accounts = Array.from(normalizedAccounts.entries());
		const existing = await getExistingAccounts(c, domains);
		const existingMap = new Map(existing.map((row) => [row.email.toLowerCase(), row]));
		const now = Date.now();
		let created = 0;
		let updated = 0;
		let disabled = 0;
		let unchanged = 0;
		const statements: any[] = [];

		for (const [email, password] of accounts) {
			const current = existingMap.get(email);

			if (!password) {
				if (!current) {
					statements.push(c.env.D1.prepare(`INSERT INTO mailbox_accounts (email, password_hash, password_salt, is_active, created_at, updated_at) VALUES (?, NULL, NULL, 0, ?, ?)`).bind(email, now, now));
					created++;
				} else if (current.is_active !== 0) {
					statements.push(c.env.D1.prepare(`UPDATE mailbox_accounts SET is_active = 0, updated_at = ? WHERE email = ?`).bind(now, email));
					disabled++;
				}
				continue;
			}

			if (current?.password_hash && current.password_salt) {
				const matches = await verifyPassword(password, current.password_hash, current.password_salt);
				if (matches) {
					if (current.is_active !== 1) {
						statements.push(c.env.D1.prepare(`UPDATE mailbox_accounts SET is_active = 1, updated_at = ? WHERE email = ?`).bind(now, email));
						updated++;
					} else {
						unchanged++;
					}
					continue;
				}
			}

			const passwordData = await hashPassword(password);
			if (!current) {
				statements.push(c.env.D1.prepare(`INSERT INTO mailbox_accounts (email, password_hash, password_salt, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`).bind(email, passwordData.hash, passwordData.salt, now, now));
				created++;
			} else {
				statements.push(c.env.D1.prepare(`UPDATE mailbox_accounts SET password_hash = ?, password_salt = ?, is_active = 1, updated_at = ? WHERE email = ?`).bind(passwordData.hash, passwordData.salt, now, email));
				updated++;
			}
		}

		if (statements.length) await c.env.D1.batch(statements);
		return c.json({ success: true, mode: "accounts", partial: body.partial === true, synced: accounts.length, created, updated, disabled, unchanged, domains });
	} catch (error) {
		return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
	}
});

export default syncRoutes;
