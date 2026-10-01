const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
/** Reach a moving runner's path rather than following his current position. */
export function interceptPoint(defender,runner,speed){
 const dx=runner.x-defender.x,dz=runner.z-defender.z,vx=runner.vx||0,vz=runner.vz||0;
 const a=vx*vx+vz*vz-speed*speed,b=2*(dx*vx+dz*vz),c=dx*dx+dz*dz,disc=b*b-4*a*c;
 let t=Math.sqrt(c)/Math.max(1,speed);
 if(Math.abs(a)<1e-6){if(b<0)t=-c/b;}else if(disc>=0){const roots=[(-b-Math.sqrt(disc))/(2*a),(-b+Math.sqrt(disc))/(2*a)].filter(n=>n>0);if(roots.length)t=Math.min(...roots);}
 t=clamp(t,0,4)*clamp((Math.sqrt(c)-.8)/3,0,1);
 return {x:clamp(runner.x+vx*t,-26,26),z:clamp(runner.z+vz*t,0,110)};
}
/** Fit the ball and selected player inside the playable area below the scoreboard. */
export function actionFrame(points,aspect=2){
 const xs=points.map(p=>p[0]),zs=points.map(p=>p[2]),minZ=Math.min(...zs),maxZ=Math.max(...zs);
 const target=[(Math.min(...xs)+Math.max(...xs))/2,1.5+Math.max(0,...points.map(p=>p[1]-4))*.12,(minZ+maxZ)/2+2];
 const fov=50,tan=Math.tan(fov*Math.PI/360);
 let setback=14,eye;
 for(let i=0;i<40;i++){
  eye=[target[0],7+(setback-14)*.12,minZ-setback];
  const dy=target[1]-eye[1],dz=target[2]-eye[2],len=Math.hypot(dy,dz),fy=dy/len,fz=dz/len;
  const fits=points.every(p=>{const x=p[0]-eye[0],y=p[1]-eye[1],z=p[2]-eye[2],depth=y*fy+z*fz,vertical=(y*fz-z*fy)/(depth*tan);return depth>0&&Math.abs(x)<depth*tan*Math.max(.8,aspect)*.8&&vertical<.58&&vertical>-.78;});
  if(fits)break;setback+=2;
 }
 return {eye,target,fov};
}

/** Clear the end-zone tunnel and the rising front seating rows without a top-down shot. */
export function safeFieldCamera(eye,target){
 const x=clamp(eye[0],-28,28),z=clamp(eye[2],-14,134);
 const outside=Math.max(0,-z,z-120),clearance=outside>0?4.6+outside*.5:0;
 return {eye:[x,Math.max(eye[1],clearance),z],target:[...target]};
}
