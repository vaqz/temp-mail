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


/* =========================================================
   ADMIN DASHBOARD
========================================================= */

adminRoutes.get("/", async (c) => {
	const url = new URL(c.req.url);
	url.pathname = "/admin";

	return adminRoutes.fetch(
		new Request(url.toString(), c.req.raw),
		c.env,
		c.executionCtx,
	);
});


adminRoutes.get("/admin", async (c) => {
	const html = `<!DOCTYPE html>
<html lang="en">
<head>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">

<title>Vaqz Mobiz Mail Admin</title>

<style>

*{
	box-sizing:border-box;
}

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

h1,
h2{
	margin-top:0;
}

.login{
	max-width:500px;
	margin:80px auto;
}

input,
button{
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

th,
td{
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
	width:min(700px,100%);
	max-height:90vh;
	overflow:auto;
}

.email-viewer{
	width:100%;
	height:520px;
	border:1px solid #dbe2ea;
	border-radius:8px;
	background:white;
}

.email-text{
	white-space:pre-wrap;
	word-break:break-word;
	background:#f8fafc;
	border:1px solid #dbe2ea;
	border-radius:8px;
	padding:15px;
	max-height:520px;
	overflow:auto;
	font-family:Arial,Helvetica,sans-serif;
	font-size:14px;
	line-height:1.5;
}

.email-meta{
	background:#f8fafc;
	border:1px solid #e5e9f2;
	border-radius:8px;
	padding:12px;
	margin-bottom:15px;
}

.email-meta div{
	margin-bottom:5px;
}

.email-meta div:last-child{
	margin-bottom:0;
}

.sync-status{
	font-size:13px;
	color:#64748b;
	margin-top:7px;
}

.rule-grid{
	display:grid;
	grid-template-columns:1fr 1fr;
	gap:10px;
}

@media(max-width:700px){

	.container{
		padding:12px;
	}

	.stats{
		grid-template-columns:1fr;
	}

	.actions{
		flex-direction:column;
	}

	button{
		width:100%;
	}

	.email-viewer{
		height:400px;
	}

	.rule-grid{
		grid-template-columns:1fr;
	}

}

</style>

</head>

<body>


<div id="loginScreen" class="login card">

	<h1>Vaqz Mobiz Mail Admin</h1>

	<p class="muted">
		Administrator access
	</p>

	<div
		id="loginMessage"
		class="message"
	></div>

	<input
		id="tokenInput"
		type="password"
		placeholder="Admin token"
	>

	<br><br>

	<button id="loginBtn">
		Login
	</button>

</div>


<div
	id="app"
	class="container"
	style="display:none"
>


	<div class="card">

		<div
			class="row"
			style="justify-content:space-between;flex-wrap:wrap"
		>

			<div>

				<h1>
					Mail Administration
				</h1>

				<div class="muted">
					Manage public email visibility and automatic rules.
				</div>

			</div>


			<div class="actions">

				<button
					id="syncBtn"
					class="success"
				>
					Sync Mailboxes
				</button>

				<button
					id="refreshBtn"
					class="secondary"
				>
					Refresh
				</button>

				<button
					id="logoutBtn"
					class="danger"
				>
					Logout
				</button>

			</div>

		</div>


		<div
			id="syncStatus"
			class="sync-status"
		></div>

	</div>


	<div
		id="globalMessage"
		class="message"
	></div>


	<div class="stats">

		<div class="stat">

			<span class="muted">
				Total Emails
			</span>

			<strong id="totalCount">
				0
			</strong>

		</div>


		<div class="stat">

			<span class="muted">
				Public
			</span>

			<strong id="publicCount">
				0
			</strong>

		</div>


		<div class="stat">

			<span class="muted">
				Private
			</span>

			<strong id="privateCount">
				0
			</strong>

		</div>

	</div>


	<div class="card">

		<h2>
			Automatic Public Rules
		</h2>

		<p class="muted">
			Emails matching the configured sender, recipient,
			and subject conditions will automatically become public.
			Leave Sender blank to allow any sender.
			Leave Recipient blank to apply the rule to all mailboxes.
		</p>


		<div
			class="card"
			style="background:#f8fafc;margin:15px 0;box-shadow:none"
		>

			<div class="rule-grid">

				<div>

					<label class="muted">
						Sender
					</label>

					<input
						id="newRuleSender"
						placeholder="sender@example.com (optional)"
					>

				</div>


				<div>

					<label class="muted">
						Recipient
					</label>

					<input
						id="newRuleRecipient"
						placeholder="mailbox@vaqzmobiz.com (optional)"
					>

				</div>


				<div style="grid-column:1 / -1">

					<label class="muted">
						Subject contains
					</label>

					<input
						id="newRuleSubject"
						placeholder="promotion"
					>

				</div>

			</div>

			<br>

			<button
				id="addRuleBtn"
				class="success"
			>
				Add Public Rule
			</button>

		</div>


		<div id="rulesList">

			<div class="muted">
				Loading rules...
			</div>

		</div>

	</div>


	<div class="card">

		<h2>
			Emails
		</h2>

		<div class="muted">
			Public emails are visible through the public mailbox API.
		</div>

		<br>

		<div class="table-wrap">

			<table>

				<thead>

					<tr>

						<th>
							From
						</th>

						<th>
							To
						</th>

						<th>
							Subject
						</th>

						<th>
							Received
						</th>

						<th>
							Visibility
						</th>

						<th>
							Actions
						</th>

					</tr>

				</thead>


				<tbody id="emailsBody">

					<tr>

						<td
							colspan="6"
							class="muted"
						>
							Loading...
						</td>

					</tr>

				</tbody>

			</table>

		</div>

	</div>

</div>


<!-- RULE MODAL -->

<div
	id="ruleModal"
	class="modal"
>

	<div class="modal-box">

		<h2>
			Make Public + Future Similar
		</h2>

		<p class="muted">
			This email will become public, and future emails matching
			the same sender, recipient, and subject phrase will
			automatically become public.
		</p>


		<label class="muted">
			Sender
		</label>

		<input
			id="modalSender"
			readonly
		>


		<br><br>


		<label class="muted">
			Recipient
		</label>

		<input
			id="modalRecipient"
			readonly
		>


		<br><br>


		<label class="muted">
			Subject keyword / phrase
		</label>

		<input
			id="modalSubject"
			placeholder="e.g. promotion"
		>


		<p class="muted">
			Use a stable phrase such as
			<b>promotion</b>,
			<b>special offer</b>,
			or
			<b>newsletter</b>.
		</p>


		<div class="actions">

			<button
				id="confirmRuleBtn"
				class="success"
			>
				Make Public & Create Rule
			</button>

			<button
				id="cancelRuleBtn"
				class="secondary"
			>
				Cancel
			</button>

		</div>

	</div>

</div>


<!-- EMAIL VIEWER MODAL -->

<div
	id="emailModal"
	class="modal"
>

	<div class="modal-box">

		<h2>
			Email
		</h2>

		<div
			id="emailMeta"
			class="email-meta"
		></div>

		<div id="emailContent"></div>

		<br>

		<div class="actions">

			<button
				id="closeEmailBtn"
				class="secondary"
			>
				Close
			</button>

		</div>

	</div>

</div>


<script>

let token = "";
let selectedEmailId = "";


/* =========================================================
   UI HELPERS
========================================================= */

function showMessage(text, type){

	const el =
		document.getElementById("globalMessage");

	el.textContent =
		String(text || "");

	el.className =
		"message " +
		(type || "ok");

	setTimeout(function(){

		el.className = "message";

	}, 4000);
}


function showLoginMessage(text){

	const el =
		document.getElementById("loginMessage");

	el.textContent =
		String(text || "");

	el.className =
		"message error";
}


/* =========================================================
   HTML ESCAPING
   No regular expressions are used here.
========================================================= */

function escapeHtml(value){

	return String(value == null ? "" : value)
		.split("&").join("&amp;")
		.split("<").join("&lt;")
		.split(">").join("&gt;")
		.split('"').join("&quot;")
		.split("'").join("&#039;");
}


/* =========================================================
   API
========================================================= */

async function api(path, options){

	const requestOptions =
		options || {};

	const headers =
		Object.assign(
			{
				"Authorization":
					"Bearer " + token
			},
			requestOptions.headers || {}
		);

	const response =
		await fetch(
			path,
			Object.assign(
				{},
				requestOptions,
				{
					headers:headers
				}
			)
		);

	let data = null;

	try{

		data =
			await response.json();

	}catch(error){

		data = null;
	}


	if(response.status === 401){

		logout();

		throw new Error(
			"Unauthorized"
		);
	}


	if(!response.ok){

		throw new Error(
			(
				data &&
				data.error &&
				data.error.message
			) ||
			(
				data &&
				data.message
			) ||
			"Request failed"
		);
	}


	return data;
}


/* =========================================================
   LOGIN
========================================================= */

async function login(){

	const input =
		document.getElementById(
			"tokenInput"
		);

	const value =
		input.value.trim();


	if(!value){

		showLoginMessage(
			"Please enter the admin token."
		);

		return;
	}


	token = value;


	try{

		await api(
			"/admin/emails"
		);


		document
			.getElementById("loginScreen")
			.style.display = "none";


		document
			.getElementById("app")
			.style.display = "block";


		await refreshAll();


	}catch(error){

		token = "";

		showLoginMessage(
			error.message ||
			"Invalid admin token."
		);
	}
}


function logout(){

	token = "";

	document
		.getElementById("app")
		.style.display = "none";

	document
		.getElementById("loginScreen")
		.style.display = "block";

	document
		.getElementById("tokenInput")
		.value = "";
}


/* =========================================================
   DATE
========================================================= */

function formatDate(value){

	if(
		value === null ||
		value === undefined ||
		value === ""
	){

		return "-";
	}


	const numeric =
		Number(value);


	if(!Number.isFinite(numeric)){

		return String(value);
	}


	const milliseconds =
		numeric < 100000000000
			? numeric * 1000
			: numeric;


	const date =
		new Date(milliseconds);


	if(
		Number.isNaN(
			date.getTime()
		)
	){

		return String(value);
	}


	return date.toLocaleString();
}


/* =========================================================
   LOAD EMAILS
========================================================= */

async function loadEmails(){

	const data =
		await api(
			"/admin/emails"
		);


	const emails =
		(
			data &&
			data.data
		) ||
		data ||
		[];


	const publicEmails =
		emails.filter(
			function(email){
				return email.is_public === true;
			}
		);


	const privateEmails =
		emails.filter(
			function(email){
				return email.is_public !== true;
			}
		);


	document
		.getElementById("totalCount")
		.textContent =
			String(emails.length);


	document
		.getElementById("publicCount")
		.textContent =
			String(publicEmails.length);


	document
		.getElementById("privateCount")
		.textContent =
			String(privateEmails.length);


	const body =
		document.getElementById(
			"emailsBody"
		);


	body.innerHTML = "";


	if(!emails.length){

		const row =
			document.createElement("tr");

		const cell =
			document.createElement("td");

		cell.colSpan = 6;

		cell.className =
			"muted";

		cell.textContent =
			"No emails found.";

		row.appendChild(cell);

		body.appendChild(row);

		return;
	}


	emails.forEach(
		function(email){

			const row =
				document.createElement("tr");


			const fromCell =
				document.createElement("td");

			fromCell.textContent =
				String(
					email.from_address || ""
				);


			const toCell =
				document.createElement("td");

			toCell.textContent =
				String(
					email.to_address || ""
				);


			const subjectCell =
				document.createElement("td");

			subjectCell.textContent =
				String(
					email.subject ||
					"(No subject)"
				);


			const receivedCell =
				document.createElement("td");

			receivedCell.textContent =
				formatDate(
					email.received_at
				);


			const visibilityCell =
				document.createElement("td");


			const badge =
				document.createElement("span");

			badge.className =
				email.is_public
					? "badge public"
					: "badge private";

			badge.textContent =
				email.is_public
					? "PUBLIC"
					: "PRIVATE";


			visibilityCell.appendChild(
				badge
			);


			const actionsCell =
				document.createElement("td");


			const actions =
				document.createElement("div");

			actions.className =
				"actions";


			/* READ */

			const readButton =
				document.createElement("button");

			readButton.className =
				"small";

			readButton.textContent =
				"Read";

			readButton.addEventListener(
				"click",
				function(){

					openEmail(
						email.id
					);

				}
			);

			actions.appendChild(
				readButton
			);


			/* PUBLIC / PRIVATE */

			if(email.is_public){

				const privateButton =
					document.createElement("button");

				privateButton.className =
					"small warning";

				privateButton.textContent =
					"Make Private";

				privateButton.addEventListener(
					"click",
					function(){

						makePrivate(
							email.id
						);

					}
				);

				actions.appendChild(
					privateButton
				);


			}else{

				const publicButton =
					document.createElement("button");

				publicButton.className =
					"small success";

				publicButton.textContent =
					"Make Public";

				publicButton.addEventListener(
					"click",
					function(){

						makePublicOnly(
							email.id
						);

					}
				);

				actions.appendChild(
					publicButton
				);


				const futureButton =
					document.createElement("button");

				futureButton.className =
					"small";

				futureButton.textContent =
					"Public + Future Similar";

				futureButton.addEventListener(
					"click",
					function(){

						openRuleModal(
							email.id,
							email.from_address || "",
							email.to_address || "",
							email.subject || ""
						);

					}
				);

				actions.appendChild(
					futureButton
				);

			}


			/* DELETE */

			const deleteButton =
				document.createElement("button");

			deleteButton.className =
				"small danger";

			deleteButton.textContent =
				"Delete";

			deleteButton.addEventListener(
				"click",
				function(){

					deleteEmail(
						email.id
					);

				}
			);

			actions.appendChild(
				deleteButton
			);


			actionsCell.appendChild(
				actions
			);


			row.appendChild(
				fromCell
			);

			row.appendChild(
				toCell
			);

			row.appendChild(
				subjectCell
			);

			row.appendChild(
				receivedCell
			);

			row.appendChild(
				visibilityCell
			);

			row.appendChild(
				actionsCell
			);


			body.appendChild(
				row
			);

		}
	);
}


/* =========================================================
   READ EMAIL
========================================================= */

async function openEmail(id){

	try{

		const data =
			await api(
				"/admin/emails/" +
				encodeURIComponent(id)
			);


		const email =
			(
				data &&
				data.data
			) ||
			data;


		if(!email){

			throw new Error(
				"Email not found."
			);
		}


		const meta =
			document.getElementById(
				"emailMeta"
			);


		meta.innerHTML = "";


		const fields = [
			[
				"From:",
				email.from_address
			],
			[
				"To:",
				email.to_address
			],
			[
				"Subject:",
				email.subject ||
				"(No subject)"
			],
			[
				"Received:",
				formatDate(
					email.received_at
				)
			],
			[
				"Attachments:",
				String(
					email.attachment_count || 0
				)
			]
		];


		fields.forEach(
			function(field){

				const div =
					document.createElement("div");

				const strong =
					document.createElement("b");

				strong.textContent =
					field[0] + " ";

				div.appendChild(
					strong
				);

				const value =
					document.createTextNode(
						String(
							field[1] || ""
						)
					);

				div.appendChild(
					value
				);

				meta.appendChild(
					div
				);

			}
		);


		const content =
			document.getElementById(
				"emailContent"
			);


		content.innerHTML = "";


		if(
			email.html_content &&
			String(
				email.html_content
			).trim()
		){

			const iframe =
				document.createElement(
					"iframe"
				);


			iframe.className =
				"email-viewer";


			iframe.setAttribute(
				"sandbox",
				""
			);


			iframe.setAttribute(
				"referrerpolicy",
				"no-referrer"
			);


			iframe.srcdoc =
				String(
					email.html_content
				);


			content.appendChild(
				iframe
			);


		}else if(
			email.text_content &&
			String(
				email.text_content
			).trim()
		){

			const pre =
				document.createElement(
					"pre"
				);


			pre.className =
				"email-text";


			pre.textContent =
				String(
					email.text_content
				);


			content.appendChild(
				pre
			);


		}else{

			const empty =
				document.createElement(
					"div"
				);


			empty.className =
				"muted";


			empty.textContent =
				"No message content available.";


			content.appendChild(
				empty
			);
		}


		document
			.getElementById("emailModal")
			.classList.add("show");


	}catch(error){

		showMessage(
			error.message ||
			"Failed to open email.",
			"error"
		);
	}
}


function closeEmail(){

	document
		.getElementById("emailModal")
		.classList.remove("show");


	document
		.getElementById("emailContent")
		.innerHTML = "";


	document
		.getElementById("emailMeta")
		.innerHTML = "";
}


/* =========================================================
   EMAIL VISIBILITY
========================================================= */

async function makePublicOnly(id){

	try{

		await api(
			"/admin/emails/" +
			encodeURIComponent(id) +
			"/visibility",
			{
				method:"PATCH",

				headers:{
					"Content-Type":
						"application/json"
				},

				body:JSON.stringify({
					is_public:true
				})
			}
		);


		showMessage(
			"Email is now public."
		);


		await loadEmails();


	}catch(error){

		showMessage(
			error.message,
			"error"
		);
	}
}


async function makePrivate(id){

	try{

		await api(
			"/admin/emails/" +
			encodeURIComponent(id) +
			"/visibility",
			{
				method:"PATCH",

				headers:{
					"Content-Type":
						"application/json"
				},

				body:JSON.stringify({
					is_public:false
				})
			}
		);


		showMessage(
			"Email is now private."
		);


		await loadEmails();


	}catch(error){

		showMessage(
			error.message,
			"error"
		);
	}
}


/* =========================================================
   RULE MODAL
========================================================= */

function openRuleModal(
	id,
	sender,
	recipient,
	subject
){

	selectedEmailId =
		String(id || "");


	document.getElementById(
		"modalSender"
	).value =
		String(sender || "");


	document.getElementById(
		"modalRecipient"
	).value =
		String(recipient || "");


	document.getElementById(
		"modalSubject"
	).value =
		String(subject || "");


	document
		.getElementById("ruleModal")
		.classList.add("show");


	document
		.getElementById("modalSubject")
		.focus();
}


function closeRuleModal(){

	selectedEmailId = "";


	document
		.getElementById("ruleModal")
		.classList.remove("show");
}


/* =========================================================
   CREATE RULE FROM EMAIL
========================================================= */

async function confirmRule(){

	const sender =
		document
			.getElementById("modalSender")
			.value
			.trim();


	const recipient =
		document
			.getElementById("modalRecipient")
			.value
			.trim();


	const subjectPattern =
		document
			.getElementById("modalSubject")
			.value
			.trim();


	if(
		!sender ||
		!recipient ||
		!subjectPattern
	){

		showMessage(
			"Sender, recipient and subject phrase are required.",
			"error"
		);

		return;
	}


	try{

		await api(
			"/admin/emails/" +
			encodeURIComponent(
				selectedEmailId
			) +
			"/visibility",
			{
				method:"PATCH",

				headers:{
					"Content-Type":
						"application/json"
				},

				body:JSON.stringify({
					is_public:true
				})
			}
		);


		await api(
			"/admin/rules",
			{
				method:"POST",

				headers:{
					"Content-Type":
						"application/json"
				},

				body:JSON.stringify({
					sender_pattern:
						sender,

					recipient_pattern:
						recipient,

					subject_pattern:
						subjectPattern
				})
			}
		);


		closeRuleModal();


		showMessage(
			"Email is public and the future-matching rule was created."
		);


		await refreshAll();


	}catch(error){

		showMessage(
			error.message,
			"error"
		);
	}
}


/* =========================================================
   DELETE EMAIL
========================================================= */

async function deleteEmail(id){

	if(
		!confirm(
			"Delete this email permanently?"
		)
	){

		return;
	}


	try{

		await api(
			"/admin/emails/" +
			encodeURIComponent(id),
			{
				method:"DELETE"
			}
		);


		showMessage(
			"Email deleted."
		);


		await loadEmails();


	}catch(error){

		showMessage(
			error.message,
			"error"
		);
	}
}


/* =========================================================
   LOAD RULES
========================================================= */

async function loadRules(){

	const data =
		await api(
			"/admin/rules"
		);


	const rules =
		(
			data &&
			data.data
		) ||
		data ||
		[];


	const container =
		document.getElementById(
			"rulesList"
		);


	container.innerHTML = "";


	if(!rules.length){

		const empty =
			document.createElement("div");

		empty.className =
			"muted";

		empty.textContent =
			"No automatic rules configured.";

		container.appendChild(
			empty
		);

		return;
	}


	rules.forEach(
		function(rule){

			const box =
				document.createElement("div");

			box.className =
				"rule";


			const title =
				document.createElement("strong");

			title.textContent =
				"Public Rule";


			box.appendChild(
				title
			);


			const sender =
				document.createElement("div");

			sender.textContent =
				"Sender: " +
				String(
					rule.sender_pattern ||
					"All senders"
				);


			box.appendChild(
				sender
			);


			const recipient =
				document.createElement("div");

			recipient.textContent =
				"Recipient: " +
				String(
					rule.recipient_pattern ||
					"All mailboxes"
				);


			box.appendChild(
				recipient
			);


			const subject =
				document.createElement("div");

			subject.textContent =
				"Subject contains: " +
				String(
					rule.subject_pattern || ""
				);


			box.appendChild(
				subject
			);


			const created =
				document.createElement("div");

			created.textContent =
				"Created: " +
				formatDate(
					rule.created_at
				);


			box.appendChild(
				created
			);


			const spacer =
				document.createElement("br");

			box.appendChild(
				spacer
			);


			const deleteButton =
				document.createElement("button");

			deleteButton.className =
				"small danger";

			deleteButton.textContent =
				"Delete Rule";


			deleteButton.addEventListener(
				"click",
				function(){

					deleteRule(
						rule.id
					);

				}
			);


			box.appendChild(
				deleteButton
			);


			container.appendChild(
				box
			);

		}
	);
}


/* =========================================================
   ADD RULE
========================================================= */

async function addRule(){

	const sender =
		document
			.getElementById("newRuleSender")
			.value
			.trim();


	const recipient =
		document
			.getElementById("newRuleRecipient")
			.value
			.trim();


	const subjectPattern =
		document
			.getElementById("newRuleSubject")
			.value
			.trim();


	if(!subjectPattern){

		showMessage(
			"Subject phrase is required.",
			"error"
		);

		return;
	}


	try{

		await api(
			"/admin/rules",
			{
				method:"POST",

				headers:{
					"Content-Type":
						"application/json"
				},

				body:JSON.stringify({
					sender_pattern:
						sender,

					recipient_pattern:
						recipient || null,

					subject_pattern:
						subjectPattern
				})
			}
		);


		document.getElementById(
			"newRuleSender"
		).value = "";


		document.getElementById(
			"newRuleRecipient"
		).value = "";


		document.getElementById(
			"newRuleSubject"
		).value = "";


		showMessage(
			"Automatic public rule added."
		);


		await loadRules();


	}catch(error){

		showMessage(
			error.message,
			"error"
		);
	}
}


/* =========================================================
   DELETE RULE
========================================================= */

async function deleteRule(id){

	if(
		!confirm(
			"Delete this automatic public rule?"
		)
	){

		return;
	}


	try{

		await api(
			"/admin/rules/" +
			encodeURIComponent(id),
			{
				method:"DELETE"
			}
		);


		showMessage(
			"Rule deleted."
		);


		await loadRules();


	}catch(error){

		showMessage(
			error.message,
			"error"
		);
	}
}


/* =========================================================
   MANUAL MAILBOX SYNC
========================================================= */

async function syncMailboxes(){

	const button =
		document.getElementById(
			"syncBtn"
		);


	const status =
		document.getElementById(
			"syncStatus"
		);


	button.disabled = true;

	button.textContent =
		"Syncing...";


	status.textContent =
		"Synchronizing mailbox accounts from Google Sheets...";


	try{

		const result =
			await api(
				"/admin/sync/mailboxes",
				{
					method:"POST"
				}
			);


		const sync =
			(
				result &&
				result.result
			) ||
			result ||
			{};


		showMessage(
			"Mailbox sync completed successfully."
		);


		status.textContent =
			"Sync completed: " +
			"created " +
			String(
				sync.created == null
					? 0
					: sync.created
			) +
			", updated " +
			String(
				sync.updated == null
					? 0
					: sync.updated
			) +
			", disabled " +
			String(
				sync.disabled == null
					? 0
					: sync.disabled
			) +
			", unchanged " +
			String(
				sync.unchanged == null
					? 0
					: sync.unchanged
			);


	}catch(error){

		showMessage(
			"Mailbox sync failed: " +
			error.message,
			"error"
		);


		status.textContent =
			"Sync failed.";


	}finally{

		button.disabled = false;

		button.textContent =
			"Sync Mailboxes";
	}
}


/* =========================================================
   REFRESH
========================================================= */

async function refreshAll(){

	try{

		await Promise.all([
			loadEmails(),
			loadRules()
		]);


	}catch(error){

		showMessage(
			error.message,
			"error"
		);
	}
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

document
	.getElementById("loginBtn")
	.addEventListener(
		"click",
		login
	);


document
	.getElementById("tokenInput")
	.addEventListener(
		"keydown",
		function(event){

			if(
				event.key === "Enter"
			){

				login();

			}

		}
	);


document
	.getElementById("logoutBtn")
	.addEventListener(
		"click",
		logout
	);


document
	.getElementById("refreshBtn")
	.addEventListener(
		"click",
		refreshAll
	);


document
	.getElementById("syncBtn")
	.addEventListener(
		"click",
		syncMailboxes
	);


document
	.getElementById("addRuleBtn")
	.addEventListener(
		"click",
		addRule
	);


document
	.getElementById("confirmRuleBtn")
	.addEventListener(
		"click",
		confirmRule
	);


document
	.getElementById("cancelRuleBtn")
	.addEventListener(
		"click",
		closeRuleModal
	);


document
	.getElementById("closeEmailBtn")
	.addEventListener(
		"click",
		closeEmail
	);

</script>

</body>
</html>`;

	return c.html(html);
});


/* =========================================================
   ADMIN EMAIL LIST
========================================================= */

adminRoutes.get(
	"/admin/emails",
	async (c) => {

		if (!isAuthorized(c)) {

			return c.json(
				{
					error:{
						message:"Unauthorized"
					}
				},
				401,
			);
		}


		try{

			const result =
				await c.env.D1
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


			const emails =
				result.results.map(
					(row:any) => ({
						...row,

						has_attachments:
							Boolean(
								row.has_attachments
							),

						is_public:
							Boolean(
								row.is_public
							),
					}),
				);


			return c.json(emails);


		}catch(error){

			const message =
				error instanceof Error
					? error.message
					: String(error);


			return c.json(
				{
					error:{
						message
					}
				},
				500,
			);
		}
	},
);


/* =========================================================
   READ SINGLE EMAIL
========================================================= */

adminRoutes.get(
	"/admin/emails/:emailId",
	async (c) => {

		if (!isAuthorized(c)) {

			return c.json(
				{
					error:{
						message:"Unauthorized"
					}
				},
				401,
			);
		}


		const emailId =
			c.req.param("emailId");


		try{

			const result =
				await c.env.D1
					.prepare(
						`SELECT
							id,
							from_address,
							to_address,
							subject,
							received_at,
							html_content,
							text_content,
							has_attachments,
							attachment_count,
							is_public
						FROM emails
						WHERE id = ?
						LIMIT 1`,
					)
					.bind(emailId)
					.first();


			if(!result){

				return c.json(
					{
						error:{
							message:
								"Email not found"
						}
					},
					404,
				);
			}


			return c.json({

				...result,

				has_attachments:
					Boolean(
						(result as any)
							.has_attachments
					),

				is_public:
					Boolean(
						(result as any)
							.is_public
					),

			});


		}catch(error){

			const message =
				error instanceof Error
					? error.message
					: String(error);


			return c.json(
				{
					error:{
						message
					}
				},
				500,
			);
		}
	},
);


/* =========================================================
   CHANGE EMAIL VISIBILITY
========================================================= */

adminRoutes.patch(
	"/admin/emails/:emailId/visibility",
	async (c) => {

		if (!isAuthorized(c)) {

			return c.json(
				{
					error:{
						message:"Unauthorized"
					}
				},
				401,
			);
		}


		const emailId =
			c.req.param("emailId");


		try{

			const body =
				await c.req.json();


			if(
				typeof body.is_public !==
				"boolean"
			){

				return c.json(
					{
						error:{
							message:
								"is_public must be a boolean"
						}
					},
					400,
				);
			}


			const result =
				await c.env.D1
					.prepare(
						`UPDATE emails
						 SET is_public = ?
						 WHERE id = ?`,
					)
					.bind(
						body.is_public
							? 1
							: 0,
						emailId,
					)
					.run();


			if(!result.success){

				return c.json(
					{
						error:{
							message:
								"Failed to update email visibility"
						}
					},
					500,
				);
			}


			return c.json({
				success:true,
				id:emailId,
				is_public:
					body.is_public,
			});


		}catch(error){

			const message =
				error instanceof Error
					? error.message
					: String(error);


			return c.json(
				{
					error:{
						message
					}
				},
				500,
			);
		}
	},
);


/* =========================================================
   DELETE EMAIL
========================================================= */

adminRoutes.delete(
	"/admin/emails/:emailId",
	async (c) => {

		if (!isAuthorized(c)) {

			return c.json(
				{
					error:{
						message:"Unauthorized"
					}
				},
				401,
			);
		}


		const emailId =
			c.req.param("emailId");


		try{

			const dbService =
				createDatabaseService(
					c.env.D1
				);


			const result =
				await dbService.deleteEmailById(
					emailId
				);


			if(!result.success){

				return c.json(
					{
						error:{
							message:
								result.error?.message ||
								"Failed to delete email"
						}
					},
					500,
				);
			}


			return c.json({
				success:true,
				id:emailId,
			});


		}catch(error){

			const message =
				error instanceof Error
					? error.message
					: String(error);


			return c.json(
				{
					error:{
						message
					}
				},
				500,
			);
		}
	},
);


/* =========================================================
   LIST VISIBILITY RULES
========================================================= */

adminRoutes.get(
	"/admin/rules",
	async (c) => {

		if (!isAuthorized(c)) {

			return c.json(
				{
					error:{
						message:"Unauthorized"
					}
				},
				401,
			);
		}


		try{

			const result =
				await c.env.D1
					.prepare(
						`SELECT
							id,
							sender_pattern,
							recipient_pattern,
							subject_pattern,
							action,
							created_at
						FROM email_visibility_rules
						ORDER BY created_at DESC`,
					)
					.all();


			return c.json(
				result.results
			);


		}catch(error){

			const message =
				error instanceof Error
					? error.message
					: String(error);


			return c.json(
				{
					error:{
						message
					}
				},
				500,
			);
		}
	},
);


/* =========================================================
   CREATE VISIBILITY RULE
========================================================= */

adminRoutes.post(
	"/admin/rules",
	async (c) => {

		if (!isAuthorized(c)) {

			return c.json(
				{
					error:{
						message:"Unauthorized"
					}
				},
				401,
			);
		}


		try{

			const body =
				await c.req.json();


			const senderPattern =
				String(
					body.sender_pattern || ""
				).trim();


			const recipientPattern =
				String(
					body.recipient_pattern || ""
				).trim();


			const subjectPattern =
				String(
					body.subject_pattern || ""
				).trim();


			/*
			 * Sender is optional.
			 *
			 * Blank sender means ANY sender.
			 *
			 * Recipient is also optional.
			 *
			 * Blank recipient means ANY mailbox.
			 *
			 * Subject phrase remains required.
			 */

			if(!subjectPattern){

				return c.json(
					{
						error:{
							message:
								"subject_pattern is required"
						}
					},
					400,
				);
			}


			if(
				senderPattern.length > 320
			){

				return c.json(
					{
						error:{
							message:
								"sender_pattern is too long"
						}
					},
					400,
				);
			}


			if(
				recipientPattern.length > 320
			){

				return c.json(
					{
						error:{
							message:
								"recipient_pattern is too long"
						}
					},
					400,
				);
			}


			if(
				subjectPattern.length > 500
			){

				return c.json(
					{
						error:{
							message:
								"subject_pattern is too long"
						}
					},
					400,
				);
			}


			const existing =
				await c.env.D1
					.prepare(
						`SELECT id
						 FROM email_visibility_rules
						 WHERE action = 'public'
						   AND LOWER(COALESCE(sender_pattern, '')) = LOWER(?)
						   AND LOWER(COALESCE(recipient_pattern, '')) = LOWER(?)
						   AND LOWER(COALESCE(subject_pattern, '')) = LOWER(?)
						 LIMIT 1`,
					)
					.bind(
						senderPattern,
						recipientPattern,
						subjectPattern,
					)
					.first();


			if(existing){

				return c.json({
					success:true,
					existing:true,
					id:
						(existing as any).id,
				});
			}


			const ruleId =
				crypto.randomUUID();


			const createdAt =
				Date.now();


			const result =
				await c.env.D1
					.prepare(
						`INSERT INTO email_visibility_rules
							(
								id,
								sender_pattern,
								recipient_pattern,
								subject_pattern,
								action,
								created_at
							)
						 VALUES (
								?,
								?,
								?,
								?,
								'public',
								?
							)`,
					)
					.bind(
						ruleId,
						senderPattern,
						recipientPattern ||
							null,
						subjectPattern,
						createdAt,
					)
					.run();


			if(!result.success){

				return c.json(
					{
						error:{
							message:
								"Failed to create rule"
						}
					},
					500,
				);
			}


			return c.json({

				success:true,

				id:ruleId,

				sender_pattern:
					senderPattern,

				recipient_pattern:
					recipientPattern ||
					null,

				subject_pattern:
					subjectPattern,

				action:"public",

				created_at:
					createdAt,

			});


		}catch(error){

			const message =
				error instanceof Error
					? error.message
					: String(error);


			return c.json(
				{
					error:{
						message
					}
				},
				500,
			);
		}
	},
);


/* =========================================================
   DELETE VISIBILITY RULE
========================================================= */

adminRoutes.delete(
	"/admin/rules/:ruleId",
	async (c) => {

		if (!isAuthorized(c)) {

			return c.json(
				{
					error:{
						message:"Unauthorized"
					}
				},
				401,
			);
		}


		const ruleId =
			c.req.param("ruleId");


		try{

			const result =
				await c.env.D1
					.prepare(
						`DELETE FROM email_visibility_rules
						 WHERE id = ?`,
					)
					.bind(ruleId)
					.run();


			if(!result.success){

				return c.json(
					{
						error:{
							message:
								"Failed to delete rule"
						}
					},
					500,
				);
			}


			return c.json({
				success:true,
				id:ruleId,
			});


		}catch(error){

			const message =
				error instanceof Error
					? error.message
					: String(error);


			return c.json(
				{
					error:{
						message
					}
				},
				500,
			);
		}
	},
);


/* =========================================================
   MANUAL MAILBOX SYNC
========================================================= */

adminRoutes.post(
	"/admin/sync/mailboxes",
	async (c) => {

		if (!isAuthorized(c)) {

			return c.json(
				{
					error:{
						message:"Unauthorized"
					}
				},
				401,
			);
		}


		try{

			const env =
				c.env as CloudflareBindings & {
					MANUAL_SYNC_SCRIPT_URL?: string;
					MANUAL_SYNC_SECRET?: string;
				};


			const scriptUrl =
				env.MANUAL_SYNC_SCRIPT_URL;


			const secret =
				env.MANUAL_SYNC_SECRET;


			if(!scriptUrl){

				return c.json(
					{
						error:{
							message:
								"MANUAL_SYNC_SCRIPT_URL is not configured."
						}
					},
					500,
				);
			}


			if(!secret){

				return c.json(
					{
						error:{
							message:
								"MANUAL_SYNC_SECRET is not configured."
						}
					},
					500,
				);
			}


			const response =
				await fetch(
					scriptUrl,
					{
						method:"POST",

						headers:{
							"Content-Type":
								"application/json"
						},

						body:
							JSON.stringify({
								secret:secret
							}),
					},
				);


			const responseText =
				await response.text();


			if(!response.ok){

				return c.json(
					{
						error:{
							message:
								"Google Apps Script sync failed. HTTP " +
								response.status
						}
					},
					502,
				);
			}


			let result:any;


			try{

				result =
					JSON.parse(
						responseText
					);

			}catch(error){

				return c.json(
					{
						error:{
							message:
								"Google Apps Script returned an invalid response."
						}
					},
					502,
				);
			}


			if(
				result &&
				result.success === false
			){

				return c.json(
					{
						error:{
							message:
								result.error ||
								"Mailbox sync failed."
						}
					},
					502,
				);
			}


			return c.json({

				success:true,

				result:
					result &&
					result.result != null
						? result.result
						: result,

			});


		}catch(error){

			const message =
				error instanceof Error
					? error.message
					: String(error);


			return c.json(
				{
					error:{
						message:
							"Mailbox sync failed: " +
							message
					}
				},
				500,
			);
		}
	},
);


export default adminRoutes;
