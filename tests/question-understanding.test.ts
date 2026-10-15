import test from 'node:test';
import assert from 'node:assert/strict';
import {understandQuestion,validatePlan,interpretClause} from '../lib/question-understanding';
test('implicit colloquial request maps every aspect without adding facts or guaranteed benefits',async()=>{
 const p=await understandQuestion('كم عدد الساعات و وعن ما بتسولف الدورة وشو راح استفيد منها','unused');
 assert.deepEqual(p.parts,['كم عدد ساعات الدورة؟','ما موضوع الدورة؟','ما المهارات التي يكتسبها المتدرب في الدورة؟']);assert.equal(p.mode,'rules');
 assert.equal(interpretClause('ما راح أستفيد منها؟','الدورة'),'ما المهارات التي يكتسبها المتدرب في الدورة؟');
 assert.equal(interpretClause('هل الوظيفة مضمونة بعد الدورة؟','الدورة'),'هل الوظيفة مضمونة بعد الدورة؟');
 const egypt=await understandQuestion('كام الساعات والكورس بيتكلم عن إيه وإيه هستفيد منه','unused');
 assert.deepEqual(egypt.parts,['كم عدد ساعات الدورة؟','ما موضوع الدورة؟','ما المهارات التي يكتسبها المتدرب في الدورة؟']);
});
test('semantic plans reject dropped clauses, missing conditions, fabricated spans and overlong plans',()=>{
 const q='كم الساعات وكم الرسوم بعد الدفع';
 const good={parts:[{span:'كم الساعات',query:'كم عدد الساعات؟'},{span:'كم الرسوم بعد الدفع',query:'كم الرسوم بعد الدفع؟'}]};
 assert.ok(validatePlan(q,good));
 assert.equal(validatePlan(q,{parts:[good.parts[0]]}),null);
 assert.equal(validatePlan(q,{parts:[good.parts[0],{span:'كم الرسوم بعد الدفع',query:'كم الرسوم؟'}]}),null);
 assert.equal(validatePlan(q,{parts:[{span:'معلومة غير مكتوبة',query:'ما الرسوم؟'}]}),null);
 assert.equal(validatePlan(q,{parts:[{span:q,query:'كم عدد الساعات؟'}]}),null);
 assert.equal(validatePlan('عطني سالفة البرنامج',{parts:[{span:'عطني سالفة البرنامج',query:'ما الفائدة من البرنامج؟'}]}),null);
});
test('unknown dialect invokes local semantic interpretation and preserves all spans',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{
  calls++;
  const plan={parts:[{span:'أبغى شرح البرنامج',query:'ما موضوع البرنامج؟'},{span:'ودي أعرف مردوده',query:'ما النتائج الموثقة للبرنامج؟'}]};
  return Response.json({message:{content:JSON.stringify(plan)}});
 });
 const p=await understandQuestion('أبغى شرح البرنامج ودي أعرف مردوده','model-for-test');
 assert.equal(p.mode,'model');assert.equal(p.parts.length,2);assert.equal(calls,1);
});
