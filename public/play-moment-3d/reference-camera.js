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

// Start at the offensive chase distance, widening only when the local action
// actually needs it. A distant player must not dictate every defensive shot.
export function referenceActionFrame(points,aspect=2){
 const xs=points.map(p=>p[0]),zs=points.map(p=>p[2]),minZ=Math.min(...zs);
 const target=[(Math.min(...xs)+Math.max(...xs))/2,1.2,(minZ+Math.max(...zs))/2+3];
 const fov=50,tan=Math.tan(fov*Math.PI/360);let setback=7.5,eye;
 for(let i=0;i<40;i++){
  eye=[target[0],5+(setback-7.5)*.16,minZ-setback];
  const dy=target[1]-eye[1],dz=target[2]-eye[2],len=Math.hypot(dy,dz),fy=dy/len,fz=dz/len;
  const fits=points.every(p=>{const x=p[0]-eye[0],y=p[1]-eye[1],z=p[2]-eye[2],depth=y*fy+z*fz,vertical=(y*fz-z*fy)/(depth*tan);return depth>0&&Math.abs(x)<depth*tan*Math.max(.8,aspect)*.8&&vertical<.58&&vertical>-.60;});
  if(fits)break;setback+=1;
 }
 return{eye,target,fov};
}
