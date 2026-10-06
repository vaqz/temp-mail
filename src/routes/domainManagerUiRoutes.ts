import { OpenAPIHono } from "@hono/zod-openapi";
import { DOMAINS_CSS } from "@/admin/domains/domainsCss";
import { DOMAINS_JS } from "@/admin/domains/domainsJs";
import { DOMAINS_PAGE } from "@/admin/domains/domainsPage";

const domainManagerUiRoutes = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

domainManagerUiRoutes.get("/admin/domains", async (c) => {
	if (!(await isAdminAuthorized(c))) return c.redirect("/admin", 302);
	return c.html(DOMAINS_PAGE);
});

domainManagerUiRoutes.get("/admin/assets/domains.css", (c) =>
	c.body(DOMAINS_CSS, 200, {
		"Content-Type": "text/css; charset=UTF-8",
		"Cache-Control": "no-store",
	}),
);

domainManagerUiRoutes.get("/admin/assets/domains.js", (c) =>
	c.body(DOMAINS_JS, 200, {
		"Content-Type": "application/javascript; charset=UTF-8",
		"Cache-Control": "no-store",
	}),
);

export default domainManagerUiRoutes;
