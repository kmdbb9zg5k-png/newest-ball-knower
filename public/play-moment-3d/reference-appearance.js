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
// Shared run phase is integrated from distance by advanceMotion. It remains
// continuous across speed/state changes and does not cycle while stationary.
export function referenceRunPhase(player){
 const phase=Number.isFinite(player.motion?.stridePhase)?player.motion.stridePhase:(player.distance||0)/3.1+(player.index||0)*.437;
 return ((phase%1)+1)%1;
}
