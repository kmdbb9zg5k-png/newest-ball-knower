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
// QB hands must remain around the ball in both idle pocket and movement states.
for(const velocity of[[0,0],[0,-2],[2,0],[0,3]]){
 const pose=sample('QB','pass',0,null,0,5,{hasBall:true,vx:velocity[0],vz:velocity[1],distance:.8});
 const hands=rig.handTransforms.get(5);for(const h of[hands.left,hands.right]){assert.ok(Math.abs(h[12]-hands.chest[12])<.2,'QB elbow/hand still spread wide');assert.ok(h[13]<hands.chest[13]+.08,'QB holds ball below shoulders')}checks++;
}
for(const heading of[0,Math.PI/2,-Math.PI/2]){
 const target=[Math.sin(heading)*.36,1.38,Math.cos(heading)*.36],pose=sample('QB','handoff',0,'handoff',.5,5,{fallen:false,heading,hasBall:true,ballTarget:target}),hands=rig.handTransforms.get(5),m=pose.model;
 for(const h of[hands.left,hands.right]){const world=[0,1,2].map(i=>m[i]*h[12]+m[4+i]*h[13]+m[8+i]*h[14]+m[12+i]);assert.ok(Math.hypot(...world.map((v,i)=>v-target[i]))<.15,'QB grip disconnected from exchange ball')}checks++;
}
// Verify paired pad contact against the opposing skeleton, not a fixed arm pose.
{
 const pair=[{index:0,role:'OL',team:0,x:0,z:0,heading:0,engaged:true,engagedWith:11,blockStyle:'drive',distance:0},{index:11,role:'DL',team:1,x:0,z:.92,heading:Math.PI,engaged:true,engagedWith:0,blockStyle:'shed',distance:0}];
 rig.phase='run';rig.actorMap=new Map(pair.map(p=>[p.index,p]));rig.poseStates.clear();rig.handTransforms.clear();
 for(let frame=0;frame<6;frame++)for(const p of pair){p.distance=frame*.025;rig.bonesFor(p,'run',frame/60)}
 for(const p of pair){
  const other=pair.find(q=>q!==p),hands=rig.handTransforms.get(p.index),target=rig.handTransforms.get(other.index).chest,m=rig.modelFor(p),n=rig.modelFor(other);
  const world=(model,h)=>[0,1,2].map(i=>model[i]*h[12]+model[4+i]*h[13]+model[8+i]*h[14]+model[12+i]),chest=world(n,target);
  for(const hand of[hands.left,hands.right]){const h=world(m,hand);assert.ok(Math.hypot(...h.map((v,i)=>v-chest[i]))<.42,'Blocker hands miss opposing pads')}checks++;
 }
 rig.actorMap=null;
}

// Reproduce the whistle/TD freeze with stale live overlays and verify the
// actual asset has two planted ankles and lowered, relaxed hands.
for(const role of['QB','RB','OL','DL','DB'])for(const state of['rest','celebrate']){
 const p={role,index:240,team:role==='DL'||role==='DB'?1:0,x:0,z:0,heading:0,vx:0,vz:0,catchT:.4,throwT:.5,reactionT:0,hasBall:role==='RB',action:state==='celebrate'?'celebrate':null,actionT:0};
 rig.phase='dead';rig.poseStates.clear();
 for(let frame=0;frame<90;frame++){
  p.actionT=frame/89;const bones=rig.bonesFor(p,'dead',frame/60),model=rig.modelFor(p);
  const footHeight=side=>{const node=rig.namedNodes['mixamorig:'+side+'Foot'],joint=rig.joints.indexOf(node),point=skinSupportVertices([{p:pointFromBind(node),j:[joint,0,0,0],w:[1,0,0,0]}],bones)[0];return model[1]*point[0]+model[5]*point[1]+model[9]*point[2]+model[13]};
  for(const side of['Left','Right'])assert.ok(footHeight(side)<.27,`${state} ${role}: raised ${side} foot ${footHeight(side)}`);
  if(state==='rest'){assert.equal(meshyAnimationState(p,'dead'),'rest');const hands=rig.handTransforms.get(p.index);for(const [side,hand]of[['Left',hands.left],['Right',hands.right]])if(!(p.hasBall&&side==='Left'))assert.ok(hand[13]<hands.chest[13]-.30,`${role} ${side}: resting hand height ${hand[13]-hands.chest[13]}`);}
  checks++;
 }
}
function pointFromBind(node){return rig.jointWorld(rig.base,node).m.slice(12,15)}
// Follow landing -> kneel -> standing continuously; a pose can satisfy a
// floor-only assertion while still visibly snapping several feet upward.
let recoveryStep=0;
for(const role of['RB','LB']){
 const p={role,index:250,team:role==='LB'?1:0,x:0,z:0,heading:0,fallHeading:0,vx:0,vz:0,fallen:true,hasBall:role==='RB',action:'wrap',actionT:1,actionSide:1};
 rig.phase='dead';rig.poseStates.clear();let previous;
 for(let frame=0;frame<100;frame++){
  if(frame>=10){p.action='get-up';p.actionT=Math.min(1,(frame-10)/66);}
  rig.bonesFor(p,'dead',frame/60);const m=rig.modelFor(p),c=rig.handTransforms.get(p.index).chest,world=[0,1,2].map(i=>m[i]*c[12]+m[4+i]*c[13]+m[8+i]*c[14]+m[12+i]);
  if(previous)recoveryStep=Math.max(recoveryStep,Math.hypot(...world.map((v,i)=>v-previous[i])));previous=world;checks++;
 }
}
assert.ok(recoveryStep<.16,`Recovery torso snapped ${recoveryStep} yards/frame`);
console.log(`Post-play poses: planted celebration/rest feet; maximum get-up torso movement ${recoveryStep.toFixed(3)} yards/frame.`);

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
   rig.poseStates.clear();rig.handTransforms.clear();rig.supportPoints.clear();const actors=new Map();let previousBall=null,maxBallStep=0,maxWrapGap=0;
   sequence.frames.forEach((frame,index)=>{
    rig.phase=frame.phase;
    for(const snapshot of frame.actors){let p=actors.get(snapshot.index);if(!p){p={};actors.set(snapshot.index,p)}Object.assign(p,snapshot)}
    rig.actorMap=actors;rig.ready=true;
    const group=frame.actors.map(snapshot=>{const p=actors.get(snapshot.index),bones=rig.bonesFor(p,frame.phase,frame.time),model=rig.modelFor(p);return{p:{...p},bones:[...bones],model:[...model]}});
    const holder=frame.actors.find(p=>p.hasBall),ball=frame.ball||(holder&&rig.ballAnchor(holder,frame.phase)?.center);
    if(ball&&previousBall){const travel=Math.hypot(...ball.map((v,i)=>v-previousBall[i]));maxBallStep=Math.max(maxBallStep,travel)}previousBall=ball;
    for(const member of group){const p=member.p;if(p.contactRole!=='tackler'||p.actionT<.18||p.actionT>.75)continue;const target=group.find(q=>q.p.index===p.contactWith);if(!target)continue;const h=rig.handTransforms.get(p.index),c=rig.handTransforms.get(target.p.index).chest;const wp=(m,v)=>[0,1,2].map(i=>m[i]*v[12]+m[4+i]*v[13]+m[8+i]*v[14]+m[12+i]),chest=wp(target.model,c);const gap=Math.min(...[h.left,h.right].map(hand=>Math.hypot(...wp(member.model,hand).map((v,i)=>v-chest[i]))));maxWrapGap=Math.max(maxWrapGap,gap);}
    const selected=sequence.selected.find(s=>s.frameIndex===index);if(selected)poses.push({label:selected.label,group,ball,exchange:sequence.label==='handoff'||sequence.label==='pitch'});
   });
   if(maxWrapGap)assert.ok(maxWrapGap<.45,`${sequence.label}: wrap misses the carrier`);
   if(maxWrapGap)console.log(`${sequence.label}: maximum nearest wrap hand gap ${maxWrapGap.toFixed(3)} yards`);
   if(sequence.label==='handoff'||sequence.label==='pitch'){assert.ok(maxBallStep<.36,`${sequence.label}: ball jumped ${maxBallStep.toFixed(3)} yards`);console.log(`${sequence.label}: maximum ball travel per frame ${maxBallStep.toFixed(3)} yards`)}
  }
 }
 fs.writeFileSync(path.join(out,'scene.json'),JSON.stringify({...ATHLETE_SHADERS,attrs,indexType:json.accessors[primitive.indices].componentType,indexCount:ix.length,poses}));
 console.log('Render scene:',out);
}
