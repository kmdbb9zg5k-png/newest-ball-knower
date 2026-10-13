import assert from 'node:assert/strict';
import {newJump,pressJump,stepJump,readJumps,saveJump,JUMP_STORAGE} from '../combine/broad-jump.js';
const athlete={id:'test',name:'Test Athlete',position:'WR'};
const advance=(s,t)=>{for(let n=0;n<Math.round(t*120);n++)stepJump(s,1/120);};
function launch(taps){const s=newJump(athlete);pressJump(s);for(let i=0;i<taps;i++){advance(s,.075);pressJump(s);}while(s.phase==='power')stepJump(s,1/120);advance(s,.4);pressJump(s);return s;}
const high=launch(28),low=launch(2);assert(high.target>low.target);assert.equal(high.power,1);
advance(high,.79);pressJump(high);const landing=high.landing;pressJump(high);assert.equal(high.landing,landing);advance(high,2);assert.equal(high.phase,'finished');assert(high.distance>3);
const missed=launch(28);advance(missed,2.1);assert(missed.distance<high.distance);
const idle=newJump(athlete);advance(idle,20);assert.equal(idle.phase,'idle');pressJump(idle);for(let i=0;i<100;i++)pressJump(idle);assert.equal(idle.taps,1);advance(idle,6.1);assert.equal(idle.phase,'finished');assert.equal(idle.distance,0);
let stored='[]';globalThis.localStorage={getItem:()=>stored,setItem:(key,value)=>{assert.equal(key,JUMP_STORAGE);stored=value;}};assert(saveJump(high,'standalone'));assert.equal(readJumps().length,1);stored='{}';assert.deepEqual(readJumps(),[]);stored='invalid';assert.deepEqual(readJumps(),[]);globalThis.localStorage.setItem=()=>{throw Error('quota')};assert.equal(saveJump(high,'standalone'),false);
console.log('PASS power cap, input debounce, timing, missed launch/landing, single landing lock, persistence and storage failures');
// The visible green bounds are the scoring bounds, including both edges.
for(const [progress,expected] of [[.779,0],[.78,1],[.88,1],[.98,1],[.981,0]]){
 const s=launch(28);s.elapsed=progress*s.flight;pressJump(s);assert.equal(s.landing,expected,`landing at ${progress}`);
 const locked=s.landingAt;s.elapsed=.88*s.flight;for(let n=0;n<30;n++)pressJump(s);assert.equal(s.landing,expected);assert.equal(s.landingAt,locked);
 advance(s,2);assert.equal(s.penalty,expected?0:.45);assert.equal(s.stumble,!expected);assert.equal(s.distance,s.target-s.penalty);
 const result=JSON.stringify(s);advance(s,10);assert.equal(JSON.stringify(s),result,'finished rep must freeze');
}
const expiry=launch(0);expiry.phase='aim';expiry.elapsed=0;stepJump(expiry,2.999);assert.equal(expiry.phase,'aim');stepJump(expiry,.0011);assert.equal(expiry.phase,'finished');pressJump(expiry);assert.equal(expiry.distance,0);
console.log('PASS exact green boundaries, permanent landing lock, stumble penalty, frozen result, 3-second launch expiry');
