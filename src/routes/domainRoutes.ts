import { OpenAPIHono } from "@hono/zod-openapi";

const domainRoutes = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

function isAuthorized(c: any): boolean {
	const auth = c.req.header("Authorization");
	const token = c.env.ADMIN_TOKEN;
	return Boolean(token && auth === `Bearer ${token}`);
}

function normalizeDomain(value: unknown): string {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/^https?:\/\//, "")
		.replace(/\/$/, "");
}

function normalizeDestination(value: unknown): string {
	return String(value || "").trim().toLowerCase();
}

function validDomain(domain: string): boolean {
	return domain.length <= 253 &&
		/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain);
}

function validEmail(email: string): boolean {
	return email.length <= 320 &&
		/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* =========================================================
   DOMAIN MANAGER PAGE
========================================================= */

domainRoutes.get("/admin/domains", async (c) => {
	if (!isAuthorized(c)) {
		return c.html(`<!doctype html><html><body style="font-family:Arial;padding:40px"><h2>Unauthorized</h2><p>Please open this page from the authenticated admin session.</p></body></html>`, 401);
	}

	const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mailbox Domains · Vaqz Mobiz Mail</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f5f7fb;color:#172033;font-family:Arial,Helvetica,sans-serif}.wrap{max-width:1100px;margin:0 auto;padding:24px}.card{background:#fff;border:1px solid #e5e9f2;border-radius:14px;padding:20px;margin-bottom:18px;box-shadow:0 2px 8px rgba(0,0,0,.04)}h1,h2{margin:0 0 8px}.muted{color:#64748b;font-size:13px}.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.form{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end}.field label{display:block;color:#64748b;font-size:12px;margin-bottom:6px}.field input{width:100%;padding:11px 12px;border:1px solid #ccd3df;border-radius:8px;font:inherit;outline:none}.field input:focus{border-color:#2563eb}button{border:0;border-radius:8px;padding:10px 13px;background:#2563eb;color:#fff;cursor:pointer;font:inherit}button.secondary{background:#64748b}button.success{background:#15803d}button.warning{background:#b45309}button.danger{background:#dc2626}button.small{padding:7px 9px;font-size:13px}.domain{border:1px solid #e5e9f2;border-radius:12px;padding:16px;margin-top:12px}.domain-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}.badge{display:inline-block;padding:4px 8px;border-radius:20px;font-size:11px;font-weight:bold;background:#dcfce7;color:#166534}.badge.off{background:#f1f5f9;color:#475569}.dest{display:flex;justify-content:space-between;gap:10px;align-items:center;border-top:1px solid #edf0f5;padding:10px 0 0;margin-top:10px}.actions{display:flex;gap:6px;flex-wrap:wrap}.message{display:none;padding:10px 12px;border-radius:8px;margin:10px 0}.message.show{display:block}.ok{background:#dcfce7;color:#166534}.err{background:#fee2e2;color:#991b1b}@media(max-width:700px){.wrap{padding:12px}.form{grid-template-columns:1fr}.form button{width:100%}.actions{width:100%}.actions button{flex:1}}
</style>
</head>
<body>
<div class="wrap">
<div class="card">
<div class="row" style="justify-content:space-between">
<div><h1>Mailbox Domains</h1><div class="muted">Control supported mailbox domains and Gmail copy destinations.</div></div>
<button class="secondary" onclick="location.href='/admin'">Back to Admin</button>
</div>
<div id="msg" class="message"></div>
</div>
<div class="card">
<h2>Add domain</h2>
<p class="muted">Cloudflare DNS and Email Routing are still configured separately. This page controls the application-side mailbox support.</p>
<div class="form">
<div class="field"><label>Domain</label><input id="domain" placeholder="vmdeet.art" autocomplete="off"></div>
<div class="field"><label>Gmail copy destination</label><input id="destination" placeholder="netflixegy889@gmail.com" autocomplete="off"></div>
<button class="success" id="addBtn">Add Domain</button>
</div>
</div>
<div class="card"><h2>Configured domains</h2><div id="list"><div class="muted">Loading...</div></div></div>
</div>
<script>
let token=sessionStorage.getItem('vm_admin_token')||'';
function authHeaders(extra){return Object.assign({'Authorization':'Bearer '+token},extra||{});}
async function api(path,options){const o=options||{};o.headers=authHeaders(o.headers);const r=await fetch(path,o);let d=null;try{d=await r.json()}catch(e){}if(r.status===401){throw new Error('Unauthorized. Please return to the admin dashboard and log in again.')}if(!r.ok)throw new Error((d&&d.error&&d.error.message)||'Request failed');return d;}
function msg(text,error){const e=document.getElementById('msg');e.textContent=text;e.className='message show '+(error?'err':'ok');setTimeout(()=>e.className='message',4000)}
function esc(v){return String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
async function load(){try{const domains=await api('/admin/api/domains');const list=document.getElementById('list');list.innerHTML='';if(!domains.length){list.innerHTML='<div class="muted">No domains configured.</div>';return}for(const d of domains){const box=document.createElement('div');box.className='domain';const active=d.is_active?'ACTIVE':'DISABLED';box.innerHTML='<div class="domain-head"><div><strong>'+esc(d.domain)+'</strong> <span class="badge '+(d.is_active?'':'off')+'">'+active+'</span><div class="muted">Mailbox login and sync support</div></div><div class="actions"><button class="small '+(d.is_active?'warning':'success')+'" onclick="toggleDomain(\''+encodeURIComponent(d.domain)+'\','+(d.is_active?'false':'true')+')">'+(d.is_active?'Disable':'Enable')+'</button></div></div><div class="destinations">'+(d.destinations.length?d.destinations.map(x=>'<div class="dest"><span>'+esc(x.destination_email)+' '+(x.is_active?'<span class="badge">ACTIVE</span>':'<span class="badge off">DISABLED</span>')+'</span><button class="small danger" onclick="removeDestination(\''+x.id+'\')">Remove</button></div>').join(''):'<div class="muted" style="margin-top:12px">No Gmail copy destinations.</div>')+'</div><div class="row" style="margin-top:12px"><input style="flex:1;min-width:220px;padding:9px;border:1px solid #ccd3df;border-radius:8px" id="dest-'+esc(d.domain)+'" placeholder="Add destination email"><button class="small" onclick="addDestination(\''+encodeURIComponent(d.domain)+'\')">Add Destination</button></div>';list.appendChild(box)}}catch(e){msg(e.message,true)}}
async function addDomain(){const domain=document.getElementById('domain').value.trim();const destination=document.getElementById('destination').value.trim();if(!domain)return msg('Domain is required.',true);try{await api('/admin/api/domains',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain,destination_email:destination})});document.getElementById('domain').value='';document.getElementById('destination').value='';msg('Domain added successfully.');await load()}catch(e){msg(e.message,true)}}
async function toggleDomain(domain,active){try{await api('/admin/api/domains/'+domain,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({is_active:active})});msg(active?'Domain enabled.':'Domain disabled.');await load()}catch(e){msg(e.message,true)}}
async function addDestination(domain){const el=document.getElementById('dest-'+decodeURIComponent(domain));const destination=el.value.trim();if(!destination)return msg('Destination email is required.',true);try{await api('/admin/api/domains/'+domain+'/destinations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({destination_email:destination})});el.value='';msg('Destination added.');await load()}catch(e){msg(e.message,true)}}
async function removeDestination(id){if(!confirm('Remove this Gmail copy destination?'))return;try{await api('/admin/api/destinations/'+encodeURIComponent(id),{method:'DELETE'});msg('Destination removed.');await load()}catch(e){msg(e.message,true)}}
document.getElementById('addBtn').onclick=addDomain;
load();
</script>
</body></html>`;

	return c.html(html);
});

/* =========================================================
   DOMAIN API
========================================================= */

domainRoutes.get("/admin/api/domains", async (c) => {
	if (!isAuthorized(c)) return c.json({ error: { message: "Unauthorized" } }, 401);

	try {
		const domains = await c.env.D1.prepare(
			`SELECT domain, is_active, created_at, updated_at
			 FROM mailbox_domains ORDER BY domain ASC`,
		).all();

		const rows = domains.results as Array<any>;
		const destinations = await c.env.D1.prepare(
			`SELECT id, domain, destination_email, is_active, created_at, updated_at
			 FROM mailbox_domain_destinations ORDER BY domain ASC, destination_email ASC`,
		).all();

		const grouped = new Map<string, any[]>();
		for (const row of destinations.results as Array<any>) {
			const list = grouped.get(String(row.domain)) || [];
			list.push(row);
			grouped.set(String(row.domain), list);
		}

		return c.json(rows.map((row) => ({
			...row,
			is_active: Boolean(row.is_active),
			destinations: grouped.get(String(row.domain)) || [],
		})));
	} catch (error) {
		return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
	}
});

domainRoutes.post("/admin/api/domains", async (c) => {
	if (!isAuthorized(c)) return c.json({ error: { message: "Unauthorized" } }, 401);

	try {
		const body = await c.req.json();
		const domain = normalizeDomain(body?.domain);
		const destination = normalizeDestination(body?.destination_email);

		if (!validDomain(domain)) return c.json({ error: { message: "Invalid domain." } }, 400);
		if (destination && !validEmail(destination)) return c.json({ error: { message: "Invalid destination email." } }, 400);

		const now = Date.now();
		await c.env.D1.prepare(
			`INSERT INTO mailbox_domains (domain, is_active, created_at, updated_at)
			 VALUES (?, 1, ?, ?)
			 ON CONFLICT(domain) DO UPDATE SET is_active = 1, updated_at = excluded.updated_at`,
		).bind(domain, now, now).run();

		if (destination) {
			await c.env.D1.prepare(
				`INSERT OR IGNORE INTO mailbox_domain_destinations
				 (id, domain, destination_email, is_active, created_at, updated_at)
				 VALUES (?, ?, ?, 1, ?, ?)`,
			).bind(crypto.randomUUID(), domain, destination, now, now).run();
			await c.env.D1.prepare(
				`UPDATE mailbox_domain_destinations SET is_active = 1, updated_at = ?
				 WHERE domain = ? AND destination_email = ?`,
			).bind(now, domain, destination).run();
		}

		return c.json({ success: true, domain });
	} catch (error) {
		return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
	}
});

domainRoutes.patch("/admin/api/domains/:domain", async (c) => {
	if (!isAuthorized(c)) return c.json({ error: { message: "Unauthorized" } }, 401);

	try {
		const domain = normalizeDomain(c.req.param("domain"));
		const body = await c.req.json();
		if (typeof body?.is_active !== "boolean") return c.json({ error: { message: "is_active must be boolean." } }, 400);
		const result = await c.env.D1.prepare(
			`UPDATE mailbox_domains SET is_active = ?, updated_at = ? WHERE domain = ?`,
		).bind(body.is_active ? 1 : 0, Date.now(), domain).run();
		if (!result.success) return c.json({ error: { message: "Failed to update domain." } }, 500);
		return c.json({ success: true, domain, is_active: body.is_active });
	} catch (error) {
		return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
	}
});

domainRoutes.post("/admin/api/domains/:domain/destinations", async (c) => {
	if (!isAuthorized(c)) return c.json({ error: { message: "Unauthorized" } }, 401);

	try {
		const domain = normalizeDomain(c.req.param("domain"));
		const body = await c.req.json();
		const destination = normalizeDestination(body?.destination_email);
		if (!validDomain(domain)) return c.json({ error: { message: "Invalid domain." } }, 400);
		if (!validEmail(destination)) return c.json({ error: { message: "Invalid destination email." } }, 400);

		const existingDomain = await c.env.D1.prepare(
			`SELECT domain FROM mailbox_domains WHERE domain = ? LIMIT 1`,
		).bind(domain).first();
		if (!existingDomain) return c.json({ error: { message: "Domain does not exist." } }, 404);

		const now = Date.now();
		const existing = await c.env.D1.prepare(
			`SELECT id FROM mailbox_domain_destinations WHERE domain = ? AND destination_email = ? LIMIT 1`,
		).bind(domain, destination).first();

		if (existing) {
			await c.env.D1.prepare(
				`UPDATE mailbox_domain_destinations SET is_active = 1, updated_at = ? WHERE id = ?`,
			).bind(now, (existing as any).id).run();
			return c.json({ success: true, id: (existing as any).id });
		}

		const id = crypto.randomUUID();
		await c.env.D1.prepare(
			`INSERT INTO mailbox_domain_destinations
			 (id, domain, destination_email, is_active, created_at, updated_at)
			 VALUES (?, ?, ?, 1, ?, ?)`,
		).bind(id, domain, destination, now, now).run();

		return c.json({ success: true, id });
	} catch (error) {
		return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
	}
});

domainRoutes.delete("/admin/api/destinations/:id", async (c) => {
	if (!isAuthorized(c)) return c.json({ error: { message: "Unauthorized" } }, 401);

	try {
		const id = c.req.param("id");
		await c.env.D1.prepare(
			`DELETE FROM mailbox_domain_destinations WHERE id = ?`,
		).bind(id).run();
		return c.json({ success: true, id });
	} catch (error) {
		return c.json({ error: { message: error instanceof Error ? error.message : String(error) } }, 500);
	}
});

/* =========================================================
   INTERNAL DOMAIN LOOKUP
========================================================= */

export async function getActiveMailboxDomains(db: D1Database): Promise<string[]> {
	try {
		const result = await db.prepare(
			`SELECT domain FROM mailbox_domains WHERE is_active = 1 ORDER BY domain ASC`,
		).all<{ domain: string }>();
		return result.results.map((row) => row.domain.toLowerCase());
	} catch (error) {
		console.error("Failed to load mailbox domains:", error);
		return ["vaqzmobiz.com", "vmhub.top"];
	}
}

export async function getActiveDomainDestinations(
	db: D1Database,
	domain: string,
): Promise<string[]> {
	try {
		const result = await db.prepare(
			`SELECT destination_email
			 FROM mailbox_domain_destinations
			 WHERE domain = ? AND is_active = 1`,
		).bind(domain.toLowerCase()).all<{ destination_email: string }>();
		return result.results.map((row) => row.destination_email.toLowerCase());
	} catch (error) {
		console.error("Failed to load mailbox destinations:", error);
		return domain === "vaqzmobiz.com" || domain === "vmhub.top"
			? ["netflixegy889@gmail.com"]
			: [];
	}
}

export default domainRoutes;
