import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createSprintMotion,SPRINT_CYCLE_DISTANCE,SPRINT_CONTACT} from '../combine/sprint-motion.js';
const data=readFileSync(new URL('../public/play-moment-3d/assets/combine-training-athlete-v1.glb',import.meta.url));
const doc=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
const nodes=doc.nodes.map(n=>{const o=new T.Bone();o.name=n.name;if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);return o;});
for(let i=0;i<nodes.length;i++)for(const c of doc.nodes[i].children||[])nodes[i].add(nodes[c]);
const root=new T.Group();for(const n of nodes)if(!n.parent)root.add(n);
const bones=Object.fromEntries(nodes.filter(n=>n.name.startsWith('mixamorig:')).map(n=>[n.name.slice(10),n]));
const bind=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone()}]));
const pos=n=>bones[n].getWorldPosition(new T.Vector3());
root.updateMatrixWorld(true);const floor=pos('LeftFoot').y;
const motion=createSprintMotion(root,bones,bind);let maxSlip=0,maxRoll=0,minElbow=180,maxElbow=0,minFoot=10,minShoulderYaw=180,maxShoulderYaw=-180,maxKnee=0;
for(let i=0;i<=512;i++){
 const phase=i/512;motion.sample(phase);root.updateMatrixWorld(true);
 const shoulders=pos('LeftArm').sub(pos('RightArm')),yaw=Math.atan2(shoulders.z,shoulders.x)*180/Math.PI;minShoulderYaw=Math.min(minShoulderYaw,yaw);maxShoulderYaw=Math.max(maxShoulderYaw,yaw);
 const torso=pos('Neck').sub(pos('Hips'));maxRoll=Math.max(maxRoll,Math.abs(Math.atan2(torso.x,torso.y))*180/Math.PI);
 for(const [side,offset]of[['Left',0],['Right',.5]]){
  const p=(phase+offset)%1,foot=pos(side+'Foot');minFoot=Math.min(minFoot,foot.y);
  if(p<SPRINT_CONTACT-.01)maxSlip=Math.max(maxSlip,Math.abs(foot.z+SPRINT_CYCLE_DISTANCE*p-.28),Math.abs(foot.y-floor));
  const k=pos(side+'Leg');maxKnee=Math.max(maxKnee,pos(side+'UpLeg').sub(k).angleTo(pos(side+'Foot').sub(k))*180/Math.PI);
  const e=pos(side+'ForeArm'),upper=pos(side+'Arm').sub(e),lower=pos(side+'Hand').sub(e),angle=upper.angleTo(lower)*180/Math.PI;
  minElbow=Math.min(minElbow,angle);maxElbow=Math.max(maxElbow,angle);
  assert(Number.isFinite(foot.x+foot.y+foot.z));
 }
}
assert(maxSlip<.025,`Foot contact drift ${maxSlip}`);assert(maxRoll<6,`Sideways lean ${maxRoll}`);
assert(maxShoulderYaw-minShoulderYaw>4,'Shoulder rotation is locked');assert(maxElbow-minElbow>20,'Elbow swing is locked');
assert(minElbow>65&&maxElbow<115,`Elbows ${minElbow}–${maxElbow}`);assert(minFoot>floor-.02,'Ankle below the track');
motion.sample(.63,0);root.updateMatrixWorld(true);
for(const [n,b]of Object.entries(bones)){assert(b.position.distanceTo(motion.rest[n].p)<1e-7);assert(b.quaternion.clone().normalize().angleTo(motion.rest[n].q.clone().normalize())<1e-6,`${n} stays in run pose at rest`);}
const neck=pos('Neck').sub(pos('Hips'));assert(Math.abs(neck.z)<.05&&Math.abs(neck.x)<.03,'Rest torso not upright');
console.log('PASS rig-space sprint contacts, torso stability, bent elbows, and full-body rest', {maxSlip,maxRoll,minElbow,maxElbow,minFoot,shoulderYawRange:maxShoulderYaw-minShoulderYaw,maxKnee});

// All locomotion banks must loop continuously and keep the ankle above turf.
for(const [drive,walk] of [[1,0],[0,1],[.5,.5]]){
 for(let i=0;i<128;i++){
  motion.sample(i/128,1,drive,walk);root.updateMatrixWorld(true);
  for(const side of ['Left','Right'])assert(pos(side+'Foot').y>floor-.025,'Transition ankle below track');
 }
 motion.sample(0,1,drive,walk);const seam=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,b.quaternion.clone()]));
 motion.sample(1-1e-6,1,drive,walk);
 for(const [n,b] of Object.entries(bones))assert(b.quaternion.angleTo(seam[n])<.001,`${n} cycle seam`);
}
console.log('PASS drive, walk and blended transition clearance and loop continuity');
