import {normalizedAnswer} from './normalization';
import type {Source} from './types';
const words=(text:string)=>normalizedAnswer(text).replace(/\[\d+\]/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
/** Reject model artifacts and newly invented foreign script, not quoted source text. */
export function malformedAnswer(text:string,question:string,sources:Source[]):boolean {
 if(/\[(?:numer|source|citation)\s*\d+\]/iu.test(text))return true;
 if(!/[\u0600-\u06ff]/u.test(question))return false;
 const allowed=sources.map(s=>s.text).join('');
 return [...text.matchAll(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu)].some(m=>!allowed.includes(m[0]));
}
/** A reproduced section heading is not an answer to a request for its details. */
export function headingOnlyAnswer(text:string,sources:Source[]):boolean {
 const answer=words(text);if(answer.length>160||!answer)return false;
 return sources.some(source=>{
  const heading=source.text.split('\n')[0].trim();
  if(source.text.length-heading.length<200)return false;
  if(!/^(?:#{1,6}\s|[0-9٠-٩]{1,2}\s)/u.test(heading))return false;
  if(/ساعة|ساعات|دقيقة|دقائق|دينار|دولار|hours?|days?|\$|%/iu.test(heading))return false;
  return words(heading)===answer;
 });
}
