import * as T from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {readFileSync,writeFileSync} from 'node:fs';
const data=readFileSync('public/play-moment-3d/assets/combine-training-athlete-v1.glb');
const doc=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)));
const nodes=doc.nodes.map(n=>{const o=new T.Bone();o.name=n.name;if(n.translation)o.position.fromArray(n.translation);if(n.rotation)o.quaternion.fromArray(n.rotation);if(n.scale)o.scale.fromArray(n.scale);return o;});
for(let i=0;i<nodes.length;i++)for(const c of doc.nodes[i].children||[])nodes[i].add(nodes[c]);
const body=new T.Group();for(const n of nodes)if(!n.parent)body.add(n);body.updateMatrixWorld(true);
const target=Object.fromEntries(nodes.filter(n=>n.name.startsWith('mixamorig:')).map(n=>[n.name.slice(10),n]));
const depth=b=>b.parent?1+depth(b.parent):0;
const names=Object.keys(target).sort((a,b)=>depth(target[a])-depth(target[b])),world=o=>o.getWorldQuaternion(new T.Quaternion()),position=o=>o.getWorldPosition(new T.Vector3());
const bind=Object.fromEntries(names.map(n=>[n,{p:target[n].position.clone(),q:target[n].quaternion.clone(),w:world(target[n])}]));
const fbx=readFileSync(process.argv[2]);
const sourceRoot=new FBXLoader().parse(fbx.buffer.slice(fbx.byteOffset,fbx.byteOffset+fbx.byteLength),'');
const source={};sourceRoot.traverse(b=>{if(b.isBone)source[b.name.replace('mixamorig','').replace(':','')]=b;});
sourceRoot.updateMatrixWorld(true);
const root=source.Hips,clip=sourceRoot.animations[0];
const reference=Object.fromEntries(Object.entries(source).map(([n,b])=>[n,{q:world(b),p:position(b)}]));
const mixer=new T.AnimationMixer(sourceRoot);const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
const map={};
const scale=(position(target.Hips).y-position(target.LeftFoot).y)/(reference.Hips.p.y-reference.LeftFoot.p.y);
const mode=process.argv[3]||'sprint';
const start=0,end=clip.duration,count=96,frames=[];
const floor=position(target.LeftFoot).y;let minFoot=Infinity;
for(let i=0;i<=count;i++){
 const time=T.MathUtils.lerp(start,end,i/count);mixer.setTime(time);sourceRoot.updateMatrixWorld(true);
 for(const n of names){const b=target[n],sn=map[n]||n;b.position.copy(bind[n].p);b.quaternion.copy(bind[n].q);body.updateMatrixWorld(true);
  if(source[sn]){const desired=world(source[sn]).multiply(reference[sn].q.clone().invert()).multiply(bind[n].w);b.quaternion.copy(world(b.parent).invert().multiply(desired));}
  if(n==='Hips')b.position.y=bind[n].p.y+(position(root).y-reference.Hips.p.y)*scale;
  body.updateMatrixWorld(true);
 }
 const segments=[['Spine','Spine1'],['Spine1','Spine2'],['Spine2','Neck'],['Neck','Head'],['Head','HeadTop_End']];
 for(const side of ['Left','Right'])segments.push([side+'UpLeg',side+'Leg'],[side+'Leg',side+'Foot'],[side+'Foot',side+'ToeBase'],[side+'Arm',side+'ForeArm'],[side+'ForeArm',side+'Hand'],[side+'Hand',side+'HandMiddle4']);
 for(const [a,b] of segments){const sb=b.endsWith('HandMiddle4')?b.replace('HandMiddle4','HandMiddle1'):b;if(!target[a]||!target[b]||!source[a]||!source[sb])continue;const from=position(target[b]).sub(position(target[a])).normalize(),to=position(source[sb]).sub(position(source[a])).normalize();const desired=new T.Quaternion().setFromUnitVectors(from,to).multiply(world(target[a]));target[a].quaternion.copy(world(target[a].parent).invert().multiply(desired));body.updateMatrixWorld(true);}
 // Use a consistent elbow-plane basis: shortest-arc aiming alone can flip
 // axial twist between adjacent frames when the source and target binds differ.
 for(const side of ['Left','Right']){
  const arm=side+'Arm',fore=side+'ForeArm',hand=side+'Hand';
  const upper=position(source[fore]).sub(position(source[arm])).normalize();
  const lower=position(source[hand]).sub(position(source[fore])).normalize();
  const normal=upper.clone().cross(lower).normalize();
  const internal=upper.clone().negate().angleTo(lower),limit=55*Math.PI/180;
  if(internal<limit)lower.copy(upper).negate().applyAxisAngle(normal,-limit);
  for(const [name,child,dir] of [[arm,fore,upper],[fore,hand,lower]]){
   const localX=bind[child].p.clone().normalize();
   const localY=new T.Vector3(side==='Left'?1:-1,0,0).applyQuaternion(bind[name].w.clone().invert());
   localY.addScaledVector(localX,-localY.dot(localX)).normalize();
   const localZ=localX.clone().cross(localY).normalize();
   const localBasis=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(localX,localY,localZ));
   const desiredY=normal.clone().addScaledVector(dir,-normal.dot(dir)).normalize();
   const desiredBasis=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(dir,desiredY,dir.clone().cross(desiredY).normalize()));
   const q=desiredBasis.multiply(localBasis.invert());
   target[name].quaternion.copy(world(target[name].parent).invert().multiply(q));body.updateMatrixWorld(true);
  }
  const tip=target[side+'HandMiddle4'];
  const handDirection=position(source[side+'HandMiddle1']).sub(position(source[hand])).normalize();
  const current=position(tip).sub(position(target[hand])).normalize();
  const handQ=new T.Quaternion().setFromUnitVectors(current,handDirection).multiply(world(target[hand]));
  target[hand].quaternion.copy(world(target[hand].parent).invert().multiply(handQ));body.updateMatrixWorld(true);
 }
 minFoot=Math.min(minFoot,position(target.LeftFoot).y,position(target.RightFoot).y);
 frames.push(names.map(n=>[...target[n].position.toArray(),...target[n].quaternion.toArray()]));
}
const offset=floor-minFoot;for(const frame of frames)frame[names.indexOf('Hips')][1]+=offset;
const load=frame=>{names.forEach((n,j)=>{target[n].position.fromArray(frame[j]);target[n].quaternion.fromArray(frame[j],3);});body.updateMatrixWorld(true);};
const samples=frames.map(frame=>{load(frame);return Object.fromEntries(['Left','Right'].map(side=>[side,position(target[side+'Foot']).toArray()]));});
const cycleDistance=3.2;
const contacts=mode==='sprint'?[{side:'Left',start:.30,end:.47},{side:'Right',start:.79,end:.97}]:[];
function aim(a,b,to){const from=position(b).sub(position(a)).normalize();const q=new T.Quaternion().setFromUnitVectors(from,to.clone().sub(position(a)).normalize()).multiply(world(a));a.quaternion.copy(world(a.parent).invert().multiply(q));body.updateMatrixWorld(true);}
function plant(side,end){const a=target[side+'UpLeg'],b=target[side+'Leg'],c=target[side+'Foot'],origin=position(a),pole=position(b),footQ=world(c),l1=origin.distanceTo(pole),l2=pole.distanceTo(position(c));const axis=end.clone().sub(origin),d=T.MathUtils.clamp(axis.length(),.01,l1+l2-.001);axis.normalize();const bend=pole.sub(origin);bend.addScaledVector(axis,-bend.dot(axis)).normalize();const along=(l1*l1-l2*l2+d*d)/(2*d),joint=origin.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));aim(a,b,joint);aim(b,c,origin.clone().addScaledVector(axis,d));c.quaternion.copy(world(c.parent).invert().multiply(footQ));body.updateMatrixWorld(true);}
for(const contact of contacts){const center=(contact.start+contact.end)/2,anchor=samples[Math.round(center*count)][contact.side];contact.x=anchor[0];contact.z=anchor[2];contact.center=center;}
for(let i=0;i<=count;i++){load(frames[i]);const phase=i/count;for(const contact of contacts){if(phase<contact.start||phase>contact.end)continue;const weight=T.MathUtils.smoothstep(phase,contact.start,contact.start+.03)*(1-T.MathUtils.smoothstep(phase,contact.end-.03,contact.end));const desired=new T.Vector3(contact.x,floor,contact.z-cycleDistance*(phase-contact.center));plant(contact.side,position(target[contact.side+'Foot']).lerp(desired,weight));}frames[i]=names.map(n=>[...target[n].position.toArray(),...target[n].quaternion.toArray()].map(v=>Number(v.toFixed(7))));}
const output={source:mode==='sprint'?'Mixamo Standard Sprint':'Mixamo Crouched To Sprinting',start,end,cycleDistance,names,contacts,frames};
writeFileSync('combine/captured-'+mode+'.json',JSON.stringify(output));console.log({mode,scale,start,end,count,contacts});
