import assert from 'node:assert/strict';
import {ROUTES,newRoute,startRoute,stepRoute,catchRoute,readRouteScores,saveRouteScore} from '../combine/routes.js';
const athlete={id:'test',name:'Test',position:'WR'};
for(const fps of [15,30,60,120])for(let index=0;index<ROUTES.length;index++){
 const s=newRoute(athlete,index);startRoute(s);stepRoute(s,4.9,{x:1,y:-1});assert.equal(s.x,0);assert.equal(s.z,0);assert.equal(s.phase,'preview');assert.equal(catchRoute(s),false);stepRoute(s,.1);assert.equal(s.phase,'running');
 let point=1;for(let n=0;n<fps*20&&s.phase!=='result';n++){
  let target=ROUTES[index].points[point];if(Math.hypot(s.x-target[0],s.z-target[1])<.12&&point<ROUTES[index].points.length-1)target=ROUTES[index].points[++point];
  const dx=target[0]-s.x,dz=target[1]-s.z,d=Math.hypot(dx,dz);const control={x:-dx/Math.max(d,.3),y:-dz/Math.max(d,.3)};
  if(s.phase==='flight'&&s.arrival-s.clock<.14)catchRoute(s);
  stepRoute(s,1/fps,control);
 }
 assert.equal(s.phase,'result');assert(s.result.caught,JSON.stringify({fps,index,result:s.result,x:s.x,z:s.z}));assert(s.result.routeScore>=90);assert.equal(catchRoute(s),false);
}
for(const type of ['idle','no-tap']){const s=newRoute(athlete,4);startRoute(s);stepRoute(s,5);while(s.phase!=='result'){if(type==='early'&&s.phase==='flight')catchRoute(s);stepRoute(s,.01,type==='idle'?{x:0,y:0}:{x:0,y:-1});}assert.equal(s.result.caught,false);}
const s=newRoute(athlete);startRoute(s);stepRoute(s,5);stepRoute(s,.2,{x:1,y:-1});assert(Math.hypot(s.vx,s.vz)<=s.speed);stepRoute(s,NaN);assert(Number.isFinite(s.x));
globalThis.localStorage={getItem:()=>'{bad',setItem(){throw Error('blocked')}};assert.deepEqual(readRouteScores(),[]);assert.equal(saveRouteScore(athlete,[{score:50,caught:false}]),false);
console.log('PASS eight routes at 15–120 Hz, exact frozen preview, manual movement, catch gating, clean catches, off-target/missed catches, scoring and blocked storage');
let storage='[]';globalThis.localStorage={getItem:()=>storage,setItem:(key,value)=>{storage=value;}};assert(saveRouteScore(athlete,ROUTES.map(r=>({score:100,caught:true}))));assert.equal(readRouteScores()[0].score,100);assert.equal(readRouteScores()[0].catches,ROUTES.length);console.log('PASS eight-route session persistence');

// Catch actions and the throw must never cancel manual movement.
const moving=newRoute(athlete,4);startRoute(moving);stepRoute(moving,5);while(moving.phase!=='flight')stepRoute(moving,.01,{x:0,y:-1});const before=moving.z;catchRoute(moving);stepRoute(moving,.2,{x:0,y:-1});assert(moving.z>before+.8);while(moving.phase!=='settle')stepRoute(moving,.01,{x:0,y:-1});const after=moving.z;stepRoute(moving,.2,{x:0,y:-1});assert(moving.z>after+.8);console.log('PASS continuous manual movement through throw, catch input and follow-through');

// Early taps are buffered for the entire flight, including slow analog runs.
for(const index of ROUTES.keys())for(const speed of [.55,1]){
 const s=newRoute(athlete,index);startRoute(s);stepRoute(s,5);let point=1;
 for(let i=0;i<2400&&s.phase!=='result';i++){
  let target=s.route.points[point];if(Math.hypot(s.x-target[0],s.z-target[1])<.15&&point<s.route.points.length-1)target=s.route.points[++point];
  const dx=target[0]-s.x,dz=target[1]-s.z,n=Math.max(.3,Math.hypot(dx,dz));
  if(s.phase==='flight'&&s.catchAt===null){assert(catchRoute(s));assert(s.arrival-s.clock>1);}
  stepRoute(s,1/120,{x:-dx/n*speed,y:-dz/n*speed});
 }
 assert(s.result?.caught,JSON.stringify({index,speed,result:s.result}));
}
const delayed=newRoute(athlete,4);startRoute(delayed);stepRoute(delayed,5);stepRoute(delayed,3);assert.equal(delayed.phase,'running');assert.equal(delayed.result,null);
console.log('PASS early-flight buffered catches on all eight routes at full/55% speed; QB waits for delayed runner');
