import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The same authored character and texture set used by the football game.
export const COMBINE_CHARACTER_URL = '/play-moment-3d/assets/ball-knower-gridiron-sentinel-v4.glb?v=sentinel-materials-34';
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const position=o=>o.getWorldPosition(v());
const rotation=o=>o.getWorldQuaternion(new T.Quaternion());

export async function loadCombineRunner(player) {
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
  let gltf;
  try{const response=await fetch(COMBINE_CHARACTER_URL,{signal:controller.signal,cache:'force-cache'});if(!response.ok)throw new Error('Character request failed');gltf=await new GLTFLoader().parseAsync(await response.arrayBuffer(),'/play-moment-3d/assets/');}finally{clearTimeout(timeout);}
  const root=new T.Group(),body=gltf.scene;root.add(body);
  const bones={};body.traverse(o=>{if(o.isBone)bones[o.name.replace('mixamorig','').replace(':','')]=o;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(m.map)m.map.anisotropy=4;}}});
  const required=['Hips','Spine','Spine1','Spine2','Neck','Head','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand'];
  if(required.some(name=>!bones[name]))throw new Error('The Combine character rig is incomplete.');
  const bind=Object.fromEntries(Object.entries(bones).map(([name,b])=>[name,{p:b.position.clone(),q:b.quaternion.clone()}]));
  body.updateMatrixWorld(true);
  const footRotations={Left:rotation(bones.LeftFoot),Right:rotation(bones.RightFoot)};
  const footHeight=Math.min(position(bones.LeftFoot).y,position(bones.RightFoot).y);
  function reset(){for(const [name,b]of Object.entries(bones)){b.position.copy(bind[name].p);b.quaternion.copy(bind[name].q);}body.updateMatrixWorld(true);}
  function aim(a,b,target){const before=position(b).sub(position(a)).normalize(),after=target.clone().sub(position(a)).normalize();const q=new T.Quaternion().setFromUnitVectors(before,after).multiply(rotation(a));a.quaternion.copy(rotation(a.parent).invert().multiply(q));body.updateMatrixWorld(true);}
  function solve(names,target,pole,keepFoot=false){
    const [a,b,c]=names.map(n=>bones[n]),origin=position(a),endQ=rotation(c),l1=position(b).distanceTo(origin),l2=position(c).distanceTo(position(b));
    const delta=target.clone().sub(origin),d=T.MathUtils.clamp(delta.length(),Math.abs(l1-l2)+.001,l1+l2-.001),axis=delta.normalize(),bend=pole.clone().sub(origin);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
    const along=(l1*l1-l2*l2+d*d)/(2*d),joint=origin.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
    aim(a,b,joint);aim(b,c,origin.clone().addScaledVector(axis,d));
    if(keepFoot)c.quaternion.copy(rotation(c.parent).invert().multiply(endQ));body.updateMatrixWorld(true);
  }
  // Author a three-point start against the imported skeleton, not mesh parts.
  reset();bones.Hips.position.y-=.36;bones.Hips.position.z-=.25;
  bones.Hips.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),1.56));
  bones.Spine.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),.06));
  bones.Spine1.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),.04));
  bones.Head.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),-1.05));body.updateMatrixWorld(true);
  for(const [side,sign]of[['Left',1],['Right',-1]]){
    solve([side+'UpLeg',side+'Leg',side+'Foot'],v(sign*.14,footHeight,side==='Right'?-.53:.08),v(sign*.17,.30,.55),true);
    bones[side+'Foot'].quaternion.copy(rotation(bones[side+'Foot'].parent).invert().multiply(footRotations[side]));body.updateMatrixWorld(true);
    solve([side+'Arm',side+'ForeArm',side+'Hand'],side==='Right'?v(sign*.27,.12,.43):v(sign*.29,.62,-.05),v(sign*.40,.36,side==='Right'?.38:-.20));
  }
  const start=Object.fromEntries(Object.entries(bones).map(([name,b])=>[name,{p:b.position.clone(),q:b.quaternion.clone()}]));
  reset();
  const clip=gltf.animations.find(c=>c.name.toLowerCase()==='sprint')||gltf.animations.find(c=>/run/i.test(c.name));
  if(!clip)throw new Error('The Combine sprint animation is missing.');
  const tracks=clip.tracks.map(track=>{const split=track.name.lastIndexOf('.');return{node:body.getObjectByName(track.name.slice(0,split)),property:track.name.slice(split+1),interpolant:track.createInterpolant()};});
  function setAthlete(next){const bulk=['OL','DL'].includes(next.position)?1.10:['TE','LB'].includes(next.position)?1.05:1;body.scale.set(1.08*bulk,1.10,1.08*bulk);}
  setAthlete(player);
  function pose(distance,velocity,stance=true,launch=1,celebrate=0){
    // Locomotion follows ground covered and cannot run while stopped.
    const sampleTime=((Math.max(0,distance)/4.8)%1)*clip.duration;
    for(const track of tracks){const value=track.interpolant.evaluate(sampleTime);track.node?.[track.property]?.fromArray(value);}
    bones.Hips.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),-.20*T.MathUtils.smoothstep(distance,2,20)));
    bones.Hips.position.x=bind.Hips.p.x;bones.Hips.position.z=bind.Hips.p.z;
    const blend=stance?0:T.MathUtils.smoothstep(launch,0,1);
    for(const [name,b]of Object.entries(bones)){b.position.lerpVectors(start[name].p,b.position,blend);b.quaternion.slerpQuaternions(start[name].q,b.quaternion.clone(),blend);}
    // Ease into the upright resting skeleton after the run-through.
    if(!stance&&velocity<1.2&&launch>=1){const settle=1-T.MathUtils.smoothstep(velocity,0,1.2);for(const side of['Left','Right'])for(const part of['UpLeg','Leg','Foot']){const name=side+part;bones[name].quaternion.slerp(bind[name].q,settle);}}
    if(celebrate>0){bones.Head.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),-.12*celebrate));}
    body.position.y=0;root.updateMatrixWorld(true);
    body.position.y=footHeight*body.scale.y-Math.min(position(bones.LeftFoot).y,position(bones.RightFoot).y);
    root.updateMatrixWorld(true);
  }
  pose(0,0,true);
  return {root,pose,setAthlete,dispose(){const images=new Set();body.traverse(o=>{o.skeleton?.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)for(const value of Object.values(m))if(value?.isTexture&&value.image)images.add(value.image);});for(const image of images)image.close?.();}};
}
