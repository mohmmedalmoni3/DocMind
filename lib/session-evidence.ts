import type {Chunk,Source} from './types';
import {normalizedAnswer} from './normalization';

/** Literal labeled field extraction for a single unambiguous daily-session duration.
 * Checks the entire selected corpus for conflicts, not just the top-k snippets.
 * No arithmetic, no guessed subject and no dropped user qualifiers.
 */
export function sessionEvidence(query:string,sources:Source[],corpus:Chunk[]):string|null {
 const q=normalizedAnswer(query).replace(/[؟?!.]/g,'').trim();
 if(!/^كم (?:عدد )?(?:ساعات|ساعة|مدة) الجلسة اليومية$/.test(q))return null;
 const label='مدة\\s+الجلسة\\s+اليومية';
 const quantity='[0-9٠-٩۰-۹]+(?:[.٫][0-9٠-٩۰-۹]+)?\\s*(?:ساعات|ساعة|دقائق|دقيقة)';
 const pattern=new RegExp(`(?:${quantity}\\s+${label}|${label}\\s*[:：]?\\s*(?:هي\\s+)?${quantity})`,'gu');
 const found: {chunk:Chunk;text:string}[]=[];
 for(const chunk of corpus)for(const match of chunk.text.matchAll(pattern)){
   const nearby=normalizedAnswer(chunk.text.slice(Math.max(0,match.index!-60),match.index!+match[0].length+100));
   if(/ليس|ليست|باستثناء|الا |اقل|اكثر|سابق|تتغير|حد اقصى|حد ادنى|على حسب/.test(nearby))return null;
   found.push({chunk,text:match[0]});
 }
 if(!found.length||new Set(found.map(f=>f.chunk.file)).size!==1)return null;
 const values=found.map(f=>normalizedAnswer(f.text).match(/\d+(?:\.\d+)?\s*(?:ساعات|ساعة|دقائق|دقيقة)/)?.[0]);
 if(values.some(v=>!v)||new Set(values).size!==1)return null;
 const result=found.find(f=>sources.some(s=>s.id===f.chunk.id&&s.similarity>=0.45));
 if(!result)return null;
 const source=sources.find(s=>s.id===result.chunk.id)!;
 return `بحسب النص الوارد في ${source.file}:\n\n> ${result.text} [${source.citation}]`;
}
