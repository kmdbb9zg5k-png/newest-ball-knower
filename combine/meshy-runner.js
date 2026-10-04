import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createPlayerAppearance } from './player-appearance.js';

// Native 52-bone athlete and its own captured clips; no cross-rig retargeting.
export const COMBINE_CHARACTER_URL = '/play-moment-3d/assets/combine-native-athlete-v1.glb?v=native-1';
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const position=o=>o.getWorldPosition(v());
const rotation=o=>o.getWorldQuaternion(new T.Quaternion());

export async function loadCombineRunner(player) {
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
  let gltf;
  try{const response=await fetch(COMBINE_CHARACTER_URL,{signal:controller.signal,cache:'force-cache'});if(!response.ok)throw new Error('Character request failed');gltf=await new GLTFLoader().parseAsync(await response.arrayBuffer(),'/play-moment-3d/assets/');}finally{clearTimeout(timeout);}
  const root=new T.Group(),body=gltf.scene;root.add(body);
  const asset=body.getObjectByName('CombineAthlete'),baseScale=asset.scale.clone();
  const strides=asset.userData.strides;
  const mixer=new T.AnimationMixer(body);
  const clips=Object.fromEntries(gltf.animations.map(c=>[c.name,c]));
  const actions=Object.fromEntries(Object.entries(clips).map(([name,c])=>[name,mixer.clipAction(c).play()]));
  const sourceScale=baseScale.y;
  const bones={};body.traverse(o=>{if(o.isBone)bones[o.name.replace('mixamorig','').replace(':','')]=o;if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(m.map)m.map.anisotropy=4;}}});
  const required=['Hips','Spine','Spine1','Spine2','Neck','Head','LeftUpLeg','LeftLeg','LeftFoot','RightUpLeg','RightLeg','RightFoot','LeftArm','LeftForeArm','LeftHand','RightArm','RightForeArm','RightHand'];
  if(required.some(name=>!bones[name]))throw new Error('The Combine character rig is incomplete.');
  const appearance=createPlayerAppearance(body,bones);
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
  // Balanced three-point start: staggered feet behind the line, square hips,
  // one supporting hand and the free arm below the shoulder (never waving).
  reset();bones.Hips.position.set(0,.63/sourceScale,-.35/sourceScale);
  bones.Hips.quaternion.setFromAxisAngle(v(1,0,0),1.64);
  bones.Spine.quaternion.copy(bind.Spine.q);
  bones.Spine1.quaternion.copy(bind.Spine1.q);
  bones.Head.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),-1.02));body.updateMatrixWorld(true);
  for(const [side,sign]of[['Left',1],['Right',-1]]){
    const back=side==='Right';
    solve([side+'UpLeg',side+'Leg',side+'Foot'],v(sign*.125,footHeight+(back?.045:0),back?-.65:-.18),v(sign*.14,.28,.15),true);
    const footQ=footRotations[side].clone();if(back)footQ.premultiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),-.25));
    bones[side+'Foot'].quaternion.copy(rotation(bones[side+'Foot'].parent).invert().multiply(footQ));body.updateMatrixWorld(true);
    solve([side+'Arm',side+'ForeArm',side+'Hand'],back?v(sign*.25,.115,.32):v(sign*.29,.40,-.11),v(sign*.34,.37,back?.23:-.22));
    const hand=bones[side+'Hand'],tip=bones[side+'HandMiddle4'];
    if(tip)aim(hand,tip,position(hand).add(back?v(0,-.07,.12):v(0,-.14,.015)));
  }
  const start=Object.fromEntries(Object.entries(bones).map(([name,b])=>[name,{p:b.position.clone(),q:b.quaternion.clone()}]));
  reset();
  let gaitPhase=0,lastDistance=0,idleTime=0,walkWeight=0,idleWeight=0;
  function setAthlete(next){
    gaitPhase=0;lastDistance=0;idleTime=0;walkWeight=0;idleWeight=0;
    const bulk=['OL','DL'].includes(next.position)?1.06:['TE','LB'].includes(next.position)?1.03:1;
    asset.scale.copy(baseScale);asset.scale.x*=bulk;
    appearance.apply(next);root.userData.playerId=next.id;root.userData.playerName=next.name;
  }
  setAthlete(player);
  function pose(distance,velocity,stance=true,launch=1,celebrate=0,recovering=false,dt=1/60){
    dt=T.MathUtils.clamp(dt,0,.1);
    if(stance||distance<lastDistance){gaitPhase=0;walkWeight=0;idleWeight=0;}
    const targetWalk=recovering?1-T.MathUtils.smoothstep(velocity,1.4,4.2):0;
    const targetIdle=recovering?1-T.MathUtils.smoothstep(velocity,.08,.65):0;
    const smoothing=1-Math.exp(-dt*10);
    walkWeight=T.MathUtils.lerp(walkWeight,targetWalk,smoothing);
    idleWeight=T.MathUtils.lerp(idleWeight,targetIdle,smoothing);
    const stride=T.MathUtils.lerp(strides.Run,strides.Walk,walkWeight);
    // Advance both gaits by measured travel, preserving their matching contact
    // phase while crossfading. Root translation was removed from the clips.
    if(!stance)gaitPhase+=Math.max(0,distance-lastDistance)/stride;
    lastDistance=distance;idleTime+=dt;
    actions.Run.time=(gaitPhase%1)*clips.Run.duration;
    actions.Walk.time=(gaitPhase%1)*clips.Walk.duration;
    actions.Idle.time=idleTime%clips.Idle.duration;
    actions.Run.setEffectiveWeight((1-walkWeight)*(1-idleWeight));
    actions.Walk.setEffectiveWeight(walkWeight*(1-idleWeight));
    actions.Idle.setEffectiveWeight(idleWeight);
    mixer.update(0);
    const blend=stance?0:T.MathUtils.smoothstep(launch,0,1);
    for(const [name,b]of Object.entries(bones)){
      b.position.lerpVectors(start[name].p,b.position,blend);
      b.quaternion.slerpQuaternions(start[name].q,b.quaternion.clone(),blend);
    }
    body.position.y=0;root.updateMatrixWorld(true);
  }
  pose(0,0,true);
  return {root,pose,setAthlete,dispose(){appearance.dispose();mixer.stopAllAction();mixer.uncacheRoot(body);const images=new Set();body.traverse(o=>{o.skeleton?.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)for(const value of Object.values(m))if(value?.isTexture&&value.image)images.add(value.image);});for(const image of images)image.close?.();}};
}
