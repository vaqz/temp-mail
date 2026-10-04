export const ADMIN_DASHBOARD_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0f2b75">
<title>Vaqz Mobiz Mail · Administration</title>
<link rel="icon" href="https://vaqzmobiz.com/assets/favicon.svg" type="image/svg+xml">
<link rel="shortcut icon" href="https://vaqzmobiz.com/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/admin/assets/dashboard.css">
</head>
<body>
<div class="wrap">
  <section id="loginScreen" class="card login">
    <div class="brand">
      <div class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5h16v13H4z"/><path d="m4 7 8 6 8-6"/></svg></div>
      <div><h1>Vaqz Mobiz Mail</h1><div class="brand-sub">Administration</div></div>
    </div>
    <p class="muted" style="margin:18px 0">Administrator access is required to manage mailboxes, visibility and rules.</p>
    <div id="loginMessage" class="notice"></div>
    <div class="field"><label for="tokenInput">Admin token</label><input id="tokenInput" type="password" autocomplete="current-password" placeholder="Enter admin token"></div>
    <button id="loginBtn" class="btn" style="margin-top:12px">Open Administration</button>
  </section>

  <main id="app" class="hidden">
    <section class="card">
      <div class="header">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5.5h16v13H4z"/><path d="m4 7 8 6 8-6"/></svg></div>
          <div><h1>Mail Administration</h1><div class="brand-sub">Manage mail visibility, automatic rules and mailbox operations.</div></div>
        </div>
        <div class="header-actions">
          <button id="syncBtn" class="btn success top-icon" aria-label="Sync mailboxes" title="Sync mailboxes">Sync</button>
          <a href="/admin/domains" class="btn ghost top-icon" aria-label="Mailbox domains" title="Mailbox domains">Domains</a>
          <button id="refreshBtn" class="btn ghost top-icon" aria-label="Refresh dashboard" title="Refresh dashboard">Refresh</button>
          <button id="logoutBtn" class="btn danger top-icon" aria-label="Logout" title="Logout">Logout</button>
        </div>
      </div>
      <div id="syncStatus" class="muted" style="margin-top:9px"></div>
    </section>

    <div id="globalMessage" class="notice"></div>

    <section class="stats">
      <div class="stat"><div class="stat-label">Total Emails</div><div id="totalCount" class="stat-value">0</div><div class="stat-foot">All stored messages</div></div>
      <div class="stat"><div class="stat-label">Public</div><div id="publicCount" class="stat-value">0</div><div class="stat-foot">Visible through the public mailbox API</div></div>
      <div class="stat"><div class="stat-label">Private</div><div id="privateCount" class="stat-value">0</div><div class="stat-foot">Visible only through authenticated access</div></div>
    </section>

    <section class="card">
      <div class="header"><div><h2>Emails</h2><div class="muted">Search, filter and manage messages without endless scrolling.</div></div><div id="selectionBar" class="selection-bar hidden"><span id="selectionCount" class="selection-count">0 selected</span><button id="clearSelectionBtn" class="btn ghost">Clear</button><button id="bulkDeleteBtn" class="btn danger">Delete selected</button></div></div>
      <div class="toolbar">
        <div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="emailSearch" placeholder="Search sender, recipient or subject"></div>
        <select id="visibilityFilter" class="select"><option value="all">All visibility</option><option value="public">Public</option><option value="private">Private</option></select>
        <select id="pageSize" class="select"><option value="25">25 / page</option><option value="50" selected>50 / page</option><option value="100">100 / page</option></select>
      </div>
      <div class="table-wrap"><table><thead><tr><th style="width:42px"><input id="selectAll" class="checkbox" type="checkbox" aria-label="Select all visible emails"></th><th>From</th><th>To</th><th>Subject</th><th>Received</th><th>Visibility</th><th style="text-align:right">Actions</th></tr></thead><tbody id="emailsBody"><tr><td colspan="7" class="empty">Loading...</td></tr></tbody></table></div>
      <div id="mobileList" class="mobile-list"></div>
      <div class="pagination"><div id="pageInfo" class="page-info"></div><div class="page-buttons"><button id="prevPage" class="page-btn">Previous</button><div id="pageNumbers" class="page-buttons"></div><button id="nextPage" class="page-btn">Next</button></div></div>
    </section>

    <section class="card">
      <div class="header"><div><h2>Automatic Public Rules</h2><div class="muted">Matching emails are automatically made public.</div></div><div id="ruleCount" class="badge private">0 rules</div></div>
      <div class="rule-form">
        <div class="rule-grid">
          <div class="field"><label for="newRuleSender">Sender</label><input id="newRuleSender" placeholder="sender@example.com (optional)"></div>
          <div class="field"><label for="newRuleRecipient">Recipient</label><input id="newRuleRecipient" placeholder="mailbox@example.com (optional)"></div>
          <div class="field full"><label for="newRuleSubject">Subject contains</label><input id="newRuleSubject" placeholder="Verification code"></div>
        </div>
        <button id="addRuleBtn" class="btn success" style="margin-top:10px">Add Public Rule</button>
      </div>
      <div class="rules-toolbar"><div class="search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg><input id="ruleSearch" placeholder="Search rules"></div></div>
      <div id="rulesList" class="rule-list"><div class="empty">Loading rules...</div></div>
      <div class="pagination"><div id="rulePageInfo" class="page-info"></div><div class="page-buttons"><button id="rulePrev" class="page-btn">Previous</button><button id="ruleNext" class="page-btn">Next</button></div></div>
    </section>
  </main>
</div>

<div id="emailModal" class="modal" aria-hidden="true"><div class="modal-box"><div class="modal-head"><div><h2 id="emailModalTitle">Email</h2><div class="muted">Authenticated message preview</div></div><button id="closeEmailBtn" class="icon-btn" title="Close">×</button></div><div id="emailMeta" class="email-meta"></div><div id="emailContent"></div><div class="modal-actions"><button id="closeEmailBtn2" class="btn secondary">Close</button></div></div></div>

<div id="ruleModal" class="modal" aria-hidden="true"><div class="modal-box" style="max-width:620px"><div class="modal-head"><div><h2>Make Public + Future Similar</h2><div class="muted">Make this message public and create an automatic rule.</div></div><button id="cancelRuleBtnTop" class="icon-btn" title="Close">×</button></div><div class="field"><label for="modalSender">Sender</label><input id="modalSender" autocomplete="off"></div><div class="field" style="margin-top:10px"><label for="modalRecipient">Recipient</label><input id="modalRecipient" autocomplete="off"></div><div class="field" style="margin-top:10px"><label for="modalSubject">Subject keyword / phrase</label><input id="modalSubject" placeholder="Verification code"></div><div class="modal-actions"><button id="cancelRuleBtn" class="btn secondary">Cancel</button><button id="confirmRuleBtn" class="btn success">Make Public & Create Rule</button></div></div></div>

<script src="/admin/assets/dashboard.js" defer></script>
<script>
(function () {
  var key = "vm_admin_token";

  function setupSessionBridge() {
    var input = document.getElementById("tokenInput");
    var loginButton = document.getElementById("loginBtn");
    var app = document.getElementById("app");
    var logoutButton = document.getElementById("logoutBtn");
    if (!input || !loginButton || !app) return;

    // dashboard.js performs the actual authentication. This bridge keeps the
    // authenticated credential available to the other admin pages and across
    // reloads by using origin-scoped localStorage.
    loginButton.addEventListener("click", function () {
      var candidate = input.value.trim();
      if (!candidate) return;
      var attempts = 0;
      var timer = window.setInterval(function () {
        attempts += 1;
        if (!app.classList.contains("hidden")) {
          localStorage.setItem(key, candidate);
          window.clearInterval(timer);
        } else if (attempts >= 150) {
          window.clearInterval(timer);
        }
      }, 100);
    }, true);

    if (logoutButton) {
      logoutButton.addEventListener("click", function () {
        localStorage.removeItem(key);
      }, true);
    }

    // Migrate any existing session token and automatically authenticate.
    var stored = localStorage.getItem(key) || sessionStorage.getItem(key) || "";
    if (stored) {
      localStorage.setItem(key, stored);
      sessionStorage.setItem(key, stored);
      input.value = stored;
      window.setTimeout(function () { loginButton.click(); }, 0);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupSessionBridge, { once: true });
  } else {
    setupSessionBridge();
  }
})();
</script>
</body>
</html>`;
