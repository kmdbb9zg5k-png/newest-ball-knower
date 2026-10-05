import {interceptPoint} from './field-awareness.js?v=contact-camera-11';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

/** Close on the catch point during flight, then take distinct pursuit lanes.
 * Nearby defenders retain direct access to contact; spacing never repels them
 * from the runner or changes their ratings-derived speed.
 */
export function pursuitLane(defender,runner,defenders,speed,landing=null){
 if(landing)return{x:landing[0],z:landing[2]};
 const aim=interceptPoint(defender,runner,speed),gap=Math.hypot(runner.x-defender.x,runner.z-defender.z);
 if(gap<2.2)return aim;
 const vx=runner.vx||0,vz=runner.vz||0,length=Math.hypot(vx,vz)||1,rx=vz/length,rz=-vx/length;
 let spread=0;
 for(const other of defenders){
  if(other===defender||other.fallen||other.engaged)continue;
  const dx=defender.x-other.x,dz=defender.z-other.z,d=Math.hypot(dx,dz);
  if(d>0&&d<2.5)spread+=(dx*rx+dz*rz>=0?1:-1)*(2.5-d)*.55;
 }
 const side=(defender.x-runner.x)*rx+(defender.z-runner.z)*rz;
 const contain=clamp(side*.14,-1.1,1.1)*clamp((gap-3)/7,0,1);
 return{x:clamp(aim.x+rx*(contain+clamp(spread,-1.1,1.1)),-26,26),z:clamp(aim.z+rz*(contain+clamp(spread,-1.1,1.1)),0,110)};
}
