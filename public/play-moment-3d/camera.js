/** Guard the field framing without changing the player's preferred lens angle. */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function fieldAlignedFrame(view){
 const target=[clamp(view.target[0],-26.3,26.3),view.target[1],clamp(view.target[2],0,110)];
 const dx=target[0]-view.target[0],dz=target[2]-view.target[2];
 return {eye:[clamp(view.eye[0]+dx,-28,28),view.eye[1],clamp(view.eye[2]+dz,-14,134)],target,
  snapped:Math.abs(dx)+Math.abs(dz)>1e-6};
}

export function newBallCameraRecovery(){return {lost:0,fade:0};}
/** Cheap player-capsule approximation for a ball hidden behind an athlete. */
export function isBallOccluded(eye,ball,actors=[]){
 if(!eye||!ball||![...eye,...ball].every(Number.isFinite))return false;
 const dx=ball[0]-eye[0],dy=ball[1]-eye[1],dz=ball[2]-eye[2],lengthSq=dx*dx+dy*dy+dz*dz;
 if(lengthSq<1e-4)return false;
 return actors.some(actor=>{
  if(actor.fallen||!Number.isFinite(actor.x)||!Number.isFinite(actor.z))return false;
  const t=((actor.x-eye[0])*dx+(1.1-eye[1])*dy+(actor.z-eye[2])*dz)/lengthSq;
  if(t<=.08||t>=.94)return false;
  const px=eye[0]+dx*t,py=eye[1]+dy*t,pz=eye[2]+dz*t;
  return Math.hypot(px-actor.x,pz-actor.z)<.55&&Math.abs(py-1.1)<1.1;
 });
}

/** Pan to a ball only after sustained loss of sight. A faint veil masks the recovery. */
export function recoverBallCamera(state,view,ball,projection,viewport,dt,occluded=false){
 const step=clamp(Number(dt)||0,0,.1);
 if(!ball||!viewport.width||!viewport.height){state.lost=0;state.fade=0;return view;}
 const visible=!occluded&&projection?.visible&&Number.isFinite(projection.x)&&Number.isFinite(projection.y)&&
  projection.x>=16&&projection.x<=viewport.width-16&&projection.y>=65&&projection.y<=viewport.height-25;
 state.lost=visible?Math.max(0,state.lost-step*4):Math.min(1,state.lost+step);
 if(state.lost<.30){state.fade=Math.max(0,state.fade-step*2);return view;}
 state.fade=clamp((state.lost-.30)*.3,0,.18);
 const aim=ball.predicted,desiredX=clamp(aim[0],-25,25),desiredZ=clamp(aim[2],1,109);
 const blend=(1-Math.exp(-step*6))*clamp((state.lost-.30)*3,0,1);
 const dx=(desiredX-view.target[0])*blend,dz=(desiredZ-view.target[2])*blend;
 const shifted={eye:[view.eye[0]+dx,view.eye[1],view.eye[2]+dz],
  target:[view.target[0]+dx,view.target[1],view.target[2]+dz]};
 return fieldAlignedFrame(shifted);
}
