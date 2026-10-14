import {normalizeQuestion} from './query-normalization';

/** Conservative decomposition: explicit question boundaries or coordinated requests.
 * Preserve every clause and qualifier; never split lists of document requirements.
 */
export function questionParts(question:string):string[] {
 const q=normalizeQuestion(question);
 if(/^(?:قارن|compare)\s/iu.test(q))return [q];
 const start='(?:ما(?:ذا)?|كم|كيف|هل|متى|أين|من|لماذا|اذكر|اشرح|وضح|what|how|when|where|who|why|which)';
 const topic='(?:[اأإ]?هداف|محتوى|محاور|مخرجات|رسوم|تكلفة|شروط|وثائق|مستندات|مدة|ساعات|صلاحية|استثناءات|requirements|fees|goals|objectives|duration|cost)';
 const connector=new RegExp(`\\s+(?:و\\s*|and\\s+)(?=(?:${start}|(?:ال)?${topic})(?:\\s|[؟?:,،]|$))`,'giu');
 const explicit=new RegExp(`[؟?؛;]\\s*(?=${start}\\s)|\\n\\s*(?:[-*]|[0-9٠-٩]+[.)-])\\s*|\\n\\s*(?=${start}\\s)`,'giu');
 const comma=new RegExp(`[,،]\\s*(?=(?:${start}|(?:ال)?${topic})(?:\\s|[؟?:,،]|$))`,'giu');
 const pieces=q.replace(explicit,'\u001e').replace(connector,'\u001e').replace(comma,'\u001e').split('\u001e').map(p=>p.trim().replace(/^[0-9٠-٩]+[.)-]\s*/,'').replace(/^[\s؟?؛;]+|[\s؟?؛;]+$/g,'')).filter(Boolean);
 if(pieces.length<2)return [q];
 // Nominal coordinated requests inherit only a question word, never an answer.
 return pieces.map(p=>new RegExp(`^${start}\\s`,'iu').test(p)?p+( /[؟?]$/.test(p)?'':/[\u0600-\u06ff]/.test(p)?'؟':'?'):
   (/[\u0600-\u06ff]/.test(p)?`ما ${p}؟`:`What are ${p}?`));
}
