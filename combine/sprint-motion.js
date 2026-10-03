import launchCapture from './captured-launch.json' with {type:'json'};
import captured from './captured-sprint.json' with {type:'json'};
import * as T from 'three';

// One left/right stride in model-space metres. Contact motion has exactly
// the opposite ground speed; the airborne recovery clears the planted leg.
export const SPRINT_CYCLE_DISTANCE = captured.cycleDistance;
export const WALK_CYCLE_DISTANCE = 1.65;
const TAU = Math.PI * 2;
const vec = (x=0,y=0,z=0) => new T.Vector3(x,y,z);

export function createSprintMotion(body, bones, bind) {
  const names=Object.keys(bones), count=96;
  const world=o=>o.getWorldPosition(vec());
  const rotation=o=>o.getWorldQuaternion(new T.Quaternion());
  const update=()=>body.updateMatrixWorld(true);
  const reset=()=>{for(const name of names){bones[name].position.copy(bind[name].p);bones[name].quaternion.copy(bind[name].q);}update();};
  const capture=()=>Object.fromEntries(names.map(name=>[name,{p:bones[name].position.clone(),q:bones[name].quaternion.clone()}]));
  function aim(a,b,target){
    const from=world(b).sub(world(a)).normalize(),to=target.clone().sub(world(a)).normalize();
    const q=new T.Quaternion().setFromUnitVectors(from,to).multiply(rotation(a));
    a.quaternion.copy(rotation(a.parent).invert().multiply(q));update();
  }
  function solve(a,b,c,target,pole){
    const origin=world(a),l1=world(b).distanceTo(origin),l2=world(c).distanceTo(world(b));
    const axis=target.clone().sub(origin),d=T.MathUtils.clamp(axis.length(),Math.abs(l1-l2)+.001,l1+l2-.001);axis.normalize();
    const bend=pole.clone().sub(origin);bend.addScaledVector(axis,-bend.dot(axis)).normalize();
    const along=(l1*l1-l2*l2+d*d)/(2*d);
    const joint=origin.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
    aim(a,b,joint);aim(b,c,origin.clone().addScaledVector(axis,d));
  }
  reset();
  const footQ=Object.fromEntries(['Left','Right'].map(s=>[s,rotation(bones[s+'Foot'])]));
  const ankleY=(world(bones.LeftFoot).y+world(bones.RightFoot).y)/2;
  function arm(side,angle,bend=Math.PI/2){
    const sign=side==='Left'?1:-1,a=bones[side+'Arm'],b=bones[side+'ForeArm'],c=bones[side+'Hand'];
    const shoulder=world(a),l1=world(b).distanceTo(shoulder),l2=world(c).distanceTo(world(b));
    const elbow=shoulder.clone().add(vec(sign*.018,-l1*Math.cos(angle),l1*Math.sin(angle)));
    aim(a,b,elbow);
    const wrist=world(b).add(vec(0,-l2*Math.cos(angle+bend),l2*Math.sin(angle+bend)));
    aim(b,c,wrist);
    const tip=bones[side+'HandMiddle4'];
    if(tip)aim(c,tip,world(c).add(world(c).sub(world(b)).normalize().multiplyScalar(.12)));
  }
  // A relaxed standing pose, including the torso, shoulders and arms.
  reset();
  for(const side of ['Left','Right'])arm(side,-.03,.15);
  const rest=capture();
  function makeWalkFrame(phase){
    reset();
    const swing=Math.sin(TAU*phase),pitch=.04+.018*Math.sin(2*TAU*phase);
    // Compress over each support foot and rise through flight, rather than
    // holding a permanent crouch. Small opposing trunk motion relaxes the gait.
    bones.Hips.position.y=bind.Hips.p.y-.025-.009*Math.cos(2*TAU*(phase-.08));
    bones.Hips.quaternion.copy(new T.Quaternion().setFromEuler(new T.Euler(pitch,.055*swing,.018*swing))).multiply(bind.Hips.q);
    bones.Spine1.quaternion.copy(bind.Spine1.q).multiply(new T.Quaternion().setFromEuler(new T.Euler(.016*Math.sin(2*TAU*phase),-.105*swing,-.033*swing)));
    bones.Head.quaternion.copy(bind.Head.q).multiply(new T.Quaternion().setFromAxisAngle(vec(0,1,0),.035*swing));update();
    for(const [side,offset,sign] of [['Left',0,1],['Right',.5,-1]]){
      const p=(phase+offset)%1;
      let z,y;
      const contact=.6;
      if(p<contact){z=.495-WALK_CYCLE_DISTANCE*p;y=0;}
      else{const u=(p-contact)/(1-contact);z=-.495+.99*(u*u*(3-2*u));y=.085*Math.sin(Math.PI*u)**2;}
      const foot=bones[side+'Foot'];
      solve(bones[side+'UpLeg'],bones[side+'Leg'],foot,vec(sign*.105,ankleY+y,z),vec(sign*.11,.65,1));
      const lift=p<contact?0:Math.sin(Math.PI*(p-contact)/(1-contact));
      const q=new T.Quaternion().setFromAxisAngle(vec(1,0,0),-.20*lift).multiply(footQ[side]);
      foot.quaternion.copy(rotation(foot.parent).invert().multiply(q));update();
      // Arm drive opposes the same-side leg; elbows remain flexed throughout.
      arm(side,-.32*Math.cos(TAU*(p-.075)),.35);
    }
    return capture();
  }
  const frames=Array.from({length:count},(_,i)=>Object.fromEntries(captured.names.map((n,j)=>[n,{p:new T.Vector3().fromArray(captured.frames[i][j]),q:new T.Quaternion().fromArray(captured.frames[i][j],3).normalize()}])));
  const launchFrames=launchCapture.frames.map(frame=>Object.fromEntries(launchCapture.names.map((n,j)=>[n,{p:new T.Vector3().fromArray(frame[j]),q:new T.Quaternion().fromArray(frame[j],3).normalize()}])));
  const walkFrames=Array.from({length:count},(_,i)=>makeWalkFrame(i/count));
  const q=new T.Quaternion(),p=vec();
  reset();
  return {
    rest,
    sample(phase,effort=1,walk=0,launchTime=Infinity){
      const t=((phase%1)+1)%1*count,i=Math.floor(t),alpha=t-i,a=frames[i],b=frames[(i+1)%count];
      for(const name of names){const bone=bones[name];bone.position.lerpVectors(a[name].p,b[name].p,alpha);bone.quaternion.slerpQuaternions(a[name].q,b[name].q,alpha);
        for(const [bank,weight] of [[walkFrames,walk]])if(weight>0){p.lerpVectors(bank[i][name].p,bank[(i+1)%count][name].p,alpha);q.slerpQuaternions(bank[i][name].q,bank[(i+1)%count][name].q,alpha);bone.position.lerp(p,weight);bone.quaternion.slerp(q,weight);}
        if(launchTime<launchCapture.end){const t=T.MathUtils.clamp(launchTime/launchCapture.end,0,1)*(launchFrames.length-1),li=Math.floor(t),la=launchFrames[li],lb=launchFrames[Math.min(li+1,launchFrames.length-1)],weight=1-T.MathUtils.smoothstep(launchTime,launchCapture.end*.55,launchCapture.end);p.lerpVectors(la[name].p,lb[name].p,t-li);q.slerpQuaternions(la[name].q,lb[name].q,t-li);bone.position.lerp(p,weight);bone.quaternion.slerp(q,weight);}
        if(effort<1){bone.position.lerp(rest[name].p,1-effort);bone.quaternion.slerp(rest[name].q,1-effort);}
      }
      // Quaternion blends between gaits can shorten support-leg height.
      // Correct penetration only; preserve airborne height and sprint contacts.
      if(walk>0&&walk<1){
        update();
        const floor=body.localToWorld(vec(0,ankleY,0)).y;
        const gap=floor-Math.min(world(bones.LeftFoot).y,world(bones.RightFoot).y);
        if(gap>0)bones.Hips.position.y+=gap/bones.Hips.parent.getWorldScale(vec()).y;
      }
    }
  };
}
