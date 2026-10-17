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
  // Isolated two-foot jump pose on the same rig used by the 40. Targets are
  // solved at the origin, then the entire athlete is placed in the lane.
  function poseJump(state) {
    root.position.set(0,0,0);root.updateMatrixWorld(true);reset();
    const phase=state.phase,t=Math.min(1,state.elapsed/state.flight);
    const load=phase==='power'?T.MathUtils.smoothstep(state.elapsed,0,.25)*(.5+.08*Math.sin(state.elapsed*12)*Math.sin(Math.PI*state.elapsed/2)):phase==='aim'?(.5+.08*T.MathUtils.smoothstep(state.elapsed,.2,1.8)):0;
    const airborne=phase==='flight',landing=phase==='landed';
    const stumble=landing&&state.stumble?Math.sin(Math.min(1,state.elapsed/1)*Math.PI):0;
    const compress=landing?.5*(1-T.MathUtils.smoothstep(state.elapsed,0,1)):load;
    const jumpCompress=airborne?.5*(1-Math.sin(t*Math.PI)):compress;
    const hipY=.98-jumpCompress*.48;
    bones.Hips.position.set(0,hipY/sourceScale,0);
    bones.Hips.quaternion.copy(bind.Hips.q).multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),jumpCompress*.65-stumble*.3));
    body.updateMatrixWorld(true);
    for(const [side,sign] of [['Left',1],['Right',-1]]) {
      const reach=airborne?Math.sin(t*Math.PI):0;
      const foot=v(sign*.14,footHeight+reach*.3+(side==='Right'?stumble*.12:0),.06+reach*.5-(side==='Right'?stumble*.45:0));
      solve([side+'UpLeg',side+'Leg',side+'Foot'],foot,v(sign*.17,.5,.85));
      bones[side+'Foot'].quaternion.copy(rotation(bones[side+'Foot'].parent).invert().multiply(footRotations[side]));
      body.updateMatrixWorld(true);
      const armZ=airborne?-.325+Math.sin(t*Math.PI)*.78: -compress*.65;
      solve([side+'Arm',side+'ForeArm',side+'Hand'],v(sign*(.29+stumble*.18),.8+reach*.35+stumble*.25,armZ-stumble*.2),v(sign*.4,.85,armZ-.2));
    }
    body.position.y=0;root.position.set(0,state.height,state.visualDistance-stumble*.15);root.updateMatrixWorld(true);
  }
  // A planted lunge reaches the line before the body turns and pushes away.
  function poseShuttleTurn(state){
    root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);reset();
    const t=T.MathUtils.clamp(state.cutElapsed/.8,0,1);
    const load=T.MathUtils.smoothstep(t,0,.32)*(1-T.MathUtils.smoothstep(t,.58,1));
    bones.Hips.position.set(0,(.98-load*.58)/sourceScale,-load*.13/sourceScale);
    bones.Hips.quaternion.copy(bind.Hips.q).multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),load*1.05));body.updateMatrixWorld(true);
    for(const [side,sign]of [['Left',1],['Right',-1]]){
      const front=side==='Left';
      solve([side+'UpLeg',side+'Leg',side+'Foot'],v(sign*.18,footHeight,front?.10:-.48*load),v(sign*.2,.40,.7));
      bones[side+'Foot'].quaternion.copy(rotation(bones[side+'Foot'].parent).invert().multiply(footRotations[side]));body.updateMatrixWorld(true);
      const hand=front?v(.25,.8-load*.71,.07+load*.03):v(-.3,.8-load*.12,-.2-load*.18);
      solve([side+'Arm',side+'ForeArm',side+'Hand'],hand,v(sign*.4,.55,-.2));
      if(front&&bones.LeftHandMiddle4)aim(bones.LeftHand,bones.LeftHandMiddle4,position(bones.LeftHand).add(v(0,-.13,.025)));
    }
    body.position.y=0;root.updateMatrixWorld(true);
  }
  // Bench targets use the native skeleton at the origin, with a supported
  // back, planted feet and a shared hand/bar height throughout each repetition.
  function poseBench(state) {
    root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);reset();
    bones.Hips.position.set(0,.65/sourceScale,.25/sourceScale);
    bones.Hips.quaternion.copy(bind.Hips.q).multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),-Math.PI/2));
    body.updateMatrixWorld(true);
    const barY=.84+state.lift*.55;
    for(const [side,sign] of [['Left',1],['Right',-1]]) {
      solve([side+'UpLeg',side+'Leg',side+'Foot'],v(sign*.28,footHeight,.85),v(sign*.3,.75,1.1));
      bones[side+'Foot'].quaternion.copy(rotation(bones[side+'Foot'].parent).invert().multiply(footRotations[side]));body.updateMatrixWorld(true);
      solve([side+'Arm',side+'ForeArm',side+'Hand'],v(sign*.34,barY,-.24),v(sign*.65,.72,-.20));
      const hand=bones[side+'Hand'],tip=bones[side+'HandMiddle4'];
      if(tip)aim(hand,tip,position(hand).add(v(0,0,-.12)));
      for(const finger of ['Index','Middle','Ring','Pinky'])for(let joint=1;joint<=3;joint++) {
        const bone=bones[side+'Hand'+finger+joint];
        if(bone)bone.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),joint===1?.7:1.15));
      }
      const thumb=bones[side+'HandThumb2'];if(thumb)thumb.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),.65));
    }
    body.position.y=0;root.updateMatrixWorld(true);
    const grip=side=>position(bones[side+'Hand']).lerp(position(bones[side+'HandMiddle1']),.75);
    return grip('Left').add(grip('Right')).multiplyScalar(.5);
  }
  function poseReceiver(state,dt){
    root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);
    const moving=Math.hypot(state.vx,state.vz);
    pose(state.distance,moving,false,1,0,moving<1,dt);
    const caught=state.result?.caught,reach=state.phase==='flight'&&state.catchAt!==null;
    if(caught||reach){
      const tuck=caught?T.MathUtils.smoothstep(state.settle,0,.5):0;
      for(const [side,sign]of [['Left',1],['Right',-1]]){
        const target=v(sign*T.MathUtils.lerp(.13,.12,tuck),T.MathUtils.lerp(1.35,1.02,tuck),T.MathUtils.lerp(.48,.26,tuck));
        solve([side+'Arm',side+'ForeArm',side+'Hand'],target,v(sign*.38,1.05,.20));
      }
    }
    root.updateMatrixWorld(true);
    return position(bones.LeftHand).add(position(bones.RightHand)).multiplyScalar(.5);
  }
  function poseQuarterback(t){
    root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);reset();
    const wind=T.MathUtils.smoothstep(t,-.5,0),follow=T.MathUtils.smoothstep(t,0,.35);
    solve(['RightArm','RightForeArm','RightHand'],v(.25,1.3+wind*.4-follow*.35,.25-wind*.4+follow*.8),v(.5,1.45,0));
    solve(['LeftArm','LeftForeArm','LeftHand'],v(-.20,1.15,.28),v(-.4,1.1,.1));
    return position(bones.RightHand);
  }
  pose(0,0,true);
  return {root,pose,poseJump,poseBench,poseShuttleTurn,poseReceiver,poseQuarterback,setAthlete,dispose(){appearance.dispose();mixer.stopAllAction();mixer.uncacheRoot(body);const images=new Set();body.traverse(o=>{o.skeleton?.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)for(const value of Object.values(m))if(value?.isTexture&&value.image)images.add(value.image);});for(const image of images)image.close?.();}};
}
