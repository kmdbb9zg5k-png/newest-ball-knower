import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MeshyAthletes,parseGLB,athleteSupportVertices,skinSupportVertices,ATHLETE_SHADERS} from '../public/play-moment-3d/meshy-athlete.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const raw=fs.readFileSync(path.join(root,'public/play-moment-3d/assets/ball-knower-gridiron-sentinel-v4.glb'));
const parsed=parseGLB(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),{json,accessor}=parsed,primitive=json.meshes[0].primitives[0];
// Exercise the shipped pose methods and real asset without requiring WebGL.
function makeRig(Type=MeshyAthletes){
const rig=Object.create(Type.prototype);
rig.parents=new Int16Array(json.nodes.length).fill(-1);json.nodes.forEach((node,i)=>(node.children||[]).forEach(c=>rig.parents[c]=i));
rig.namedNodes=Object.fromEntries(json.nodes.map((n,i)=>[n.name,i]));
rig.base=json.nodes.map(n=>({t:n.translation||[0,0,0],r:n.rotation||[0,0,0,1],s:n.scale||[1,1,1]}));
rig.joints=json.skins[0].joints;rig.inverseBind=accessor(json.skins[0].inverseBindMatrices);
rig.poseStates=new Map();rig.handTransforms=new Map();rig.supportPoints=new Map();
const positions=accessor(primitive.attributes.POSITION),joints=accessor(primitive.attributes.JOINTS_0),weights=accessor(primitive.attributes.WEIGHTS_0);
rig.supportVertices=athleteSupportVertices(positions,joints,weights);

rig.clips=json.animations.map(a=>{let duration=0;const channels=a.channels.map(c=>{const s=a.samplers[c.sampler],times=accessor(s.input);duration=Math.max(duration,times.at(-1));return{node:c.target.node,path:c.target.path,times,values:accessor(s.output),size:c.target.path==='rotation'?4:3}});return{name:a.name,duration,channels}});
return rig;
}

import {advanceMotion} from '../public/play-moment-3d/motion.js';
import {interpolatePresentation} from '../public/play-moment-3d/game.js';
import {pathToFileURL} from 'node:url';
const rig=makeRig();
// The source has nonzero sampler starts. A loop must move immediately and
// meet itself at the seam, rather than freezing for its first two frames.
for(const clip of[0,1,6]){
 const a=rig.cycleLocals(clip,0),b=rig.cycleLocals(clip,.015),end=rig.cycleLocals(clip,1-1e-6);
 const foot=rig.namedNodes['mixamorig:LeftFoot'];
 const position=pose=>Array.from(rig.jointWorld(pose,foot).m.slice(12,15));
 const pa=position(a),pb=position(b),pe=position(end),delta=(x,y)=>Math.hypot(...x.map((v,i)=>v-y[i]));
 assert.ok(delta(pa,pb)>.001,`Clip ${clip} holds at its start`);
 assert.ok(delta(pa,pe)<.0001,`Clip ${clip} pops across its loop seam`);
}
// A 120Hz display must receive a halfway pose between 60Hz simulation ticks.
const previous={x:0,z:0,vx:0,vz:8,distance:0,heading:Math.PI-.1,action:null,actionT:0,motion:{speed:8,run:1,turn:0,gait:1,stridePhase:1,fall:0,block:0}},current={...previous,x:.2,z:.1,distance:.22,heading:-Math.PI+.1,motion:{...previous.motion,gait:1.2,stridePhase:1.1}};
const mid=interpolatePresentation(previous,current,.5);
assert.equal(mid.x,.1);assert.equal(mid.motion.stridePhase,1.05);assert.ok(Math.abs(mid.heading-Math.PI)<1e-9);assert.equal(current.x,.2);assert.equal(current.motion.stridePhase,1.1);
// The old 14.5-degree switch swapped the entire lower-body animation in one
// frame. Sweep that boundary and walk/run/sprint acceleration on the real rig.
let maxJointStep=0,maxAir=0,maxFootForward=0,minFloor=Infinity;
for(const role of['RB','LB']){
 const actor={role,index:role==='RB'?6:17,team:role==='RB'?0:1,hasBall:role==='RB',x:0,z:0,heading:0,vx:0,vz:0,distance:0};rig.phase='run';rig.poseStates.clear();let previousFoot;
 for(let frame=0;frame<240;frame++){
  const speed=frame<60?frame/60*8.8:8.8,angle=.24+.08*Math.sin(frame/30);actor.vx=Math.sin(angle)*speed;actor.vz=Math.cos(angle)*speed;actor.x+=actor.vx/60;actor.z+=actor.vz/60;actor.distance+=speed/60;advanceMotion(actor,1/60,'run');
  const bones=rig.bonesFor(actor,'run',frame/60),model=rig.modelFor(actor),locals=rig.poseStates.get(actor.index).locals;
  const feet=['Left','Right'].map(side=>Array.from(rig.jointWorld(locals,rig.namedNodes['mixamorig:'+side+'Foot']).m.slice(12,15)));
  if(previousFoot)feet.forEach((foot,i)=>{maxJointStep=Math.max(maxJointStep,Math.hypot(...foot.map((v,j)=>v-previousFoot[i][j])))});previousFoot=feet;
  feet.forEach(foot=>maxFootForward=Math.max(maxFootForward,foot[2]));
  let floor=Infinity;for(const v of rig.supportPoints.get(actor.index))floor=Math.min(floor,model[1]*v[0]+model[5]*v[1]+model[9]*v[2]+model[13]);maxAir=Math.max(maxAir,floor);minFloor=Math.min(minFloor,floor);
  assert.ok([...bones,...model].every(Number.isFinite));
 }
}
assert.ok(maxJointStep<.20,`Ankle discontinuity ${maxJointStep}m/frame`);
assert.ok(maxFootForward<.58,`High kick extends foot ${maxFootForward}m ahead`);
assert.ok(maxAir>.045&&maxAir<.24,'Running needs a brief, bounded flight phase');assert.ok(minFloor<.03&&minFloor>-.04,'Feet must land without penetrating turf');
console.log(JSON.stringify({checks:'loop seams, immediate motion, interpolation, acceleration and turning',maxJointStep,maxAir,maxFootForward,minFloor},null,2));
const outFlag=process.argv.indexOf('--render-dir');
if(outFlag>=0){
 const out=path.resolve(process.argv[outFlag+1]);fs.mkdirSync(out,{recursive:true});const attrs={};
 for(const[name,idx]of Object.entries(primitive.attributes)){const a=accessor(idx);fs.writeFileSync(path.join(out,name+'.bin'),Buffer.from(a.buffer,a.byteOffset,a.byteLength));attrs[name]={type:json.accessors[idx].componentType,count:json.accessors[idx].count}}
 const ix=accessor(primitive.indices);fs.writeFileSync(path.join(out,'indices.bin'),Buffer.from(ix.buffer,ix.byteOffset,ix.byteLength));
 const mat=json.materials[primitive.material];[mat.pbrMetallicRoughness.baseColorTexture.index,mat.normalTexture.index,mat.pbrMetallicRoughness.metallicRoughnessTexture.index].forEach((idx,i)=>{const im=json.images[json.textures[idx].source],v=json.bufferViews[im.bufferView];fs.writeFileSync(path.join(out,'tex'+i+'.jpg'),Buffer.from(parsed.bin,v.byteOffset||0,v.byteLength))});
 const compare=process.argv.indexOf('--compare'),Before=compare>=0?(await import(pathToFileURL(path.resolve(process.argv[compare+1])))).MeshyAthletes:MeshyAthletes;
 const rigs=[makeRig(Before),makeRig()],actors=rigs.map((_,i)=>({role:'LB',index:17,team:1,number:54,x:0,z:0,heading:0,vx:0,vz:8.8,distance:0})),frames=[];
 for(let frame=0;frame<180;frame++){
  const group=rigs.map((r,i)=>{const p=actors[i];p.x=0;p.z=frame*8.8/60;p.distance=frame*8.8/60;advanceMotion(p,1/60,'run');p.x=i?1.05:-1.05;p.z=0;r.phase='run';const bones=r.bonesFor(p,'run',frame/60),model=r.modelFor(p);return{p:{...p},bones:[...bones],model:[...model]}});
  if(frame%2===0)frames.push({label:'Real player model and shaders · 8.8 yards/sec',labels:compare>=0?['Before','After']:['Current','Current'],group,eye:[0,1.8,5.6],target:[0,1,0]});
 }
 fs.writeFileSync(path.join(out,'scene.json'),JSON.stringify({...ATHLETE_SHADERS,attrs,indexType:json.accessors[primitive.indices].componentType,indexCount:ix.length,poses:frames,animation:true}));
 console.log('Continuous comparison:',out);
}

// Running catch transitions retain the live hips/legs while the upper body
// reaches and tucks. Compare blended legs to the unblended real asset pose.
let catchLegError=0,catchTransitionFrames=0;
for(const style of ['rac','secure','aggressive']){
 const p={index:8,role:'WR',team:0,x:0,z:30,heading:0,vx:0,vz:7,distance:0,hasBall:false};
 rig.poseStates.clear();rig.footPlants?.clear();rig.phase='run';
 for(let frame=0;frame<65;frame++){
  p.z+=7/60;p.distance+=7/60;
  p.hasBall=frame>=15;p.catchStyle=style;p.catchT=frame>=15?Math.max(0,.45-(frame-15)/60):0;
  advanceMotion(p,1/60,'run');
  // Foot planting runs after blending; inspect the transition's output before IK.
  const blend=rig.blendLocals;rig.blendLocals=function(actor,locals,time,state){
   const out=blend.call(this,actor,locals,time,state),previous=this.poseStates.get(actor.index);
   if(previous.transitioning&&frame>=15){
    catchTransitionFrames++;
    for(const name of ['Hips','LeftUpLeg','LeftLeg','RightUpLeg','RightLeg']){
     const i=this.namedNodes['mixamorig:'+name];
     catchLegError=Math.max(catchLegError,...out[i].r.map((v,j)=>Math.abs(v-locals[i].r[j])));
    }
   }
   return out;
  };
  try{const bones=rig.bonesFor(p,'run',frame/60);assert.ok([...bones].every(Number.isFinite))}finally{rig.blendLocals=blend}
 }
}
assert.ok(catchTransitionFrames>20,'Catch entry and exit transitions must be exercised');
assert.ok(catchLegError<1e-8,`Running catches freeze the leg cycle: ${catchLegError}`);
console.log(JSON.stringify({runningCatchStyles:3,catchLegError}));

// Optional reproducible CPU profile: identical real-asset poses, with bind
// transforms recomputed versus reused. No graphics/detail settings change.
if(process.env.BK_PROFILE==='1'){
 const jointWorld=rig.jointWorld,measure=cached=>{
  rig.jointWorld=function(locals,index){if(!cached&&locals===this.base)this.bindWorld?.clear();return jointWorld.call(this,locals,index)};
  rig.poseStates.clear();rig.footPlants?.clear();
  const p={index:8,role:'WR',team:0,x:0,z:30,heading:0,vx:0,vz:7,distance:0,hasBall:true};
  const begin=performance.now();
  for(let i=0;i<240;i++){p.z+=7/60;p.distance+=7/60;advanceMotion(p,1/60,'run');rig.bonesFor(p,'run',i/60)}
  return performance.now()-begin;
 };
 measure(true);measure(false);const uncachedMs=measure(false),cachedMs=measure(true);rig.jointWorld=jointWorld;
 console.log(JSON.stringify({profile:'240 real-rig poses',uncachedMs,cachedMs,reductionPercent:100*(1-cachedMs/uncachedMs)}));
}
