export const DOMAINS_CSS = `
*{box-sizing:border-box}
body{margin:0;background:#f5f7fb;color:#172033;font-family:Arial,Helvetica,sans-serif}
.wrap{max-width:1100px;margin:auto;padding:24px}
.card{background:#fff;border:1px solid #e5e9f2;border-radius:14px;padding:20px;margin-bottom:18px;box-shadow:0 2px 8px rgba(0,0,0,.04)}
.hidden{display:none}
.muted{color:#64748b;font-size:13px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.form{display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end}
.field label{display:block;color:#64748b;font-size:12px;margin-bottom:6px}
.field input{width:100%;padding:11px 12px;border:1px solid #ccd3df;border-radius:8px;font:inherit}
.field input:focus{border-color:#2563eb;outline:none}
button{border:0;border-radius:8px;padding:10px 13px;background:#2563eb;color:#fff;cursor:pointer;font:inherit}
button.secondary{background:#64748b}
button.success{background:#15803d}
button.warning{background:#b45309}
button.danger{background:#dc2626}
button.small{padding:7px 9px;font-size:13px}
.domain{border:1px solid #e5e9f2;border-radius:12px;padding:16px;margin-top:12px}
.domain-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap}
.badge{display:inline-block;padding:4px 8px;border-radius:20px;font-size:11px;font-weight:bold;background:#dcfce7;color:#166534}
.badge.off{background:#f1f5f9;color:#475569}
.dest{display:flex;justify-content:space-between;gap:10px;align-items:center;border-top:1px solid #edf0f5;padding:10px 0 0;margin-top:10px}
.actions{display:flex;gap:6px;flex-wrap:wrap}
.message{display:none;padding:10px 12px;border-radius:8px;margin:10px 0}
.message.show{display:block}
.ok{background:#dcfce7;color:#166534}
.err{background:#fee2e2;color:#991b1b}
@media(max-width:700px){.wrap{padding:12px}.form{grid-template-columns:1fr}.form button{width:100%}}
`;
