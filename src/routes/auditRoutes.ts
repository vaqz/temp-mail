import { ADMIN_AUDIT_CSS } from "@/admin/audit/auditCss";
import { ADMIN_AUDIT_JS } from "@/admin/audit/auditJs";
import { ADMIN_AUDIT_PAGE } from "@/admin/audit/auditPage";
import { isAdminAuthorized } from "@/utils/adminAuth";
import { listAdminAuditActions, listAdminAudits } from "@/utils/adminAudit";
import { OpenAPIHono } from "@hono/zod-openapi";

const auditRoutes = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function unauthorized(c: any) {
  return c.json({ error: { message: "Unauthorized" } }, 401);
}

auditRoutes.get("/admin/audit", async (c) => {
  if (!(await isAdminAuthorized(c))) return c.redirect("/admin", 302);
  return c.html(ADMIN_AUDIT_PAGE);
});

auditRoutes.get("/admin/assets/audit.css", async (c) => {
  if (!(await isAdminAuthorized(c))) return c.redirect("/admin", 302);
  return c.body(ADMIN_AUDIT_CSS, 200, {
    "Content-Type": "text/css; charset=UTF-8",
    "Cache-Control": "no-store",
  });
});

auditRoutes.get("/admin/assets/audit.js", async (c) => {
  if (!(await isAdminAuthorized(c))) return c.redirect("/admin", 302);
  return c.body(ADMIN_AUDIT_JS, 200, {
    "Content-Type": "application/javascript; charset=UTF-8",
    "Cache-Control": "no-store",
  });
});

auditRoutes.get("/admin/api/audit", async (c) => {
  if (!(await isAdminAuthorized(c))) return unauthorized(c);

  try {
    if (c.req.query("action_list") === "1") {
      return c.json({ actions: await listAdminAuditActions(c) });
    }

    const rawPage = Number(c.req.query("page") || "1");
    const rawSize = Number(c.req.query("pageSize") || "50");
    const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
    const pageSize = Number.isFinite(rawSize) ? Math.min(100, Math.max(10, Math.floor(rawSize))) : 50;
    const result = await listAdminAudits(c, {
      page,
      pageSize,
      action: c.req.query("action") || undefined,
      search: c.req.query("search")?.trim() || undefined,
    });

    return c.json({
      items: result.items,
      total: result.total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
    });
  } catch (error) {
    return c.json(
      { error: { message: error instanceof Error ? error.message : String(error) } },
      500,
    );
  }
});

export default auditRoutes;
