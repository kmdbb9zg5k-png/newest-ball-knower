/** Real shipped skeleton: foot anchoring, source arm motion and grounded recovery. */
import fs from 'node:fs';
import {MeshyAthletes,parseGLB,athleteSupportVertices} from '../public/play-moment-3d/meshy-athlete.js';
import {mul} from '../public/play-moment-3d/renderer.js';
const data=fs.readFileSync(new URL('../public/play-moment-3d/assets/ball-knower-gridiron-sentinel-v4.glb',import.meta.url)),{json,accessor}=parseGLB(data.buffer.slice(data.byteOffset,data.byteOffset+data.length)),rig=Object.create(MeshyAthletes.prototype),primitive=json.meshes[0].primitives[0];
Object.assign(rig,{poseStates:new Map(),handTransforms:new Map(),supportPoints:new Map(),phase:'dead',parents:new Int16Array(json.nodes.length).fill(-1),namedNodes:Object.fromEntries(json.nodes.map((n,i)=>[n.name,i])),base:json.nodes.map(n=>({t:[...(n.translation||[0,0,0])],r:[...(n.rotation||[0,0,0,1])],s:[...(n.scale||[1,1,1])]}))});json.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>rig.parents[c]=i));const skin=json.skins[json.nodes.find(n=>Number.isInteger(n.skin)).skin];rig.joints=skin.joints;rig.inverseBind=accessor(skin.inverseBindMatrices);rig.supportVertices=athleteSupportVertices(accessor(primitive.attributes.POSITION),accessor(primitive.attributes.JOINTS_0),accessor(primitive.attributes.WEIGHTS_0));rig.clips=json.animations.map(a=>{let duration=0;const channels=a.channels.map(c=>{const s=a.samplers[c.sampler],times=accessor(s.input);duration=Math.max(duration,times.at(-1));return{node:c.target.node,path:c.target.path,times,values:accessor(s.output),size:c.target.path==='rotation'?4:3}});return{duration,channels}});

import assert from 'node:assert/strict';
import {advanceMotion} from '../public/play-moment-3d/motion.js';
const point=(p,name)=>[...mul(rig.modelFor(p),rig.jointWorld(rig.poseStates.get(p.index).locals,rig.namedNodes['mixamorig:'+name]).m).slice(12,15)];
const report={gaits:[],recovery:[]};
for(const speed of [2,6,9.5]){
 const p={index:8,role:'WR',team:0,x:0,z:0,heading:0,vx:0,vz:speed,distance:0};
 rig.poseStates.clear();rig.supportPoints.clear();rig.footPlants?.clear();rig.actorMap=new Map([[8,p]]);rig.phase='run';
 let drift=0;const arm=[];
 for(let i=0;i<180;i++){
  p.z+=speed/60;p.distance+=speed/60;advanceMotion(p,1/60,'run');rig.bonesFor(p,'run',i/60);
  const entry=rig.footPlants.get(8);
  for(const side of ['Left','Right']){const anchor=entry?.feet[side];if(!anchor)continue;const phase=((p.motion.stridePhase+(side==='Right'?.5:0))%1+1)%1;if(phase<.08||phase>.20)continue;const foot=point(p,side+'Foot');drift=Math.max(drift,Math.hypot(foot[0]-anchor.world[0],foot[2]-anchor.world[2]));}
  const hand=point(p,'LeftHand');arm.push(hand[2]-p.z);
  assert.ok(point(p,'Head').every(Number.isFinite));
 }
 report.gaits.push({speed,plantDrift:drift,armSwing:Math.max(...arm)-Math.min(...arm)});
 assert.ok(drift<.22,'Planted foot cannot follow the moving root: '+JSON.stringify(report.gaits.at(-1)));
 assert.ok(Math.max(...arm)-Math.min(...arm)>.24,'Imported reciprocal arm drive must survive');
}
for(const contactVariant of ['wrap','shoulder-hit','low-wrap','drag-down'])for(const ball of [false,true])for(const heading of ball?[0]:Array.from({length:8},(_,i)=>i*Math.PI/4))for(const side of [-1,1]){
 const p={contactVariant,index:8,role:'WR',team:0,x:0,z:0,heading,vx:0,vz:0,fallen:true,hasBall:ball,action:'wrap',actionT:1,actionSide:side,fallHeading:0,recoverySide:ball?-1:side};
 rig.poseStates.clear();rig.supportPoints.clear();rig.actorMap=new Map([[8,p]]);rig.phase='dead';rig.bonesFor(p,'dead',0);
 const landed=point(p,'Head')[1];assert.ok(landed<.5,'Completed contact must finish on the turf');
 assert.ok(point(p,'Head')[2]-point(p,'Hips')[2]>.35,'Contact must fold along the impact even when the tackler faces the runner');
 let jump=0,last=landed;
 for(let i=0;i<=72;i++){p.action='get-up';p.actionT=i/72;rig.bonesFor(p,'dead',(i+1)/60);const head=point(p,'Head')[1];jump=Math.max(jump,Math.abs(head-last));last=head;}
 assert.ok(jump<.08,`Recovery has a root pop at heading ${heading}, side ${side}: ${jump}`);report.recovery.push({carrier:ball,heading,side,landedHead:landed,maxHeadStep:jump});
}
console.log(JSON.stringify({status:'PASS',...report},null,2));
