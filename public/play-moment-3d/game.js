import{Renderer,pose,segment,hex}from'./renderer.js';
import{drawAthlete,prepareJerseys,advanceMotion}from'./athlete.js';
import{createMeshyAthletes}from'./meshy-athlete.js';
import{makeStadium}from'./stadium.js';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/** The established first-down target, in the drive's 0–100 field coordinates.
 * Using ball + toGo preserves goal-to-go even after a loss beyond the ten.
 */
export function lineToGain(drive){return Math.min(100,drive.ball+drive.toGo)}
/** Format the series without confusing short yardage with goal-to-go. */
export function downDistanceLabel(drive){const ord=['1ST','2ND','3RD','4TH'];return ord[Math.min(3,drive.down-1)]+' & '+(lineToGain(drive)===100?'GOAL':drive.toGo)}
export function cameraWorldVector(screenX,screenZ,eye,target){const fx=target[0]-eye[0],fz=target[2]-eye[2],l=Math.hypot(fx,fz)||1;return[(-fz*screenX+fx*screenZ)/l,(fx*screenX+fz*screenZ)/l]}
export function normalizeControlKey(key){return typeof key==='string'&&key.length===1?key.toLowerCase():key}
export function receiverSlotForKey(key){const slot={x:0,y:1,z:2,'1':0,'2':1,'3':2,'4':3,'5':4}[normalizeControlKey(key)];return Number.isInteger(slot)?slot:-1}
export function catchBreakupChance(separation){return separation<.7?.9:separation<1.2?.68:separation<2?.3:.04}
export function defenderPursuitSpeed(separation,afterCatch=false){const base=afterCatch?7.55:6.55,ceiling=afterCatch?8.4:7.2;return clamp(base+Math.max(0,separation-1)*(afterCatch?.12:.06),base,ceiling)}
export function tackleRadius(possessionSeconds,afterCatch=false){const grace=afterCatch?.18:.55;if(possessionSeconds<grace)return 0;return afterCatch?1.05:.86}
export const THROW_PROFILES=Object.freeze({
 bullet:Object.freeze({duration:.43,distanceScale:.0045,arc:1.75,error:.28,pickRisk:.015}),
 touch:Object.freeze({duration:.58,distanceScale:.0065,arc:3.05,error:.12,pickRisk:0}),
 lob:Object.freeze({duration:.76,distanceScale:.009,arc:4.65,error:.2,pickRisk:.055}),
});
export function throwKindForHold(milliseconds){return milliseconds>=520?'lob':milliseconds>=220?'touch':'bullet'}
export function throwKindForModifiers(shiftKey,altKey){return altKey?'lob':shiftKey?'touch':'bullet'}
export function pocketPressure(nearestRusherDistance,seconds){
 const proximity=clamp((4-nearestRusherDistance)/3.25,0,1),late=clamp((seconds-2.1)/3,0,1);
 return clamp(proximity*.78+late*.3,0,1);
}
export function sackLoss(scrimmageZ,qbZ){return clamp(Math.round(scrimmageZ-qbZ)+1,3,12)}
export function hasCrossedScrimmage(qbZ,scrimmageZ){return qbZ>=scrimmageZ+.15}
export function qbMovementSpeed(qbX,forwardInput=0){return(Math.abs(qbX)>6?5.8:4.4)+clamp(forwardInput,0,1)*.7}
/** Presentation-only ball anchor kept close to the throwing hand or carrying arm. */
export function carriedBallAnchor(player,phase='run'){
 const heading=player.heading||0,forward=[Math.sin(heading),Math.cos(heading)],right=[Math.cos(heading),-Math.sin(heading)],pulse=Math.sin(Math.max(0,Math.min(1,player.actionT||0))*Math.PI);
 if(player.fallen)return[player.x+right[0]*.22,.48,player.z+right[1]*.22,heading];
 if(player.role==='QB'&&(phase==='pre'||phase==='pass'||phase==='handoff'))return[player.x+right[0]*.13+forward[0]*.28,1.40,player.z+right[1]*.13+forward[1]*.28,heading];
 const lift=player.action==='hurdle'?.56*pulse:0,side=player.action==='juke'?(player.actionSide||1)*.10*pulse:0;
 return[player.x+right[0]*(.34+side)+forward[0]*.09,1.10+lift,player.z+right[1]*(.34+side)+forward[1]*.09,heading];
}
/** Advance a velocity toward analog input without allowing instant full-speed cuts. */
export function locomotionStep(vx,vz,inputX,inputZ,topSpeed,dt,acceleration=19,deceleration=25){
 const magnitude=Math.min(1,Math.hypot(inputX,inputZ)),safeDt=clamp(dt,0,.1);
 const nx=magnitude?inputX/Math.hypot(inputX,inputZ):0,nz=magnitude?inputZ/Math.hypot(inputX,inputZ):0;
 const targetX=nx*topSpeed*magnitude,targetZ=nz*topSpeed*magnitude,rate=(magnitude>.02?acceleration:deceleration)*safeDt;
 const dx=targetX-vx,dz=targetZ-vz,distance=Math.hypot(dx,dz);
 if(distance<=rate||!distance)return{vx:targetX,vz:targetZ};
 return{vx:vx+dx/distance*rate,vz:vz+dz/distance*rate};
}
/** Aim pursuit ahead of the runner while keeping outside leverage near a sideline. */
export function pursuitTarget(defender,runner,afterCatch=false){
 const speed=Math.hypot(runner.vx||0,runner.vz||0),separation=Math.hypot(runner.x-defender.x,runner.z-defender.z);
 const lead=clamp(.12+separation*.018+(afterCatch?.08:0),.12,.38)*(speed>2?1:0);
 const sideline=clamp(Math.abs(runner.x)/26,0,1),inside=-Math.sign(runner.x||1)*sideline*.72;
 return{x:clamp(runner.x+(runner.vx||0)*lead+inside,-25.8,25.8),z:runner.z+(runner.vz||0)*lead+.28};
}
/** Preserve a small amount of earned forward momentum through wrap contact. */
export function forwardProgressSpot(z,vz){return z-10+clamp(Math.max(0,vz||0)*.085,0,.72)}
export function skillMoveForGesture(dx,dy,duration=0,isQuarterback=false){
 const distance=Math.hypot(dx,dy);
 if(distance<24)return duration<=650?'juke':null;
 if(Math.abs(dx)>=Math.abs(dy)*1.1)return dx<0?'spin-left':'spin-right';
 if(dy<0)return'truck';
 return isQuarterback?'slide':'hurdle';
}
export const CATCH_STYLES=Object.freeze({
 rac:Object.freeze({label:'RAC',catchBonus:-.01,breakupBonus:.035,pickBonus:0,yac:1.08}),
 secure:Object.freeze({label:'SECURE',catchBonus:.11,breakupBonus:-.095,pickBonus:-.025,yac:.86}),
 aggressive:Object.freeze({label:'AGGRESSIVE',catchBonus:.075,breakupBonus:-.07,pickBonus:.018,yac:.78}),
});
export function passOutcomeChances(separation,pressure,kind='bullet',receiverGap=0,defenderLeverage=0,options={}){
 const profile=THROW_PROFILES[kind]||THROW_PROFILES.bullet;
 const style=CATCH_STYLES[options.catchStyle]||CATCH_STYLES.rac,catchRating=Number(options.catchRating)||78,coverageRating=Number(options.coverageRating)||78,throwRating=Number(options.throwRating)||82;
 const hands=(catchRating-78)/250,blanket=(coverageRating-78)/260,accuracy=(throwRating-82)/230;
 return{
  interception:clamp(.012+Math.max(0,1.45-separation)*.13+pressure*.085+defenderLeverage*.12+profile.pickRisk+style.pickBonus+blanket*.35,.005,.38),
  inaccurate:clamp(Math.max(0,receiverGap-.55)*.31+pressure*.075+profile.error*.04-accuracy,0,.72),
  breakup:clamp(catchBreakupChance(separation)*.72+pressure*.045+style.breakupBonus-hands+blanket,.015,.78),
 };
}
const BASE_RATINGS=Object.freeze({
 QB:{speed:78,acceleration:82,agility:80,strength:68,awareness:88,block:35,blockShed:35,tackle:35,catch:58,throw:91,breakTackle:67,carrying:84,coverage:35},
 RB:{speed:89,acceleration:92,agility:91,strength:76,awareness:84,block:55,blockShed:42,tackle:40,catch:82,throw:35,breakTackle:87,carrying:90,coverage:38},
 WR:{speed:90,acceleration:89,agility:88,strength:66,awareness:82,block:52,blockShed:38,tackle:38,catch:87,throw:35,breakTackle:72,carrying:83,coverage:42},
 TE:{speed:82,acceleration:80,agility:77,strength:84,awareness:84,block:81,blockShed:48,tackle:46,catch:86,throw:35,breakTackle:82,carrying:86,coverage:45},
 OL:{speed:61,acceleration:68,agility:62,strength:91,awareness:86,block:90,blockShed:55,tackle:58,catch:35,throw:35,breakTackle:60,carrying:45,coverage:35},
 DL:{speed:73,acceleration:79,agility:72,strength:89,awareness:82,block:48,blockShed:88,tackle:88,catch:42,throw:35,breakTackle:55,carrying:45,coverage:48},
 LB:{speed:82,acceleration:84,agility:79,strength:83,awareness:86,block:46,blockShed:84,tackle:90,catch:68,throw:35,breakTackle:62,carrying:60,coverage:77},
 DB:{speed:91,acceleration:90,agility:90,strength:69,awareness:84,block:42,blockShed:71,tackle:80,catch:76,throw:35,breakTackle:64,carrying:66,coverage:89},
});
export function playerRatings(role,index=0,team=0){
 const base=BASE_RATINGS[role]||BASE_RATINGS.LB,variation=((Math.trunc(index)*7+(team?5:0))%9)-4;
 return Object.freeze(Object.fromEntries(Object.entries(base).map(([key,value])=>[key,clamp(value+(key==='speed'||key==='acceleration'?variation:Math.round(variation*.65)),35,97)])));
}
export function ratingMultiplier(rating,floor=.82,ceiling=1.18){return floor+(clamp(Number(rating)||50,35,97)-35)/62*(ceiling-floor)}
export function contactOutcome(carrierRatings,defenderRatings,context={}){
 const momentum=clamp(Number(context.momentum)||0,0,1),angle=clamp(Number(context.angle)||0,0,1),gang=Math.max(0,Number(context.gang)||0),skill=context.skill||null,roll=clamp(Number.isFinite(context.roll)?context.roll:.5,0,1);
 const runner=(carrierRatings.breakTackle*.42+carrierRatings.strength*.22+carrierRatings.agility*.13+carrierRatings.carrying*.13)/100+momentum*.16+({truck:.18,spin:.12,juke:.1,hurdle:.06}[skill]||0);
 const tackler=(defenderRatings.tackle*.46+defenderRatings.strength*.22+defenderRatings.awareness*.13)/100+angle*.17+gang*.08;
 const edge=runner-tackler,escape=clamp(.16+edge*.72,.04,.62),miss=clamp(.04+(1-angle)*.13+(skill==='juke'||skill==='spin'?.09:0),.03,.28);
 if(roll<miss)return{type:'miss',edge};
 if(roll<miss+escape)return{type:'broken',edge};
 const bigHit=defenderRatings.strength+defenderRatings.tackle>178&&momentum<.72&&roll>.86;
 return{type:bigHit?'big-hit':gang>=1?'gang':'wrap',edge};
}
export function coverageShell(playIndex){return['man','quarters','zone','robber'][clamp(Math.trunc(playIndex)||0,0,3)]}
export const DEFENSIVE_CALLS=Object.freeze([
 Object.freeze({id:'over-three',name:'4-3 OVER',coverage:'zone',pursuit:.98,blitzers:Object.freeze([]),reads:Object.freeze([.58,.76,.64]),fits:Object.freeze([-.7,.25,.85]),alignments:Object.freeze([[-5.8,.75],[-1.8,1],[1.4,.85],[5.7,1.1],[-7.2,5.3],[.8,5.6],[8.4,5.4],[-20,3.2],[-11.4,9.8],[20.5,4.2],[7.5,17.5]])}),
 Object.freeze({id:'under-man',name:'SAM PRESSURE',coverage:'man',pursuit:1.01,blitzers:Object.freeze([15]),reads:Object.freeze([.5,.7,.82]),fits:Object.freeze([-.95,-.2,.55]),alignments:Object.freeze([[-5.1,1],[-1,.7],[2.4,1],[5.8,.75],[-7.8,4.5],[-.8,4.9],[7.2,6.1],[-20.8,2.8],[-12,6.7],[20.8,3.1],[8.5,14.5]])}),
 Object.freeze({id:'nickel-quarters',name:'NICKEL QUARTERS',coverage:'quarters',pursuit:.94,blitzers:Object.freeze([]),reads:Object.freeze([.72,.84,.68]),fits:Object.freeze([-.35,.65,1.05]),alignments:Object.freeze([[-6.2,.85],[-2.1,.8],[2.1,.8],[6.2,.85],[-6.5,6.5],[1.1,6.8],[9.8,4.1],[-21,4.8],[-10.5,11.8],[20.5,5.1],[0,18.5]])}),
 Object.freeze({id:'double-a-robber',name:'DOUBLE A ROBBER',coverage:'robber',pursuit:1.03,blitzers:Object.freeze([16,17]),reads:Object.freeze([.46,.34,.48]),fits:Object.freeze([-.55,-.1,.55]),alignments:Object.freeze([[-5.6,.8],[-2.2,1],[2.2,1],[5.6,.8],[-7,4.8],[-1.15,2.8],[1.15,2.8],[-20.5,3.4],[-11.5,8.2],[20.5,3.4],[6.5,13.2]])}),
]);
/** Rotate independently of the offensive selection so the defense changes every snap. */
export function defensiveCallForSnap(snapNumber=0){const n=Math.max(0,Math.trunc(Number(snapNumber)||0));return DEFENSIVE_CALLS[n%DEFENSIVE_CALLS.length]}
/** Down, distance and clock influence the call without reading the offense's selected play. */
export function situationalDefensiveCall(drive={down:1,toGo:10,ball:25,clock:78,plays:0}){
 const base=Math.max(0,Math.trunc(Number(drive.plays)||0));let offset=0;
 if(Number(drive.down)>=3&&Number(drive.toGo)>=7)offset=2;
 else if(Number(drive.down)>=3&&Number(drive.toGo)<=3)offset=1;
 else if(Number(drive.ball)>=80)offset=3;
 else if(Number(drive.clock)<=35)offset=1;
 return DEFENSIVE_CALLS[(base+offset)%DEFENSIVE_CALLS.length];
}
/** Linemen account for the front while a different blocker climbs to the Mike by concept. */
export function runBlockAssignments(runIndex=0){return[
 [[0,11],[1,15],[2,12],[3,16],[4,13],[10,14]],
 [[0,11],[1,12],[2,13],[3,16],[4,14],[10,17]],
 [[0,11],[1,17],[2,12],[3,13],[4,16],[10,14]],
 [[0,11],[1,12],[2,13],[3,16],[4,14],[10,17]],
 ][clamp(Math.trunc(runIndex)||0,0,3)].map(pair=>pair.slice())}
/** Defenders must diagnose a handoff/misdirection before using predictive pursuit. */
export function runReadDelay(callIndex,defenderIndex,runIndex=0){
 const call=DEFENSIVE_CALLS[((Math.trunc(callIndex)||0)%DEFENSIVE_CALLS.length+DEFENSIVE_CALLS.length)%DEFENSIVE_CALLS.length];
 if(defenderIndex>=15&&defenderIndex<=17)return call.reads[defenderIndex-15]+(runIndex===2?(defenderIndex===16?.24:.1):0);
 if(defenderIndex>=18)return.74+(defenderIndex===21?.16:0);
 return.06;
}
/** Place compact receiver badges above helmets while keeping 44px hit areas apart.
 * Inputs are screen projections only; this never moves players or changes routes.
 */
export function layoutReceiverMarkers(points,width,height,bounds={}){
 const left=bounds.left??28,right=Math.max(left,bounds.right??width-28);
 const top=bounds.top??96,bottom=Math.max(top,bounds.bottom??height-30),placed=[];
 return points.map(p=>{
  if(!p.visible||!Number.isFinite(p.x)||!Number.isFinite(p.y))return{...p,visible:false};
  const x=clamp(p.x,left,right),y=clamp(p.y-28,top,bottom),candidates=[];
  for(const dy of[0,-48,-96,48,96])for(const dx of[0,-48,48,-96,96]){
   const q={x:clamp(x+dx,left,right),y:clamp(y+dy,top,bottom)};
   // Prefer above/alongside the receiver over obscuring the body below its head.
   q.cost=(q.x-x)**2+(q.y-y)**2+(q.y>p.y-18?10000:0);
   candidates.push(q);
  }
  candidates.sort((a,b)=>a.cost-b.cost);
  const q=candidates.find(q=>placed.every(o=>Math.abs(q.x-o.x)>=48||Math.abs(q.y-o.y)>=48))||{x,y};
  placed.push(q);return{...p,x:q.x,y:q.y};
 });
}
export const RUNS=Object.freeze([
 Object.freeze({id:'zone',name:'INSIDE ZONE',path:Object.freeze([[0,0],[-1.2,3],[-3.2,8],[0,17],[2,28]]),handoff:.58,mesh:Object.freeze([-.5,-3.1]),pathSpeed:7,pathLead:3.6,guideSeconds:1.55,steering:.7,speed:.98,acceleration:1.02,blockLeverage:.18,icon:'M24 23L24 13L17 5M17 5L17 11M17 5L23 5'}),
 Object.freeze({id:'stretch',name:'HB STRETCH',path:Object.freeze([[0,0],[5.5,1],[11.5,4],[16,10],[18,25]]),handoff:.5,mesh:Object.freeze([2.8,-3.8]),pathSpeed:7.7,pathLead:4.4,guideSeconds:1.8,steering:.78,speed:1.03,acceleration:1.06,blockLeverage:.34,icon:'M12 23L18 14L36 6M36 6L29 6M36 6L34 13'}),
 Object.freeze({id:'counter',name:'COUNTER',path:Object.freeze([[0,0],[-4.8,-.5],[-6,2],[1.5,8],[8.5,17],[10,28]]),handoff:.68,mesh:Object.freeze([-4.2,-3.7]),pathSpeed:6.6,pathLead:3,guideSeconds:2.05,steering:.82,speed:1.01,acceleration:.93,blockLeverage:.42,icon:'M26 23L15 19L15 13L31 5M31 5L24 5M31 5L29 11'}),
 Object.freeze({id:'toss',name:'HB TOSS',path:Object.freeze([[0,0],[7,-1],[13,1],[19,7],[21,24]]),handoff:.38,mesh:Object.freeze([5.4,-4.7]),pathSpeed:8.25,pathLead:5.2,guideSeconds:1.9,steering:.86,speed:1.07,acceleration:1.11,blockLeverage:.5,icon:'M10 23L34 18L36 5M36 5L30 10M36 5L41 11'}),
]);
const PASSES=[
 {id:'mesh',name:'MESH',routes:[[[0,0],[0,5],[17,9],[28,9]],[[0,0],[0,6],[-5,10],[-14,10]],[[0,0],[0,8],[-3,18],[-3,32]],[[0,0],[0,7],[-7,12],[-13,16]],[[0,0],[4,2],[8,7],[12,10]]],icon:'M5 23L5 14L35 6M42 23L42 14L12 6'},
 {id:'verts',name:'VERTICALS',routes:[[[0,0],[0,35]],[[0,0],[2,35]],[[0,0],[0,35]],[[0,0],[-2,28]],[[0,0],[-4,3],[-5,10],[0,15]]],icon:'M8 23L8 4M24 23L24 4M40 23L40 4M4 9L8 4L12 9M20 9L24 4L28 9M36 9L40 4L44 9'},
 {id:'flood',name:'FLOOD',routes:[[[0,0],[0,8],[17,14],[24,18]],[[0,0],[0,5],[20,9]],[[0,0],[0,12],[-4,29]],[[0,0],[4,5],[14,13]],[[0,0],[-5,1],[-10,5],[-13,8]]],icon:'M6 23L6 14L24 8M22 23L22 16L42 16M39 23L39 4'},
 {id:'dagger',name:'DAGGER',routes:[[[0,0],[0,16],[19,16]],[[0,0],[1,24],[5,32]],[[0,0],[0,20],[-17,20]],[[0,0],[0,8],[-8,13],[-15,13]],[[0,0],[4,2],[8,7],[10,12]]],icon:'M8 23L8 9L22 9M26 23L26 3M40 23L40 14L29 14'},
];
function travel(path,distance){for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(distance<=len){const t=distance/len;return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]}distance-=len}const a=path[path.length-1];return[a[0],a[1]+distance]}
export function runConceptDirection(runIndex,seconds,runnerX,runnerZ,scrimmageZ){const concept=RUNS[clamp(Math.trunc(runIndex)||0,0,RUNS.length-1)],point=travel(concept.path,Math.max(0,seconds)*concept.pathSpeed+concept.pathLead),dx=point[0]-runnerX,dz=scrimmageZ+point[1]-runnerZ,length=Math.hypot(dx,dz)||1;return{x:dx/length,z:dz/length,targetX:point[0],targetZ:scrimmageZ+point[1]}}
export function predictPassDestination(path,startX,startZ,elapsed,duration,speed){const p=travel(path,Math.max(0,elapsed+duration)*speed);return[clamp(startX+p[0],-26.3,26.3),1.6,startZ+p[1]]}
export function start(){
 const r=new Renderer($('game')),stadium=makeStadium(r),meshy=createMeshyAthletes(r);let actors=[],frameId=0,elapsed=0,last=0,raf=0,messageUntil=0,recoveryLeft=0;
 let mode='run',selected=0,assist=false,phase='pre',paused=false,ended=false,flight=null,carrier=null,jukeUntil=0,jukeReady=0,simTime=0,lastSkill=null,lastSkillAt=-10,impactShake=0,catchStyle='rac';
 const redZone=new URLSearchParams(location.search).get('scenario')==='redzone';
 const initialDrive={ball:redZone?85:25,down:1,toGo:10,clock:redZone?63:78,score:24,plays:0};
 let drive={...initialDrive},snapZ=10+initialDrive.ball,snapGainZ=10+lineToGain(initialDrive),stamina=1;
 let input={x:0,z:0,sprint:false,pointer:null,sprintPointer:null},camEye=[14,16,10],camTarget=[0,0,40],defensiveCallIndex=0,defensiveCall=DEFENSIVE_CALLS[0],lastTackler=null;const keys=new Set();
 let qaStepping=false;let accumulator=0;let numSeed=175;const rand=()=>{numSeed=(Math.imul(numSeed,1664525)+1013904223)>>>0;return numSeed/4294967296};
 const specs=[['OL',-4.4,-.35,71],['OL',-2.2,-.35,64],['OL',0,-.35,55],['OL',2.2,-.35,68],['OL',4.4,-.35,79],['QB',0,-5,12],['RB',-2,-7,24],['WR',-21,0,11],['WR',-12,-.6,18],['WR',21,0,84],['TE',6.5,-.4,87],['DL',-5,.8,90],['DL',-1.7,.8,94],['DL',1.7,.8,97],['DL',5,.8,92],['LB',-8,5,53],['LB',0,5,54],['LB',8,5,58],['DB',-20,3,21],['DB',-12,9,23],['DB',20,4,29],['DB',8,17,31]];
 const receiverIndices=[7,8,9,10,6],receiverLabels=['X','Y','Z','A','B'];
 function setup(){snapZ=10+drive.ball;snapGainZ=10+lineToGain(drive);defensiveCall=situationalDefensiveCall(drive);defensiveCallIndex=DEFENSIVE_CALLS.indexOf(defensiveCall);actors=specs.map(([role,x,z,number],index)=>({index,role,number,team:index>=11?1:0,ratings:playerRatings(role,index,index>=11?1:0),x,z:snapZ+z,startX:x,startZ:snapZ+z,heading:index>=11?Math.PI:0,vx:0,vz:0,distance:0,moving:false,engaged:false,engagedWith:null,fallen:false,hasBall:index===5,throwT:0,catchT:0,catchStyle:null,action:null,actionT:0,actionSide:0,reactionT:0,reactionSide:0,contactReady:0}));defensiveCall.alignments.forEach(([x,z],i)=>{const p=actors[11+i];p.x=p.startX=x;p.z=p.startZ=snapZ+z});carrier=actors[5];flight=null;phase='pre';stamina=1;elapsed=0;impactShake=0;catchStyle='rac';input={x:0,z:0,sprint:false,pointer:null,sprintPointer:null};keys.clear();$('knob').style.transform='none';$('stick').setAttribute('aria-valuenow','0');$('stamina').firstElementChild.style.width=(mode==='pass'?0:100)+'%';jukeUntil=0;jukeReady=simTime;lastSkill=null;lastSkillAt=-10;prepareJerseys(r,actors);updateHud();updateControls();renderPlays()}
 function updateHud(){$('score').textContent=drive.score;$('clock').textContent=Math.floor(Math.max(0,drive.clock)/60)+':'+String(Math.floor(Math.max(0,drive.clock)%60)).padStart(2,'0');$('down').textContent=downDistanceLabel(drive)+' · '+(drive.ball<50?'OWN '+drive.ball:drive.ball===50?'50':'OPP '+(100-drive.ball))}
 function renderPlays(){const plays=mode==='run'?RUNS:PASSES;$('plays').replaceChildren();plays.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.className=i===selected?'selected':'';b.innerHTML='<svg viewBox="0 0 48 28" aria-hidden="true"><path d="'+p.icon+'"/></svg><b>'+p.name+'</b>';b.onclick=()=>{if(phase!=='pre')return;selected=i;renderPlays()};$('plays').appendChild(b)});$('playName').textContent=plays[selected].name;$('runTab').classList.toggle('selected',mode==='run');$('passTab').classList.toggle('selected',mode==='pass')}
 function chooseCatch(style){if(!CATCH_STYLES[style])return;catchStyle=style;document.querySelectorAll('#catchChoices button').forEach(button=>button.classList.toggle('selected',button.dataset.catch===style));if(phase==='flight')$('instruction').textContent=CATCH_STYLES[style].label+' CATCH SELECTED'}
 function updateControls(){
  $('pre').hidden=phase!=='pre'||ended;$('live').hidden=!['pre','pass','flight','run'].includes(phase)||paused||ended;$('live').dataset.phase=phase;$('catchChoices').hidden=phase!=='flight';
  $('stick').setAttribute('aria-label',phase==='pre'?'Set movement direction before the snap':phase==='pass'?'Move quarterback':'Move ball carrier');const qbRunner=phase==='run'&&carrier?.role==='QB';
  $('instruction').textContent=phase==='pre'?'Practice preview · No career saves are changed':phase==='pass'?'MOVE QB · 5 TARGETS · CROSS BLUE LINE TO RUN':phase==='flight'?'CHOOSE RAC · SECURE · AGGRESSIVE':phase==='run'?'STEER · SPRINT · TAP/SWIPE SKILL':' ';
  $('juke').setAttribute('aria-label',qbRunner?'Skill moves. Tap to juke, swipe sideways to spin, swipe up to truck, or swipe down to slide.':'Skill moves. Tap to juke, swipe sideways to spin, swipe up to truck, or swipe down to hurdle.');$('skillHint').textContent=qbRunner?'SLIDE ↓':'SWIPE';$('control').textContent=(assist?'ASSIST':'MANUAL')+' ●';const stickDisabled=phase==='run'&&assist;$('stick').style.opacity=stickDisabled?'.3':'1';$('stick').style.pointerEvents=stickDisabled?'none':'auto';$('targetLayer').replaceChildren();
  if(phase==='pass')receiverIndices.forEach((index,i)=>{const b=document.createElement('button');b.className='target';b.id='target-'+index;const badge=document.createElement('span');badge.className='target-label';badge.textContent=receiverLabels[i];const tether=document.createElement('span');tether.className='target-tether';tether.setAttribute('aria-hidden','true');b.append(tether,badge);b.setAttribute('aria-label','Throw to receiver '+receiverLabels[i]+'. Tap for bullet, hold for touch or lob.');let pressedAt=null;b.onpointerdown=e=>{pressedAt=performance.now();b.setPointerCapture(e.pointerId);e.preventDefault()};b.onpointerup=e=>{if(pressedAt===null)return;const held=performance.now()-pressedAt;pressedAt=null;throwTo(index,throwKindForHold(held));e.preventDefault()};b.onpointercancel=()=>{pressedAt=null};b.onclick=e=>{if(e.detail===0)throwTo(index,'bullet')};$('targetLayer').appendChild(b)})
 }
 function message(text,seconds=1.4){$('message').textContent=text;$('message').classList.add('show');messageUntil=performance.now()+seconds*1000}
 function snap(){if(phase!=='pre'||paused||ended)return;phase=mode==='run'?'handoff':'pass';elapsed=0;drive.plays++;lastTackler=null;catchStyle='rac';carrier=actors[5];message(mode==='run'?RUNS[selected].name:defensiveCall.blitzers.length?'PRESSURE LOOK · READ HOT':'READ THE COVERAGE',.85);updateControls()}
 function move(p,x,z,dt,turn=12){const dx=x-p.x,dz=z-p.z,dist=Math.hypot(dx,dz);p.moving=dist>.001;p.distance+=dist;p.vx=dt>0?dx/dt:0;p.vz=dt>0?dz/dt:0;p.x=clamp(x,-26.3,26.3);p.z=z;if(dist>.001){const heading=Math.atan2(dx,dz),diff=Math.atan2(Math.sin(heading-p.heading),Math.cos(heading-p.heading));p.heading+=diff*Math.min(1,dt*turn)}}
 function chase(p,x,z,speed,dt){const dx=x-p.x,dz=z-p.z,len=Math.hypot(dx,dz)||1,step=Math.min(len,speed*dt);move(p,p.x+dx/len*step,p.z+dz/len*step,dt)}
 function accelerate(p,x,z,speed,dt,acceleration=19,deceleration=25){
  const next=locomotionStep(p.vx||0,p.vz||0,x,z,speed,dt,acceleration,deceleration);
  move(p,p.x+next.vx*dt,p.z+next.vz*dt,dt,8.5);p.vx=next.vx;p.vz=next.vz;
 }
 function pursue(p,target,speed,dt,afterCatch=false){const aim=pursuitTarget(p,target,afterCatch),dx=aim.x-p.x,dz=aim.z-p.z,len=Math.hypot(dx,dz)||1;accelerate(p,dx/len,dz/len,speed,dt,17,22)}
 function beginSkillAction(type,duration,side=0){carrier.action=type;carrier.actionStarted=simTime;carrier.actionUntil=simTime+duration;carrier.actionT=0;carrier.actionSide=side}
 function updateSkillAction(){if(!carrier?.action)return;const duration=Math.max(.001,carrier.actionUntil-carrier.actionStarted);carrier.actionT=clamp((simTime-carrier.actionStarted)/duration,0,1);if(simTime>=carrier.actionUntil){carrier.action=null;carrier.actionT=0;carrier.actionSide=0}}
 function performSkill(action){
  if(phase!=='run'||simTime<jukeReady||!carrier)return;
  const defenders=actors.filter(p=>p.team===1&&!p.engaged&&!p.fallen),nearest=defenders.reduce((best,p)=>!best||Math.hypot(p.x-carrier.x,p.z-carrier.z)<Math.hypot(best.x-carrier.x,best.z-carrier.z)?p:best,null);
  const [rightX,rightZ]=cameraWorldVector(1,0,camEye,camTarget),[forwardX,forwardZ]=cameraWorldVector(0,1,camEye,camTarget);
  const defenderSide=nearest?(nearest.x-carrier.x)*rightX+(nearest.z-carrier.z)*rightZ:0;
  if(action==='slide'&&carrier.role==='QB'){
   lastSkill='slide';jukeReady=simTime+1;carrier.fallen=true;carrier.slide=true;navigator.vibrate?.(14);endPlay('QB SLIDE',carrier.z-10);return;
  }
  if(action==='slide')action='hurdle';
  if(action==='juke'){
   const keyboardX=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),side=Math.abs(keyboardX||input.x)>.15?Math.sign(keyboardX||input.x):(defenderSide>0?-1:1),[dx,dz]=cameraWorldVector(side,0,camEye,camTarget);
   beginSkillAction('juke',.46,side);jukeUntil=simTime+.48;jukeReady=simTime+1.18;const targetHeading=Math.atan2(dx,dz),headingDiff=Math.atan2(Math.sin(targetHeading-carrier.heading),Math.cos(targetHeading-carrier.heading));carrier.heading+=headingDiff*.72;carrier.x=clamp(carrier.x+dx*.48,-25.8,25.8);carrier.z=clamp(carrier.z+dz*.48,10,110);carrier.vx=dx*7.4+forwardX*2.2;carrier.vz=dz*7.4+forwardZ*2.2;if(nearest&&Math.hypot(nearest.x-carrier.x,nearest.z-carrier.z)<4.2){nearest.reactionT=.001;nearest.reactionSide=-side}message('JUKE '+(side>0?'RIGHT':'LEFT'),.65);
  }else if(action==='spin-left'||action==='spin-right'){
   const side=action==='spin-left'?-1:1,[dx,dz]=cameraWorldVector(side,0,camEye,camTarget);beginSkillAction('spin',.62,side);jukeUntil=simTime+.44;jukeReady=simTime+1.32;carrier.x=clamp(carrier.x+dx*.34+forwardX*.36,-25.8,25.8);carrier.z=clamp(carrier.z+dz*.34+forwardZ*.36,10,110);carrier.vx=dx*3.8+forwardX*5.3;carrier.vz=dz*3.8+forwardZ*5.3;if(nearest&&Math.hypot(nearest.x-carrier.x,nearest.z-carrier.z)<3.8){nearest.reactionT=.001;nearest.reactionSide=side}message('SPIN '+(side>0?'RIGHT':'LEFT'),.7);
  }else if(action==='truck'){
   beginSkillAction('truck',.48,defenderSide>=0?1:-1);jukeUntil=simTime+.42;jukeReady=simTime+1.12;stamina=clamp(stamina-.08,0,1);$('stamina').firstElementChild.style.width=(stamina*100)+'%';
   const target=defenders.filter(p=>{const dx=p.x-carrier.x,dz=p.z-carrier.z;return Math.hypot(dx,dz)<2.65&&dx*forwardX+dz*forwardZ>-.35}).reduce((best,p)=>!best||Math.hypot(p.x-carrier.x,p.z-carrier.z)<Math.hypot(best.x-carrier.x,best.z-carrier.z)?p:best,null);
   if(target){const lateral=Math.abs((target.x-carrier.x)*rightX+(target.z-carrier.z)*rightZ);target.fallen=true;target.engaged=false;target.engagedWith=null;impactShake=.72;move(target,target.x+forwardX*.95,target.z+forwardZ*.95,.12,18);message(lateral>.62?'STIFF ARM':'TRUCK',.72)}else message('TRUCK',.62);
   carrier.x=clamp(carrier.x+forwardX*.72,-25.8,25.8);carrier.z=clamp(carrier.z+forwardZ*.72,10,110);
  }else if(action==='hurdle'){
   beginSkillAction('hurdle',.62,0);jukeUntil=simTime+.52;jukeReady=simTime+1.38;stamina=clamp(stamina-.1,0,1);$('stamina').firstElementChild.style.width=(stamina*100)+'%';carrier.x=clamp(carrier.x+forwardX*1.12,-25.8,25.8);carrier.z=clamp(carrier.z+forwardZ*1.12,10,110);message('HURDLE',.7);
  }else return;
  lastSkill=action;lastSkillAt=simTime;navigator.vibrate?.(20);
 }
function coverage(dt){
  receiverIndices.forEach((idx,i)=>{const p=actors[idx],routeSpeed=(6.05+i*.12)*ratingMultiplier(p.ratings.speed,.91,1.1),pos=travel(PASSES[selected].routes[i],elapsed*routeSpeed);move(p,p.startX+pos[0],p.startZ+pos[1],dt)});
  const shell=defensiveCall.coverage,targets=receiverIndices.map(i=>actors[i]),corners=[actors[18],actors[19],actors[20]],safety=actors[21];
  corners.forEach((d,i)=>{const t=targets[i],speed=(shell==='man'?5.85:5.2)*ratingMultiplier(d.ratings.coverage,.94,1.08);if(elapsed<.18+i*.06)return;if(shell==='quarters'){chase(d,t.x,t.z+2.25,speed,dt)}else if(shell==='zone'){const zoneX=[-15,0,15][i],near=targets.reduce((best,p)=>Math.abs(p.x-zoneX)<Math.abs(best.x-zoneX)?p:best,targets[0]);chase(d,zoneX+(near.x-zoneX)*.4,clamp(near.z+1,snapZ+5,snapZ+18),speed,dt)}else{const undercut=shell==='robber'&&i===1?-.35:1.05;chase(d,t.x+(i===1?-1.1:Math.sign(t.x||1)*-1),t.z+undercut,speed,dt)}});
  if(shell==='quarters'){const deep=targets.reduce((a,b)=>a.z>b.z?a:b);chase(safety,deep.x*.28,deep.z+3.2,5.15*ratingMultiplier(safety.ratings.coverage,.94,1.08),dt)}else if(shell==='zone'){chase(safety,targets[1].x*.25,Math.max(snapZ+14,targets[1].z+3),4.9,dt)}else if(shell==='robber'){chase(safety,targets[1].x,targets[1].z-.8,6.15,dt)}else{const deep=targets.reduce((a,b)=>a.z>b.z?a:b);chase(safety,deep.x*.35,deep.z+2.7,5.35,dt)}
  const underneathTargets=[targets[3],targets[4],targets[1]];for(let i=15;i<18;i++){if(defensiveCall.blitzers.includes(i))continue;const d=actors[i],t=underneathTargets[i-15],zoneX=[-7,0,7][i-15],speed=(shell==='robber'?5.2:4.72)*ratingMultiplier(d.ratings.coverage,.94,1.08);chase(d,shell==='man'?clamp(t.x,-12,12):zoneX,Math.min(t.z+(shell==='robber'?-.4:1),snapZ+12),speed,dt)}
 }
 function runClock(){return elapsed+(phase==='run'&&mode==='run'?.55:0)}
 function runFit(defender,dt){
  const clock=runClock(),readAt=runReadDelay(defensiveCallIndex,defender.index,selected),slot=defender.index-15,runSide=Math.sign(RUNS[selected].path[2][0]||1),falseSide=selected===2?-runSide:runSide,target=phase==='handoff'?actors[6]:carrier;
  if(clock<readAt){const fit=slot>=0&&slot<3?defensiveCall.fits[slot]:0,progress=clamp(clock/Math.max(readAt,.01),0,1);chase(defender,defender.startX+(fit+falseSide*.42)*progress,defender.startZ+.16*progress,slot>=0&&slot<3?1.65:1.25,dt);return}
  const separation=Math.hypot(defender.x-target.x,defender.z-target.z),speed=defenderPursuitSpeed(separation,mode==='pass')*defensiveCall.pursuit;pursue(defender,target,speed,dt,mode==='pass');
 }
 function engageBlock(blocker,defender,dt,runSide=0,index=0,isRun=false){
  if(!blocker||!defender||defender.fallen){if(blocker){blocker.engaged=false;blocker.engagedWith=null}if(defender){defender.engaged=false;defender.engagedWith=null}return}
  const clock=isRun?runClock():elapsed,distance=Math.hypot(defender.x-blocker.x,defender.z-blocker.z),secondLevel=defender.role==='LB',ratingEdge=(blocker.ratings.block-defender.ratings.blockShed)*.018,conceptBonus=isRun?RUNS[selected].blockLeverage:0,shedAt=(secondLevel?2.75:2.05)+(index%3)*.24+ratingEdge+conceptBonus;
  if(distance<1.76&&clock<shedAt){
   blocker.engaged=defender.engaged=true;blocker.engagedWith=defender.index;defender.engagedWith=blocker.index;
   const drive=(.21+(index%2)*.06)*ratingMultiplier(blocker.ratings.strength,.85,1.18),edge=runSide*(index>=4?.24:.08)*(1+conceptBonus),targetX=defender.x+edge,targetZ=defender.z-.88;
   chase(blocker,targetX,targetZ,4.6*ratingMultiplier(blocker.ratings.acceleration,.9,1.08),dt);move(defender,defender.x+edge*dt,defender.z+drive*dt,dt,7);const contactHeading=Math.atan2(defender.x-blocker.x,defender.z-blocker.z);blocker.heading=contactHeading;defender.heading=contactHeading+Math.PI;
  }else{
   blocker.engaged=defender.engaged=false;blocker.engagedWith=defender.engagedWith=null;
   if(isRun&&clock<Math.min(shedAt,secondLevel?2.05:1.2)){const targetHeading=Math.atan2(defender.x-blocker.x,defender.z-.82-blocker.z);chase(blocker,defender.x-runSide*.08,defender.z-.82,secondLevel?6.15:5.4,dt);blocker.heading=targetHeading;runFit(defender,dt)}else{const target=isRun&&phase==='handoff'?actors[6]:carrier;pursue(defender,target,isRun?defenderPursuitSpeed(distance,false)*defensiveCall.pursuit:(index>=4?4.85:5.25),dt,phase==='run'&&mode==='pass')}
  }
 }
 function blockers(dt,isRun){
  if(isRun){
   const lane=RUNS[selected].path[2][0],side=lane<0?-1:1,assignments=runBlockAssignments(selected),handled=new Set();
   assignments.forEach(([blockerIndex,defenderIndex],i)=>{handled.add(defenderIndex);engageBlock(actors[blockerIndex],actors[defenderIndex],dt,side,i,true)});
   return handled;
  }
  for(let i=0;i<5;i++){const p=actors[i],desiredZ=snapZ-.4-Math.min(elapsed*.55,1.7);p.engaged=false;p.engagedWith=null;chase(p,p.startX,desiredZ,2.8,dt);p.heading=0}
  const rushers=[11,12,13,14,...defensiveCall.blitzers];rushers.forEach((defenderIndex,i)=>{const d=actors[defenderIndex],p=i<5?actors[i]:null;if(d.fallen){d.engaged=false;return}if(!p){d.engaged=false;if(elapsed<.9){chase(d,d.startX,d.startZ,.8,dt);d.heading=Math.PI}else pursue(d,carrier,5.65*ratingMultiplier(d.ratings.speed,.92,1.1),dt);return}const ratingEdge=(p.ratings.block-d.ratings.blockShed)*.016,release=clamp(1.75+i*.18+ratingEdge,1.05,3.15);if(elapsed<release){chase(d,p.x,p.z+.9,4.15,dt);d.engaged=true;d.engagedWith=p.index;p.engaged=true;p.engagedWith=d.index;d.heading=Math.PI}else{d.engaged=false;d.engagedWith=null;p.engaged=false;p.engagedWith=null;pursue(d,carrier,(5.2+i*.08)*ratingMultiplier(d.ratings.speed,.92,1.1),dt)}})
 }
 function throwTo(index,kind='bullet'){if(phase!=='pass'||paused)return;const target=actors[index],routeIndex=receiverIndices.indexOf(index),profile=THROW_PROFILES[kind]||THROW_PROFILES.bullet,qb=actors[5],nearest=Math.min(...actors.filter(p=>p.team===1&&!p.engaged).map(p=>Math.hypot(p.x-qb.x,p.z-qb.z)),8),pressure=pocketPressure(nearest,elapsed),release=carriedBallAnchor(qb,'pass');carrier.hasBall=false;qb.throwT=.001;const routeSpeed=(6.05+routeIndex*.12)*ratingMultiplier(target.ratings.speed,.91,1.1),duration=profile.duration+Math.abs(target.z-carrier.z)*profile.distanceScale,to=routeIndex>=0?predictPassDestination(PASSES[selected].routes[routeIndex],target.startX,target.startZ,elapsed,duration,routeSpeed):[target.x,1.6,target.z],movingPenalty=qb.moving?.62:0,accuracy=ratingMultiplier(qb.ratings.throw,.74,1.03),error=(profile.error+pressure*1.18+movingPenalty)/accuracy;to[0]=clamp(to[0]+(rand()-.5)*2*error,-26.3,26.3);to[2]=clamp(to[2]+(rand()-.5)*1.25*error,10,110);catchStyle='rac';flight={from:release.slice(0,3),to,target:index,t:0,duration,arc:profile.arc,kind,pressure};phase='flight';message(kind.toUpperCase()+' PASS · PICK A CATCH',.65);updateControls()}
 function endPlay(reason,ballSpot,incomplete=false){if(phase==='dead'||ended)return;const old=drive.ball;phase='dead';flight=null;input.x=0;input.z=0;input.sprint=false;keys.clear();actors.forEach(p=>{p.moving=false;p.engaged=false});if(carrier&&reason==='TACKLED')carrier.fallen=true;drive.ball=incomplete?old:clamp(Math.round(ballSpot),1,100);const gain=drive.ball-old;let copy=reason;
  if(drive.ball>=100){drive.score+=6;message('TOUCHDOWN',3);endDrive('TOUCHDOWN','You finished the drive. Practice results stay separate from your career.');return}
  if(!incomplete){copy+=' · '+(gain>=0?'+':'')+gain+' YDS'}
  if(gain>=drive.toGo){drive.down=1;drive.toGo=Math.min(10,100-drive.ball);copy=(lineToGain(drive)===100?'FIRST & GOAL':'FIRST DOWN')+' · +'+gain+' YDS'}else{drive.down++;drive.toGo=Math.max(1,drive.toGo-gain)}
  message(copy,1.4);updateHud();updateControls();if(drive.down>4){endDrive('TURNOVER ON DOWNS','The defense held. Restart this practice drive to try again.');return}if(drive.clock<=0){endDrive('TIME EXPIRED','The clock reached zero. Your career is unchanged.');return}recoveryLeft=1.2;
 }
 function endDrive(title,body){ended=true;paused=true;phase='dead';if(title==='TOUCHDOWN'&&carrier){carrier.action='celebrate';carrier.actionT=0}$('dialogTitle').textContent=title;$('dialogBody').textContent=body;$('resume').hidden=true;$('paused').hidden=false;updateHud();updateControls()}
 function pause(){if(ended)return;paused=!paused;input.x=input.z=0;input.sprint=false;input.pointer=input.sprintPointer=null;keys.clear();$('knob').style.transform='none';$('dialogTitle').textContent='PAUSED';$('dialogBody').textContent='This preview never changes your career saves or season record.';$('resume').hidden=false;$('paused').hidden=!paused;updateControls()}
 function tick(dt){if(phase==='dead'){if(!ended){recoveryLeft-=dt;if(recoveryLeft<=0)setup()}return}if(phase==='pre')return;elapsed+=dt;simTime+=dt;for(const p of actors)if(p.reactionT>0){p.reactionT+=dt/.42;if(p.reactionT>=1)p.reactionT=0}drive.clock=Math.max(0,drive.clock-dt);updateHud();
  if(phase==='handoff'){const a=actors[5],b=actors[6],concept=RUNS[selected],t=clamp(elapsed/concept.handoff,0,1),ease=t*t*(3-2*t);move(b,-2+(concept.mesh[0]+2)*ease,snapZ-7+(concept.mesh[1]+7)*ease,dt);a.heading=Math.atan2(concept.mesh[0],concept.mesh[1]+5);blockers(dt,true);if(t>=1){const guide=runConceptDirection(selected,0,b.x,b.z,snapZ),launch=input.x||input.z?cameraWorldVector(input.x,input.z,camEye,camTarget):[guide.x,guide.z];a.hasBall=false;b.hasBall=true;b.vx=launch[0]*4.4;b.vz=launch[1]*4.4;carrier=b;phase='run';elapsed=0;updateControls()}return}
  if(phase==='pass'||phase==='flight'){coverage(dt);blockers(dt,false);const qb=actors[5];
   if(phase==='pass'){
    let x=input.x,z=input.z;const kx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),kz=(keys.has('ArrowUp')||keys.has('w')?1:0)-(keys.has('ArrowDown')||keys.has('s')?1:0);if(kx||kz){const len=Math.hypot(kx,kz);x=kx/len;z=kz/len}if(x||z){[x,z]=cameraWorldVector(x,z,camEye,camTarget);const speed=qbMovementSpeed(qb.x,z);accelerate(qb,x,z,speed,dt,14,22);qb.x=clamp(qb.x,-19,19);qb.z=clamp(qb.z,snapZ-12,snapZ+.35)}else accelerate(qb,0,0,qbMovementSpeed(qb.x),dt,14,25);
    if(hasCrossedScrimmage(qb.z,snapZ)){phase='run';assist=false;elapsed=0;stamina=1;jukeUntil=simTime+.42;$('stamina').firstElementChild.style.width='100%';updateControls();message('QB SCRAMBLE · TAKE CONTROL',1);return}
    const rushers=actors.filter(p=>p.team===1&&!p.engaged&&(p.role==='DL'||defensiveCall.blitzers.includes(p.index))),nearest=Math.min(...rushers.map(p=>Math.hypot(p.x-qb.x,p.z-qb.z)),8),pressure=pocketPressure(nearest,elapsed);$('stamina').firstElementChild.style.width=(pressure*100)+'%';$('instruction').textContent='MOVE QB · CROSS BLUE LINE TO RUN · PRESSURE '+Math.round(pressure*100)+'%';if(nearest<.92){endPlay('SACK',drive.ball-sackLoss(snapZ,qb.z));return}
   }
   if(flight){flight.t+=dt/flight.duration;qb.throwT=clamp(flight.t,.001,1);if(flight.t>=1){const p=actors[flight.target],defenders=actors.filter(a=>a.team===1),closest=defenders.reduce((a,b)=>Math.hypot(a.x-flight.to[0],a.z-flight.to[2])<Math.hypot(b.x-flight.to[0],b.z-flight.to[2])?a:b),defenderBallDistance=Math.hypot(closest.x-flight.to[0],closest.z-flight.to[2]),receiverGap=Math.hypot(p.x-flight.to[0],p.z-flight.to[2]),distance=Math.min(...defenders.map(a=>Math.hypot(a.x-p.x,a.z-p.z))),leverage=clamp((receiverGap-defenderBallDistance+1)/2,0,1),style=catchStyle,chances=passOutcomeChances(distance,flight.pressure,flight.kind,receiverGap,leverage,{catchStyle:style,catchRating:p.ratings.catch,coverageRating:closest.ratings.coverage,throwRating:qb.ratings.throw}),roll=rand();flight=null;qb.throwT=0;if(defenderBallDistance<1.85&&roll<chances.interception){closest.hasBall=true;carrier=closest;message('INTERCEPTED',1.2);endDrive('INTERCEPTED','The defender undercut the throw. Mix trajectory, timing and pocket movement on the next drive.');return}if(receiverGap>2.2||roll<chances.interception+chances.inaccurate){endPlay('INACCURATE PASS',drive.ball,true);return}if(roll<chances.interception+chances.inaccurate+chances.breakup){const miss=distance>=2?'DROPPED PASS':distance<.7?'TIGHT WINDOW · PASS BROKEN UP':'PASS BROKEN UP';endPlay(miss,drive.ball,true);return}p.hasBall=true;p.catchT=.45;p.catchStyle=style;p.action='catch-'+style;p.actionStarted=simTime;p.actionUntil=simTime+.58;p.actionT=0;carrier=p;phase='run';elapsed=0;jukeUntil=simTime+(style==='secure'?.28:.18);updateControls();message((distance<2?'CONTESTED ':'')+CATCH_STYLES[style].label+' CATCH · TAKE CONTROL',1)}}
   return;
  }
  if(phase==='run'){
   updateSkillAction();
   let x=input.x,z=input.z;const kx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),kz=(keys.has('ArrowUp')||keys.has('w')?1:0)-(keys.has('ArrowDown')||keys.has('s')?1:0);if(kx||kz){const len=Math.hypot(kx,kz);x=kx/len;z=kz/len}
   const manual=Boolean(x||z),concept=mode==='run'?RUNS[selected]:null,guide=concept?runConceptDirection(selected,elapsed,carrier.x,carrier.z,snapZ):null;
   if(assist){if(guide){x=guide.x;z=guide.z}else{x=0;z=1}}else if(manual){[x,z]=cameraWorldVector(x,z,camEye,camTarget);if(guide&&elapsed<concept.guideSeconds){const blend=(1-elapsed/concept.guideSeconds)*concept.steering*.48;x=x*(1-blend)+guide.x*blend;z=z*(1-blend)+guide.z*blend;const len=Math.hypot(x,z)||1;x/=len;z/=len}}else if(guide){x=guide.x;z=guide.z}else z=.42;
   const boosting=(input.sprint||keys.has('Shift'))&&stamina>0,styleSpeed=mode==='pass'&&elapsed<1?(CATCH_STYLES[carrier.catchStyle||'rac']?.yac||1):1,conceptSpeed=concept?.speed||1,baseSpeed=(boosting?9.2:7.2)*ratingMultiplier(carrier.ratings.speed,.9,1.1)*conceptSpeed*styleSpeed,acceleration=(boosting?16:20)*ratingMultiplier(carrier.ratings.acceleration,.88,1.14)*(concept?.acceleration||1);stamina=clamp(stamina+(boosting?-.31:.09)*dt,0,1);$('stamina').firstElementChild.style.width=(stamina*100)+'%';accelerate(carrier,x,z,baseSpeed,dt,acceleration,26);carrier.catchT=Math.max(0,carrier.catchT-dt);
   const assigned=blockers(dt,mode==='run')||new Set();for(const p of actors.filter(p=>p.team===1&&p.role!=='DL'&&!p.engaged&&!p.fallen&&!assigned.has(p.index))){if(mode==='run')runFit(p,dt);else{const separation=Math.hypot(p.x-carrier.x,p.z-carrier.z);pursue(p,carrier,defenderPursuitSpeed(separation,true),dt,true)}}
   for(const p of actors.filter(p=>p.team===0&&(p.role==='WR'||p.role==='TE')&&p!==carrier))chase(p,p.x,snapZ+Math.min(elapsed*5+4,18),4.5,dt);
   if(carrier.z>=110){endPlay('TOUCHDOWN',100);return}if(Math.abs(carrier.x)>=26){endPlay('OUT OF BOUNDS',carrier.z-10);return}
   if(simTime>jukeUntil){const radius=tackleRadius(elapsed,mode==='pass'),contacts=radius?actors.filter(p=>p.team===1&&!p.engaged&&!p.fallen&&simTime>=p.contactReady&&Math.hypot(p.x-carrier.x,p.z-carrier.z)<radius):[];if(contacts.length){const d=contacts.reduce((best,p)=>Math.hypot(p.x-carrier.x,p.z-carrier.z)<Math.hypot(best.x-carrier.x,best.z-carrier.z)?p:best),speed=Math.hypot(carrier.vx,carrier.vz),toDefenderX=d.x-carrier.x,toDefenderZ=d.z-carrier.z,toDefenderLength=Math.hypot(toDefenderX,toDefenderZ)||1,angle=clamp((carrier.vx*toDefenderX+carrier.vz*toDefenderZ)/(Math.max(speed,.1)*toDefenderLength)*.5+.5,0,1),gang=actors.filter(p=>p.team===1&&p!==d&&!p.fallen&&Math.hypot(p.x-carrier.x,p.z-carrier.z)<2.15).length,outcome=contactOutcome(carrier.ratings,d.ratings,{momentum:clamp(speed/9.5,0,1),angle,gang,skill:simTime-lastSkillAt<.8?lastSkill:null,roll:rand()});lastTackler=d.index;d.contactReady=simTime+.72;if(outcome.type==='miss'||outcome.type==='broken'){d.fallen=outcome.type==='broken';d.action=outcome.type==='broken'?'tackle':'miss';d.actionStarted=simTime;d.actionUntil=simTime+.58;d.actionT=.18;d.reactionT=.001;d.reactionSide=Math.sign(d.x-carrier.x)||1;carrier.action='break-tackle';carrier.actionStarted=simTime;carrier.actionUntil=simTime+.5;carrier.actionT=0;jukeUntil=simTime+.42;impactShake=.48;carrier.vx*=.82;carrier.vz*=.82;message(outcome.type==='broken'?'BROKEN TACKLE':'TACKLER MISSED',.72);navigator.vibrate?.(16)}else{d.action='tackle';d.actionStarted=simTime;d.actionUntil=simTime+.58;d.actionT=.2;carrier.action=outcome.type;carrier.fallen=true;impactShake=outcome.type==='big-hit'?1.35:1;navigator.vibrate?.(outcome.type==='big-hit'?45:28);endPlay(outcome.type==='big-hit'?'BIG HIT':outcome.type==='gang'?'GANG TACKLE':'TACKLED',forwardProgressSpot(carrier.z,carrier.vz));return}}}
   if(drive.clock<=0||elapsed>16)endPlay(drive.clock<=0?'TIME EXPIRED':'WHISTLE',carrier.z-10);
  }
 }
 function camera(dt){const isPocket=phase==='pre'||phase==='pass',isDead=phase==='dead';let x=0,z=snapZ+2,mult=1;
  if(!isPocket&&!isDead){x=carrier.x*.55;z=carrier.z+5;if(flight){const t=clamp(flight.t,0,1);x=(flight.from[0]+(flight.to[0]-flight.from[0])*t)*.55;z=flight.from[2]+(flight.to[2]-flight.from[2])*t+4}}
  if(phase==='pass'){const deep=Math.max(...receiverIndices.map(i=>actors[i].z));z=(deep+actors[5].z)*.5;mult=clamp(1+(deep-actors[5].z-16)*.018,1,1.7)}
  // Keep contact in view until the next down; move closer only after possession.
  if(isDead){const strength=impactShake*.12;impactShake=Math.max(0,impactShake-dt*3.8);r.camera([camEye[0]+Math.sin(simTime*91)*strength,camEye[1]+Math.cos(simTime*73)*strength*.45,camEye[2]],camTarget);return}
  const tracking=phase==='run';
  // Center the pocket and move closer without enlarging athlete geometry.
  // Keep the existing wide/long-flight presentation and receiver-fit guard.
  const desiredEye=tracking?[carrier.x*.92+2.15,6.2,carrier.z-8.7]:[x+(isPocket?0:3.5*mult),(isPocket?6.05:8.0)*mult,(isPocket?snapZ:z)-(isPocket?20.2:24.5)*mult];
  const desiredTarget=tracking?[carrier.x*.92,.82,carrier.z+4.5]:[x,1.8,z];
  // Fit actual projected heads/feet above the pre-snap controls. Do not pan the QB away.
  if(isPocket){for(let trial=0;trial<8;trial++){r.camera(desiredEye,desiredTarget);const watch=phase==='pre'?actors.filter(p=>!p.team):[actors[5],...receiverIndices.map(i=>actors[i])];const fits=watch.every(p=>{const h=r.project([p.x,2.1,p.z]),f=r.project([p.x,0,p.z]);return h.y>65&&f.y<r.height-(phase==='pre'?85:22)&&h.x>24&&h.x<r.width-24});if(fits)break;desiredEye[1]*=1.055;desiredEye[2]=desiredTarget[2]+(desiredEye[2]-desiredTarget[2])*1.055}}
  if(tracking){for(let trial=0;trial<6;trial++){r.camera(desiredEye,desiredTarget);if(r.project([carrier.x,0,carrier.z]).y<r.height-90)break;desiredEye[1]*=1.045;desiredEye[2]=desiredTarget[2]+(desiredEye[2]-desiredTarget[2])*1.045}}
  const blend=phase==='pre'?Math.min(1,dt*10):Math.min(1,dt*5);camEye=camEye.map((v,i)=>v+(desiredEye[i]-v)*blend);camTarget=camTarget.map((v,i)=>v+(desiredTarget[i]-v)*blend);const strength=impactShake*.12;impactShake=Math.max(0,impactShake-dt*3.8);r.camera([camEye[0]+Math.sin(simTime*91)*strength,camEye[1]+Math.cos(simTime*73)*strength*.45,camEye[2]],camTarget);
 }
 function scene(dt,now){r.begin();stadium.draw();
  // Keep both snap markers fixed through contact; reset together for the next down.
  r.add('plane',pose(0,.025,snapZ,53.15,1,.11),hex('#4599ba'),'',true);
  r.add('plane',pose(0,.03,snapGainZ,53.15,1,.13),hex('#e1c156'),'',true);
  for(const p of actors){r.add('plane',pose(p.x+.13,.038,p.z-.12,1.65,1,1.15),[0,0,0,.75],'shadow',true)}
  if(carrier&&!ended){const cx=carrier.x,cz=carrier.z;for(let i=0;i<32;i++){const a=i/32*2*Math.PI,b=(i+1)/32*2*Math.PI;r.add('cylinder',segment([cx+Math.cos(a)*.70,.045,cz+Math.sin(a)*.70],[cx+Math.cos(b)*.70,.045,cz+Math.sin(b)*.70],.025),hex('#ebce7a'),'',true)}}
  if(phase==='pre'){
   const lists=mode==='run'?[RUNS[selected].path.map(p=>[p[0],snapZ+p[1]])]:PASSES[selected].routes.map((pts,i)=>pts.map(p=>[actors[receiverIndices[i]].startX+p[0],actors[receiverIndices[i]].startZ+p[1]]));
   lists.forEach((pts,i)=>{for(let j=1;j<pts.length;j++){const a=pts[j-1],b=pts[j];r.add('cylinder',segment([a[0],.052,a[1]],[b[0],.052,b[1]],.036),hex(['#d2bb75','#bcced4','#819fae'][i%3]),'',true)}})
  }
  if(!meshy.ready)for(const p of actors)drawAthlete(r,p,now/1000,phase);
  if(carrier?.hasBall&&!flight&&!ended){const[x,y,z,heading]=carriedBallAnchor(carrier,phase),fx=Math.sin(heading)*.17,fz=Math.cos(heading)*.17;r.add('cylinder',segment([x-fx,y,z-fz],[x+fx,y,z+fz],.105),hex('#713a22'),'',false,.72)}
  if(flight){const t=clamp(flight.t,0,1),p=flight.from.map((v,i)=>v+(flight.to[i]-flight.from[i])*t);p[1]+=Math.sin(Math.PI*t)*flight.arc;r.add('sphere',pose(...p,.12,.12,.23),hex('#7d4226'));r.add('plane',pose(p[0],.06,p[2],.45,1,.35),[0,0,0,.65],'shadow',true)}
  r.draw();meshy.draw(actors,phase,now/1000);
  if(phase==='pass'){
   const header=document.querySelector('header').getBoundingClientRect();
   const projected=receiverIndices.map(i=>({id:i,...r.project([actors[i].x,2.1,actors[i].z])}));
   const markers=layoutReceiverMarkers(projected,r.width,r.height,{left:header.left+22,right:header.right-22,top:header.bottom+28});
   markers.forEach((q,n)=>{const p=actors[q.id],button=$('target-'+q.id);if(!button)return;
    button.hidden=!q.visible;if(!q.visible)return;
    button.style.left=q.x+'px';button.style.top=q.y+'px';
    const dx=projected[n].x-q.x,dy=projected[n].y-q.y,tether=button.firstElementChild;
    tether.style.height=Math.max(0,Math.hypot(dx,dy)-3)+'px';
    tether.style.transform='rotate('+(-Math.atan2(dx,dy))+'rad)';
    button.classList.toggle('open',Math.min(...actors.filter(d=>d.team).map(d=>Math.hypot(d.x-p.x,d.z-p.z)))>2);
   });
  }
 }
 function simulate(dt){tick(dt);for(const p of actors)advanceMotion(p,dt,phase)}
 function loop(now){raf=requestAnimationFrame(loop);const dt=Math.min(.25,Math.max(0,(now-last)/1000)||.016);last=now;if(document.hidden||r.lost)return;if(!paused&&!qaStepping){accumulator+=dt;let steps=0;while(accumulator>=1/60&&steps++<15){simulate(1/60);accumulator-=1/60;if(paused)break}}camera(dt);scene(dt,now);if(now>messageUntil)$('message').classList.remove('show');frameId++}
 function setMode(v){if(phase!=='pre')return;mode=v;selected=0;setup()}
 $('runTab').onclick=()=>setMode('run');$('passTab').onclick=()=>setMode('pass');$('snap').onclick=snap;$('control').onclick=()=>{assist=!assist;input.x=input.z=0;updateControls()};$('pause').onclick=pause;$('resume').onclick=pause;document.querySelectorAll('#catchChoices button').forEach(button=>button.onclick=()=>chooseCatch(button.dataset.catch));
 $('restart').onclick=()=>{drive={...initialDrive};paused=false;ended=false;$('paused').hidden=true;setup()};
 function joy(e){const box=$('stick').getBoundingClientRect(),dx=e.clientX-box.left-box.width/2,dy=e.clientY-box.top-box.height/2,max=box.width*.32,len=Math.hypot(dx,dy)||1,s=Math.min(1,max/len);input.x=dx*s/max;input.z=-dy*s/max;$('knob').style.transform=`translate(${dx*s}px,${dy*s}px)`;$('stick').setAttribute('aria-valuenow',input.x.toFixed(2))}
 $('stick').onpointerdown=e=>{if((assist&&phase==='run')||!['pre','pass','run'].includes(phase))return;input.pointer=e.pointerId;$('stick').setPointerCapture(e.pointerId);joy(e);e.preventDefault()};$('stick').onpointermove=e=>{if(input.pointer!==e.pointerId)return;joy(e);e.preventDefault()};const clearJoy=()=>{input.x=input.z=0;input.pointer=null;$('knob').style.transform='none';$('stick').setAttribute('aria-valuenow','0')};$('stick').onpointerup=clearJoy;$('stick').onpointercancel=clearJoy;$('stick').onlostpointercapture=clearJoy;
 const clearSprint=e=>{if(e&&input.sprintPointer!==e.pointerId)return;input.sprint=false;input.sprintPointer=null};$('sprint').onpointerdown=e=>{input.sprint=true;input.sprintPointer=e.pointerId;$('sprint').setPointerCapture(e.pointerId);e.preventDefault()};$('sprint').onpointerup=clearSprint;$('sprint').onpointercancel=clearSprint;$('sprint').onlostpointercapture=clearSprint;window.addEventListener('pointerup',clearSprint);window.addEventListener('pointercancel',clearSprint);
 let skillGesture=null;const skillButton=$('juke');skillButton.onpointerdown=e=>{if(phase!=='run')return;skillGesture={id:e.pointerId,x:e.clientX,y:e.clientY,started:performance.now(),fired:false};skillButton.setPointerCapture(e.pointerId);e.preventDefault()};skillButton.onpointermove=e=>{if(!skillGesture||skillGesture.id!==e.pointerId||skillGesture.fired)return;const dx=e.clientX-skillGesture.x,dy=e.clientY-skillGesture.y;if(Math.hypot(dx,dy)<24)return;const action=skillMoveForGesture(dx,dy,0,carrier?.role==='QB');skillGesture.fired=true;performSkill(action);e.preventDefault()};const finishSkillGesture=(e,cancelled=false)=>{if(!skillGesture||skillGesture.id!==e.pointerId)return;const gesture=skillGesture;skillGesture=null;if(!cancelled&&!gesture.fired){const action=skillMoveForGesture(e.clientX-gesture.x,e.clientY-gesture.y,performance.now()-gesture.started,carrier?.role==='QB');if(action)performSkill(action)}e.preventDefault()};skillButton.onpointerup=e=>finishSkillGesture(e);skillButton.onpointercancel=e=>finishSkillGesture(e,true);skillButton.onlostpointercapture=e=>finishSkillGesture(e,true);skillButton.onclick=e=>{if(e.detail===0)performSkill('juke')};
 window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();const key=normalizeControlKey(e.key),receiverSlot=receiverSlotForKey(key);keys.add(key);if(e.code==='Space'&&!e.repeat)snap();if(receiverSlot>=0&&!e.repeat)throwTo(receiverIndices[receiverSlot],throwKindForModifiers(e.shiftKey,e.altKey));if(phase==='flight'&&!e.repeat&&key==='c')chooseCatch('secure');if(phase==='flight'&&!e.repeat&&key==='v')chooseCatch('aggressive');if(phase==='flight'&&!e.repeat&&key==='b')chooseCatch('rac');if(key==='Escape'&&!e.repeat)pause();if(key==='j'&&!e.repeat)performSkill('juke');if(key==='q'&&!e.repeat)performSkill('spin-left');if(key==='e'&&!e.repeat)performSkill('spin-right');if(key==='r'&&!e.repeat)performSkill('truck');if(key==='f'&&!e.repeat)performSkill(carrier?.role==='QB'?'slide':'hurdle')});window.addEventListener('keyup',e=>keys.delete(normalizeControlKey(e.key)));
 window.addEventListener('blur',()=>{keys.clear();clearSprint();clearJoy();if(!paused&&!ended)pause()});document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden&&!paused&&!ended)pause()});window.addEventListener('resize',()=>{r.resize();last=performance.now();if(innerHeight>innerWidth&&!paused&&!ended)pause()});window.addEventListener('pagehide',()=>cancelAnimationFrame(raf));window.addEventListener('pageshow',e=>{if(e.persisted){last=performance.now();raf=requestAnimationFrame(loop)}});
 const portrait=matchMedia('(orientation:portrait)');portrait.addEventListener('change',event=>{if(event.matches&&!paused&&!ended)pause()});
 setup();camera(1);scene(.016,0);$('loading').hidden=true;raf=requestAnimationFrame(loop);
 // Test controls exist only on an explicitly requested QA URL. This isolated
 // practice renderer never reads or writes career saves or result payloads.
 if(new URLSearchParams(location.search).has('qa')){window.bk3dTest={manualFrames(){qaStepping=true;accumulator=0;cancelAnimationFrame(raf)},step(seconds){const n=Math.ceil(clamp(seconds,0,10)*60);for(let i=0;i<n;i++){if(!paused)simulate(1/60);camera(1/60)}scene(.016,performance.now())},setSnapNumber(value){if(phase!=='pre')return false;drive.plays=Math.max(0,Math.trunc(Number(value)||0));setup();camera(1);scene(.016,performance.now());return true}};window.bk3dDiagnostics=()=>{const qb=actors[5],nearest=Math.min(...actors.filter(p=>p.team===1&&!p.engaged&&(p.role==='DL'||defensiveCall.blitzers.includes(p.index))).map(p=>Math.hypot(p.x-qb.x,p.z-qb.z)),8);return({phase,mode,selected,assist,elapsed,simTime,paused,ended,lastSkill,lastTackler,catchStyle,defense:{index:defensiveCallIndex,id:defensiveCall.id,name:defensiveCall.name,coverage:defensiveCall.coverage,blitzers:[...defensiveCall.blitzers]},throwKind:flight?.kind||null,pocketPressure:phase==='pass'?pocketPressure(nearest,elapsed):0,frames:frameId,drawCalls:r.drawCalls,glError:r.gl.getError(),athletes:meshy.diagnostics(),players:actors.map(p=>({role:p.role,team:p.team,ratings:p.ratings,x:p.x,z:p.z,vx:p.vx,vz:p.vz,distance:p.distance,heading:p.heading,hasBall:p.hasBall,engaged:p.engaged,engagedWith:p.engagedWith,fallen:p.fallen,action:p.action,actionT:p.actionT,catchStyle:p.catchStyle,pose:p.motion?{speed:p.motion.speed,run:p.motion.run,ready:p.motion.ready,block:p.motion.block,turn:p.motion.turn,gait:p.motion.gait,fall:p.motion.fall}:null,head:r.project([p.x,2.1,p.z]),foot:r.project([p.x,0,p.z])})),drive:{...drive},field:{scrimmage:snapZ,lineToGain:snapGainZ},stamina,worldObjects:stadium.parts})};}
}
