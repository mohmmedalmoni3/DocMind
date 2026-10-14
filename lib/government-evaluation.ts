import { normalizedAnswer } from './normalization';
import type { ChatTurn } from './types';

export const permit = '01-تصريح-صيانة-منزلية.md';
export const procedure = '02-إجراءات-تصريح-الصيانة.md';
export const libraryCard = '03-بدل-فاقد-بطاقة-مكتبة.md';
export type GovernmentCase = {
  id: string; question: string; files: string[]; expected: string;
  required: string[][]; forbidden?: string[]; evidenceFiles: string[];
  history?: ChatTurn[]; refusal?: boolean;
};
export const governmentCases: GovernmentCase[] = [
  {id:'fee-paraphrase',question:'ما رسوم تصريح الصيانة المنزلية البسيطة؟',files:[permit],expected:'الرسم العادي 25، مع الحفاظ على شرط الإعفاء',required:[['25'],['شهادة'],['استحقاق']],evidenceFiles:[permit]},
  {id:'library-fee',question:'كم رسم بدل فاقد بطاقة المكتبة العامة؟',files:[libraryCard],expected:'5 دنانير للخدمة الثانية وليس 25',required:[['5'],['دنانير']],forbidden:['25'],evidenceFiles:[libraryCard]},
  {id:'validity',question:'ما صلاحية تصريح الصيانة المنزلية البسيطة بعد إصداره؟',files:[permit],expected:'60 يوما من تاريخ الإصدار، ليست مدة المعالجة',required:[['60'],['اصدار']],forbidden:['3 ايام'],evidenceFiles:[permit]},
  {id:'retiree-exemption',question:'هل جميع المتقاعدين معفون تلقائيا من رسم تصريح الصيانة المنزلية؟',files:[permit],expected:'لا يوجد إعفاء تلقائي لجميع المتقاعدين',required:[['لا','لم','ليس'],['المتقاعدين']],evidenceFiles:[permit]},
  {id:'wrong-attachment',question:'كم رسوم المسار المستعجل لتصريح الصيانة المنزلية؟',files:[libraryCard],expected:'امتناع عند إرفاق ملف خدمة مختلفة فقط',required:[['لم اجد','غير مذكور','لا يذكر','لا يتضمن','لا يوجد']],forbidden:['25','5 دنانير'],evidenceFiles:[],refusal:true},
  {id:'fees',question:'كم رسم طلب تصريح الصيانة المنزلية البسيطة العادي؟',files:[permit],expected:'25 دينارا للطلب العادي',required:[['25'],['دينار']],evidenceFiles:[permit]},
  {id:'eligibility',question:'ما شروط الأهلية للحصول على تصريح الصيانة المنزلية البسيطة؟',files:[permit],expected:'18 سنة فأكثر، هوية سارية، مالك أو مستأجر مع موافقة خطية',required:[['18'],['سارية'],['مالك'],['مستاجر'],['موافقة']],evidenceFiles:[permit]},
  {id:'documents',question:'ما الوثائق التي يجب أن يرفقها المستأجر لطلب تصريح الصيانة المنزلية البسيطة؟',files:[permit],expected:'هوية، عقد إيجار، صورتان للموقع، موافقة خطية من المالك',required:[['هوية'],['ايجار'],['صورتان','صورتين'],['موافقة'],['المالك']],evidenceFiles:[permit]},
  {id:'processing',question:'كم مدة إنجاز تصريح الصيانة المنزلية البسيطة ومتى يبدأ احتسابها؟',files:[permit,procedure],expected:'3 أيام عمل بعد اكتمال الوثائق والدفع أو اعتماد الإعفاء',required:[['3'],['عمل'],['اكتمال'],['دفع','الدفع'],['اعفاء']],evidenceFiles:[permit]},
  {id:'exemption',question:'أنا مسجل في برنامج الدعم الاجتماعي. هل أعفى من رسم تصريح الصيانة المنزلية وما الإثبات المطلوب؟',files:[permit],expected:'الإعفاء من رسم التصريح بشرط شهادة استحقاق سارية',required:[['يعفي','تعفي','معفي','اعفاء','اعفى','يعفى','تعفى'],['شهادة'],['استحقاق'],['سارية']],evidenceFiles:[permit]},
  {id:'excluded-work',question:'هل يتيح تصريح الصيانة المنزلية البسيطة هدم الجدران الحاملة؟',files:[permit],expected:'لا يشمل هدم الجدران الحاملة، يحتاج خدمة أخرى',required:[['لا','لم'],['الجدران الحاملة']],evidenceFiles:[permit]},
  {id:'follow-up',question:'ومتى تبدأ هذه المدة؟',history:[{role:'user',content:'كم مدة إنجاز تصريح الصيانة المنزلية البسيطة؟'},{role:'assistant',content:'مدة الإنجاز 3 أيام عمل.'}],files:[permit,procedure],expected:'بعد اكتمال الوثائق والدفع أو اعتماد الإعفاء',required:[['اكتمال'],['دفع','الدفع'],['اعفاء']],evidenceFiles:[permit]},
  {id:'multi-scope',question:'ما رسم تصريح الصيانة المنزلية وما رسم بدل فاقد بطاقة المكتبة العامة؟',files:[permit,libraryCard],expected:'الصيانة 25 دينارا، بطاقة المكتبة 5 دنانير',required:[['25'],['5'],['الصيانة'],['المكتبة']],evidenceFiles:[permit,libraryCard]},
  {id:'incomplete',question:'كم مهلة استكمال الوثائق الناقصة لتصريح الصيانة المنزلية ومن أي تاريخ تحسب؟',files:[procedure],expected:'10 أيام عمل من تاريخ إشعار الاستكمال',required:[['10'],['عمل'],['اشعار']],evidenceFiles:[procedure]},
  {id:'appeal',question:'خلال كم يوم يمكن الاعتراض على رفض تصريح الصيانة المنزلية ومن متى؟',files:[procedure],expected:'7 أيام عمل من إشعار الرفض',required:[['7'],['عمل'],['اشعار']],evidenceFiles:[procedure]},
  {id:'missing-phone',question:'ما رقم هاتف الدعم لخدمة تصريح الصيانة المنزلية؟',files:[permit,procedure],expected:'امتناع واضح عن اختراع رقم غير موجود',required:[['لم اجد','لا يتضمن','غير مذكور','لم يذكر','لا يوجد','لا يذكر']],evidenceFiles:[],refusal:true},
  {id:'missing-expedite',question:'كم رسوم المسار المستعجل لتصريح الصيانة المنزلية؟',files:[permit,procedure],expected:'الرسوم المستعجلة غير مذكورة؛ لا تحويل الرسم العادي إليها',required:[['لم اجد','غير مذكور','لم يذكر','لا يوجد','لا يذكر','لا تتوفر']],forbidden:['25','50','100'],evidenceFiles:[],refusal:true},
];
export function checkGovernment(test: GovernmentCase, text: string) {
  const normalized = normalizedAnswer(text);
  return test.required.every(group=>group.some(term=>normalized.includes(normalizedAnswer(term)))) &&
    !(test.forbidden || []).some(term=>normalized.includes(normalizedAnswer(term)));
}

// Fixture-level passage checks, intentionally independent of the generated wording.
// These catch a valid file citation pointing at the wrong section; not general entailment.
const passageTerms: Record<string, string[]> = {
  'fee-paraphrase':['25','شهادة'], 'library-fee':['5','بدل فاقد'],
  validity:['60','اصدار'], 'retiree-exemption':['لا ينص','المتقاعدين'],
  fees: ['25'], eligibility: ['18', 'موافقة'], documents: ['ايجار', 'صورتان'],
  processing: ['3', 'اكتمال'], exemption: ['شهادة', 'استحقاق'],
  'excluded-work': ['لا يشمل', 'الجدران الحاملة'],
  'follow-up': ['اكتمال', 'الاعفاء'], incomplete: ['10', 'اشعار'], appeal: ['7', 'اشعار'],
};
export function checkGovernmentPassages(test: GovernmentCase, text: string, sources: {citation:number;text:string}[]) {
  const ids = [...text.matchAll(/\[(\d+)\]/g)].map(m=>Number(m[1]));
  const required = passageTerms[test.id];
  if (!required) return true;
  return sources.some(source => ids.includes(source.citation) && required.every(term =>
    normalizedAnswer(source.text).includes(normalizedAnswer(term))));
}
