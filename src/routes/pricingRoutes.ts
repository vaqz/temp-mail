import { PRICING_MANAGEMENT_PAGE } from "@/admin/pricing/pricingPage";
import { isAdminAuthorized } from "@/utils/adminAuth";
import { writeAdminAudit } from "@/utils/adminAudit";
import { OpenAPIHono } from "@hono/zod-openapi";

const pricingRoutes = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function unauthorized(c: any) {
  return c.json({ error: { message: "Unauthorized" } }, 401);
}
function supabaseConfig(c: any) {
  const url = String(c.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(c.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) throw new Error("Supabase is not configured.");
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
  if (!response.ok) throw new Error(data?.message || data?.hint || data?.details || data?.error || text || `Supabase request failed (${response.status})`);
  return data;
}
pricingRoutes.get("/admin/pricing", async c => {
  if (!(await isAdminAuthorized(c))) return c.redirect("/admin", 302);
  return c.html(PRICING_MANAGEMENT_PAGE);
});
pricingRoutes.get("/admin/api/pricing", async c => {
  if (!(await isAdminAuthorized(c))) return unauthorized(c);
  try {
    const [products, modes, tiers, prices] = await Promise.all([
      sb(c, "products?select=id,name,code,status&order=name.asc"),
      sb(c, "product_modes?select=id,product_id,mode,display_name,active&order=created_at.asc"),
      sb(c, "pricing_tiers?select=id,name,code,tier_type,active&active=eq.true&order=name.asc"),
      sb(c, "product_term_prices?select=id,product_id,product_mode_id,pricing_tier_id,term_months,price,active,effective_from,effective_until&active=eq.true&order=term_months.asc"),
    ]);
    return c.json({ products: products || [], modes: modes || [], tiers: tiers || [], prices: prices || [] });
  } catch (error) {
    return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
  }
});
pricingRoutes.post("/admin/api/pricing", async c => {
  if (!(await isAdminAuthorized(c))) return unauthorized(c);
  try {
    const body = await c.req.json();
    const productId = String(body?.product || "");
    const modeId = String(body?.mode || "");
    const tierId = String(body?.tier || "");
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!productId || !modeId || !tierId || !items) return c.json({ error: { message: "Product, selling mode, price list, and price items are required." } }, 400);
    const [products, modes, tiers] = await Promise.all([
      sb(c, `products?id=eq.${encodeURIComponent(productId)}&select=id,name,status`),
      sb(c, `product_modes?id=eq.${encodeURIComponent(modeId)}&select=id,product_id,mode,active`),
      sb(c, `pricing_tiers?id=eq.${encodeURIComponent(tierId)}&select=id,name,active`),
    ]);
    const product = products?.[0], mode = modes?.[0], tier = tiers?.[0];
    if (!product || !mode || mode.product_id !== productId || mode.active !== true || !tier || tier.active !== true) {
      return c.json({ error: { message: "The selected product, mode, or price list is unavailable." } }, 400);
    }
    const normalized = items.map((item: any) => ({ term_months: Number(item?.term_months), price: Number(item?.price) }));
    if (normalized.some((item: any) => !Number.isInteger(item.term_months) || item.term_months < 1 || item.term_months > 120 || !Number.isFinite(item.price) || item.price < 0 || item.price > 9999999999.99)) {
      return c.json({ error: { message: "Terms must be 1–120 months and prices must be zero or higher." } }, 400);
    }
    if (new Set(normalized.map((item: any) => item.term_months)).size !== normalized.length) {
      return c.json({ error: { message: "Each subscription term can appear only once." } }, 400);
    }
    const existingPrices = await sb(c, `product_term_prices?product_mode_id=eq.${encodeURIComponent(modeId)}&pricing_tier_id=eq.${encodeURIComponent(tierId)}&active=eq.true&select=id,term_months,price`);
    const submittedTerms = new Set(normalized.map((item: any) => item.term_months));
    for (const old of (existingPrices || []).filter((row: any) => !submittedTerms.has(Number(row.term_months)))) {
      await sb(c, `product_term_prices?id=eq.${encodeURIComponent(old.id)}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ active: false, effective_until: new Date().toISOString() }),
      });
    }
    for (const item of normalized) {
      const current = (existingPrices || []).filter((row: any) => Number(row.term_months) === item.term_months);
      if (current[0] && Number(current[0].price) === item.price) continue;
      if (current[0]) {
        await sb(c, `product_term_prices?id=eq.${encodeURIComponent(current[0].id)}`, {
          method: "PATCH", headers: { Prefer: "return=minimal" },
          body: JSON.stringify({ active: false, effective_until: new Date().toISOString() }),
        });
      }
      await sb(c, "product_term_prices", {
        method: "POST", headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ product_id: productId, product_mode_id: modeId, pricing_tier_id: tierId, term_months: item.term_months, price: item.price, active: true }),
      });
    }
    await writeAdminAudit(c, {
      action: "UPDATE_PRODUCT_PRICING", resourceType: "product_pricing", resourceId: productId,
      summary: `Saved manual prices for ${product.name} / ${mode.mode} / ${tier.name}.`,
      details: { product_id: productId, product_mode_id: modeId, pricing_tier_id: tierId, terms_saved: normalized.map((item: any) => item.term_months) },
    });
    const prices = await sb(c, `product_term_prices?product_id=eq.${encodeURIComponent(productId)}&product_mode_id=eq.${encodeURIComponent(modeId)}&pricing_tier_id=eq.${encodeURIComponent(tierId)}&active=eq.true&select=id,product_id,product_mode_id,pricing_tier_id,term_months,price,active,effective_from,effective_until&order=term_months.asc`);
    return c.json({ success: true, prices: prices || [] });
  } catch (error) {
    return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
  }
});
export default pricingRoutes;
