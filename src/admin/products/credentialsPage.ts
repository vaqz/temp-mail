export const CREDENTIAL_MANAGEMENT_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="https://vaqzmobiz.com/assets/favicon.svg" type="image/svg+xml">
<title>Vaqz Mobiz · Credentials</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#10234d;font-family:Inter,system-ui,sans-serif}.wrap{width:min(1280px,100%);margin:auto;padding:24px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:22px;margin-bottom:18px;box-shadow:0 10px 30px rgba(15,43,117,.06)}.head{display:flex;justify-content:space-between;align-items:center;gap:12px}.actions{display:flex;gap:8px;flex-wrap:wrap}.btn{border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;background:#2563eb;color:white}.secondary{background:#eef2f7;color:#334155}.input,.select{width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;background:#fff}.toolbar{display:flex;gap:10px;margin-top:18px}.toolbar>*{flex:1}.table{overflow:auto;margin-top:15px}table{width:100%;border-collapse:collapse}th,td{padding:12px 10px;border-bottom:1px solid #edf2f7;text-align:left;font-size:13px}th{font-size:11px;color:#64748b;text-transform:uppercase}.badge{padding:5px 8px;border-radius:999px;font-size:11px;font-weight:800;background:#ecfdf3;color:#166534}.modal{display:none;position:fixed;inset:0;background:#0006;align-items:center;justify-content:center;padding:18px}.modal.open{display:flex}.box{width:min(700px,100%);max-height:90vh;overflow:auto;background:white;border-radius:18px;padding:24px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.full{grid-column:1/-1}.label{font-size:12px;font-weight:700;display:block;margin-bottom:6px}.hint{font-size:12px;color:#64748b;margin-top:5px}.notice{padding:11px;border-radius:10px;background:#eff6ff;color:#1e40af;margin-top:15px}.error{background:#fef2f2;color:#991b1b}@media(max-width:760px){.wrap{padding:12px}.grid{grid-template-columns:1fr}.full{grid-column:auto}.head{align-items:flex-start;flex-direction:column}}
</style>
</head>
<body>
<div class="wrap">
<section class="card"><div class="head"><div><h1 style="margin:0">Credential Inventory</h1><div style="color:#64748b;font-size:13px">Manage account inventory and ORIG / SOLO / SH availability.</div></div><div class="actions"><a class="btn secondary" href="/admin/products" style="text-decoration:none">← Products</a><button class="btn" id="add">+ Add Credential</button></div></div><div id="notice" class="notice" style="display:none"></div></section>
<section class="card"><div class="toolbar"><input id="search" class="input" placeholder="Search email, product or notes"><select id="status" class="select"><option value="ALL">All statuses</option><option>ACTIVE</option><option>RESET_REQUIRED</option><option>SUSPENDED</option><option>ARCHIVED</option></select></div><div class="table"><table><thead><tr><th>Product</th><th>Account</th><th>Status</th><th>Modes</th><th>Purchase Cost</th><th>Added</th><th></th></tr></thead><tbody id="body"><tr><td colspan="7">Loading…</td></tr></tbody></table></div></section>
</div>
<div id="modal" class="modal"><div class="box"><div class="head"><div><h2 id="title" style="margin:0">Add Credential</h2><div class="hint">Credential passwords will be added through a dedicated secure-secret flow rather than ordinary page storage.</div></div><button id="close" class="btn secondary">Close</button></div>
<form id="form" style="margin-top:18px"><input type="hidden" id="id"><div class="grid">
<div><label class="label">Product</label><select id="product" class="select" required></select></div>
<div><label class="label">Supplier</label><select id="supplier" class="select"><option value="">No supplier</option></select></div>
<div><label class="label">Account Email</label><input id="email" class="input" type="email" required></div>
<div><label class="label">Purchase Cost</label><input id="cost" class="input" type="number" min="0" step="0.01"></div>
<div><label class="label">Purchase Date</label><input id="date" class="input" type="date"></div>
<div><label class="label">Status</label><select id="credStatus" class="select"><option>ACTIVE</option><option>RESET_REQUIRED</option><option>SUSPENDED</option><option>ARCHIVED</option></select></div>
<div class="full"><label class="label">Internal Label</label><input id="label" class="input" placeholder="Optional label"></div>
<div class="full"><label class="label">Notes</label><textarea id="notes" class="input" style="min-height:90px"></textarea></div>
</div>
<div style="margin-top:18px"><strong>Inventory modes</strong><div class="hint">Select the modes this credential can be sold under. Slots are generated from the product-mode configuration.</div><div id="modes" style="margin-top:10px"></div></div>
<div class="actions" style="justify-content:flex-end;margin-top:22px"><button type="button" id="cancel" class="btn secondary">Cancel</button><button class="btn">Save Credential</button></div>
</form></div></div>
<script>
(function(){
 const key='vm_admin_token';
 const $=function(id){return document.getElementById(id)};
 const state={products:[],suppliers:[],items:[]};
 async function api(path,opt){opt=opt||{};const h=Object.assign({'Content-Type':'application/json'},opt.headers||{});const r=await fetch(path,Object.assign({},opt,{headers:h}));const d=await r.json().catch(function(){return {}});if(r.status===401){window.location.href='/admin';throw Error('Unauthorized. Redirecting to Administration.')}if(!r.ok)throw Error(d&&d.error&&d.error.message?d.error.message:'Request failed');return d}
 function notice(t,e){$('notice').textContent=t;$('notice').className='notice'+(e?' error':'');$('notice').style.display='block'}
 function esc(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})}
 function render(){
   const q=$('search').value.toLowerCase(),s=$('status').value;
   const rows=state.items.filter(function(x){return (s==='ALL'||x.status===s)&&((x.account_email||'').toLowerCase().includes(q)||(x.product_name||'').toLowerCase().includes(q)||(x.notes||'').toLowerCase().includes(q))});
   $('body').innerHTML=rows.length?rows.map(function(x){return '<tr><td><strong>'+esc(x.product_name||'—')+'</strong><div style="font-size:11px;color:#64748b">'+esc(x.product_code||'')+'</div></td><td>'+esc(x.account_email)+'</td><td><span class="badge">'+esc(x.status)+'</span></td><td>'+esc((x.modes||[]).map(function(m){return m.mode}).join(', ')||'—')+'</td><td>₱'+Number(x.purchase_cost||0).toFixed(2)+'</td><td>'+esc((x.purchase_date||'').slice(0,10)||'—')+'</td><td><button class="btn secondary edit" data-id="'+esc(x.id)+'">Edit</button></td></tr>'}).join(''):'<tr><td colspan="7">No credentials found.</td></tr>';
   document.querySelectorAll('.edit').forEach(function(b){b.onclick=function(){edit(b.dataset.id)}})
 }
 async function load(){try{const d=await api('/admin/api/credentials');state.items=d.items||[];state.products=d.products||[];state.suppliers=d.suppliers||[];render()}catch(e){notice(e.message,true)}}
 function fillOptions(){
   $('product').innerHTML=state.products.map(function(p){return '<option value="'+esc(p.id)+'">'+esc(p.code)+' — '+esc(p.name)+'</option>'}).join('');
   $('supplier').innerHTML='<option value="">No supplier</option>'+state.suppliers.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+'</option>'}).join('')
 }
 function modeOptions(selected){
   const p=state.products.find(function(x){return x.id===$('product').value});const modes=p&&p.variants?p.variants:[];
   $('modes').innerHTML=modes.map(function(m){return '<label style="display:block;margin:7px 0"><input type="checkbox" class="mode" value="'+esc(m.id)+'" '+(selected.includes(m.id)?'checked':'')+'> '+esc(m.mode)+' — '+esc(m.display_name||'')+' <span class="hint">('+esc(m.capacity)+' slots / '+esc(m.max_customers_per_credential)+' customers)</span></label>'}).join('')
 }
 function reset(){$('id').value='';$('email').value='';$('cost').value='';$('date').value='';$('label').value='';$('notes').value='';$('credStatus').value='ACTIVE';fillOptions();$('product').selectedIndex=0;modeOptions([])}
 function edit(id){const x=state.items.find(function(i){return i.id===id});if(!x)return;fillOptions();$('id').value=x.id;$('product').value=x.product_id||'';$('email').value=x.account_email||'';$('cost').value=x.purchase_cost==null?'':x.purchase_cost;$('date').value=(x.purchase_date||'').slice(0,10);$('label').value=x.label||'';$('notes').value=x.notes||'';$('credStatus').value=x.status||'ACTIVE';modeOptions((x.modes||[]).map(function(m){return m.product_mode_id}));$('title').textContent='Edit Credential';$('modal').classList.add('open')}
 $('product').onchange=function(){modeOptions([])};
 $('add').onclick=function(){$('id').value='';$('title').textContent='Add Credential';reset();$('modal').classList.add('open')};
 $('close').onclick=$('cancel').onclick=function(){$('modal').classList.remove('open')};
 $('search').oninput=render;$('status').onchange=render;
 $('form').onsubmit=async function(e){e.preventDefault();const modes=Array.from(document.querySelectorAll('.mode:checked')).map(function(x){return x.value});if(!modes.length){notice('Select at least one inventory mode.',true);return}try{await api('/admin/api/credentials',{method:'POST',body:JSON.stringify({id:$('id').value||null,product_id:$('product').value,supplier_id:$('supplier').value||null,account_email:$('email').value,purchase_cost:$('cost').value||null,purchase_date:$('date').value||null,status:$('credStatus').value,label:$('label').value,notes:$('notes').value,product_mode_ids:modes})});$('modal').classList.remove('open');await load();notice('Credential saved.')}catch(e){notice(e.message,true)}};
 load()
})();
</script>
</body></html>`;
