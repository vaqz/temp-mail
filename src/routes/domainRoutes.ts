import {
	getActiveDomainDestinations,
	getActiveMailboxDomains,
} from "@/utils/mailboxDomains";
import { isAdminAuthorized } from "@/utils/adminAuth";
import { writeAdminAudit } from "@/utils/adminAudit";
import { OpenAPIHono } from "@hono/zod-openapi";

export { getActiveDomainDestinations, getActiveMailboxDomains } from "@/utils/mailboxDomains";

const domainRoutes = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function normalizeDomain(value: unknown): string {
	return String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function normalizeDestination(value: unknown): string {
	return String(value || "").trim().toLowerCase();
}

function validDomain(domain: string): boolean {
	return domain.length <= 253 && /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain);
}

function validEmail(email: string): boolean {
	return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* =========================================================
   DOMAIN API
========================================================= */

domainRoutes.get("/admin/api/domains", async (c) => {
	if (!(await isAdminAuthorized(c))) return c.json({ error: { message: "Unauthorized" } }, 401);
	try {
		const domains = await c.env.D1.prepare(
			`SELECT domain, is_active, created_at, updated_at FROM mailbox_domains ORDER BY domain ASC`,
		).all();
		const destinations = await c.env.D1.prepare(
			`SELECT id, domain, destination_email, is_active, created_at, updated_at FROM mailbox_domain_destinations ORDER BY domain ASC, destination_email ASC`,
		).all();
		const grouped = new Map<string, any[]>();
		for (const row of destinations.results as Array<any>) {
			const list = grouped.get(String(row.domain)) || [];
			list.push(row);
			grouped.set(String(row.domain), list);
		}
		return c.json((domains.results as Array<any>).map((row) => ({
			...row,
			is_active: Boolean(row.is_active),
			destinations: grouped.get(String(row.domain)) || [],
		})));
	} catch (error) {
		return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
	}
});

domainRoutes.post("/admin/api/domains", async (c) => {
	if (!(await isAdminAuthorized(c))) return c.json({ error: { message: "Unauthorized" } }, 401);
	try {
		const body = await c.req.json();
		const domain = normalizeDomain(body?.domain);
		const destination = normalizeDestination(body?.destination_email);
		if (!validDomain(domain)) return c.json({ error: { message: "Invalid domain." } }, 400);
		if (destination && !validEmail(destination)) return c.json({ error: { message: "Invalid destination email." } }, 400);
		const now = Date.now();
		await c.env.D1.prepare(
			`INSERT INTO mailbox_domains (domain, is_active, created_at, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(domain) DO UPDATE SET is_active = 1, updated_at = excluded.updated_at`,
		).bind(domain, now, now).run();
		if (destination) {
			await c.env.D1.prepare(
				`INSERT OR IGNORE INTO mailbox_domain_destinations (id, domain, destination_email, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`,
			).bind(crypto.randomUUID(), domain, destination, now, now).run();
			await c.env.D1.prepare(
				`UPDATE mailbox_domain_destinations SET is_active = 1, updated_at = ? WHERE domain = ? AND destination_email = ?`,
			).bind(now, domain, destination).run();
		}
		await writeAdminAudit(c, { action: "UPSERT_DOMAIN", resourceType: "mailbox_domain", resourceId: domain, summary: `Enabled mailbox domain ${domain}.`, details: { destination_email: destination || null } });\n\t\treturn c.json({ success: true, domain });
	} catch (error) {
		return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
	}
});

domainRoutes.patch("/admin/api/domains/:domain", async (c) => {
	if (!(await isAdminAuthorized(c))) return c.json({ error: { message: "Unauthorized" } }, 401);
	try {
		const domain = normalizeDomain(c.req.param("domain"));
		const body = await c.req.json();
		if (typeof body?.is_active !== "boolean") return c.json({ error: { message: "is_active must be boolean." } }, 400);
		const result = await c.env.D1.prepare(`UPDATE mailbox_domains SET is_active = ?, updated_at = ? WHERE domain = ?`).bind(body.is_active ? 1 : 0, Date.now(), domain).run();
		if (!result.success) return c.json({ error: { message: "Failed to update domain." } }, 500);
		await writeAdminAudit(c, { action: "UPDATE_DOMAIN", resourceType: "mailbox_domain", resourceId: domain, summary: `${body.is_active ? "Enabled" : "Disabled"} mailbox domain ${domain}.`, details: { is_active: body.is_active } });\n\t\treturn c.json({ success: true, domain, is_active: body.is_active });
	} catch (error) {
		return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
	}
});

domainRoutes.post("/admin/api/domains/:domain/destinations", async (c) => {
	if (!(await isAdminAuthorized(c))) return c.json({ error: { message: "Unauthorized" } }, 401);
	try {
		const domain = normalizeDomain(c.req.param("domain"));
		const body = await c.req.json();
		const destination = normalizeDestination(body?.destination_email);
		if (!validDomain(domain)) return c.json({ error: { message: "Invalid domain." } }, 400);
		if (!validEmail(destination)) return c.json({ error: { message: "Invalid destination email." } }, 400);
		const existingDomain = await c.env.D1.prepare(`SELECT domain FROM mailbox_domains WHERE domain = ? LIMIT 1`).bind(domain).first();
		if (!existingDomain) return c.json({ error: { message: "Domain does not exist." } }, 404);
		const now = Date.now();
		const existing = await c.env.D1.prepare(`SELECT id FROM mailbox_domain_destinations WHERE domain = ? AND destination_email = ? LIMIT 1`).bind(domain, destination).first();
		if (existing) {
			await c.env.D1.prepare(`UPDATE mailbox_domain_destinations SET is_active = 1, updated_at = ? WHERE id = ?`).bind(now, (existing as any).id).run();
			await writeAdminAudit(c, { action: "UPSERT_DOMAIN_DESTINATION", resourceType: "mailbox_domain_destination", resourceId: (existing as any).id, summary: `Re-enabled destination ${destination} for ${domain}.`, details: { domain, destination_email: destination } });\n\t\t\treturn c.json({ success: true, id: (existing as any).id });
		}
		const id = crypto.randomUUID();
		await c.env.D1.prepare(`INSERT INTO mailbox_domain_destinations (id, domain, destination_email, is_active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)`).bind(id, domain, destination, now, now).run();
		await writeAdminAudit(c, { action: "ADD_DOMAIN_DESTINATION", resourceType: "mailbox_domain_destination", resourceId: id, summary: `Added destination ${destination} for ${domain}.`, details: { domain, destination_email: destination } });\n\t\treturn c.json({ success: true, id });
	} catch (error) {
		return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
	}
});

domainRoutes.delete("/admin/api/destinations/:id", async (c) => {
	if (!(await isAdminAuthorized(c))) return c.json({ error: { message: "Unauthorized" } }, 401);
	try {
		const id = c.req.param("id");
		await c.env.D1.prepare(`DELETE FROM mailbox_domain_destinations WHERE id = ?`).bind(id).run();
		return c.json({ success: true, id });
	} catch (error) {
		return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
	}
});

export default domainRoutes;
