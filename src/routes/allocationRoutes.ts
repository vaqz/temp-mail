import { ALLOCATION_CONSOLE_PAGE } from "@/admin/allocations/allocationPage";
import { isAdminAuthorized } from "@/utils/adminAuth";
import { writeAdminAudit } from "@/utils/adminAudit";
import { OpenAPIHono } from "@hono/zod-openapi";

const allocationRoutes = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
function unauthorized(c: any) {
	return c.json({ error: { message: "Unauthorized" } }, 401);
}
function config(c: any) {
	const url = String(c.env.SUPABASE_URL || "").replace(/\/$/, "");
	const key = String(c.env.SUPABASE_SERVICE_ROLE_KEY || "");
	if (!url || !key) throw new Error("Supabase is not configured.");
	return { url, key };
}
async function sb(c: any, path: string, init: RequestInit = {}) {
	const { url, key } = config(c);
	const h = new Headers(init.headers || {});
	h.set("apikey", key);
	h.set("Authorization", `Bearer ${key}`);
	h.set("Content-Type", "application/json");
	const r = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: h });
	const text = await r.text();
	let data: any = null;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		data = text;
	}
	if (!r.ok)
		throw new Error(
			data?.message ||
				data?.hint ||
				data?.details ||
				data?.error ||
				text ||
				`Supabase request failed (${r.status})`,
		);
	return data;
}
allocationRoutes.get("/admin/allocations", async (c) => {
	if (!(await isAdminAuthorized(c))) return c.redirect("/admin", 302);
	return c.html(ALLOCATION_CONSOLE_PAGE);
});
allocationRoutes.get("/admin/api/allocation/setup", async (c) => {
	if (!(await isAdminAuthorized(c))) return unauthorized(c);
	try {
		const [products, tiers] = await Promise.all([
			sb(c, "products?select=id,code,name&status=eq.ACTIVE&order=name.asc"),
			sb(c, "pricing_tiers?select=id,name,code,active&active=eq.true&order=name.asc"),
		]);
		return c.json({ products, tiers });
	} catch (e) {
		return c.json({ error: { message: e instanceof Error ? e.message : String(e) } }, 500);
	}
});
allocationRoutes.get("/admin/api/allocation/modes", async (c) => {
	if (!(await isAdminAuthorized(c))) return unauthorized(c);
	try {
		const productId = c.req.query("product_id");
		if (!productId) return c.json({ items: [] });
		const items = await sb(
			c,
			`product_modes?product_id=eq.${encodeURIComponent(productId)}&select=id,product_id,mode,display_name,capacity_per_credential,max_customers_per_credential&order=mode.asc`,
		);
		return c.json({ items });
	} catch (e) {
		return c.json({ error: { message: e instanceof Error ? e.message : String(e) } }, 500);
	}
});
allocationRoutes.get("/admin/api/allocation/slots", async (c) => {
	if (!(await isAdminAuthorized(c))) return unauthorized(c);
	try {
		const mode = c.req.query("product_mode_id");
		if (!mode) return c.json({ items: [] });
		const cms = await sb(
			c,
			`credential_modes?product_mode_id=eq.${encodeURIComponent(mode)}&active=eq.true&select=id,max_customers`,
		);
		const cmIds = (cms || []).map((x: any) => x.id);
		if (!cmIds.length) return c.json({ items: [] });
		const slots = await sb(
			c,
			`credential_slots?credential_mode_id=in.(${cmIds.map(encodeURIComponent).join(",")})&active=eq.true&select=id,slot_number,label,credential_mode_id&order=slot_number.asc`,
		);
		const ids = (slots || []).map((x: any) => x.id);
		let counts: any[] = [];
		if (ids.length) {
			counts = await sb(
				c,
				`allocations?slot_id=in.(${ids.map(encodeURIComponent).join(",")})&status=eq.ACTIVE&select=slot_id`,
			);
		}
		const countMap = new Map<string, number>();
		for (const x of counts || []) countMap.set(x.slot_id, (countMap.get(x.slot_id) || 0) + 1);
		const maxMap = new Map<string, number>(
			(cms || []).map((x: any) => [x.id, Number(x.max_customers || 1)]),
		);
		const items = (slots || []).map((s: any) => {
			const active_allocations = countMap.get(s.id) || 0;
			const max_customers = maxMap.get(s.credential_mode_id) || 1;
			return {
				slot_id: s.id,
				slot_number: s.slot_number,
				label: s.label,
				active_allocations,
				max_customers,
				available_customers: Math.max(max_customers - active_allocations, 0),
			};
		});
		return c.json({ items });
	} catch (e) {
		return c.json({ error: { message: e instanceof Error ? e.message : String(e) } }, 500);
	}
});
allocationRoutes.get("/admin/api/allocation/history", async (c) => {
	if (!(await isAdminAuthorized(c))) return unauthorized(c);
	try {
		const rows = await sb(
			c,
			"allocations?select=id,credential_id,customer_id,product_mode_id,slot_id,slot_number,slot_name,term_months,status,starts_at,expires_at,created_at,updated_at,order_item_id&order=created_at.desc&limit=100",
		);
		const customerIds = [...new Set((rows || []).map((x: any) => x.customer_id).filter(Boolean))];
		const modeIds = [...new Set((rows || []).map((x: any) => x.product_mode_id).filter(Boolean))];
		const customers = customerIds.length
			? await sb(c, "customers?id=in.(" + customerIds.map(encodeURIComponent).join(",") + ")&select=id,name,display_name,email")
			: [];
		const modes = modeIds.length
			? await sb(c, "product_modes?id=in.(" + modeIds.map(encodeURIComponent).join(",") + ")&select=id,product_id,mode,display_name")
			: [];
		const productIds = [...new Set((modes || []).map((x: any) => x.product_id).filter(Boolean))];
		const products = productIds.length
			? await sb(c, "products?id=in.(" + productIds.map(encodeURIComponent).join(",") + ")&select=id,name,code")
			: [];
		const customerMap = new Map((customers || []).map((x: any) => [x.id, x]));
		const modeMap = new Map((modes || []).map((x: any) => [x.id, x]));
		const productMap = new Map((products || []).map((x: any) => [x.id, x]));
		const items = (rows || []).map((x: any) => {
			const mode = modeMap.get(x.product_mode_id);
			return {
				...x,
				customer: customerMap.get(x.customer_id) || null,
				product: mode ? productMap.get(mode.product_id) || null : null,
				mode: mode || null,
			};
		});
		return c.json({ items });
	} catch (e) {
		return c.json({ error: { message: e instanceof Error ? e.message : String(e) } }, 500);
	}
});

allocationRoutes.post("/admin/api/allocation/allocate", async (c) => {
	if (!(await isAdminAuthorized(c))) return unauthorized(c);
	try {
		const body = await c.req.json();
		const customer = body?.customer || {};
		const name = String(customer.name || "").trim();
		const tier = String(customer.pricing_tier_id || "");
		if (!name || !tier) throw new Error("Customer name and pricing tier are required.");
		const existing = customer.email
			? await sb(c, `customers?email=eq.${encodeURIComponent(customer.email)}&select=id&limit=1`)
			: [];
		let customerId = existing?.[0]?.id;
		if (!customerId) {
			const rows = await sb(c, "customers", {
				method: "POST",
				headers: { Prefer: "return=representation" },
				body: JSON.stringify({
					name,
					display_name: name,
					email: customer.email || null,
					messenger_user_id: customer.messenger_user_id || null,
					pricing_tier_id: tier,
					status: "active",
					active: true,
				}),
			});
			customerId = rows?.[0]?.id;
		} else {
			await sb(c, `customers?id=eq.${encodeURIComponent(customerId)}`, {
				method: "PATCH",
				body: JSON.stringify({
					name,
					display_name: name,
					messenger_user_id: customer.messenger_user_id || null,
					pricing_tier_id: tier,
				}),
			});
		}
		if (!customerId) throw new Error("Customer could not be created.");
		const rows = await sb(c, "rpc/create_paid_order_and_allocation", {
			method: "POST",
			body: JSON.stringify({
				p_customer_id: customerId,
				p_product_id: String(body.product_id),
				p_product_mode_id: String(body.product_mode_id),
				p_slot_id: String(body.slot_id),
				p_term_months: Number(body.term_months),
				p_unit_price: Number(body.unit_price || 0),
			}),
		});
		const result = Array.isArray(rows) ? rows[0] : rows;
		if (!result?.allocation_id) throw new Error("Order/allocation was not created.");
		const allocationRows = await sb(
			c,
			"allocations?id=eq." + encodeURIComponent(result.allocation_id) + "&select=id,credential_id,customer_id,slot_number,slot_name,term_months,starts_at,expires_at,status,order_item_id&limit=1",
		);
		const allocation = allocationRows?.[0];
		if (allocation?.credential_id) {
			const customerRows = await sb(c, "customers?id=eq." + encodeURIComponent(allocation.customer_id) + "&select=name,display_name,email&limit=1");
			const modeRows = await sb(c, "product_modes?id=eq." + encodeURIComponent(String(body.product_mode_id)) + "&select=mode,display_name,product_id&limit=1");
			const productRows = modeRows?.[0]?.product_id
				? await sb(c, "products?id=eq." + encodeURIComponent(modeRows[0].product_id) + "&select=name,code&limit=1")
				: [];
			const customerRecord = customerRows?.[0];
			const modeRecord = modeRows?.[0];
			const productRecord = productRows?.[0];
			await sb(c, "credential_events", {
				method: "POST",
				body: JSON.stringify({
					credential_id: allocation.credential_id,
					event_type: "ALLOCATED",
					details: {
						allocation_id: allocation.id,
						customer_id: allocation.customer_id,
						customer_name: customerRecord?.display_name || customerRecord?.name || customerRecord?.email || null,
						product_name: productRecord?.name || productRecord?.code || null,
						mode: modeRecord?.display_name || modeRecord?.mode || null,
						slot_number: allocation.slot_number,
						slot_name: allocation.slot_name,
						term_months: allocation.term_months,
						starts_at: allocation.starts_at,
						expires_at: allocation.expires_at,
						order_item_id: allocation.order_item_id,
					},
				}),
			});
		}
		await writeAdminAudit(c, {
			action: "CREATE_ALLOCATION",
			resourceType: "allocation",
			resourceId: result.allocation_id,
			summary: `Created allocation for ${name}.`,
			details: {
				customer_id: customerId,
				product_id: String(body.product_id),
				product_mode_id: String(body.product_mode_id),
				slot_id: String(body.slot_id),
				term_months: Number(body.term_months),
				unit_price: Number(body.unit_price || 0),
				order_id: result.order_id,
				order_number: result.order_number,
			},
		});
		return c.json({
			success: true,
			order_id: result.order_id,
			order_number: result.order_number,
			order_item_id: result.order_item_id,
			allocation_id: result.allocation_id,
		});
	} catch (e) {
		return c.json({ error: { message: e instanceof Error ? e.message : String(e) } }, 500);
	}
});
export default allocationRoutes;
