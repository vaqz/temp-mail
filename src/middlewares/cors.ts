import { cors } from "hono/cors";

const corsMiddleware = cors({
	origin: "https://mail.vaqzmobiz.com",
	allowMethods: [
		"GET",
		"POST",
		"DELETE",
		"PATCH",
		"OPTIONS",
	],
	allowHeaders: [
		"Content-Type",
		"Authorization",
	],
	credentials: true,
});

export default corsMiddleware;
