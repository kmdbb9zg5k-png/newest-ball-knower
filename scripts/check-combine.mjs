import assert from 'node:assert/strict';
import {newDash,pressDash,releaseDash,tapStride,finishEffort,accuracy,positionRanking,stepDash,combineAthlete,FINISH,RESULT_KEY,RULESET,readResults,saveResult,bestResult} from '../combine/dash.js';
const athlete=combineAthlete({id:'wr-test',name:'Test Receiver',position:'WR',speed:94,attributes:{athleticism:90}});
function run(speed=94,dt=1/120,style='perfect',reaction=.08){
 const s=newDash({...athlete,speed,acceleration:speed});pressDash(s,1.5);while(s.phase==='set')stepDash(s,dt);stepDash(s,reaction);releaseDash(s);
 let beat=0,finish=false,spam=0;
 for(let i=0;i<20000&&s.phase==='running';i++){
  const nextTap=.4+beat*s.period+(style==='late'?.09:0),nextSpam=spam*.025;
  let next=style==='perfect'||style==='late'?nextTap:style==='spam'?nextSpam:Infinity;
  if(!finish&&s.finishAt!==null&&style==='perfect')next=Math.min(next,s.finishAt);
  if(next<=s.clock+1e-8){
   if(!finish&&s.finishAt!==null&&Math.abs(next-s.finishAt)<1e-7&&style==='perfect'){finishEffort(s);finish=true;}
   else if(style==='spam'){tapStride(s,spam%2?'right':'left');spam++;}
   else{tapStride(s,beat%2?'right':'left');beat++;}
  }else stepDash(s,Math.min(dt,next-s.clock));
 }
 assert.equal(s.phase,'finished');assert.equal(s.distance,FINISH);assert(s.splits[0]<s.splits[1]&&s.splits[1]<s.splits[2]);return s;
}
const times=[30,60,90,120,144].map(hz=>run(94,1/hz).clock);assert(Math.max(...times)-Math.min(...times)<.005,'Refresh-rate dependent finish');
const clean=run(),idle=run(94,1/120,'none'),late=run(94,1/120,'late'),spam=run(94,1/120,'spam');
assert(clean.clock<late.clock&&late.clock<idle.clock);assert(spam.clock>clean.clock+.8,'Mashing should not beat rhythm');assert(idle.clock>clean.clock+1.5,'No-input run should be meaningfully slower');
assert(run(95).clock<run(70).clock);assert(clean.clock<run(94,1/120,'perfect',.9).clock);assert(accuracy(clean).rhythm>=99);assert(accuracy(clean).finish>=99);assert(accuracy(spam).rhythm<50);assert(run(99).clock>4&&run(99).clock<4.9);
const early=newDash(athlete);pressDash(early);releaseDash(early);stepDash(early,10);assert.equal(early.phase,'false-start');assert.equal(early.distance,0);
const held=newDash(athlete);pressDash(held);stepDash(held,2);stepDash(held,3);pressDash(held);assert.equal(held.phase,'ready');assert.equal(held.distance,0);releaseDash(held);assert.equal(held.phase,'running');
const duplicate=newDash(athlete);duplicate.phase='running';duplicate.clock=.4;tapStride(duplicate,'left');tapStride(duplicate,'left');assert.equal(duplicate.hits,1);assert.equal(duplicate.mistakes,1);assert.equal(duplicate.beat,0);
const badFinish=newDash(athlete);badFinish.phase='running';finishEffort(badFinish);assert.equal(badFinish.finishQuality,null);badFinish.finishAt=1;finishEffort(badFinish);assert.equal(badFinish.finishQuality,0);badFinish.clock=1;finishEffort(badFinish);assert.equal(badFinish.finishQuality,0,'Finish is one chance');
const rank=positionRanking([athlete,{...athlete,id:'slow',speed:50},{...athlete,id:'qb',position:'QB'}],athlete,clean.clock);assert.deepEqual(rank,{rank:1,total:2});
let value='broken';const storage={getItem:()=>value,setItem:(key,v)=>{assert.equal(key,RESULT_KEY);value=v}};assert.deepEqual(readResults(storage),[]);
const a={ruleset:RULESET,context:'solo-a',playerId:'wr',name:'Receiver',position:'WR',date:1,splits:[1.6,2.6,4.6]};assert(saveResult(a,storage));assert(saveResult({...a,context:'standalone',splits:[1.5,2.5,4.5]},storage));assert(saveResult({...a,splits:[1.5,2.5,4.55]},storage));assert(saveResult({...a,ruleset:undefined,splits:[1.4,2.4,4.2]},storage));assert.equal(bestResult(readResults(storage),'solo-a','wr').splits[2],4.55);assert.equal(bestResult(readResults(storage),'solo-b','wr'),null);assert(!saveResult({...a,splits:[3,2,1]},storage));assert(!saveResult(a,{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}}));
const input={id:'prospect-1',name:'Prospect',position:'LT',grade:90};assert.deepEqual(combineAthlete(input),combineAthlete(input));assert(combineAthlete(input).speed<70);
console.log('PASS rhythm vs idle/mashing, timed launch/release, finish window, duplicate rejection, refresh independence, exact distance/splits, ratings, scores, position ranking, legacy separation, storage and franchise isolation.',{perfect:clean.clock,late:late.clock,idle:idle.clock,spam:spam.clock,times});
