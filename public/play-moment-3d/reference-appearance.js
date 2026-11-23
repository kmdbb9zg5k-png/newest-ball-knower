// Material membership follows the rig, not noisy colors in the source atlas.
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
export function referenceGarmentRegions(positions,joints,weights,names,bodyVertices){
 const out=new Float32Array(positions.length/3*4);
 for(let i=0;i<positions.length/3;i++){
  if(i>=bodyVertices){out[i*4+3]=1;continue;}
  const y=positions[i*3+1];let torso=0,arms=0,legs=0;
  for(let c=0;c<4;c++){
   const name=names[joints[i*4+c]]||'',w=weights[i*4+c];
   if(/Spine|Hips|Shoulder/.test(name))torso+=w;
   if(/(?:Left|Right)Arm$/.test(name))arms+=w;
   if(/UpLeg|(?:Left|Right)Leg$|Hips/.test(name))legs+=w;
  }
  // This reference mesh has lowered arms: sleeve ends are defined by height,
  // while skin weights keep adjacent forearms out of the shirt material.
  const jersey=smooth(.25,.75,torso+arms*smooth(1.23,1.31,y))*(1-smooth(1.43,1.48,y))*smooth(.78,.86,y);
  const pants=smooth(.05,.25,legs+torso)*smooth(.14,.19,y)*(1-smooth(.90,.98,y));
  out.set([jersey,pants,Math.max(jersey,pants),0],i*4);
 }
 return out;
}
// Stronger surface smoothing on upper arms and forearms. Fade out at the
// wrists and collar, and keep the existing pad silhouette largely intact.
export function referenceBodySmoothing(positions,garments,armWeights,bodyVertices){
 const out=new Float32Array(positions.length/3);
 for(let i=0;i<bodyVertices;i++){
  const y=positions[i*3+1],j=i*4;
  const hand=Math.max(armWeights[j+2],armWeights[j+3]);
  const arm=smooth(.16,.76,Math.max(armWeights[j],armWeights[j+1]))*(1-smooth(.22,.60,hand))*(1-smooth(1.35,1.46,y));
  const cloth=garments[j+2]*smooth(.29,.45,y)*(1-smooth(1.40,1.48,y));
  out[i]=Math.max(arm,cloth*.46);
 }
 return out;
}

// The reference rig stores rigid inverse bind transforms. Recover the joint
// centers in mesh space, where the shoulder-to-wrist axes are already posed.
function referenceJointCenter(inverseBind,names,name){
 const at=names.indexOf('mixamorig:'+name)*16;
 return [0,4,8].map(k=>-(inverseBind[at+k]*inverseBind[at+12]+
  inverseBind[at+k+1]*inverseBind[at+13]+inverseBind[at+k+2]*inverseBind[at+14]));
}

export function shapeReferenceRoster(positions,source,garments,arms,bodyVertices,inverseBind,names){
 const shaped=new Float32Array(positions),elbowRadials=new Float32Array(positions.length);
 const joints=['Left','Right'].map(side=>['Arm','ForeArm','Hand'].map(joint=>
  referenceJointCenter(inverseBind,names,side+joint)));
 for(let i=0;i<bodyVertices;i++){
  const at=i*3,region=i*4,[x,y,z]=source.subarray(at,at+3),side=x>=0?0:1;
  const [shoulder,elbow,wrist]=joints[side];
  const arm=smooth(.28,.86,arms[region+side])*(1-smooth(.10,.45,arms[region+side+2]));
  const pad=garments[region]*smooth(.12,.215,Math.abs(x))*(1-smooth(.258,.325,Math.abs(x)))*
   smooth(1.245,1.34,y)*(1-smooth(1.40,1.463,y));
  // Round the cap and blend down into the sleeve. Keep neck and cuff clear.
  shaped[at]+=Math.sign(x)*pad*.016;
  shaped[at+1]+=pad*.024;
  shaped[at+2]+=(z-shoulder[2])*pad*.18;
  if(arm===0)continue;

  const [high,low]=y>=elbow[1]?[shoulder,elbow]:[elbow,wrist];
  const fraction=Math.min(1,Math.max(0,(y-low[1])/(high[1]-low[1])));
  const axisX=low[0]+(high[0]-low[0])*fraction,axisZ=low[2]+(high[2]-low[2])*fraction;
  const dx=shaped[at]-axisX,dz=shaped[at+2]-axisZ;
  const upperArm=smooth(1.15,1.235,y)*(1-smooth(1.24,1.335,y));
  const forearm=smooth(.98,1.063,y)*(1-smooth(1.095,1.157,y));
  const fullness=(.19*upperArm+.15*forearm)*arm;
  shaped[at]+=dx*fullness;
  shaped[at+2]+=dz*fullness;

  // Limit bending correction to the elbow cross-section, fading into both
  // shafts and off the sleeve and hand. The shader restores compressed radius.
  const elbowMask=arm*(1-smooth(.024,.090,Math.abs(y-elbow[1])))*(1-garments[region]);
  const scale=Math.min(1,.053/(Math.hypot(dx,dz)||1))*elbowMask;
  elbowRadials[at]=dx*scale;
  elbowRadials[at+2]=dz*scale;
 }
 return {positions:shaped,elbowRadials};
}

// Shared run phase is integrated from distance by advanceMotion. It remains
// continuous across speed/state changes and does not cycle while stationary.
export function referenceRunPhase(player){
 const phase=Number.isFinite(player.motion?.stridePhase)?player.motion.stridePhase:(player.distance||0)/3.1+(player.index||0)*.437;
 return ((phase%1)+1)%1;
}

// Bone membership prevents equipment leaking onto the torso or helmet.
export function referenceGearRegions(positions,joints,weights,names,bodyVertices){
 const arms=new Float32Array(positions.length/3*4),feet=new Float32Array(positions.length/3);
 for(let i=0;i<bodyVertices;i++){
  for(let c=0;c<4;c++){
   const name=names[joints[i*4+c]]||'',w=weights[i*4+c];
   if(/Left(?:Arm|ForeArm|Hand)/.test(name))arms[i*4]+=w;
   if(/Right(?:Arm|ForeArm|Hand)/.test(name))arms[i*4+1]+=w;
   if(/LeftHand/.test(name))arms[i*4+2]+=w;
   if(/RightHand/.test(name))arms[i*4+3]+=w;
   if(/Foot|Toe/.test(name))feet[i]+=w;
  }
  feet[i]*=1-smooth(.10,.15,positions[i*3+1]);
 }
 return {arms,feet};
}
