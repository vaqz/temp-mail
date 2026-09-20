import { OpenAPIHono } from "@hono/zod-openapi";
import { createDatabaseService } from "@/database";

const adminRoutes = new OpenAPIHono<{ Bindings: CloudflareBindings }>();

function isAuthorized(c: any): boolean {
	const auth = c.req.header("Authorization");
	const token = c.env.ADMIN_TOKEN;

	if (!token || !auth) {
		return false;
	}

	return auth === `Bearer ${token}`;
}

function escapeHtml(value: unknown): string {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/* =========================================================
   ADMIN DASHBOARD
========================================================= */

adminRoutes.get("/admin", async (c) => {
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vaqz Mobiz Mail Admin</title>
<style>
*{box-sizing:border-box}
body{
	margin:0;
	font-family:Arial,Helvetica,sans-serif;
	background:#f5f7fb;
	color:#172033;
}
.container{
	max-width:1400px;
	margin:0 auto;
	padding:24px;
}
.card{
	background:#fff;
	border:1px solid #e5e9f2;
	border-radius:12px;
	padding:20px;
	margin-bottom:20px;
	box-shadow:0 2px 8px rgba(0,0,0,.04);
}
h1,h2{margin-top:0}
.login{
	max-width:500px;
	margin:80px auto;
}
input,button{
	font:inherit;
}
input{
	width:100%;
	padding:11px 12px;
	border:1px solid #ccd3df;
	border-radius:8px;
	outline:none;
}
input:focus{
	border-color:#2563eb;
}
button{
	border:0;
	border-radius:7px;
	padding:9px 12px;
	cursor:pointer;
	background:#2563eb;
	color:white;
}
button.secondary{
	background:#64748b;
}
button.success{
	background:#15803d;
}
button.warning{
	background:#b45309;
}
button.danger{
	background:#dc2626;
}
button.small{
	padding:7px 9px;
	font-size:13px;
}
button:disabled{
	opacity:.5;
	cursor:not-allowed;
}
.row{
	display:flex;
	gap:10px;
	align-items:center;
}
.stats{
	display:grid;
	grid-template-columns:repeat(3,1fr);
	gap:14px;
}
.stat{
	background:#f8fafc;
	border:1px solid #e5e9f2;
	border-radius:10px;
	padding:15px;
}
.stat strong{
	display:block;
	font-size:25px;
	margin-top:5px;
}
.table-wrap{
	overflow-x:auto;
}
table{
	width:100%;
	border-collapse:collapse;
	font-size:14px;
}
th,td{
	padding:11px 9px;
	border-bottom:1px solid #edf0f5;
	text-align:left;
	vertical-align:top;
}
th{
	background:#f8fafc;
	white-space:nowrap;
}
.badge{
	display:inline-block;
	padding:4px 8px;
	border-radius:20px;
	font-size:12px;
	font-weight:bold;
}
.public{
	background:#dcfce7;
	color:#166534;
}
.private{
	background:#f1f5f9;
	color:#475569;
}
.rule{
	border:1px solid #e5e9f2;
	border-radius:10px;
	padding:14px;
	margin-bottom:10px;
}
.rule strong{
	display:block;
	margin-bottom:5px;
}
.muted{
	color:#64748b;
	font-size:13px;
}
.message{
	margin:10px 0;
	padding:10px 12px;
	border-radius:8px;
	display:none;
}
.message.error{
	display:block;
	background:#fee2e2;
	color:#991b1b;
}
.message.ok{
	display:block;
	background:#dcfce7;
	color:#166534;
}
.actions{
	display:flex;
	flex-wrap:wrap;
	gap:6px;
}
.modal{
	position:fixed;
	inset:0;
	background:rgba(15,23,42,.55);
	display:none;
	align-items:center;
	justify-content:center;
	padding:20px;
	z-index:10;
}
.modal.show{
	display:flex;
}
.modal-box{
	background:white;
	border-radius:12px;
	padding:22px;
	width:min(520px,100%);
}
@media(max-width:700px){
	.container{padding:12px}
	.stats{grid-template-columns:1fr}
	.actions{flex-direction:column}
	button{width:100%}
}
</style>
</head>
<body>

<div id="loginScreen" class="login card">
	<h1>Vaqz Mobiz Mail Admin</h1>
	<p class="muted">Administrator access</p>
	<div id="loginMessage" class="message"></div>
	<input id="tokenInput" type="password" placeholder="Admin token">
	<br><br>
	<button id="loginBtn">Login</button>
</div>

<div id="app" class="container" style="display:none">

	<div class="card">
		<div class="row" style="justify-content:space-between;flex-wrap:wrap">
			<div>
				<h1>Mail Administration</h1>
				<div class="muted">Manage public email visibility and automatic rules.</div>
			</div>
			<div class="actions">
				<button id="refreshBtn" class="secondary">Refresh</button>
				<button id="logoutBtn" class="danger">Logout</button>
			</div>
		</div>
	</div>

	<div id="globalMessage" class="message"></div>

	<div class="stats">
		<div class="stat">
			<span class="muted">Total Emails</span>
			<strong id="totalCount">0</strong>
		</div>
		<div class="stat">
			<span class="muted">Public</span>
			<strong id="publicCount">0</strong>
		</div>
		<div class="stat">
			<span class="muted">Private</span>
			<strong id="privateCount">0</strong>
		</div>
	</div>

	<div class="card">
		<h2>Automatic Public Rules</h2>
		<p class="muted">
			Only emails matching both the sender and subject phrase will automatically become public.
			Rules apply globally to all @vaqzmobiz.com mailboxes.
		</p>

		<div class="card" style="background:#f8fafc;margin:15px 0 15px 0;box-shadow:none">
			<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
				<div>
					<label class="muted">Sender</label>
					<input id="newRuleSender" placeholder="sender@example.com">
				</div>
				<div>
					<label class="muted">Subject contains</label>
					<input id="newRuleSubject" placeholder="promotion">
				</div>
			</div>
			<br>
			<button id="addRuleBtn" class="success">Add Public Rule</button>
		</div>

		<div id="rulesList">
			<div class="muted">Loading rules...</div>
		</div>
	</div>

	<div class="card">
		<div class="row" style="justify-content:space-between;flex-wrap:wrap">
			<div>
				<h2>Emails</h2>
				<div class="muted">Public emails are visible through the public mailbox API.</div>
			</div>
		</div>

		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th>From</th>
						<th>To</th>
						<th>Subject</th>
						<th>Received</th>
						<th>Visibility</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody id="emailsBody">
					<tr><td colspan="6" class="muted">Loading...</td></tr>
				</tbody>
			</table>
		</div>
	</div>

</div>

<div id="ruleModal" class="modal">
	<div class="modal-box">
		<h2>Make Public + Future Similar</h2>

		<p class="muted">
			This email will become public, and future emails from the same sender
			whose subject contains the phrase below will automatically become public.
		</p>

		<label class="muted">Sender</label>
		<input id="modalSender" readonly>

		<br><br>

		<label class="muted">Subject keyword / phrase</label>
		<input id="modalSubject" placeholder="e.g. promotion">

		<p class="muted">
			Use a stable phrase such as <b>promotion</b>, <b>special offer</b>,
			or <b>newsletter</b>. Avoid temporary values such as OTP numbers.
		</p>

		<div class="actions">
			<button id="confirmRuleBtn" class="success">Make Public & Create Rule</button>
			<button id="cancelRuleBtn" class="secondary">Cancel</button>
		</div>
	</div>
</div>

<script>
let token = "";
let selectedEmailId = "";

function showMessage(text, type="ok"){
	const el = document.getElementById("globalMessage");
	el.textContent = text;
	el.className = "message " + type;
	setTimeout(() => {
		el.className = "message";
	}, 4000);
}

function showLoginMessage(text){
	const el = document.getElementById("loginMessage");
	el.textContent = text;
	el.className = "message error";
}

async function api(path, options={}){
	const headers = Object.assign(
		{"Authorization":"Bearer " + token},
		options.headers || {}
	);

	const response = await fetch(path, Object.assign({}, options, {headers}));

	let data = null;
	try{
		data = await response.json();
	}catch(e){}

	if(response.status === 401){
		logout();
		throw new Error("Unauthorized");
	}

	if(!response.ok){
		throw new Error(data?.error?.message || data?.message || "Request failed");
	}

	return data;
}

async function login(){
	const value = document.getElementById("tokenInput").value.trim();

	if(!value){
		showLoginMessage("Please enter the admin token.");
		return;
	}

	token = value;

	try{
		await api("/admin/emails");
		document.getElementById("loginScreen").style.display = "none";
		document.getElementById("app").style.display = "block";
		await refreshAll();
	}catch(error){
		token = "";
		showLoginMessage(error.message || "Invalid admin token.");
	}
}

function logout(){
	token = "";
	document.getElementById("app").style.display = "none";
	document.getElementById("loginScreen").style.display = "block";
	document.getElementById("tokenInput").value = "";
}

function formatDate(value){
	if(!value) return "-";

	try{
		return new Date(Number(value)).toLocaleString();
	}catch(e){
		return String(value);
	}
}

async function loadEmails(){
	const data = await api("/admin/emails");
	const emails = data?.data || data || [];

	const total = emails.length;
	const publicEmails = emails.filter(e => e.is_public === true);
	const privateEmails = emails.filter(e => e.is_public !== true);

	document.getElementById("totalCount").textContent = total;
	document.getElementById("publicCount").textContent = publicEmails.length;
	document.getElementById("privateCount").textContent = privateEmails.length;

	const body = document.getElementById("emailsBody");

	if(!emails.length){
		body.innerHTML = '<tr><td colspan="6" class="muted">No emails found.</td></tr>';
		return;
	}

	body.innerHTML = emails.map(email => {
		const id = escapeForHtml(email.id);
		const from = escapeForHtml(email.from_address);
		const to = escapeForHtml(email.to_address);
		const subject = escapeForHtml(email.subject || "(No subject)");
		const received = escapeForHtml(formatDate(email.received_at));

		const visibility = email.is_public
			? '<span class="badge public">PUBLIC</span>'
			: '<span class="badge private">PRIVATE</span>';

		let actions = "";

		if(email.is_public){
			actions += '<button class="small warning" onclick="makePrivate(\\'' + id + '\\')">Make Private</button>';
		}else{
			actions += '<button class="small success" onclick="makePublicOnly(\\'' + id + '\\')">Make Public</button>';
			actions += '<button class="small" onclick="openRuleModal(\\'' + id + '\\', \\''
				+ escapeForJs(email.from_address || "")
				+ '\\', \\''
				+ escapeForJs(email.subject || "")
				+ '\\')">Public + Future Similar</button>';
		}

		actions += '<button class="small danger" onclick="deleteEmail(\\'' + id + '\\')">Delete</button>';

		return '<tr>' +
			'<td>' + from + '</td>' +
			'<td>' + to + '</td>' +
			'<td>' + subject + '</td>' +
			'<td>' + received + '</td>' +
			'<td>' + visibility + '</td>' +
			'<td><div class="actions">' + actions + '</div></td>' +
		'</tr>';
	}).join("");
}

function escapeForHtml(value){
	return String(value ?? "")
		.replace(/&/g,"&amp;")
		.replace(/</g,"&lt;")
		.replace(/>/g,"&gt;")
		.replace(/"/g,"&quot;")
		.replace(/'/g,"&#039;");
}

function escapeForJs(value){
	return String(value ?? "")
		.replace(/\\\\/g,"\\\\\\\\")
		.replace(/'/g,"\\\\'")
		.replace(/\\n/g," ")
		.replace(/\\r/g," ");
}

async function makePublicOnly(id){
	try{
		await api("/admin/emails/" + encodeURIComponent(id) + "/visibility", {
			method:"PATCH",
			headers:{"Content-Type":"application/json"},
			body:JSON.stringify({is_public:true})
		});

		showMessage("Email is now public.");
		await loadEmails();
	}catch(error){
		showMessage(error.message,"error");
	}
}

async function makePrivate(id){
	try{
		await api("/admin/emails/" + encodeURIComponent(id) + "/visibility", {
			method:"PATCH",
			headers:{"Content-Type":"application/json"},
			body:JSON.stringify({is_public:false})
		});

		showMessage("Email is now private.");
		await loadEmails();
	}catch(error){
		showMessage(error.message,"error");
	}
}

function openRuleModal(id, sender, subject){
	selectedEmailId = id;

	document.getElementById("modalSender").value = sender;

	// Use the full subject as the initial suggestion.
	// User can shorten it to a stable phrase such as "promotion".
	document.getElementById("modalSubject").value = subject;

	document.getElementById("ruleModal").classList.add("show");
	document.getElementById("modalSubject").focus();
}

function closeRuleModal(){
	selectedEmailId = "";
	document.getElementById("ruleModal").classList.remove("show");
}

async function confirmRule(){
	const sender = document.getElementById("modalSender").value.trim();
	const subjectPattern = document.getElementById("modalSubject").value.trim();

	if(!sender || !subjectPattern){
		showMessage("Sender and subject phrase are required.","error");
		return;
	}

	try{
		// First make the selected email public.
		await api("/admin/emails/" + encodeURIComponent(selectedEmailId) + "/visibility", {
			method:"PATCH",
			headers:{"Content-Type":"application/json"},
			body:JSON.stringify({is_public:true})
		});

		// Then create the global rule.
		await api("/admin/rules", {
			method:"POST",
			headers:{"Content-Type":"application/json"},
			body:JSON.stringify({
				sender_pattern: sender,
				subject_pattern: subjectPattern
			})
		});

		closeRuleModal();
		showMessage("Email is public and the future-matching rule was created.");
		await refreshAll();
	}catch(error){
		showMessage(error.message,"error");
	}
}

async function deleteEmail(id){
	if(!confirm("Delete this email permanently?")) return;

	try{
		await api("/admin/emails/" + encodeURIComponent(id), {
			method:"DELETE"
		});

		showMessage("Email deleted.");
		await loadEmails();
	}catch(error){
		showMessage(error.message,"error");
	}
}

async function loadRules(){
	const data = await api("/admin/rules");
	const rules = data?.data || data || [];

	const container = document.getElementById("rulesList");

	if(!rules.length){
		container.innerHTML = '<div class="muted">No automatic rules configured.</div>';
		return;
	}

	container.innerHTML = rules.map(rule => {
		return '<div class="rule">' +
			'<strong>Public Rule</strong>' +
			'<div><span class="muted">Sender:</span> ' + escapeForHtml(rule.sender_pattern) + '</div>' +
			'<div><span class="muted">Subject contains:</span> ' + escapeForHtml(rule.subject_pattern) + '</div>' +
			'<div><span class="muted">Created:</span> ' + escapeForHtml(formatDate(rule.created_at)) + '</div>' +
			'<br>' +
			'<button class="small danger" onclick="deleteRule(\\'' + escapeForHtml(rule.id) + '\\')">Delete Rule</button>' +
		'</div>';
	}).join("");
}

async function addRule(){
	const sender = document.getElementById("newRuleSender").value.trim();
	const subjectPattern = document.getElementById("newRuleSubject").value.trim();

	if(!sender || !subjectPattern){
		showMessage("Sender and subject phrase are required.","error");
		return;
	}

	try{
		await api("/admin/rules", {
			method:"POST",
			headers:{"Content-Type":"application/json"},
			body:JSON.stringify({
				sender_pattern: sender,
				subject_pattern: subjectPattern
			})
		});

		document.getElementById("newRuleSender").value = "";
		document.getElementById("newRuleSubject").value = "";

		showMessage("Automatic public rule added.");
		await loadRules();
	}catch(error){
		showMessage(error.message,"error");
	}
}

async function deleteRule(id){
	if(!confirm("Delete this automatic public rule?")) return;

	try{
		await api("/admin/rules/" + encodeURIComponent(id), {
			method:"DELETE"
		});

		showMessage("Rule deleted.");
		await loadRules();
	}catch(error){
		showMessage(error.message,"error");
	}
}

async function refreshAll(){
	try{
		await Promise.all([
			loadEmails(),
			loadRules()
		]);
	}catch(error){
		showMessage(error.message,"error");
	}
}

document.getElementById("loginBtn").addEventListener("click", login);
document.getElementById("tokenInput").addEventListener("keydown", e => {
	if(e.key === "Enter") login();
});
document.getElementById("logoutBtn").addEventListener("click", logout);
document.getElementById("refreshBtn").addEventListener("click", refreshAll);
document.getElementById("addRuleBtn").addEventListener("click", addRule);
document.getElementById("confirmRuleBtn").addEventListener("click", confirmRule);
document.getElementById("cancelRuleBtn").addEventListener("click", closeRuleModal);
</script>

</body>
</html>`;

	return c.html(html);
});

/* =========================================================
   ADMIN EMAIL LIST
========================================================= */

adminRoutes.get("/admin/emails", async (c) => {
	if (!isAuthorized(c)) {
		return c.json({ error: { message: "Unauthorized" } }, 401);
	}

	try {
		const result = await c.env.D1
			.prepare(
				`SELECT
					id,
					from_address,
					to_address,
					subject,
					received_at,
					has_attachments,
					attachment_count,
					is_public
				FROM emails
				ORDER BY received_at DESC
				LIMIT 500`,
			)
			.all();

		const emails = result.results.map((row: any) => ({
			...row,
			has_attachments: Boolean(row.has_attachments),
			is_public: Boolean(row.is_public),
		}));

		return c.json(emails);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return c.json({ error: { message } }, 500);
	}
});

/* =========================================================
   CHANGE EMAIL VISIBILITY
========================================================= */

adminRoutes.patch("/admin/emails/:emailId/visibility", async (c) => {
	if (!isAuthorized(c)) {
		return c.json({ error: { message: "Unauthorized" } }, 401);
	}

	const emailId = c.req.param("emailId");

	try {
		const body = await c.req.json();

		if (typeof body.is_public !== "boolean") {
			return c.json(
				{ error: { message: "is_public must be a boolean" } },
				400,
			);
		}

		const result = await c.env.D1
			.prepare(
				`UPDATE emails
				 SET is_public = ?
				 WHERE id = ?`,
			)
			.bind(body.is_public ? 1 : 0, emailId)
			.run();

		if (!result.success) {
			return c.json(
				{ error: { message: "Failed to update email visibility" } },
				500,
			);
		}

		return c.json({
			success: true,
			id: emailId,
			is_public: body.is_public,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return c.json({ error: { message } }, 500);
	}
});

/* =========================================================
   DELETE EMAIL
========================================================= */

adminRoutes.delete("/admin/emails/:emailId", async (c) => {
	if (!isAuthorized(c)) {
		return c.json({ error: { message: "Unauthorized" } }, 401);
	}

	const emailId = c.req.param("emailId");

	try {
		const dbService = createDatabaseService(c.env.D1);
		const result = await dbService.deleteEmailById(emailId);

		if (!result.success) {
			return c.json(
				{ error: { message: result.error?.message || "Failed to delete email" } },
				500,
			);
		}

		return c.json({
			success: true,
			id: emailId,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return c.json({ error: { message } }, 500);
	}
});

/* =========================================================
   LIST VISIBILITY RULES
========================================================= */

adminRoutes.get("/admin/rules", async (c) => {
	if (!isAuthorized(c)) {
		return c.json({ error: { message: "Unauthorized" } }, 401);
	}

	try {
		const result = await c.env.D1
			.prepare(
				`SELECT
					id,
					sender_pattern,
					subject_pattern,
					action,
					created_at
				FROM email_visibility_rules
				ORDER BY created_at DESC`,
			)
			.all();

		return c.json(result.results);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return c.json({ error: { message } }, 500);
	}
});

/* =========================================================
   CREATE VISIBILITY RULE
========================================================= */

adminRoutes.post("/admin/rules", async (c) => {
	if (!isAuthorized(c)) {
		return c.json({ error: { message: "Unauthorized" } }, 401);
	}

	try {
		const body = await c.req.json();

		const senderPattern = String(body.sender_pattern || "").trim();
		const subjectPattern = String(body.subject_pattern || "").trim();

		if (!senderPattern) {
			return c.json(
				{ error: { message: "sender_pattern is required" } },
				400,
			);
		}

		if (!subjectPattern) {
			return c.json(
				{ error: { message: "subject_pattern is required" } },
				400,
			);
		}

		if (senderPattern.length > 320) {
			return c.json(
				{ error: { message: "sender_pattern is too long" } },
				400,
			);
		}

		if (subjectPattern.length > 500) {
			return c.json(
				{ error: { message: "subject_pattern is too long" } },
				400,
			);
		}

		/*
		 * Prevent duplicate rules.
		 * Matching is case-insensitive.
		 */
		const existing = await c.env.D1
			.prepare(
				`SELECT id
				 FROM email_visibility_rules
				 WHERE action = 'public'
				   AND LOWER(sender_pattern) = LOWER(?)
				   AND LOWER(subject_pattern) = LOWER(?)
				 LIMIT 1`,
			)
			.bind(senderPattern, subjectPattern)
			.first();

		if (existing) {
			return c.json({
				success: true,
				existing: true,
				id: existing.id,
			});
		}

		const ruleId = crypto.randomUUID();
		const createdAt = Date.now();

		const result = await c.env.D1
			.prepare(
				`INSERT INTO email_visibility_rules
					(id, sender_pattern, subject_pattern, action, created_at)
				 VALUES (?, ?, ?, 'public', ?)`,
			)
			.bind(
				ruleId,
				senderPattern,
				subjectPattern,
				createdAt,
			)
			.run();

		if (!result.success) {
			return c.json(
				{ error: { message: "Failed to create rule" } },
				500,
			);
		}

		return c.json({
			success: true,
			id: ruleId,
			sender_pattern: senderPattern,
			subject_pattern: subjectPattern,
			action: "public",
			created_at: createdAt,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return c.json({ error: { message } }, 500);
	}
});

/* =========================================================
   DELETE VISIBILITY RULE
========================================================= */

adminRoutes.delete("/admin/rules/:ruleId", async (c) => {
	if (!isAuthorized(c)) {
		return c.json({ error: { message: "Unauthorized" } }, 401);
	}

	const ruleId = c.req.param("ruleId");

	try {
		const result = await c.env.D1
			.prepare(
				`DELETE FROM email_visibility_rules
				 WHERE id = ?`,
			)
			.bind(ruleId)
			.run();

		if (!result.success) {
			return c.json(
				{ error: { message: "Failed to delete rule" } },
				500,
			);
		}

		return c.json({
			success: true,
			id: ruleId,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return c.json({ error: { message } }, 500);
	}
});

export default adminRoutes;
