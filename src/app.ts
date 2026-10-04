import adminDashboardUiRoutes from "@/routes/adminDashboardUiRoutes";
import adminRoutes from "@/routes/adminRoutes";
import domainRoutes from "@/routes/domainRoutes";
import domainManagerUiRoutes from "@/routes/domainManagerUiRoutes";
import productRoutes from "@/routes/productRoutes";
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
import { FAVICON_SVG } from "./config/favicon";

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

app.use(corsMiddleware);

const faviconHeaders = {
	"Content-Type": "image/svg+xml; charset=UTF-8",
	"Cache-Control": "public, max-age=86400",
};

const faviconResponse = (c: any) =>
	c.body(FAVICON_SVG, 200, faviconHeaders);

app.get("/favicon.svg", faviconResponse);
app.get("/admin/favicon.svg", faviconResponse);
app.get("/favicon.ico", (c) => c.redirect("/favicon.svg", 302));
app.get("/favicon.png", (c) => c.redirect("/favicon.svg", 302));
app.get("/apple-touch-icon.png", (c) =>
	c.redirect("/favicon.svg", 302),
);

app.onError((err, c) => {
	logError(`Unhandled error: ${err.message}`, err);
	return c.json(ERR(err.name, err.message), 500);
});

app.route("/", emailRoutes);
app.route("/", attachmentRoutes);
app.route("/", adminDashboardUiRoutes);
app.route("/", productRoutes);
app.route("/", adminRoutes);
app.route("/", domainManagerUiRoutes);
app.route("/", domainRoutes);
app.route("/", syncRoutes);
app.route("/", authRoutes);
app.route("/", healthRoutes);

setupDocumentation(app);

export default app;
