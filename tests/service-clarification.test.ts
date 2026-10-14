import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {config} from '../lib/config';
import {emptyIndex,writeIndex} from '../lib/index-store';
import {answer} from '../lib/rag';
import {generationModel} from '../lib/ollama';
test('ambiguous service emits clarification without embedding/generation and strict model never falls back',async t=>{
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'docmind-services-'));
  const old={data:config.data,strict:config.strictModel,routing:config.serviceRouting};
  config.data=dir;config.serviceRouting=true;
  t.after(async()=>{config.data=old.data;config.strictModel=old.strict;config.serviceRouting=old.routing;await fs.rm(dir,{recursive:true,force:true});});
  let fallbackOnly=false;
  t.mock.method(globalThis,'fetch',async(url:string)=>{
    assert.ok(url.endsWith('/api/tags'),'Clarification must not embed or generate');
    return Response.json({models:[{name:fallbackOnly?config.fallback:config.model}]});
  });
  const index=emptyIndex();
  index.chunks=['إصدار تصريح السوق','تجديد تصريح السوق'].map((name,i)=>({id:String(i),file:`${i}.md`,page:1,section:`خدمة ${name}`,text:`# خدمة ${name}\n\nرسم الخدمة ${i+10} دينارا.`,embedding:[1,0]}));
  await writeIndex(index);
  const result=await answer('كم الرسوم؟',[],()=>{},{bypassCache:true});
  assert.match(result.text,/أي خدمة تقصد/);assert.equal(result.sources.length,0);
  config.strictModel=true;fallbackOnly=true;
  await assert.rejects(generationModel(),/fallback is disabled/);
});
