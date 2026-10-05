const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};

// Reach and establish contact before taking either athlete off his feet.
export function contactFallProgress(p){
 if(p.action==='get-up')return 1-smooth(p.actionT||0);
 if(!p.fallen)return 0;
 if(!/tackle|hit|gang|wrap|slide|dive|pancake/.test(p.action||''))return 1;
 const start=p.action==='big-hit'?.22:p.action==='dive'?.18:.34;
 return smooth(((p.actionT||0)-start)/(.94-start));
}
export function contactFacing(p){
 const end=Number.isFinite(p.fallHeading)?p.fallHeading:p.heading||0;
 if(!p.fallen||!Number.isFinite(p.contactStartHeading))return p.fallen?end:p.heading||0;
 const t=smooth(((p.actionT||0)-.18)/.52),start=p.contactStartHeading;
 return start+Math.atan2(Math.sin(end-start),Math.cos(end-start))*t;
}
export function updateContactTarget(tackler,runner){
 const fall=contactFallProgress(runner),heading=runner.fallHeading??runner.heading??0;
 tackler.contactTarget=[runner.x+Math.sin(heading)*fall*.8,1.12-fall*.76,runner.z+Math.cos(heading)*fall*.8];
}

// A moving exchange: meet the quarterback with a nonzero outgoing tangent,
// then carry that velocity through possession instead of parking at the mesh.
export function handoffRunnerPoint(start,mesh,progress,duration,direction,speed=4.6){
 const pickup=.88,t=clamp(progress,0,1),seconds=Math.max(.1,duration),length=Math.hypot(...direction)||1,v=direction.map(n=>n/length*speed);
 if(t>=pickup)return mesh.map((n,i)=>n+v[i]*(t-pickup)*seconds);
 const u=t/pickup,h=3*u*u-2*u*u*u,tangent=u*u*u-u*u;
 return start.map((n,i)=>n+(mesh[i]-n)*h+v[i]*seconds*pickup*tangent);
}
