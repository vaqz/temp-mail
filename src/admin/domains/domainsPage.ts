export const DOMAINS_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0f2b75">
<title>Vaqz Mobiz · Mailbox Domains</title>
<link rel="icon" href="/admin/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/admin/assets/domains.css">
</head>
<body>
<div class="wrap">
<section id="login" class="card login" style="display:none">
<div class="brand"><div class="brand-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5h16v13H4z"/><path d="m4 7 8 6 8-6"/></svg></div><div><h1>Mailbox Domains</h1><div class="muted">Vaqz Mobiz Mail administration</div></div></div>
<p class="muted" style="margin:18px 0">Manage supported mailbox domains and Gmail copy destinations.</p><div id="loginMsg" class="notice"></div>
<div class="field"><label for="token">Admin token</label><input id="token" type="password" autocomplete="current-password" placeholder="Enter admin token"></div><button id="loginBtn" class="btn" style="margin-top:12px">Open Domain Manager</button>
</section>
<main id="app">
<section class="card"><div class="header"><div class="brand"><div class="brand-mark">VM</div><div><h1>Mailbox Domains</h1><div class="muted">Application-side support and Gmail copy destinations.</div></div></div><div class="header-actions"><a href="/admin" class="btn ghost">Dashboard</a><button id="refreshBtn" class="btn">Refresh</button><button id="logoutBtn" class="btn danger">Logout</button></div></div><div id="msg" class="notice"></div></section>
<section class="stats"><div class="stat"><div class="stat-label">Configured Domains</div><div id="domainCount" class="stat-value">0</div></div><div class="stat"><div class="stat-label">Active Domains</div><div id="activeCount" class="stat-value">0</div></div><div class="stat"><div class="stat-label">Gmail Destinations</div><div id="destinationCount" class="stat-value">0</div></div></section>
<section class="card"><div class="section-head"><div><h2>Add Domain</h2><p class="muted">Cloudflare DNS and Email Routing remain separate. This manager controls application-side mailbox support and Gmail copies.</p></div></div><div class="form"><div class="field"><label for="domain">Domain</label><input id="domain" placeholder="vmdeet.art"></div><div class="field"><label for="destination">Gmail copy destination</label><input id="destination" placeholder="netflixegy889@gmail.com"></div><button id="addBtn" class="btn success">Add Domain</button></div></section>
<section class="card"><div class="header"><div><h2>Configured Domains</h2><div class="muted">Choose a domain to manage its status and Gmail copy destinations.</div></div></div><div id="list" class="domain-grid"><div class="empty">Loading...</div></div></section>
</main></div>

<div id="domainModal" class="modal" aria-hidden="true"><div class="modal-box"><div class="modal-head"><div><h2 id="modalDomainName">Domain</h2><div id="modalDomainStatus" class="muted"></div></div><button id="closeDomainBtn" class="icon-btn" title="Close" aria-label="Close">×</button></div><div id="domainMsg" class="notice"></div><div class="domain-modal-status"><div><div class="modal-label">Mailbox status</div><div id="modalStatusBadge"></div></div><button id="toggleDomainBtn" class="btn"></button></div><div class="destinations-modal"><div class="dest-title"><strong>Gmail copy destinations</strong><span id="modalDestinationCount" class="muted"></span></div><div id="modalDestinations"></div><div class="add-destination"><input id="modalDestinationInput" placeholder="Add Gmail destination"><button id="modalAddDestination" class="btn">Add Destination</button></div></div></div></div>

<script src="/admin/assets/domains.js" defer></script>
</body></html>`;
