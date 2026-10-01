import assert from 'node:assert/strict';
import {actionFrame,interceptPoint} from '../public/play-moment-3d/field-awareness.js';
import {fullSession,fullInitialDrive,fullCpuResult} from '../public/play-moment-3d/five-minute.js';
import {miniGameFromSearch} from '../public/play-moment-3d/mini-games.js';
for(const points of [[[0,0,30],[0,2.2,30],[15,2.2,58]],[[0,1,75],[0,1,18],[18,20,45]],[[24,1,90],[-20,2.2,70]]])for(const aspect of [1.77,2.16]){
 const {eye,target,fov}=actionFrame(points,aspect),tan=Math.tan(fov*Math.PI/360),len=Math.hypot(target[1]-eye[1],target[2]-eye[2]),fy=(target[1]-eye[1])/len,fz=(target[2]-eye[2])/len;
 for(const p of points){const x=p[0]-eye[0],y=p[1]-eye[1],z=p[2]-eye[2],depth=y*fy+z*fz;assert(depth>0);assert(Math.abs(x/(depth*tan*aspect))<.81);const vertical=(y*fz-z*fy)/(depth*tan);assert(vertical<.59&&vertical>-.79);assert(eye[1]<15,'Keep the camera near the field');}
}
const runner={x:0,z:40,vx:0,vz:8},defender={x:-10,z:55};const target=interceptPoint(defender,runner,9);assert(target.z>runner.z+4);
const timeToTackle=intercept=>{const r={...runner},d={...defender};for(let t=0;t<8;t+=.016){const p=intercept?interceptPoint(d,r,9):r,dx=p.x-d.x,dz=p.z-d.z,n=Math.hypot(dx,dz)||1;d.x+=dx/n*9*.016;d.z+=dz/n*9*.016;r.z+=8*.016;if(Math.hypot(r.x-d.x,r.z-d.z)<1)return t;}return 8;};assert(timeToTackle(true)<timeToTackle(false),'Taking an intercept closes the runner sooner than trailing him');
const config=miniGameFromSearch('?mode=five-minute&team=JCY&opponent=OKC');
for(const seconds of [2.5,6,12]){const s=fullSession('five-minute',true),d=fullInitialDrive();s.possession='away';fullCpuResult(s,d,config,{live:true,gain:4,seconds});assert.equal(d.clock,300-seconds);}
console.log('PASS framing bounds at phone aspect ratios, pursuit intercept and exact live-play clock accounting.');
