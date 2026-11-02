const iso = v => {
  if(typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(v) ||
    !Number.isFinite(Date.parse(v)) || new Date(v).toISOString()!==v.replace('Z','.000Z')) throw Error('Use valid UTC timestamps in whole seconds.');
  return v;
};
const integer = n=>{if(!Number.isSafeInteger(n))throw Error('Unsafe quantity or version.');return n;};
export async function evaluate({rows}){
  if(!Array.isArray(rows)||!rows.length)throw Error('Include at least one counted SKU.');
  const skus=new Set(),result=[];
  for(const row of rows){
    const {sku,base,count,version,movements}=row;
    if(typeof sku!=='string'||!sku.trim()||skus.has(sku)||!Array.isArray(movements))throw Error('Duplicate SKU or invalid row.');
    skus.add(sku);integer(base);integer(count);integer(version);
    if(count<0||base<0||version<0||iso(row.countedAt)<iso(row.snapshot))throw Error('Invalid count cut-off or negative input.');
    const seen=new Map();let atCount=base,current=base;
    for(const m of movements){
      if(typeof m.id!=='string'||!m.id||iso(m.at)<=row.snapshot)throw Error('Movement outside snapshot or missing ID.');
      const signature=JSON.stringify([m.at,integer(m.qty)]);
      if(seen.has(m.id)){if(seen.get(m.id)!==signature)throw Error('Conflicting movement '+m.id);continue;}
      seen.set(m.id,signature);
      current=integer(current+m.qty);
      if(m.at<=row.countedAt)atCount=integer(atCount+m.qty);
    }
    const adjustment=integer(count-atCount);
    result.push({sku,version,atCount,count,current,adjustment,after:integer(current+adjustment)});
  }
  const bytes=new TextEncoder().encode(JSON.stringify(rows));
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return {fingerprint:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''),
    decision:result.some(r=>r.after<0)?'blocked':'review',rows:result};
}
export async function apply(input,approvedFingerprint){
  const plan=await evaluate(input);
  if(plan.fingerprint!==approvedFingerprint)throw Error('Stale plan. Reconcile again before applying.');
  if(plan.decision==='blocked')throw Error('Negative projected balance. Investigate before applying.');
  return {decision:'applied',receipt:plan.fingerprint,balances:plan.rows.map(r=>({sku:r.sku,units:r.after,version:integer(r.version+1)}))};
}
