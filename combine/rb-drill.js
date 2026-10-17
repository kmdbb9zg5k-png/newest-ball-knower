import {randomSource} from './man-coverage.js';
export const RB_REPS=5,RB_KEY='bk-rb-drill-v1',GOAL=18.288,WIDTH=6.4;
export const LINEBACKER={id:'combine-linebacker-roman-72',name:'Roman Hayes',position:'LB',heightInches:75,weightLbs:244};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function newRBSession(seed=Math.floor(Math.random()*0xffffffff)){return {seed};}
export function newRBRep(athlete,index=0,session=newRBSession()){
 const rand=randomSource(session.seed^Math.imul(index+1,2654435761)),side=rand()<.5?-1:1;
 return {mode:'rb',athlete,index,phase:'idle',preview:3,clock:0,handoff:0,settle:0,x:0,z:0,vx:0,vz:0,heading:0,distance:0,speed:5.6,result:null,
  move:null,moveAt:-10,moveSide:1,cooldown:0,broken:0,immuneUntil:0,contact:null,
  db:{...LINEBACKER,x:side*(1.5+rand()*2),z:8.5+rand()*2.5,vx:0,vz:0,heading:Math.PI,distance:0,speed:5.05,readIn:.18,targetX:0,targetZ:0,stumble:0,lunge:0,lungeX:0,lungeZ:0,attempted:false},separation:10};
}
export function startRB(s){if(s.phase==='idle')s.phase='preview';}
export function rbMove(s,choice,input={x:0,y:0}){
 if(s.phase!=='running'||s.cooldown>0||!['juke','spin','stiff'].includes(choice))return false;
 s.move=choice;s.moveAt=s.clock;s.cooldown=1.35;
 // Screen-left is positive world X. A neutral stick cuts away from the defender.
 s.moveSide=Math.abs(input.x)>.18?-Math.sign(input.x):s.db.x>=s.x?-1:1;
 return true;
}
function finish(s,reason){
 const yards=clamp(s.z/.9144,0,20),td=reason==='TOUCHDOWN';s.result={reason,yards,broken:s.broken,touchdown:td,score:Math.min(100,Math.round(yards/20*70+(td?20:0)+Math.min(2,s.broken)*10))};
 s.phase='settle';s.settle=0;s.contact={x:s.x,z:s.z,heading:s.heading,dbX:s.db.x,dbZ:s.db.z};
}
function linebacker(s,h){
 const d=s.db;d.stumble=Math.max(0,d.stumble-h);
 if(d.stumble>0){d.vx*=Math.exp(-h*3);d.vz*=Math.exp(-h*3);}
 else if(d.lunge>0){d.lunge=Math.max(0,d.lunge-h);d.vx=d.lungeX;d.vz=d.lungeZ;if(d.lunge===0){d.stumble=.45;d.attempted=false;}}
 else{
  d.readIn-=h;if(d.readIn<=0){d.readIn=.16;d.targetX=s.x+s.vx*.24;d.targetZ=s.z+s.vz*.24;}
  const dx=d.targetX-d.x,dz=d.targetZ-d.z,n=Math.max(.001,Math.hypot(dx,dz));let ax=dx/n*d.speed-d.vx,az=dz/n*d.speed-d.vz;const a=Math.hypot(ax,az),limit=h*10;if(a>limit){ax*=limit/a;az*=limit/a;}d.vx+=ax;d.vz+=az;
  if(s.clock> .35&&Math.hypot(s.x-d.x,s.z-d.z)<1.65&&s.clock>s.immuneUntil){const rx=s.x+s.vx*.12-d.x,rz=s.z+s.vz*.12-d.z,n=Math.max(.001,Math.hypot(rx,rz));d.lunge=.38;d.lungeX=rx/n*6.2;d.lungeZ=rz/n*6.2;d.attempted=true;}
 }
 d.x+=d.vx*h;d.z+=d.vz*h;d.distance+=Math.hypot(d.vx,d.vz)*h;
 if(Math.hypot(d.vx,d.vz)>.1){const face=Math.atan2(d.vx,d.vz),turn=Math.atan2(Math.sin(face-d.heading),Math.cos(face-d.heading));d.heading+=clamp(turn,-h*8,h*8);}
}
export function stepRB(s,dt,input={x:0,y:0}){
 if(!Number.isFinite(dt)||dt<=0)return;let remaining=Math.min(dt,.25);
 while(remaining>1e-8){const h=Math.min(remaining,1/120);remaining-=h;
  if(s.phase==='idle'||s.phase==='result')return;
  if(s.phase==='preview'){s.preview=Math.max(0,s.preview-h);if(s.preview<1e-8)s.phase='handoff';continue;}
  if(s.phase==='handoff'){s.handoff+=h;if(s.handoff>=.65)s.phase='running';continue;}
  if(s.phase==='settle'){s.settle+=h;if(s.result.reason!=='TACKLED'){s.vx*=Math.exp(-h*5);s.vz*=Math.exp(-h*5);s.x+=s.vx*h;s.z+=s.vz*h;s.distance+=Math.hypot(s.vx,s.vz)*h;}if(s.settle>=1.4)s.phase='result';continue;}
  s.clock+=h;s.cooldown=Math.max(0,s.cooldown-h);const age=s.clock-s.moveAt;if(age>.75)s.move=null;
  const ix=Number.isFinite(input.x)?input.x:0,iy=Number.isFinite(input.y)?input.y:0,n=Math.max(1,Math.hypot(ix,iy));
  let tx=-ix/n*s.speed,tz=-iy/n*s.speed;
  if(s.move==='juke'&&age<.28){tx+=s.moveSide*3.4;const len=Math.max(s.speed,Math.hypot(tx,tz));tx*=s.speed/len;tz*=s.speed/len;}
  if(s.move==='spin'&&age<.55){tx*=.85;tz*=.85;}
  const blend=1-Math.exp(-h*12);s.vx+=(tx-s.vx)*blend;s.vz+=(tz-s.vz)*blend;s.x+=s.vx*h;s.z+=s.vz*h;s.distance+=Math.hypot(s.vx,s.vz)*h;
  if(Math.hypot(s.vx,s.vz)>.15)s.heading=Math.atan2(s.vx,s.vz);
  linebacker(s,h);const d=s.db;s.separation=Math.hypot(s.x-d.x,s.z-d.z);
  const facing=((d.x-s.x)*Math.sin(s.heading)+(d.z-s.z)*Math.cos(s.heading))/Math.max(.01,s.separation);
  const stiff=s.move==='stiff'&&age>=0&&age<.5&&facing>-.1;
  if(s.clock>s.immuneUntil&&d.stumble===0&&s.separation<(stiff?1.22:.70)&&d.lunge>0){
   const beats=stiff||(s.move==='spin'&&age>=0&&age<.50)||(s.move==='juke'&&age>=0&&age<.28&&Math.abs(s.vx-d.vx)>2.4);
   if(beats){s.broken++;s.immuneUntil=s.clock+.9;d.stumble=.95;d.lunge=0;d.vx=(d.x-s.x)/Math.max(.01,s.separation)*2;d.vz=(d.z-s.z)/Math.max(.01,s.separation)*2;}
   else {finish(s,'TACKLED');continue;}
  }
  if(s.z>=GOAL)finish(s,'TOUCHDOWN');else if(Math.abs(s.x)>WIDTH||s.z< -3)finish(s,'OUT OF BOUNDS');else if(s.clock>=12)finish(s,'TIME EXPIRED');
 }
}
export function readRBScores(){try{const r=JSON.parse(localStorage.getItem(RB_KEY)||'[]');return Array.isArray(r)?r.filter(x=>x&&typeof x.playerId==='string'&&Number.isFinite(x.score)&&x.score>=0&&x.score<=100).slice(-100):[];}catch{return [];}}
export function saveRBScore(player,reps){try{if(!reps.length)return false;const rows=readRBScores();rows.push({playerId:player.id,score:Math.round(reps.reduce((n,r)=>n+r.score,0)/reps.length),touchdowns:reps.filter(r=>r.touchdown).length,broken:reps.reduce((n,r)=>n+r.broken,0),date:Date.now()});localStorage.setItem(RB_KEY,JSON.stringify(rows.slice(-100)));return true;}catch{return false;}}
