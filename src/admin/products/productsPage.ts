export const PRODUCT_MANAGEMENT_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0f2b75">
<title>Vaqz Mobiz · Products</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#10234d;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{width:min(1280px,100%);margin:auto;padding:24px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 10px 30px rgba(15,43,117,.06);padding:22px;margin-bottom:18px}.header{display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{display:flex;align-items:center;gap:12px}.mark{width:44px;height:44px;border-radius:13px;background:#2563eb;color:#fff;display:grid;place-items:center;font-weight:800}.muted{color:#64748b;font-size:13px}.actions{display:flex;gap:8px;flex-wrap:wrap}.btn{border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;background:#2563eb;color:#fff}.btn.secondary{background:#eef2f7;color:#334155}.btn.danger{background:#dc2626}.btn:disabled{opacity:.5;cursor:not-allowed}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.search{flex:1;min-width:220px}.input,.select,.textarea{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;background:#fff;color:#10234d}.textarea{min-height:90px;resize:vertical}.table-wrap{overflow:auto;margin-top:16px}table{width:100%;border-collapse:collapse}th,td{padding:13px 10px;border-bottom:1px solid #edf2f7;text-align:left;font-size:13px}th{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}.badge{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:11px;font-weight:800}.badge.active{background:#ecfdf3;color:#166534}.badge.draft{background:#fff7ed;color:#9a3412}.badge.archived{background:#f1f5f9;color:#64748b}.empty{padding:30px;text-align:center;color:#64748b}.modal{position:fixed;inset:0;background:rgba(15,23,42,.45);display:none;align-items:center;justify-content:center;padding:18px;z-index:10}.modal.open{display:flex}.modal-box{width:min(760px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:24px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.field.full{grid-column:1/-1}.field label{display:block;font-size:12px;font-weight:700;margin-bottom:6px}.section-title{font-size:14px;font-weight:800;margin:22px 0 10px}.variant{border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:10px}.variant-head{display:flex;justify-content:space-between;align-items:center;gap:10px}.variant-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px}.notice{padding:11px 13px;border-radius:10px;background:#eff6ff;color:#1e40af;font-size:13px;margin-bottom:15px}.error{background:#fef2f2;color:#991b1b}.field-row{display:flex;gap:8px;align-items:end;margin-bottom:8px}.field-row>div{flex:1}.check{display:flex;align-items:center;gap:8px;font-size:13px;margin-top:8px}@media(max-width:700px){.wrap{padding:12px}.grid,.variant-grid{grid-template-columns:1fr}.field.full{grid-column:auto}.header{align-items:flex-start;flex-direction:column}}
</style>
</head>
<body>
<div class="wrap">
<section class="card">
 <div class="header">
  <div class="brand"><div class="mark">VM</div><div><h1 style="margin:0;font-size:24px">Product Management</h1><div class="muted">Vaqz Mobiz catalog, selling modes, pricing and customer-facing fields</div></div></div>
  <div class="actions"><a class="btn secondary" href="/admin" style="text-decoration:none">← Mail Admin</a><button id="newProduct" class="btn">+ Add Product</button></div>
 </div>
 <div id="notice" class="notice" style="display:none"></div>
</section>
<section class="card">
 <div class="toolbar"><div class="search"><input id="search" class="input" placeholder="Search products, codes or descriptions"></div><select id="status" class="select" style="max-width:180px"><option value="all">All statuses</option><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></div>
 <div class="table-wrap"><table><thead><tr><th>Product</th><th>Code</th><th>Status</th><th>Modes</th><th>Terms</th><th>Fields</th><th style="text-align:right">Action</th></tr></thead><tbody id="productsBody"><tr><td colspan="7" class="empty">Loading products…</td></tr></tbody></table></div>
</section>
</div>
<div id="modal" class="modal"><div class="modal-box">
 <div class="header"><div><h2 id="modalTitle" style="margin:0">Add Product</h2><div class="muted">Configure the product without editing the database directly.</div></div><button id="closeModal" class="btn secondary">Close</button></div>
 <form id="productForm">
  <input type="hidden" id="productId">
  <div class="grid" style="margin-top:18px">
   <div class="field"><label>Internal Product Code</label><input id="code" class="input" placeholder="NETX" required></div>
   <div class="field"><label>Customer-Facing Product Name</label><input id="name" class="input" placeholder="Netx" required></div>
   <div class="field full"><label>Description</label><textarea id="description" class="textarea" placeholder="Short internal/product description"></textarea></div>
   <div class="field"><label>Status</label><select id="productStatus" class="select"><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></div>
   <div class="field"><label>Default Term</label><select id="term" class="select"><option value="1">1 month</option><option value="3">3 months</option><option value="6">6 months</option><option value="12">12 months</option></select></div>
  </div>
  <div class="section-title">Selling Modes</div>
  <div id="variants"></div>
  <button type="button" id="addVariant" class="btn secondary">+ Add Mode</button>
  <div class="section-title">Customer Delivery Fields</div>
  <div id="fields"></div>
  <button type="button" id="addField" class="btn secondary">+ Add Field</button>
  <div class="section-title">Customer Rules</div>
  <div id="rules"></div>
  <button type="button" id="addRule" class="btn secondary">+ Add Rule</button>
  <div class="actions" style="justify-content:flex-end;margin-top:24px"><button type="button" id="cancel" class="btn secondary">Cancel</button><button class="btn" type="submit">Save Product</button></div>
 </form>
</div></div>
<script>
(function(){
 const tokenKey='vm_admin_token';
 const state={products:[],editing:null};
 const $=id=>document.getElementById(id);
 function token(){return sessionStorage.getItem(tokenKey)||''}
 async function api(path,options={}){const headers=Object.assign({'Content-Type':'application/json','Authorization':'Bearer '+token()},options.headers||{});const r=await fetch(path,Object.assign({},options,{headers}));const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error?.message||'Request failed');return data}
 function notice(message,error=false){$('notice').textContent=message;$('notice').className='notice'+(error?' error':'');$('notice').style.display='block';setTimeout(()=>{$('notice').style.display='none'},4500)}
 function render(){const q=$('search').value.toLowerCase();const st=$('status').value;const rows=state.products.filter(p=>(st==='all'||p.status===st)&&((p.name||'').toLowerCase().includes(q)||(p.code||'').toLowerCase().includes(q)||(p.description||'').toLowerCase().includes(q)));$('productsBody').innerHTML=rows.length?rows.map(p=>`<tr><td><strong>${esc(p.name)}</strong><div class="muted">${esc(p.description||'')}</div></td><td>${esc(p.code)}</td><td><span class="badge ${p.status}">${p.status}</span></td><td>${(p.variants||[]).map(v=>esc(v.mode)).join(', ')||'—'}</td><td>1 / 3 / 6 / 12 mo</td><td>${p.field_count||0}</td><td style="text-align:right"><button class="btn secondary edit" data-id="${p.id}">Edit</button></td></tr>`).join(''):'<tr><td colspan="7" class="empty">No products found.</td></tr>';document.querySelectorAll('.edit').forEach(b=>b.onclick=()=>openEdit(b.dataset.id))}
 function esc(v){return String(v??'').replace(/[&<>\"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\':'&#39;'}[m]))}
 function variantRow(v={mode:'ORIG',display_name:'',capacity:1,max_customers_per_credential:1}){const d=document.createElement('div');d.className='variant';d.innerHTML=`<div class="variant-head"><strong>Selling Mode</strong><button type="button" class="btn danger remove">Remove</button></div><div class="variant-grid"><div><label>Mode</label><select class="input mode"><option ${v.mode==='ORIG'?'selected':''}>ORIG</option><option ${v.mode==='SOLO'?'selected':''}>SOLO</option><option ${v.mode==='SH'?'selected':''}>SH</option></select></div><div><label>Display Name</label><input class="input display" value="${esc(v.display_name||'')}" placeholder="Netx Solo"></div><div><label>Capacity / Credential</label><input class="input capacity" type="number" min="1" value="${v.capacity||1}"></div></div><div class="variant-grid"><div><label>Max Customers / Credential</label><input class="input maxcustomers" type="number" min="1" value="${v.max_customers_per_credential||1}"></div></div>`;d.querySelector('.remove').onclick=()=>d.remove();$('variants').appendChild(d)}
 function fieldRow(v={field_key:'',label:'',field_type:'text',required:false,customer_visible:true}){const d=document.createElement('div');d.className='field-row';d.innerHTML=`<div><label>Key</label><input class="input fkey" value="${esc(v.field_key||'')}"></div><div><label>Customer Label</label><input class="input flabel" value="${esc(v.label||'')}"></div><div><label>Type</label><select class="input ftype"><option value="text">Text</option><option value="number">Number</option><option value="boolean">Yes/No</option><option value="date">Date</option><option value="datetime">Date & Time</option><option value="select">Select</option><option value="textarea">Long Text</option></select></div><button type="button" class="btn danger remove">×</button>`;d.querySelector('.ftype').value=v.field_type||'text';d.querySelector('.remove').onclick=()=>d.remove();$('fields').appendChild(d)}
 function ruleRow(v={title:'Usage Rule',rule_text:''}){const d=document.createElement('div');d.className='field-row';d.innerHTML=`<div><label>Title</label><input class="input rtitle" value="${esc(v.title||'')}"></div><div><label>Rule</label><input class="input rtext" value="${esc(v.rule_text||'')}"></div><button type="button" class="btn danger remove">×</button>`;d.querySelector('.remove').onclick=()=>d.remove();$('rules').appendChild(d)}
 function resetForm(){state.editing=null;$('productId').value='';$('code').value='';$('name').value='';$('description').value='';$('productStatus').value='draft';$('term').value='1';$('variants').innerHTML='';$('fields').innerHTML='';$('rules').innerHTML='';variantRow({mode:'ORIG',display_name:'',capacity:1,max_customers_per_credential:1});variantRow({mode:'SOLO',display_name:'',capacity:5,max_customers_per_credential:5});variantRow({mode:'SH',display_name:'',capacity:5,max_customers_per_credential:7});['Account Email','Account Password','Profile','Profile PIN','Expiry Date'].forEach((label,i)=>fieldRow({field_key:['account_email','account_password','profile','profile_pin','expiry_date'][i],label,field_type:i===4?'date':'text',customer_visible:true}));ruleRow({title:'Usage',rule_text:'Use only according to the product instructions. Do not change account credentials unless explicitly permitted.'});}
 function collect(){return {id:$('productId').value||null,code:$('code').value.trim(),name:$('name').value.trim(),description:$('description').value.trim(),status:$('productStatus').value,default_term_months:Number($('term').value),variants:[...$('variants').children].map(d=>({mode:d.querySelector('.mode').value,display_name:d.querySelector('.display').value.trim(),capacity:Number(d.querySelector('.capacity').value),max_customers_per_credential:Number(d.querySelector('.maxcustomers').value)})),fields:[...$('fields').children].map((d,i)=>({field_key:d.querySelector('.fkey').value.trim(),label:d.querySelector('.flabel').value.trim(),field_type:d.querySelector('.ftype').value,sort_order:i,customer_visible:true,required:false})),rules:[...$('rules').children].map((d,i)=>({title:d.querySelector('.rtitle').value.trim(),rule_text:d.querySelector('.rtext').value.trim(),sort_order:i,active:true}))}}
 function openNew(){resetForm();$('modalTitle').textContent='Add Product';$('modal').classList.add('open')}
 async function openEdit(id){const p=state.products.find(x=>x.id===id);if(!p)return;resetForm();state.editing=p;$('modalTitle').textContent='Edit Product';$('productId').value=p.id;$('code').value=p.code;$('name').value=p.name;$('description').value=p.description||'';$('productStatus').value=p.status;$('term').value=p.default_term_months||1;$('variants').innerHTML='';$('fields').innerHTML='';$('rules').innerHTML='';(p.variants||[]).forEach(variantRow);(p.fields||[]).forEach(fieldRow);(p.rules||[]).forEach(ruleRow);$('modal').classList.add('open')}
 async function load(){try{const d=await api('/admin/api/products');state.products=d.items||[];render()}catch(e){notice(e.message,true);$('productsBody').innerHTML='<tr><td colspan="7" class="empty">Unable to load products.</td></tr>'}}
 $('newProduct').onclick=openNew;$('closeModal').onclick=()=>$('modal').classList.remove('open');$('cancel').onclick=()=>$('modal').classList.remove('open');$('addVariant').onclick=()=>variantRow();$('addField').onclick=()=>fieldRow();$('addRule').onclick=()=>ruleRow();$('search').oninput=render;$('status').onchange=render;
 $('productForm').onsubmit=async e=>{e.preventDefault();try{await api('/admin/api/products',{method:'POST',body:JSON.stringify(collect())});$('modal').classList.remove('open');notice('Product saved successfully.');await load()}catch(err){notice(err.message,true)}};
 load();
})();
</script>
</body></html>`;
