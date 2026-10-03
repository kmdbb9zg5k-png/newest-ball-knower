import * as T from 'three';
import {BVHLoader} from 'three/addons/loaders/BVHLoader.js';
import {readFileSync,writeFileSync} from 'node:fs';
const data=readFileSync('public/play-moment-3d/assets/combine-training-athlete-v1.glb');
const doc=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)));
const nodes=doc.nodes.map(n=>{const o=new T.Bone();o.name=n.name;if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);return o;});
for(let i=0;i<nodes.length;i++)for(const c of doc.nodes[i].children||[])nodes[i].add(nodes[c]);
const body=new T.Group();for(const n of nodes)if(!n.parent)body.add(n);body.updateMatrixWorld(true);
const target=Object.fromEntries(nodes.filter(n=>n.name.startsWith('mixamorig:')).map(n=>[n.name.slice(10),n]));
const names=Object.keys(target),world=o=>o.getWorldQuaternion(new T.Quaternion()),position=o=>o.getWorldPosition(new T.Vector3());
const bind=Object.fromEntries(names.map(n=>[n,{p:target[n].position.clone(),q:target[n].quaternion.clone(),w:world(target[n])}]));
const {skeleton,clip}=new BVHLoader().parse(readFileSync('assets/motion-source/cmu-09_01.bvh','utf8'));
const root=skeleton.bones[0],source=Object.fromEntries(skeleton.bones.map(b=>[b.name,b]));
const mixer=new T.AnimationMixer(root);mixer.clipAction(clip).play();mixer.setTime(0);root.updateMatrixWorld(true);
const reference=Object.fromEntries(skeleton.bones.map(b=>[b.name,{q:world(b),p:position(b)}]));
const map={Spine:'LowerBack',Spine1:'Spine',Spine2:'Spine1',Neck:'Neck1'};
const scale=(position(target.Hips).y-position(target.LeftFoot).y)/(reference.Hips.p.y-reference.LeftFoot.p.y);
const start=.23,end=.93,count=84,frames=[];
for(let i=0;i<=count;i++){
 const time=T.MathUtils.lerp(start,end,i/count);mixer.setTime(time);root.updateMatrixWorld(true);
 for(const n of names){const b=target[n],sn=map[n]||n;b.position.copy(bind[n].p);b.quaternion.copy(bind[n].q);body.updateMatrixWorld(true);
  if(source[sn]){const desired=world(source[sn]).multiply(reference[sn].q.clone().invert()).multiply(bind[n].w);b.quaternion.copy(world(b.parent).invert().multiply(desired));}
  if(n==='Hips')b.position.y=bind[n].p.y+(position(root).y-reference.Hips.p.y)*scale;
  body.updateMatrixWorld(true);
 }
 // Match anatomical segment directions after orientation retargeting. The
 // capture and Meshy rigs use different local bone axes and shoulder offsets.
 const segments=[['Spine','Spine1','LowerBack','Spine'],['Spine1','Spine2','Spine','Spine1'],['Spine2','Neck','Spine1','Neck'],['Neck','Head','Neck1','Head']];
 for(const side of ['Left','Right'])segments.push([side+'UpLeg',side+'Leg',side+'UpLeg',side+'Leg'],[side+'Leg',side+'Foot',side+'Leg',side+'Foot'],[side+'Foot',side+'ToeBase',side+'Foot',side+'ToeBase'],[side+'Arm',side+'ForeArm',side+'Arm',side+'ForeArm'],[side+'ForeArm',side+'Hand',side+'ForeArm',side+'Hand'],[side+'Hand',side+'HandMiddle4',side+'Hand',side+'FingerBase']);
 for(const [a,b,sa,sb] of segments){if(!target[a]||!target[b]||!source[sa]||!source[sb])continue;const from=position(target[b]).sub(position(target[a])).normalize(),to=position(source[sb]).sub(position(source[sa])).normalize();const desired=new T.Quaternion().setFromUnitVectors(from,to).multiply(world(target[a]));target[a].quaternion.copy(world(target[a].parent).invert().multiply(desired));body.updateMatrixWorld(true);}
 frames.push(names.map(n=>[...target[n].position.toArray(),...target[n].quaternion.toArray()]));
}
const output={source:'CMU 09_01, Bruce Hahne 2010 BVH conversion',start,end,cycleDistance:4.1,names,frames};
writeFileSync('assets/motion-source/cmu-09_01-preview.json',JSON.stringify(output));console.log({scale,start,end,count});
