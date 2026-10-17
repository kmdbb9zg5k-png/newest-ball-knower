import assert from 'node:assert/strict';import {newRBRep,newRBSession,startRB,stepRB,rbMove,saveRBScore,readRBScores,RB_KEY} from '../combine/rb-drill.js';
const p={id:'rb-test',name:'Runner',position:'RB'},counts={};
for(const hz of [15,60,120])for(const strategy of ['idle','straight','juke','spin','stiff','early','sideline'])for(let seed=0;seed<16;seed++){
 const s=newRBRep(p,seed%5,newRBSession(Math.imul(seed+1,2654435761)));assert.equal(rbMove(s,'spin'),false);startRB(s);let frames=0;
 while(s.phase!=='result'&&frames++<hz*25){const input={x:strategy==='sideline'?1:0,y:strategy==='idle'?0:-1};
  if(s.phase==='running'&&((strategy==='early'&&s.clock<.01)||s.separation<2&&['juke','spin','stiff'].includes(strategy)))rbMove(s,strategy==='early'?'spin':strategy,input);
  const cooldown=s.cooldown;if(cooldown>0)assert.equal(rbMove(s,'spin'),false);stepRB(s,1/hz,input);assert([s.x,s.z,s.db.x,s.db.z,s.distance].every(Number.isFinite));
 }
 assert.equal(s.phase,'result');assert(s.result.score>=0&&s.result.score<=100);if(strategy==='idle'||strategy==='straight'||strategy==='early')assert(!s.result.touchdown);if(strategy==='sideline')assert(['OUT OF BOUNDS','TACKLED'].includes(s.result.reason));counts[s.result.reason]=(counts[s.result.reason]||0)+1;
}
// Preview/handoff buffer movement without moving early; move never cancels held input.
const s=newRBRep(p,0,newRBSession(123));startRB(s);for(let i=0;i<300;i++)stepRB(s,.01,{x:0,y:-1});assert.equal(s.x,0);assert.equal(s.z,0);for(let i=0;i<66;i++)stepRB(s,.01,{x:0,y:-1});assert.equal(s.phase,'running');rbMove(s,'spin');for(let i=0;i<20;i++)stepRB(s,.01,{x:0,y:-1});assert(s.z>.4);
const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};assert(saveRBScore(p,[{score:90,touchdown:true,broken:1}]));assert.equal(readRBScores()[0].score,90);data.set(RB_KEY,'broken');assert.deepEqual(readRBScores(),[]);globalThis.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};assert.deepEqual(readRBScores(),[]);assert.equal(saveRBScore(p,[{score:80}]),false);
console.log('PASS 336 RB reps across 15/60/120 Hz, timing, contact, boundaries, handoff, cooldown and storage',counts);
