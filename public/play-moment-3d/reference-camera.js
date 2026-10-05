// Track play position separately from camera distance. Fast ball/player travel
// must not turn into an equally fast zoom when possession changes.
function approach(current,desired,dt,rate,maxSpeed){
 const delta=desired.map((v,i)=>v-current[i]),distance=Math.hypot(...delta),blend=Math.min(1-Math.exp(-rate*dt),maxSpeed*dt/Math.max(distance,.001));
 return current.map((v,i)=>v+delta[i]*blend);
}
export function referenceCameraTravel(eye,target,desiredEye,desiredTarget,dt){
 dt=Math.max(0,Math.min(Number(dt)||0,.1));
 const aim=approach(target,desiredTarget,dt,11,100);
 const boom=eye.map((v,i)=>v-target[i]),desiredBoom=desiredEye.map((v,i)=>v-desiredTarget[i]);
 const nextBoom=approach(boom,desiredBoom,dt,4.5,7);
 return{eye:aim.map((v,i)=>v+nextBoom[i]),target:aim};
}

// A readable formation view. The quarterback and line determine camera scale;
// downfield routes never pull the pocket camera away from the user.
export function referencePocketFrame(qb,snapZ,aspect=2,backZ=qb.z,halfWidth=17,overview=false){
 if(!overview)return {eye:[qb.x*.85,5.8,qb.z-7],target:[qb.x*.85,1.1,qb.z+5.4],fov:58};
 const depth=Math.max(12,snapZ-backZ+7.5),x=qb.x*.72,eye=[x,8,snapZ-depth],target=[x,1.15,snapZ-1];
 const dy=target[1]-eye[1],dz=target[2]-eye[2],length=Math.hypot(dy,dz),lineDepth=(-eye[1])*dy/length+depth*dz/length;
 const fov=Math.max(58,Math.min(70,Math.atan((halfWidth+1.1)/(lineDepth*Math.max(1.6,aspect)*.92))*360/Math.PI));
 return {eye,target,fov};
}
export function referenceCarryFrame(player,direction=1,contact=false){
 // Keep the running lens through contact. A lateral dolly at the whistle
 // looked like a camera snap and changed joystick orientation under the thumb.
 return {eye:[player.x,4.8,player.z-direction*6.6],target:[player.x,contact?.7:.9,player.z+direction*2.4],fov:56};
}

// Offensive-side defense: the camera sits behind the ball, with the controlled
// defender ahead of it. Fit these two athletes, never all 22 or a released QB.
export function referenceDefenseFrame(selected,ball,aspect=2,includeForegroundFeet=false){
 const x=(selected.x+ball.x)/2,near=Math.min(selected.z,ball.z),depth=Math.abs(selected.z-ball.z),width=Math.abs(selected.x-ball.x);
 const long=includeForegroundFeet?1:Math.max(0,Math.min(1,(depth-20)/24)),height=3.8+long,fov=42+14*long;
 const back=Math.max(4.6+2*long,width*.58/(Math.tan(fov*.5*Math.PI/180)*Math.max(1.5,aspect)));
 // At long range, keep the foreground ball and the selected defender readable;
 // the quarterback's feet need not dictate the entire defensive lens.
 const nearHeight=selected.z<=ball.z?0:Math.min(1.2,depth*.12)*(1-long),pitch=(Math.atan2(height-nearHeight,back)+Math.atan2(height-2.15,back+depth))*.5;
 return {eye:[x,height,near-back],target:[x,.9,near-back+(height-.9)/Math.tan(pitch)],fov};
}
