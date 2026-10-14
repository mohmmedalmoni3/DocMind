import test from 'node:test';
import assert from 'node:assert/strict';
import {routeService,wholeServiceContext,serviceFollowup,serviceCatalog} from '../lib/service-routing';
import {focusEvidence} from '../lib/evidence-focus';
import type {Chunk,Source} from '../lib/types';
const chunks:Chunk[]=[
  {id:'a',file:'a.md',page:1,section:'خدمة إصدار تصريح السوق',text:'# خدمة إصدار تصريح السوق\n\nالشروط',embedding:[1,0]},
  {id:'b',file:'b.md',page:1,section:'خدمة تجديد تصريح السوق',text:'# خدمة تجديد تصريح السوق\n\nالشروط',embedding:[1,0]},
  {id:'c',file:'c.md',page:2,section:'إجراءات إصدار تصريح السوق',text:'# إجراءات إصدار تصريح السوق\n\nالرسوم',embedding:[1,0]},
];
test('explicit title can follow a document masthead; a file naming two services is not auto-scoped',()=>{
  assert.equal(serviceCatalog([{...chunks[0],text:'مكتب تجريبي\nاسم الخدمة: إصدار تصريح السوق\n\nالوثائق'}])[0].name,'إصدار تصريح السوق');
  assert.equal(serviceCatalog([{...chunks[0],text:'خدمة إصدار تصريح السوق\nخدمة تجديد تصريح السوق'}]).length,0);
});
test('generic service question asks clarification; exact name groups its procedure file',()=>{
  assert.equal(routeService('كم الرسوم؟',chunks).clarify?.length,2);
  assert.deepEqual(routeService('ما رسوم إصدار تصريح السوق؟',chunks).files,['a.md','c.md']);
  assert.equal(routeService('كم الرسوم؟',[chunks[1]]).clarify,undefined);
  assert.equal(routeService('قارن إصدار تصريح السوق وتجديد تصريح السوق',chunks).groups?.length,2);
  assert.equal(routeService('ما رسوم جواز السفر؟',chunks).files,undefined);
});
test('service follow-up preserves duration instead of copying the previous fee question',()=>{
  const history=[{role:'user' as const,content:'كم رسم خدمة إصدار تصريح السوق؟'}];
  assert.equal(serviceFollowup('وما مدة الإنجاز ومتى تبدأ؟',history,chunks),'وما مدة الإنجاز ومتى تبدأ لخدمة إصدار تصريح السوق؟');
  assert.equal(serviceFollowup('وما مدة الإنجاز ومتى تبدأ؟',[{role:'user',content:'قارن إصدار تصريح السوق و تجديد تصريح السوق'}],chunks),undefined);
  assert.deepEqual(routeService('هل المستفيد معفى من رسوم إصدار تصريح السوق وما الإثبات؟',chunks).files,['a.md','c.md']);
});
test('whole service keeps each original passage and source metadata, respects hard budget',()=>{
  const all:Source[]=chunks.map(({embedding,...c},i)=>({...c,similarity:.8,keyword:1,score:.03,citation:i+1}));
  const result=wholeServiceContext([all[1]],all,1000);
  assert.deepEqual(result.map(s=>s.id),['b','a','c']);
  assert.deepEqual(result.map(s=>s.citation),[1,2,3]);
  assert.equal(result[2].page,2);
  assert.equal(wholeServiceContext([all[1]],all,1).length,1);
});
test('focused context never drops distant exemption conditions',()=>{
  const text='رسوم إصدار تصريح السوق 19 دينارا.\n\n'+('تفاصيل التقديم والمتابعة. '.repeat(40))+'\n\nيعفى المستفيد بشرط إرفاق إثبات ساري.';
  assert.equal(focusEvidence(text,'كم رسوم إصدار تصريح السوق؟'),text);
});
