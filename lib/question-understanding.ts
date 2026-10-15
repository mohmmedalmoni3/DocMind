import {complete} from './ollama';
import {questionParts} from './question-parts';
import {normalizeQuestion} from './query-normalization';
import {normalizedAnswer} from './normalization';
import {LocalCache,cacheKey} from './cache';

export type QuestionPlan={parts:string[];mode:'rules'|'model'|'clarify'};
const plans=new LocalCache<QuestionPlan>(80);
/** Semantic interpretation for common implicit requests; no document facts are added. */
export function interpretClause(clause:string,fullRequest:string):string {
 const q=normalizedAnswer(clause).replace(/[؟?!.]/g,'').trim();
 const course=/الدورة|دورة|الكورس|كورس/.test(normalizedAnswer(fullRequest));
 if(/(?:^|\s)(?:ليس|بدون|لا|مش|مو|غير|باستثناء|مضمون|راتب|وظيفة)(?:\s|$)/.test(q))return clause;
 const subject=/البرنامج/.test(normalizedAnswer(fullRequest))?'البرنامج':course?'الدورة':undefined;
 if(subject && /^(?:ما\s+)?(?:عطني|اعطني|احكيلي|سولفلي)\s+(?:سالفة|موضوع|ملخص)\s+(?:الدورة|الكورس|البرنامج)$/.test(q))return `ما موضوع ${subject}؟`;
 if(subject && /^(?:ما|ماذا)\s+(?:هي\s+)?(?:الفايدة|الفايده|الفائدة|الفوائد)\s*(?:منه|منها|من\s+(?:الدورة|الكورس|البرنامج))?$/.test(q))return `ما الفوائد والنتائج الموثقة لل${subject.slice(2)}؟`;
 if(!course)return clause;
 // Whole-clause matches only: leave qualifiers and unfamiliar meanings intact.
 if(/^(?:كم|ما عدد)\s+(?:عدد\s+|من\s+|ديال\s+)?(?:الساعات|ساعات|ساعة|السوايع)(?:\s+(?:في|فهاد))?(?:\s+(?:الدورة|الكورس))?$/.test(q)
  || /^كم ساعة تستغرق الدورة$/.test(q))return 'كم عدد ساعات الدورة؟';
 if(/^(?:ما|ماذا)\s+موضوع(?:ها|ه)$/.test(q)
  || /^(?:عن|على)\s+(?:ما|ماذا)\s+(?:بتحكي|تحكي|تتحدث|تتكلم|تهدر|كتهضر)$/.test(q)
  || /^(?:ما|ماذا)\s+(?:تتكلم|بتتكلم)\s+عن(?:ه|ها)$/.test(q)
  || /^ما\s+(?:بتتكلم|تتكلم)\s+عن\s+(?:ما|ماذا)$/.test(q))return 'ما موضوع الدورة؟';
 if(/^ما محتواها$/.test(q))return 'ما محتوى الدورة؟';
 if(/^(?:ما|ماذا)\s+(?:(?:راح|رح|باش|غادي|با|اللي)\s+)?(?:بستفيد|استفاد|نستفاد|نستافد|نستفيد|بنستفيد|استفيد|حاستفيد|هستفيد)\s+(?:منها|منه)$/.test(q)
  || /^ما\s+(?:الذي ساتعلمه|بستانس اتعلم)\s+(?:منها|منه)$/.test(q)
  || /^ما فائدتها لي$/.test(q)
  || /^ما المهارات التي اكتسبها$/.test(q))return 'ما المهارات التي يكتسبها المتدرب في الدورة؟';
 if(/^(?:و\s*)?(?:عن\s+)?(?:ما|ماذا)\s+(?:بتسولف|تسولف|بتحكي|تحكي|بتتكلم|تتكلم|يتكلم|بيتكلم)\s+(?:الدورة|الكورس)$/.test(q)
  || /^(?:ما\s+)?(?:الدورة|الكورس)\s+(?:بتحكي|بتتكلم|بتسولف|بيتحدث|بيتكلم)\s+عن\s+(?:ما|ماذا)$/.test(q))return 'ما موضوع الدورة؟';
 if(/^(?:و\s*)?(?:ما|ماذا)\s+(?:(?:راح|رح|ح|ه)\s*)?(?:استفيد|استفيد\s+انا|هستفيد|حستفيد|حتفيدني)\s*(?:منها|منه|من\s+(?:الدورة|الكورس))?$/.test(q))return 'ما المهارات التي يكتسبها المتدرب في الدورة؟';
 return clause;
}
const words=(s:string)=>normalizedAnswer(s).match(/[\p{L}\p{N}]+/gu)||[];
const fillers=new Set(words('و وعن او ثم ايضا كمان بدي اريد ابغى عايز عاوز عطني اعطني ودي ابي نبي لو سمحت فضلا رجاء ممكن ان اعرف افهم قلي قول لي احكيلي وقللي واذا وما وكم وهل وشنو ما ماذا كم هل'));
export function validatePlan(question:string,value:unknown):string[]|null {
 if(!value||typeof value!=='object'||!Array.isArray((value as any).parts))return null;
 const entries=(value as any).parts as unknown[];
 if(!entries.length||entries.length>12)return null;
 const original=normalizedAnswer(question);let cursor=0;const covered=new Set<number>();const queries:string[]=[];
 for(const entry of entries){
  if(!entry||typeof entry!=='object')return null;
  const {span,query}=entry as {span?:unknown;query?:unknown};
  if(typeof span!=='string'||typeof query!=='string'||!span.trim()||query.length<4||query.length>600)return null;
  const exact=normalizedAnswer(span);const at=original.indexOf(exact,cursor);if(at<0)return null;
  if(questionParts(span).length>1)return null;
  for(let i=at;i<at+exact.length;i++)covered.add(i);cursor=at+exact.length;
  // Numerals, negation and conditions cannot disappear in a paraphrase.
  const locked=words(exact).filter(w=>/^\d/.test(w)||['ليس','لا','مش','مو','بدون','غير','باستثناء','قبل','بعد','فقط','اقل','اكثر','مضمون'].includes(w));
  const rewritten=new Set(words(query));if(locked.some(w=>!rewritten.has(w)))return null;
  const semanticGuards=[
   {source:/سالفة|موضوع|محتوى|بتسولف|(?:بيتكلم|بتحكي|تتكلم)\s+عن/,target:/موضوع|محتوى|يتحدث|تتحدث|شرح|محاور/},
   {source:/ساعات|ساعة/,target:/ساعات|ساعة/},
   {source:/الفايدة|الفائدة|استفيد|هستفيد|مخرجات|مهارات/,target:/فائدة|فوائد|نتائج|مخرجات|مهارات|استفادة/},
   {source:/رسوم|تكلفة|سعر/,target:/رسوم|تكلفة|سعر/},
  ];
  if(semanticGuards.some(g=>g.source.test(exact)&&!g.target.test(normalizedAnswer(query))))return null;
  for(const name of exact.matchAll(/["«“]([^"»”]+)["»”]/g))if(!normalizedAnswer(query).includes(name[1]))return null;
  queries.push(query.trim());
 }
 const leftovers=[...original].map((c,i)=>covered.has(i)?' ':c).join('');
 if(words(leftovers).some(w=>!fillers.has(w)))return null;
 return queries;
}
export async function understandQuestion(question:string,model:string,signal?:AbortSignal):Promise<QuestionPlan>{
 const normalized=normalizeQuestion(question).replace(/\s+و\s+و(?=عن\s|ما\s)/g,' و');
 const clauses=questionParts(normalized);
 const interpreted=clauses.map(c=>interpretClause(c,normalized));
 const uncertain=interpreted.some(c=>/بتسولف|استفيد|هستفيد|راح|بدي|عايز|عطني|ابغى|أبغى|ودي|مردود|قوللي|شنو|شنهي|سالفة|السالفة|الفايدة|الفايده|بشنو|واش|شنحال|شحال|كتهضر|تهدر|نستافد|نستفاد/.test(c))
  || (clauses.length===1&&!/^(?:ما|كم|هل|كيف|متى|من|أين|اذكر|اشرح|وضح|what|how|when|where|who|why)\s/iu.test(normalized)&&/\sو[\p{L}]|\sو\s/iu.test(normalized));
 if(!uncertain)return {parts:interpreted,mode:'rules'};
 const key=cacheKey(model,question);const cached=plans.get(key);if(cached)return cached;
 const source=normalizedAnswer(question);
 const spans=clauses.map(c=>{
  let span=c.replace(/[؟?]\s*$/,'').trim();
  if(!source.includes(normalizedAnswer(span)))span=span.replace(/^ما\s+/,'');
  return source.includes(normalizedAnswer(span))?span:null;
 });
 const knownSpans=clauses.length>1&&spans.every(Boolean)?spans as string[]:undefined;
 const schema={type:'object',additionalProperties:false,required:['parts'],properties:{parts:{type:'array',minItems:knownSpans?.length||1,maxItems:knownSpans?.length||12,items:{type:'object',additionalProperties:false,required:['span','query'],properties:{span:{type:'string',...(knownSpans?{enum:knownSpans}:{})},query:{type:'string'}}}}}};
 const raw=await complete(model,[{role:'system',content:'You interpret questions, including Arabic dialects. Do not answer or invent document facts. Return JSON {"parts":[{"span":"exact contiguous text copied from the user request","query":"standalone question preserving the same meaning"}]}. Cover every requested aspect in order. Distinguish hours, subject/content, benefits, conditions, exceptions and missing information. Keep names, numbers, dates, negation and constraints. Benefits mean documented outcomes, never a guaranteed personal job or salary. Spans must cover all meaningful user text; leave out only conjunctions/polite filler. No overlapping spans. Maximum 12 parts. Resolve subject references only from the request. If ambiguous preserve that ambiguity in the question.'},{role:'user',content:question+(knownSpans?`\nRewrite EACH of these exact spans in the same order, one question per span. Do not merge or omit any: ${JSON.stringify(knownSpans)}`:'')}],signal,schema,640);
 let parts:string[]|null=null;try{parts=validatePlan(question,JSON.parse(raw));}catch{}
 const result:QuestionPlan=parts?{parts,mode:'model'}:{parts:interpreted,mode:'clarify'};
 if(parts)plans.set(key,result);return result;
}
