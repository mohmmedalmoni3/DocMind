import fs from 'node:fs/promises';
import {understandQuestion} from '../lib/question-understanding';
import {config} from '../lib/config';
import {normalizedAnswer} from '../lib/normalization';
import {answer} from '../lib/rag';

// A semantic coverage screen, NOT an accuracy or native-speaker certification.
async function main(){
 const cases=JSON.parse(await fs.readFile('evaluation/arabic-dialects.json','utf8')) as {country:string;question:string}[];
 const rows:unknown[]=[];
 for(const item of cases){
  const started=performance.now();let row;
  try{
   const plan=await understandQuestion(item.question,config.model,AbortSignal.timeout(90000));
   const checks=[/ساعة|ساعات|سوايع/,/موضوع|محتوى|محاور|تتحدث|يتحدث|تتكلم|تحكي/,/مهارات|فوائد|فائدة|نتائج|استفيد|اتعلم|س[اأ]تعلم/];
   const coverage=checks.map(re=>plan.parts.some(p=>re.test(normalizedAnswer(p))));
   const response=process.env.AUDIT_FILE?await answer(item.question,[],()=>{},{files:[process.env.AUDIT_FILE],bypassCache:true,signal:AbortSignal.timeout(120000)}):undefined;
   const bodies=response?.text.split(/^### .*$/m).slice(1);
   const answerChecks=bodies?.map(body=>({hasCitation:/\[\d+\]/.test(body),nonempty:body.replace(/\[\d+\]/g,'').trim().length>25,refused:/لم أجد|couldn't find/.test(body)}));
   row={...item,plan,coverage,screenPass:plan.mode!=='clarify'&&plan.parts.length===3&&coverage.every(Boolean),ms:Math.round(performance.now()-started),response,answerChecks};
  }catch(e){row={...item,screenPass:false,error:String(e),ms:Math.round(performance.now()-started)};}
  rows.push(row);console.log(JSON.stringify(row));
  await fs.mkdir('data',{recursive:true});
  await fs.writeFile('data/dialect-audit.json',JSON.stringify({at:new Date().toISOString(),model:config.model,scope:'intent coverage screen; answer correctness not measured',rows},null,2));
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
