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
import {
	FAVICON_SVG,
	VM_FAVICON_PNG_BASE64,
} from "./config/favicon";

const app = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

app.use(corsMiddleware);

const faviconSvgHeaders = {
	"Content-Type": "image/svg+xml; charset=UTF-8",
	"Cache-Control": "public, max-age=86400",
};

const faviconPngHeaders = {
	"Content-Type": "image/png",
	"Cache-Control": "public, max-age=86400",
};

const faviconPngBytes = Uint8Array.from(
	atob(VM_FAVICON_PNG_BASE64),
	(char) => char.charCodeAt(0),
);

app.get("/favicon.svg", (c) => c.body(FAVICON_SVG, 200, faviconSvgHeaders));
app.get("/favicon.png", (c) => c.body(faviconPngBytes, 200, faviconPngHeaders));
app.get("/favicon.ico", (c) => c.body(faviconPngBytes, 200, faviconPngHeaders));
app.get("/apple-touch-icon.png", (c) =>
	c.body(faviconPngBytes, 200, faviconPngHeaders),
);
app.get("/admin/favicon.svg", (c) => c.body(FAVICON_SVG, 200, faviconSvgHeaders));
app.get("/admin/favicon.ico", (c) =>
	c.body(faviconPngBytes, 200, faviconPngHeaders),
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
