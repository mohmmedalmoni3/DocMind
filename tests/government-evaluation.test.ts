import { test } from 'node:test';
import assert from 'node:assert/strict';
import { governmentCases, checkGovernmentPassages } from '../lib/government-evaluation';
test('government evaluation rejects a correct-file citation to the wrong passage', () => {
  const question = governmentCases.find(t=>t.id==='excluded-work')!;
  const sources = [{citation:1,text:'لا يشمل هذا التصريح هدم الجدران الحاملة.'}, {citation:2,text:'الرسم هو 25 دينارا.'}];
  assert.equal(checkGovernmentPassages(question,'لا يتيح هدم الجدران الحاملة [2]',sources),false);
  assert.equal(checkGovernmentPassages(question,'لا يتيح هدم الجدران الحاملة [1]',sources),true);
});
test('validity passage check accepts its actual Arabic inflection and rejects the processing passage',()=>{
  const question=governmentCases.find(t=>t.id==='validity')!;
  const sources=[{citation:1,text:'صلاحية التصريح هي 60 يوما من تاريخ إصداره.'},{citation:2,text:'مدة الإنجاز 3 أيام عمل.'}];
  assert.equal(checkGovernmentPassages(question,'60 يوما من تاريخ إصداره [1]',sources),true);
  assert.equal(checkGovernmentPassages(question,'60 يوما من تاريخ إصداره [2]',sources),false);
});
