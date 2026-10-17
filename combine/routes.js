// Metres and active seconds. Input is screen-relative; camera looks down +Z.
export const ROUTES=[
 {name:'SLANT RIGHT',tip:'Run straight, then cut diagonally right.',points:[[0,0],[0,5],[-4,9]]},
 {name:'OUT LEFT',tip:'Push upfield, then make a sharp left cut.',points:[[0,0],[0,7],[4,7]]},
 {name:'CURL',tip:'Run upfield, then turn back toward the quarterback.',points:[[0,0],[0,10],[0,7.5]]},
 {name:'DRAG RIGHT',tip:'Short stem, then run across the field to your right.',points:[[0,0],[0,3],[-6,3]]},
 {name:'GO',tip:'Sprint straight upfield and track the deep ball.',points:[[0,0],[0,16]]}
];
export const ROUTE_KEY='bk-receiver-routes-v1';
export const FLIGHT=1.3;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const routeLength=r=>r.points.slice(1).reduce((d,p,i)=>d+Math.hypot(p[0]-r.points[i][0],p[1]-r.points[i][1]),0);
export function newRoute(athlete,index=0){const route=ROUTES[index];const speed=4.8;return {athlete,index,route,speed,phase:'idle',preview:5,clock:0,x:0,z:0,vx:0,vz:0,distance:0,heading:0,throwAt:routeLength(route)/speed+.28-FLIGHT,arrival:routeLength(route)/speed+.28,catchAt:null,checkpoint:1,pathError:0,samples:0,result:null,settle:0};}
export function startRoute(s){if(s.phase==='idle')s.phase='preview';}
export function catchRoute(s){if(s.phase!=='flight'||s.catchAt!==null)return false;s.catchAt=s.clock;return true;}
function pathDistance(s){let best=Infinity;for(let i=1;i<s.route.points.length;i++){const [ax,az]=s.route.points[i-1],[bx,bz]=s.route.points[i],dx=bx-ax,dz=bz-az;const t=clamp(((s.x-ax)*dx+(s.z-az)*dz)/(dx*dx+dz*dz),0,1);best=Math.min(best,Math.hypot(s.x-ax-t*dx,s.z-az-t*dz));}return best;}
export function stepRoute(s,dt,input={x:0,y:0}){
 if(!Number.isFinite(dt)||dt<=0)return;
 let left=dt;while(left>1e-8){const h=Math.min(left,1/120);left-=h;
  if(s.phase==='idle'||s.phase==='result')return;
  if(s.phase==='preview'){s.preview=Math.max(0,s.preview-h);if(s.preview<1e-8)s.phase='running';continue;}
  if(s.phase==='settle'){s.settle+=h;if(s.settle>=1)s.phase='result';continue;}
  s.clock+=h;const ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0,n=Math.max(1,Math.hypot(ix,iy));
  const blend=1-Math.exp(-h*16);s.vx+=(-ix/n*s.speed-s.vx)*blend;s.vz+=(-iy/n*s.speed-s.vz)*blend;
  const px=s.x,pz=s.z;s.x=clamp(s.x+s.vx*h,-8,8);s.z=clamp(s.z+s.vz*h,-1,20);s.distance+=Math.hypot(s.x-px,s.z-pz);
  if(Math.hypot(s.vx,s.vz)>.1)s.heading=Math.atan2(s.vx,s.vz);
  const point=s.route.points[s.checkpoint];if(point&&Math.hypot(s.x-point[0],s.z-point[1])<1.05)s.checkpoint++;
  s.pathError+=pathDistance(s)*h;s.samples+=h;
  if(s.phase==='running'&&s.clock>=s.throwAt)s.phase='flight';
  if(s.clock>=s.arrival){
   const end=s.route.points.at(-1),error=Math.hypot(s.x-end[0],s.z-end[1]);
   const timing=s.catchAt===null?Infinity:Math.abs(s.arrival-s.catchAt);const caught=error<=1.05&&timing<=.24;
   const routeScore=Math.round(100*(.5*clamp(1-s.pathError/Math.max(.001,s.samples)/2.5,0,1)+.5*(s.checkpoint-1)/(s.route.points.length-1)));
   s.result={name:s.route.name,caught,routeScore,timing:timing===Infinity?null:Math.round(timing*1000),reason:caught?'CLEAN CATCH':error>1.05?'OFF TARGET':s.catchAt===null?'NO CATCH ATTEMPT':'EARLY HANDS',score:Math.round(routeScore*.5+(caught?50:0))};s.phase='settle';s.vx=s.vz=0;
  }
 }
}
export function readRouteScores(){try{const a=JSON.parse(localStorage.getItem(ROUTE_KEY)||'[]');return Array.isArray(a)?a.filter(r=>r&&typeof r.playerId==='string'&&Number.isFinite(r.score)&&r.score>=0&&r.score<=100).slice(-100):[];}catch{return [];}}
export function saveRouteScore(athlete,results){try{const rows=readRouteScores();rows.push({playerId:athlete.id,score:Math.round(results.reduce((n,r)=>n+r.score,0)/results.length),catches:results.filter(r=>r.caught).length,date:Date.now()});localStorage.setItem(ROUTE_KEY,JSON.stringify(rows.slice(-100)));return true;}catch{return false;}}
