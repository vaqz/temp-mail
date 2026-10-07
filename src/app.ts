import adminDashboardUiRoutes from "@/routes/adminDashboardUiRoutes";
import adminRoutes from "@/routes/adminRoutes";
import domainRoutes from "@/routes/domainRoutes";
import domainManagerUiRoutes from "@/routes/domainManagerUiRoutes";
import productRoutes from "@/routes/productRoutes";
import credentialRoutes from "@/routes/credentialRoutes";
import allocationRoutes from "@/routes/allocationRoutes";
import auditRoutes from "@/routes/auditRoutes";
import { OpenAPIHono } from "@hono/zod-openapi";
import attachmentRoutes from "@/routes/attachmentRoutes";
import emailRoutes from "@/routes/emailRoutes";
import syncRoutes from "@/routes/syncRoutes";
import authRoutes from "@/routes/authRoutes";
import { setupDocumentation } from "@/utils/docs";
import { logError } from "@/utils/logger";
import { isAdminAuthorized, clearAdminSession } from "@/utils/adminAuth";
import { writeAdminAudit } from "@/utils/adminAudit";
import corsMiddleware from "./middlewares/cors";
import healthRoutes from "./routes/healthRoutes";
import { ERR } from "./utils/http";
import { FAVICON_SVG } from "./config/favicon";

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

app.use(corsMiddleware);

app.use("/admin/*", async (c, next) => {
	const authorization = c.req.header("Authorization");
	const authorized = await isAdminAuthorized(c);
	if (authorized && !authorization) {
		const headers = new Headers(c.req.raw.headers);
		headers.set("Authorization", `Bearer ${String(c.env.ADMIN_TOKEN)}`);
		c.req.raw = new Request(c.req.raw, { headers });
	}
	await next();
});

app.get("/admin/api/auth/session", async (c) => {
	const authorization = c.req.header("Authorization");
	const authorized = await isAdminAuthorized(c);

	if (!authorized) {
		if (authorization) {
			await writeAdminAudit(c, {
				action: "ADMIN_LOGIN_FAILED",
				resourceType: "admin_auth",
				summary: "Failed administrator login attempt.",
				details: { method: "token" },
			});
		}
		return c.json({ error: { message: "Unauthorized" } }, 401);
	}

	if (authorization) {
		await writeAdminAudit(c, {
			action: "ADMIN_LOGIN_SUCCESS",
			resourceType: "admin_auth",
			summary: "Administrator login succeeded.",
			details: { method: "token" },
		});
	}

	return c.json({ success: true, authenticated: true });
});

app.post("/admin/api/auth/logout", async (c) => {
	const authorized = await isAdminAuthorized(c);

	if (authorized) {
		await writeAdminAudit(c, {
			action: "ADMIN_LOGOUT",
			resourceType: "admin_auth",
			summary: "Administrator logged out.",
		});
	}

	clearAdminSession(c);
	return c.json({ success: true });
});

const faviconHeaders = {
	"Content-Type": "image/svg+xml; charset=UTF-8",
	"Cache-Control": "public, max-age=86400",
};
const faviconResponse = (c: any) => c.body(FAVICON_SVG, 200, faviconHeaders);
app.get("/favicon.svg", faviconResponse);
app.get("/admin/favicon.svg", faviconResponse);
app.get("/favicon.ico", (c) => c.redirect("/favicon.svg", 302));
app.get("/favicon.png", (c) => c.redirect("/favicon.svg", 302));
app.get("/apple-touch-icon.png", (c) => c.redirect("/favicon.svg", 302));

app.onError((err, c) => {
	logError(`Unhandled error: ${err.message}`, err);
	return c.json(ERR(err.name, err.message), 500);
});

app.route("/", emailRoutes);
app.route("/", attachmentRoutes);
app.route("/", adminDashboardUiRoutes);
app.route("/", productRoutes);
app.route("/", credentialRoutes);
app.route("/", allocationRoutes);
app.route("/", auditRoutes);
app.route("/", adminRoutes);
app.route("/", domainManagerUiRoutes);
app.route("/", domainRoutes);
app.route("/", syncRoutes);
app.route("/", authRoutes);
app.route("/", healthRoutes);

setupDocumentation(app);
export default app;
