import assert from 'node:assert/strict';
import {pursuitTarget,pursuitSteering,locomotionStep,tackleContactEligible,defenderRunSpeed,playerRatings,initialAssistMode} from '../public/play-moment-3d/game.js';
import {MeshyAthletes,MESHY_CLIPS} from '../public/play-moment-3d/meshy-athlete.js';
// Compare actual accelerated pursuit against the previous short lead for a crossing run.
function chase(targetFn){
 const d={index:21,team:1,x:14,z:35,vx:0,vz:0},r={x:-8,z:20,vx:3,vz:6};let closest=Infinity;
 for(let i=0;i<300;i++){const t=targetFn(d,r),dx=t.x-d.x,dz=t.z-d.z,n=Math.hypot(dx,dz)||1,v=locomotionStep(d.vx,d.vz,dx/n,dz/n,8.2,1/60,17,22);d.vx=v.vx;d.vz=v.vz;d.x+=v.vx/60;d.z+=v.vz/60;r.x+=r.vx/60;r.z+=r.vz/60;closest=Math.min(closest,Math.hypot(d.x-r.x,d.z-r.z));if(tackleContactEligible(d,r,.86))return{caught:true,closest};}
 return{caught:false,closest};
}
const interception=chase((d,r)=>pursuitTarget(d,r,false,8.2));
assert.ok(interception.caught,'A safety with a reachable crossing angle should meet the runner');
assert.equal(initialAssistMode(''),false,'Default launch must remain manual');
assert.equal(initialAssistMode('?assist=1'),true,'Preview query must enable assisted running');
assert.equal(initialAssistMode('?assist=0'),false,'Manual mode must remain explicit for other values');
for(const x of[-25,0,25])for(const vx of[-9,0,9])for(const vz of[-8,0,8]){
 const p=pursuitTarget({index:18,x:4,z:32},{x,z:25,vx,vz},false,8);
 assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));assert.ok(Math.abs(p.x)<=25.8);assert.ok(Math.abs(p.z-25)<=Math.abs(vz)*4+.001);
}
const d={index:15,team:1,x:0,z:0},mate={index:16,team:1,x:.5,z:0},runner={x:0,z:10,vx:0,vz:7};
const alone=pursuitSteering(d,runner,[d],8),crowded=pursuitSteering(d,runner,[d,mate],8);
assert.ok(crowded.x<alone.x,'Defender must steer away from a nearby teammate');
assert.ok(Math.abs(Math.hypot(crowded.x,crowded.z)-1)<1e-9,'Separation must not increase speed');
// Exercise choose(), including the actual distance-clock integration.
const rig=Object.create(MeshyAthletes.prototype);rig.clips=Array.from({length:8},()=>({duration:1}));
const p={index:6,team:0,role:'RB',vx:0,vz:7,hasBall:true,distance:2};
assert.equal(rig.choose(p,'run',1).baseTime,rig.choose(p,'run',20).baseTime,'Unchanged position must not advance a running clip');
assert.notEqual(rig.choose(p,'run',1).baseTime,rig.choose({...p,distance:2.5},'run',1).baseTime,'Ground covered must advance the stride');
assert.equal(rig.choose({...p,sprinting:true},'run',1).base,MESHY_CLIPS.sprint);
console.log('Pursuit checks passed: crossing interception, 27 direction/boundary cases, teammate spacing, distance-driven run/sprint playback.');

// A support defender must close the tackle window instead of shadowing a parallel lane.
const support={index:19,team:1,x:1.2,z:29},ballCarrier={x:0,z:30,vx:0,vz:7.7};
const closeAim=pursuitTarget(support,ballCarrier,false,8.8,'support');
assert.ok(Math.abs(closeAim.x-ballCarrier.x)<.01,'Support must collapse to the ball inside 2.5 yards');
const rated={role:'DB',ratings:playerRatings('DB',21,1)};
assert.ok(defenderRunSpeed(rated)>8.6,'A fast defensive back can finish a reachable pursuit angle');
assert.equal(defenderRunSpeed({...rated,x:0,z:0}),defenderRunSpeed({...rated,x:1,z:1}),'Closing distance cannot throttle a defender');
console.log('Closing pursuit checks passed: collapsed support lane and rating-based running speed.');

// Trailing support maintains both shoulders instead of assigning a defender
// across his teammate's path; contain works for lateral as well as upfield runs.
for(const direction of [1,-1]){
 const r={x:0,z:40,vx:direction*8,vz:0},near={index:15,team:1,x:direction*2,z:40},safety={index:21,team:1,x:direction*14,z:47};
 const aim=pursuitTarget(safety,r,false,8.8,'contain');
 assert.ok(aim.x*direction>0,'Contain must lead a lateral runner');
}
for(const x of[-8,8]){
 const d={index:16,team:1,x,z:25},r={x:0,z:40,vx:0,vz:8};
 const aim=pursuitTarget(d,r,false,8.8,'support');assert.equal(Math.sign(aim.x),Math.sign(x));assert.ok(Math.abs(aim.x)>=1.5);
}
console.log('Containment checks passed: lateral cutoffs and separate trailing shoulders.');
