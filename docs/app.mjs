import * as engine from './engine.mjs';
const byId=id=>document.getElementById(id);
const actions=byId('actions'),results=byId('results');
const api=location.pathname.startsWith('/desk/');
let data,report,original;
async function execute(operation,input){
  if(!api)return operation==='evaluate'?engine.evaluate(input):engine.apply(input.input,input.approvedFingerprint);
  const res=await fetch('/api/'+operation,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  const result=await res.json();if(!res.ok)throw Error(result.error);return result;
}
function element(tag,text){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;}
function button(parent,title,change){
  const btn=element('button',title);parent.append(btn);btn.onclick=()=>run(change);
}
function article(label,title){const card=element('article');card.className='card';const badge=element('span',label);badge.className='badge';card.append(badge,element('h3',title));results.append(card);return card;}
function stats(card,pairs){const dl=element('dl');dl.className='stats';for(const [k,v] of pairs){const box=element('div');box.append(element('dt',k),element('dd',v));dl.append(box);}card.append(dl);}
let busy=false;
async function run(change){
  if(busy)return;busy=true;
  const previous=structuredClone(data);
  try{
    if(change)await change();
    report=await execute('evaluate',data);
    results.replaceChildren();render();byId('input').value=JSON.stringify(data,null,2);
    byId('decision').textContent=applied?'APPLIED':report.decision.toUpperCase();byId('status').textContent=summary();
  }catch(error){data=previous;byId('status').textContent=error.message;}
  finally{busy=false;}
}
let signed=null,applied=null;
function controls(){
  button(actions,'Approve this plan',()=>{if(report.decision!=='review'||applied)throw Error('Restore or revise the case first.');signed=report.fingerprint;});
  button(actions,'Receive late shipment',()=>{if(applied)throw Error('Restore the example first.');const row=data.rows[0];
    row.movements.push({id:crypto.randomUUID(),at:new Date(Date.parse(row.countedAt)+7200000).toISOString().replace('.000Z','Z'),qty:3});row.version++;});
  button(actions,'Apply approved plan',async()=>{if(applied)throw Error('Already applied in this case.');if(!signed)throw Error('Approve the reviewed plan first.');
    applied=await execute('apply',{input:data,approvedFingerprint:signed});});
}
function render(){
  for(const r of report.rows){
    const card=article(r.sku+' / revision '+r.version, 'Adjustment '+(r.adjustment>0?'+':'')+r.adjustment+' units');
    stats(card,[['At count time',r.atCount],['Physical count',r.count],['Current book',r.current],['After adjustment',r.after]]);
  }
  if(applied)results.append(element('p','Batch receipt · '+applied.receipt.slice(0,16)));
}
function summary(){return applied?'Applied to the sandbox ledger. Export the receipt.':signed===report.fingerprint?'Approval recorded. Ready to apply.':signed?'Input changed since approval. Review the revised balance.':'Inspect the count-time and current balances before approving.';}
function resetCase(){data=structuredClone(original);signed=null;applied=null;}
byId('load').onclick=()=>run(()=>{data=JSON.parse(byId('input').value);applied=null;});
byId('reset').onclick=()=>run(resetCase);
byId('export').onclick=()=>{
  if(!report)return;const a=element('a');const url=URL.createObjectURL(new Blob([JSON.stringify(applied??report,null,2)],{type:'application/json'}));
  a.href=url;a.download='stock-bridge-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
try{original=await (await fetch('./example.json')).json();resetCase();controls();byId('mode').textContent=api?'LOCAL API':'BROWSER SANDBOX';await run();}
catch(error){byId('status').textContent=error.message;}
