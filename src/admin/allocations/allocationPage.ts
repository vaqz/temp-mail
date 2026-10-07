export const ALLOCATION_CONSOLE_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="https://vaqzmobiz.com/assets/favicon.svg" type="image/svg+xml">
<title>Vaqz Mobiz · Sales & Allocation</title>
<style>
*{box-sizing:border-box}
body{margin:0;background:#f4f7fb;color:#10234d;font-family:Inter,system-ui,sans-serif}
.wrap{max-width:1280px;margin:auto;padding:24px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:22px;margin-bottom:18px;box-shadow:0 10px 30px rgba(15,43,117,.06)}
.header{display:flex;justify-content:space-between;align-items:center;gap:16px}
.brand{display:flex;gap:12px;align-items:center}
.mark{width:44px;height:44px;border-radius:13px;background:#2563eb;color:#fff;display:grid;place-items:center;font-weight:800}
.muted{color:#64748b;font-size:13px}
.btn{border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;background:#2563eb;color:#fff}
.btn.secondary{background:#eef2f7;color:#334155}
.btn:disabled{opacity:.55;cursor:not-allowed}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.field label{display:block;font-size:12px;font-weight:700;margin-bottom:6px}
.input,.select{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:11px 12px;background:#fff;color:#10234d}
.notice{padding:11px 13px;border-radius:10px;background:#eff6ff;color:#1e40af;margin-top:15px;font-size:13px}
.error{background:#fef2f2;color:#991b1b}
.slot-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:14px}
.slot{border:1px solid #dbe3ee;border-radius:12px;padding:13px;cursor:pointer}
.slot.available{border-color:#86efac;background:#f0fdf4}
.slot.full{border-color:#fecaca;background:#fef2f2;cursor:not-allowed}
.slot.selected{border-color:#2563eb;background:#eff6ff;box-shadow:0 0 0 2px rgba(37,99,235,.12)}
.slot input{margin-right:7px}
.summary{display:flex;gap:10px;flex-wrap:wrap;margin-top:15px}
.pill{padding:7px 10px;border-radius:999px;background:#eef2ff;font-size:12px;font-weight:700}
.modal-backdrop{position:fixed;inset:0;background:rgba(15,23,42,.58);display:none;align-items:center;justify-content:center;padding:20px;z-index:1000}
.modal-backdrop.open{display:flex}
.modal{width:min(560px,100%);background:#fff;border-radius:20px;box-shadow:0 24px 70px rgba(15,23,42,.28);overflow:hidden}
.modal-head{padding:24px 24px 16px;text-align:center}
.success-icon{width:58px;height:58px;border-radius:50%;margin:0 auto 12px;background:#dcfce7;color:#15803d;display:grid;place-items:center;font-size:30px;font-weight:900}
.modal-head h2{margin:0 0 6px;font-size:23px}
.modal-body{padding:0 24px 20px}
.order-number{text-align:center;font-size:14px;color:#64748b;margin-bottom:18px}
.detail-list{border:1px solid #e2e8f0;border-radius:14px;overflow:hidden}
.detail-row{display:flex;justify-content:space-between;gap:16px;padding:11px 13px;border-bottom:1px solid #eef2f7;font-size:13px}
.detail-row:last-child{border-bottom:0}
.detail-label{color:#64748b}
.detail-value{font-weight:700;text-align:right;word-break:break-word}
.status-ok{color:#15803d}.history-table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}.history-table th,.history-table td{padding:10px 9px;border-bottom:1px solid #eef2f7;text-align:left;vertical-align:top}.history-table th{font-size:11px;text-transform:uppercase;color:#64748b}.history-table td strong{display:block}.status-pill{display:inline-block;padding:5px 8px;border-radius:999px;background:#eef2ff;font-size:11px;font-weight:800}.history-wrap{overflow:auto}
.modal-actions{display:flex;gap:10px;padding:18px 24px 24px}
.modal-actions .btn{flex:1}
@media(max-width:760px){.wrap{padding:12px}.grid{grid-template-columns:1fr}.header{align-items:flex-start;flex-direction:column}.modal-actions{flex-direction:column}}
</style>
</head>
<body>
<div class="wrap">
<section class="card">
<div class="header">
<div class="brand"><div class="mark">VM</div><div><h1 style="margin:0;font-size:24px">Sales & Allocation Console</h1><div class="muted">Customer purchase → inventory slot → subscription allocation</div></div></div>
<div><a class="btn secondary" href="/admin/products" style="text-decoration:none">Products</a> <a class="btn secondary" href="/admin/credentials" style="text-decoration:none">Credentials</a></div>
</div>
<div id="notice" class="notice" style="display:none"></div>
</section>

<section class="card">
<div class="header"><div><h2 style="margin:0">Allocation History</h2><div class="muted">Recent customer allocations and their current status.</div></div><div class="actions"><button id="releaseExpired" class="btn secondary" type="button">Release Expired</button><button id="refreshHistory" class="btn secondary" type="button">Refresh</button></div></div>
<div id="historyLoading" class="muted" style="margin-top:14px">Loading allocation history…</div>
<div id="historyWrap" class="history-wrap" style="display:none"><table class="history-table"><thead><tr><th>Date</th><th>Customer</th><th>Product</th><th>Mode</th><th>Slot</th><th>Term</th><th>Status</th><th></th></tr></thead><tbody id="historyBody"></tbody></table></div>
</section>

<section class="card">
<h2 style="margin-top:0">1. Customer</h2>
<div class="grid">
<div class="field"><label>Customer Name</label><input id="name" class="input" placeholder="Customer name"></div>
<div class="field"><label>Email</label><input id="email" class="input" type="email" placeholder="customer@example.com"></div>
<div class="field"><label>Messenger User ID</label><input id="messenger" class="input" placeholder="Optional Chatrace/Messenger ID"></div>
<div class="field"><label>Pricing Tier</label><select id="tier" class="select"></select></div>
</div>
</section>

<section class="card">
<h2 style="margin-top:0">2. Product & Term</h2>
<div class="grid">
<div class="field"><label>Product</label><select id="product" class="select"></select></div>
<div class="field"><label>Selling Mode</label><select id="mode" class="select"><option value="">Select product first</option></select></div>
<div class="field"><label>Term</label><select id="term" class="select"><option value="1">1 Month</option><option value="3">3 Months</option><option value="6">6 Months</option><option value="12">12 Months</option></select></div>
<div class="field"><label>Unit Price</label><input id="price" class="input" type="number" min="0" step="0.01" placeholder="0.00"></div>
</div>
</section>

<section class="card">
<h2 style="margin-top:0">3. Available Inventory</h2>
<div id="inventory" class="muted">Select a product and selling mode.</div>
<div id="slots" class="slot-grid"></div>
</section>

<section class="card">
<h2 style="margin-top:0">4. Confirm Sale</h2>
<div id="summary" class="summary"></div>
<button id="allocate" class="btn" disabled>Create Paid Order & Allocate</button>
</section>
</div>

<div id="successModal" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="successTitle">
<div class="modal">
<div class="modal-head">
<div class="success-icon">✓</div>
<h2 id="successTitle">Sale Completed</h2>
<div class="muted">The order was created and inventory was allocated successfully.</div>
</div>
<div class="modal-body">
<div id="successOrderNumber" class="order-number"></div>
<div id="successDetails" class="detail-list"></div>
</div>
<div class="modal-actions">
<button id="closeSuccess" class="btn secondary" type="button">Done</button>
<button id="newSale" class="btn" type="button">Create New Sale</button>
</div>
</div>
</div>

<script>
(function(){
const state={products:[],tiers:[],modes:[],slots:[],selectedSlot:null};
const $=id=>document.getElementById(id);
async function api(path,opts){
opts=opts||{};
const headers=Object.assign({'Content-Type':'application/json'},opts.headers||{});
const r=await fetch(path,Object.assign({},opts,{headers}));
const d=await r.json().catch(()=>({}));
if(r.status===401){window.location.href='/admin';throw new Error('Unauthorized. Redirecting to Administration.');}
if(!r.ok)throw new Error(d?.error?.message||d?.error||'Request failed');
return d
}

function note(msg,bad){
$('notice').textContent=msg;
$('notice').className='notice'+(bad?' error':'');
$('notice').style.display='block';
}

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}

function selectedMode(){return state.modes.find(x=>x.id===$('mode').value)}

function selectedSlot(){return state.slots.find(x=>String(x.slot_id)===String(state.selectedSlot))}

function renderSummary(){
const m=selectedMode();
$('summary').innerHTML='<span class="pill">'+esc($('name').value.trim()||'Customer')+'</span><span class="pill">'+esc($('product').selectedOptions[0]?.text||'')+'</span><span class="pill">'+esc(m?.mode||'')+'</span><span class="pill">'+esc($('term').value)+' month(s)</span><span class="pill">₱'+Number($('price').value||0).toFixed(2)+'</span>';
}

function closeSuccess(){$('successModal').classList.remove('open')}

function openSuccess(d,details){
$('successOrderNumber').textContent='Order #'+esc(d.order_number);
$('successDetails').innerHTML=
'<div class="detail-row"><span class="detail-label">Customer</span><span class="detail-value">'+esc(details.name)+'</span></div>'+ 
'<div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">'+esc(details.email||'—')+'</span></div>'+ 
'<div class="detail-row"><span class="detail-label">Product</span><span class="detail-value">'+esc(details.product)+'</span></div>'+ 
'<div class="detail-row"><span class="detail-label">Selling Mode</span><span class="detail-value">'+esc(details.mode)+'</span></div>'+ 
'<div class="detail-row"><span class="detail-label">Term</span><span class="detail-value">'+esc(details.term)+' month(s)</span></div>'+ 
'<div class="detail-row"><span class="detail-label">Unit Price</span><span class="detail-value">₱'+Number(details.price||0).toFixed(2)+'</span></div>'+ 
'<div class="detail-row"><span class="detail-label">Inventory</span><span class="detail-value">Slot '+esc(details.slot_number)+'</span></div>'+ 
'<div class="detail-row"><span class="detail-label">Allocation</span><span class="detail-value status-ok">SUCCESSFUL</span></div>';
$('successModal').classList.add('open');
}

function resetForNewSale(){
closeSuccess();
$('name').value='';
$('email').value='';
$('messenger').value='';
$('tier').value='';
$('product').value='';
$('mode').innerHTML='<option value="">Select product first</option>';
$('term').value='1';
$('price').value='';
$('inventory').textContent='Select a product and selling mode.';
$('slots').innerHTML='';
$('summary').innerHTML='';
state.modes=[];state.slots=[];state.selectedSlot=null;
$('allocate').disabled=true;
window.scrollTo({top:0,behavior:'smooth'});
}

async function releaseAllocation(id){
	if(!confirm('Release this allocation? The slot will become available again.'))return;
	try{await api('/admin/api/allocation/'+encodeURIComponent(id)+'/release',{method:'POST'});await loadHistory();await loadSlots();note('Allocation released successfully.')}catch(e){note(e.message,true)}
}
async function releaseExpired(){
	if(!confirm('Release all allocations whose expiry date has passed?'))return;
	try{const d=await api('/admin/api/allocation/release-expired',{method:'POST'});await loadHistory();await loadSlots();note((d.released||0)+' expired allocation(s) released.')}catch(e){note(e.message,true)}
}
async function bindReleaseButtons(){
	document.querySelectorAll('.release-allocation').forEach(function(b){b.onclick=function(){releaseAllocation(b.dataset.id)}});
}
async function loadHistory(){
try{
	$('historyLoading').style.display='block';$('historyWrap').style.display='none';
	const d=await api('/admin/api/allocation/history');const items=d.items||[];
	$('historyBody').innerHTML=items.length?items.map(function(x){
		const customer=x.customer?.display_name||x.customer?.name||x.customer?.email||'—';
		const product=x.product?.name||x.product?.code||'—';const mode=x.mode?.mode||x.mode?.display_name||'—';
		return '<tr><td>'+esc(new Date(x.created_at).toLocaleString())+'</td><td><strong>'+esc(customer)+'</strong><span class="muted">'+esc(x.customer?.email||'')+'</span></td><td>'+esc(product)+'</td><td>'+esc(mode)+'</td><td>Slot '+esc(x.slot_number||'—')+(x.slot_name?' · '+esc(x.slot_name):'')+'</td><td>'+esc(x.term_months||'—')+' month(s)</td><td><span class="status-pill">'+esc(x.status||'—')+'</span></td><td>'+(x.status==='ACTIVE'?'<button class="btn secondary release-allocation" data-id="'+esc(x.id)+'">Release</button>':'—')+'</td></tr>';
	}).join(''):'<tr><td colspan="7" class="muted">No allocations recorded yet.</td></tr>';
	$('historyLoading').style.display='none';$('historyWrap').style.display='block';await bindReleaseButtons();
}catch(e){$('historyLoading').textContent=e.message}
}

async function init(){
try{
const d=await api('/admin/api/allocation/setup');
state.products=d.products||[];state.tiers=d.tiers||[];
$('product').innerHTML='<option value="">Select product</option>'+state.products.map(x=>'<option value="'+x.id+'">'+esc(x.name)+' ('+esc(x.code)+')</option>').join('');
$('tier').innerHTML='<option value="">Select pricing tier</option>'+state.tiers.map(x=>'<option value="'+x.id+'">'+esc(x.name)+'</option>').join('');
$('product').onchange=loadModes;
$('mode').onchange=loadSlots;
$('allocate').onclick=allocate;
$('closeSuccess').onclick=closeSuccess;
$('newSale').onclick=resetForNewSale;$('refreshHistory').onclick=loadHistory;$('releaseExpired').onclick=releaseExpired;
$('successModal').addEventListener('click',e=>{if(e.target===$('successModal'))closeSuccess()});
$('name').oninput=renderSummary;$('term').onchange=renderSummary;$('price').oninput=renderSummary;$('tier').onchange=renderSummary;
}catch(e){note(e.message,true)}
await loadHistory();
}

async function loadModes(){
state.selectedSlot=null;
$('slots').innerHTML='';
$('inventory').textContent='Select a selling mode to view inventory.';
$('allocate').disabled=true;
const id=$('product').value;
if(!id){$('mode').innerHTML='<option value="">Select product first</option>';return}
try{
const d=await api('/admin/api/allocation/modes?product_id='+encodeURIComponent(id));
state.modes=d.items||[];
$('mode').innerHTML='<option value="">Select selling mode</option>'+state.modes.map(x=>'<option value="'+x.id+'">'+esc(x.mode)+' — '+esc(x.display_name||x.mode)+'</option>').join('');
renderSummary();
}catch(e){note(e.message,true)}
}

async function loadSlots(){
state.selectedSlot=null;
$('allocate').disabled=true;
const mode=$('mode').value;
if(!mode){$('slots').innerHTML='';$('inventory').textContent='Select a selling mode to view inventory.';return}
try{
const d=await api('/admin/api/allocation/slots?product_mode_id='+encodeURIComponent(mode));
state.slots=d.items||[];
$('inventory').textContent=state.slots.length+' slot(s) found. Green slots have capacity.';
$('slots').innerHTML=state.slots.map(x=>{
const available=x.available_customers>0;
return '<label class="slot '+(available?'available':'full')+'" data-slot="'+esc(x.slot_id)+'"><input type="radio" name="slot" value="'+esc(x.slot_id)+'" '+(available?'':'disabled')+'><strong>Slot '+esc(x.slot_number)+'</strong><div class="muted">'+esc(x.active_allocations)+'/'+esc(x.max_customers)+' customers</div><div class="muted">'+(available?esc(x.available_customers)+' available':'Full')+'</div></label>'
}).join('');
document.querySelectorAll('input[name=slot]').forEach(r=>r.onchange=function(){
state.selectedSlot=this.value;
document.querySelectorAll('.slot').forEach(el=>el.classList.remove('selected'));
this.closest('.slot')?.classList.add('selected');
$('allocate').disabled=false;
renderSummary();
});
}catch(e){note(e.message,true)}
}

async function allocate(){
let details;
try{
const name=$('name').value.trim();
const email=$('email').value.trim();
const tier=$('tier').value;
const product=$('product').selectedOptions[0]?.text||'';
const mode=selectedMode();
const slot=selectedSlot();
if(!name||!tier||!$('product').value||!$('mode').value||!state.selectedSlot)throw new Error('Complete customer, product, mode, term and slot selection first.');
details={name,email,product,mode:mode?.mode||'',term:$('term').value,price:Number($('price').value||0),slot_number:slot?.slot_number||state.selectedSlot};
$('allocate').disabled=true;
$('allocate').textContent='Creating Order…';
const d=await api('/admin/api/allocation/allocate',{method:'POST',body:JSON.stringify({customer:{name,email,messenger_user_id:$('messenger').value.trim(),pricing_tier_id:tier},product_id:$('product').value,product_mode_id:$('mode').value,slot_id:state.selectedSlot,term_months:Number($('term').value),unit_price:Number($('price').value||0)})});
note('Order '+d.order_number+' created and slot allocated successfully.');
openSuccess(d,details);
await loadSlots();
await loadHistory();
}catch(e){note(e.message,true)}finally{$('allocate').disabled=!state.selectedSlot;$('allocate').textContent='Create Paid Order & Allocate'}
}

init();
})();
</script>
</body>
</html>`;
