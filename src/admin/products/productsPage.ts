export const PRODUCT_MANAGEMENT_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0f2b75">
<link rel="icon" href="https://vaqzmobiz.com/assets/favicon.svg" type="image/svg+xml">
<title>Vaqz Mobiz · Products</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#10234d;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{width:min(1280px,100%);margin:auto;padding:24px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 10px 30px rgba(15,43,117,.06);padding:22px;margin-bottom:18px}.header{display:flex;align-items:center;justify-content:space-between;gap:16px}.brand{display:flex;align-items:center;gap:12px}.mark{width:44px;height:44px;border-radius:13px;background:#2563eb;color:#fff;display:grid;place-items:center;font-weight:800}.muted{color:#64748b;font-size:13px}.actions{display:flex;gap:8px;flex-wrap:wrap}.btn{border:0;border-radius:10px;padding:10px 14px;font-weight:700;cursor:pointer;background:#2563eb;color:#fff}.btn.secondary{background:#eef2f7;color:#334155}.btn.danger{background:#dc2626}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.search{flex:1;min-width:220px}.input,.select,.textarea{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:10px 12px;background:#fff;color:#10234d}.textarea{min-height:90px;resize:vertical}.table-wrap{overflow:auto;margin-top:16px}table{width:100%;border-collapse:collapse}th,td{padding:13px 10px;border-bottom:1px solid #edf2f7;text-align:left;font-size:13px}th{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}.badge{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:11px;font-weight:800}.badge.active{background:#ecfdf3;color:#166534}.badge.draft{background:#fff7ed;color:#9a3412}.badge.archived{background:#f1f5f9;color:#64748b}.empty{padding:30px;text-align:center;color:#64748b}.modal{position:fixed;inset:0;background:rgba(15,23,42,.45);display:none;align-items:center;justify-content:center;padding:18px;z-index:10}.modal.open{display:flex}.modal-box{width:min(800px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;padding:24px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.field.full{grid-column:1/-1}.field label{display:block;font-size:12px;font-weight:700;margin-bottom:6px}.section-title{font-size:14px;font-weight:800;margin:22px 0 10px}.mode-card{border:1px solid #e2e8f0;border-radius:12px;padding:12px;margin-bottom:10px}.mode-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:10px}.row{display:flex;gap:8px;align-items:end;margin-bottom:8px}.row>div{flex:1}.notice{padding:11px 13px;border-radius:10px;background:#eff6ff;color:#1e40af;font-size:13px;margin-bottom:15px}.error{background:#fef2f2;color:#991b1b}.hint{font-size:12px;color:#64748b;margin-top:5px}@media(max-width:800px){.wrap{padding:12px}.grid,.mode-grid{grid-template-columns:1fr}.field.full{grid-column:auto}.header{align-items:flex-start;flex-direction:column}}
</style>
</head>
<body>
<div class="wrap">
<section class="card">
 <div class="header">
  <div class="brand"><div class="mark">VM</div><div><h1 style="margin:0;font-size:24px">Product Management</h1><div class="muted">Vaqz Mobiz catalog, selling modes, pricing and customer-facing fields</div></div></div>
  <div class="actions"><a class="btn secondary" href="/admin" style="text-decoration:none">← Mail Admin</a><a class="btn secondary" href="/admin/pricing" style="text-decoration:none">Manage Pricing</a><button id="newProduct" class="btn">+ Add Product</button></div>
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
   <div class="field full"><label>Description</label><textarea id="description" class="textarea" placeholder="Short product description"></textarea></div>
   <div class="field"><label>Status</label><select id="productStatus" class="select"><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></div>
  </div>
  <div class="section-title">Selling Modes</div>
  <div class="hint">ORIG = whole credential, SOLO = one customer owns a profile/slot, SH = controlled shared capacity.</div>
  <div id="modes" style="margin-top:10px"></div>
  <button type="button" id="addMode" class="btn secondary">+ Add Mode</button>
  <div class="section-title">Customer Delivery Fields</div>
  <div class="hint">These define what Chatrace can receive when an order is fulfilled. Keep the fields generic so every product can use them or set unused values to n/a.</div>
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
 const $=function(id){return document.getElementById(id)};
 async function api(path,options){
   options=options||{};
   const headers=Object.assign({'Content-Type':'application/json'},options.headers||{});
   const response=await fetch(path,Object.assign({},options,{headers:headers}));
   const data=await response.json().catch(function(){return {}});
   if(response.status===401){window.location.href='/admin';throw new Error('Unauthorized. Redirecting to Administration.');}
   if(!response.ok)throw new Error(data&&data.error&&data.error.message?data.error.message:'Request failed');
   return data;
 }
 function esc(value){
   return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]});
 }
 function notice(message,isError){
   $('notice').textContent=message;
   $('notice').className='notice'+(isError?' error':'');
   $('notice').style.display='block';
   setTimeout(function(){$('notice').style.display='none'},4500);
 }
 function render(){
   const query=$('search').value.toLowerCase();
   const status=$('status').value;
   const rows=state.products.filter(function(p){
     return (status==='all'||p.status===status)&&((p.name||'').toLowerCase().includes(query)||(p.code||'').toLowerCase().includes(query)||(p.description||'').toLowerCase().includes(query));
   });
   $('productsBody').innerHTML=rows.length?rows.map(function(p){
     const modes=(p.variants||[]).map(function(v){return esc(v.mode)}).join(', ')||'—';
     return '<tr><td><strong>'+esc(p.name)+'</strong><div class="muted">'+esc(p.description||'')+'</div></td><td>'+esc(p.code)+'</td><td><span class="badge '+esc(p.status)+'">'+esc(p.status)+'</span></td><td>'+modes+'</td><td>1 / 3 / 6 / 12 mo</td><td>'+String(p.field_count||0)+'</td><td style="text-align:right"><button class="btn secondary edit" data-id="'+esc(p.id)+'">Edit</button></td></tr>';
   }).join(''):'<tr><td colspan="7" class="empty">No products found.</td></tr>';
   document.querySelectorAll('.edit').forEach(function(button){button.onclick=function(){openEdit(button.dataset.id)}});
 }
 function modeRow(value){
   value=value||{};
   const box=document.createElement('div');
   box.className='mode-card';
   box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><strong>Selling Mode</strong><button type="button" class="btn danger remove">Remove</button></div>'+
   '<div class="mode-grid">'+
   '<div><label>Mode</label><select class="input mode"><option value="ORIG">ORIG</option><option value="SOLO">SOLO</option><option value="SH">SH</option></select></div>'+
   '<div><label>Display Name</label><input class="input display" placeholder="Netx Solo"></div>'+
   '<div><label>Capacity / Credential</label><input class="input capacity" type="number" min="1" value="'+esc(value.capacity||1)+'"></div>'+ 
   '<div><label>Max Customers / Credential</label><input class="input maxcustomers" type="number" min="1" value="'+esc(value.max_customers_per_credential||1)+'"></div></div>';
   box.querySelector('.mode').value=value.mode||'ORIG';
   box.querySelector('.display').value=value.display_name||'';
   box.querySelector('.remove').onclick=function(){box.remove()};
   $('modes').appendChild(box);
 }
 function fieldRow(value){
   value=value||{};
   const row=document.createElement('div');
   row.className='row';
   row.innerHTML='<div><label>Key</label><input class="input fkey" placeholder="account_email"></div>'+ 
   '<div><label>Customer Label</label><input class="input flabel" placeholder="Account Email"></div>'+ 
   '<div><label>Type</label><select class="input ftype"><option value="text">Text</option><option value="number">Number</option><option value="boolean">Yes / No</option><option value="date">Date</option><option value="datetime">Date & Time</option><option value="select">Select</option><option value="textarea">Long Text</option></select></div>'+ 
   '<button type="button" class="btn danger remove">×</button>';
   row.querySelector('.fkey').value=value.field_key||'';
   row.querySelector('.flabel').value=value.label||'';
   row.querySelector('.ftype').value=value.field_type||'text';
   row.querySelector('.remove').onclick=function(){row.remove()};
   $('fields').appendChild(row);
 }
 function ruleRow(value){
   value=value||{};
   const row=document.createElement('div');
   row.className='row';
   row.innerHTML='<div><label>Title</label><input class="input rtitle" placeholder="Usage Rule"></div>'+ 
   '<div><label>Rule</label><input class="input rtext" placeholder="Do not change account credentials."></div>'+ 
   '<button type="button" class="btn danger remove">×</button>';
   row.querySelector('.rtitle').value=value.title||'';
   row.querySelector('.rtext').value=value.rule_text||'';
   row.querySelector('.remove').onclick=function(){row.remove()};
   $('rules').appendChild(row);
 }
 function defaultFields(){
   const values=[['account_email','Account Email','text'],['account_password','Account Password','text'],['profile','Profile','text'],['profile_pin','Profile PIN','text'],['expiry_date','Expiry Date','date']];
   values.forEach(function(v){fieldRow({field_key:v[0],label:v[1],field_type:v[2]})});
 }
 function resetForm(){
   state.editing=null;$('productId').value='';$('code').value='';$('name').value='';$('description').value='';$('productStatus').value='draft';
   $('modes').innerHTML='';$('fields').innerHTML='';$('rules').innerHTML='';
   modeRow({mode:'ORIG',capacity:1,max_customers_per_credential:1});
   modeRow({mode:'SOLO',capacity:5,max_customers_per_credential:5});
   modeRow({mode:'SH',capacity:5,max_customers_per_credential:7});
   defaultFields();
   ruleRow({title:'Usage',rule_text:'Use only according to the product instructions. Do not change account credentials unless explicitly permitted.'});
 }
 function collect(){
   return {
     id:$('productId').value||null,
     code:$('code').value.trim(),
     name:$('name').value.trim(),
     description:$('description').value.trim(),
     status:$('productStatus').value,
     variants:Array.from($('modes').children).map(function(box){return {mode:box.querySelector('.mode').value,display_name:box.querySelector('.display').value.trim(),capacity:Number(box.querySelector('.capacity').value),max_customers_per_credential:Number(box.querySelector('.maxcustomers').value)}}),
     fields:Array.from($('fields').children).map(function(row,i){return {field_key:row.querySelector('.fkey').value.trim(),label:row.querySelector('.flabel').value.trim(),field_type:row.querySelector('.ftype').value,sort_order:i,customer_visible:true,required:false}}),
     rules:Array.from($('rules').children).map(function(row,i){return {title:row.querySelector('.rtitle').value.trim(),rule_text:row.querySelector('.rtext').value.trim(),sort_order:i,active:true}})
   };
 }
 function openNew(){resetForm();$('modalTitle').textContent='Add Product';$('modal').classList.add('open')}
 function openEdit(id){
   const product=state.products.find(function(item){return item.id===id});
   if(!product)return;
   state.editing=product;$('modalTitle').textContent='Edit Product';$('productId').value=product.id;$('code').value=product.code;$('name').value=product.name;$('description').value=product.description||'';$('productStatus').value=product.status;
   $('modes').innerHTML='';$('fields').innerHTML='';$('rules').innerHTML='';
   (product.variants||[]).forEach(modeRow);(product.fields||[]).forEach(fieldRow);(product.rules||[]).forEach(ruleRow);
   $('modal').classList.add('open');
 }
 async function load(){
   try{const data=await api('/admin/api/products');state.products=data.items||[];render()}
   catch(error){notice(error.message,true);$('productsBody').innerHTML='<tr><td colspan="7" class="empty">Unable to load products.</td></tr>'}
 }
 $('newProduct').onclick=openNew;
 $('closeModal').onclick=function(){$('modal').classList.remove('open')};
 $('cancel').onclick=function(){$('modal').classList.remove('open')};
 $('addMode').onclick=function(){modeRow()};
 $('addField').onclick=function(){fieldRow()};
 $('addRule').onclick=function(){ruleRow()};
 $('search').oninput=render;$('status').onchange=render;
 $('productForm').onsubmit=async function(event){
   event.preventDefault();
   const payload=collect();
   if(!payload.code||!payload.name){notice('Product code and name are required.',true);return}
   try{await api('/admin/api/products',{method:'POST',body:JSON.stringify(payload)});$('modal').classList.remove('open');notice('Product saved successfully.');await load()}
   catch(error){notice(error.message,true)}
 };
 load();
})();
</script>
</body>
</html>`;
