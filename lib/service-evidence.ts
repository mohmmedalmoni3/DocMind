import type { Source } from './types';
import { normalizedAnswer } from './normalization';

const fields = [
  { question: /^هل (?:يشمل|يتيح|يسمح).*/, heading: /نطاق|شروط|الاهلية|الاستثناءات/ },
  { question: /(?:ما|اذكر).*(?:الوثائق|المستندات|الاوراق)/, heading: /الوثائق المطلوبة|المستندات المطلوبة|الاوراق المطلوبة/ },
  { question: /(?:ما|اذكر).*(?:شروط|الاهلية)/, heading: /شروط|الاهلية/ },
  { question: /(?:كم|ما).*(?:رسم|رسوم|تكلفة)/, heading: /الرسوم/ },
  { question: /(?:كم|ما).*(?:مدة انجاز|مدة معالجة)/, heading: /مدة الانجاز|مدة المعالجة/ },
  { question: /(?:كم|ما).*(?:مهلة استكمال)/, heading: /الطلبات الناقصة|استكمال/ },
  { question: /(?:خلال كم|كم مهلة|ما مهلة).*(?:اعتراض|الاعتراض)/, heading: /الاعتراض/ },
];
const generic = new Set(tokens('ما كم اذكر هي هو هل يشمل يتيح يسمح شروط شرط اهلية للحصول الحصول لطلب علي على عن من في الي ان يجب التي الذي يرفق يرفقها ارفاق طلب الطلب خدمة رسم رسوم تكلفة مدة انجاز معالجة مهلة استكمال وثائق مستندات اوراق المطلوبة المطلوبه العادي ومتي متي ومتى متى يبدا احتسابها خلال يوم يمكن اعتراض رفض ومن اي تاريخ تحسب'));
function tokens(text: string) {
  return (normalizedAnswer(text).match(/[\p{L}\p{N}]+/gu)||[]).map(t=>t.replace(/^(?:بال|لل|ال)/,''));
}
/** Literal section quotation only: no arithmetic, personal eligibility or inferred answers. */
export function serviceEvidence(question:string,sources:Source[],singleFile:boolean):string|null {
  const q=normalizedAnswer(question);
  const scopeQuestion = /^هل (?:يشمل|يتيح|يسمح) /.test(q);
  if(!singleFile || q.length>240 || !/[\u0600-\u06ff]/.test(q) || /(?:^|\s)(?:انا|احسب|قارن|لماذا|الا اذا|باستثناء|غير|بدون|ليس|لازم|يجوز)(?:\s|$)/.test(q) || (/^هل /.test(q) && !scopeQuestion))return null;
  const field=fields.find(f=>f.question.test(q));
  if(!field)return null;
  const matching=sources.filter(s=>field.heading.test(normalizedAnswer(s.section)));
  // Multiple relevant chunks can hide differing conditions; let the generator read them.
  if(matching.length!==1)return null;
  const source=matching[0];
  if(source.similarity<0.45 || source.text.length>1800 || /\[…\]/.test(source.text))return null;
  const anchors=[...new Set(tokens(q).filter(t=>t.length>2&&!generic.has(t)))];
  const available=new Set(tokens(source.text+' '+source.section));
  // Every specific word (including qualifiers such as urgent) must be present.
  if(anchors.length<2 || anchors.some(t=>![t,t.replace(/^[وبل]/,''),'ل'+t,'و'+t,'ب'+t].some(v=>available.has(v))))return null;
  const text=source.text.replace(/^#{1,6}[^\n]*\n+/,'').trim();
  return `بحسب النص الوارد في المستند:\n\n${text} [${source.citation}]`;
}
