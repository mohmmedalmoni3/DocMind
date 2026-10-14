import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {questionParts} from '../lib/question-parts';
import {config} from '../lib/config';
import {emptyIndex,writeIndex} from '../lib/index-store';
import {answer} from '../lib/rag';
import type {RagEvent} from '../lib/types';

test('compound parser preserves requested parts and constraints in Arabic and English',()=>{
 assert.deepEqual(questionParts('شقد الساعات و اهداف الدورة'),['كم عدد الساعات؟','ما اهداف الدورة؟']);
 assert.deepEqual(questionParts('كم الرسوم وما المدة وهل يوجد إعفاء؟'),['كم الرسوم؟','ما المدة؟','هل يوجد إعفاء؟']);
 assert.equal(questionParts('ما الوثائق المطلوبة بما فيها عقد الإيجار وموافقة المالك؟').length,1);
 assert.equal(questionParts('قارن الرسوم والشروط بين الملفين').length,1);
 assert.deepEqual(questionParts('What is the budget and who owns it?'),['What is the budget?','who owns it?']);
 assert.deepEqual(questionParts('كم المدة، وما الرسوم؟').length,2);
 assert.equal(questionParts('كم المدة بعد الدفع وليس من إنشاء الحساب؟').length,1);
 assert.equal(questionParts('What is the budget?\nReference question: Earlier question').length,1);
 assert.equal(questionParts('1. كم الساعات؟\n2. ما الأهداف؟\n3. هل يوجد رقم هاتف؟').length,3);
});
test('compound answers cover both parts, retain partial refusal, merge citations and never leak other files',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'docmind-parts-'));const old=config.data;config.data=dir;
 t.after(async()=>{config.data=old;await fs.rm(dir,{recursive:true,force:true});});
 const index=emptyIndex();index.chunks=[
  {id:'hours',file:'course.md',page:1,section:'الساعات',text:'إجمالي ساعات الدورة 20 ساعة.',embedding:[1,0]},
  {id:'goals',file:'course.md',page:2,section:'أهداف الدورة',text:'أهداف الدورة تشمل بناء أوامر وتقييم النتائج.',embedding:[0,1]},
  {id:'private',file:'other.md',page:1,section:'',text:'Secret unrelated material 90 hours.',embedding:[1,1]},
 ];await writeIndex(index);
 const prompts:string[]=[];
 t.mock.method(globalThis,'fetch',async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/api/tags'))return Response.json({models:[{name:config.model}]});
  const body=JSON.parse(String(init?.body));
  if(url.endsWith('/api/embed'))return Response.json({embeddings:body.input.map((q:string)=>q.includes('اهداف')?[0,1]:[1,0])});
  const prompt=body.messages.at(-1).content;prompts.push(prompt);
  assert.ok(!prompt.includes('Secret unrelated'));
  const current=prompt.split('QUESTION: ').at(-1)||'';
  const passage=prompt.match(/\[(\d+)\] FILE: course.md; PAGE: (?:1|2); SECTION: (?:الساعات|أهداف الدورة)/)?.[1]||'1';
  const citation=(section:string)=>prompt.match(new RegExp(`\\[(\\d+)\\] FILE: course.md; PAGE: \\d; SECTION: ${section}`))![1];
  const text=current.includes('هاتف')?'لم أجد هذه المعلومات في المستندات.':current.includes('اهداف')?`تشمل الأهداف بناء أوامر وتقييم النتائج [${citation('أهداف الدورة')}].`:`إجمالي الدورة 20 ساعة [${citation('الساعات')}].`;
  return new Response(JSON.stringify({message:{content:text},done:true})+'\n');
 });
 const events:RagEvent[]=[];
 const good=await answer('شقد الساعات و اهداف الدورة',[],e=>events.push(e),{files:['course.md'],bypassCache:true});
 assert.match(good.text,/20 ساعة/);assert.match(good.text,/بناء أوامر/);assert.match(good.text,/### 2\./);assert.ok(good.sources.every(s=>s.file==='course.md'));
 assert.equal(events.filter(e=>e.type==='done').length,1);assert.equal(prompts.length,0,'Explicit scoped fields need no generation');
 const partial=await answer('شقد الساعات وهل يوجد رقم هاتف؟',[],()=>{},{files:['course.md'],bypassCache:true});
 assert.match(partial.text,/20 ساعة/);assert.match(partial.text,/### 2\./);assert.match(partial.text,/لم أجد/);
 assert.ok(new Set(partial.sources.map(s=>s.citation)).size===partial.sources.length);
});
