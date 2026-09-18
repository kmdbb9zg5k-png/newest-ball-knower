import assert from 'node:assert/strict';
import { createGameplayReplayRecorder } from '../public/play-moment-3d/replay.js';

const state=()=>({simTime:1,phase:'dead',mode:'run',selected:0,drive:{down:2,ball:31,toGo:4,clock:62},input:{x:0,z:0,sprint:false},assist:false,defense:'over-three',carrierIndex:6,lastSkill:null,players:[]});
const response=(status,payload)=>({ok:status>=200&&status<300,status,json:async()=>payload});

const lateBound=createGameplayReplayRecorder(state,{environment:()=>({viewport:[320,180],pixelRatio:1}),endpoints:['/late-bound']});
const originalFetch=globalThis.fetch;
let lateBoundCalled=false;
globalThis.fetch=async()=>{lateBoundCalled=true;return response(201,{id:'bk_late_bound'})};
try{await lateBound.submit('existing test compatibility')}finally{globalThis.fetch=originalFetch}
assert.equal(lateBoundCalled,true,'The default fetch must be resolved at submit time so existing report tests and browser shims keep working');

let calls=[];
const fallback=createGameplayReplayRecorder(state,{environment:()=>({viewport:[1108,512],pixelRatio:3}),requestTimeoutMs:40,endpoints:['/stuck','/fallback'],fetchImpl:async(endpoint,{signal})=>{
 calls.push(endpoint);
 if(endpoint==='/stuck')return new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
 return response(200,{id:'bk_test_ok',reviewUrl:'/review/bk_test_ok'});
}});
const sent=await fallback.submit('held stick test');
assert.deepEqual(calls,['/stuck','/fallback'],'A timed-out QA endpoint must fall through to production');
assert.equal(sent.id,'bk_test_ok');

const failure=createGameplayReplayRecorder(state,{environment:()=>({viewport:[1,1],pixelRatio:1}),requestTimeoutMs:40,endpoints:['/fails'],fetchImpl:async()=>response(503,{error:'Service unavailable'})});
await assert.rejects(()=>failure.submit(''),/Service unavailable/,'A failed report must return control instead of spinning forever');
console.log('PASS: gameplay report timeout, failover, success receipt, and actionable failure.');
