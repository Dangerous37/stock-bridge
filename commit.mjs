import {readFile} from 'node:fs/promises';
import {commit,openLedger} from './ledger.mjs';
const [inputFile,approval,dbFile]=process.argv.slice(2);
try{
  if(!dbFile || !/^[a-f0-9]{64}$/.test(approval||''))throw Error('Usage: node commit.mjs case.json APPROVED_FINGERPRINT ledger.sqlite');
  const input=JSON.parse(await readFile(inputFile,'utf8'));
  const db=openLedger(dbFile);
  try{console.log(JSON.stringify(await commit(db,input,approval),null,2));}finally{db.close();}
}catch(error){console.error(error.message);process.exitCode=1;}
