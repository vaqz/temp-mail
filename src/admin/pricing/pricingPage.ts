export const PRICING_MANAGEMENT_PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#0f2b75"><link rel="icon" href="https://vaqzmobiz.com/assets/favicon.svg" type="image/svg+xml">
<title>Vaqz Mobiz · Pricing</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#10234d;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.wrap{width:min(1100px,100%);margin:auto;padding:24px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 10px 30px rgba(15,43,117,.06);padding:22px;margin-bottom:18px}.head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}.brand{display:flex;gap:12px;align-items:center}.mark{width:44px;height:44px;border-radius:13px;background:#2563eb;color:#fff;display:grid;place-items:center;font-weight:800}.muted,.hint{color:#64748b;font-size:13px}.btn{border:0;border-radius:10px;padding:11px 15px;font-weight:700;cursor:pointer;background:#2563eb;color:#fff;text-decoration:none;display:inline-block}.btn.secondary{background:#eef2f7;color:#334155}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:20px}.field label{display:block;font-size:12px;font-weight:800;margin-bottom:6px}.input{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:11px 12px;background:white;color:#10234d}.table-wrap{overflow:auto;margin-top:20px}table{width:100%;border-collapse:collapse}th,td{padding:13px 10px;border-bottom:1px solid #edf2f7;text-align:left;font-size:14px}th{font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}.price{max-width:220px}.status{padding:12px 14px;border-radius:10px;background:#eff6ff;color:#1e40af;margin-top:16px;font-size:13px}.status.error{background:#fef2f2;color:#991b1b}.actions{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin-top:20px}.badge{display:inline-block;padding:5px 8px;background:#f1f5f9;border-radius:8px;color:#475569;font-size:12px;font-weight:700}.empty{text-align:center;padding:24px;color:#64748b}@media(max-width:700px){.wrap{padding:12px}.grid{grid-template-columns:1fr}.card{padding:16px}}
</style></head>
<body><main class="wrap">
<section class="card"><div class="head"><div class="brand"><div class="mark">VM</div><div><h1 style="margin:0;font-size:24px">Pricing Management</h1><div class="muted">Set your own prices for every product, selling mode, reseller tier, and subscription term.</div></div></div><a class="btn secondary" href="/admin/products">← Products</a></div>
<div class="status">Prices are entered manually in pesos. No automatic reseller discount or percentage is applied. Previous prices are kept in history when a price changes.</div></section>
<section class="card">
<div class="grid">
<div class="field"><label for="product">Product</label><select id="product" class="input"><option>Loading…</option></select></div>
<div class="field"><label for="mode">Selling Mode</label><select id="mode" class="input"></select></div>
<div class="field"><label for="tier">Price List</label><select id="tier" class="input"></select></div>
</div>
<div class="head" style="margin-top:24px"><div><h2 style="margin:0;font-size:18px">Subscription Prices</h2><div class="hint">Leave a price blank if you do not offer that term. Use Add Term for any duration up to 120 months.</div></div><button id="addTerm" class="btn secondary" type="button">+ Add Term</button></div>
<div class="table-wrap"><table><thead><tr><th>Term</th><th>Price (₱)</th><th>Price per month</th><th></th></tr></thead><tbody id="terms"></tbody></table></div>
<div class="actions"><span class="hint">Changes apply to new pricing only. Existing orders are not changed.</span><button id="save" class="btn">Save Prices</button></div><div id="message" class="status" style="display:none"></div>
</section>
</main>
<script>
(function(){
 const $=id=>document.getElementById(id);const state={products:[],modes:[],tiers:[],prices:[]};const standard=[1,3,6,12];
 async function api(path,options){const res=await fetch(path,Object.assign({headers:{'Content-Type':'application/json'}},options||{}));const data=await res.json().catch(()=>({}));if(res.status===401){location.href='/admin';throw Error('Please sign in again.')}if(!res.ok)throw Error(data?.error?.message||'Request failed');return data}
 function msg(text,error){$('message').textContent=text;$('message').className='status'+(error?' error':'');$('message').style.display='block'}
 function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function selected(){return {product:$('product').value,mode:$('mode').value,tier:$('tier').value}}
 function filteredPrices(){const s=selected();return state.prices.filter(p=>p.product_id===s.product&&p.product_mode_id===s.mode&&p.pricing_tier_id===s.tier)}
 function renderTerms(){
   const prices=filteredPrices();const byTerm={};prices.forEach(p=>{byTerm[String(p.term_months)]=p});
   const terms=[...new Set([...standard,...prices.map(p=>Number(p.term_months))])].sort((a,b)=>a-b);
   $('terms').innerHTML=terms.map(term=>{const p=byTerm[String(term)];const value=p?Number(p.price).toFixed(2):'';return '<tr data-term="'+term+'"><td><strong>'+term+' month'+(term===1?'':'s')+'</strong>'+(standard.includes(term)?'':' <span class="badge">Custom</span>')+'</td><td><input class="input price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Not set" value="'+esc(value)+'" aria-label="Price for '+term+' months"></td><td class="per-month">'+(p?'₱'+(Number(p.price)/term).toFixed(2):'—')+'</td><td>'+(standard.includes(term)?'':'<button type="button" class="btn secondary remove">Remove</button>')+'</td></tr>'}).join('');
   $('terms').querySelectorAll('tr').forEach(row=>{const input=row.querySelector('input');input.addEventListener('input',()=>{const n=Number(input.value);row.querySelector('.per-month').textContent=input.value!==''&&Number.isFinite(n)&&n>=0?'₱'+(n/Number(row.dataset.term)).toFixed(2):'—'});const b=row.querySelector('.remove');if(b)b.onclick=()=>row.remove()})
 }
 function fillSelect(el,items,label,empty){el.innerHTML='';items.forEach(item=>{const o=document.createElement('option');o.value=item.id;o.textContent=label(item);el.appendChild(o)});if(!items.length){const o=document.createElement('option');o.value='';o.textContent=empty;el.appendChild(o)}}
 function updateModes(){const p=$('product').value;fillSelect($('mode'),state.modes.filter(m=>m.product_id===p&&m.active),m=>m.display_name+' ('+m.mode+')','No active selling modes');renderTerms()}
 function loadPrices(data){state.products=data.products||[];state.modes=data.modes||[];state.tiers=data.tiers||[];state.prices=data.prices||[];
 fillSelect($('product'),state.products.filter(p=>p.status==='ACTIVE'),p=>p.name+' ('+p.code+')','No active products');
 fillSelect($('tier'),state.tiers,t=>t.name,'No price lists');
 $('product').onchange=updateModes;$('mode').onchange=renderTerms;$('tier').onchange=renderTerms;updateModes()}
 $('addTerm').onclick=()=>{const existing=Array.from($('terms').querySelectorAll('tr')).map(r=>Number(r.dataset.term));let term=2;while(existing.includes(term)&&term<=120)term++;if(term>120){msg('You have reached the 120-month limit.',true);return}const row=document.createElement('tr');row.dataset.term=String(term);row.innerHTML='<td><strong>'+term+' months</strong> <span class="badge">Custom</span></td><td><input class="input price" type="number" min="0" step="0.01" inputmode="decimal" placeholder="Not set"></td><td class="per-month">—</td><td><button type="button" class="btn secondary remove">Remove</button></td>';row.querySelector('.remove').onclick=()=>row.remove();row.querySelector('input').oninput=()=>{const v=Number(row.querySelector('input').value);row.querySelector('.per-month').textContent=row.querySelector('input').value!==''&&v>=0?'₱'+(v/term).toFixed(2):'—'};$('terms').appendChild(row);row.querySelector('input').focus()};
 $('save').onclick=async()=>{const s=selected();if(!s.product||!s.mode||!s.tier){msg('Choose a product, selling mode, and price list first.',true);return}const items=Array.from($('terms').querySelectorAll('tr')).map(row=>({term_months:Number(row.dataset.term),price:row.querySelector('input').value.trim()})).filter(x=>x.price!=='').map(x=>({term_months:x.term_months,price:Number(x.price)}));if(items.some(x=>!Number.isInteger(x.term_months)||x.term_months<1||x.term_months>120||!Number.isFinite(x.price)||x.price<0)){msg('Check the terms and prices. Prices must be zero or higher.',true);return}const btn=$('save');btn.disabled=true;btn.textContent='Saving…';try{const out=await api('/admin/api/pricing',{method:'POST',body:JSON.stringify({...s,items})});state.prices=out.prices||state.prices;renderTerms();msg('Prices saved successfully.');}catch(e){msg(e.message,true)}finally{btn.disabled=false;btn.textContent='Save Prices'}};
 api('/admin/api/pricing').then(loadPrices).catch(e=>msg(e.message,true));
})();
</script></body></html>`;
