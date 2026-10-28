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
    const height=T.MathUtils.clamp((next.heightInches||72)/72,.91,1.12);
    const frame=Number.isFinite(next.bodyBuild)?(next.bodyBuild+next.shoulderWidth+next.armSize+next.legSize)/400:.5;
    const weight=T.MathUtils.clamp(((next.weightLbs||205)-180)/180,0,1);
    const width=T.MathUtils.clamp(.91+frame*.17+weight*.12,.89,1.19);
    asset.scale.copy(baseScale);asset.scale.x*=bulk*width;asset.scale.z*=width;asset.scale.y*=height;
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
  const palm=side=>position(bones[side+'Hand']).lerp(position(bones[side+'HandMiddle1']),.65);
  function poseReceiver(state,dt){
    root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);
    const moving=Math.hypot(state.vx,state.vz);
    pose(state.distance,moving,false,1,0,moving<1,dt);
    const caught=state.result?.caught,remaining=state.arrival-state.clock,reach=state.phase==='flight'&&state.catchAt!==null&&remaining<.55;
    const reachBlend=caught?1:1-T.MathUtils.smoothstep(remaining,.1,.55);
    if(caught||reach){
      const tuck=caught?T.MathUtils.smoothstep(state.settle,0,.5):0;
      for(const [side,sign]of [['Left',1],['Right',-1]]){
        const style=state.catchStyle||'chest';
        const height=style==='high'?1.9:style==='low'?.85:style==='shoulder'?1.65:1.35;
        const lateral=style==='side'?.38:style==='shoulder'?.24:0;
        const forward=style==='shoulder'?.06:.48;
        const target=v(T.MathUtils.lerp(lateral+sign*.13,sign*.12,tuck),T.MathUtils.lerp(height,1.02,tuck),T.MathUtils.lerp(forward,.26,tuck));
        target.lerpVectors(position(bones[side+'Hand']),target,reachBlend);
        solve([side+'Arm',side+'ForeArm',side+'Hand'],target,v(sign*.38,1.05,.20));
      }
    }
    root.updateMatrixWorld(true);
    return palm('Left').add(palm('Right')).multiplyScalar(.5);
  }
  function poseDefender(state,dt){
    const pace=Math.hypot(state.vx,state.vz),backward=state.vx*Math.sin(state.heading)+state.vz*Math.cos(state.heading)<-.3,ready=backward||['press','backpedal','plant'].includes(state.action)||['idle','preview'].includes(state.phase);
    const hand=poseReceiver({distance:state.distance,vx:state.vx,vz:state.vz,phase:state.phase,arrival:state.arrival,clock:state.clock,catchAt:!state.swatting&&state.lookAtBall&&state.attemptAllowed!==false?state.clock:null,catchStyle:state.catchStyle||'chest',settle:state.settle,result:state.intercepted?{caught:true}:null},dt);
    if(ready&&!state.intercepted){
      reset();const cycle=state.distance/1.25*Math.PI*2;
      bones.Hips.position.y=.87/sourceScale;bones.Spine.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),.12));body.updateMatrixWorld(true);
      for(const [side,sign]of [['Left',1],['Right',-1]]){
        const step=Math.sin(cycle+(side==='Left'?0:Math.PI)),lift=Math.max(0,Math.cos(cycle+(side==='Left'?0:Math.PI)))*Math.min(.09,pace*.04);
        solve([side+'UpLeg',side+'Leg',side+'Foot'],v(sign*.21,footHeight+lift,step*Math.min(.22,pace*.10)),v(sign*.24,.42,.6),true);
        solve([side+'Arm',side+'ForeArm',side+'Hand'],v(sign*.31,1.13,state.pressUntil>state.clock?.55:.32),v(sign*.48,.95,.12));
      }
    }
    if(!state.swatting&&ready&&state.lookAtBall&&state.attemptAllowed!==false&&state.arrival-state.clock<.5&&!state.intercepted){
      for(const [side,sign]of [['Left',1],['Right',-1]])solve([side+'Arm',side+'ForeArm',side+'Hand'],v(sign*.14,T.MathUtils.clamp(state.ball[1],.8,2.12),.48),v(sign*.4,1.2,.2));
    }
    if(state.swatting&&!state.intercepted){
      // One continuous upper-body gesture: load, strike across the ball, recover.
      // Legs retain their running/backpedal pose throughout the attempt.
      const t=state.swatTime,side=state.swatSide||'Right',sign=side==='Left'?1:-1;
      const active=t!==null&&t!==undefined&&t<.68;
      const queued=t==null&&state.phase==='flight';
      if(active||queued){
        const smooth=(a,b,x)=>T.MathUtils.smoothstep(x,a,b);
        const load=queued?.35:smooth(0,.16,t),strike=queued?0:smooth(.16,.30,t),recover=queued?0:smooth(.36,.68,t);
        const weight=queued?.35:smooth(0,.08,t)*(1-recover);
        const height=state.swatHeight||Math.min(2.15,state.ball[1]);
        const target=v(sign*T.MathUtils.lerp(.40,-.30,strike),T.MathUtils.lerp(1.18,Math.max(1.45,height+.12),load)-strike*(height<1.2?.65:.25),T.MathUtils.lerp(.12,.70,strike));
        bones.Spine.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(0,1,0),sign*(.20-.48*strike)*weight));body.updateMatrixWorld(true);
        target.lerpVectors(position(bones[side+'Hand']),target,queued?.35:weight);
        solve([side+'Arm',side+'ForeArm',side+'Hand'],target,v(sign*.55,Math.min(1.6,height),.18));
        for(const finger of ['Index','Middle','Ring','Pinky'])for(let joint=1;joint<=3;joint++){const name=side+'Hand'+finger+joint;if(bones[name])bones[name].quaternion.slerp(bind[name].q,weight);}
        const other=side==='Left'?'Right':'Left',guard=v(-sign*.30,1.07,.24).lerp(position(bones[other+'Hand']),1-weight);
        solve([other+'Arm',other+'ForeArm',other+'Hand'],guard,v(-sign*.48,.90,.12));
      }
    }
    if(state.lookAtBall){const dx=state.ball[0]-state.x,dz=state.ball[2]-state.z,angle=Math.atan2(Math.sin(Math.atan2(dx,dz)-state.heading),Math.cos(Math.atan2(dx,dz)-state.heading));bones.Head.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(0,1,0),T.MathUtils.clamp(angle,-1.1,1.1)));}
    root.updateMatrixWorld(true);return state.intercepted?hand:palm('Left').add(palm('Right')).multiplyScalar(.5);
  }
  function poseRB(state,dt,defender=false){
    root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);
    const actor=defender?state.db:state,pace=Math.hypot(actor.vx,actor.vz),age=state.clock-state.moveAt;
    pose(actor.distance,pace,false,1,0,pace<1,dt);
    const tackled=state.result?.reason==='TACKLED',fall=tackled?T.MathUtils.smoothstep(state.settle,defender?.08:0,defender?.78:.65):0;
    if(fall){
      reset();bones.Hips.position.y=T.MathUtils.lerp(.90,.28,fall)/sourceScale;
      bones.Hips.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),(defender?1.32:1.10)*fall));bones.Hips.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(0,0,1),(defender?-.35:.28)*fall));body.updateMatrixWorld(true);
      for(const [side,sign]of [['Left',1],['Right',-1]])solve([side+'UpLeg',side+'Leg',side+'Foot'],v(sign*.19,footHeight,-.65*fall),v(sign*.25,.30,-.15),true);
    }
    if(defender){
      const reaching=actor.lunge>0||fall>0;
      if(reaching)for(const [side,sign]of [['Left',1],['Right',-1]])solve([side+'Arm',side+'ForeArm',side+'Hand'],v(sign*.32,T.MathUtils.lerp(.92,.40,fall),.52),v(sign*.50,.65,.20));
      if(actor.stumble>0&&!fall){bones.Spine.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(0,0,1),Math.sin(actor.stumble*10)*.18));for(const [side,sign]of [['Left',1],['Right',-1]])solve([side+'Arm',side+'ForeArm',side+'Hand'],v(sign*.65,1.12,.15),v(sign*.6,.9,.1));}
    }else{
      if(state.move==='juke'&&age<.55)bones.Spine.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(0,0,1),state.moveSide*.25*Math.sin(Math.PI*Math.min(1,age/.55))));
      body.updateMatrixWorld(true);
      const exchange=state.phase==='idle'||state.phase==='preview'||state.phase==='handoff';
      const target=exchange?v(.12,1.05,.38):v(-.17,T.MathUtils.lerp(1.06,.35,fall),T.MathUtils.lerp(.18,.50,fall));
      const tuck=T.MathUtils.smoothstep(state.clock,0,.25);if(!exchange&&!fall)target.lerpVectors(v(.12,1.05,.38),target,tuck);
      solve(['RightArm','RightForeArm','RightHand'],target,v(-.42,T.MathUtils.lerp(.86,.3,fall),.08));
      if(exchange||tuck<1)solve(['LeftArm','LeftForeArm','LeftHand'],v(.24,1.05,.38).lerp(position(bones.LeftHand),exchange?0:tuck),v(.46,.9,.10));
      if(state.move==='stiff'&&age<.65&&!fall){const reach=Math.sin(Math.PI*Math.min(1,age/.65));solve(['LeftArm','LeftForeArm','LeftHand'],v(.26,1.20,.25+reach*.55),v(.43,1.04,.34));}
      if(state.move==='spin'&&age<.65&&!fall)solve(['LeftArm','LeftForeArm','LeftHand'],v(.20,1.10,.20),v(.4,.91,.10));
    }
    root.updateMatrixWorld(true);return palm('Right');
  }
  function poseHandoff(released=false){
    root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);reset();bones.Hips.position.y=.92/sourceScale;body.updateMatrixWorld(true);
    for(const [side,sign]of [['Left',1],['Right',-1]]){
      solve([side+'UpLeg',side+'Leg',side+'Foot'],v(sign*.16,footHeight,0),v(sign*.20,.40,.30),true);
      solve([side+'Arm',side+'ForeArm',side+'Hand'],released?v(sign*.26,.83,.08):v(sign*.10,1.05,.58),v(sign*.36,.88,.25));
    }
    root.updateMatrixWorld(true);return palm('Left').add(palm('Right')).multiplyScalar(.5);
  }
  function poseQuarterback(t){
    root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);reset();
    const wind=T.MathUtils.smoothstep(t,-.22,0),follow=T.MathUtils.smoothstep(t,0,.35);
    solve(['RightArm','RightForeArm','RightHand'],v(.16,1.28+wind*.4-follow*.35,.32-wind*.4+follow*.8),v(.5,1.45,0));
    solve(['LeftArm','LeftForeArm','LeftHand'],v(-.04-wind*.16,1.28-wind*.13,.32),v(-.4,1.1,.1));
    for(const side of ['Left','Right'])for(const finger of ['Index','Middle','Ring','Pinky'])for(let joint=1;joint<=3;joint++){
      const bone=bones[side+'Hand'+finger+joint];if(bone)bone.quaternion.multiply(new T.Quaternion().setFromAxisAngle(v(1,0,0),joint===1?.35:.75));
    }
    root.updateMatrixWorld(true);
    // Palm/finger grip, offset inward by the football's minor radius.
    const grip=palm('Right'),inward=palm('Left').sub(grip).normalize();
    return grip.addScaledVector(inward,.075);
  }
  function poseCreator(build){
    root.position.set(0,0,0);root.rotation.set(0,0,0);reset();
    for(const bone of Object.values(bones))bone.scale.set(1,1,1);
    const arm=.82+(build.armSize??50)*.0036,leg=.85+(build.legSize??50)*.003;
    for(const side of ['Left','Right']){bones[side+'Arm'].scale.set(arm,1,arm);bones[side+'UpLeg'].scale.set(leg,1,leg);}
    bones.Spine2.scale.x=.9+(build.shoulderWidth??50)*.002;
    body.updateMatrixWorld(true);
    const height=T.MathUtils.clamp((build.heightInches||72)/72,.91,1.12);
    for(const [side,sign]of [['Left',1],['Right',-1]]){
      solve([side+'UpLeg',side+'Leg',side+'Foot'],v(sign*.14,footHeight*height,.015),v(sign*.16,.5*height,.4),true);
      solve([side+'Arm',side+'ForeArm',side+'Hand'],v(sign*(.29+(build.shoulderWidth??50)*.0006),.88*height,.05),v(sign*.47,1.12*height,-.08));
    }
    root.updateMatrixWorld(true);
  }
  pose(0,0,true);
  return {root,pose,poseCreator,poseJump,poseBench,poseShuttleTurn,poseReceiver,poseDefender,poseRB,poseHandoff,poseQuarterback,setAthlete,dispose(){appearance.dispose();mixer.stopAllAction();mixer.uncacheRoot(body);const images=new Set();body.traverse(o=>{o.skeleton?.dispose();for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)for(const value of Object.values(m))if(value?.isTexture&&value.image)images.add(value.image);});for(const image of images)image.close?.();}};
}
