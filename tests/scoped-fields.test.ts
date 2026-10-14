import test from 'node:test';
import assert from 'node:assert/strict';
import {scopedFieldEvidence} from '../lib/scoped-fields';
import {focusEvidence} from '../lib/evidence-focus';
import {headingOnlyAnswer} from '../lib/answer-quality';
import {numericCitationsSupported} from '../lib/citations';
const chunk=(text:string,id='a',file='course.md')=>({id,file,page:1,section:'Overview',text,embedding:[1,0]});
test('scoped fields quote original values and complete goals, without model inference',()=>{
 const c=chunk('20 ساعة إجمالي ساعات التدريب 2 ساعة مدة الجلسة اليومية');
 assert.match(scopedFieldEvidence('كم عدد الساعات؟',[c])!.text,/20 ساعة إجمالي/);
 const named=chunk(c.text,'a','course-2026-3.pdf');const quote=scopedFieldEvidence('كم عدد الساعات؟',[named])!;
 assert.equal(numericCitationsSupported(quote.text,quote.sources),true,'Filename numbers must not become answer claims');
 assert.equal(scopedFieldEvidence('كم عدد الساعات اليومية؟',[c]),null);
 assert.equal(scopedFieldEvidence('كم عدد الساعات؟',[c,chunk('30 ساعة إجمالي ساعات التدريب','b')]),null);
 assert.equal(scopedFieldEvidence('كم عدد الساعات؟',[c,chunk(c.text,'b','other.md')]),null);
 assert.equal(scopedFieldEvidence('كم عدد الساعات؟',[chunk('ليست 20 ساعة إجمالي ساعات التدريب')]),null);
 const goal=chunk('# أهداف البرنامج\n\nبناء قوالب وتقييم النتائج بشرط إتمام التدريب.');
 assert.match(scopedFieldEvidence('ما أهداف البرنامج؟',[goal])!.text,/بشرط إتمام التدريب/);
 assert.equal(scopedFieldEvidence('ما أهداف البرنامج للأطفال؟',[goal]),null);
 assert.equal(scopedFieldEvidence('ما أهداف البرنامج؟',[goal,chunk('تابع الأهداف','b')]),null);
 const flat=chunk('الهدف النهائي من الدورة بناء أدوات وتقييم النتائج. خارطة الطريق العامة الأسبوع الأول');
 assert.match(scopedFieldEvidence('ما أهداف الدورة؟',[flat])!.text,/بناء أدوات/);
 assert.ok(!scopedFieldEvidence('ما أهداف الدورة؟',[flat])!.text.includes('الأسبوع الأول'));
 const skills=chunk('٥ المهارات النهائية للمتدرب\nفهم النماذج وبناء أوامر وتقييم النتائج.');
 assert.match(scopedFieldEvidence('ما المهارات التي يكتسبها المتدرب في الدورة؟',[skills])!.text,/فهم النماذج/);
 assert.equal(scopedFieldEvidence('ما المهارات التي يكتسبها المتدرب في الدورة؟',[skills,chunk('بقية المهارات','b')]),null);
});
test('a heading-only response is rejected while a short literal quantity remains valid',()=>{
 const s={...chunk('٥ المهارات النهائية للمتدرب\n'+('بناء أدوات وتقييم نتائج '.repeat(20))),citation:1,similarity:0.8,keyword:1,score:1};
 assert.equal(headingOnlyAnswer('٥ المهارات النهائية للمتدرب [1].',[s]),true);
 assert.equal(headingOnlyAnswer('يبني المتدرب أدوات ويقيّم النتائج [1].',[s]),false);
 const n={...s,text:'20 ساعة تدريب\n'+s.text};
 assert.equal(headingOnlyAnswer('20 ساعة تدريب [1].',[n]),false);
});
test('descriptive questions preserve the full skills list beyond its matching heading',()=>{
 const text='المهارات النهائية للمتدرب\nمهارات المتدرب بنهاية الدورة\n'+('شرح تمهيدي طويل '.repeat(60))+'\nبناء أدوات وتقييم النتائج وحماية البيانات.';
 assert.equal(focusEvidence(text,'ما المهارات التي يكتسبها المتدرب؟'),text);
});
