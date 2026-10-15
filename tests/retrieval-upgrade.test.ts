import test from 'node:test';
import assert from 'node:assert/strict';
import {arabiziView} from '../lib/query-views';
import {applyOrder,rerankEvidence} from '../lib/reranker';
import {retrievalMetrics,percentile} from '../lib/retrieval-metrics';
import type {Source} from '../lib/types';
const sources:Source[]=[0,1].map(i=>({id:String(i),file:'a',page:i+1,text:'source',section:'',citation:i+1,similarity:.5,keyword:1,score:1}));
test('query views preserve codes, quoted names and numeric values',()=>{
 assert.equal(arabiziView('shu sa3at الدورة 7B 2026'),'شو ساعات الدورة 7B 2026');
 assert.equal(arabiziView('shu sa3at "Kam"'), 'شو ساعات "Kam"');
 assert.equal(arabiziView('service AB37 2026'),undefined);
 assert.equal(arabiziView('KAM service'),undefined);
 assert.equal(arabiziView('shu sa3at constructor toString'),'شو ساعات constructor toString');
});
test('reranker accepts only a complete permutation and preserves provenance',()=>{
 assert.equal(applyOrder(sources,{order:[1,1]}),null);assert.equal(applyOrder(sources,{order:[2,0]}),null);
 const sorted=applyOrder(sources,{order:[1,0]})!;assert.equal(sorted[0].id,'1');assert.equal(sorted[0].page,2);assert.equal(sorted[0].citation,1);
 assert.equal(sources[0].id,'0');
});
test('reranker failure preserves hybrid order; cancellation remains cancellation',async t=>{
 t.mock.method(globalThis,'fetch',async()=>{throw new Error('offline model unavailable');});
 assert.deepEqual((await rerankEvidence('query',sources,'test',200)).sources,sources);
 const controller=new AbortController();controller.abort();
 await assert.rejects(rerankEvidence('query',sources,'test',200,controller.signal));
});
test('retrieval metrics distinguish precision from recall and deduplicate',()=>{
 assert.deepEqual(retrievalMetrics(['a','a','b'],['a','c'],5),{precision:.2,recall:.5,mrr:1});
 assert.equal(percentile([8,1,3,2],.95),8);assert.equal(percentile([], .5),null);
});
