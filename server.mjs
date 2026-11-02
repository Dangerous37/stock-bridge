import http from 'node:http';
import {readFile} from 'node:fs/promises';
import * as engine from './docs/engine.mjs';

const assets=new Map([['','index.html'],['style.css','style.css'],['app.mjs','app.mjs'],['engine.mjs','engine.mjs'],['example.json','example.json']]);
const media={html:'text/html',mjs:'application/javascript',json:'application/json',css:'text/css'};
export function server(){
  return http.createServer(async(req,res)=>{
    function json(status,body){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));}
    try{
      if(req.method==='GET' && req.url==='/'){res.writeHead(302,{Location:'/desk/'});return res.end();}
      if(req.method==='GET' && req.url.startsWith('/desk/')){
        const file=assets.get(req.url.slice(6));
        if(!file)return json(404,{error:'Unknown asset'});
        const content=await readFile(new URL('./docs/'+file,import.meta.url));
        res.writeHead(200,{'Content-Type':media[file.split('.').at(-1)]+'; charset=utf-8'});return res.end(content);
      }
      if(req.method!=='POST' || !['/api/evaluate','/api/apply'].includes(req.url))return json(404,{error:'Unknown route'});
      if(req.headers['content-type']?.split(';')[0]!=='application/json')return json(415,{error:'Expected JSON'});
      let size=0;const chunks=[];
      for await(const chunk of req){size+=chunk.length;if(size>262144)return json(413,{error:'Case exceeds 256 KiB'});chunks.push(chunk);}
      const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const result=req.url==='/api/apply'?await engine.apply(input.input,input.approvedFingerprint):await engine.evaluate(input);
      return json(200,result);
    }catch(error){return json(400,{error:error.message});}
  });
}
