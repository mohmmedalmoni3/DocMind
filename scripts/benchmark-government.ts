import fs from 'node:fs/promises';
import path from 'node:path';
import { answer } from '../lib/rag';
import { ingest } from '../lib/ingest';
import { config } from '../lib/config';
import { readIndex } from '../lib/index-store';
import { embed, ollama, generationModel } from '../lib/ollama';
import { numericCitationsSupported } from '../lib/citations';
import { governmentCases, checkGovernment, checkGovernmentPassages } from '../lib/government-evaluation';

async function main() {
  const output=process.argv[2] || 'government-benchmark.json';
  const subset=(process.env.GOV_CASES || '').split(',').filter(Boolean);
  const tests=subset.length ? governmentCases.filter(t=>subset.includes(t.id)) : governmentCases;
  if(path.resolve(config.docs)!==path.resolve('demo-packs/government-ar')) throw new Error('Set DOCS_DIR=./demo-packs/government-ar; evaluation must not modify the user library.');
  if(path.resolve(config.data)===path.resolve('data')) throw new Error('Use a separate INDEX_DIR for the fixture evaluation.');
  const start=performance.now();
  await ingest(e=>{if(e.type==='complete')console.log(JSON.stringify({ingest:e}));});
  const ingestionMs=Math.round(performance.now()-start);
  const model=await generationModel();
  const warm=performance.now();
  await ollama('/api/chat',{model,messages:[],stream:false,keep_alive:config.keepAlive,options:{num_ctx:config.contextSize}});
  await embed(['ما الوثائق المطلوبة للخدمة؟'],true);
  const warmupMs=Math.round(performance.now()-warm);
  const index=await readIndex();
  const report:{[key:string]:unknown;results:unknown[]}={at:new Date().toISOString(),model,embedding:config.embedding,indexRevision:index.updatedAt,fixture:'fictional-government-ar-v1',documents:index.documents,ingestionMs,warmupMs,answerCacheBypassed:true,limits:'Small synthetic Arabic fixture; term/source checks are not full semantic entailment or general accuracy. Warm sequential runs, not hardware guarantees.',results:[]};
  for(const test of tests){
    const began=performance.now();let firstTextMs:number|undefined;let evidenceMs:number|undefined;let replacements=0;let draft='';const drafts:string[]=[];
    const steps:unknown[]=[];
    try{
      const result=await answer(test.question,test.history||[],e=>{
        if(e.type==='sources')evidenceMs=e.evidenceMs;
        if(e.type==='token'){firstTextMs??=Math.round(performance.now()-began);draft+=e.text;}
        if(e.type==='replace'){replacements++;drafts.push(draft);draft=e.text;}
        if(e.type==='step'&&e.step.status==='done')steps.push(e.step);
      },{files:test.files,bypassCache:true,style:'brief',signal:AbortSignal.timeout(240_000)});
      const citations=[...result.text.matchAll(/\[(\d+)\]/g)].map(m=>Number(m[1]));
      const sourceCheck=test.evidenceFiles.every(file=>result.sources.some(s=>s.file===file&&citations.includes(s.citation))) && citations.every(n=>result.sources.some(s=>s.citation===n));
      const scopeCheck=result.sources.every(s=>test.files.includes(s.file));
      const numericCheck=numericCitationsSupported(result.text,result.sources);
      const factCheck=checkGovernment(test,result.text);
      const passageCheck=checkGovernmentPassages(test,result.text,result.sources);
      const row={id:test.id,question:test.question,expected:test.expected,answer:result.text,method:result.method,pass:factCheck&&sourceCheck&&scopeCheck&&numericCheck&&passageCheck,factCheck,sourceCheck,scopeCheck,numericCheck,passageCheck,ms:Math.round(performance.now()-began),firstTextMs,evidenceMs,replacements,drafts,steps,sources:result.sources};
      report.results.push(row);console.log(JSON.stringify({...row,sources:undefined,steps:undefined}));
    }catch(e){const row={id:test.id,pass:false,error:(e as Error).message,ms:Math.round(performance.now()-began)};report.results.push(row);console.log(JSON.stringify(row));}
    await fs.writeFile(output,JSON.stringify(report,null,2));
  }
  const rows=report.results as {pass:boolean;ms:number}[];
  const times=rows.map(r=>r.ms).sort((a,b)=>a-b);
  report.summary={passed:rows.filter(r=>r.pass).length,total:rows.length,medianMs:times[Math.floor(times.length/2)],observedP95Ms:times[Math.min(times.length-1,Math.ceil(times.length*.95)-1)]};
  await fs.writeFile(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report.summary));
  if(rows.some(r=>!r.pass))process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
