import assert from 'node:assert/strict';
import {ROUTES,newRoute,startRoute,stepRoute,catchRoute,readRouteScores,saveRouteScore} from '../combine/routes.js';
const athlete={id:'test',name:'Test',position:'WR'};
for(const fps of [15,30,60,120])for(let index=0;index<5;index++){
 const s=newRoute(athlete,index);startRoute(s);stepRoute(s,4.9,{x:1,y:-1});assert.equal(s.x,0);assert.equal(s.z,0);assert.equal(s.phase,'preview');assert.equal(catchRoute(s),false);stepRoute(s,.1);assert.equal(s.phase,'running');
 let point=1;for(let n=0;n<fps*12&&s.phase!=='result';n++){
  let target=ROUTES[index].points[point];if(Math.hypot(s.x-target[0],s.z-target[1])<.12&&point<ROUTES[index].points.length-1)target=ROUTES[index].points[++point];
  const dx=target[0]-s.x,dz=target[1]-s.z,d=Math.hypot(dx,dz);const control={x:-dx/Math.max(d,.3),y:-dz/Math.max(d,.3)};
  if(s.phase==='flight'&&s.arrival-s.clock<.14)catchRoute(s);
  stepRoute(s,1/fps,control);
 }
 assert.equal(s.phase,'result');assert(s.result.caught,JSON.stringify({fps,index,result:s.result,x:s.x,z:s.z}));assert(s.result.routeScore>=90);assert.equal(catchRoute(s),false);
}
for(const type of ['idle','early','no-tap']){const s=newRoute(athlete,4);startRoute(s);stepRoute(s,5);while(s.phase!=='result'){if(type==='early'&&s.phase==='flight')catchRoute(s);stepRoute(s,.01,type==='idle'?{x:0,y:0}:{x:0,y:-1});}assert.equal(s.result.caught,false);}
const s=newRoute(athlete);startRoute(s);stepRoute(s,5);stepRoute(s,.2,{x:1,y:-1});assert(Math.hypot(s.vx,s.vz)<=s.speed);stepRoute(s,NaN);assert(Number.isFinite(s.x));
globalThis.localStorage={getItem:()=>'{bad',setItem(){throw Error('blocked')}};assert.deepEqual(readRouteScores(),[]);assert.equal(saveRouteScore(athlete,[{score:50,caught:false}]),false);
console.log('PASS five routes at 15–120 Hz, exact frozen preview, manual movement, catch gating, clean catches, early/off-target/missed catches, scoring and blocked storage');
let storage='[]';globalThis.localStorage={getItem:()=>storage,setItem:(key,value)=>{storage=value;}};assert(saveRouteScore(athlete,ROUTES.map(r=>({score:100,caught:true}))));assert.equal(readRouteScores()[0].score,100);assert.equal(readRouteScores()[0].catches,5);console.log('PASS five-route session persistence');
