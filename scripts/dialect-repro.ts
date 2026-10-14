import fs from 'node:fs/promises';
import {answer} from '../lib/rag';
import {config} from '../lib/config';
async function main(){
 const rows=[];
 for(const question of (process.env.DIALECT_QUERIES||'شقد الساعات').split('|')){
  const events:unknown[]=[];const start=performance.now();
  const result=await answer(question,[],e=>events.push(e),{files:process.env.REPRO_FILE?[process.env.REPRO_FILE]:undefined,bypassCache:true,signal:AbortSignal.timeout(600000)});
  rows.push({question,ms:Math.round(performance.now()-start),result,events});
  console.log(JSON.stringify({question,ms:rows.at(-1)!.ms,text:result.text,query:result.query,method:result.method}));
 }
 await fs.writeFile(process.argv[2]||'dialect-repro.json',JSON.stringify({at:new Date().toISOString(),model:config.model,embedding:config.embedding,rows},null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
