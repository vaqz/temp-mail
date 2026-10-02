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

adminDashboardUiRoutes.get("/", (c) => c.html(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0f2b75">
<title>Vaqz Mobiz Mail · Admin Gateway</title>
<link rel="icon" href="/admin/favicon.svg" type="image/svg+xml">
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f7fb;color:#10234d;display:grid;place-items:center;padding:24px}
.gateway{width:min(560px,100%);background:#fff;border:1px solid #e2e8f0;border-radius:24px;padding:34px;box-shadow:0 20px 55px rgba(15,43,117,.10);text-align:center}
.mark{width:64px;height:64px;margin:0 auto 18px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(145deg,#0f5fe8,#1647b8);color:#fff;box-shadow:0 10px 24px rgba(37,99,235,.25)}
.mark svg{width:32px;height:32px}
h1{margin:0;font-size:28px;letter-spacing:-.02em}
.subtitle{margin-top:7px;color:#64748b;font-size:14px}
.divider{height:1px;background:#e8edf4;margin:26px 0}
.status{display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border-radius:999px;background:#ecfdf3;color:#166534;font-size:12px;font-weight:700}
.dot{width:7px;height:7px;border-radius:50%;background:#16a34a}
p{color:#64748b;line-height:1.6;margin:20px 0 24px}
.open{display:inline-flex;align-items:center;justify-content:center;gap:9px;width:100%;padding:13px 18px;border-radius:12px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700;transition:transform .15s ease,box-shadow .15s ease,background .15s ease;box-shadow:0 8px 20px rgba(37,99,235,.20)}
.open:hover{background:#1d4ed8;transform:translateY(-1px);box-shadow:0 11px 24px rgba(37,99,235,.25)}
.open svg{width:18px;height:18px}
.note{margin-top:16px;font-size:12px;color:#94a3b8}
@media(max-width:480px){body{padding:14px}.gateway{padding:28px 20px;border-radius:20px}h1{font-size:24px}}
</style>
</head>
<body>
<section class="gateway">
  <div class="mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5h16v13H4z"/><path d="m4 7 8 6 8-6"/></svg></div>
  <h1>Vaqz Mobiz Mail Admin</h1>
  <div class="subtitle">Administration gateway</div>
  <div class="divider"></div>
  <span class="status"><span class="dot"></span> Admin service online</span>
  <p>This address is the administration gateway. Continue to the secure administration panel to manage messages, visibility rules and mailbox domains.</p>
  <a class="open" href="/admin">Open Administration <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></svg></a>
  <div class="note">Authorized access is required inside the administration panel.</div>
</section>
</body>
</html>`));

adminDashboardUiRoutes.get("/admin", (c) => c.html(ADMIN_DASHBOARD_PAGE));

adminDashboardUiRoutes.get("/admin/favicon.svg", (c) =>
  c.body(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#2563eb"/><path d="M14 18h36v28H14z" fill="none" stroke="#fff" stroke-width="4"/><path d="m14 21 18 14 18-14" fill="none" stroke="#fff" stroke-width="4"/></svg>`, 200, {
    "Content-Type": "image/svg+xml; charset=UTF-8",
    "Cache-Control": "public, max-age=86400",
  }),
);

adminDashboardUiRoutes.get("/admin/assets/dashboard.css", (c) =>
  c.body(ADMIN_DASHBOARD_CSS, 200, {
    "Content-Type": "text/css; charset=UTF-8",
    "Cache-Control": "no-store",
  }),
);

adminDashboardUiRoutes.get("/admin/assets/dashboard.js", (c) => {
  // dashboardJs.ts is a template literal, so URL regex escapes are consumed
  // while the JavaScript asset is emitted. Replace the emitted regex using
  // its actual runtime text with a regex-free URL check.
  const brokenRegex = 'if (/^(https?://|mailto:|tel:)/i.test(href)) {';
  const safeRegex = 'if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("tel:")) {';
  const safeDashboardJs = ADMIN_DASHBOARD_JS.split(brokenRegex).join(safeRegex);

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
    const result = await c.env.D1.prepare(
      `SELECT id, from_address, to_address, subject, received_at, has_attachments, attachment_count, is_public FROM emails ${where} ORDER BY received_at DESC LIMIT ? OFFSET ?`,
    ).bind(...params, pageSize, offset).all();

    const items = (result.results as any[]).map((row) => ({
      ...row,
      has_attachments: Boolean(row.has_attachments),
      is_public: Boolean(row.is_public),
    }));
    const total = Number((countRow as any)?.count || 0);

    return c.json({
      items,
      total,
      publicCount: Number((publicRow as any)?.count || 0),
      privateCount: Number((privateRow as any)?.count || 0),
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (error) {
    return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
  }
});

adminDashboardUiRoutes.post("/admin/api/emails/bulk", async (c) => {
  if (!authorized(c)) return unauthorized(c);

  try {
    const body = await c.req.json();
    const rawIds = Array.isArray(body?.ids) ? body.ids : [];
    const ids = Array.from(
      new Set(rawIds.map((id: unknown) => String(id || "").trim()).filter(Boolean)),
    ).slice(0, 100);
    if (!ids.length) return c.json({ error: { message: "No email IDs supplied" } }, 400);

    const statements = ids.map((id) => c.env.D1.prepare("DELETE FROM emails WHERE id = ?").bind(id));
    const results = await c.env.D1.batch(statements);
    let deleted = 0;
    for (const result of results) deleted += Number(result.meta?.changes || 0);

    return c.json({ success: true, requested: ids.length, deleted });
  } catch (error) {
    return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
  }
});

export default adminDashboardUiRoutes;
