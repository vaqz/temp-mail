export type AdminAuditInput = {
  action: string;
  resourceType?: string;
  resourceId?: string | null;
  summary: string;
  details?: Record<string, unknown>;
};

function supabaseConfig(c: any) {
  const url = String(c.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(c.env.SUPABASE_SERVICE_ROLE_KEY || "");
  if (!url || !key) throw new Error("Supabase is not configured.");
  return { url, key };
}

export async function writeAdminAudit(c: any, input: AdminAuditInput): Promise<void> {
  try {
    const { url, key } = supabaseConfig(c);
    const headers = new Headers({
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    });

    const ipAddress =
      c.req.header("CF-Connecting-IP") ||
      c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ||
      null;

    const userAgent = c.req.header("User-Agent") || null;

    const payload = {
      actor: "admin",
      action: input.action,
      resource_type: input.resourceType || null,
      resource_id: input.resourceId ?? null,
      summary: input.summary,
      details: input.details || {},
      ip_address: ipAddress,
      user_agent: userAgent,
    };

    const response = await fetch(`${url}/rest/v1/admin_audit_logs`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Admin audit write failed:", response.status, text);
    }
  } catch (error) {
    console.error(
      "Admin audit write failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

export async function listAdminAudits(
  c: any,
  options: { page: number; pageSize: number; action?: string; search?: string },
) {
  const { url, key } = supabaseConfig(c);
  const headers = new Headers({
    apikey: key,
    Authorization: `Bearer ${key}`,
  });

  const params = new URLSearchParams();
  params.set(
    "select",
    "id,created_at,actor,action,resource_type,resource_id,summary,details,ip_address,user_agent",
  );
  params.set("order", "created_at.desc");
  params.set("limit", String(options.pageSize));
  params.set("offset", String((options.page - 1) * options.pageSize));

  if (options.action) {
    params.set("action", `eq.${options.action}`);
  }

  if (options.search) {
    const escaped = options.search.replace(/[%_]/g, "\\$&").replace(/,/g, "\\,");
    params.set(
      "or",
      `summary.ilike.*${escaped}*,resource_type.ilike.*${escaped}*,resource_id.ilike.*${escaped}*`,
    );
  }

  const response = await fetch(
    `${url}/rest/v1/admin_audit_logs?${params.toString()}`,
    { headers },
  );
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

  return Array.isArray(data) ? data : [];
}
