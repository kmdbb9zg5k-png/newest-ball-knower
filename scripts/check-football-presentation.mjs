import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MeshyAthletes,parseGLB,athleteSupportVertices,skinSupportVertices,meshyAnimationState,ATHLETE_SHADERS} from '../public/play-moment-3d/meshy-athlete.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const raw=fs.readFileSync(path.join(root,'public/play-moment-3d/assets/ball-knower-gridiron-pro-v3.glb'));
const parsed=parseGLB(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)),{json,accessor}=parsed,primitive=json.meshes[0].primitives[0];
// Exercise the shipped pose methods and real asset without requiring WebGL.
const rig=Object.create(MeshyAthletes.prototype);
rig.parents=new Int16Array(json.nodes.length).fill(-1);json.nodes.forEach((node,i)=>(node.children||[]).forEach(c=>rig.parents[c]=i));
rig.namedNodes=Object.fromEntries(json.nodes.map((n,i)=>[n.name,i]));
rig.base=json.nodes.map(n=>({t:n.translation||[0,0,0],r:n.rotation||[0,0,0,1],s:n.scale||[1,1,1]}));
rig.joints=json.skins[0].joints;rig.inverseBind=accessor(json.skins[0].inverseBindMatrices);
rig.poseStates=new Map();rig.handTransforms=new Map();rig.supportPoints=new Map();
const positions=accessor(primitive.attributes.POSITION),joints=accessor(primitive.attributes.JOINTS_0),weights=accessor(primitive.attributes.WEIGHTS_0);
rig.supportVertices=athleteSupportVertices(positions,joints,weights);
const allVertices=Array.from({length:positions.length/3},(_,i)=>({p:[...positions.subarray(i*3,i*3+3)],j:[...joints.subarray(i*4,i*4+4)],w:[...weights.subarray(i*4,i*4+4)]}));
rig.clips=json.animations.map(a=>{let duration=0;const channels=a.channels.map(c=>{const s=a.samplers[c.sampler],times=accessor(s.input);duration=Math.max(duration,times.at(-1));return{node:c.target.node,path:c.target.path,times,values:accessor(s.output),size:c.target.path==='rotation'?4:3}});return{name:a.name,duration,channels}});
function sample(role,phase,team,action=null,actionT=0,index=0,extra={}){
 const p={role,phase,team,index,number:24,x:0,z:0,heading:0,vx:0,vz:phase==='run'?7:0,hasBall:role==='RB',action,actionT,fallen:Boolean(action),actionSide:1,...extra};
 rig.phase=phase;rig.poseStates.clear();const bones=rig.bonesFor(p,phase,1),model=rig.modelFor(p);
 assert.ok([...bones,...model].every(Number.isFinite),'Non-finite pose matrix');
 return{label:`${role} ${phase} ${action||''} ${actionT}`,p,bones:[...bones],model:[...model]};
}
let checks=0,worstFloor=1;
for(const team of[0,1])for(const role of['QB','RB','WR','TE','OL','DL','LB','DB'])for(const [phase,action,t]of[['pre',null,0],['dead',null,0],['dead','wrap',.5],['dead','wrap',1]]){
 const pose=sample(role,phase,team,action,t,checks),points=skinSupportVertices(allVertices,pose.bones),m=pose.model;
 let floor=Infinity;for(const v of points)floor=Math.min(floor,m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+m[13]);
 worstFloor=Math.min(worstFloor,floor);assert.ok(floor>=-.035&&floor<=.025,`${pose.label}: body misses turf at ${floor}`);
 if(phase==='pre'){
  const h=rig.handTransforms.get(checks);assert.ok(h.left[13]<h.chest[13]-.05&&h.right[13]<h.chest[13]-.05,`${role}: hands still held at shoulder height`);
 }
 checks++;
}
// Sample engaged linemen over a complete step cycle, with real skinning.
for(const team of[0,1])for(let i=0;i<12;i++){
 const p={role:team?'DL':'OL',team,index:100+team,x:0,z:0,heading:0,vx:0,vz:.3,distance:i*.04,engaged:true,blockStyle:team?'shed':'drive'};
 rig.phase='run';rig.poseStates.clear();const bones=rig.bonesFor(p,'run',i/12),model=rig.modelFor(p),hands=rig.handTransforms.get(p.index);
 assert.ok([...bones,...model].every(Number.isFinite),'Block pose must remain finite');
 for(const hand of[hands.left,hands.right])assert.ok(hand[14]>hands.chest[14]+.15,'Block hands should reach forward');
 const points=skinSupportVertices(allVertices,bones);let floor=Infinity;for(const v of points)floor=Math.min(floor,model[1]*v[0]+model[5]*v[1]+model[9]*v[2]+model[13]);
 assert.ok(floor>=-.04,'Blocking steps must not penetrate the turf');checks++;
}
// Sweep complete run/sprint and get-up sequences, not just representative stills.
for(const role of['QB','RB','WR','TE','OL','DL','LB','DB'])for(const speed of[5.5,8.4]){
 const actor={role,index:220,team:role==='LB'||role==='DB'||role==='DL'?1:0,x:0,z:0,heading:0,vx:0,vz:speed,hasBall:role==='RB',sprinting:speed>8};
 rig.poseStates.clear();rig.phase='run';
 for(let i=0;i<28;i++){
  actor.distance=i*.1;const bones=rig.bonesFor(actor,'run',i*.1/speed),model=rig.modelFor(actor),chest=rig.handTransforms.get(actor.index).chest;
  assert.ok(chest[5]/Math.hypot(chest[4],chest[5],chest[6])>.85,`${role}: horizontal running torso`);
  assert.ok([...bones,...model].every(Number.isFinite),'Stride matrix must be finite');
  const points=skinSupportVertices(allVertices,bones);let floor=Infinity;for(const v of points)floor=Math.min(floor,model[1]*v[0]+model[5]*v[1]+model[9]*v[2]+model[13]);
  assert.ok(floor>=-.04&&floor<.03,`${role}: stride foot misses turf ${floor}`);checks++;
 }
}
for(const t of[0,.2,.4,.6,.8,1]){
 const pose=sample('LB','run',1,'get-up',t,221,{fallen:true,vz:0});assert.ok(pose.model[5]>.8||t<.8,'Get-up should finish upright');checks++;
}
// All formerly sticky pass-rush styles must release into grounded locomotion.
for(const style of['rush-rip','rush-swim','bull-rush']){
 const actor={role:'DL',team:1,index:222,x:5,z:0,heading:0,vx:0,vz:5.5,distance:0,engaged:true,blockStyle:style};rig.phase='pass';rig.poseStates.clear();
 for(let i=0;i<30;i++){
  if(i===10)actor.engaged=false;actor.distance+=5.5/60;
  const bones=rig.bonesFor(actor,'pass',i/60),model=rig.modelFor(actor),chest=rig.handTransforms.get(actor.index).chest;
  assert.ok([...bones,...model].every(Number.isFinite),`${style}: invalid transition`);
  if(!actor.engaged){assert.equal(meshyAnimationState(actor,'pass'),'edge-rush');if(i>16)assert.ok(chest[5]/Math.hypot(chest[4],chest[5],chest[6])>.85,`${style}: released rusher still diving`)}checks++;
 }
}
// A completed tackle rests the torso near the ground, rather than on hands/knees.
for(const role of['RB','QB','LB','DL']){
 const pose=sample(role,'dead',role==='LB'||role==='DL'?1:0,'wrap',1,223),chest=rig.handTransforms.get(223).chest,m=pose.model;
 const height=m[1]*chest[12]+m[5]*chest[13]+m[9]*chest[14]+m[13];
 assert.ok(height<.55,`${role}: tackle torso still propped up at ${height}`);checks++;
}
for(const heading of[0,Math.PI/2,Math.PI]){
 const pose=sample('DL','dead',1,'wrap',1,224,{heading,fallHeading:0});
 assert.ok(pose.model[6]/Math.hypot(pose.model[4],pose.model[5],pose.model[6])>.85,'Defender must fall with impact regardless of facing');checks++;
}
console.log(`Presentation checks passed: ${checks} real-asset poses; ${rig.supportVertices.length} support vertices; lowest body point ${worstFloor.toFixed(4)}m.`);
const flag=process.argv.indexOf('--render-dir');
if(flag>=0){
 const out=path.resolve(process.argv[flag+1]);fs.mkdirSync(out,{recursive:true});const attrs={};
 for(const [name,idx]of Object.entries(primitive.attributes)){const a=accessor(idx);fs.writeFileSync(path.join(out,name+'.bin'),Buffer.from(a.buffer,a.byteOffset,a.byteLength));attrs[name]={type:json.accessors[idx].componentType,count:json.accessors[idx].count}}
 const ix=accessor(primitive.indices);fs.writeFileSync(path.join(out,'indices.bin'),Buffer.from(ix.buffer,ix.byteOffset,ix.byteLength));
 const mat=json.materials[primitive.material];[mat.pbrMetallicRoughness.baseColorTexture.index,mat.normalTexture.index,mat.pbrMetallicRoughness.metallicRoughnessTexture.index].forEach((idx,i)=>{const im=json.images[json.textures[idx].source],v=json.bufferViews[im.bufferView];fs.writeFileSync(path.join(out,'tex'+i+'.jpg'),Buffer.from(parsed.bin,v.byteOffset||0,v.byteLength))});
 let poses=[sample('OL','run',0,null,0,0,{engaged:true,blockStyle:'drive',distance:2}),sample('DL','run',1,null,0,1,{engaged:true,blockStyle:'shed',distance:2}),sample('RB','run',0,null,0,6,{distance:2}),sample('RB','run',0,null,0,6,{distance:3,sprinting:true}),sample('RB','run',0,'cut',.4,6,{fallen:false,distance:2.5}),sample('LB','dead',1,'wrap',1),sample('RB','dead',0,'wrap',1),sample('RB','dead',0,'wrap',.5)];
 if(process.argv.includes('--recovery'))poses=[sample('LB','run',1,null,0,17,{distance:.3,vz:8.4}),sample('LB','run',1,null,0,17,{distance:1,vz:8.4}),sample('LB','run',1,null,0,17,{distance:1.7,vz:8.4}),sample('LB','run',1,null,0,17,{distance:2.4,vz:8.4}),sample('LB','run',1,'get-up',0,17,{vz:0}),sample('LB','run',1,'get-up',.5,17,{vz:0}),sample('LB','run',1,'get-up',1,17,{vz:0}),sample('QB','dead',0,'wrap',1,5)];
 const sequenceFlag=process.argv.indexOf('--sequences');
 if(sequenceFlag>=0){
  poses=[];const sequences=JSON.parse(fs.readFileSync(process.argv[sequenceFlag+1],'utf8'));
  for(const sequence of sequences){
   rig.poseStates.clear();const actors=new Map();
   sequence.frames.forEach((frame,index)=>{
    rig.phase=frame.phase;
    const group=frame.actors.map(snapshot=>{
     let p=actors.get(snapshot.index);if(!p){p={};actors.set(snapshot.index,p)}Object.assign(p,snapshot);
     const bones=rig.bonesFor(p,frame.phase,frame.time),model=rig.modelFor(p);return{p:{...p},bones:[...bones],model:[...model]};
    });
    const selected=sequence.selected.find(s=>s.frameIndex===index);if(selected)poses.push({label:selected.label,group});
   });
  }
 }
 fs.writeFileSync(path.join(out,'scene.json'),JSON.stringify({...ATHLETE_SHADERS,attrs,indexType:json.accessors[primitive.indices].componentType,indexCount:ix.length,poses}));
 console.log('Render scene:',out);
}
