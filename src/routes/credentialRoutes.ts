import { CREDENTIAL_MANAGEMENT_PAGE } from "@/admin/products/credentialsPage";
import { isAdminAuthorized } from "@/utils/adminAuth";
import { writeAdminAudit } from "@/utils/adminAudit";
import { OpenAPIHono } from "@hono/zod-openapi";

const credentialRoutes = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
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
credentialRoutes.get("/admin/credentials", async (c) => {
	if (!(await isAdminAuthorized(c))) return c.redirect("/admin", 302);
	return c.html(CREDENTIAL_MANAGEMENT_PAGE);
});
credentialRoutes.get("/admin/api/credentials", async (c) => {
	if (!(await isAdminAuthorized(c))) return unauthorized(c);
	try {
		const [credentials, products, suppliers, modes, slots, productModes] = await Promise.all([
			sb(
				c,
				"credentials?select=id,product_id,supplier_id,account_email,purchase_cost,purchase_date,status,label,notes,created_at&order=created_at.desc",
			),
			sb(c, "products?select=id,code,name&order=name.asc"),
			sb(c, "suppliers?select=id,name,active&order=name.asc"),
			sb(
				c,
				"credential_modes?select=id,credential_id,product_mode_id,capacity,max_customers,active",
			),
			sb(
				c,
				"credential_slots?select=id,credential_mode_id,slot_number,label,active&order=slot_number.asc",
			),
			sb(
				c,
				"product_modes?select=id,product_id,mode,display_name,capacity_per_credential,max_customers_per_credential,active&order=created_at.asc",
			),
		]);
		const productMap = new Map((products || []).map((p: any) => [p.id, p]));
		const supplierMap = new Map((suppliers || []).map((s: any) => [s.id, s]));
		const ids = [...new Set((modes || []).map((m: any) => m.product_mode_id))];
		const pms = ids.length
			? await sb(
					c,
					`product_modes?id=in.(${ids.map((x: string) => encodeURIComponent(x)).join(",")})&select=id,product_id,mode,display_name,capacity_per_credential,max_customers_per_credential`,
				)
			: [];
		const pm = new Map((pms || []).map((m: any) => [m.id, m]));
		const items = (credentials || []).map((x: any) => {
			const cms = (modes || [])
				.filter((m: any) => m.credential_id === x.id)
				.map((m: any) => ({
					...m,
					...(pm.get(m.product_mode_id) || {}),
					slot_count: (slots || []).filter((s: any) => s.credential_mode_id === m.id).length,
				}));
			return {
				...x,
				product_name: productMap.get(x.product_id)?.name || "—",
				product_code: productMap.get(x.product_id)?.code || "",
				supplier_name: supplierMap.get(x.supplier_id)?.name || "",
				modes: cms,
			};
		});
		const credentialProducts = (products || []).map((p: any) => ({
			...p,
			variants: (productModes || [])
				.filter((m: any) => m.product_id === p.id && m.active !== false)
				.map((m: any) => ({
					...m,
					capacity: m.capacity_per_credential,
					max_customers_per_credential: m.max_customers_per_credential,
				})),
		}));
		return c.json({ items, products: credentialProducts, suppliers });
	} catch (e) {
		return c.json({ error: { message: e instanceof Error ? e.message : String(e) } }, 500);
	}
});
credentialRoutes.post("/admin/api/credentials", async (c) => {
	if (!(await isAdminAuthorized(c))) return unauthorized(c);
	try {
		const body = await c.req.json();
		const email = String(body?.account_email || "").trim();
		const productId = String(body?.product_id || "");
		const modeIds = Array.isArray(body?.product_mode_ids)
			? body.product_mode_ids.map(String).filter(Boolean)
			: [];
		if (!email || !productId || !modeIds.length)
			return c.json(
				{
					error: { message: "Product, account email and at least one selling mode are required." },
				},
				400,
			);
		const productModes = await sb(
			c,
			`product_modes?id=in.(${modeIds.map(encodeURIComponent).join(",")})&select=id,product_id,mode,capacity_per_credential,max_customers_per_credential`,
		);
		if (!productModes.length || productModes.some((m: any) => m.product_id !== productId))
			throw new Error("Selected selling modes do not belong to this product.");
		const rows = await sb(c, "credentials", {
			method: "POST",
			headers: { Prefer: "return=representation" },
			body: JSON.stringify({
				product_id: productId,
				supplier_id: body?.supplier_id || null,
				account_email: email,
				purchase_cost:
					body?.purchase_cost == null || body.purchase_cost === ""
						? null
						: Number(body.purchase_cost),
				purchase_date: body?.purchase_date || null,
				status: body?.status || "ACTIVE",
				label: body?.label || null,
				notes: body?.notes || null,
			}),
		});
		const credential = rows?.[0];
		if (!credential?.id) throw new Error("Credential was not created.");
		for (const mode of productModes) {
			const cmRows = await sb(c, "credential_modes", {
				method: "POST",
				headers: { Prefer: "return=representation" },
				body: JSON.stringify([
					{
						credential_id: credential.id,
						product_mode_id: mode.id,
						capacity: Math.max(1, Number(mode.capacity_per_credential || 1)),
						max_customers: Math.max(1, Number(mode.max_customers_per_credential || 1)),
						active: true,
					},
				]),
			});
			const cm = cmRows?.[0];
			if (!cm?.id) throw new Error(`Could not create ${mode.mode} inventory configuration.`);
			const count = Math.max(1, Number(mode.capacity_per_credential || 1));
			await sb(c, "credential_slots", {
				method: "POST",
				body: JSON.stringify(
					Array.from({ length: count }, (_, i) => ({
						credential_mode_id: cm.id,
						slot_number: i + 1,
						label: `Slot ${i + 1}`,
						active: true,
					})),
				),
			});
		}
		await writeAdminAudit(c, {
			action: "CREATE_CREDENTIAL",
			resourceType: "credential",
			resourceId: credential.id,
			summary: `Created credential ${email}.`,
			details: { product_id: productId, account_email: email, mode_count: productModes.length },
		});
		return c.json({ success: true, id: credential.id });
	} catch (e) {
		return c.json({ error: { message: e instanceof Error ? e.message : String(e) } }, 500);
	}
});
export default credentialRoutes;
