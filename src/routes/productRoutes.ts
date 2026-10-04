import { PRODUCT_MANAGEMENT_PAGE } from "@/admin/products/productsPage";
import { OpenAPIHono } from "@hono/zod-openapi";

const productRoutes = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function authorized(c: any): boolean {
  const auth = c.req.header("Authorization");
  const token = c.env.ADMIN_TOKEN;
  return Boolean(token && auth === `Bearer ${token}`);
}

function unauthorized(c: any) {
  return c.json({ error: { message: "Unauthorized" } }, 401);
}

function supabaseConfig(c: any) {
  const url = String(c.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(c.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) throw new Error("Supabase is not configured yet. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the Worker secrets.");
  return { url, key };
}

async function sb(c: any, path: string, init: RequestInit = {}) {
  const { url, key } = supabaseConfig(c);
  const headers = new Headers(init.headers || {});
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers });
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const message = data?.message || data?.hint || data?.details || data?.error || text || `Supabase request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

productRoutes.get("/admin/products", (c) => c.html(PRODUCT_MANAGEMENT_PAGE));

productRoutes.get("/admin/api/products", async (c) => {
  if (!authorized(c)) return unauthorized(c);
  try {
    const [products, variants, fields, rules] = await Promise.all([
      sb(c, "products?select=*&order=sort_order.asc,name.asc"),
      sb(c, "product_variants?select=*&order=created_at.asc"),
      sb(c, "product_fields?select=*&order=sort_order.asc"),
      sb(c, "product_rules?select=*&order=sort_order.asc"),
    ]);
    const items = (products || []).map((p: any) => ({
      ...p,
      variants: (variants || []).filter((v: any) => v.product_id === p.id),
      fields: (fields || []).filter((f: any) => f.product_id === p.id),
      rules: (rules || []).filter((r: any) => r.product_id === p.id),
      field_count: (fields || []).filter((f: any) => f.product_id === p.id).length,
    }));
    return c.json({ items });
  } catch (error) {
    return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
  }
});

productRoutes.post("/admin/api/products", async (c) => {
  if (!authorized(c)) return unauthorized(c);
  try {
    const body = await c.req.json();
    const code = String(body?.code || "").trim().toUpperCase();
    const name = String(body?.name || "").trim();
    if (!code || !name) return c.json({ error: { message: "Product code and name are required." } }, 400);

    const productPayload = {
      code,
      name,
      description: String(body?.description || "").trim() || null,
      status: ["draft", "active", "archived"].includes(body?.status) ? body.status : "draft",
      default_term_months: [1, 3, 6, 12].includes(Number(body?.default_term_months)) ? Number(body.default_term_months) : 1,
    };

    let product: any;
    if (body?.id) {
      const rows = await sb(c, `products?id=eq.${encodeURIComponent(body.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(productPayload),
      });
      product = rows?.[0];
      if (!product) return c.json({ error: { message: "Product not found." } }, 404);
      await Promise.all([
        sb(c, `product_variants?product_id=eq.${encodeURIComponent(product.id)}`, { method: "DELETE" }),
        sb(c, `product_fields?product_id=eq.${encodeURIComponent(product.id)}`, { method: "DELETE" }),
        sb(c, `product_rules?product_id=eq.${encodeURIComponent(product.id)}`, { method: "DELETE" }),
      ]);
    } else {
      const rows = await sb(c, "products", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(productPayload),
      });
      product = rows?.[0];
    }

    if (!product?.id) throw new Error("Supabase did not return the created product.");

    const variants = Array.isArray(body?.variants) ? body.variants : [];
    const fields = Array.isArray(body?.fields) ? body.fields : [];
    const rules = Array.isArray(body?.rules) ? body.rules : [];

    if (variants.length) {
      const rows = variants.map((v: any) => ({
        product_id: product.id,
        mode: ["ORIG", "SOLO", "SH"].includes(v?.mode) ? v.mode : "ORIG",
        display_name: String(v?.display_name || v?.mode || "").trim(),
        capacity: Math.max(1, Number(v?.capacity || 1)),
        max_customers_per_credential: Math.max(1, Number(v?.max_customers_per_credential || 1)),
        description: v?.description ? String(v.description) : null,
        active: v?.active !== false,
      }));
      await sb(c, "product_variants", { method: "POST", body: JSON.stringify(rows) });
    }
    if (fields.length) {
      const rows = fields.filter((f: any) => String(f?.field_key || "").trim() && String(f?.label || "").trim()).map((f: any, i: number) => ({
        product_id: product.id,
        field_key: String(f.field_key).trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_"),
        label: String(f.label).trim(),
        field_type: ["text", "number", "boolean", "date", "datetime", "select", "textarea"].includes(f?.field_type) ? f.field_type : "text",
        required: Boolean(f?.required),
        customer_visible: f?.customer_visible !== false,
        sort_order: Number.isFinite(Number(f?.sort_order)) ? Number(f.sort_order) : i,
        options: Array.isArray(f?.options) ? f.options : [],
        default_value: f?.default_value ? String(f.default_value) : null,
      }));
      if (rows.length) await sb(c, "product_fields", { method: "POST", body: JSON.stringify(rows) });
    }
    if (rules.length) {
      const rows = rules.filter((r: any) => String(r?.rule_text || "").trim()).map((r: any, i: number) => ({
        product_id: product.id,
        title: String(r?.title || "Usage Rule").trim(),
        rule_text: String(r.rule_text).trim(),
        sort_order: Number.isFinite(Number(r?.sort_order)) ? Number(r.sort_order) : i,
        active: r?.active !== false,
      }));
      if (rows.length) await sb(c, "product_rules", { method: "POST", body: JSON.stringify(rows) });
    }

    return c.json({ success: true, id: product.id });
  } catch (error) {
    return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
  }
});

export default productRoutes;
