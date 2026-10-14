import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeQuestion} from '../lib/query-normalization';
import {lexicalTerms,rankQueries} from '../lib/retrieval';
import {embed} from '../lib/ollama';
import {config} from '../lib/config';
import {answer} from '../lib/rag';
import {emptyIndex,writeIndex} from '../lib/index-store';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {sessionEvidence} from '../lib/session-evidence';

test('dialect normalization preserves facts, negatives, units and named entities',()=>{
 for(const word of ['شقد','شكد','قديش','اديش','كام'])assert.equal(normalizeQuestion(`${word} الساعات؟`),'كم عدد الساعات؟');
 assert.equal(normalizeQuestion('وَشْقَد الرسوم بدون إعفاء ٢٠ دينار؟'),'وكم الرسوم بدون إعفاء ٢٠ دينار؟');
 assert.equal(normalizeQuestion('شو الأوراق المطلوبة لخدمة إصدار تصريح السوق؟'),'ما الأوراق المطلوبة لخدمة إصدار تصريح السوق؟');
 assert.equal(normalizeQuestion('شقد ساعات الجلسة اليومية وليس إجمالي الدورة؟'),'كم عدد ساعات الجلسة اليومية وليس إجمالي الدورة؟');
 assert.equal(normalizeQuestion('شركة وشاح: لا تقل عن ١٢ ساعة'),'شركة وشاح: لا تقل عن ١٢ ساعة');
 assert.equal(normalizeQuestion('How many hours?'),'How many hours?');
 assert.equal(normalizeQuestion('كم عمر شادي؟'),'كم عمر شادي؟');
});
test('BM25 matches Arabic articles and digits without deleting negation',()=>{
 assert.deepEqual(lexicalTerms('الساعات ٢٠'),lexicalTerms('ساعات 20'));
 assert.deepEqual(lexicalTerms('والرسوم'),lexicalTerms('رسوم'));
 assert.ok(lexicalTerms('لا يسمح بدون موافقة').includes('لا'));
});
test('query fusion retains original named entity evidence and unique citations',()=>{
 const chunks=[{id:'a',file:'a.md',page:1,section:'',text:'ساعات الدورة ٢٠',embedding:[1,0]},{id:'b',file:'b.md',page:1,section:'',text:'وشاح سياسة خاصة',embedding:[0,1]}];
 const r=rankQueries(chunks,[[1,0],[0,1]],['عدد ساعات الدورة','وشاح'],2);
 assert.deepEqual(new Set(r.map(s=>s.id)),new Set(['a','b']));assert.deepEqual(r.map(s=>s.citation),[1,2]);
});
test('embedding contract rejects zero, nonfinite and mixed dimensions; model prefixes stay correct',async t=>{
 const old=config.embedding;t.after(()=>{config.embedding=old;});
 let returned:unknown=[[1,0]];const bodies:any[]=[];
 t.mock.method(globalThis,'fetch',async(_url:unknown,init?:RequestInit)=>{bodies.push(JSON.parse(String(init?.body)));return Response.json({embeddings:returned});});
 config.embedding='bge-m3';await embed(['نص عربي']);assert.deepEqual(bodies.at(-1).input,['نص عربي']);assert.equal(bodies.at(-1).truncate,false);
 config.embedding='nomic-embed-text';await embed(['document']);assert.equal(bodies.at(-1).input[0],'search_document: document');await embed(['unique test query'],true);assert.equal(bodies.at(-1).input[0],'search_query: unique test query');
 for(const invalid of [[[0,0]],[[1,0],[1]],[[null,1]],[null]]){returned=invalid;await assert.rejects(embed(invalid.length===2?['a','b']:['a']),/invalid embeddings/);}
});
test('full pipeline sends canonical dialect question to generation and preserves selected file scope',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'docmind-dialect-'));const old=config.data;config.data=dir;
 t.after(async()=>{config.data=old;await fs.rm(dir,{recursive:true,force:true});});
 const index=emptyIndex();index.chunks=[{id:'a',file:'course.md',page:3,section:'التدريب',text:'إجمالي ساعات التدريب 20 ساعة. مدة الجلسة اليومية 2 ساعة.',embedding:[1,0]},{id:'b',file:'other.md',page:1,section:'',text:'مدة البرنامج الثاني 90 ساعة.',embedding:[1,0]}];await writeIndex(index);
 let prompt='';let inputs:string[]=[];
 t.mock.method(globalThis,'fetch',async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/api/tags'))return Response.json({models:[{name:config.model}]});
  const body=JSON.parse(String(init?.body));
  if(url.endsWith('/api/embed')){inputs=body.input;return Response.json({embeddings:body.input.map(()=>[1,0])});}
  prompt=body.messages.at(-1).content;
  return new Response(JSON.stringify({message:{content:'إجمالي التدريب 20 ساعة [1].'},done:true})+'\n');
 });
 const r=await answer('شقد الساعات',[],()=>{},{files:['course.md'],bypassCache:true});
 assert.equal(r.query,'كم عدد الساعات');assert.ok(inputs.some(q=>q.includes('شقد الساعات'))&&inputs.some(q=>q.includes('كم عدد الساعات')));
 assert.ok(prompt.includes('RESOLVED SEARCH QUESTION (same intent, not evidence): كم عدد الساعات'));assert.ok(!prompt.includes('90 ساعة'));assert.equal(r.sources[0].file,'course.md');assert.match(r.text,/20 ساعة/);
});
test('unsupported generated number is repaired once, or refused if repair remains unsupported',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'docmind-number-'));const old=config.data;config.data=dir;
 t.after(async()=>{config.data=old;await fs.rm(dir,{recursive:true,force:true});});
 const index=emptyIndex();index.chunks=[{id:'a',file:'course.md',page:3,section:'التدريب',text:'مدة الجلسة اليومية 2 ساعة.',embedding:[1,0]}];await writeIndex(index);
 let repair='مدة الجلسة اليومية 2 ساعة [1].';let repairs=0;
 t.mock.method(globalThis,'fetch',async(url:string,init?:RequestInit)=>{
  if(url.endsWith('/api/tags'))return Response.json({models:[{name:config.model}]});
  const body=JSON.parse(String(init?.body));
  if(url.endsWith('/api/embed'))return Response.json({embeddings:body.input.map(()=>[1,0])});
  if(body.stream)return new Response(JSON.stringify({message:{content:'مدة الجلسة اليومية 4 ساعات [1].'},done:true})+'\n');
  repairs++;return Response.json({message:{content:repair}});
 });
 const good=await answer('شقد ساعات الجلسة اليومية؟',[],()=>{},{files:['course.md'],bypassCache:true,style:'detailed'});assert.match(good.text,/2 ساعة/);assert.equal(repairs,1);
 repair='مدة الجلسة اليومية 9 ساعات [1].';
 const bad=await answer('شقد ساعات الجلسة اليومية؟',[],()=>{},{files:['course.md'],bypassCache:true,style:'detailed'});assert.match(bad.text,/لم أجد/);assert.equal(repairs,2);
});
test('literal duration handles different documents and values; declines conflicting files, qualifiers and other fields',()=>{
 for(const text of ['20 ساعة إجمالي ساعات التدريب 2 ساعة مدة الجلسة اليومية','مدة الجلسة اليومية: ٣ ساعات','مدة الجلسة اليومية 90 دقيقة']){
  const chunk={id:'x',file:'new.txt',page:2,section:'',text,embedding:[1,0]};
  const source={...chunk,citation:1,similarity:0.8,keyword:1,score:1};
  assert.ok(sessionEvidence('كم عدد ساعات الجلسة اليومية؟',[source],[chunk]));
  assert.equal(sessionEvidence('كم عدد الساعات؟',[source],[chunk]),null);
  assert.equal(sessionEvidence('كم عدد ساعات الجلسة اليومية؟',[source],[chunk,{...chunk,id:'y',file:'other.pdf'}]),null);
  assert.equal(sessionEvidence('كم عدد ساعات الجلسة اليومية؟',[source],[{...chunk,text:'ليست '+text}]),null);
  assert.equal(sessionEvidence('كم عدد ساعات الجلسة اليومية للأطفال؟',[source],[chunk]),null);
 }
});
