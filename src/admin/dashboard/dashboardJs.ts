export const ADMIN_DASHBOARD_JS = `
let token = "";
let page = 1;
let pageSize = 50;
let searchTimer = null;
let selectedIds = new Set();
let currentEmails = [];
let rules = [];
let rulePage = 1;
const rulePageSize = 8;
let selectedEmailId = "";

const $ = (id) => document.getElementById(id);

const ICONS = {
  eye:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
  lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  unlock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2.5"/></svg>',
  rule:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>'
};

function showNotice(text, type){
  const el = $("globalMessage");
  el.textContent = String(text || "");
  el.className = "notice show " + (type || "ok");
  window.setTimeout(() => { el.className = "notice"; }, 4200);
}
function showLogin(text){
  const el = $("loginMessage");
  el.textContent = String(text || "");
  el.className = "notice show error";
}
function escapeHtml(value){
  return String(value == null ? "" : value).split("&").join("&amp;").split("<").join("&lt;").split(">\").join("&gt;").split('"').join("&quot;").split("'").join("&#039;");
}
function formatDate(value){
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value || "-");
  const ms = numeric < 100000000000 ? numeric * 1000 : numeric;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return date.toLocaleString();
}
function relativeDate(value){
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return formatDate(value);
  const ms = numeric < 100000000000 ? numeric * 1000 : numeric;
  const diff = Math.max(0, Date.now() - ms);
  const minute = 60000, hour = 3600000, day = 86400000;
  if (diff < minute) return "Just now";
  if (diff < hour) return Math.floor(diff / minute) + " min ago";
  if (diff < day) return Math.floor(diff / hour) + " hr ago";
  if (diff < day * 7) return Math.floor(diff / day) + " d ago";
  return new Date(ms).toLocaleDateString();
}
async function api(path, options){
  const request = options || {};
  const headers = Object.assign({ Authorization:"Bearer " + token }, request.headers || {});
  const response = await fetch(path, Object.assign({}, request, { headers }));
  let data = null;
  try { data = await response.json(); } catch (_) {}
  if (response.status === 401) { logout(); throw new Error("Unauthorized"); }
  if (!response.ok) throw new Error((data && data.error && data.error.message) || "Request failed");
  return data;
}
function login(){
  const value = $("tokenInput").value.trim();
  if (!value) { showLogin("Please enter the admin token."); return; }
  token = value;
  api("/admin/api/emails?page=1&pageSize=1").then(() => {
    $("loginScreen").classList.add("hidden");
    $("app").classList.remove("hidden");
    refreshAll();
  }).catch(error => { token = ""; showLogin(error.message || "Invalid admin token."); });
}
function logout(){
  token = "";
  selectedIds.clear();
  $("app").classList.add("hidden");
  $("loginScreen").classList.remove("hidden");
  $("tokenInput").value = "";
}
function renderPagination(total, current, size){
  const pages = Math.max(1, Math.ceil(total / size));
  $("pageInfo").textContent = total ? "Showing " + (((current - 1) * size) + 1) + "–" + Math.min(current * size, total) + " of " + total : "No emails found";
  $("prevPage").disabled = current <= 1;
  $("nextPage").disabled = current >= pages;
  const box = $("pageNumbers"); box.innerHTML = "";
  const start = Math.max(1, current - 2), end = Math.min(pages, current + 2);
  for (let n = start; n <= end; n++) {
    const b = document.createElement("button"); b.className = "page-btn" + (n === current ? " active" : ""); b.textContent = String(n); b.addEventListener("click", () => { page = n; loadEmails(); }); box.appendChild(b);
  }
}
function updateSelectionUI(){
  const count = selectedIds.size;
  $("selectionBar").classList.toggle("hidden", count === 0);
  $("selectionCount").textContent = count + (count === 1 ? " email selected" : " emails selected");
  const all = currentEmails.length > 0 && currentEmails.every(e => selectedIds.has(String(e.id)));
  $("selectAll").checked = all;
}
function createActionButton(icon, title, className, handler){
  const b = document.createElement("button"); b.className = "icon-btn " + (className || ""); b.title = title; b.setAttribute("aria-label", title); b.innerHTML = icon; b.addEventListener("click", handler); return b;
}
function renderEmailRow(email){
  const row = document.createElement("tr");
  const selectCell = document.createElement("td"); const cb = document.createElement("input"); cb.type="checkbox"; cb.className="checkbox"; cb.checked=selectedIds.has(String(email.id)); cb.addEventListener("change", () => { if(cb.checked) selectedIds.add(String(email.id)); else selectedIds.delete(String(email.id)); updateSelectionUI(); }); selectCell.appendChild(cb); row.appendChild(selectCell);
  const from = document.createElement("td"); from.className="address"; from.title=String(email.from_address || ""); from.textContent=String(email.from_address || "-"); row.appendChild(from);
  const to = document.createElement("td"); to.className="address"; to.title=String(email.to_address || ""); to.textContent=String(email.to_address || "-"); row.appendChild(to);
  const subject = document.createElement("td"); subject.className="subject"; subject.title=String(email.subject || "(No subject)"); subject.textContent=String(email.subject || "(No subject)"); row.appendChild(subject);
  const received = document.createElement("td"); received.innerHTML='<div class="date-main">'+escapeHtml(relativeDate(email.received_at))+'</div><div class="date-sub">'+escapeHtml(formatDate(email.received_at))+'</div>'; row.appendChild(received);
  const visibility = document.createElement("td"); visibility.innerHTML=email.is_public?'<span class="badge public"><span class="dot"></span>PUBLIC</span>':'<span class="badge private"><span class="dot"></span>PRIVATE</span>'; row.appendChild(visibility);
  const actionsCell = document.createElement("td"); const actions=document.createElement("div"); actions.className="row-actions";
  actions.appendChild(createActionButton(ICONS.eye,"Read email","",()=>openEmail(email.id)));
  if(email.is_public) actions.appendChild(createActionButton(ICONS.lock,"Make private","warning",()=>makePrivate(email.id))); else { actions.appendChild(createActionButton(ICONS.unlock,"Make public","success",()=>makePublic(email.id))); actions.appendChild(createActionButton(ICONS.rule,"Make public and create future rule","",()=>openRuleModal(email.id,email.from_address,email.to_address,email.subject))); }
  actions.appendChild(createActionButton(ICONS.trash,"Delete email","danger",()=>deleteOne(email.id)));
  actionsCell.appendChild(actions); row.appendChild(actionsCell); return row;
}
function renderMobileEmail(email){
  const box=document.createElement("div"); box.className="mobile-email";
  const top=document.createElement("div"); top.className="mobile-top";
  const cb=document.createElement("input"); cb.type="checkbox"; cb.className="checkbox"; cb.checked=selectedIds.has(String(email.id)); cb.addEventListener("change",()=>{if(cb.checked)selectedIds.add(String(email.id));else selectedIds.delete(String(email.id));updateSelectionUI();}); top.appendChild(cb);
  const badge=document.createElement("span"); badge.className=email.is_public?"badge public":"badge private"; badge.innerHTML='<span class="dot"></span>'+(email.is_public?"PUBLIC":"PRIVATE"); top.appendChild(badge); box.appendChild(top);
  const subject=document.createElement("div"); subject.className="mobile-subject"; subject.textContent=String(email.subject||"(No subject)"); box.appendChild(subject);
  const from=document.createElement("div"); from.className="mobile-line"; from.textContent="From: "+String(email.from_address||"-"); box.appendChild(from);
  const to=document.createElement("div"); to.className="mobile-line"; to.textContent="To: "+String(email.to_address||"-"); box.appendChild(to);
  const date=document.createElement("div"); date.className="mobile-line"; date.textContent=relativeDate(email.received_at)+" · "+formatDate(email.received_at); box.appendChild(date);
  const actions=document.createElement("div"); actions.className="mobile-actions"; actions.appendChild(createActionButton(ICONS.eye,"Read email","",()=>openEmail(email.id))); actions.appendChild(createActionButton(ICONS.trash,"Delete email","danger",()=>deleteOne(email.id))); box.appendChild(actions); return box;
}
async function loadEmails(){
  const query=new URLSearchParams({page:String(page),pageSize:String(pageSize),visibility:$("visibilityFilter").value}); const search=$("emailSearch").value.trim(); if(search)query.set("search",search);
  const data=await api("/admin/api/emails?"+query.toString());
  currentEmails=data.items||[];
  $("totalCount").textContent=String(data.total||0); $("publicCount").textContent=String(data.publicCount||0); $("privateCount").textContent=String(data.privateCount||0);
  const body=$("emailsBody"); body.innerHTML=""; const mobile=$("mobileList"); mobile.innerHTML="";
  if(!currentEmails.length){ body.innerHTML='<tr><td colspan="7" class="empty">No emails match your search.</td></tr>'; mobile.innerHTML='<div class="empty">No emails match your search.</div>'; }
  else { currentEmails.forEach(e=>{body.appendChild(renderEmailRow(e));mobile.appendChild(renderMobileEmail(e));}); }
  renderPagination(Number(data.total||0),page,pageSize); updateSelectionUI();
}
async function loadRules(){
  const data=await api("/admin/rules"); rules=(data&&data.data)||data||[]; rulePage=1; renderRules(); $("ruleCount").textContent=rules.length+" rule"+(rules.length===1?"":"s");
}
function renderRules(){
  const term=$("ruleSearch").value.trim().toLowerCase(); const filtered=rules.filter(r=>(String(r.sender_pattern||"")+" "+String(r.recipient_pattern||"")+" "+String(r.subject_pattern||"")).toLowerCase().includes(term));
  const pages=Math.max(1,Math.ceil(filtered.length/rulePageSize)); if(rulePage>pages)rulePage=pages; const start=(rulePage-1)*rulePageSize; const visible=filtered.slice(start,start+rulePageSize); const list=$("rulesList"); list.innerHTML="";
  if(!visible.length){list.innerHTML='<div class="empty">No automatic rules found.</div>';} else visible.forEach(rule=>{const item=document.createElement("div");item.className="rule-item";const summary=document.createElement("div");summary.className="rule-summary";summary.innerHTML='<div><div class="rule-label">Sender</div><div class="rule-value" title="'+escapeHtml(rule.sender_pattern||"All senders")+'">'+escapeHtml(rule.sender_pattern||"All senders")+'</div></div><div><div class="rule-label">Recipient</div><div class="rule-value" title="'+escapeHtml(rule.recipient_pattern||"All mailboxes")+'">'+escapeHtml(rule.recipient_pattern||"All mailboxes")+'</div></div><div><div class="rule-label">Subject contains</div><div class="rule-value" title="'+escapeHtml(rule.subject_pattern||"")+'">'+escapeHtml(rule.subject_pattern||"")+'</div></div>';const actions=document.createElement("div");actions.className="rule-actions";actions.appendChild(createActionButton(ICONS.trash,"Delete rule","danger",()=>deleteRule(rule.id)));summary.appendChild(actions);item.appendChild(summary);list.appendChild(item);});
  $("rulePageInfo").textContent=filtered.length?"Showing "+(start+1)+"–"+Math.min(start+rulePageSize,filtered.length)+" of "+filtered.length:"No rules"; $("rulePrev").disabled=rulePage<=1; $("ruleNext").disabled=rulePage>=pages;
}
async function openEmail(id){
  try{const data=await api("/admin/emails/"+encodeURIComponent(id));const email=(data&&data.data)||data;if(!email)throw new Error("Email not found.");$("emailModalTitle").textContent=String(email.subject||"Email");const meta=$("emailMeta");meta.innerHTML="";[["From",email.from_address],["To",email.to_address],["Received",formatDate(email.received_at)],["Attachments",String(email.attachment_count||0)]].forEach(pair=>{const div=document.createElement("div");div.className="meta-item";div.innerHTML='<div class="meta-label">'+escapeHtml(pair[0])+'</div><div class="meta-value">'+escapeHtml(pair[1]||"")+'</div>';meta.appendChild(div);});const content=$("emailContent");content.innerHTML="";if(email.html_content&&String(email.html_content).trim()){const iframe=document.createElement("iframe");iframe.className="email-viewer";iframe.setAttribute("sandbox","");iframe.setAttribute("referrerpolicy","no-referrer");iframe.srcdoc=String(email.html_content);content.appendChild(iframe);}else if(email.text_content&&String(email.text_content).trim()){const pre=document.createElement("pre");pre.className="email-text";pre.textContent=String(email.text_content);content.appendChild(pre);}else{const empty=document.createElement("div");empty.className="empty";empty.textContent="No message content available.";content.appendChild(empty);}$("emailModal").classList.add("show");$("emailModal").setAttribute("aria-hidden","false");}catch(error){showNotice(error.message||"Failed to open email.","error");}
}
function closeEmail(){$("emailModal").classList.remove("show");$("emailModal").setAttribute("aria-hidden","true");$("emailContent").innerHTML="";}
async function makePublic(id){try{await api("/admin/emails/"+encodeURIComponent(id)+"/visibility",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_public:true})});showNotice("Email is now public.");await loadEmails();}catch(error){showNotice(error.message,"error");}}
async function makePrivate(id){try{await api("/admin/emails/"+encodeURIComponent(id)+"/visibility",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_public:false})});showNotice("Email is now private.");await loadEmails();}catch(error){showNotice(error.message,"error");}}
async function deleteOne(id){if(!confirm("Delete this email permanently?"))return;try{await api("/admin/emails/"+encodeURIComponent(id),{method:"DELETE"});selectedIds.delete(String(id));showNotice("Email deleted.");await loadEmails();}catch(error){showNotice(error.message,"error");}}
async function bulkDelete(){const ids=Array.from(selectedIds);if(!ids.length)return;if(!confirm("Delete "+ids.length+" selected email"+(ids.length===1?"":"s")+" permanently?"))return;const button=$("bulkDeleteBtn");button.disabled=true;try{const result=await api("/admin/api/emails/bulk",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids})});selectedIds.clear();showNotice((result.deleted||ids.length)+" email"+((result.deleted||ids.length)===1?"":"s")+" deleted.");await loadEmails();}catch(error){showNotice(error.message,"error");}finally{button.disabled=false;}}
function openRuleModal(id,sender,recipient,subject){selectedEmailId=String(id||"");$("modalSender").value=String(sender||"");$("modalRecipient").value=String(recipient||"");$("modalSubject").value=String(subject||"");$("ruleModal").classList.add("show");$("ruleModal").setAttribute("aria-hidden","false");$("modalSubject").focus();}
function closeRuleModal(){selectedEmailId="";$("ruleModal").classList.remove("show");$("ruleModal").setAttribute("aria-hidden","true");}
async function confirmRule(){const sender=$("modalSender").value.trim(),recipient=$("modalRecipient").value.trim(),subject=$("modalSubject").value.trim();if(!sender||!recipient||!subject){showNotice("Sender, recipient and subject phrase are required.","error");return;}try{await api("/admin/emails/"+encodeURIComponent(selectedEmailId)+"/visibility",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_public:true})});await api("/admin/rules",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sender_pattern:sender,recipient_pattern:recipient,subject_pattern:subject})});closeRuleModal();showNotice("Email is public and the future-matching rule was created.");await refreshAll();}catch(error){showNotice(error.message,"error");}}
async function addRule(){const sender=$("newRuleSender").value.trim(),recipient=$("newRuleRecipient").value.trim(),subject=$("newRuleSubject").value.trim();if(!subject){showNotice("Subject phrase is required.","error");return;}try{await api("/admin/rules",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sender_pattern:sender,recipient_pattern:recipient||null,subject_pattern:subject})});$("newRuleSender").value="";$("newRuleRecipient").value="";$("newRuleSubject").value="";showNotice("Automatic public rule added.");await loadRules();}catch(error){showNotice(error.message,"error");}}
async function deleteRule(id){if(!confirm("Delete this automatic public rule?"))return;try{await api("/admin/rules/"+encodeURIComponent(id),{method:"DELETE"});showNotice("Rule deleted.");await loadRules();}catch(error){showNotice(error.message,"error");}}
async function syncMailboxes(){const b=$("syncBtn"),status=$("syncStatus");b.disabled=true;b.textContent="Syncing...";status.textContent="Synchronizing mailbox accounts...";try{const result=await api("/admin/sync/mailboxes",{method:"POST"});const s=(result&&result.result)||result||{};showNotice("Mailbox sync completed successfully.");status.textContent="Sync completed: created "+(s.created||0)+", updated "+(s.updated||0)+", disabled "+(s.disabled||0)+", unchanged "+(s.unchanged||0);}catch(error){showNotice("Mailbox sync failed: "+error.message,"error");status.textContent="Sync failed.";}finally{b.disabled=false;b.textContent="↻ Sync";}}
async function refreshAll(){try{await Promise.all([loadEmails(),loadRules()]);}catch(error){showNotice(error.message,"error");}}

document.addEventListener("DOMContentLoaded",()=>{
  $("loginBtn").addEventListener("click",login);$("tokenInput").addEventListener("keydown",e=>{if(e.key==="Enter")login();});$("logoutBtn").addEventListener("click",logout);$("refreshBtn").addEventListener("click",refreshAll);$("syncBtn").addEventListener("click",syncMailboxes);$("bulkDeleteBtn").addEventListener("click",bulkDelete);$("clearSelectionBtn").addEventListener("click",()=>{selectedIds.clear();updateSelectionUI();loadEmails();});$("selectAll").addEventListener("change",e=>{currentEmails.forEach(email=>{if(e.target.checked)selectedIds.add(String(email.id));else selectedIds.delete(String(email.id));});updateSelectionUI();loadEmails();});
  $("emailSearch").addEventListener("input",()=>{window.clearTimeout(searchTimer);searchTimer=window.setTimeout(()=>{page=1;loadEmails();},300);});$("visibilityFilter").addEventListener("change",()=>{page=1;loadEmails();});$("pageSize").addEventListener("change",()=>{page=1;pageSize=Number($("pageSize").value)||50;loadEmails();});$("prevPage").addEventListener("click",()=>{if(page>1){page--;loadEmails();}});$("nextPage").addEventListener("click",()=>{page++;loadEmails();});
  $("ruleSearch").addEventListener("input",()=>{rulePage=1;renderRules();});$("rulePrev").addEventListener("click",()=>{if(rulePage>1){rulePage--;renderRules();}});$("ruleNext").addEventListener("click",()=>{rulePage++;renderRules();});$("addRuleBtn").addEventListener("click",addRule);$("confirmRuleBtn").addEventListener("click",confirmRule);$("cancelRuleBtn").addEventListener("click",closeRuleModal);$("cancelRuleBtnTop").addEventListener("click",closeRuleModal);$("closeEmailBtn").addEventListener("click",closeEmail);$("closeEmailBtn2").addEventListener("click",closeEmail);
  ["emailModal","ruleModal"].forEach(id=>$(id).addEventListener("click",e=>{if(e.target.id===id){if(id==="emailModal")closeEmail();else closeRuleModal();}}));document.addEventListener("keydown",e=>{if(e.key==="Escape"){closeEmail();closeRuleModal();}});
});
`;
