/* Fixed-step, presentation-only poses. Never changes gameplay coordinates. */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const damp=(a,b,k,dt)=>lerp(a,b,1-Math.exp(-k*dt));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const TAU=Math.PI*2;
export const bodyTypes={
 OL:{height:1.045,width:1.19,leg:.145,arm:.108},
 DL:{height:1.035,width:1.15,leg:.14,arm:.109},
 QB:{height:1.035,width:.97,leg:.112,arm:.087},
 RB:{height:.955,width:1.035,leg:.127,arm:.096},
 WR:{height:1.01,width:.925,leg:.107,arm:.081},
 TE:{height:1.065,width:1.06,leg:.13,arm:.095},
 LB:{height:1.02,width:1.09,leg:.135,arm:.104},
 DB:{height:.99,width:.95,leg:.111,arm:.086}
};
/* Root-local stance targets. The same targets are mirrored by the player's
   heading, so both teams face the play without changing engine coordinates. */
export const readyStances={
 OL:{pelvis:.57,lean:1.18}, DL:{pelvis:.59,lean:1.25},
 QB:{pelvis:.95,lean:.16}, RB:{pelvis:.82,lean:.53},
 WR:{pelvis:.82,lean:.60}, TE:{pelvis:.81,lean:.58},
 LB:{pelvis:.80,lean:.49}, DB:{pelvis:.84,lean:.44}
};
export function readyHandTarget(role,side){
 if(role==='OL'||role==='DL')return side===1?[.30,.085,.50]:[-.40,.55,.42];
 if(role==='QB')return [side*.16,1.27,.33];
 if(role==='WR')return side===1?[.29,.70,.37]:[-.31,.83,.12];
 if(role==='RB'||role==='TE')return [side*.30,.79,.34];
 return [side*.36,.75,.38];
}
export function advanceMotion(p,dt,phase){
 dt=clamp(Number.isFinite(dt)?dt:0,0,.1);
 const ready=phase==='pre',heavy=p.role==='OL'||p.role==='DL';
 const m=p.motion||(p.motion={x:p.x,z:p.z,heading:p.heading||0,speed:0,run:0,
  ready:ready?1:0,block:0,turn:0,gait:p.index*.43,fall:0,catch:0,throwTime:1,throwing:false});
 const distance=Math.hypot(p.x-m.x,p.z-m.z),delta=Math.atan2(Math.sin((p.heading||0)-m.heading),Math.cos((p.heading||0)-m.heading));
 const speed=dt>0?clamp(distance/dt,0,12):0;
 m.speed=damp(m.speed,speed,12,dt);
 m.run=damp(m.run,!ready&&!p.fallen?clamp(m.speed/4,0,1):0,14,dt);
 m.ready=damp(m.ready,ready?1:0,ready?18:10,dt);
 m.block=damp(m.block,!ready&&p.engaged?1:0,16,dt);
 m.turn=damp(m.turn,dt>0?clamp(delta/dt,-4,4):0,10,dt);
 // Gait advances only with distance, not wall-clock time or a CSS loop.
 m.gait+=distance*TAU/(heavy?2.25:2.75);
 m.fall=damp(m.fall,p.fallen?1:0,10,dt);
 m.catch=damp(m.catch,p.catchT>0?clamp(p.catchT/.20,0,1):0,18,dt);
 if(p.throwT>0&&!m.throwing)m.throwTime=0;
 m.throwing=p.throwT>0;
 m.throwTime=Math.min(1,m.throwTime+dt);
 m.x=p.x;m.z=p.z;m.heading=p.heading||0;
 return m;
}
export function samplePose(p){
 const m=p.motion||advanceMotion(p,0,'pre'),heavy=p.role==='OL'||p.role==='DL';
 const build=bodyTypes[p.role]||bodyTypes.WR;
 const sprint=clamp((m.speed-6.5)/2.7,0,1);
 const stance=readyStances[p.role]||readyStances.WR;
 const squat=(1.02-stance.pelvis)*m.ready+.17*m.block;
 const drive=m.run*(1-.75*m.block)*(1-m.ready);
 const liveLean=lerp(.025,.22+sprint*.10,drive)+.39*m.block;
 const lean=lerp(liveLean,stance.lean,m.ready);
 const throwProgress=clamp(m.throwTime/.46,0,1),throwWeight=m.throwTime<.46?Math.sin(throwProgress*Math.PI):0;
 return {build,pelvis:1.02-squat,lean,turn:clamp(-m.turn*.065,-.24,.24)*drive,
  twist:Math.sin(m.gait)*.055*drive-throwWeight*.20,
  ready:m.ready,block:m.block,drive,sprint,gait:m.gait,fall:m.fall,
  catch:m.catch,throwProgress,throwWeight};
}
export function footTarget(pose,side){
 const u=((pose.gait/TAU+(side===1?.5:0))%1+1)%1;
 const planted=u<.58,progress=planted?u/.58:(u-.58)/.42;
 const amplitude=.43+pose.sprint*.07;
 const z=planted?lerp(amplitude,-amplitude,progress):lerp(-amplitude,amplitude,smooth(progress));
 const lift=planted?0:Math.sin(progress*Math.PI)*(.23+.07*pose.sprint);
 const stagger=side===1?-.18:.16;
 return [side*(.14+.08*pose.ready+.035*pose.block),.085+lift*pose.drive,
  z*pose.drive+stagger*pose.ready];
}
/* Solves in local 3D coordinates. Both segments retain their physical length,
   and unreachable targets are clamped instead of stretching the limb. */
export function twoBone(start,end,l1,l2,pole=[0,0,1]){
 const raw=end.map((v,i)=>v-start[i]),length=Math.hypot(...raw)||1e-6;
 const dir=raw.map(v=>v/length),distance=clamp(length,Math.abs(l1-l2)+.001,l1+l2-.001);
 const dot=dir.reduce((s,v,i)=>s+v*pole[i],0);
 let perpendicular=pole.map((v,i)=>v-dir[i]*dot),plen=Math.hypot(...perpendicular);
 if(plen<1e-5){const fallback=Math.abs(dir[0])<.8?[1,0,0]:[0,1,0];const d=dir.reduce((s,v,i)=>s+v*fallback[i],0);perpendicular=fallback.map((v,i)=>v-dir[i]*d);plen=Math.hypot(...perpendicular)}
 const along=(l1*l1-l2*l2+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,l1*l1-along*along));
 return {joint:start.map((v,i)=>v+dir[i]*along+perpendicular[i]/plen*height),end:start.map((v,i)=>v+dir[i]*distance)};
}
