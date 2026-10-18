import { isAdminAuthorized } from "@/utils/adminAuth";
import { writeAdminAudit } from "@/utils/adminAudit";
import { OpenAPIHono } from "@hono/zod-openapi";

const chatraceRoutes = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function dbConfig(c: any) {
	const url = String(c.env.SUPABASE_URL || "").replace(/\/$/, "");
	const key = String(c.env.SUPABASE_SERVICE_ROLE_KEY || "");
	if (!url || !key) throw new Error("Supabase is not configured.");
	return { url, key };
}

function chatraceAuthorized(c: any) {
	const expected = String(c.env.CHATRACE_API_TOKEN || "");
	const supplied = String(c.req.header("Authorization") || "").replace(/^Bearer\s+/i, "");
	return Boolean(expected && supplied && supplied === expected);
}

async function sb(c: any, path: string, init: RequestInit = {}) {
	const { url, key } = dbConfig(c);
	const headers = new Headers(init.headers || {});
	headers.set("apikey", key);
	headers.set("Authorization", `Bearer ${key}`);
	headers.set("Content-Type", "application/json");
	const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers });
	const text = await response.text();
	let data: any = null;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		data = text;
	}
	if (!response.ok) {
		throw new Error(
			data?.message ||
				data?.hint ||
				data?.details ||
				data?.error ||
				text ||
				`Supabase request failed (${response.status})`,
		);
	}
	return data;
}

function unauthorized(c: any) {
	return c.json({ error: { message: "Unauthorized" } }, 401);
}

chatraceRoutes.get("/api/chatrace/catalog", async (c) => {
	if (!chatraceAuthorized(c)) return unauthorized(c);
	try {
		const messengerId = String(c.req.query("messenger_user_id") || "").trim();
		let tierCode = "RETAIL";
		if (messengerId) {
			const customers = await sb(
				c,
				`customers?messenger_platform=eq.chatrace&messenger_user_id=eq.${encodeURIComponent(messengerId)}&active=eq.true&select=pricing_tier_id&limit=1`,
			);
			if (customers?.[0]?.pricing_tier_id) {
				const tiers = await sb(
					c,
					`pricing_tiers?id=eq.${encodeURIComponent(customers[0].pricing_tier_id)}&select=code&active=eq.true&limit=1`,
				);
				if (tiers?.[0]?.code) tierCode = tiers[0].code;
			}
		}
		const tiers = await sb(
			c,
			`pricing_tiers?code=eq.${encodeURIComponent(tierCode)}&active=eq.true&select=id,code,name&limit=1`,
		);
		if (!tiers?.[0]) throw new Error("Customer price list is not configured.");
		const prices = await sb(
			c,
			`product_term_prices?pricing_tier_id=eq.${encodeURIComponent(tiers[0].id)}&active=eq.true&effective_from=lte.${encodeURIComponent(new Date().toISOString())}&select=product_id,product_mode_id,term_months,price&order=term_months.asc`,
		);
		const products = await sb(
			c,
			"products?status=eq.ACTIVE&select=id,code,name,description&order=name.asc",
		);
		const modes = await sb(
			c,
			"product_modes?active=eq.true&select=id,product_id,mode,display_name&order=mode.asc",
		);
		const modeMap = new Map((modes || []).map((m: any) => [m.id, m]));
		const productMap = new Map((products || []).map((p: any) => [p.id, p]));
		const catalog = (prices || [])
			.map((price: any) => {
				const mode = modeMap.get(price.product_mode_id);
				const product = mode ? productMap.get(mode.product_id) : null;
				if (!product || !mode) return null;
				return {
					product_code: product.code,
					product_name: product.name,
					selling_mode: mode.mode,
					mode_name: mode.display_name,
					term_months: price.term_months,
					price: Number(price.price),
					currency: "PHP",
				};
			})
			.filter(Boolean);
		return c.json({ success: true, pricing_tier: tierCode, items: catalog });
	} catch (e) {
		return c.json({ error: { message: e instanceof Error ? e.message : String(e) } }, 500);
	}
});

chatraceRoutes.post("/api/chatrace/quote", async (c) => {
	if (!chatraceAuthorized(c)) return unauthorized(c);
	try {
		const body = await c.req.json();
		const messengerId = String(body?.messenger_user_id || "").trim();
		const productCode = String(body?.product_code || "")
			.trim()
			.toUpperCase();
		const mode = String(body?.selling_mode || "")
			.trim()
			.toUpperCase();
		const term = Number(body?.term_months);
		if (
			!messengerId ||
			!productCode ||
			!["ORIG", "SOLO", "SH"].includes(mode) ||
			!Number.isInteger(term) ||
			term < 1 ||
			term > 120
		) {
			return c.json(
				{
					error: {
						message:
							"messenger_user_id, product_code, valid selling_mode, and term_months (1–120) are required.",
					},
				},
				400,
			);
		}
		const customers = await sb(
			c,
			`customers?messenger_platform=eq.chatrace&messenger_user_id=eq.${encodeURIComponent(messengerId)}&active=eq.true&select=pricing_tier_id&limit=1`,
		);
		let tierId = customers?.[0]?.pricing_tier_id;
		if (!tierId) {
			const retail = await sb(c, "pricing_tiers?code=eq.RETAIL&active=eq.true&select=id&limit=1");
			tierId = retail?.[0]?.id;
		}
		if (!tierId) throw new Error("Retail price list is not configured.");
		const products = await sb(
			c,
			`products?code=eq.${encodeURIComponent(productCode)}&status=eq.ACTIVE&select=id,name,code&limit=1`,
		);
		const product = products?.[0];
		if (!product) return c.json({ error: { message: "Product is unavailable." } }, 404);
		const modes = await sb(
			c,
			`product_modes?product_id=eq.${encodeURIComponent(product.id)}&mode=eq.${mode}&active=eq.true&select=id,display_name&limit=1`,
		);
		const sellingMode = modes?.[0];
		if (!sellingMode)
			return c.json({ error: { message: "Selling mode is unavailable for this product." } }, 404);
		const prices = await sb(
			c,
			`product_term_prices?product_id=eq.${encodeURIComponent(product.id)}&product_mode_id=eq.${encodeURIComponent(sellingMode.id)}&pricing_tier_id=eq.${encodeURIComponent(tierId)}&term_months=eq.${term}&active=eq.true&effective_from=lte.${encodeURIComponent(new Date().toISOString())}&select=price,effective_until&limit=1`,
		);
		const price = prices?.find(
			(x: any) => !x.effective_until || Date.parse(x.effective_until) > Date.now(),
		);
		if (!price)
			return c.json({ error: { message: "No price is configured for this selection." } }, 404);
		const tiers = await sb(
			c,
			`pricing_tiers?id=eq.${encodeURIComponent(tierId)}&select=code,name&limit=1`,
		);
		return c.json({
			success: true,
			product_code: product.code,
			product_name: product.name,
			selling_mode: mode,
			mode_name: sellingMode.display_name,
			term_months: term,
			price: Number(price.price),
			currency: "PHP",
			pricing_tier: tiers?.[0]?.code || "RETAIL",
		});
	} catch (e) {
		return c.json({ error: { message: e instanceof Error ? e.message : String(e) } }, 500);
	}
});

chatraceRoutes.post("/api/chatrace/orders", async (c) => {
	if (!chatraceAuthorized(c)) return unauthorized(c);
	try {
		const body = await c.req.json();
		const messengerId = String(body?.messenger_user_id || "").trim();
		const name = String(body?.customer_name || "").trim();
		const productCode = String(body?.product_code || "")
			.trim()
			.toUpperCase();
		const mode = String(body?.selling_mode || "")
			.trim()
			.toUpperCase();
		const term = Number(body?.term_months);
		const reference = String(body?.external_reference || "").trim();
		if (
			!messengerId ||
			!name ||
			!productCode ||
			!["ORIG", "SOLO", "SH"].includes(mode) ||
			!Number.isInteger(term) ||
			term < 1 ||
			term > 120 ||
			!reference
		) {
			return c.json(
				{
					error: {
						message:
							"messenger_user_id, customer_name, product_code, selling_mode, term_months, and a unique external_reference are required.",
					},
				},
				400,
			);
		}
		const rows = await sb(c, "rpc/create_chatrace_pending_order", {
			method: "POST",
			body: JSON.stringify({
				p_messenger_user_id: messengerId,
				p_customer_name: name,
				p_email: String(body?.email || ""),
				p_product_code: productCode,
				p_selling_mode: mode,
				p_term_months: term,
				p_external_reference: reference,
			}),
		});
		return c.json(
			{
				success: true,
				...rows,
				next_step:
					"Send payment instructions in ChatRace. Do not deliver credentials until an administrator verifies payment.",
			},
			201,
		);
	} catch (e) {
		return c.json({ error: { message: e instanceof Error ? e.message : String(e) } }, 400);
	}
});

chatraceRoutes.get("/api/chatrace/orders/:orderId", async (c) => {
	if (!chatraceAuthorized(c)) return unauthorized(c);
	try {
		const orderId = c.req.param("orderId");
		const rows = await sb(
			c,
			`orders?id=eq.${encodeURIComponent(orderId)}&select=id,order_number,total_amount,payment_status,status,created_at&limit=1`,
		);
		if (!rows?.[0]) return c.json({ error: { message: "Order not found." } }, 404);
		return c.json({ success: true, order: rows[0] });
	} catch (e) {
		return c.json({ error: { message: e instanceof Error ? e.message : String(e) } }, 500);
	}
});

chatraceRoutes.post("/admin/api/orders/:orderId/confirm-payment", async (c) => {
	if (!(await isAdminAuthorized(c))) return unauthorized(c);
	try {
		const body = await c.req.json();
		const orderId = c.req.param("orderId");
		const slotId = String(body?.slot_id || "");
		const method = String(body?.payment_method || "").toUpperCase();
		const allowed = ["GCASH", "MAYA", "BANK_TRANSFER", "CASH", "RESELLER_CREDIT", "OTHER"];
		if (!slotId || !allowed.includes(method))
			return c.json(
				{ error: { message: "A valid payment method and inventory slot are required." } },
				400,
			);
		const rows = await sb(c, "rpc/confirm_chatrace_order_payment", {
			method: "POST",
			body: JSON.stringify({
				p_order_id: orderId,
				p_payment_method: method,
				p_reference_number: String(body?.reference_number || ""),
				p_slot_id: slotId,
			}),
		});
		const result = Array.isArray(rows) ? rows[0] : rows;
		await writeAdminAudit(c, {
			action: "CONFIRM_ORDER_PAYMENT",
			resourceType: "order",
			resourceId: orderId,
			summary: `Verified payment and fulfilled order ${orderId}.`,
			details: result,
		});
		return c.json({ success: true, ...result });
	} catch (e) {
		return c.json({ error: { message: e instanceof Error ? e.message : String(e) } }, 400);
	}
});

// ChatRace access-code endpoint. Uses the same D1 mailbox and one-time-link
// cache as the Access Code PWA; never returns the Netflix verification URL.
async function ensureChatRaceAccessCodeResults(db: D1Database) {
	await db
		.prepare(`
		CREATE TABLE IF NOT EXISTS access_code_results (
			email_id TEXT PRIMARY KEY,
			profile TEXT NOT NULL,
			status TEXT NOT NULL,
			access_code TEXT,
			message TEXT,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)
		`)
		.run();
}

function parseChatRaceAccessCodeEmail(htmlContent: string, textContent: string) {
	const profileMatch =
		htmlContent.match(/Hi\s*<[^>]*>([^<]+)<\/span>/i) || textContent.match(/Hi\s+([^,\r\n]+)/i);
	const profile = (profileMatch?.[1] || "").replace(/&amp;/gi, "&").trim();
	const linkMatch =
		htmlContent.match(/<td class="h5 button-td"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"/i) ||
		htmlContent.match(/href="(https:\/\/www\.netflix\.com\/account\/travel\/verify[^"]*)"/i) ||
		textContent.match(/(https:\/\/www\.netflix\.com\/account\/travel\/verify[^\s"'<>]+)/i);
	const link = (linkMatch?.[1] || "").replace(/&amp;/gi, "&").trim();
	try {
		const parsed = new URL(link);
		if (
			parsed.protocol !== "https:" ||
			parsed.hostname !== "www.netflix.com" ||
			parsed.pathname !== "/account/travel/verify" ||
			!profile
		)
			return null;
	} catch {
		return null;
	}
	return { profile, link };
}

chatraceRoutes.post("/api/chatrace/access-code", async (c) => {
	if (!chatraceAuthorized(c)) return unauthorized(c);
	try {
		const body = await c.req.json().catch(() => ({}));
		const email = String(body?.email || body?.net_acct_email || "")
			.trim()
			.toLowerCase();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
			return c.json(
				{ status: "error", message: "A valid email address is required.", code: null },
				400,
				{ "Cache-Control": "no-store" },
			);
		}
		const now = Math.floor(Date.now() / 1000);
		const cutoff = now - 15 * 60;
		await ensureChatRaceAccessCodeResults(c.env.D1);

		const emailRow = await c.env.D1.prepare(`
			SELECT id, subject, received_at, html_content, text_content
			FROM emails
			WHERE lower(to_address) = ? AND is_public = 1 AND received_at >= ?
				AND lower(subject) LIKE '%netflix%'
				AND lower(subject) LIKE '%temporary access code%'
			ORDER BY received_at DESC LIMIT 1
		`)
			.bind(email, cutoff)
			.first<{
				id: string;
				subject: string | null;
				received_at: number;
				html_content: string | null;
				text_content: string | null;
			}>();

		if (!emailRow)
			return c.json(
				{
					status: "not_found",
					message: "No recent Netflix access-code email was found for this email address.",
					code: null,
				},
				404,
				{ "Cache-Control": "no-store" },
			);

		const parsed = parseChatRaceAccessCodeEmail(
			emailRow.html_content || "",
			emailRow.text_content || "",
		);
		if (!parsed)
			return c.json(
				{
					status: "error",
					message: "The Netflix verification link could not be extracted from the email.",
					code: null,
				},
				422,
				{ "Cache-Control": "no-store" },
			);

		const claim = await c.env.D1.prepare(`
			INSERT OR IGNORE INTO access_code_results
			(email_id, profile, status, access_code, message, created_at, updated_at)
			VALUES (?, ?, 'processing', NULL, NULL, ?, ?)
		`)
			.bind(emailRow.id, parsed.profile, now, now)
			.run();

		let saved = await c.env.D1.prepare(
			"SELECT status, access_code, message, profile FROM access_code_results WHERE email_id = ?",
		)
			.bind(emailRow.id)
			.first<{
				status: string;
				access_code: string | null;
				message: string | null;
				profile: string;
			}>();

		if (claim.meta.changes > 0) {
			try {
				const response = await fetch(parsed.link, {
					method: "GET",
					redirect: "follow",
					headers: { "User-Agent": "Mozilla/5.0 (compatible; VaqzMobizAccessCode/1.0)" },
					signal: AbortSignal.timeout(12000),
				});
				const html = await response.text();
				const pageText = html
					.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
					.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
					.replace(/<[^>]+>/g, " ")
					.replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&")
					.replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
					.replace(/\s+/g, " ").trim();
				const contextualCode =
					pageText.match(/(?:verification\s+)?code[^0-9]{0,80}(\d{4})/i) ||
					pageText.match(/(\d{4})[^a-z0-9]{0,40}(?:is your )?(?:verification )?code/i);
				const allCodes = pageText.match(/\b\d{4}\b/g) || [];
				const codeMatch =
					contextualCode || (allCodes.length === 1 ? [allCodes[0], allCodes[0]] : null);
				const code = response.ok && codeMatch?.[1] ? codeMatch[1] : null;
				const status = code ? "success" : "failed";
				const message = code
					? "Code retrieved."
					: "Code not found; the link may be expired or Netflix may have changed its page.";
				await c.env.D1.prepare(
					"UPDATE access_code_results SET status = ?, access_code = ?, message = ?, updated_at = ? WHERE email_id = ?",
				)
					.bind(status, code, message, Math.floor(Date.now() / 1000), emailRow.id)
					.run();
				saved = { status, access_code: code, message, profile: parsed.profile };
			} catch (error) {
				const message = "Unable to retrieve code from Netflix.";
				await c.env.D1.prepare(
					"UPDATE access_code_results SET status = 'failed', message = ?, updated_at = ? WHERE email_id = ?",
				)
					.bind(message, Math.floor(Date.now() / 1000), emailRow.id)
					.run();
				saved = { status: "failed", access_code: null, message, profile: parsed.profile };
				console.error("ChatRace access-code retrieval failed:", error);
			}
		}
		return c.json(
			{
				status: saved?.status || "processing",
				message: saved?.message || "Retrieval is in progress. Try again shortly.",
				code: saved?.status === "success" ? saved.access_code : null,
				profile: saved?.profile || parsed.profile,
			},
			200,
			{ "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
		);
	} catch (error) {
		console.error("ChatRace access-code endpoint failed:", error);
		return c.json(
			{ status: "error", message: "Unable to retrieve access code.", code: null },
			500,
			{ "Cache-Control": "no-store" },
		);
	}
});

export default chatraceRoutes;
