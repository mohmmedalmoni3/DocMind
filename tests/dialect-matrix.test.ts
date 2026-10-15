import test from 'node:test';
import assert from 'node:assert/strict';
import cases from '../evaluation/arabic-dialects.json';
import {understandQuestion,interpretClause} from '../lib/question-understanding';
import {normalizeQuestion} from '../lib/query-normalization';
for(const c of cases)test(`three distinct requests: ${c.country}`,async()=>{
 const p=await understandQuestion(c.question,'no-model-required');
 assert.equal(p.mode,'rules');
 assert.deepEqual(p.parts,['كم عدد ساعات الدورة؟',c.country==='جزر القمر'?'ما محتوى الدورة؟':'ما موضوع الدورة؟','ما المهارات التي يكتسبها المتدرب في الدورة؟']);
});
test('normalization leaves yes/no, units and conditions intact',()=>{
 assert.equal(normalizeQuestion('واش الشهادة معتمدة؟'),'واش الشهادة معتمدة؟');
 assert.equal(normalizeQuestion('الوزن 20 جم'),'الوزن 20 جم');
 for(const q of ['كم ساعات الدورة للأطفال فقط؟','ما بستفيد منها بدون شهادة؟','كم ساعة الدورة بعد التخفيض؟'])assert.equal(interpretClause(q,'الدورة'),q);
});
