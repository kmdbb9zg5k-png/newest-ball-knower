import assert from 'node:assert/strict';
import {samplePose,advanceMotion,bodyTypes,readyHandTarget} from '../public/play-moment-3d/motion.js';
import {resolveArm,drawAthlete} from '../public/play-moment-3d/athlete.js';
import {point,view} from '../public/play-moment-3d/renderer.js';
const near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const length=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const actor=(role,team=0)=>({x:0,z:0,heading:0,index:2,role,team,number:12,hasBall:role==='QB',throwT:0,catchT:0});
let samples=0;
for(const role of Object.keys(bodyTypes)){
 const p=actor(role);advanceMotion(p,0,'pre');const q=samplePose(p);
 const before=[p.x,p.z,p.heading];
 for(const side of[-1,1]){
  const arm=resolveArm(p,q,side,'pre');near(length(arm.start,arm.joint),.355);near(length(arm.joint,arm.end),Math.hypot(.333,.011));
  if(side===1&&['OL','DL'].includes(role)){near(arm.end[1],.085);near(length(arm.end,readyHandTarget(role,side)),0);}
 }
 assert.deepEqual([p.x,p.z,p.heading],before);
 let previous=resolveArm(p,q,1,'pre').end;
 for(let i=0;i<120;i++){
  p.z+=.06;p.engaged=i<40&&['OL','DL'].includes(role);p.throwT=i>45&&i<60&&role==='QB'?.01:0;p.catchT=i>65&&i<80?.2:0;
  advanceMotion(p,1/60,'run');const pose=samplePose(p);
  for(const side of[-1,1]){const a=resolveArm(p,pose,side,'run');assert.ok(a.start.concat(a.joint,a.end).every(Number.isFinite));near(length(a.start,a.joint),.355);near(length(a.joint,a.end),Math.hypot(.333,.011));samples++}
  const end=resolveArm(p,pose,1,'run').end;if(i<40)assert.ok(length(end,previous)<.15,role+' frame '+i+' hand delta '+length(end,previous));previous=end;
 }
}
// Inspect the actual number-panel draw matrices. UV (0,0) must be at the
// upper-left for both front and rear observers; this catches mirrored digits.
for(const back of[false,true]){
 const p=actor('QB');advanceMotion(p,0,'pre');const panels=[];
 drawAthlete({add(shape,m,color,texture){if(shape==='plane'&&texture?.startsWith('jersey-'))panels.push(m)}},p,0,'pre');
 const panel=panels[back?0:1],camera=view(back?[0,1,-6]:[0,1,6],[0,1,0]);
 const tl=point(camera,point(panel,[-.5,0,-.5])),tr=point(camera,point(panel,[.5,0,-.5])),bl=point(camera,point(panel,[-.5,0,.5]));
 assert.ok(tl[0]<tr[0],`${back?'rear':'front'} number mirrored`);assert.ok(tl[1]>bl[1],`${back?'rear':'front'} number inverted`);
}
console.log(`PASS: ${samples} arm pose samples, 8 ready stances, grounded line hands, fixed arm lengths, finite blends, coordinate isolation and front/rear number orientation.`);
