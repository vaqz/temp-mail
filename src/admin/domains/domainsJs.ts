const token = sessionStorage.getItem('vm_admin_token') || '';

const get = (id: string) => document.getElementById(id) as HTMLElement;

function headers(extra?: Record<string, string>): Record<string, string> {
	return Object.assign({ Authorization: 'Bearer ' + token }, extra || {});
}

async function api(path: string, options?: RequestInit): Promise<any> {
	const request: RequestInit = options || {};
	request.headers = headers(request.headers as Record<string, string> | undefined);
	const response = await fetch(path, request);
	let data: any = null;
	try { data = await response.json(); } catch (_) {}
	if (response.status === 401) throw new Error('Unauthorized');
	if (!response.ok) throw new Error(data?.error?.message || 'Request failed');
	return data;
}

function show(id: string, text: string, error = false): void {
	const element = get(id);
	element.textContent = text;
	element.className = 'message show ' + (error ? 'err' : 'ok');
}

function escapeHtml(value: unknown): string {
	return String(value ?? '')
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

function domainInputId(domain: string): string {
	return 'destination-' + encodeURIComponent(domain).replaceAll('%', '_');
}

function renderDomain(domain: any): string {
	const activeClass = domain.is_active ? '' : 'off';
	const activeText = domain.is_active ? 'ACTIVE' : 'DISABLED';
	const toggleClass = domain.is_active ? 'warning' : 'success';
	const toggleText = domain.is_active ? 'Disable' : 'Enable';
	const toggleState = domain.is_active ? 'false' : 'true';
	const inputId = domainInputId(domain.domain);

	const destinations = domain.destinations.length
		? domain.destinations.map((destination: any) => {
			const statusClass = destination.is_active ? '' : 'off';
			const statusText = destination.is_active ? 'ACTIVE' : 'DISABLED';
			return [
				'<div class="dest">',
				'<span>',
				escapeHtml(destination.destination_email),
				' <span class="badge ', statusClass, '">', statusText, '</span></span>',
				'<button class="small danger" data-action="remove-destination" data-id="',
				escapeHtml(destination.id), '">Remove</button>',
				'</div>'
			].join('');
		}).join('')
		: '<div class="muted" style="margin-top:12px">No Gmail copy destinations.</div>';

	return [
		'<div class="domain">',
		'<div class="domain-head">',
		'<div><strong>', escapeHtml(domain.domain), '</strong>',
		'<span class="badge ', activeClass, '">', activeText, '</span>',
		'<div class="muted">Mailbox login and sync support</div></div>',
		'<button class="small ', toggleClass, '" data-action="toggle-domain" data-domain="',
		encodeURIComponent(domain.domain), '" data-active="', toggleState, '">', toggleText, '</button>',
		'</div>',
		destinations,
		'<div class="row" style="margin-top:12px">',
		'<input id="', inputId, '" style="flex:1;min-width:220px;padding:9px;border:1px solid #ccd3df;border-radius:8px" placeholder="Add destination email">',
		'<button class="small" data-action="add-destination" data-domain="',
		encodeURIComponent(domain.domain), '" data-input="', inputId, '">Add Destination</button>',
		'</div></div>'
	].join('');
}

async function load(): Promise<void> {
	try {
		const domains = await api('/admin/api/domains');
		get('list').innerHTML = domains.length
			? domains.map(renderDomain).join('')
			: '<div class="muted">No domains configured.</div>';
	} catch (error) {
		show('msg', error instanceof Error ? error.message : String(error), true);
	}
}

async function openApp(): Promise<void> {
	try {
		await api('/admin/api/domains');
		sessionStorage.setItem('vm_admin_token', token);
		get('login').classList.add('hidden');
		get('app').classList.remove('hidden');
		await load();
	} catch (error) {
		show('loginMsg', error instanceof Error ? error.message : 'Invalid admin token.', true);
	}
}

async function addDomain(): Promise<void> {
	try {
		await api('/admin/api/domains', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ domain: (get('domain') as HTMLInputElement).value, destination_email: (get('destination') as HTMLInputElement).value })
		});
		(get('domain') as HTMLInputElement).value = '';
		(get('destination') as HTMLInputElement).value = '';
		show('msg', 'Domain added successfully.');
		await load();
	} catch (error) {
		show('msg', error instanceof Error ? error.message : String(error), true);
	}
}

async function toggleDomain(domain: string, active: boolean): Promise<void> {
	try {
		await api('/admin/api/domains/' + domain, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ is_active: active })
		});
		show('msg', active ? 'Domain enabled.' : 'Domain disabled.');
		await load();
	} catch (error) {
		show('msg', error instanceof Error ? error.message : String(error), true);
	}
}

async function addDestination(domain: string, inputId: string): Promise<void> {
	const input = get(inputId) as HTMLInputElement;
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
		show('msg', error instanceof Error ? error.message : String(error), true);
	}
}

async function removeDestination(id: string): Promise<void> {
	if (!confirm('Remove this Gmail copy destination?')) return;
	try {
		await api('/admin/api/destinations/' + encodeURIComponent(id), { method: 'DELETE' });
		show('msg', 'Destination removed.');
		await load();
	} catch (error) {
		show('msg', error instanceof Error ? error.message : String(error), true);
	}
}

document.addEventListener('DOMContentLoaded', () => {
	get('loginBtn').addEventListener('click', () => {
		const input = get('token') as HTMLInputElement;
		(input.value || '').trim();
		openApp();
	});
	get('token').addEventListener('keydown', (event) => {
		if ((event as KeyboardEvent).key === 'Enter') (get('loginBtn') as HTMLButtonElement).click();
	});
	get('addBtn').addEventListener('click', addDomain);
	get('backBtn').addEventListener('click', () => { location.href = '/admin'; });
	get('logoutBtn').addEventListener('click', () => {
		sessionStorage.removeItem('vm_admin_token');
		location.reload();
	});
	get('list').addEventListener('click', (event) => {
		const target = event.target as HTMLElement;
		const button = target.closest('[data-action]') as HTMLElement | null;
		if (!button) return;
		const action = button.dataset.action;
		if (action === 'toggle-domain') toggleDomain(button.dataset.domain || '', button.dataset.active === 'true');
		if (action === 'add-destination') addDestination(button.dataset.domain || '', button.dataset.input || '');
		if (action === 'remove-destination') removeDestination(button.dataset.id || '');
	});
	if (token) openApp();
});
