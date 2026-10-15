import fs from 'node:fs/promises';
import {z} from 'zod';
import {config} from '../lib/config';
import {readIndex} from '../lib/index-store';
import {embed} from '../lib/ollama';
import {rank} from '../lib/retrieval';
import {rerankEvidence} from '../lib/reranker';
import {retrievalMetrics,percentile} from '../lib/retrieval-metrics';
const schema=z.array(z.object({id:z.string(),query:z.string().min(1),relevantIds:z.array(z.string()).min(1),files:z.array(z.string()).min(1).optional(),dialect:z.string().optional()})).min(1);
async function main(){
 const input=process.argv[2];if(!input)throw new Error('Usage: node --env-file=.env --import tsx scripts/evaluate-retrieval.ts judgments.json [report.json]');
 const cases=schema.parse(JSON.parse(await fs.readFile(input,'utf8')));
 const index=await readIndex();
 if(!index)throw new Error('Ingest documents first');
 if(index.embeddingModel!==config.embedding)throw new Error('Embedding model differs from index');
 const rows:Array<{id:string;dialect?:string;mode:string;status?:string;embeddingMs:number;rankingMs:number;totalMs:number;precisionAt5:number;recallAt10:number|null;mrr:number;ids:string[]}>=[];
 for(const item of cases){
  const candidates=index.chunks.filter(c=>!item.files||item.files.includes(c.file));
  if(item.relevantIds.some(id=>!candidates.some(c=>c.id===id)))throw new Error(`Unknown/out-of-scope gold passage in ${item.id}`);
  const started=performance.now();const [vector]=await embed([item.query],true,AbortSignal.timeout(config.timeout));const embeddingMs=performance.now()-started;
  for(const mode of ['dense','bm25','hybrid','hybrid-rerank'] as const){
   const t=performance.now();let result=rank(candidates,vector,item.query,mode==='hybrid-rerank'?Math.max(10,config.rerankCandidates):10,mode==='hybrid-rerank'?'hybrid':mode);let status:string|undefined;
   if(mode==='hybrid-rerank'){const reordered=await rerankEvidence(item.query,result,config.model,config.rerankTimeout);result=reordered.sources;status=reordered.status;}
   const rankingMs=performance.now()-t;
   rows.push({id:item.id,dialect:item.dialect,mode,status,embeddingMs:mode==='bm25'?0:embeddingMs,rankingMs,totalMs:rankingMs+(mode==='bm25'?0:embeddingMs),precisionAt5:retrievalMetrics(result.map(s=>s.id),item.relevantIds,5).precision,recallAt10:retrievalMetrics(result.map(s=>s.id),item.relevantIds,10).recall,mrr:retrievalMetrics(result.map(s=>s.id),item.relevantIds,10).mrr,ids:result.slice(0,10).map(s=>s.id)});
  }
 }
 const summary=['dense','bm25','hybrid','hybrid-rerank'].map(mode=>{const group=rows.filter(r=>r.mode===mode);return {mode,precisionAt5:group.reduce((a,r)=>a+r.precisionAt5,0)/group.length,recallAt10:group.reduce((a,r)=>a+(r.recallAt10||0),0)/group.length,p50Ms:percentile(group.map(r=>r.totalMs),.5),p95Ms:percentile(group.map(r=>r.totalMs),.95),p99Ms:percentile(group.map(r=>r.totalMs),.99)};});
 const report={at:new Date().toISOString(),model:config.model,embedding:config.embedding,indexUpdatedAt:index.updatedAt,notes:'Retrieval only. Sequential single-user run; embeddings shared between methods. No answer accuracy or faithfulness claim.',summary,rows};
 await fs.writeFile(process.argv[3]||'data/retrieval-evaluation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(summary,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
