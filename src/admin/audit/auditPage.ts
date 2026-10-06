export const ADMIN_AUDIT_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0f2b75">
<title>Vaqz Mobiz · Audit Log</title>
<link rel="icon" href="https://vaqzmobiz.com/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/admin/assets/audit.css">
</head>
<body>
<div class="wrap">
  <section class="card">
    <div class="header">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">✓</div>
        <div><h1>Audit Log</h1><div class="brand-sub">Administrator activity and system changes.</div></div>
      </div>
      <div class="header-actions">
        <a class="btn ghost" href="/admin">Dashboard</a>
        <button id="refreshBtn" class="btn">Refresh</button>
        <button id="logoutBtn" class="btn danger">Logout</button>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="toolbar">
      <div class="search"><input id="search" placeholder="Search action, resource or details"></div>
      <select id="action" class="select"><option value="">All actions</option></select>
      <button id="clearBtn" class="btn ghost">Clear</button>
    </div>
    <div id="message" class="notice"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Action</th><th>Resource</th><th>Summary</th><th>Admin</th><th>IP</th></tr></thead>
        <tbody id="body"><tr><td colspan="6" class="empty">Loading...</td></tr></tbody>
      </table>
    </div>
    <div class="pagination">
      <span id="pageInfo" class="muted"></span>
      <div><button id="prevBtn" class="page-btn">Previous</button><button id="nextBtn" class="page-btn">Next</button></div>
    </div>
  </section>
</div>
<script src="/admin/assets/audit.js" defer></script>
</body>
</html>`;
