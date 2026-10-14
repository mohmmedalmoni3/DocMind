import type {Chunk, Source,ChatTurn} from './types';
import {normalizedAnswer} from './normalization';
import {tokenEstimate} from './chunking';

const normalize=(text:string)=>normalizedAnswer(text).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const mentions=(query:string,name:string)=>[' ',' و',' ل',' ب'].some(prefix=>(' '+query+' ').includes(prefix+normalize(name)+' '));
export type ServiceGroup={name:string;files:string[]};
// Only explicit service labels identify a service. Never infer it from a filename
// or a passing mention in another service's requirements.
export function serviceCatalog(chunks:Chunk[]):ServiceGroup[] {
  const first=new Map<string,Chunk>();
  for(const chunk of chunks)if(!first.has(chunk.file))first.set(chunk.file,chunk);
  const groups=new Map<string,ServiceGroup>();
  for(const [file,chunk] of first){
    const names=chunk.text.split('\n').slice(0,12).map(line=>line.replace(/^#+\s*/,'').trim())
      .map(line=>line.match(/^(?:اسم الخدمة\s*[:：]|خدمة\s+|إجراءات\s+)(.+)/)?.[1]?.split(/\s+[—–|]\s+/)[0].trim())
      .filter((name):name is string=>!!name && name.length<=100 && normalize(name).split(' ').length>=2 && !/[.؛]/.test(name));
    const unique=[...new Map(names.map(name=>[normalize(name),name])).values()];
    if(unique.length!==1)continue;
    const name=unique[0];
    const key=normalize(name);
    const group=groups.get(key)||{name,files:[]};
    group.files.push(file);groups.set(key,group);
  }
  return [...groups.values()];
}
const genericWords=new Set(normalize('ما ماذا كم هي هو هل الرسوم رسوم الرسم رسم التكلفة تكلفة الوثائق وثائق المستندات المطلوبة مطلوب الاوراق المدة مدة انجاز المعاملة الخدمة خدمة شروط الشروط الاهلية اريد معرفة اعرف تستغرق يستغرق للطلب الطلب تقديم كيف اقدم عليها لها وما وكم').split(' '));
export function routeService(query:string,chunks:Chunk[]):{files?:string[];clarify?:string[];name?:string;groups?:string[][]} {
  const groups=serviceCatalog(chunks);
  if(groups.length<2)return {};
  const q=normalize(query);
  const matched=groups.filter(group=>mentions(q,group.name));
  if(matched.length>=2 && matched.length<=4)return {files:matched.flatMap(group=>group.files),groups:matched.map(group=>group.files)};
  if(matched.length===1 && !/(?:قارن|مقارنة|بين|و(?:ما|كم)\s+(?:رسم|رسوم|خدمة))/.test(q))
    return {files:matched[0].files,name:matched[0].name};
  // Never guess from the highest similarity when the user asked only a generic field.
  const words=q.split(' ');
  if(!matched.length && words.length<=10 && words.every(word=>genericWords.has(word)))
    return {clarify:groups.map(group=>group.name)};
  return {};
}

// Preserve the requested field verbatim; borrow only an unambiguous service name.
// Other follow-ups still use the normal rewrite path.
export function serviceFollowup(question:string,history:ChatTurn[],chunks:Chunk[]):string|undefined {
  const groups=serviceCatalog(chunks);const q=normalize(question);
  if(!history.length || groups.some(group=>q.includes(normalize(group.name))))return;
  const extra=new Set(['ومتي','متي','ومتى','متى','تبدا','يبدا','الانجاز','انجاز','ومدة','مدة','هذه','احتسابها']);
  if(!/(?:رسوم|رسم|مدة|الوثائق|الشروط|الاهلية|المستندات)/.test(q) || !q.split(' ').every(word=>genericWords.has(word)||extra.has(word)))return;
  const previous=normalize(history.filter(turn=>turn.role==='user').at(-1)?.content||'');
  const named=groups.filter(group=>mentions(previous,group.name));
  if(named.length!==1)return;
  return `${question.replace(/[؟?]\s*$/,'')} لخدمة ${named[0].name}؟`;
}

// Include complete original passages, preserving individual page/section citations.
// If the service exceeds the budget, retain the original ranked context unchanged.
export function wholeServiceContext(ranked:Source[],allRanked:Source[],maxTokens:number):Source[] {
  if(!allRanked.length || allRanked.length>16 || tokenEstimate(allRanked.map(s=>s.text).join('\n'))>maxTokens)return ranked;
  const ids=new Set(ranked.map(s=>s.id));
  return [...ranked,...allRanked.filter(s=>!ids.has(s.id))].map((s,i)=>({...s,citation:i+1}));
}
