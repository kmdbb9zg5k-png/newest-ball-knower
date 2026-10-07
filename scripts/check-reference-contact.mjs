import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {parseGLB} from '../public/play-moment-3d/meshy-athlete.js';import {MeshyAthletes} from '../public/play-moment-3d/reference-athlete.js';import {mul} from '../public/play-moment-3d/renderer.js';
const f=readFileSync('public/play-moment-3d/assets/reference-helmeted-athlete-v1.glb'),{json,accessor}=parseGLB(f.buffer.slice(f.byteOffset,f.byteOffset+f.byteLength));const rig=Object.create(MeshyAthletes.prototype);rig.parents=new Int16Array(json.nodes.length).fill(-1);json.nodes.forEach((n,i)=>(n.children||[]).forEach(c=>rig.parents[c]=i));rig.namedNodes=Object.fromEntries(json.nodes.map((n,i)=>[n.name,i]));rig.base=json.nodes.map(n=>({t:n.translation||[0,0,0],r:n.rotation||[0,0,0,1],s:n.scale||[1,1,1]}));const skin=json.skins[0];rig.joints=skin.joints;rig.inverseBind=accessor(skin.inverseBindMatrices);for(const k of ['poseStates','handTransforms','supports','frameModels'])rig[k]=new Map();rig.renderer={shadowAvailable:false};rig.ready=true;rig.clips=json.animations.map(a=>{let duration=0;const channels=a.channels.map(c=>{const s=a.samplers[c.sampler],times=accessor(s.input);duration=Math.max(duration,times.at(-1));return{node:c.target.node,path:c.target.path,times,values:accessor(s.output),size:c.target.path==='rotation'?4:3}});return {duration,channels}});

const report=[];
for(const variant of ['wrap','drag-down','low-wrap','shoulder-hit','dive','gang','big-hit']){
 for(const side of [-1,1]){
 const p={index:6,team:0,role:'RB',x:0,z:0,heading:0,fallHeading:0,contactStartHeading:0,fallen:true,action:variant==='dive'?'dive':variant==='big-hit'?'big-hit':'wrap',actionT:0,contactRole:'carrier',contactVariant:variant,actionSide:side,hasBall:true};
 for(let frame=0;frame<=60;frame++){p.actionT=frame/60;rig.queueShadows([p],'dead',frame/60);assert([...rig.frameBones.get(6)].every(Number.isFinite));}
 const h=rig.handTransforms.get(6),m=rig.modelFor(p),world=k=>[...mul(m,h[k])].slice(12,15),chest=world('chest'),head=world('head');
 assert(chest[1]<.53,variant+' must reach the turf: '+chest[1]);
 if(['wrap','drag-down','dive'].includes(variant))assert(head[1]<.45,variant+' must not be lifted by a buried elbow: '+head[1]);
 for(const k of ['left','right'])assert(world(k)[1]>=.025,'Carrying hand below turf');
 const anchor=rig.ballAnchor(p,'dead');assert(anchor.center.every(Number.isFinite));assert(Math.hypot(...anchor.center.map((v,i)=>v-chest[i]))<.5,'Ball must stay at the ribs');
 assert(Math.min(anchor.a[1],anchor.b[1])-.105>.02,'Carried ball must stay above the turf');
 const tackler={...p,index:16,team:1,role:'LB',hasBall:false,x:.60*side,z:-.12,contactRole:'tackler',contactWith:6,contactTarget:[0,.3,0],actionSide:-side};rig.queueShadows([p,tackler],'dead',1.1);
 const th=rig.handTransforms.get(16),tm=rig.modelFor(tackler),wrapGap=Math.max(...['left','right'].map(k=>{const hand=[...mul(tm,th[k])].slice(12,15);return Math.min(...tackler.contactHands.map(target=>Math.hypot(...target.map((v,i)=>v-hand[i]))));}));
 assert(wrapGap<.42,'Wrap must remain within reach of the ribs: '+variant+' '+wrapGap);
 report.push({variant,side,chest:chest[1],head:head[1],wrapGap});
 }
}

let maxHandGap=0;
const players=Array.from({length:22},(_,index)=>({index,team:index<11?0:1,role:index<11?'OL':'DL',x:(index%11)*2,z:index<11?35:36,heading:index<11?0:Math.PI,vx:0,vz:.25,distance:0}));
for(const i of [0,11])Object.assign(players[i],{engaged:true,engagedWith:i===0?11:0,blockStyle:i===0?'pass-anchor':'bull-rush'});
for(let frame=0;frame<30;frame++){
 for(const i of [0,11]){players[i].z+=.005;players[i].distance+=.005;}
 rig.queueShadows(players,'pass',2+frame/60);
 for(const i of [0,11]){const p=players[i],m=rig.modelFor(p),hands=rig.handTransforms.get(i);for(const name of ['left','right']){const hand=[...mul(m,hands[name])].slice(12,15),gap=Math.min(...p.blockHands.map(t=>Math.hypot(...t.map((v,k)=>v-hand[k]))));maxHandGap=Math.max(maxHandGap,gap);}}
}
assert(maxHandGap<.3,'Block hands must stay on opposing pads: '+maxHandGap);
console.log(JSON.stringify({status:'PASS',asset:'reference-helmeted-athlete-v1.glb',cases:report,maxBlockHandGap:maxHandGap},null,2));

// Carry grip stays outside the forearm with the forward tip covered by the hand.
let carrySamples=0,minClearance=Infinity;
for(const index of [6,7])for(const phase of ['run','dead'])for(const heading of [0,1.7,3.1]){
 const p={index,team:0,role:'RB',hasBall:true,x:0,z:35,heading,vx:0,vz:7,distance:0};
 for(let frame=0;frame<30;frame++){p.distance+=7/60;rig.queueShadows([p],phase,frame/60+10);const anchor=rig.ballAnchor(p,phase),h=rig.handTransforms.get(index),m=rig.modelFor(p),right=(index%2)===1,hand=[...mul(m,right?h.right:h.left)].slice(12,15),elbow=[...mul(m,right?h.rightForearm:h.leftForearm)].slice(12,15),axis=hand.map((v,i)=>v-elbow[i]),length=Math.hypot(...axis),v=anchor.center.map((v,i)=>v-elbow[i]),dot=v.reduce((n,x,i)=>n+x*axis[i]/length,0),gap=Math.hypot(...v.map((x,i)=>x-dot*axis[i]/length));minClearance=Math.min(minClearance,gap);assert(gap>.14,'Ball center must be outside the forearm surface');assert(Math.hypot(...anchor.b.map((v,i)=>v-hand[i]))<.17,'Palm must cover forward tip');carrySamples++;}
}
console.log(JSON.stringify({carrySamples,minClearance}));

// Verify the visible skinned hand, not only the wrist bone: source hand rotations
// can leave the fingers below a numerically correct ball anchor.
const primitive=json.meshes[0].primitives[0],positions=accessor(primitive.attributes.POSITION),jointIndices=accessor(primitive.attributes.JOINTS_0),weightAccessor=json.accessors[primitive.attributes.WEIGHTS_0],rawWeights=accessor(primitive.attributes.WEIGHTS_0),weights=Float32Array.from(rawWeights,v=>weightAccessor.normalized?v/({5121:255,5123:65535}[weightAccessor.componentType]||1):v);
let maxGripGap=0;
for(const index of [6,7])for(const heading of [0,1.7,3.1]){
 const p={index,team:0,role:'RB',hasBall:true,x:0,z:35,heading,vx:0,vz:7,distance:3};rig.queueShadows([p],'run',30);const m=rig.modelFor(p),bones=rig.frameBones.get(index),handJoint=rig.joints.indexOf(rig.namedNodes['mixamorig:'+(index%2?'Right':'Left')+'Hand']),points=[];
 for(let i=0;i<positions.length/3;i++){
  if(![0,1,2,3].some(k=>jointIndices[i*4+k]===handJoint&&weights[i*4+k]>.5))continue;
  const v=[0,0,0];for(let k=0;k<4;k++){const offset=jointIndices[i*4+k]*16,w=weights[i*4+k];for(let c=0;c<3;c++)v[c]+=w*(bones[offset+c]*positions[i*3]+bones[offset+c+4]*positions[i*3+1]+bones[offset+c+8]*positions[i*3+2]+bones[offset+c+12]);}
  points.push([0,1,2].map(c=>m[c]*v[0]+m[c+4]*v[1]+m[c+8]*v[2]+m[c+12]));
 }
 assert(points.length>100,'Inspect the actual hand mesh');const center=[0,1,2].map(c=>points.reduce((n,p)=>n+p[c],0)/points.length),tip=rig.ballAnchor(p,'run').b,gap=Math.hypot(...tip.map((v,i)=>v-center[i]));maxGripGap=Math.max(maxGripGap,gap);assert(gap<.18,'Visible fingers must reach the ball tip: '+gap);
}
console.log(JSON.stringify({skinGripCases:6,maxGripGap}));

// Drive-phase articulation must move the visible feet before the torso lands.
const driveReport=[];
for(const variant of ['wrap','drag-down','low-wrap'])for(const role of ['carrier','tackler']){
 const p={index:role==='carrier'?6:16,team:role==='carrier'?0:1,role:role==='carrier'?'RB':'LB',x:0,z:0,heading:0,fallen:true,action:'wrap',contactRole:role,contactVariant:variant,actionSide:1};
 const feet=[];
 for(const t of [.10,.22,.34,.46]){p.actionT=t;const locals=rig.base.map(n=>({t:[...n.t],r:[...n.r],s:[...n.s]}));rig.contactPose(locals,p);feet.push([...rig.worldPose(locals,rig.namedNodes['mixamorig:LeftFoot'])].slice(12,15));}
 const travel=Math.max(...feet.map(a=>Math.hypot(...a.map((v,i)=>v-feet[0][i]))));
 assert(travel>.10,variant+' '+role+' must articulate a contact step');driveReport.push({variant,role,travel});
}
console.log(JSON.stringify({driveReport}));
