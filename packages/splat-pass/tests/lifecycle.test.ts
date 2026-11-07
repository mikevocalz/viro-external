import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSplatHandle } from '../src/lifecycle.ts';
import { validateSplatOptions } from '../src/validate.ts';
test('release shares pending work and removes state only after successful detach', async () => {
 let done!: () => void; let calls=0; let removed=0;
 const h=createSplatHandle('a',()=>12,()=>{calls++;return new Promise<void>(r=>done=r);},()=>removed++);
 const a=h.release(),b=h.release(); assert.equal(a,b); await Promise.resolve();
 assert.equal(calls,1);assert.equal(removed,0);done();await a;
 assert.equal(removed,1);assert.equal(h.splatCount(),0);await h.release();assert.equal(calls,1);
});
test('failed detach remains tracked and can be retried',async()=>{
 let attempts=0,removed=0;
 const h=createSplatHandle('a',()=>3,async()=>{if(++attempts===1)throw Error('busy');},()=>removed++);
 await assert.rejects(h.release(),/busy/);assert.equal(removed,0);assert.equal(h.splatCount(),3);
 await h.release();assert.equal(removed,1);
});
const base={sceneNavTag:1,source:{uri:'file:///person.spz',format:'spz' as const}};
test('static SPZ and zero default cap are accepted',()=>{validateSplatOptions(base);validateSplatOptions({...base,quality:{maxSplats:0}});});
test('unsupported advanced features fail before native allocation',()=>{
 assert.throws(()=>validateSplatOptions({...base,getTimestamp:()=>1}),/not integrated/);
 assert.throws(()=>validateSplatOptions({...base,source:{...base.source,format:'spz-4d'}}),/static SPZ/);
 assert.throws(()=>validateSplatOptions({...base,quality:{frameBudgetMs:4}}),/not integrated/);
});
test('invalid handles and allocation sizes are rejected',()=>{
 for(const sceneNavTag of [0,-1,NaN,1.5])assert.throws(()=>validateSplatOptions({...base,sceneNavTag}));
 for(const maxSplats of [-1,NaN,Infinity,2147483648])assert.throws(()=>validateSplatOptions({...base,quality:{maxSplats}}));
 assert.throws(()=>validateSplatOptions({...base,source:{...base.source,uri:''}}));
});
