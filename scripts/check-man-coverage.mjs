import assert from 'node:assert/strict';
import {newManRep,newManSession,stepMan,manBall,readManScores,saveManScore,MAN_KEY} from '../combine/man-coverage.js';
import {catchRoute,startRoute,routeFrameDelta,ROUTE_KEY} from '../combine/routes.js';
const athlete={id:'man-qa',name:'QA receiver',position:'WR'},counts={},styles=new Set();
function play(seed,index,hz=60,kind='route'){
 const s=newManRep(athlete,index,newManSession(seed));startRoute(s);stepMan(s,4.9,{x:1,y:1});assert.equal(s.phase,'preview');assert.equal(s.x,0);assert.equal(catchRoute(s),false);stepMan(s,.1);let waypoint=1,dir=[0,1],frames=0,prev=null;
 while(s.phase!=='result'&&frames++<hz*18){
  if(s.phase==='running'){
   if(kind==='route'){let target=s.route.points[waypoint];if(waypoint<s.route.points.length-1&&Math.hypot(s.x-target[0],s.z-target[1])<.35)target=s.route.points[++waypoint];let dx=target[0]-s.x,dz=target[1]-s.z;if(waypoint===s.route.points.length-1){const a=s.route.points.at(-2),b=s.route.points.at(-1);dx=b[0]-a[0];dz=b[1]-a[1];}const n=Math.max(.01,Math.hypot(dx,dz));dir=[dx/n,dz/n];}
   else dir=kind==='idle'?[0,0]:kind==='left'?[1,0]:kind==='back'?[0,-1]:[0,1];
  }
  if(s.phase==='flight'){catchRoute(s);const at=s.catchAt;assert.equal(catchRoute(s),false);assert.equal(s.catchAt,at);}
  const before={x:s.x,z:s.z,dx:s.db.x,dz:s.db.z,phase:s.phase};stepMan(s,1/hz,{x:-dir[0],y:-dir[1]});
  assert(Math.hypot(s.db.x-before.dx,s.db.z-before.dz)<=5.3/hz,'DB teleported/exceeded bounded pace');
  if(['flight','settle'].includes(before.phase)&&s.phase!=='result'&&kind!=='idle')assert(Math.hypot(s.x-before.x,s.z-before.z)>2.5/hz,'WR movement stalled');
  if(s.phase==='flight'&&prev?.phase==='flight')assert.deepEqual(s.ballTarget,prev.target,'Pass homes toward WR');prev={phase:s.phase,target:[...s.ballTarget]};
 }
 assert.equal(s.phase,'result');assert(Number.isFinite(s.throwAt),'No pass');assert(s.throwAt<=s.latestThrowAt+.25);assert(s.result.score>=0&&s.result.score<=100);styles.add(s.db.style);
 if(s.result.intercepted){assert(s.ballContact);assert(s.ballContact[1]<=2.25);assert.equal(s.db.play,1);}
 return s;
}
for(let seed=0;seed<20;seed++)for(let index=0;index<5;index++){const s=play(seed*763+932,index);counts[s.result.reason]=(counts[s.result.reason]||0)+1;}
assert.equal(styles.size,2);assert(counts['CLEAN CATCH']>20&&counts.INTERCEPTED>0&&counts['PASS BROKEN UP']>0,JSON.stringify(counts));
for(const hz of [15,30,120])for(let index=0;index<5;index++)play(932,index,hz);
for(const kind of ['idle','left','back','straight'])for(let index=0;index<5;index++)play(932,index,60,kind);
// The defender cannot read future route data or controller input.
const a=newManRep(athlete,0,newManSession(932)),b=structuredClone(a);a.phase=b.phase='running';b.route={name:'UNSEEN',points:[[0,0],[40,-40]]};
for(let i=0;i<60;i++){stepMan(a,1/60,{x:.4,y:-1});stepMan(b,1/60,{x:.4,y:-1});assert.equal(a.db.x,b.db.x);assert.equal(a.db.z,b.db.z);}
const old={x:a.db.x,z:a.db.z};stepMan(a,1/120,{x:-1,y:0});assert(Math.hypot(a.db.x-old.x,a.db.z-old.z)<.05,'Instant cut mirror');
// No remote interception: put the defender beyond any reachable flight.
const remote=newManRep(athlete,0,newManSession(932));Object.assign(remote,{phase:'flight',clock:2,throwAt:2,arrival:3,flight:1,ballTarget:[0,0],x:0,z:0,catchAt:2});remote.db.x=30;remote.db.z=30;stepMan(remote,1.01);assert(remote.result.caught);assert(!remote.result.intercepted);
// Render stalls consume at most 100ms of the active interaction.
assert.equal(routeFrameDelta(2),.1);assert.equal(routeFrameDelta(Infinity),0);
// Separate records and safe denied/corrupt storage.
const data=new Map([[ROUTE_KEY,'[{"playerId":"pure","score":100}]']]);globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
assert(saveManScore(athlete,[play(932,0).result]));assert.equal(readManScores().length,1);assert.equal(JSON.parse(data.get(ROUTE_KEY))[0].playerId,'pure');data.set(MAN_KEY,'broken');assert.deepEqual(readManScores(),[]);globalThis.localStorage={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};assert.deepEqual(readManScores(),[]);assert.equal(saveManScore(athlete,[]),false);
console.log('PASS 135 reps: 100 randomized route reps, 15 multi-rate reps, 20 stationary/wrong-direction reps; bounded DB movement, physical ball contact, no route mind-reading, guaranteed throws, no WR stops, fixed flight and isolated storage',counts);
