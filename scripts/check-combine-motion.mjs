import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {createSprintMotion,SPRINT_CYCLE_DISTANCE} from '../combine/sprint-motion.js';
const data=readFileSync(new URL('../public/play-moment-3d/assets/combine-training-athlete-v1.glb',import.meta.url));
const doc=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)).toString());
const nodes=doc.nodes.map(n=>{const o=new T.Bone();o.name=n.name;if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);return o;});
for(let i=0;i<nodes.length;i++)for(const c of doc.nodes[i].children||[])nodes[i].add(nodes[c]);
const root=new T.Group();for(const n of nodes)if(!n.parent)root.add(n);
const bones=Object.fromEntries(nodes.filter(n=>n.name.startsWith('mixamorig:')).map(n=>[n.name.slice(10),n]));
const bind=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,{p:b.position.clone(),q:b.quaternion.clone()}]));
const pos=n=>bones[n].getWorldPosition(new T.Vector3());
root.updateMatrixWorld(true);const floor=pos('LeftFoot').y;
const motion=createSprintMotion(root,bones,bind);
const captured=JSON.parse(readFileSync(new URL('../combine/captured-sprint.json',import.meta.url)));
// Detect retarget-order errors and axial flips, including the loop boundary.
for(let i=0;i<96;i++)for(let j=0;j<captured.names.length;j++){
 const a=new T.Quaternion().fromArray(captured.frames[i][j],3).normalize();
 const b=new T.Quaternion().fromArray(captured.frames[(i+1)%96][j],3).normalize();
 assert(a.angleTo(b)<Math.PI/9,`${captured.names[j]} abrupt frame ${i}`);
}
let maxSlip=0,maxRoll=0,minFoot=10,minElbow=180,maxElbow=0;
for(let i=0;i<512;i++){
 const phase=i/512;motion.sample(phase);root.updateMatrixWorld(true);
 const torso=pos('Neck').sub(pos('Hips'));maxRoll=Math.max(maxRoll,Math.abs(Math.atan2(torso.x,torso.y))*180/Math.PI);
 for(const side of ['Left','Right']){
  const foot=pos(side+'Foot');minFoot=Math.min(minFoot,foot.y);
  const e=pos(side+'ForeArm'),angle=pos(side+'Arm').sub(e).angleTo(pos(side+'Hand').sub(e))*180/Math.PI;minElbow=Math.min(minElbow,angle);maxElbow=Math.max(maxElbow,angle);
 }
 for(const c of captured.contacts)if(phase>c.start+.035&&phase<c.end-.035){const foot=pos(c.side+'Foot');maxSlip=Math.max(maxSlip,Math.abs(foot.z+SPRINT_CYCLE_DISTANCE*(phase-c.center)-c.z),Math.abs(foot.y-floor));}
}
console.log({maxSlip,maxRoll,minFoot,minElbow,maxElbow});
assert(maxSlip<.03,'Captured support foot slides');assert(minFoot>floor-.025,'Captured ankle penetrates track');assert(maxRoll<12,'Excessive torso roll');assert(minElbow>30&&maxElbow<150,'Invalid elbow retarget');
for(const walk of [0,.5,1]){
 for(let i=0;i<128;i++){motion.sample(i/128,1,walk);root.updateMatrixWorld(true);for(const side of ['Left','Right'])assert(pos(side+'Foot').y>floor-.025,'Transition ankle below track');}
 motion.sample(0,1,walk);const seam=Object.fromEntries(Object.entries(bones).map(([n,b])=>[n,b.quaternion.clone()]));motion.sample(1-1e-6,1,walk);
 for(const [n,b] of Object.entries(bones))assert(b.quaternion.angleTo(seam[n])<.001,`${n} cycle seam`);
}
motion.sample(.63,0);root.updateMatrixWorld(true);
for(const [n,b] of Object.entries(bones)){assert(b.position.distanceTo(motion.rest[n].p)<1e-7);assert(b.quaternion.clone().normalize().angleTo(motion.rest[n].q.clone().normalize())<1e-6,`${n} stays in run pose at rest`);}
console.log('PASS captured sprint contact, ground clearance, joint limits, gait blends, loop seam and full-body rest');
