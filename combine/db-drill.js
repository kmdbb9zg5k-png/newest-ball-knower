import {newManRep,newManSession,manBall,randomSource} from './man-coverage.js';
import {routeLength} from './routes.js';
export const DB_REPS=5,DB_KEY='bk-db-drill-v1';
export const RECEIVER={id:'combine-receiver-miles-41',name:'Miles Rivers',position:'WR',heightInches:74,weightLbs:201};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export {newManSession as newDBSession};
export function newDBRep(athlete,index=0,session=newManSession()){
 const s=newManRep(athlete,index,session),random=randomSource(session.seed^Math.imul(index+1,2654435761));
 s.mode='db';s.receiver=RECEIVER;s.speed=4.35+random()*.25;s.aiPoint=1;s.releaseSide=random()<.5?-1:1;s.receiverFlight=null;
 s.db={...s.db,...athlete,x:0,z:3.2,vx:0,vz:0,speed:5.25,heading:Math.PI,style:'MAN COVERAGE',action:'backpedal'};
 s.latestThrowAt=Math.max(3.3,routeLength(s.route)/s.speed+.35);s.readAt=Math.max(1.2,routeLength(s.route)/s.speed-.8);
 s.playChoice=null;s.playAt=null;s.coverageTime=0;s.coverageSamples=0;s.separation=3.2;s.ballHeight=1.45;
 return s;
}
export function playDBBall(s,choice){
 if(s.phase!=='flight'||!['swat','pick'].includes(choice))return false;
 // Buffer the choice through flight; holding or repeated tapping cannot stack attempts.
 if(s.playChoice===choice)return false;s.playChoice=choice;s.playAt=s.clock;return true;
}
function finish(s,reason,caught=false,intercepted=false,brokenUp=false){
 const coverage=Math.round(100*clamp(s.coverageTime/Math.max(.01,s.coverageSamples),0,1));
 s.result={name:s.route.name,reason,caught,intercepted,brokenUp,stop:!caught,coverage,separation:s.separation,yards:caught?Math.max(0,s.z/.9144):0,score:intercepted?100:brokenUp?Math.round(80+coverage*.2):caught?Math.round(coverage*.3):Math.round(55+coverage*.3)};
 s.phase='settle';s.settle=0;
}
function moveReceiver(s,h,settling){
 let vx=0,vz=0;
 if(s.receiverFlight){[vx,vz]=s.receiverFlight;}
 else{
  let target=s.route.points[s.aiPoint];
  if(s.aiPoint<s.route.points.length-1&&Math.hypot(s.x-target[0],s.z-target[1])<.3)target=s.route.points[++s.aiPoint];
  let dx=target[0]-s.x,dz=target[1]-s.z;
  if(s.aiPoint===s.route.points.length-1&&Math.hypot(dx,dz)<.35){const a=s.route.points.at(-2),b=s.route.points.at(-1);dx=b[0]-a[0];dz=b[1]-a[1];}
  // A small release feint, committed before the snap. Never reads the user's stick.
  if(s.clock<.38){dx=s.releaseSide*.55;dz=1;}
  const n=Math.max(.001,Math.hypot(dx,dz));vx=dx/n*s.speed;vz=dz/n*s.speed;
 }
 const blend=1-Math.exp(-h*12);s.vx+=(vx-s.vx)*blend;s.vz+=(vz-s.vz)*blend;
 if(settling&&!s.result.caught){s.vx*=Math.exp(-h*3);s.vz*=Math.exp(-h*3);}
 s.x+=s.vx*h;s.z+=s.vz*h;s.distance+=Math.hypot(s.vx,s.vz)*h;if(Math.hypot(s.vx,s.vz)>.1)s.heading=Math.atan2(s.vx,s.vz);
}
function movePlayer(s,h,input){
 const d=s.db,ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0,n=Math.max(1,Math.hypot(ix,iy)),blend=1-Math.exp(-h*14);
 d.vx+=(-ix/n*d.speed-d.vx)*blend;d.vz+=(-iy/n*d.speed-d.vz)*blend;d.x+=d.vx*h;d.z+=d.vz*h;d.distance+=Math.hypot(d.vx,d.vz)*h;
 const speed=Math.hypot(d.vx,d.vz);d.action=d.z>s.z+1.2&&s.phase!=='settle'?'backpedal':'trail';
 let face=d.action==='backpedal'||speed<.15?Math.atan2(s.x-d.x,s.z-d.z):Math.atan2(d.vx,d.vz);
 d.ballAware=s.phase==='flight'&&s.clock-s.throwAt>.15;d.lookAtBall=d.ballAware;
 if(d.ballAware&&s.playChoice){const b=manBall(s);if(Math.hypot(b[0]-d.x,b[2]-d.z)<2.5){face=Math.atan2(b[0]-d.x,b[2]-d.z);d.action='playball';}}
 const turn=Math.atan2(Math.sin(face-d.heading),Math.cos(face-d.heading));d.heading+=clamp(turn,-h*10,h*10);
 // Resolve overlap gently; never lock the stick or pin either player in place.
 const gap=Math.hypot(d.x-s.x,d.z-s.z);if(gap<.45){const dx=(d.x-s.x)/Math.max(.001,gap),dz=(d.z-s.z)/Math.max(.001,gap),push=Math.min(.45-gap,h*.7);d.x+=dx*push*.5;d.z+=dz*push*.5;s.x-=dx*push*.5;s.z-=dz*push*.5;}
 s.separation=Math.hypot(s.x-d.x,s.z-d.z);
}
export function stepDB(s,dt,input={x:0,y:0}){
 if(!Number.isFinite(dt)||dt<=0)return;let left=dt;
 while(left>1e-8){const h=Math.min(left,1/120);left-=h;
  if(s.phase==='idle'||s.phase==='result')return;
  if(s.phase==='preview'){s.preview=Math.max(0,s.preview-h);if(s.preview<1e-8)s.phase='running';continue;}
  const settling=s.phase==='settle';if(!settling)s.clock+=h;
  moveReceiver(s,h,settling);movePlayer(s,h,input);
  if(settling){s.settle+=h;if(s.settle>=2)s.phase='result';continue;}
  s.coverageSamples+=h;s.coverageTime+=h*clamp(1-(s.separation-.8)/3,0,1);
  if(s.phase==='running'){
   const end=s.route.points.at(-1),near=Math.hypot(s.x-end[0],s.z-end[1])<s.speed*1.25,finalLeg=s.aiPoint===s.route.points.length-1;
   if(s.windupAt===null&&((finalLeg&&near&&s.clock>s.readAt)||s.clock>=s.latestThrowAt))s.windupAt=s.clock;
   if(s.windupAt!==null&&s.clock>=s.windupAt+.22){
    s.flight=clamp(.8+Math.hypot(s.x-3,s.z+3)*.022,.95,1.6);s.ballTarget=[s.x+s.vx*s.flight,s.z+s.vz*s.flight];s.receiverFlight=[s.vx,s.vz];
    s.ballHeight=s.catchStyle==='high'?1.9:s.catchStyle==='low'?.85:1.45;s.releaseSeparation=s.separation;s.throwAt=s.clock;s.arrival=s.clock+s.flight;s.catchAt=s.clock;s.phase='flight';
   }
  }
  if(s.phase==='flight'){
   const b=manBall(s),d=s.db,dist=Math.hypot(b[0]-d.x,b[2]-d.z),nearWR=Math.hypot(b[0]-s.x,b[2]-s.z);
   const bearing=Math.atan2(b[0]-d.x,b[2]-d.z),facing=Math.abs(Math.atan2(Math.sin(bearing-d.heading),Math.cos(bearing-d.heading)))<1.65;
   if(s.playChoice&&d.ballAware&&facing&&b[1]>=.6&&b[1]<=2.35){
    const swat=s.playChoice==='swat';
    if(dist<(swat?1.25:.82)){
     // Picks need the cleaner line. A close contested pick can be tipped instead.
     const pick=!swat&&dist<.72&&(nearWR> .8||dist+.18<nearWR);
     s.ballContact=b;d.play=pick?1:2;finish(s,pick?'INTERCEPTION':swat?'PASS DEFENDED':'TIPPED AWAY',false,pick,!pick);continue;
    }
   }
   if(s.clock>=s.arrival){const caught=Math.hypot(s.x-s.ballTarget[0],s.z-s.ballTarget[1])<1.4;finish(s,caught?'COMPLETION ALLOWED':'FORCED INCOMPLETE',caught);}
  }
 }
}
export function readDBScores(){try{const a=JSON.parse(localStorage.getItem(DB_KEY)||'[]');return Array.isArray(a)?a.filter(r=>r&&typeof r.playerId==='string'&&Number.isFinite(r.score)&&r.score>=0&&r.score<=100).slice(-100):[];}catch{return [];}}
export function saveDBScore(athlete,results){try{if(!results.length)return false;const rows=readDBScores();rows.push({playerId:athlete.id,score:Math.round(results.reduce((n,r)=>n+r.score,0)/results.length),stops:results.filter(r=>r.stop).length,picks:results.filter(r=>r.intercepted).length,date:Date.now()});localStorage.setItem(DB_KEY,JSON.stringify(rows.slice(-100)));return true;}catch{return false;}}
