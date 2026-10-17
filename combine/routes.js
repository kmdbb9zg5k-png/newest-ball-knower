// Metres and active seconds. Input is screen-relative; camera looks down +Z.
export const ROUTES=[
 {name:'SLANT RIGHT',tip:'Run straight, then cut diagonally right.',points:[[0,0],[0,5],[-4,9]]},
 {name:'OUT LEFT',tip:'Push upfield, then make a sharp left cut.',points:[[0,0],[0,7],[4,7]]},
 {name:'CURL',tip:'Run upfield, then turn back toward the quarterback.',points:[[0,0],[0,10],[0,7.5]],catchStyle:'low'},
 {name:'DRAG RIGHT',tip:'Short stem, then run across the field to your right.',points:[[0,0],[0,3],[-6,3]]},
 {name:'GO',tip:'Sprint straight upfield and track the deep ball.',points:[[0,0],[0,26]],catchStyle:'shoulder'},
 {name:'DEEP POST',tip:'Push deep, then break diagonally right toward the middle.',points:[[0,0],[0,14],[-7,24]],catchStyle:'high'},
 {name:'DEEP CORNER',tip:'Run deep, then break left toward the sideline.',points:[[0,0],[0,14],[7,24]],catchStyle:'shoulder'},
 {name:'DEEP CROSS',tip:'Push upfield, then cross right on a shallow diagonal.',points:[[0,0],[0,12],[-8,18]],catchStyle:'side'}
];
export const ROUTE_KEY='bk-receiver-routes-v2';
export const FLIGHT=1.3;
export const CATCH_RADIUS=2.4;
export const ROUTE_SIDELINE=16;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const routeLength=r=>r.points.slice(1).reduce((d,p,i)=>d+Math.hypot(p[0]-r.points[i][0],p[1]-r.points[i][1]),0);
export function newRoute(athlete,index=0){
 const route=ROUTES[index],speed=4.8,flight=routeLength(route)>22?1.8:FLIGHT;
 return {athlete,index,route,speed,flight,phase:'idle',preview:5,clock:0,x:0,z:0,vx:0,vz:0,distance:0,heading:0,
  throwAt:Infinity,arrival:Infinity,windupAt:null,deadline:routeLength(route)/speed+8,catchAt:null,catchStyle:route.catchStyle||'chest',
  ballTarget:[...route.points.at(-1)],checkpoint:1,pathError:0,samples:0,result:null,settle:0};
}
export function startRoute(s){if(s.phase==='idle')s.phase='preview';}
export function catchRoute(s){if(s.phase!=='flight'||s.catchAt!==null)return false;s.catchAt=s.clock;return true;}
function pathDistance(s){let best=Infinity;for(let i=1;i<s.route.points.length;i++){const [ax,az]=s.route.points[i-1],[bx,bz]=s.route.points[i],dx=bx-ax,dz=bz-az;const t=clamp(((s.x-ax)*dx+(s.z-az)*dz)/(dx*dx+dz*dz),0,1);best=Math.min(best,Math.hypot(s.x-ax-t*dx,s.z-az-t*dz));}return best;}
export function stepRoute(s,dt,input={x:0,y:0}){
 if(!Number.isFinite(dt)||dt<=0)return;
 let left=dt;while(left>1e-8){const h=Math.min(left,1/120);left-=h;
  if(s.phase==='idle'||s.phase==='result')return;
  if(s.phase==='preview'){s.preview=Math.max(0,s.preview-h);if(s.preview<1e-8)s.phase='running';continue;}
  const settling=s.phase==='settle';
  if(!settling)s.clock+=h;const ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0,n=Math.max(1,Math.hypot(ix,iy));
  const blend=1-Math.exp(-h*16);s.vx+=(-ix/n*s.speed-s.vx)*blend;s.vz+=(-iy/n*s.speed-s.vz)*blend;
  const px=s.x,pz=s.z;s.x=clamp(s.x+s.vx*h,-ROUTE_SIDELINE,ROUTE_SIDELINE);s.z=clamp(s.z+s.vz*h,-1,38);s.distance+=Math.hypot(s.x-px,s.z-pz);
  if(Math.hypot(s.vx,s.vz)>.1)s.heading=Math.atan2(s.vx,s.vz);
  if(settling){s.settle+=h;if(s.settle>=1.2)s.phase='result';continue;}
  const point=s.route.points[s.checkpoint];if(point&&Math.hypot(s.x-point[0],s.z-point[1])<1.6)s.checkpoint++;
  s.pathError+=pathDistance(s)*h;s.samples+=h;
  if(s.phase==='running'){
   const end=s.route.points.at(-1),distance=Math.hypot(s.x-end[0],s.z-end[1]);
   const start=s.route.points.at(-2),dx=end[0]-start[0],dz=end[1]-start[1],length=Math.hypot(dx,dz),ux=dx/length,uz=dz/length;
   const along=(s.x-start[0])*ux+(s.z-start[1])*uz;
   const pace=Math.hypot(s.vx,s.vz);
   // Restore forgiving approach-based throws; route accuracy is scored separately.
   const ready=(s.checkpoint>=s.route.points.length-1||distance<=CATCH_RADIUS)&&distance<=Math.max(1.8,pace*s.flight);
   if(ready&&s.windupAt===null)s.windupAt=s.clock;
   if(s.windupAt!==null&&s.clock>=s.windupAt+.22){
    s.flight=clamp(Math.max(0,length-along)/Math.max(1,pace),1.1,s.flight);
    // Freeze a modest lead at release. The ball never homes toward late input.
    const lead=s.vx*ux+s.vz*uz>0?clamp(along+pace*s.flight-length,0,1.8):0;
    s.ballTarget=[end[0]+ux*lead,end[1]+uz*lead];
    s.throwAt=s.clock;s.arrival=s.clock+s.flight;s.phase='flight';
   }
   else if(s.clock>=s.deadline){s.result={positionError:distance,name:s.route.name,caught:false,routeScore:0,timing:null,reason:'ROUTE TIMEOUT',score:0};s.phase='settle';}
  }
  if(s.clock>=s.arrival){
   const end=s.ballTarget,error=Math.hypot(s.x-end[0],s.z-end[1]);
   const timing=s.catchAt===null?Infinity:Math.abs(s.arrival-s.catchAt);const caught=error<=CATCH_RADIUS&&s.catchAt!==null;
   const routeScore=Math.round(100*(.5*clamp(1-s.pathError/Math.max(.001,s.samples)/2.5,0,1)+.5*(s.checkpoint-1)/(s.route.points.length-1)));
   s.result={positionError:error,name:s.route.name,caught,routeScore,timing:timing===Infinity?null:Math.round(timing*1000),catchStyle:s.catchStyle,reason:caught?'CLEAN CATCH':error>CATCH_RADIUS?'OFF TARGET':'NO CATCH ATTEMPT',score:Math.round(routeScore*.5+(caught?50:0))};s.phase='settle';
  }
 }
}
export function readRouteScores(){try{const a=JSON.parse(localStorage.getItem(ROUTE_KEY)||'[]');return Array.isArray(a)?a.filter(r=>r&&typeof r.playerId==='string'&&Number.isFinite(r.score)&&r.score>=0&&r.score<=100).slice(-100):[];}catch{return [];}}
export function saveRouteScore(athlete,results){try{const rows=readRouteScores();rows.push({playerId:athlete.id,score:Math.round(results.reduce((n,r)=>n+r.score,0)/results.length),catches:results.filter(r=>r.caught).length,date:Date.now()});localStorage.setItem(ROUTE_KEY,JSON.stringify(rows.slice(-100)));return true;}catch{return false;}}
