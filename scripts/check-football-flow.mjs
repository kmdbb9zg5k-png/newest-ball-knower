import assert from 'node:assert/strict';
import {routePoint,pursuitRead,passSetPoint,contactImpact,pocketSpeedFactor,renderDue} from '../public/play-moment-3d/football-flow.js';
import {PASSES} from '../public/play-moment-3d/playbook.js';

// All shipped routes must remain continuous, bounded by running speed, and
// agree on receiver/prediction position on both sides of a planted break.
let paths=0,maxStep=0,maxTurnStep=0;
for(const play of PASSES)for(const path of play.routes){
 let previous=routePoint(path,0),velocity=null;
 for(let d=.01;d<65;d+=.01){
  const point=routePoint(path,d),v=point.map((n,i)=>n-previous[i]);
  const step=Math.hypot(...v);maxStep=Math.max(maxStep,step);
  assert(point.every(Number.isFinite));assert(step<.01001,'Route speed must not jump across a break');
  if(velocity)maxTurnStep=Math.max(maxTurnStep,Math.hypot(...v.map((n,i)=>n-velocity[i])));
  previous=point;velocity=v;
 }
 paths++;
}
assert(maxTurnStep<.006,'Sharp route corner remains');
const defender={index:11,x:0,z:0,ratings:{awareness:80}},runner={index:6,x:0,z:2};
assert.equal(pursuitRead(defender,runner,{x:0,z:3},0).x,0);
assert.equal(pursuitRead(defender,runner,{x:4,z:3},.05).x,0,'A late cut must beat the committed angle');
assert.equal(pursuitRead(defender,runner,{x:4,z:3},.3).x,4,'Defenders must recover and reread');
assert.equal(pursuitRead(defender,{...runner,index:7},{x:-3,z:3},.31).x,-3,'Possession changes invalidate the read');
const block={startX:4,ratings:{strength:85}},rush={startX:5,ratings:{strength:90}};
const inside=passSetPoint(block,rush,{x:0},35,2),outside=passSetPoint(block,rush,{x:20},35,2);
assert(outside.x>inside.x&&outside.x-inside.x<=1.150001,'Protection follows rollout with bounded movement');
const rear=contactImpact({x:0,z:2,vx:0,vz:8},{x:0,z:1,vx:0,vz:9});
assert(rear.z>.99&&rear.variant==='drag-down');
const side=contactImpact({x:0,z:0,vx:0,vz:0},{x:-1,z:0,vx:8,vz:0});
assert(side.x>.99,'Stationary carrier must react along the hit');
for(let x=0;x<10;x+=.01)assert(Math.abs(pocketSpeedFactor(x+.01)-pocketSpeedFactor(x))<.003,'Pocket exit must not have a speed cliff');
for(const hz of [60,90,120,144]){
 let last=NaN,draws=0;
 for(let i=0;i<hz;i++){const time=i*1000/hz;if(renderDue(time,last)){last=time;draws++}}
 assert(draws<=60&&draws>=45,`Unbounded or sluggish drawing at ${hz}Hz: ${draws}`);
}
console.log(JSON.stringify({status:'PASS',paths,maxStep,maxTurnStep,checks:['routes','committed pursuit','protection leverage','contact momentum','pocket transition','render cadence']}));
