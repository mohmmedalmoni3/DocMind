import test from 'node:test';
import assert from 'node:assert/strict';
import {malformedAnswer} from '../lib/answer-quality';
test('generated artifacts and foreign-script hallucinations fail validation',()=>{
 assert.equal(malformedAnswer('[numer1] الدورة تستمر 20 ساعة [1]','ما الدورة؟',[]),true);
 assert.equal(malformedAnswer('مسار ي带领 المتدرب [1]','ما الدورة؟',[]),true);
 assert.equal(malformedAnswer('تتعلم Prompt Engineering [1]','ما الدورة؟',[]),false);
});
