// Follow position only after the receiver leaves a stable screen-space region.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function newRouteCamera(route,portrait){return {x:portrait?clamp(route.points.at(-1)[0]*.25,-2,2):0,z:0};}
export function stepRouteCamera(anchor,state,dt){
 if(state.phase==='idle'||state.phase==='preview'||state.phase==='result')return anchor;
 const a=1-Math.exp(-Math.max(0,Math.min(.1,dt))*6);
 const dx=state.x-anchor.x,dz=state.z-anchor.z;
 anchor.x+=(dx-clamp(dx,-1.5,1.5))*a;
 anchor.z+=(dz-clamp(dz,-2.5,3.5))*a;
 return anchor;
}
