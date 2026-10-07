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
