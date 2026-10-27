import assert from 'node:assert/strict';
import {newDash,pressDash,stepDash,tapStride,FINISH} from '../combine/dash.js';
import {recordGhost,validateGhost,createGhostPlayback,parseGhost,saveGhost,readGhosts,GHOST_KEY} from '../combine/dash-ghost.js';

const athlete={id:'ghost-fixture',name:'Jordan Replay',position:'WR',speed:85,acceleration:85,seed:55};
function run(mistakes=false){
  const state=newDash(athlete),inputs=[];pressDash(state,1.6);let last=-1;
  while(state.phase!=='finished'){
    stepDash(state,1/120);
    if(state.phase==='running'&&state.clock-last>=.24){const side=mistakes&&inputs.length%4===0?'right':state.nextSide;inputs.push([state.clock,side==='left'?0:1]);tapStride(state,side);last=state.clock;}
  }
  return {state,replay:recordGhost(athlete,inputs,state.clock,12345)};
}
for(const mistakes of [false,true]){
  const {state,replay}=run(mistakes);assert(replay,'Real recorded input stream validates');
  for(const fps of [30,60,120,144]){
    const p=createGhostPlayback(replay);for(let t=0;t<replay.time;t+=1/fps)p.at(t);
    const finish=p.at(replay.time);assert.equal(finish.phase,'finished');assert.equal(finish.distance,FINISH);assert(Math.abs(finish.clock-state.clock)<.00001);assert.equal(finish.hits,state.hits);assert.equal(finish.mistakes,state.mistakes);
    assert.equal(p.at(0).distance,0,'Replay seeks backward cleanly after reset');
    assert(Math.abs(p.at(replay.time).clock-state.clock)<.00001);
  }
  assert.deepEqual(parseGhost(JSON.stringify(replay)),replay);
  assert.equal(validateGhost({...replay,time:replay.time-.2}),null,'Edited faster finish rejected');
  assert.equal(validateGhost({...replay,time:replay.time+.2}),null,'Edited slower finish rejected');
  assert.equal(validateGhost({...replay,inputs:[[2,0],[1,1]]}),null,'Unordered inputs rejected');
  assert.equal(validateGhost({...replay,athlete:{...athlete,speed:Infinity}}),null);
  assert.equal(validateGhost({...replay,ruleset:'future'}),null,'Different ruleset rejected');
  assert.equal(validateGhost({...replay,inputs:Array(501).fill([0,0])}),null);
  assert.throws(()=>parseGhost('x'.repeat(64001)));
  assert.throws(()=>parseGhost('{'));
}
const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};
const good=run().replay,slow=run(true).replay;
assert(saveGhost(good,'best',storage));assert(saveGhost(slow,'best',storage));assert.equal(readGhosts(storage).best.time,good.time,'Slower attempt preserves best for this athlete');
assert(saveGhost(slow,'imported',storage));assert.equal(readGhosts(storage).imported.time,slow.time);
assert(saveGhost({...good,athlete:{...athlete,id:'another-athlete'}},'best',storage));assert.equal(readGhosts(storage).best.athlete.id,'another-athlete');
storage.setItem(GHOST_KEY,'bad');assert.deepEqual(readGhosts(storage),{best:null,imported:null});
assert.equal(saveGhost(good,'best',{getItem(){throw Error('denied');},setItem(){throw Error('full');}}),false);
console.log('PASS ghost recordings: deterministic real-input replay at 30/60/120/144 Hz, errors preserved, seek/reset, tamper/size/ruleset validation, bounded storage, offline import and best-run retention.');
