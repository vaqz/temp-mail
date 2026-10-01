import { OpenAPIHono } from "@hono/zod-openapi";

const domainManagerUiRoutes = new OpenAPIHono<{
	Bindings: CloudflareBindings;
}>();

domainManagerUiRoutes.get("/admin/domains", (c) => {
	return c.html(`<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width,initial-scale=1">
	<title>Mailbox Domains · Vaqz Mobiz Mail</title>
	<style>
		*{box-sizing:border-box}
		body{margin:0;background:#f5f7fb;color:#172033;font-family:Arial,Helvetica,sans-serif}
		.wrap{max-width:1100px;margin:auto;padding:24px}
		.card{background:#fff;border:1px solid #e5e9f2;border-radius:14px;padding:20px;margin-bottom:18px;box-shadow:0 2px 8px rgba(0,0,0,.04)}
		.hidden{display:none}
		.muted{color:#64748b;font-size:13px}
		.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
		.form{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end}
		.field label{display:block;color:#64748b;font-size:12px;margin-bottom:6px}
		.field input{width:100%;padding:11px 12px;border:1px solid #ccd3df;border-radius:8px;font:inherit}
		.field input:focus{border-color:#2563eb;outline:none}
		button{border:0;border-radius:8px;padding:10px 13px;background:#2563eb;color:#fff;cursor:pointer;font:inherit}
		button.secondary{background:#64748b}
		button.success{background:#15803d}
		button.warning{background:#b45309}
		button.danger{background:#dc2626}
		button.small{padding:7px 9px;font-size:13px}
		.domain{border:1px solid #e5e9f2;border-radius:12px;padding:16px;margin-top:12px}
		.domain-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}
		.badge{display:inline-block;padding:4px 8px;border-radius:20px;font-size:11px;font-weight:bold;background:#dcfce7;color:#166534}
		.badge.off{background:#f1f5f9;color:#475569}
		.dest{display:flex;justify-content:space-between;gap:10px;align-items:center;border-top:1px solid #edf0f5;padding:10px 0 0;margin-top:10px}
		.actions{display:flex;gap:6px;flex-wrap:wrap}
		.message{display:none;padding:10px 12px;border-radius:8px;margin:10px 0}
		.message.show{display:block}
		.ok{background:#dcfce7;color:#166534}
		.err{background:#fee2e2;color:#991b1b}
		@media(max-width:700px){.wrap{padding:12px}.form{grid-template-columns:1fr}.form button{width:100%}}
	</style>
</head>
<body>
	<div class="wrap">
		<div id="login" class="card">
			<h1>Mailbox Domains</h1>
			<p class="muted">Admin authentication is required.</p>
			<div id="loginMsg" class="message"></div>
			<div class="field">
				<label for="token">Admin token</label>
				<input id="token" type="password" autocomplete="current-password">
			</div>
			<br>
			<button id="loginBtn">Open Domain Manager</button>
		</div>

		<div id="app" class="hidden">
			<div class="card">
				<div class="row" style="justify-content:space-between">
					<div>
						<h1>Mailbox Domains</h1>
						<div class="muted">Control supported mailbox domains and Gmail copy destinations.</div>
					</div>
					<div class="actions">
						<button class="secondary" id="backBtn">Back to Admin</button>
						<button class="danger" id="logoutBtn">Logout</button>
					</div>
				</div>
				<div id="msg" class="message"></div>
			</div>

			<div class="card">
				<h2>Add domain</h2>
				<p class="muted">Cloudflare DNS and Email Routing remain separate. This controls application-side mailbox support and Gmail copies.</p>
				<div class="form">
					<div class="field"><label for="domain">Domain</label><input id="domain" placeholder="vmdeet.art"></div>
					<div class="field"><label for="destination">Gmail copy destination</label><input id="destination" placeholder="netflixegy889@gmail.com"></div>
					<button class="success" id="addBtn">Add Domain</button>
				</div>
			</div>

			<div class="card">
				<h2>Configured domains</h2>
				<div id="list"><div class="muted">Loading...</div></div>
			</div>
		</div>
	</div>

	<script>
		let token = sessionStorage.getItem('vm_admin_token') || '';
		const $ = (id) => document.getElementById(id);

		function headers(extra) {
			return Object.assign({ Authorization: 'Bearer ' + token }, extra || {});
		}

		async function api(path, options) {
			const request = options || {};
			request.headers = headers(request.headers);
			const response = await fetch(path, request);
			let data = null;
			try { data = await response.json(); } catch (_) {}
			if (response.status === 401) throw new Error('Unauthorized');
			if (!response.ok) throw new Error(data?.error?.message || 'Request failed');
			return data;
		}

		function show(id, text, error) {
			const element = $(id);
			element.textContent = text;
			element.className = 'message show ' + (error ? 'err' : 'ok');
		}

		function escapeHtml(value) {
			return String(value ?? '')
				.replaceAll('&', '&amp;')
				.replaceAll('<', '&lt;')
				.replaceAll('>', '&gt;')
				.replaceAll('"', '&quot;')
				.replaceAll("'", '&#039;');
		}

		function domainInputId(domain) {
			return 'destination-' + encodeURIComponent(domain).replaceAll('%', '_');
		}

		function renderDomain(domain) {
			const activeClass = domain.is_active ? '' : 'off';
			const activeText = domain.is_active ? 'ACTIVE' : 'DISABLED';
			const toggleClass = domain.is_active ? 'warning' : 'success';
			const toggleText = domain.is_active ? 'Disable' : 'Enable';
			const toggleState = domain.is_active ? 'false' : 'true';
			const inputId = domainInputId(domain.domain);

			const destinations = domain.destinations.length
				? domain.destinations.map((destination) => `
					<div class="dest">
						<span>${escapeHtml(destination.destination_email)} <span class="badge ${destination.is_active ? '' : 'off'}">${destination.is_active ? 'ACTIVE' : 'DISABLED'}</span></span>
						<button class="small danger" data-action="remove-destination" data-id="${escapeHtml(destination.id)}">Remove</button>
					</div>`).join('')
				: '<div class="muted" style="margin-top:12px">No Gmail copy destinations.</div>';

			return `
				<div class="domain">
					<div class="domain-head">
						<div>
							<strong>${escapeHtml(domain.domain)}</strong>
							<span class="badge ${activeClass}">${activeText}</span>
							<div class="muted">Mailbox login and sync support</div>
						</div>
						<button class="small ${toggleClass}" data-action="toggle-domain" data-domain="${encodeURIComponent(domain.domain)}" data-active="${toggleState}">${toggleText}</button>
					</div>
					${destinations}
					<div class="row" style="margin-top:12px">
						<input id="${inputId}" style="flex:1;min-width:220px;padding:9px;border:1px solid #ccd3df;border-radius:8px" placeholder="Add destination email">
						<button class="small" data-action="add-destination" data-domain="${encodeURIComponent(domain.domain)}" data-input="${inputId}">Add Destination</button>
					</div>
				</div>`;
		}

		async function load() {
			try {
				const domains = await api('/admin/api/domains');
				$('list').innerHTML = domains.length
					? domains.map(renderDomain).join('')
					: '<div class="muted">No domains configured.</div>';
			} catch (error) {
				show('msg', error.message, true);
			}
		}

		async function openApp() {
			try {
				await api('/admin/api/domains');
				sessionStorage.setItem('vm_admin_token', token);
				$('login').classList.add('hidden');
				$('app').classList.remove('hidden');
				await load();
			} catch (error) {
				show('loginMsg', error.message || 'Invalid admin token.', true);
			}
		}

		async function addDomain() {
			try {
				await api('/admin/api/domains', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ domain: $('domain').value, destination_email: $('destination').value })
				});
				$('domain').value = '';
				$('destination').value = '';
				show('msg', 'Domain added successfully.');
				await load();
			} catch (error) {
				show('msg', error.message, true);
			}
		}

		async function toggleDomain(domain, active) {
			try {
				await api('/admin/api/domains/' + domain, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ is_active: active })
				});
				show('msg', active ? 'Domain enabled.' : 'Domain disabled.');
				await load();
			} catch (error) {
				show('msg', error.message, true);
			}
		}

		async function addDestination(domain, inputId) {
			const input = $(inputId);
			try {
				await api('/admin/api/domains/' + domain + '/destinations', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ destination_email: input.value })
				});
				input.value = '';
				show('msg', 'Destination added.');
				await load();
			} catch (error) {
				show('msg', error.message, true);
			}
		}

		async function removeDestination(id) {
			if (!confirm('Remove this Gmail copy destination?')) return;
			try {
				await api('/admin/api/destinations/' + encodeURIComponent(id), { method: 'DELETE' });
				show('msg', 'Destination removed.');
				await load();
			} catch (error) {
				show('msg', error.message, true);
			}
		}

		$('loginBtn').addEventListener('click', () => {
			token = $('token').value.trim();
			openApp();
		});
		$('token').addEventListener('keydown', (event) => {
			if (event.key === 'Enter') $('loginBtn').click();
		});
		$('addBtn').addEventListener('click', addDomain);
		$('backBtn').addEventListener('click', () => { location.href = '/admin'; });
		$('logoutBtn').addEventListener('click', () => {
			sessionStorage.removeItem('vm_admin_token');
			location.reload();
		});
		$('list').addEventListener('click', (event) => {
			const button = event.target.closest('[data-action]');
			if (!button) return;
			const action = button.dataset.action;
			if (action === 'toggle-domain') toggleDomain(button.dataset.domain, button.dataset.active === 'true');
			if (action === 'add-destination') addDestination(button.dataset.domain, button.dataset.input);
			if (action === 'remove-destination') removeDestination(button.dataset.id);
		});

		if (token) openApp();
	</script>
</body>
</html>`);
});

export default domainManagerUiRoutes;
