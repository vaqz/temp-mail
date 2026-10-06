export const ADMIN_AUDIT_JS = `
let page = 1;
const pageSize = 50;
let timer = null;
const $ = (id) => document.getElementById(id);

async function api(path, options) {
  const response = await fetch(path, options || {});
  let data = null;
  try { data = await response.json(); } catch (_) {}
  if (response.status === 401) {
    window.location.href = "/admin";
    throw new Error("Unauthorized");
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || "Request failed");
  }
  return data;
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function render(items, total) {
  const body = $("body");
  body.innerHTML = "";
  if (!items.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">No audit records found.</td></tr>';
  } else {
    for (const item of items) {
      const resource = [item.resource_type, item.resource_id].filter(Boolean).join(" · ") || "—";
      const row = document.createElement("tr");
      row.innerHTML =
        "<td>" + escapeHtml(new Date(item.created_at).toLocaleString()) + "</td>" +
        "<td class='action'>" + escapeHtml(item.action) + "</td>" +
        "<td class='resource'>" + escapeHtml(resource) + "</td>" +
        "<td class='summary'>" + escapeHtml(item.summary) + "</td>" +
        "<td>" + escapeHtml(item.actor || "admin") + "</td>" +
        "<td>" + escapeHtml(item.ip_address || "—") + "</td>";
      body.appendChild(row);
    }
  }
  const pages = Math.max(1, Math.ceil(total / pageSize));
  $("pageInfo").textContent = total ? "Page " + page + " of " + pages + " · " + total + " records" : "No records";
  $("prevBtn").disabled = page <= 1;
  $("nextBtn").disabled = page >= pages;
}

async function loadActions() {
  const data = await api("/admin/api/audit?action_list=1");
  const select = $("action");
  const current = select.value;
  select.innerHTML = '<option value="">All actions</option>';
  for (const action of data.actions || []) {
    const option = document.createElement("option");
    option.value = action;
    option.textContent = action;
    select.appendChild(option);
  }
  select.value = current;
}

async function load() {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  const search = $("search").value.trim();
  const action = $("action").value;
  if (search) query.set("search", search);
  if (action) query.set("action", action);
  const data = await api("/admin/api/audit?" + query.toString());
  render(data.items || [], Number(data.total || 0));
}

function debounceLoad() {
  clearTimeout(timer);
  timer = setTimeout(() => { page = 1; load().catch(showError); }, 250);
}

function showError(error) {
  const el = $("message");
  el.textContent = error?.message || "Unable to load audit log.";
  el.className = "notice show";
}

async function logout() {
  try { await fetch("/admin/api/auth/logout", { method: "POST" }); } catch (_) {}
  window.location.href = "/admin";
}

async function initialize() {
  try {
    await api("/admin/api/auth/session");
    await loadActions();
    await load();
  } catch (error) {
    showError(error);
  }
  $("refreshBtn").addEventListener("click", () => load().catch(showError));
  $("logoutBtn").addEventListener("click", logout);
  $("prevBtn").addEventListener("click", () => { page -= 1; load().catch(showError); });
  $("nextBtn").addEventListener("click", () => { page += 1; load().catch(showError); });
  $("search").addEventListener("input", debounceLoad);
  $("action").addEventListener("change", () => { page = 1; load().catch(showError); });
  $("clearBtn").addEventListener("click", () => { $("search").value = ""; $("action").value = ""; page = 1; load().catch(showError); });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once:true });
else initialize();
`;
