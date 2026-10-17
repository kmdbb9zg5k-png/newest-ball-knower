import {ROUTES,newRoute,CATCH_RADIUS} from './routes.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const MAN_REPS=5,MAN_KEY='bk-man-coverage-v1';
export const DEFENDER={id:'combine-db-darius-29',name:'Darius Cole',position:'CB',heightInches:72,weightLbs:192};
export function randomSource(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export function newManSession(seed=Math.floor(Math.random()*4294967296)){
 const random=randomSource(seed),order=ROUTES.map((_,i)=>i);for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 return {seed,order:order.slice(0,MAN_REPS)};
}
export function newManRep(athlete,index=0,session=newManSession()){
 const random=randomSource(Math.imul((session.seed+index*7919)^(session.seed>>>16),2246822519)),s=newRoute(athlete,session.order[index]),press=random()<.5,leverage=random()<.5?-1:1;
 return {...s,index,mode:'man',session,route:ROUTES[session.order[index]],latestThrowAt:Math.min(8,Math.max(5.5,s.latestThrowAt)),passToReceiver:true,
  readAt:Math.max(1.6,Math.min(3.2,s.latestThrowAt*.45)),openFor:0,separation:0,releaseSeparation:0,forced:false,
  ballOrigin:[3,1.65,-3],ballHeight:1.45,ballContact:null,history:[{t:0,x:0,z:0,vx:0,vz:0}],
  db:{...DEFENDER,x:leverage*(press?.35:.7),z:press?.95:4.2+random()*1.5,vx:0,vz:0,heading:Math.PI,distance:0,style:press?'PRESS MAN':'SOFT MAN',leverage,action:press?'press':'backpedal',reaction:.22+random()*.12,speed:4.65+random()*.12,turnUntil:0,pressUntil:0,jammed:false,ballAware:false,lookAtBall:false,play:0,hand:null},
 };
}
export function manBall(s){
 if(s.ballContact)return [...s.ballContact];
 const p=clamp((s.clock-s.throwAt)/s.flight,0,1),a=s.ballOrigin,b=s.ballTarget;
 return [a[0]+(b[0]-a[0])*p,a[1]+(s.ballHeight-a[1])*p+Math.sin(Math.PI*p)*(s.flight>1.3?3.5:2.2),a[2]+(b[1]-a[2])*p];
}
function finish(s,reason,caught=false,intercepted=false){
 const separation=Math.hypot(s.x-s.db.x,s.z-s.db.z),yards=Math.max(0,s.z/ .9144),space=Math.min(1,s.releaseSeparation/3);
 s.result={name:s.route.name,reason,caught,intercepted,separation,releaseSeparation:s.releaseSeparation,yards:caught?yards:0,score:Math.round((caught?65:0)+space*25+(caught?Math.min(10,yards/2):0)),catchStyle:s.catchStyle};
 s.phase='settle';s.settle=0;
}
function moveDefender(s,h){
 const d=s.db;
 if(s.phase==='settle'){
  d.vx*=Math.exp(-h*5);d.vz*=Math.exp(-h*5);d.x+=d.vx*h;d.z+=d.vz*h;d.distance+=Math.hypot(d.vx,d.vz)*h;return;
 }
 s.history.push({t:s.clock,x:s.x,z:s.z,vx:s.vx,vz:s.vz});
 while(s.history.length>2&&s.history[1].t<=s.clock-d.reaction)s.history.shift();
 const seen=s.history[0],gap=Math.hypot(seen.x-d.x,seen.z-d.z);
 d.ballAware=s.phase==='flight'&&s.clock-s.throwAt>(gap<2.2?.26:.55);
 let tx=seen.x+seen.vx*.18,tz=seen.z+seen.vz*.18;
 if(s.clock<1.05&&d.style==='PRESS MAN'&&seen.z<1.2){d.action='press';tx=seen.x;tz=seen.z+.65;}
 else if(d.z-seen.z>1.6&&s.phase!=='flight'){
  d.action='backpedal';tx=seen.x+d.leverage*.45;tz=Math.max(d.z,seen.z+2.5);
 }else{d.action='trail';tx+=d.leverage*.28;tz+=.35;}
 if(d.ballAware){
  // Track a reachable low point on the real flight, never teleport to its endpoint.
  d.action='playball';let target=s.ballTarget;
  for(let time=s.clock+.05;time<=s.arrival;time+=.06){const b=manBall({...s,clock:time});if(b[1]<2.25&&Math.hypot(b[0]-d.x,b[2]-d.z)<d.speed*(time-s.clock)+.55){target=[b[0],b[2]];break;}}
  tx=target[0];tz=target[1];
 }
 const dx=tx-d.x,dz=tz-d.z,len=Math.hypot(dx,dz),speed=Math.min(d.action==='backpedal'?3.1:d.speed,len*4),ux=dx/Math.max(.001,len),uz=dz/Math.max(.001,len),oldPace=Math.hypot(d.vx,d.vz);
 // A committed change of direction costs a plant. Reading lag permits double moves.
 const dot=oldPace>.1?(d.vx*ux+d.vz*uz)/oldPace:1;
 if(dot<.25&&oldPace>2.4&&s.clock>=d.turnUntil){d.turnUntil=s.clock+.16;d.action='plant';}
 const targetSpeed=s.clock<d.turnUntil?speed*.35:speed;
 let ax=ux*targetSpeed-d.vx,az=uz*targetSpeed-d.vz,delta=Math.hypot(ax,az),limit=8.5*h;
 if(delta>limit){ax*=limit/delta;az*=limit/delta;}d.vx+=ax;d.vz+=az;d.x+=d.vx*h;d.z+=d.vz*h;d.distance+=Math.hypot(d.vx,d.vz)*h;
 let face=d.action==='backpedal'||d.action==='press'?Math.atan2(seen.x-d.x,seen.z-d.z):Math.atan2(d.vx,d.vz);
 if(d.ballAware){const ball=manBall(s);if(ball[1]<2.6&&Math.hypot(ball[0]-d.x,ball[2]-d.z)<2.3)face=Math.atan2(ball[0]-d.x,ball[2]-d.z);}
 const angle=Math.atan2(Math.sin(face-d.heading),Math.cos(face-d.heading));d.heading+=clamp(angle,-h*7,h*7);
 d.lookAtBall=d.ballAware;
 // One brief legal release jam. A lateral release avoids it; never locks movement.
 if(!d.jammed&&d.style==='PRESS MAN'&&s.clock<1.1&&s.z<1.4&&Math.hypot(s.x-d.x,s.z-d.z)<.72){d.jammed=true;d.pressUntil=s.clock+.18;}
 const contact=Math.hypot(s.x-d.x,s.z-d.z);
 if(contact<.46){const nx=(s.x-d.x)/Math.max(.001,contact),nz=(s.z-d.z)/Math.max(.001,contact),push=Math.min(.46-contact,h*.8);s.x+=nx*push*.5;s.z+=nz*push*.5;d.x-=nx*push*.5;d.z-=nz*push*.5;}
 s.separation=Math.hypot(s.x-d.x,s.z-d.z);
}
export function stepMan(s,dt,input={x:0,y:0}){
 if(!Number.isFinite(dt)||dt<=0)return;
 let left=dt;while(left>1e-8){const h=Math.min(left,1/120);left-=h;
  if(s.phase==='idle'||s.phase==='result')return;
  if(s.phase==='preview'){s.preview=Math.max(0,s.preview-h);if(s.preview<1e-8)s.phase='running';continue;}
  const settling=s.phase==='settle';if(!settling)s.clock+=h;
  const ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0,n=Math.max(1,Math.hypot(ix,iy)),speed=s.speed*(s.clock<s.db.pressUntil?.65:1),blend=1-Math.exp(-h*12);
  s.vx+=(-ix/n*speed-s.vx)*blend;s.vz+=(-iy/n*speed-s.vz)*blend;s.x+=s.vx*h;s.z+=s.vz*h;s.distance+=Math.hypot(s.vx,s.vz)*h;if(Math.hypot(s.vx,s.vz)>.1)s.heading=Math.atan2(s.vx,s.vz);
  moveDefender(s,h);
  if(settling){s.settle+=h;if(s.settle>=2)s.phase='result';continue;}
  if(s.phase==='running'){
   // Read the receiver's actual leverage, not whether he touches route checkpoints.
   const projected=Math.hypot(s.x+s.vx*.3-s.db.x-s.db.vx*.3,s.z+s.vz*.3-s.db.z-s.db.vz*.3);
   const open=s.z>2&&s.separation>1.45&&projected>1.6&&s.clock>=s.readAt;
   s.openFor=open?s.openFor+h:0;
   if(s.windupAt===null&&(s.openFor>.14||s.clock>=s.latestThrowAt)){s.windupAt=s.clock;s.forced=s.clock>=s.latestThrowAt;}
   if(s.windupAt!==null&&s.clock>=s.windupAt+.22){
    const length=Math.hypot(s.x-s.ballOrigin[0],s.z-s.ballOrigin[2]);s.flight=clamp(.78+length*.024,.95,1.65);
    s.ballTarget=[s.x+s.vx*s.flight,s.z+s.vz*s.flight];s.ballHeight=s.catchStyle==='high'?1.9:s.catchStyle==='low'?.85:1.45;
    s.releaseSeparation=s.separation;s.throwAt=s.clock;s.arrival=s.clock+s.flight;s.phase='flight';
   }
  }
  if(s.phase==='flight'){
   const b=manBall(s),d=s.db,dist=Math.hypot(b[0]-d.x,b[2]-d.z),nearWR=Math.hypot(b[0]-s.x,b[2]-s.z),late=s.clock-s.throwAt>.25;
   // Reach and ball height govern contact; a defender across the field cannot roll an interception.
   const bearing=Math.atan2(b[0]-d.x,b[2]-d.z),facing=Math.abs(Math.atan2(Math.sin(bearing-d.heading),Math.cos(bearing-d.heading)))<1.45;
   if(late&&d.ballAware&&facing&&b[1]>=.65&&b[1]<=2.25&&dist<.72){
    const clean=dist<.5&&nearWR>1.05&&Math.hypot(d.vx,d.vz)<5;
    s.ballContact=b;d.play=clean?1:2;finish(s,clean?'INTERCEPTED':'PASS BROKEN UP',false,clean);continue;
   }
   if(s.clock>=s.arrival){
    const error=Math.hypot(s.x-s.ballTarget[0],s.z-s.ballTarget[1]);
    const caught=error<=CATCH_RADIUS&&s.catchAt!==null;
    finish(s,caught?(s.separation<1.2?'CONTESTED CATCH':'CLEAN CATCH'):error>CATCH_RADIUS?'OFF TARGET':'NO CATCH ATTEMPT',caught);
   }
  }
 }
}
export function readManScores(){try{const rows=JSON.parse(localStorage.getItem(MAN_KEY)||'[]');return Array.isArray(rows)?rows.filter(r=>r&&typeof r.playerId==='string'&&Number.isFinite(r.score)&&r.score>=0&&r.score<=100).slice(-100):[];}catch{return [];}}
export function saveManScore(athlete,results){try{const rows=readManScores();rows.push({playerId:athlete.id,score:Math.round(results.reduce((n,r)=>n+r.score,0)/results.length),catches:results.filter(r=>r.caught).length,date:Date.now()});localStorage.setItem(MAN_KEY,JSON.stringify(rows.slice(-100)));return true;}catch{return false;}}
