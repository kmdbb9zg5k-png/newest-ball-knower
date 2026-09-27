// One clock for the arm and the actual ball release; flight time is separate.
export const QB_THROW_RELEASE=.42;
export function quarterbackThrowDuration(kind='bullet'){return kind==='lob'?.62:kind==='touch'?.56:.50}
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
/** Right-handed hand/elbow targets relative to the shipped rig's chest. */
export function quarterbackThrowPose(progress,kind='bullet'){
 const t=Math.max(0,Math.min(1,progress)),high=kind==='lob'?.09:kind==='touch'?.035:0;
 const keys=[
  [0,[-.09,-.10,.26],[-.30,-.25,.02]],
  [.25,[-.29,.29+high,-.14],[-.37,.04,-.08]],
  [QB_THROW_RELEASE,[-.18,.40+high,.39],[-.32,.18,.15]],
  [.70,[.10,-.02,.49],[-.20,-.03,.26]],
  [1,[.12,-.23,.27],[-.25,-.27,.09]],
 ];
 const upper=keys.findIndex(k=>k[0]>=t),b=keys[Math.max(1,upper)],a=keys[Math.max(0,upper-1)],w=smooth((t-a[0])/(b[0]-a[0]));
 const mix=(x,y)=>x.map((v,i)=>v+(y[i]-v)*w),load=smooth(t/.25),drive=smooth((t-.22)/.40);
 return{hand:mix(a[1],b[1]),elbow:mix(a[2],b[2]),load,drive};
}
