import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MeshyAthletes,parseGLB,athleteSupportVertices,skinSupportVertices,ATHLETE_SHADERS} from '../public/play-moment-3d/meshy-athlete.js';
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
function sample(role,phase,team,action=null,actionT=0,index=0){
 const p={role,phase,team,index,number:24,x:0,z:0,heading:0,vx:0,vz:phase==='run'?7:0,hasBall:role==='RB',action,actionT,fallen:Boolean(action),actionSide:1};
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
console.log(`Presentation checks passed: ${checks} real-asset poses; ${rig.supportVertices.length} support vertices; lowest body point ${worstFloor.toFixed(4)}m.`);
const flag=process.argv.indexOf('--render-dir');
if(flag>=0){
 const out=path.resolve(process.argv[flag+1]);fs.mkdirSync(out,{recursive:true});const attrs={};
 for(const [name,idx]of Object.entries(primitive.attributes)){const a=accessor(idx);fs.writeFileSync(path.join(out,name+'.bin'),Buffer.from(a.buffer,a.byteOffset,a.byteLength));attrs[name]={type:json.accessors[idx].componentType,count:json.accessors[idx].count}}
 const ix=accessor(primitive.indices);fs.writeFileSync(path.join(out,'indices.bin'),Buffer.from(ix.buffer,ix.byteOffset,ix.byteLength));
 const mat=json.materials[primitive.material];[mat.pbrMetallicRoughness.baseColorTexture.index,mat.normalTexture.index,mat.pbrMetallicRoughness.metallicRoughnessTexture.index].forEach((idx,i)=>{const im=json.images[json.textures[idx].source],v=json.bufferViews[im.bufferView];fs.writeFileSync(path.join(out,'tex'+i+'.jpg'),Buffer.from(parsed.bin,v.byteOffset||0,v.byteLength))});
 const poses=[sample('QB','pre',0),sample('OL','pre',0),sample('DB','pre',1),sample('LB','dead',1),sample('RB','run',0),sample('LB','dead',1,'wrap',1),sample('RB','dead',0,'wrap',1),sample('RB','dead',0,'wrap',.5)];
 fs.writeFileSync(path.join(out,'scene.json'),JSON.stringify({...ATHLETE_SHADERS,attrs,indexType:json.accessors[primitive.indices].componentType,indexCount:ix.length,poses}));
 console.log('Render scene:',out);
}
