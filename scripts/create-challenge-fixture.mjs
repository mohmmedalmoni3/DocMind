import fs from 'node:fs';
import crypto from 'node:crypto';
const root='demo-packs/challenge-ten';fs.mkdirSync(root,{recursive:true});
const names=['إصدار تصريح السوق','تجديد تصريح السوق','إصدار بطاقة الحديقة','تجديد بطاقة الحديقة','حجز قاعة الحي','طلب حاوية إضافية','إصدار شهادة عنوان','تعديل شهادة عنوان','حجز ملعب الحي','إصدار بطاقة مركز القراءة'];
const fees=[19,27,13,45,8,22,6,34,12,16];const days=[2,4,1,5,3,6,2,7,4,3];
const files=[];
for(let i=0;i<names.length;i++){
  const name=names[i];const file=`${String(i+1).padStart(2,'0')}-service.md`;files.push(file);
  fs.writeFileSync(`${root}/${file}`,`# خدمة ${name}\n\nوثيقة تجريبية خيالية لا تمثل تعليمات حكومية رسمية. رمز الخدمة ت ${i+1}. الجهة الافتراضية: مكتب خدمات حي النور. تختص هذه الصفحة بخدمة ${name} فقط. لا يجوز نقل رسومها أو مواعيدها إلى خدمة أخرى تحمل اسما مشابها.\n\n## الشروط والوثائق المطلوبة\n\nيشترط في خدمة ${name} أن تكون هوية المتقدم سارية وأن يكون عمره 18 سنة فأكثر. ترفق صورة الهوية وإثبات العنوان ونموذج الطلب الموقع. إذا كان المتقدم مستأجرا فيرفق عقد الإيجار وموافقة المالك الخطية أيضا. لا يعد إنشاء حساب في البوابة استكمالا للوثائق، ولا يمثل رقم المتابعة موافقة على الطلب.\n\n## الرسوم\n\nرسم خدمة ${name} هو ${fees[i]} دينارا للطلب العادي. تسدد الرسوم بعد مراجعة الوثائق عبر قناة الدفع المحلية المشار إليها في إشعار الطلب. هذه القيمة لا تشمل المخالفات أو الخدمات الأخرى. يجب حفظ إيصال الدفع لربطه بالطلب.\n\n## الاستثناءات والإعفاء\n\nيعفى المستفيد المسجل في برنامج الدعم من رسم خدمة ${name} بشرط إرفاق شهادة استحقاق سارية. لا يمنح الإعفاء بمجرد الطلب الشفهي ولا يشمل جميع المتقاعدين تلقائيا. لا تتضمن هذه الوثيقة مسارا مستعجلا أو رسوما له، ولا يصح اعتبار الرسم العادي رسما لمسار مستعجل.\n\n## مدة الإنجاز\n\nمدة إنجاز خدمة ${name} هي ${days[i]} أيام عمل بعد اكتمال الوثائق وتسديد الرسوم أو اعتماد الإعفاء. لا تحتسب أيام العطل ولا يبدأ احتساب المدة من تاريخ إنشاء الحساب. إذا كان الطلب ناقصا يرسل إشعار بالنواقص، وتبدأ المعالجة بعد استكمالها.\n\n## الصلاحية والمتابعة\n\nصلاحية الوثيقة الناتجة عن خدمة ${name} هي ${60+i*10} يوما من تاريخ إصدارها. تختلف الصلاحية عن مدة معالجة الطلب. تتم المتابعة باستخدام رقم الطلب في البوابة أو في المركز. لا يرد رقم هاتف للدعم في هذه الوثيقة.\n\n## الاعتراض\n\nيجوز الاعتراض على رفض طلب خدمة ${name} خلال ${7+i} أيام عمل من إشعار الرفض. يجب ذكر رقم الطلب وسبب الاعتراض وإرفاق الوثائق المؤيدة. لا تحدد الوثيقة مدة الفصل في الاعتراض أو رسومه.\n`);
}
const cases=names.map((name,i)=>({id:`fee-${i+1}`,question:`كم رسم خدمة ${name}؟`,required:[String(fees[i]),'دينار'],sourceFile:files[i],sourceTerms:[String(fees[i])]}));
cases.push(
 {id:'ambiguous-fee',question:'كم الرسوم؟',required:['أي خدمة تقصد'],clarification:true},
 {id:'ambiguous-duration',question:'كم المدة؟',required:['أي خدمة تقصد'],clarification:true},
 {id:'conditional-exemption',question:`هل المستفيد المسجل في برنامج الدعم معفى من رسوم ${names[0]} وما الإثبات؟`,required:['شهادة','استحقاق','سارية'],sourceFile:files[0],sourceTerms:['بشرط','شهادة']},
 {id:'duration-start',question:`كم مدة إنجاز ${names[3]} ومتى تبدأ؟`,required:['5','عمل','اكتمال'],sourceFile:files[3],sourceTerms:['5','اكتمال']},
 {id:'two-services',question:`ما رسم ${names[0]} وما رسم ${names[1]}؟`,required:['19','27'],sourceFiles:[files[0],files[1]]},
 {id:'absent-phone',question:`ما رقم هاتف الدعم لخدمة ${names[8]}؟`,required:['لم أجد'],refusal:true},
 {id:'follow-up',question:'وما مدة الإنجاز ومتى تبدأ؟',history:[{role:'user',content:`كم رسم خدمة ${names[5]}؟`},{role:'assistant',content:'الرسم 22 دينارا.'}],required:['6','عمل','اكتمال'],sourceFile:files[5],sourceTerms:['6','اكتمال']}
);
const data=JSON.stringify({notice:'Synthetic fixed regression set authored locally, not a blind or official committee evaluation. Freeze before first run; retain failures.',cases},null,2);
fs.writeFileSync(`${root}/../challenge-ten-cases.json`,data);
console.log(JSON.stringify({documents:10,cases:cases.length,sha256:crypto.createHash('sha256').update(data).digest('hex')}));
