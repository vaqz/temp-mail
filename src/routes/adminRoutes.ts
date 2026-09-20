import { Hono } from "hono";
import { createDatabaseService } from "@/database";
import { ERR, OK } from "@/utils/http";

const adminRoutes = new Hono<{ Bindings: CloudflareBindings }>();

function isAuthorized(c: any): boolean {
	const authorization = c.req.header("Authorization");
	const adminToken = c.env.ADMIN_TOKEN;

	if (!authorization || !adminToken) {
		return false;
	}

	if (!authorization.startsWith("Bearer ")) {
		return false;
	}

	const token = authorization.slice(7).trim();

	return token === adminToken;
}

/**
 * Admin dashboard
 */
adminRoutes.get("/admin", async (c) => {
	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Vaqz Mobiz — Admin</title>
	<style>
		* {
			box-sizing: border-box;
		}

		body {
			margin: 0;
			font-family: Arial, Helvetica, sans-serif;
			background: #f5f7fb;
			color: #172033;
		}

		.container {
			max-width: 1100px;
			margin: 0 auto;
			padding: 30px 20px;
		}

		.header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			gap: 20px;
			margin-bottom: 24px;
		}

		.logo {
			font-size: 22px;
			font-weight: 700;
		}

		.subtitle {
			color: #687386;
			font-size: 14px;
			margin-top: 4px;
		}

		.card {
			background: white;
			border: 1px solid #e3e7ee;
			border-radius: 12px;
			padding: 20px;
			box-shadow: 0 2px 8px rgba(0,0,0,.04);
		}

		.login {
			max-width: 500px;
			margin: 70px auto;
		}

		input {
			width: 100%;
			padding: 12px 14px;
			border: 1px solid #ccd3df;
			border-radius: 8px;
			font-size: 15px;
			outline: none;
		}

		input:focus {
			border-color: #2563eb;
		}

		button {
			border: 0;
			border-radius: 8px;
			padding: 10px 14px;
			font-size: 14px;
			font-weight: 600;
			cursor: pointer;
		}

		.primary {
			background: #2563eb;
			color: white;
		}

		.primary:hover {
			background: #1d4ed8;
		}

		.secondary {
			background: #eef2f7;
			color: #334155;
		}

		.danger {
			background: #fee2e2;
			color: #b91c1c;
		}

		.status {
			margin-top: 12px;
			font-size: 14px;
			color: #687386;
		}

		.error {
			color: #b91c1c;
		}

		.hidden {
			display: none;
		}

		.stats {
			display: flex;
			gap: 12px;
			margin-bottom: 20px;
			flex-wrap: wrap;
		}

		.stat {
			background: white;
			border: 1px solid #e3e7ee;
			border-radius: 10px;
			padding: 15px 18px;
			min-width: 150px;
		}

		.stat-number {
			font-size: 22px;
			font-weight: 700;
		}

		.stat-label {
			color: #687386;
			font-size: 13px;
			margin-top: 3px;
		}

		.table-wrap {
			overflow-x: auto;
		}

		table {
			width: 100%;
			border-collapse: collapse;
			min-width: 800px;
		}

		th {
			text-align: left;
			font-size: 12px;
			text-transform: uppercase;
			letter-spacing: .04em;
			color: #687386;
			background: #f8fafc;
		}

		th, td {
			padding: 13px 12px;
			border-bottom: 1px solid #e8ecf2;
		}

		td {
			font-size: 14px;
			vertical-align: middle;
		}

		.email {
			font-weight: 600;
		}

		.subject {
			color: #475569;
			margin-top: 3px;
		}

		.badge {
			display: inline-block;
			padding: 5px 9px;
			border-radius: 999px;
			font-size: 12px;
			font-weight: 700;
		}

		.public {
			background: #dcfce7;
			color: #166534;
		}

		.private {
			background: #f1f5f9;
			color: #475569;
		}

		.actions {
			display: flex;
			gap: 7px;
			flex-wrap: wrap;
		}

		.empty {
			padding: 40px;
			text-align: center;
			color: #687386;
		}

		.top-actions {
			display: flex;
			gap: 8px;
		}

		@media (max-width: 600px) {
			.container {
				padding: 20px 12px;
			}

			.header {
				align-items: flex-start;
				flex-direction: column;
			}
		}
	</style>
</head>

<body>
	<div id="loginView" class="container">
		<div class="card login">
			<div class="logo">Vaqz Mobiz Admin</div>
			<div class="subtitle">Temporary Mail Administration</div>

			<div style="margin-top:22px;">
				<input
					id="token"
					type="password"
					placeholder="Enter admin token"
					autocomplete="off"
				>
			</div>

			<div style="margin-top:12px;">
				<button class="primary" style="width:100%;" onclick="login()">
					Sign In
				</button>
			</div>

			<div id="loginStatus" class="status"></div>
		</div>
	</div>

	<div id="adminView" class="hidden">
		<div class="container">
			<div class="header">
				<div>
					<div class="logo">Vaqz Mobiz Admin</div>
					<div class="subtitle">Temporary Mail Administration</div>
				</div>

				<div class="top-actions">
					<button class="secondary" onclick="loadEmails()">Refresh</button>
					<button class="secondary" onclick="logout()">Sign Out</button>
				</div>
			</div>

			<div class="stats">
				<div class="stat">
					<div id="totalCount" class="stat-number">0</div>
					<div class="stat-label">Total Emails</div>
				</div>

				<div class="stat">
					<div id="publicCount" class="stat-number">0</div>
					<div class="stat-label">Public</div>
				</div>

				<div class="stat">
					<div id="privateCount" class="stat-number">0</div>
					<div class="stat-label">Private</div>
				</div>
			</div>

			<div class="card">
				<div id="status" class="status" style="margin-bottom:15px;">
					Loading...
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
						<tbody id="emailTable"></tbody>
					</table>
				</div>
			</div>
		</div>
	</div>

<script>
	let adminToken = "";

	function escapeHtml(value) {
		return String(value ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function formatDate(timestamp) {
		if (!timestamp) return "-";

		return new Date(Number(timestamp) * 1000).toLocaleString(
			undefined,
			{
				dateStyle: "medium",
				timeStyle: "short"
			}
		);
	}

	async function login() {
		const tokenInput = document.getElementById("token");
		const status = document.getElementById("loginStatus");

		const token = tokenInput.value.trim();

		if (!token) {
			status.textContent = "Please enter your admin token.";
			status.className = "status error";
			return;
		}

		status.textContent = "Checking token...";
		status.className = "status";

		try {
			const response = await fetch("/admin/emails", {
				headers: {
					"Authorization": "Bearer " + token
				}
			});

			if (!response.ok) {
				status.textContent = "Invalid admin token.";
				status.className = "status error";
				return;
			}

			adminToken = token;

			document.getElementById("loginView").classList.add("hidden");
			document.getElementById("adminView").classList.remove("hidden");

			await loadEmails();
		} catch (error) {
			status.textContent = "Unable to connect to the server.";
			status.className = "status error";
		}
	}

	async function loadEmails() {
		const status = document.getElementById("status");
		const table = document.getElementById("emailTable");

		status.textContent = "Loading emails...";
		status.className = "status";

		try {
			const response = await fetch("/admin/emails", {
				headers: {
					"Authorization": "Bearer " + adminToken
				}
			});

			if (response.status === 401) {
				logout();
				return;
			}

			if (!response.ok) {
				throw new Error("Request failed");
			}

			const data = await response.json();
			const emails = data.result || [];

			const publicCount = emails.filter(
				email => Boolean(email.is_public)
			).length;

			document.getElementById("totalCount").textContent = emails.length;
			document.getElementById("publicCount").textContent = publicCount;
			document.getElementById("privateCount").textContent =
				emails.length - publicCount;

			if (emails.length === 0) {
				table.innerHTML =
					'<tr><td colspan="6" class="empty">No emails found.</td></tr>';

				status.textContent = "No emails found.";
				return;
			}

			table.innerHTML = emails.map(email => {
				const isPublic = Boolean(email.is_public);

				return \`
					<tr>
						<td>
							<div class="email">\${escapeHtml(email.from_address)}</div>
						</td>

						<td>
							\${escapeHtml(email.to_address)}
						</td>

						<td>
							<div class="subject">
								\${escapeHtml(email.subject || "(No subject)")}
							</div>
						</td>

						<td>
							\${formatDate(email.received_at)}
						</td>

						<td>
							<span class="badge \${isPublic ? "public" : "private"}">
								\${isPublic ? "PUBLIC" : "PRIVATE"}
							</span>
						</td>

						<td>
							<div class="actions">
								<button
									class="\${isPublic ? "secondary" : "primary"}"
									onclick="toggleVisibility('\${escapeHtml(email.id)}', \${!isPublic})"
								>
									\${isPublic ? "Make Private" : "Make Public"}
								</button>

								<button
									class="danger"
									onclick="deleteEmail('\${escapeHtml(email.id)}')"
								>
									Delete
								</button>
							</div>
						</td>
					</tr>
				\`;
			}).join("");

			status.textContent = emails.length + " email(s) loaded.";
		} catch (error) {
			status.textContent = "Failed to load emails.";
			status.className = "status error";
		}
	}

	async function toggleVisibility(emailId, makePublic) {
		try {
			const response = await fetch(
				"/admin/emails/" +
				encodeURIComponent(emailId) +
				"/visibility",
				{
					method: "PATCH",
					headers: {
						"Authorization": "Bearer " + adminToken,
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						is_public: makePublic
					})
				}
			);

			if (response.status === 401) {
				logout();
				return;
			}

			if (!response.ok) {
				throw new Error("Visibility update failed");
			}

			await loadEmails();
		} catch (error) {
			alert("Unable to change email visibility.");
		}
	}

	async function deleteEmail(emailId) {
		if (!confirm(
			"Delete this email permanently? This action cannot be undone."
		)) {
			return;
		}

		try {
			const response = await fetch(
				"/admin/emails/" +
				encodeURIComponent(emailId),
				{
					method: "DELETE",
					headers: {
						"Authorization": "Bearer " + adminToken
					}
				}
			);

			if (response.status === 401) {
				logout();
				return;
			}

			if (!response.ok) {
				throw new Error("Delete failed");
			}

			await loadEmails();
		} catch (error) {
			alert("Unable to delete email.");
		}
	}

	function logout() {
		adminToken = "";

		document.getElementById("adminView").classList.add("hidden");
		document.getElementById("loginView").classList.remove("hidden");

		document.getElementById("token").value = "";
		document.getElementById("loginStatus").textContent = "";
	}

	document.getElementById("token").addEventListener(
		"keydown",
		function(event) {
			if (event.key === "Enter") {
				login();
			}
		}
	);
</script>
</body>
</html>`;

	c.header("Content-Type", "text/html; charset=UTF-8");
	return c.body(html);
});

/**
 * Get all emails for admin
 */
adminRoutes.get("/admin/emails", async (c) => {
	if (!isAuthorized(c)) {
		return c.json(ERR("Unauthorized", "Unauthorized"), 401);
	}

	try {
		const results = await c.env.D1
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

		const convertedResults = results.results.map((row: any) => ({
			...row,
			has_attachments: Boolean(row.has_attachments),
			is_public: Boolean(row.is_public),
		}));

		return c.json(OK(convertedResults));
	} catch (e: unknown) {
		const error = e instanceof Error ? e : new Error(String(e));
		return c.json(ERR(error.message, "D1Error"), 500);
	}
});

/**
 * Change email visibility
 */
adminRoutes.patch("/admin/emails/:emailId/visibility", async (c) => {
	if (!isAuthorized(c)) {
		return c.json(ERR("Unauthorized", "Unauthorized"), 401);
	}

	const emailId = c.req.param("emailId");

	let body: { is_public?: boolean };

	try {
		body = await c.req.json();
	} catch {
		return c.json(ERR("Invalid JSON body", "ValidationError"), 400);
	}

	if (typeof body.is_public !== "boolean") {
		return c.json(
			ERR("is_public must be true or false", "ValidationError"),
			400,
		);
	}

	try {
		const result = await c.env.D1
			.prepare(
				`UPDATE emails
				 SET is_public = ?
				 WHERE id = ?`,
			)
			.bind(body.is_public ? 1 : 0, emailId)
			.run();

		if (result.meta.changes === 0) {
			return c.json(ERR("Email not found", "NotFound"), 404);
		}

		return c.json(
			OK({
				message: body.is_public
					? "Email is now public"
					: "Email is now private",
				id: emailId,
				is_public: body.is_public,
			}),
		);
	} catch (e: unknown) {
		const error = e instanceof Error ? e : new Error(String(e));
		return c.json(ERR(error.message, "D1Error"), 500);
	}
});

/**
 * Delete email
 */
adminRoutes.delete("/admin/emails/:emailId", async (c) => {
	if (!isAuthorized(c)) {
		return c.json(ERR("Unauthorized", "Unauthorized"), 401);
	}

	const emailId = c.req.param("emailId");

	try {
		const dbService = createDatabaseService(c.env.D1);

		const { meta, error } = await dbService.deleteEmailById(emailId);

		if (error) {
			return c.json(ERR(error.message, "D1Error"), 500);
		}

		if (!meta || meta.changes === 0) {
			return c.json(ERR("Email not found", "NotFound"), 404);
		}

		return c.json(
			OK({
				message: "Email deleted successfully",
				id: emailId,
			}),
		);
	} catch (e: unknown) {
		const error = e instanceof Error ? e : new Error(String(e));
		return c.json(ERR(error.message, "D1Error"), 500);
	}
});

export default adminRoutes;
