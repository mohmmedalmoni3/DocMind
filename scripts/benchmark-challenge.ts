import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {config} from '../lib/config';
import {ingest} from '../lib/ingest';
import {answer} from '../lib/rag';
import {generationModel,ollama,embed} from '../lib/ollama';
import {normalizedAnswer} from '../lib/normalization';
import {numericCitationsSupported} from '../lib/citations';
type Case={id:string;question:string;required:string[];sourceFile?:string;sourceFiles?:string[];sourceTerms?:string[];clarification?:boolean;refusal?:boolean;history?:{role:'user'|'assistant';content:string}[]};
async function main(){
 if(config.docs!==path.resolve('demo-packs/challenge-ten') || config.data===path.resolve('data'))throw Error('Use the isolated challenge fixture/index.');
 const raw=await fs.readFile('demo-packs/challenge-ten-cases.json','utf8');
 const selected=(process.env.CHALLENGE_CASES||'').split(',').filter(Boolean);
 const cases=(JSON.parse(raw).cases as Case[]).filter(c=>!selected.length||selected.includes(c.id));
 if(!cases.length)throw Error('No selected cases.');
 const report:any={at:new Date().toISOString(),casesHash:createHash('sha256').update(raw).digest('hex'),mode:config.serviceContext,strictModel:config.strictModel,answerCacheBypassed:true,promptCache:'Ollama internal prompt cache remains enabled; sequential timing comparison is descriptive, not causal.',results:[]};
 const start=performance.now();await ingest(()=>{});report.ingestMs=Math.round(performance.now()-start);
 report.model=await generationModel();report.embedding=config.embedding;
 const warm=performance.now();await ollama('/api/chat',{model:report.model,messages:[],stream:false,keep_alive:config.keepAlive,options:{num_ctx:config.contextSize}});await embed(['اختبار استرجاع الخدمة'],true);report.warmupMs=Math.round(performance.now()-warm);
 const output=process.argv[2]||'challenge-results.json';
 for(const test of cases){const began=performance.now();let firstTextMs:number|undefined;let evidenceMs:number|undefined;
  try{const result=await answer(test.question,test.history||[],e=>{if(e.type==='token')firstTextMs??=Math.round(performance.now()-began);if(e.type==='sources')evidenceMs=e.evidenceMs;},{bypassCache:true,signal:AbortSignal.timeout(240000)});
   const cited=[...result.text.matchAll(/\[(\d+)\]/g)].map(m=>Number(m[1]));
   const factCheck=test.required.every(term=>normalizedAnswer(result.text).includes(normalizedAnswer(term)));
   const sourceCheck=(test.sourceFiles|| (test.sourceFile?[test.sourceFile]:[])).every(file=>result.sources.some(s=>s.file===file&&cited.includes(s.citation)&&(test.sourceTerms||[]).every(term=>normalizedAnswer(s.text).includes(normalizedAnswer(term)))));
   const scopeCheck=!test.sourceFile||result.sources.every(s=>s.file===test.sourceFile);
   const numericCheck=numericCitationsSupported(result.text,result.sources);
   const clarificationCheck=!test.clarification||(result.sources.length===0&&cited.length===0);
   const row={id:test.id,question:test.question,answer:result.text,method:result.method||'clarification',pass:factCheck&&sourceCheck&&scopeCheck&&numericCheck&&clarificationCheck,factCheck,sourceCheck,scopeCheck,numericCheck,clarificationCheck,ms:Math.round(performance.now()-began),firstTextMs,evidenceMs,sources:result.sources};
   report.results.push(row);console.log(JSON.stringify({...row,sources:undefined}));
  }catch(error){report.results.push({id:test.id,pass:false,error:(error as Error).message,ms:Math.round(performance.now()-began)});}
  await fs.writeFile(output,JSON.stringify(report,null,2));
 }
 report.summary={passed:report.results.filter((r:any)=>r.pass).length,total:report.results.length};await fs.writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));
 if(report.summary.passed!==report.summary.total)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
