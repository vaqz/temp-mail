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

export default chatraceRoutes;
