import assert from 'node:assert/strict';
import {newDBSession,newDBRep,stepDB,playDBBall,saveDBScore,readDBScores,DB_KEY} from '../combine/db-drill.js';
import {startRoute,ROUTES} from '../combine/routes.js';import {manBall,MAN_KEY} from '../combine/man-coverage.js';
const player={id:'db-qa',name:'Corner',position:'CB'};
function rep(index,strategy='swat',hz=60){
 const session={seed:932,order:[index]},s=newDBRep(player,0,session);startRoute(s);stepDB(s,4.9,{x:1,y:-1});assert.equal(s.phase,'preview');assert.equal(s.db.x,0);assert.equal(s.x,0);assert.equal(playDBBall(s,'swat'),false);stepDB(s,.1);let steps=0,thrown=false,target=null;
 while(s.phase!=='result'&&steps++<hz*18){
  let goal=[s.x,s.z+.45];
  if(s.phase==='flight'){
   thrown=true;if(strategy!=='none')playDBBall(s,strategy==='pick'?'pick':'swat');
   // A normal pursuit policy uses observed movement then the visible landing point.
   goal=[s.ballTarget[0],s.ballTarget[1]-.5];if(target)assert.deepEqual(s.ballTarget,target);target=[...s.ballTarget];
  }
  const dx=goal[0]-s.db.x,dz=goal[1]-s.db.z,n=Math.max(.7,Math.hypot(dx,dz));const input=strategy==='idle'?{x:0,y:0}:strategy==='wrong'?{x:1,y:0}:{x:-dx/n,y:-dz/n};
  const p={x:s.db.x,z:s.db.z,phase:s.phase};stepDB(s,1/hz,input);assert(Math.hypot(s.db.x-p.x,s.db.z-p.z)<5.7/hz,'DB teleported');
  assert(Number.isFinite(s.x)&&Number.isFinite(s.db.x));
 }
 assert(thrown);assert.equal(s.phase,'result');assert(s.result.score>=0&&s.result.score<=100);return s;
}
const outcomes={};for(const strategy of ['swat','pick','none','idle','wrong'])for(let i=0;i<ROUTES.length;i++)for(const hz of [15,60,120]){const s=rep(i,strategy,hz);outcomes[s.result.reason]=(outcomes[s.result.reason]||0)+1;if(['none','idle','wrong'].includes(strategy))assert(!s.result.intercepted);if(strategy==='none')assert(s.result.caught);}
assert(outcomes.INTERCEPTION>0);assert(outcomes['PASS DEFENDED']>0);assert(outcomes['COMPLETION ALLOWED']>0);
// Same WR route regardless of DB joystick; no opponent input mind-reading.
const a=newDBRep(player,0,newDBSession(2)),b=structuredClone(a);a.phase=b.phase='running';for(let i=0;i<120;i++){stepDB(a,1/120,{x:1,y:0});stepDB(b,1/120,{x:-1,y:0});assert.equal(a.x,b.x);assert.equal(a.z,b.z);}
// Button choice is gated and buffered; a second finger never controls movement.
const c=newDBRep(player);c.phase='flight';c.clock=2;assert(playDBBall(c,'pick'));assert(!playDBBall(c,'pick'));assert(playDBBall(c,'swat'));assert.equal(c.playChoice,'swat');c.phase='result';assert(!playDBBall(c,'pick'));
// An out-of-position button press cannot make a remote play on the pass.
const remote=newDBRep(player);Object.assign(remote,{phase:'flight',clock:2,throwAt:2,arrival:3,flight:1,ballTarget:[0,0],receiverFlight:[0,0],catchAt:2});remote.db.x=30;remote.db.z=30;playDBBall(remote,'pick');stepDB(remote,1.01);assert(remote.result.caught);assert(!remote.result.intercepted);
const data=new Map([[MAN_KEY,'keep']]);globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};assert(saveDBScore(player,[rep(0).result]));assert.equal(readDBScores().length,1);assert.equal(data.get(MAN_KEY),'keep');assert(!saveDBScore(player,[]));data.set(DB_KEY,'broken');assert.deepEqual(readDBScores(),[]);globalThis.localStorage={getItem(){throw Error('denied');},setItem(){throw Error('denied');}};assert(!saveDBScore(player,[rep(0).result]));
console.log('PASS 120 DB reps across all eight routes and 15/60/120 Hz: catches allowed, swats, picks, no-input/wrong-direction, fixed flight, non-psychic WR, frozen preview, bounded movement, gated actions and independent storage',outcomes);
