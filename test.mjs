import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFileSync} from 'node:fs';
import * as engine from './docs/engine.mjs';
import {server} from './server.mjs';
import {openLedger,commit} from './ledger.mjs';
const fixture=()=>JSON.parse(readFileSync(new URL('./docs/example.json',import.meta.url)));
test('ledger replays a receipt and rolls back all rows on version conflict',async()=>{
  const db=openLedger(':memory:');
  try{
    const d=fixture(),p=await engine.evaluate(d);
    assert.equal((await commit(db,d,p.fingerprint)).replay,false);
    assert.equal((await commit(db,d,p.fingerprint)).replay,true);
    d.rows[0].sku='UNCOMMITTED';
    const next=await engine.evaluate(d);
    await assert.rejects(commit(db,d,next.fingerprint),/rolled back/);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM balances').get().n,2);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM receipts').get().n,1);
  }finally{db.close();}
});
test('post-count shipment retained after adjustment',async()=>{
  const d=fixture();const p=await engine.evaluate(d);
  assert.deepEqual([p.rows[0].atCount,p.rows[0].adjustment,p.rows[0].current,p.rows[0].after],[92,-2,87,85]);
  assert.equal((await engine.apply(d,p.fingerprint)).balances[0].units,85);
  d.rows[1].version++;await assert.rejects(engine.apply(d,p.fingerprint),/Stale/);
});
test('identical movement replay is safe; conflicting replay blocks entire plan',async()=>{
  const d=fixture();d.rows[0].movements.push({...d.rows[0].movements[0]});
  assert.equal((await engine.evaluate(d)).rows[0].after,85);
  d.rows[0].movements.at(-1).qty=200;await assert.rejects(engine.evaluate(d),/Conflicting/);
});
test('negative projected inventory prevents application',async()=>{
  const d=fixture();d.rows[0].count=1;const p=await engine.evaluate(d);
  assert.equal(p.decision,'blocked');await assert.rejects(engine.apply(d,p.fingerprint),/Negative/);
});
test('HTTP review agrees with the browser engine and rejects invalid data',async()=>{
  const app=server();app.listen(0,'127.0.0.1');await once(app,'listening');
  try{
    const url='http://127.0.0.1:'+app.address().port+'/api/evaluate';
    const post=body=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body});
    const r=await post(JSON.stringify(fixture()));assert.equal(r.status,200);assert.deepEqual(await r.json(),await engine.evaluate(fixture()));
    assert.equal((await post('{}')).status,400);
  }finally{await new Promise(done=>app.close(done));}
});
