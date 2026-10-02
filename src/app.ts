import adminDashboardUiRoutes from "@/routes/adminDashboardUiRoutes";
import adminRoutes from "@/routes/adminRoutes";
import domainRoutes from "@/routes/domainRoutes";
import domainManagerUiRoutes from "@/routes/domainManagerUiRoutes";
import { OpenAPIHono } from "@hono/zod-openapi";
import attachmentRoutes from "@/routes/attachmentRoutes";
import emailRoutes from "@/routes/emailRoutes";
import syncRoutes from "@/routes/syncRoutes";
import authRoutes from "@/routes/authRoutes";
import { setupDocumentation } from "@/utils/docs";
import { logError } from "@/utils/logger";
import corsMiddleware from "./middlewares/cors";
import healthRoutes from "./routes/healthRoutes";
import { ERR } from "./utils/http";

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#2563eb"/><path d="M14 18h36v28H14z" fill="none" stroke="#fff" stroke-width="4"/><path d="m14 21 18 14 18-14" fill="none" stroke="#fff" stroke-width="4"/></svg>`;

app.use(corsMiddleware);

app.get("/favicon.svg", (c) =>
	c.body(FAVICON_SVG, 200, {
		"Content-Type": "image/svg+xml; charset=UTF-8",
		"Cache-Control": "public, max-age=86400",
	}),
);

app.onError((err, c) => {
	logError(`Unhandled error: ${err.message}`, err);
	return c.json(ERR(err.name, err.message), 500);
});

app.route("/", emailRoutes);
app.route("/", attachmentRoutes);
app.route("/", adminDashboardUiRoutes);
app.route("/", adminRoutes);
app.route("/", domainManagerUiRoutes);
app.route("/", domainRoutes);
app.route("/", syncRoutes);
app.route("/", authRoutes);
app.route("/", healthRoutes);

setupDocumentation(app);

export default app;
