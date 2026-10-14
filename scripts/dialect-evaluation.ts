import fs from 'node:fs/promises';
import path from 'node:path';
import {config} from '../lib/config';
import {readIndex} from '../lib/index-store';
import {answer,candidatesFor} from '../lib/rag';
import {embed} from '../lib/ollama';
import {normalizeQuestion} from '../lib/query-normalization';
import {rankQueries} from '../lib/retrieval';
import {routeService} from '../lib/service-routing';
import {normalizedAnswer} from '../lib/normalization';
async function main(){
 const government=process.argv.includes('--government');
 const index=await readIndex();const candidates=candidatesFor(index);
 const course=index.documents.find(d=>d.name.endsWith('TopX Academy.pdf'))?.name;
 type Case={q:string;file:string;terms:string[]};
 const cases:Case[]=government?[
  {q:'شقد رسوم خدمة إصدار تصريح السوق؟',file:'01-service.md',terms:['19']},
  {q:'قديش رسوم خدمة تجديد تصريح السوق؟',file:'02-service.md',terms:['27']},
  {q:'كام رسوم إصدار بطاقة الحديقة؟',file:'03-service.md',terms:['13']},
  {q:'شو الوثائق المطلوبة لخدمة حجز قاعة الحي؟',file:'05-service.md',terms:['وثائق','هوية']},
  {q:'شنو شروط خدمة طلب حاوية إضافية؟',file:'06-service.md',terms:['18']},
  {q:'كم مدة إنجاز خدمة تعديل شهادة عنوان؟',file:'08-service.md',terms:['7','عمل']},
  {q:'شقد رسوم حجز ملعب الحي؟',file:'09-service.md',terms:['12']},
  {q:'ايش الأوراق المطلوبة لإصدار بطاقة مركز القراءة؟',file:'10-service.md',terms:['هوية']},
  {q:'هل كل المتقاعدين معفيين من رسوم إصدار تصريح السوق؟',file:'01-service.md',terms:['لا يشمل جميع المتقاعدين']},
 ]:['شقد الساعات','شكد الساعات','قديش الساعات','اديش عدد ساعات الدورة؟','كام عدد ساعات الدورة؟','كم عدد ساعات الدورة؟','كم ساعة الجلسة اليومية؟','شقد ساعات الجلسة اليومية؟'].map(q=>({q,file:course!,terms:q.includes('اليومية')?['2 ساعة','الجلسة اليومية']:['20','ساعة']}));
 if(cases.some(c=>!c.file))throw Error('Expected original course PDF or fixed government fixture.');
 const report:any={at:new Date().toISOString(),embedding:config.embedding,model:config.model,index:path.relative(process.cwd(),config.data),answerCacheBypassed:true,retrieval:[],answers:[]};
 for(const c of cases){const start=performance.now();const canonical=normalizeQuestion(c.q);const queries=[...new Set([canonical,c.q])];const route=routeService(canonical,candidates);const scoped=route.files?candidates.filter(s=>route.files!.includes(s.file)):candidates;const vectors=await embed(queries,true);const sources=rankQueries(scoped,vectors,queries,5);const relevant=sources.find(s=>s.file===c.file&&c.terms.every(term=>normalizedAnswer(s.text).includes(normalizedAnswer(term))));report.retrieval.push({...c,canonical,pass:!!relevant,rank:relevant?sources.indexOf(relevant)+1:null,ms:Math.round(performance.now()-start),sources:sources.map(s=>({file:s.file,page:s.page,text:s.text,similarity:s.similarity}))});}
 const live=government?cases.filter((_,i)=>[0,3,8].includes(i)):cases.filter((_,i)=>[0,4,7].includes(i));
 for(const c of live){const start=performance.now();const r=await answer(c.q,[],()=>{},{bypassCache:true,signal:AbortSignal.timeout(240000)});report.answers.push({...c,ms:Math.round(performance.now()-start),...r});console.log(JSON.stringify({question:c.q,text:r.text,ms:report.answers.at(-1).ms}));}
 report.summary={retrievalPassed:report.retrieval.filter((r:any)=>r.pass).length,total:cases.length,answerReview:'Review saved answer and cited passage; keyword success is not entailment.'};
 await fs.writeFile(government?'dialect-government.json':'dialect-course-bge.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));
 if(report.summary.retrievalPassed!==cases.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;});
