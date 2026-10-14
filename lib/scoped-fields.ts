import type {Chunk,Source} from './types';
import {normalizedAnswer} from './normalization';

/** Fast literal evidence, only for explicit fields in one user-selected document.
 * Unknown qualifiers, multiple values and incomplete long sections use normal RAG.
 */
export function scopedFieldEvidence(question:string,chunks:Chunk[]):{text:string;sources:Source[]}|null {
 if(new Set(chunks.map(c=>c.file)).size!==1)return null;
 const q=normalizedAnswer(question).replace(/[؟?!.]/g,'').trim();
 const hours=/^كم (?:عدد )?(?:الساعات|ساعات|ساعة)(?: (?:التدريب|الدورة|البرنامج|في الدورة|في البرنامج))?$/.test(q);
 const goals=/^(?:ما|اذكر) (?:هي )?(?:اهداف|الاهداف)(?: (?:الدورة|البرنامج|التدريب))?$/.test(q);
 const skills=/^ما (?:هي )?(?:المهارات|مهارات)(?: التي (?:يكتسبها|يتعلمها) المتدرب)?(?: (?:في |بنهاية )?(?:الدورة|البرنامج))?$/.test(q);
 if(!hours&&!goals&&!skills)return null;
 const matches:{chunk:Chunk;text:string}[]=[];
 for(const chunk of chunks){
  if(hours){
   const number='[0-9٠-٩۰-۹]+(?:[.٫][0-9٠-٩۰-۹]+)?';
   const field='(?:إجمالي|اجمالي|مجموع)\\s+ساعات\\s+(?:التدريب|الدورة|البرنامج)';
   const pattern=new RegExp(`(?:${number}\\s*(?:ساعة|ساعات)\\s+${field}|${field}\\s*(?:[:：]|هي)?\\s*${number}\\s*(?:ساعة|ساعات))`,'gu');
   for(const m of chunk.text.matchAll(pattern)){
    const nearby=normalizedAnswer(chunk.text.slice(Math.max(0,m.index!-50),m.index!+m[0].length+80));
    if(/ليس|ليست|باستثناء|الا |اقل|اكثر|سابق|تتغير|حد اقصى|حد ادنى|على حسب/.test(nearby))return null;
    matches.push({chunk,text:m[0]});
   }
  }else{
   // Full explicitly labeled section: retain conditions and every listed objective.
   const m=chunk.text.match(skills?/(?:^|\n)#{1,6}\s*(?:المهارات|مهارات)[^\n]*\n/:/(?:^|\n)#{1,6}\s*(?:أهداف|اهداف|الأهداف|الاهداف)[^\n]*\n/);
   const marker=chunk.text.match(skills?/^(?:[0-9٠-٩]{1,2}\s+)?(?:المهارات|مهارات)\s+(?:النهائية|المكتسبة|الدورة|البرنامج)/:/الهدف النهائي من (?:الدورة|البرنامج)|^(?:أهداف|اهداف|الأهداف|الاهداف) (?:الدورة|البرنامج)/);
   const start=m?.index??marker?.index;
   if(start===undefined)continue;
   const block=chunk.text.slice(start).split(/\n#{1,6}\s/)[0].trim();
   // A chunk boundary may hide remaining objectives; don't quote partial sections.
   if(block.length>1800||block.length<25)return null;
   const boundary=block.indexOf('خارطة الطريق العامة');
   const text=boundary>=0?block.slice(0,boundary).trim():block;
   if(boundary<0 && chunks.some(c=>c.file===chunk.file&&c.page===chunk.page&&c.id!==chunk.id&&c.section===chunk.section))return null;
   matches.push({chunk,text});
  }
 }
 if(!matches.length)return null;
 // More than one distinct value/section needs a generated explanation of the evidence.
 const keys=matches.map(m=>hours?normalizedAnswer(m.text).match(/\d+(?:\.\d+)?/)?.[0]:normalizedAnswer(m.text).replace(/\s+/g,' '));
 if(new Set(keys).size!==1)return null;
 const {chunk,text}=matches[0];const {embedding,...metadata}=chunk;
 const source:Source={...metadata,citation:1,similarity:0,keyword:1,score:0};
 return {text:`بحسب النص الوارد في الملف المحدد:\n\n> ${text.replace(/\n/g,'\n> ')} [1]`,sources:[source]};
}
