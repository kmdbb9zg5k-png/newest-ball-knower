import * as T from 'three';

// One left/right stride in model-space metres. Contact motion has exactly
// the opposite ground speed; the airborne recovery clears the planted leg.
export const SPRINT_CYCLE_DISTANCE = 4.3;
export const SPRINT_CONTACT = .165;
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
  const keys=[[.28-SPRINT_CYCLE_DISTANCE*SPRINT_CONTACT,0],[-.48,.32],[.37,.25],[.28,0]];
  const slopes=[[-SPRINT_CYCLE_DISTANCE*(1-SPRINT_CONTACT),0],[1.1,.4],[.6,-.7],[-SPRINT_CYCLE_DISTANCE*(1-SPRINT_CONTACT),0]];
  function recovery(u){
    const stops=[0,.34,.70,1];let i=0;while(i<2&&u>stops[i+1])i++;
    const span=stops[i+1]-stops[i],t=(u-stops[i])/span,t2=t*t,t3=t2*t;
    return [0,1].map(k=>(2*t3-3*t2+1)*keys[i][k]+(t3-2*t2+t)*span*slopes[i][k]+(-2*t3+3*t2)*keys[i+1][k]+(t3-t2)*span*slopes[i+1][k]);
  }
  function makeFrame(phase){
    reset();
    const swing=Math.sin(TAU*phase),pitch=.18+.018*Math.sin(2*TAU*phase);
    // Compress over each support foot and rise through flight, rather than
    // holding a permanent crouch. Small opposing trunk motion relaxes the gait.
    bones.Hips.position.y=bind.Hips.p.y-.062-.018*Math.cos(2*TAU*(phase-.08));
    bones.Hips.quaternion.copy(new T.Quaternion().setFromEuler(new T.Euler(pitch,.055*swing,.018*swing))).multiply(bind.Hips.q);
    bones.Spine1.quaternion.copy(bind.Spine1.q).multiply(new T.Quaternion().setFromEuler(new T.Euler(.016*Math.sin(2*TAU*phase),-.105*swing,-.033*swing)));
    bones.Head.quaternion.copy(bind.Head.q).multiply(new T.Quaternion().setFromAxisAngle(vec(0,1,0),.035*swing));update();
    for(const [side,offset,sign] of [['Left',0,1],['Right',.5,-1]]){
      const p=(phase+offset)%1;
      let z,y;
      if(p<SPRINT_CONTACT){z=.28-SPRINT_CYCLE_DISTANCE*p;y=0;}
      else [z,y]=recovery((p-SPRINT_CONTACT)/(1-SPRINT_CONTACT));
      const foot=bones[side+'Foot'];
      solve(bones[side+'UpLeg'],bones[side+'Leg'],foot,vec(sign*.105,ankleY+y,z),vec(sign*.11,.65,1));
      const lift=p<SPRINT_CONTACT?0:Math.sin(Math.PI*(p-SPRINT_CONTACT)/(1-SPRINT_CONTACT));
      const q=new T.Quaternion().setFromAxisAngle(vec(1,0,0),-.25*lift).multiply(footQ[side]);
      foot.quaternion.copy(rotation(foot.parent).invert().multiply(q));update();
      // Arm drive opposes the same-side leg; elbows remain flexed throughout.
      arm(side,-.88*Math.cos(TAU*(p-.075)),Math.PI/2-.28*Math.cos(TAU*(p-.025)));
    }
    return capture();
  }
  const frames=Array.from({length:count},(_,i)=>makeFrame(i/count));
  reset();
  return {
    rest,
    sample(phase,effort=1){
      const t=((phase%1)+1)%1*count,i=Math.floor(t),alpha=t-i,a=frames[i],b=frames[(i+1)%count];
      for(const name of names){const bone=bones[name];bone.position.lerpVectors(a[name].p,b[name].p,alpha);bone.quaternion.slerpQuaternions(a[name].q,b[name].q,alpha);
        if(effort<1){bone.position.lerp(rest[name].p,1-effort);bone.quaternion.slerp(rest[name].q,1-effort);}
      }
    }
  };
}
