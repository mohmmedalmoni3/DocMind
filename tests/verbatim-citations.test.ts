import test from 'node:test';
import assert from 'node:assert/strict';
import {alignVerbatimCitations} from '../lib/citations';
import type {Source} from '../lib/types';
const source:Source={id:'a',file:'a.md',page:null,section:'الرسوم',citation:1,similarity:.8,keyword:1,score:.03,text:'رسم تصريح الصيانة المنزلية البسيطة هو 25 دينارا. يعفى المستفيد من رسم التصريح بشرط شهادة استحقاق. لا ينص الدليل على إعفاء جميع المتقاعدين تلقائيا.'};
const other={...source,id:'b',citation:3,text:'مدة الإنجاز 3 أيام عمل.'};
test('verbatim provenance repair retains negative source sentence and fixes unique citation',()=>{
  const text='لا، لا ينص الدليل على إعفاء جميع المتقاعدين تلقائيا من رسم تصريح الصيانة المنزلية البسيطة [3].';
  assert.equal(alignVerbatimCitations(text,[source,other]),text.replace('[3]','[1]'));
});
test('verbatim repair rejects ambiguous, negation-changed and unsupported extra claims',()=>{
  const texts=['ينص الدليل على إعفاء جميع المتقاعدين تلقائيا [3].','لا ينص الدليل على إعفاء جميع المتقاعدين تلقائيا باستثناء العسكريين [3].'];
  for(const text of texts)assert.equal(alignVerbatimCitations(text,[source,other]),text);
  const text='لا ينص الدليل على إعفاء جميع المتقاعدين تلقائيا [3].';
  assert.equal(alignVerbatimCitations(text,[source,{...source,citation:2},other]),text);
});

