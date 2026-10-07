export const ADMIN_DASHBOARD_JS = `
let token = "";
let page = 1;
let pageSize = 50;
let selectedIds = new Set();
let currentEmails = [];
let rules = [];
let rulePage = 1;
const rulePageSize = 8;
let selectedEmailId = "";
let searchTimer = null;

const $ = (id) => document.getElementById(id);

const ICONS = {
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  unlock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2.5"/></svg>',
  rule: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>'
};

function notice(text, type) {
  const el = $("globalMessage");
  if (!el) return;
  el.textContent = String(text || "");
  el.className = "notice show " + (type || "ok");
  window.setTimeout(() => { el.className = "notice"; }, 4200);
}

function loginNotice(text, type) {
  const el = $("loginMessage");
  if (!el) return;
  el.textContent = String(text || "");
  el.className = "notice show " + (type || "error");
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#039;");
}

function date(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value || "-");
  const dateValue = new Date(numeric < 100000000000 ? numeric * 1000 : numeric);
  return Number.isNaN(dateValue.getTime()) ? String(value || "-") : dateValue.toLocaleString();
}

function relative(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return date(value);
  const milliseconds = numeric < 100000000000 ? numeric * 1000 : numeric;
  const difference = Math.max(0, Date.now() - milliseconds);
  const minute = 60000;
  const hour = 3600000;
  const day = 86400000;
  if (difference < minute) return "Just now";
  if (difference < hour) return Math.floor(difference / minute) + " min ago";
  if (difference < day) return Math.floor(difference / hour) + " hr ago";
  if (difference < day * 7) return Math.floor(difference / day) + " d ago";
  return new Date(milliseconds).toLocaleDateString();
}

async function api(path, options) {
  const requestOptions = options || {};
  const headers = Object.assign({}, requestOptions.headers || {});

  const response = await fetch(path, Object.assign({}, requestOptions, { headers }));
  let data = null;

  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (response.status === 401) {
    logout();
    throw new Error("Unauthorized. Please check the admin token.");
  }

  if (!response.ok) {
    throw new Error(
      (data && data.error && data.error.message) ||
      (data && data.message) ||
      "Request failed (HTTP " + response.status + ")"
    );
  }

  return data;
}

async function login() {
  const input = $("tokenInput");
  const button = $("loginBtn");
  const value = input ? input.value.trim() : "";

  if (!value) {
    loginNotice("Please enter the admin token.");
    if (input) input.focus();
    return;
  }

  token = value;
  if (button) {
    button.disabled = true;
    button.textContent = "Authenticating...";
  }
  loginNotice("Checking administrator access...", "ok");

  try {
    const response = await fetch("/admin/api/auth/session", {
      headers: { Authorization: "Bearer " + token }
    });
    if (!response.ok) throw new Error("Unauthorized. Please check the admin token.");
    $("loginScreen").classList.add("hidden");
    $("app").classList.remove("hidden");
    if (input) input.value = "";
    await refreshAll();
  } catch (error) {
    token = "";
    loginNotice(error && error.message ? error.message : "Unable to authenticate.");
    if (input) input.focus();
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Open Administration";
    }
  }
}

async function logout() {
  try { await fetch("/admin/api/auth/logout", { method: "POST" }); } catch (_) {}
  token = "";
  selectedIds.clear();
  const app = $("app");
  const loginScreen = $("loginScreen");
  const input = $("tokenInput");
  if (app) app.classList.add("hidden");
  if (loginScreen) loginScreen.classList.remove("hidden");
  if (input) input.value = "";
}

function action(icon, title, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-btn " + (className || "");
  button.title = title;
  button.setAttribute("aria-label", title);
  button.innerHTML = icon;
  button.addEventListener("click", handler);
  return button;
}

function selectionUi() {
  const count = selectedIds.size;
  const bar = $("selectionBar");
  const label = $("selectionCount");
  const selectAll = $("selectAll");
  if (bar) bar.classList.toggle("hidden", count === 0);
  if (label) label.textContent = count + (count === 1 ? " email selected" : " emails selected");
  if (selectAll) selectAll.checked = currentEmails.length > 0 && currentEmails.every((email) => selectedIds.has(String(email.id)));
}

function renderRow(email) {
  const row = document.createElement("tr");
  const selectCell = document.createElement("td");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "checkbox";
  checkbox.checked = selectedIds.has(String(email.id));
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) selectedIds.add(String(email.id));
    else selectedIds.delete(String(email.id));
    selectionUi();
  });
  selectCell.appendChild(checkbox);
  row.appendChild(selectCell);

  [["from_address", "address"], ["to_address", "address"]].forEach(([key, className]) => {
    const cell = document.createElement("td");
    cell.className = className;
    cell.textContent = String(email[key] || "-");
    cell.title = cell.textContent;
    row.appendChild(cell);
  });

  const subjectCell = document.createElement("td");
  subjectCell.className = "subject";
  const subjectButton = document.createElement("button");
  subjectButton.type = "button";
  subjectButton.className = "subject-link";
  subjectButton.textContent = String(email.subject || "(No subject)");
  subjectButton.title = "Open email";
  subjectButton.addEventListener("click", () => openEmail(email.id));
  subjectCell.appendChild(subjectButton);
  row.appendChild(subjectCell);

  const receivedCell = document.createElement("td");
  receivedCell.innerHTML = '<div class="date-main">' + escapeHtml(relative(email.received_at)) + '</div><div class="date-sub">' + escapeHtml(date(email.received_at)) + '</div>';
  row.appendChild(receivedCell);

  const visibilityCell = document.createElement("td");
  visibilityCell.innerHTML = email.is_public
    ? '<span class="badge public"><span class="dot"></span>PUBLIC</span>'
    : '<span class="badge private"><span class="dot"></span>PRIVATE</span>';
  row.appendChild(visibilityCell);

  const actionsCell = document.createElement("td");
  const actions = document.createElement("div");
  actions.className = "row-actions";
  if (email.is_public) {
    actions.appendChild(action(ICONS.lock, "Make private", "warning", () => visibility(email.id, false)));
  } else {
    actions.appendChild(action(ICONS.unlock, "Make public", "success", () => visibility(email.id, true)));
    actions.appendChild(action(ICONS.rule, "Make public and create future rule", "", () => openRuleModal(email.id, email.from_address, email.to_address, email.subject)));
  }
  actions.appendChild(action(ICONS.trash, "Delete email", "danger", () => deleteOne(email.id)));
  actionsCell.appendChild(actions);
  row.appendChild(actionsCell);
  return row;
}

function renderMobile(email) {
  const box = document.createElement("div");
  box.className = "mobile-email";
  const top = document.createElement("div");
  top.className = "mobile-top";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "checkbox";
  checkbox.checked = selectedIds.has(String(email.id));
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) selectedIds.add(String(email.id));
    else selectedIds.delete(String(email.id));
    selectionUi();
  });
  top.appendChild(checkbox);
  const badge = document.createElement("span");
  badge.className = email.is_public ? "badge public" : "badge private";
  badge.innerHTML = '<span class="dot"></span>' + (email.is_public ? "PUBLIC" : "PRIVATE");
  top.appendChild(badge);
  box.appendChild(top);

  const subject = document.createElement("button");
  subject.type = "button";
  subject.className = "subject-link mobile-subject";
  subject.textContent = String(email.subject || "(No subject)");
  subject.addEventListener("click", () => openEmail(email.id));
  box.appendChild(subject);

  ["from_address", "to_address"].forEach((key) => {
    const line = document.createElement("div");
    line.className = "mobile-line";
    line.textContent = (key === "from_address" ? "From: " : "To: ") + String(email[key] || "-");
    box.appendChild(line);
  });

  const received = document.createElement("div");
  received.className = "mobile-line";
  received.textContent = relative(email.received_at) + " · " + date(email.received_at);
  box.appendChild(received);

  const actions = document.createElement("div");
  actions.className = "mobile-actions";
  if (email.is_public) {
    actions.appendChild(action(ICONS.lock, "Make private", "warning", () => visibility(email.id, false)));
  } else {
    actions.appendChild(action(ICONS.unlock, "Make public", "success", () => visibility(email.id, true)));
    actions.appendChild(action(ICONS.rule, "Make public and create future rule", "", () => openRuleModal(email.id, email.from_address, email.to_address, email.subject)));
  }
  actions.appendChild(action(ICONS.trash, "Delete email", "danger", () => deleteOne(email.id)));
  box.appendChild(actions);
  return box;
}

function pagination(total) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const info = $("pageInfo");
  if (info) info.textContent = total ? "Showing " + ((page - 1) * pageSize + 1) + "–" + Math.min(page * pageSize, total) + " of " + total : "No emails found";
  $("prevPage").disabled = page <= 1;
  $("nextPage").disabled = page >= pages;
  const numbers = $("pageNumbers");
  numbers.innerHTML = "";
  for (let number = Math.max(1, page - 2); number <= Math.min(pages, page + 2); number += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-btn" + (number === page ? " active" : "");
    button.textContent = String(number);
    button.addEventListener("click", () => { page = number; loadEmails(); });
    numbers.appendChild(button);
  }
}

async function loadEmails() {
  const filter = $("visibilityFilter");
  const searchInput = $("emailSearch");
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), visibility: filter ? filter.value : "all" });
  const search = searchInput ? searchInput.value.trim() : "";
  if (search) query.set("search", search);

  const data = await api("/admin/api/emails?" + query.toString());
  currentEmails = data.items || [];
  $("totalCount").textContent = String(data.total || 0);
  $("publicCount").textContent = String(data.publicCount || 0);
  $("privateCount").textContent = String(data.privateCount || 0);

  const body = $("emailsBody");
  const mobile = $("mobileList");
  body.innerHTML = "";
  mobile.innerHTML = "";

  if (!currentEmails.length) {
    body.innerHTML = '<tr><td colspan="7" class="empty">No emails match your search.</td></tr>';
    mobile.innerHTML = '<div class="empty">No emails match your search.</div>';
  } else {
    currentEmails.forEach((email) => {
      body.appendChild(renderRow(email));
      mobile.appendChild(renderMobile(email));
    });
  }
  pagination(Number(data.total || 0));
  selectionUi();
}

async function loadRules() {
  const data = await api("/admin/rules");
  rules = (data && data.data) || data || [];
  rulePage = 1;
  renderRules();
  $("ruleCount").textContent = rules.length + " rule" + (rules.length === 1 ? "" : "s");
}

function renderRules() {
  const searchInput = $("ruleSearch");
  const term = searchInput ? searchInput.value.trim().toLowerCase() : "";
  const filtered = rules.filter((rule) => (String(rule.sender_pattern || "") + " " + String(rule.recipient_pattern || "") + " " + String(rule.subject_pattern || "")).toLowerCase().includes(term));
  const pages = Math.max(1, Math.ceil(filtered.length / rulePageSize));
  if (rulePage > pages) rulePage = pages;
  const start = (rulePage - 1) * rulePageSize;
  const list = $("rulesList");
  list.innerHTML = "";

  filtered.slice(start, start + rulePageSize).forEach((rule) => {
    const item = document.createElement("div");
    item.className = "rule-item";
    const summary = document.createElement("div");
    summary.className = "rule-summary";
    summary.innerHTML = '<div><div class="rule-label">Sender</div><div class="rule-value">' + escapeHtml(rule.sender_pattern || "All senders") + '</div></div>' +
      '<div><div class="rule-label">Recipient</div><div class="rule-value">' + escapeHtml(rule.recipient_pattern || "All mailboxes") + '</div></div>' +
      '<div><div class="rule-label">Subject contains</div><div class="rule-value">' + escapeHtml(rule.subject_pattern || "") + '</div></div>';
    const actions = document.createElement("div");
    actions.className = "rule-actions";
    actions.appendChild(action(ICONS.trash, "Delete rule", "danger", () => deleteRule(rule.id)));
    summary.appendChild(actions);
    item.appendChild(summary);
    list.appendChild(item);
  });

  if (!filtered.length) list.innerHTML = '<div class="empty">No automatic rules found.</div>';
  $("rulePageInfo").textContent = filtered.length ? "Showing " + (start + 1) + "–" + Math.min(start + rulePageSize, filtered.length) + " of " + filtered.length : "No rules";
  $("rulePrev").disabled = rulePage <= 1;
  $("ruleNext").disabled = rulePage >= pages;
}

function sanitizeEmailDocument(html) {
  const documentValue = new DOMParser().parseFromString(String(html || ""), "text/html");
  documentValue.querySelectorAll("script,noscript,iframe,object,embed,form,input,button,base,meta[http-equiv],link[rel=import]").forEach((element) => element.remove());
  documentValue.querySelectorAll("*").forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
    });
  });
  documentValue.querySelectorAll("a[href]").forEach((anchor) => {
    let href = (anchor.getAttribute("href") || "").trim();
    if (/^(javascript:|vbscript:|data:)/i.test(href)) {
      anchor.removeAttribute("href");
      return;
    }
    if (href.startsWith("//")) href = "https:" + href;
    if (/^(https?:\/\/|mailto:|tel:)/i.test(href)) {
      anchor.setAttribute("href", href);
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    }
  });
  const styles = Array.from(documentValue.querySelectorAll("style")).map((style) => style.textContent || "").join("\\n");
  documentValue.querySelectorAll("style").forEach((style) => style.remove());
  return { styles, body: documentValue.body.innerHTML };
}

async function openEmail(id) {
  try {
    const data = await api("/admin/emails/" + encodeURIComponent(id));
    const email = (data && data.data) || data;
    if (!email) throw new Error("Email not found.");

    $("emailModalTitle").textContent = String(email.subject || "Email");
    const meta = $("emailMeta");
    meta.innerHTML = "";
    [["From", email.from_address], ["To", email.to_address], ["Received", date(email.received_at)], ["Attachments", String(email.attachment_count || 0)]].forEach((pair) => {
      const item = document.createElement("div");
      item.className = "meta-item";
      item.innerHTML = '<div class="meta-label">' + escapeHtml(pair[0]) + '</div><div class="meta-value">' + escapeHtml(pair[1] || "") + '</div>';
      meta.appendChild(item);
    });

    const content = $("emailContent");
    content.innerHTML = "";
    if (email.html_content && String(email.html_content).trim()) {
      const clean = sanitizeEmailDocument(email.html_content);
      const frame = document.createElement("iframe");
      frame.className = "email-viewer";
      frame.setAttribute("sandbox", "allow-popups allow-popups-to-escape-sandbox");
      frame.setAttribute("title", "Email message");
      frame.referrerPolicy = "no-referrer";
      frame.srcdoc = '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<style>' + clean.styles + '\\nhtml,body{margin:0;padding:0;background:#fff}body{max-width:100%;overflow-x:auto}img{max-width:100%;height:auto}table{max-width:100%}#vaqz-email-root{max-width:100%;overflow-x:auto}</style>' +
        '</head><body><div id="vaqz-email-root">' + clean.body + '</div></body></html>';
      content.appendChild(frame);
    } else if (email.text_content && String(email.text_content).trim()) {
      const text = document.createElement("pre");
      text.className = "email-text";
      text.textContent = String(email.text_content);
      content.appendChild(text);
    } else {
      content.innerHTML = '<div class="empty">No message content available.</div>';
    }
    $("emailModal").classList.add("show");
  } catch (error) {
    notice(error && error.message ? error.message : "Failed to open email.", "error");
  }
}

function closeEmail() {
  $("emailModal").classList.remove("show");
  $("emailContent").innerHTML = "";
}

async function visibility(id, value) {
  try {
    await api("/admin/emails/" + encodeURIComponent(id) + "/visibility", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: value })
    });
    notice(value ? "Email is now public." : "Email is now private.");
    await loadEmails();
  } catch (error) {
    notice(error && error.message ? error.message : "Failed to update visibility.", "error");
  }
}

async function deleteOne(id) {
  if (!window.confirm("Delete this email permanently?")) return;
  try {
    await api("/admin/emails/" + encodeURIComponent(id), { method: "DELETE" });
    selectedIds.delete(String(id));
    notice("Email deleted.");
    await loadEmails();
  } catch (error) {
    notice(error && error.message ? error.message : "Failed to delete email.", "error");
  }
}

async function bulkDelete() {
  const ids = Array.from(selectedIds);
  if (!ids.length) return;
  if (!window.confirm("Delete " + ids.length + " selected email" + (ids.length === 1 ? "" : "s") + " permanently?")) return;
  const button = $("bulkDeleteBtn");
  button.disabled = true;
  try {
    const data = await api("/admin/api/emails/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    selectedIds.clear();
    const deleted = Number(data.deleted || ids.length);
    notice(deleted + " email" + (deleted === 1 ? "" : "s") + " deleted.");
    await loadEmails();
  } catch (error) {
    notice(error && error.message ? error.message : "Failed to delete selected emails.", "error");
  } finally {
    button.disabled = false;
  }
}

function openRuleModal(id, sender, recipient, subject) {
  selectedEmailId = String(id || "");
  $("modalSender").value = String(sender || "");
  $("modalRecipient").value = String(recipient || "");
  $("modalSubject").value = String(subject || "");
  $("ruleModal").classList.add("show");
  $("modalSubject").focus();
}

function closeRuleModal() {
  selectedEmailId = "";
  $("ruleModal").classList.remove("show");
}

async function confirmRule() {
  const sender = $("modalSender").value.trim();
  const recipient = $("modalRecipient").value.trim();
  const subject = $("modalSubject").value.trim();
  // All fields are optional. A blank field means "match any" for that field.
  try {
    await api("/admin/emails/" + encodeURIComponent(selectedEmailId) + "/visibility", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: true })
    });
    await api("/admin/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_pattern: sender, recipient_pattern: recipient, subject_pattern: subject })
    });
    closeRuleModal();
    notice("Email is public and the future-matching rule was created.");
    await refreshAll();
  } catch (error) {
    notice(error && error.message ? error.message : "Failed to create rule.", "error");
  }
}

async function addRule() {
  const sender = $("newRuleSender").value.trim();
  const recipient = $("newRuleRecipient").value.trim();
  const subject = $("newRuleSubject").value.trim();
  try {
    await api("/admin/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender_pattern: sender, recipient_pattern: recipient || null, subject_pattern: subject })
    });
    $("newRuleSender").value = "";
    $("newRuleRecipient").value = "";
    $("newRuleSubject").value = "";
    notice("Automatic public rule added.");
    await loadRules();
  } catch (error) {
    notice(error && error.message ? error.message : "Failed to add rule.", "error");
  }
}

async function deleteRule(id) {
  if (!window.confirm("Delete this automatic public rule?")) return;
  try {
    await api("/admin/rules/" + encodeURIComponent(id), { method: "DELETE" });
    notice("Rule deleted.");
    await loadRules();
  } catch (error) {
    notice(error && error.message ? error.message : "Failed to delete rule.", "error");
  }
}

async function syncMailboxes() {
  const button = $("syncBtn");
  const status = $("syncStatus");
  button.disabled = true;
  button.textContent = "Syncing...";
  status.textContent = "Synchronizing mailbox accounts...";
  try {
    const data = await api("/admin/sync/mailboxes", { method: "POST" });
    const result = (data && data.result) || data || {};
    notice("Mailbox sync completed successfully.");
    status.textContent = "Sync completed: created " + (result.created || 0) + ", updated " + (result.updated || 0) + ", disabled " + (result.disabled || 0) + ", unchanged " + (result.unchanged || 0);
  } catch (error) {
    notice("Mailbox sync failed: " + (error && error.message ? error.message : "Unknown error"), "error");
    status.textContent = "Sync failed.";
  } finally {
    button.disabled = false;
    button.textContent = "↻ Sync";
  }
}

function renderDashboardList(id, items, kind) {
  const container = $(id);
  if (!container) return;
  container.innerHTML = "";
  if (!items || !items.length) {
    container.innerHTML = '<div class="empty">No recent activity.</div>';
    return;
  }
  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "activity-item";
    const title = document.createElement("div");
    title.className = "activity-title";
    title.textContent = kind === "audit" ? String(item.action || "Activity") : String(item.event_type || "Event");
    const meta = document.createElement("div");
    meta.className = "activity-meta";
    meta.textContent = date(item.created_at);
    row.appendChild(title);
    row.appendChild(meta);
    if (kind === "audit" && item.summary) {
      const details = document.createElement("div");
      details.className = "activity-details";
      details.textContent = String(item.summary);
      row.appendChild(details);
    } else if (kind === "credential" && item.details) {
      const details = document.createElement("div");
      details.className = "activity-details";
      const d = item.details || {};
      const parts = [];
      if (d.customer_name) parts.push("Customer: " + d.customer_name);
      if (d.product_name) parts.push("Product: " + d.product_name);
      if (d.reason) parts.push("Reason: " + d.reason);
      if (d.slot_name) parts.push(d.slot_name);
      details.textContent = parts.join(" · ");
      if (parts.length) row.appendChild(details);
    }
    container.appendChild(row);
  });
}

async function loadDashboardKpis() {
  const data = await api("/admin/api/dashboard/kpis");
  const c = data.credentials || {};
  const a = data.allocations || {};
  const p = data.products || {};
  const inv = data.inventory || {};
  $("kpiCredentials").textContent = String(c.total || 0);
  $("kpiCredentialsFoot").textContent = String(c.active || 0) + " active · " + String(c.suspended || 0) + " suspended";
  $("kpiAllocations").textContent = String(a.active || 0);
  $("kpiAllocationsFoot").textContent = String(a.inactive || 0) + " inactive / released";
  $("kpiUtilization").textContent = String(inv.occupiedRatio || 0) + "%";
  $("kpiUtilizationFoot").textContent = String(inv.activeAllocations || 0) + " active allocations · " + String(inv.activeSlots || 0) + " active slots";
  $("kpiProducts").textContent = String(p.active || 0);
  $("kpiProductsFoot").textContent = String(p.total || 0) + " total products";
  $("kpiCredentialActive").textContent = String(c.active || 0);
  $("kpiCredentialSuspended").textContent = String(c.suspended || 0);
  $("kpiCredentialArchived").textContent = String(c.archived || 0);
  $("kpiAllocationActive").textContent = String(a.active || 0);
  $("kpiAllocationInactive").textContent = String(a.inactive || 0);
  $("kpiAllocationExpired").textContent = String(a.expired || 0);
  renderDashboardList("recentCredentialEvents", data.recentCredentialEvents || [], "credential");
  renderDashboardList("recentAudit", data.recentAudit || [], "audit");
}

async function refreshAll() {
  try {
    await Promise.all([loadEmails(), loadRules(), loadDashboardKpis()]);
  } catch (error) {
    notice(error && error.message ? error.message : "Failed to refresh administration data.", "error");
  }
}

async function restoreSession() {
  try {
    const response = await fetch("/admin/api/auth/session");
    if (!response.ok) return;
    $("loginScreen").classList.add("hidden");
    $("app").classList.remove("hidden");
    await refreshAll();
  } catch (_) {}
}

function initializeDashboard() {
  const loginButton = $("loginBtn");
  const tokenInput = $("tokenInput");
  if (!loginButton || !tokenInput) return;

  loginButton.addEventListener("click", login);
  tokenInput.addEventListener("keydown", (event) => { if (event.key === "Enter") login(); });
  $("logoutBtn").addEventListener("click", logout);
  $("refreshBtn").addEventListener("click", refreshAll);
  $("syncBtn").addEventListener("click", syncMailboxes);
  $("bulkDeleteBtn").addEventListener("click", bulkDelete);
  $("clearSelectionBtn").addEventListener("click", () => { selectedIds.clear(); selectionUi(); loadEmails(); });
  $("selectAll").addEventListener("change", (event) => {
    currentEmails.forEach((email) => event.target.checked ? selectedIds.add(String(email.id)) : selectedIds.delete(String(email.id)));
    selectionUi();
    loadEmails();
  });
  $("visibilityFilter").addEventListener("change", () => { page = 1; loadEmails(); });
  $("pageSize").addEventListener("change", () => { page = 1; pageSize = Number($("pageSize").value) || 50; loadEmails(); });
  $("emailSearch").addEventListener("input", () => {
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => { page = 1; loadEmails(); }, 300);
  });
  $("prevPage").addEventListener("click", () => { if (page > 1) { page -= 1; loadEmails(); } });
  $("nextPage").addEventListener("click", () => { page += 1; loadEmails(); });
  $("ruleSearch").addEventListener("input", () => { rulePage = 1; renderRules(); });
  $("rulePrev").addEventListener("click", () => { if (rulePage > 1) { rulePage -= 1; renderRules(); } });
  $("ruleNext").addEventListener("click", () => { rulePage += 1; renderRules(); });
  $("addRuleBtn").addEventListener("click", addRule);
  $("confirmRuleBtn").addEventListener("click", confirmRule);
  $("cancelRuleBtn").addEventListener("click", closeRuleModal);
  $("cancelRuleBtnTop").addEventListener("click", closeRuleModal);
  $("closeEmailBtn").addEventListener("click", closeEmail);
  $("closeEmailBtn2").addEventListener("click", closeEmail);
  $("emailModal").addEventListener("click", (event) => { if (event.target.id === "emailModal") closeEmail(); });
  $("ruleModal").addEventListener("click", (event) => { if (event.target.id === "ruleModal") closeRuleModal(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeEmail(); closeRuleModal(); } });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeDashboard, { once: true });
} else {
  initializeDashboard();
}
restoreSession();
`;
