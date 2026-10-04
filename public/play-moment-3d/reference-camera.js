// Track play position separately from camera distance. Fast ball/player travel
// must not turn into an equally fast zoom when possession changes.
function approach(current,desired,dt,rate,maxSpeed){
 const delta=desired.map((v,i)=>v-current[i]),distance=Math.hypot(...delta),blend=Math.min(1-Math.exp(-rate*dt),maxSpeed*dt/Math.max(distance,.001));
 return current.map((v,i)=>v+delta[i]*blend);
}
export function referenceCameraTravel(eye,target,desiredEye,desiredTarget,dt){
 dt=Math.max(0,Math.min(Number(dt)||0,.1));
 const aim=approach(target,desiredTarget,dt,8,42);
 const boom=eye.map((v,i)=>v-target[i]),desiredBoom=desiredEye.map((v,i)=>v-desiredTarget[i]);
 const nextBoom=approach(boom,desiredBoom,dt,4.5,7);
 return{eye:aim.map((v,i)=>v+nextBoom[i]),target:aim};
}
