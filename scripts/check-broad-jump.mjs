import assert from 'node:assert/strict';
import {newJump,pressJump,stepJump,readJumps,saveJump,JUMP_STORAGE,REP_SECONDS,INPUT_PAUSE,POWER_SECONDS} from '../combine/broad-jump.js';
const athlete={id:'test',name:'Test Athlete',position:'WR'};
const advance=(s,t)=>{for(let n=0;n<Math.round(t*120);n++)stepJump(s,1/120);};
function launch(taps){const s=newJump(athlete);pressJump(s);let n=1;while(s.phase==='power'){advance(s,.055);if(n<taps&&s.phase==='power'){pressJump(s);n++;}}advance(s,1.4);pressJump(s);return s;}
const high=launch(36),low=launch(2);assert(high.target>low.target);assert.equal(high.power,1);
advance(high,1.05);pressJump(high);const landing=high.landing;pressJump(high);assert.equal(high.landing,landing);advance(high,2);assert.equal(high.phase,'finished');assert(high.distance>3);
const missed=launch(36);advance(missed,3.4);assert(missed.distance<high.distance);
const idle=newJump(athlete);advance(idle,20);assert.equal(idle.phase,'idle');pressJump(idle);for(let i=0;i<100;i++)pressJump(idle);assert.equal(idle.taps,1);advance(idle,6.5);assert.equal(idle.phase,'finished');assert.equal(idle.distance,0);
let stored='[]';globalThis.localStorage={getItem:()=>stored,setItem:(key,value)=>{assert.equal(key,JUMP_STORAGE);stored=value;}};assert(saveJump(high,'standalone'));assert.equal(readJumps().length,1);stored='{}';assert.deepEqual(readJumps(),[]);stored='invalid';assert.deepEqual(readJumps(),[]);globalThis.localStorage.setItem=()=>{throw Error('quota')};assert.equal(saveJump(high,'standalone'),false);
console.log('PASS power cap, input debounce, timing, missed launch/landing, single landing lock, persistence and storage failures');
// The visible green bounds are the scoring bounds, including both edges.
for(const [progress,expected] of [[.779,0],[.78,1],[.88,1],[.98,1],[.981,0]]){
 const s=launch(36);s.elapsed=progress*s.flight;pressJump(s);assert.equal(s.landing,expected,`landing at ${progress}`);
 const locked=s.landingAt;s.elapsed=.88*s.flight;for(let n=0;n<30;n++)pressJump(s);assert.equal(s.landing,expected);assert.equal(s.landingAt,locked);
 advance(s,3.4);assert.equal(s.penalty,expected?0:.45);assert.equal(s.stumble,!expected);assert.equal(s.distance,s.target-s.penalty);
 const result=JSON.stringify(s);advance(s,10);assert.equal(JSON.stringify(s),result,'finished rep must freeze');
}
const expiry=launch(0);expiry.phase='aim';expiry.elapsed=0;stepJump(expiry,REP_SECONDS+INPUT_PAUSE-.001);assert.equal(expiry.phase,'aim');stepJump(expiry,.0011);assert.equal(expiry.phase,'finished');pressJump(expiry);assert.equal(expiry.distance,0);
console.log('PASS exact green boundaries, permanent landing lock, stumble penalty, frozen result, 1.6-second launch expiry');

const guarded=newJump(athlete);pressJump(guarded,'power');stepJump(guarded,POWER_SECONDS);
for(let i=0;i<20;i++)pressJump(guarded,'power');assert.equal(guarded.phase,'aim');
pressJump(guarded,'timing');assert.equal(guarded.phase,'aim');stepJump(guarded,.35);pressJump(guarded,'timing');assert.equal(guarded.phase,'flight');
pressJump(guarded,'timing');assert.equal(guarded.landing,null);stepJump(guarded,.35);pressJump(guarded,'power');assert.equal(guarded.landing,null);pressJump(guarded,'timing');assert.equal(guarded.landing,0);
console.log('PASS separate power input and transition pauses');

const thumbs=newJump(athlete);pressJump(thumbs,'power-left');pressJump(thumbs,'power-right');assert.equal(thumbs.taps,2);pressJump(thumbs,'power-left');assert.equal(thumbs.taps,2);
const {jumpMarker,landingFeedback,LAND_GREEN_END,LAND_GREEN_START}=await import('../combine/broad-jump.js');
thumbs.phase='aim';let previous=0;for(let t=0;t<=1.8;t+=.01){thumbs.elapsed=t;const marker=jumpMarker(thumbs);assert(marker>=previous);previous=marker;}
assert(Math.abs((LAND_GREEN_END-LAND_GREEN_START)*thumbs.flight-.24)<1e-9);
for(const [at,result] of [[.5,'TOO EARLY'],[.9,'PERFECT'],[.99,'TOO LATE'],[1,'MISSED']]){assert.equal(landingFeedback({landing:at===.9?1:0,landingAt:at}),result);}
console.log('PASS simultaneous thumbs, one-way launch meter, faster flight and 240ms landing window, explicit feedback');
