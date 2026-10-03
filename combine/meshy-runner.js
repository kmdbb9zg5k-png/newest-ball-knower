import * as T from 'three';
import { createSprintMotion, SPRINT_CYCLE_DISTANCE, WALK_CYCLE_DISTANCE } from './sprint-motion.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The training-clothes athlete preserves the uploaded 312K geometry and skin.
export const COMBINE_CHARACTER_URL = '/play-moment-3d/assets/combine-training-athlete-v1.glb?v=training-1';
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
  // Balanced three-point start: staggered feet behind the line, square hips,
  // one supporting hand and the free arm below the shoulder (never waving).
  reset();bones.Hips.position.set(0,.63,-.35);
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
  const motion=createSprintMotion(body,bones,bind);
  let gaitPhase=0,lastDistance=0;
  function setAthlete(next){gaitPhase=0;lastDistance=0;const bulk=['OL','DL'].includes(next.position)?1.10:['TE','LB'].includes(next.position)?1.05:1;body.scale.set(1.08*bulk,1.10,1.08*bulk);}
  setAthlete(player);
  function pose(distance,velocity,stance=true,launch=1,celebrate=0,recovering=false){
    // Bake the rig-space gait once, then sample by actual distance travelled.
    // Scale-aware phase keeps each planted foot stationary against the track.
    const walk=recovering?1-T.MathUtils.smoothstep(velocity,1.4,5):0;
    if(stance||distance<lastDistance)gaitPhase=0;
    else gaitPhase+=Math.max(0,distance-lastDistance)/(T.MathUtils.lerp(SPRINT_CYCLE_DISTANCE,WALK_CYCLE_DISTANCE,walk)*body.scale.z);
    lastDistance=distance;
    const effort=stance?1:T.MathUtils.smoothstep(velocity,0,.8);
    motion.sample(gaitPhase,effort,walk,recovering?Infinity:launch*.48);
    const blend=stance?0:T.MathUtils.smoothstep(launch,0,1);
    for(const [name,b]of Object.entries(bones)){
      b.position.lerpVectors(start[name].p,b.position,blend);
      b.quaternion.slerpQuaternions(start[name].q,b.quaternion.clone(),blend);
    }
    // Maintain a forward drive through the opening metres after the crouch
    // releases. Rotate only the trunk so support-foot placement stays intact.
    const drive=(!stance&&!recovering)?.20*(1-T.MathUtils.smoothstep(distance,0,12))*blend:0;
    if(drive>0){
      body.updateMatrixWorld(true);
      const spine=bones.Spine,q=new T.Quaternion().setFromAxisAngle(v(1,0,0),drive).multiply(rotation(spine));
      spine.quaternion.copy(rotation(spine.parent).invert().multiply(q));
    }
    if(celebrate>0)bones.Head.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),-.06*celebrate));
    // Preserve flight and foot contact instead of snapping the lowest ankle
    // to the floor on every frame (which caused the previous skating effect).
    body.position.y=0;root.updateMatrixWorld(true);
  }
  pose(0,0,true);
  return {root,pose,setAthlete,dispose(){const images=new Set();body.traverse(o=>{o.skeleton?.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)for(const value of Object.values(m))if(value?.isTexture&&value.image)images.add(value.image);});for(const image of images)image.close?.();}};
}
