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

// Regression: run through lateral targets without releasing the joystick.
for(const index of [1,3,7])for(const fps of [15,60,120]){
 const s=newRoute(athlete,index);startRoute(s);stepRoute(s,5);let point=1,sawFlight=false;
 const end=s.route.points.at(-1),cut=s.route.points.at(-2),dx=end[0]-cut[0],dz=end[1]-cut[1],length=Math.hypot(dx,dz);
 for(let i=0;i<fps*20&&s.phase!=='result';i++){
  let control;
  if(point===1){const p=s.route.points[1],x=p[0]-s.x,z=p[1]-s.z,n=Math.max(.3,Math.hypot(x,z));control={x:-x/n,y:-z/n};if(n<=.3)point=2;}
  else control={x:-dx/length,y:-dz/length};
  if(s.phase==='flight'&&!sawFlight){sawFlight=true;assert(point===2,'QB must wait for the cut');assert((s.vx*dx+s.vz*dz)/length>3,'Receiver must be moving along final leg');catchRoute(s);}
  const before={x:s.x,z:s.z,phase:s.phase};stepRoute(s,1/fps,control);
  if(s.phase!=='result'&&['flight','settle'].includes(before.phase))assert(Math.hypot(s.x-before.x,s.z-before.z)>s.speed/fps*.8,JSON.stringify({issue:'Lateral follow-through stalled',index,fps,before,x:s.x,z:s.z,vx:s.vx,vz:s.vz}));
 }
 assert(sawFlight);assert(s.result.caught,JSON.stringify({index,fps,result:s.result}));assert(Math.abs(s.x)>8,'Test must cross the old invisible boundary');
}
for(const index of [1,3]){const s=newRoute(athlete,index);startRoute(s);stepRoute(s,5);while(s.z<s.route.points[1][1]+1)stepRoute(s,1/120,{x:0,y:-1});assert.equal(s.phase,'running','Proximity on the stem cannot trigger a throw');}
console.log('PASS Out/Drag/Cross full lateral follow-through beyond old bounds at 15/60/120 Hz; no release before the cut');
