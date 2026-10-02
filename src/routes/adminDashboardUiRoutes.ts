import { OpenAPIHono } from "@hono/zod-openapi";
import { ADMIN_DASHBOARD_CSS } from "@/admin/dashboard/dashboardCss";
import { ADMIN_DASHBOARD_JS } from "@/admin/dashboard/dashboardJs";
import { ADMIN_DASHBOARD_PAGE } from "@/admin/dashboard/dashboardPage";

const adminDashboardUiRoutes = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

function authorized(c: any): boolean {
	const auth = c.req.header("Authorization");
	const token = c.env.ADMIN_TOKEN;
	return Boolean(token && auth === `Bearer ${token}`);
}

function unauthorized(c: any) {
	return c.json({ error: { message: "Unauthorized" } }, 401);
}

adminDashboardUiRoutes.get("/admin", (c) => c.html(ADMIN_DASHBOARD_PAGE));

adminDashboardUiRoutes.get("/admin/assets/dashboard.css", (c) =>
	c.body(ADMIN_DASHBOARD_CSS, 200, {
		"Content-Type": "text/css; charset=UTF-8",
		"Cache-Control": "no-store",
	}),
);

adminDashboardUiRoutes.get("/admin/assets/dashboard.js", (c) => {
	// dashboardJs.ts is intentionally kept as a template literal. A URL regex
	// containing escaped slashes can be reinterpreted when that template is
	// emitted as JavaScript, so normalize that one expression before sending it.
	const safeDashboardJs = ADMIN_DASHBOARD_JS.replace(
		'if (/^(https?:\\/\\/|mailto:|tel:)/i.test(href)) {',
		'if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("tel:")) {',
	);

	return c.body(safeDashboardJs, 200, {
		"Content-Type": "application/javascript; charset=UTF-8",
		"Cache-Control": "no-store",
	});
});

adminDashboardUiRoutes.get("/admin/api/emails", async (c) => {
	if (!authorized(c)) return unauthorized(c);

	try {
		const url = new URL(c.req.url);
		const rawPage = Number(url.searchParams.get("page") || "1");
		const rawSize = Number(url.searchParams.get("pageSize") || "50");
		const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
		const pageSize = Number.isFinite(rawSize) ? Math.min(100, Math.max(10, Math.floor(rawSize))) : 50;
		const offset = (page - 1) * pageSize;
		const search = (url.searchParams.get("search") || "").trim();
		const visibility = url.searchParams.get("visibility") || "all";

		if (!["all", "public", "private"].includes(visibility)) {
			return c.json({ error: { message: "Invalid visibility filter" } }, 400);
		}

		const conditions: string[] = [];
		const params: unknown[] = [];
		if (search) {
			conditions.push("(from_address LIKE ? OR to_address LIKE ? OR subject LIKE ?)");
			const pattern = `%${search}%`;
			params.push(pattern, pattern, pattern);
		}
		if (visibility === "public") conditions.push("is_public = 1");
		if (visibility === "private") conditions.push("is_public = 0");
		const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

		const countRow = await c.env.D1.prepare(`SELECT COUNT(*) as count FROM emails ${where}`).bind(...params).first();
		const publicRow = await c.env.D1.prepare("SELECT COUNT(*) as count FROM emails WHERE is_public = 1").first();
		const privateRow = await c.env.D1.prepare("SELECT COUNT(*) as count FROM emails WHERE is_public = 0").first();
		const result = await c.env.D1.prepare(`SELECT id, from_address, to_address, subject, received_at, has_attachments, attachment_count, is_public FROM emails ${where} ORDER BY received_at DESC LIMIT ? OFFSET ?`).bind(...params, pageSize, offset).all();

		const items = (result.results as any[]).map(row => ({ ...row, has_attachments: Boolean(row.has_attachments), is_public: Boolean(row.is_public) }));
		const total = Number((countRow as any)?.count || 0);
		return c.json({ items, total, publicCount: Number((publicRow as any)?.count || 0), privateCount: Number((privateRow as any)?.count || 0), page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
	} catch (error) {
		return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
	}
});

adminDashboardUiRoutes.post("/admin/api/emails/bulk", async (c) => {
	if (!authorized(c)) return unauthorized(c);
	try {
		const body = await c.req.json();
		const rawIds = Array.isArray(body?.ids) ? body.ids : [];
		const ids = Array.from(new Set(rawIds.map((id: unknown) => String(id || "").trim()).filter(Boolean))).slice(0, 100);
		if (!ids.length) return c.json({ error: { message: "No email IDs supplied" } }, 400);

		const statements = ids.map(id => c.env.D1.prepare("DELETE FROM emails WHERE id = ?").bind(id));
		const results = await c.env.D1.batch(statements);
		let deleted = 0;
		for (const result of results) deleted += Number(result.meta?.changes || 0);
		return c.json({ success: true, requested: ids.length, deleted });
	} catch (error) {
		return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
	}
});

export default adminDashboardUiRoutes;
