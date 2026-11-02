import {DatabaseSync} from 'node:sqlite';
import {evaluate,apply} from './docs/engine.mjs';

// One warehouse batch per file. All writers use the same versioned projection.
export async function commit(db,input,approval){
  const proposed=await apply(input,approval);
  db.exec(`PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS balances(sku TEXT PRIMARY KEY,units INTEGER NOT NULL,version INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY,payload TEXT NOT NULL);`);
  const plan=await evaluate(input);
  db.exec('BEGIN IMMEDIATE');
  try{
    const prior=db.prepare('SELECT payload FROM receipts WHERE id=?').get(approval);
    if(prior){db.exec('COMMIT');return {...JSON.parse(prior.payload),replay:true};}
    for(const row of plan.rows){
      db.prepare('INSERT OR IGNORE INTO balances VALUES(?,?,?)').run(row.sku,row.current,row.version);
      const updated=db.prepare('UPDATE balances SET units=?,version=version+1 WHERE sku=? AND version=? AND units=?')
        .run(row.after,row.sku,row.version,row.current);
      if(updated.changes!==1)throw Error('Stored balance changed for '+row.sku+'. Entire batch rolled back.');
    }
    db.prepare('INSERT INTO receipts VALUES(?,?)').run(approval,JSON.stringify(proposed));
    db.exec('COMMIT');
    return {...proposed,replay:false};
  }catch(error){db.exec('ROLLBACK');throw error;}
}

export function openLedger(path){return new DatabaseSync(path);}
