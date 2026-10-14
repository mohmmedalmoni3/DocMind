import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceEvidence} from '../lib/service-evidence';
import type {Source} from '../lib/types';
const source:Source={id:'a',file:'service.md',page:2,section:'الرسوم والإعفاء',text:'## الرسوم والإعفاء\n\nرسم تصريح مزاولة الحرفة هو 40 دينارا. يعفى المستفيد بشرط إثبات الاستحقاق.',citation:1,similarity:.8,keyword:1,score:.03};

test('scope questions quote explicit exclusions with their actual citation, never infer permission',()=>{
  const scope={...source,citation:3,section:'نطاق الخدمة',text:'## نطاق الخدمة\n\nتصريح مزاولة الحرفة يشمل العمل داخل المحل فقط. لا يشمل تصنيع المواد الخطرة؛ يتطلب ذلك ترخيصا منفصلا.'};
  assert.ok(serviceEvidence('هل يتيح تصريح مزاولة الحرفة تصنيع المواد الخطرة؟',[source,scope],true)?.endsWith('[3]'));
  assert.ok(serviceEvidence('هل يشمل تصريح مزاولة الحرفة تصنيع المواد الخطرة؟',[scope],true)?.includes('لا يشمل تصنيع المواد الخطرة'));
  for(const question of ['هل يسمح تصريح مزاولة الحرفة باستيراد المواد الخطرة؟','هل أنا مستحق لتصريح مزاولة الحرفة؟','هل يتيح تصريح مزاولة الحرفة تصنيع المواد الخطرة بدون ترخيص؟'])assert.equal(serviceEvidence(question,[scope],true),null);
  assert.equal(serviceEvidence('هل يشمل تصريح مزاولة الحرفة تصنيع المواد الخطرة؟',[scope,{...scope,citation:4}],true),null);
});
test('service quotations preserve literal conditions, provenance and fees',()=>{
  const answer=serviceEvidence('كم رسم تصريح مزاولة الحرفة؟',[source],true);
  assert.ok(answer?.includes('40 دينارا'));
  assert.ok(answer?.includes('بشرط إثبات الاستحقاق'));
  assert.ok(answer?.endsWith('[1]'));
});
test('service quotation declines unsupported qualifiers, subjects, personal decisions and ambiguity',()=>{
  for(const q of ['كم رسوم المسار المستعجل لتصريح مزاولة الحرفة؟','كم رسم جواز السفر؟','هل أنا معفى من رسم تصريح مزاولة الحرفة؟','احسب رسم تصريح مزاولة الحرفة'])assert.equal(serviceEvidence(q,[source],true),null,q);
  assert.equal(serviceEvidence('كم رسم تصريح مزاولة الحرفة؟',[source],false),null);
  assert.equal(serviceEvidence('كم رسم تصريح مزاولة الحرفة؟',[source,{...source,id:'b',citation:2}],true),null);
  assert.equal(serviceEvidence('كم رسم تصريح مزاولة الحرفة؟',[{...source,similarity:.2}],true),null);
});
test('Arabic eligibility and tenant documents match definite articles without matching هل inside الأهلية',()=>{
  const eligibility={...source,section:'شروط الأهلية',text:'## شروط الأهلية\n\nشروط تصريح مزاولة الحرفة: عمر المتقدم 21 سنة فأكثر وهوية سارية.'};
  assert.ok(serviceEvidence('ما شروط الأهلية للحصول على تصريح مزاولة الحرفة؟',[eligibility],true)?.includes('21 سنة'));
  const docs={...source,section:'الوثائق المطلوبة',text:'## الوثائق المطلوبة\n\nالوثائق المطلوبة لتصريح مزاولة الحرفة: يجب على المستأجر إرفاق عقد الإيجار وموافقة المالك.'};
  assert.ok(serviceEvidence('ما الوثائق التي يجب أن يرفقها المستأجر لطلب تصريح مزاولة الحرفة؟',[docs],true)?.includes('موافقة المالك'));
});
