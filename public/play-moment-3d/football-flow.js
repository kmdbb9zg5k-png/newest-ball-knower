const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Round only the planted break, retaining the route's straight stems and timing.
// The same sampler drives receiver motion and throw prediction.
export function routePoint(path,distance,extend=true){
 let walked=0;const d=Math.max(0,distance);
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(length<1e-6)continue;
  const next=path[i+1]||(extend?[b[0],b[1]+10000]:null),nextLength=next?Math.hypot(next[0]-b[0],next[1]-b[1]):0;
  const radius=Math.min(.85,length*.25,nextLength*.25),corner=walked+length;
  if(radius>0&&d>=corner-radius&&d<=corner+radius){
   const t=(d-corner+radius)/(2*radius),u=1-t;
   return [0,1].map(k=>u*u*(b[k]-(b[k]-a[k])*radius/length)+2*u*t*b[k]+t*t*(b[k]+(next[k]-b[k])*radius/nextLength));
  }
  if(d<=corner){const t=(d-walked)/length;return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]}
  walked=corner;
 }
 const end=path.at(-1)||[0,0];return[end[0],end[1]+(extend?Math.max(0,d-walked):0)];
}

// Defenders read and commit for a short interval; cuts can beat a committed angle.
// This affects intent only. Movement still obeys the actor's speed/acceleration.
export function pursuitRead(defender,runner,aim,time){
 const old=defender.pursuitRead,separation=Math.hypot(runner.x-defender.x,runner.z-defender.z);
 if(!old||old.runnerId!==runner.index||time<old.at||time>=old.until){
  const awareness=clamp(defender.ratings?.awareness??75,35,99);
  const delay=clamp(.10+(100-awareness)*.002+(separation<3?.045:0),.10,.26);
  defender.pursuitRead={runnerId:runner.index,at:time,until:time+delay,x:aim.x,z:aim.z};
 }
 return defender.pursuitRead;
}

// Pocket width/depth respond to leverage and QB position without trapping him.
export function passSetPoint(blocker,rusher,qb,snapZ,elapsed){
 const side=Math.sign(blocker.startX)||1,edge=Math.abs(rusher.startX)>3;
 const disadvantage=clamp(((rusher.ratings?.strength??80)-(blocker.ratings?.strength??80))/30,-1,1);
 return{x:blocker.startX+side*(edge?.35:.08)+clamp(qb.x*.20,-1.15,1.15),
  z:snapZ-.4-Math.min(elapsed*(.45+disadvantage*.10),1.75)-(edge?.65:.04)};
}

// Blend actual approach momentum. A stationary carrier falls with the hit;
// a rear wrap preserves forward progress instead of flipping both bodies.
export function contactImpact(runner,tackler){
 const runnerSpeed=Math.hypot(runner.vx||0,runner.vz||0),defenderSpeed=Math.hypot(tackler.vx||0,tackler.vz||0);
 const weight=clamp((tackler.ratings?.strength??80)/(runner.ratings?.strength??80),.7,1.4)*.42;
 let x=(runner.vx||0)+(tackler.vx||0)*weight,z=(runner.vz||0)+(tackler.vz||0)*weight;
 if(Math.hypot(x,z)<.4){x=runner.x-tackler.x;z=runner.z-tackler.z}
 if(Math.hypot(x,z)<.001){x=Math.sin(runner.heading||0);z=Math.cos(runner.heading||0)}
 const n=Math.hypot(x,z),relative=Math.hypot((runner.vx||0)-(tackler.vx||0),(runner.vz||0)-(tackler.vz||0));
 const side=Math.sign((tackler.x-runner.x)*z-(tackler.z-runner.z)*x)||1;
 const approach=runnerSpeed>.3?((tackler.x-runner.x)*(runner.vx||0)+(tackler.z-runner.z)*(runner.vz||0))/runnerSpeed:0;
 return{x:x/n,z:z/n,side,energy:clamp(relative/13,0,1),variant:approach<-.3?'drag-down':relative>11?'shoulder-hit':defenderSpeed>6&&runnerSpeed>5?'low-wrap':'wrap'};
}

export function pocketSpeedFactor(x,forward=0){
 const t=clamp((Math.abs(x)-3.5)/3.5,0,1),ease=t*t*(3-2*t);
 return(.46+clamp(forward,0,1)*.075)*(1-ease)+ease;
}

// Cap drawing at 60Hz without changing the fixed 60Hz physics clock.
export function renderDue(now,last){return !Number.isFinite(last)||now-last>=1000/60-.5}
