export const DOMAINS_PAGE = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width,initial-scale=1">
	<title>Mailbox Domains · Vaqz Mobiz Mail</title>
	<link rel="stylesheet" href="/admin/assets/domains.css">
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
	<script src="/admin/assets/domains.js" defer></script>
</body>
</html>`;
