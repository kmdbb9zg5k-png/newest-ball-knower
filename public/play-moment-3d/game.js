import{Renderer,pose,segment,hex}from'./renderer.js';
import{drawAthlete,prepareJerseys,advanceMotion}from'./athlete.js?v=football-finish-20';
import{createMeshyAthletes}from'./meshy-athlete.js?v=football-finish-20';
import{makeStadium}from'./stadium.js';
import{createGameplayReplayRecorder}from'./replay.js';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
/** The established first-down target, in the drive's 0–100 field coordinates.
 * Using ball + toGo preserves goal-to-go even after a loss beyond the ten.
 */
export function lineToGain(drive){return Math.min(100,drive.ball+drive.toGo)}
/** Format the series without confusing short yardage with goal-to-go. */
export function downDistanceLabel(drive){const ord=['1ST','2ND','3RD','4TH'];return ord[Math.min(3,drive.down-1)]+' & '+(lineToGain(drive)===100?'GOAL':drive.toGo)}
export function cameraWorldVector(screenX,screenZ,eye,target){const fx=target[0]-eye[0],fz=target[2]-eye[2],l=Math.hypot(fx,fz)||1;return[(-fz*screenX+fx*screenZ)/l,(fx*screenX+fz*screenZ)/l]}
export function normalizeControlKey(key){return typeof key==='string'&&key.length===1?key.toLowerCase():key}
/** Let a preview link opt into assisted running without changing the default mode. */
export function initialAssistMode(search=''){return new URLSearchParams(search).get('assist')!=='0'}
export function gameplayInstruction({phase,mode='run',assist=true,qbRunner=false}={}){
 if(phase==='pre')return mode==='pass'?'CHOOSE A ROUTE · SNAP THE BALL':'AIM RUN DIRECTION WITH THE STICK · SNAP';
 if(phase==='snap')return'WATCH THE EXCHANGE';
 if(phase==='handoff')return assist?'HANDOFF · AUTO ROUTE ACTIVE':'HOLD THE STICK THROUGH THE HANDOFF';
 if(phase==='pass')return'MOVE THE QB · PICK A RECEIVER · PUMP OR THROW AWAY';
 if(phase==='flight')return'CHOOSE YOUR CATCH · SECURE, AGGRESSIVE OR RUN';
 if(phase==='run')return assist&&!qbRunner?'AUTO RUNNING · TAP A MOVE OR SPRINT':'STEER · SPRINT · JUKE · SPIN · POWER';
 if(phase==='dead')return'PLAY OVER · SETTING UP THE NEXT DOWN';
 return'';
}
export function receiverSlotForKey(key){const slot={x:0,y:1,z:2,'1':0,'2':1,'3':2,'4':3,'5':4}[normalizeControlKey(key)];return Number.isInteger(slot)?slot:-1}
export function catchBreakupChance(separation){return separation<.7?.9:separation<1.2?.68:separation<2?.3:.04}
export function defenderPursuitSpeed(separation,afterCatch=false){const base=afterCatch?7.65:6.8,ceiling=afterCatch?8.85:8.55;return clamp(base+Math.max(0,separation-1)*(afterCatch?.14:.11),base,ceiling)}
/** A defender's running speed comes from his ratings, not his distance to the ball. */
export function defenderRunSpeed(defender){return 8.65*ratingMultiplier(defender.ratings?.speed??82,.78,1.10)}
export function tackleRadius(possessionSeconds,afterCatch=false){const grace=afterCatch?.18:.55;if(possessionSeconds<grace)return 0;return afterCatch?1.05:.86}
/** Require real convergence before a tackle begins so parallel runners do not
 * magnetically snap into contact. Very close body contact still counts. */
export function tackleContactEligible(defender,runner,radius){
 const dx=(runner.x||0)-(defender.x||0),dz=(runner.z||0)-(defender.z||0),distance=Math.hypot(dx,dz);
 if(!radius||distance>=radius)return false;
 if(distance<=.62)return true;
 const inv=1/(distance||1),closing=((defender.vx||0)-(runner.vx||0))*dx*inv+((defender.vz||0)-(runner.vz||0))*dz*inv;
 return closing>.35;
}
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
export function canThrowAway(qbX){return Math.abs(Number(qbX)||0)>6}
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
/** Blend a held manual direction into the exchange so control starts at the
 * snap instead of waiting for the handoff animation to finish. */
export function handoffControlPoint(startX,startZ,meshX,meshZ,progress,inputX,inputZ){
 const t=clamp(Number(progress)||0,0,1),ease=t*t*(3-2*t),magnitude=Math.min(1,Math.hypot(inputX,inputZ)),nx=magnitude?inputX/magnitude:0,nz=magnitude?inputZ/magnitude:0,influence=clamp(t*1.35,0,1)*magnitude;
 return{x:startX+(meshX-startX)*ease+nx*.82*influence,z:startZ+(meshZ-startZ)*ease+nz*.46*influence};
}
/** Return an equal, opposite correction for two non-contact actors that have
 * visually overlapped. Blocking and tackle pairs deliberately opt out. */
export function separationCorrection(ax,az,bx,bz,minDistance=.72,seed=1){
 let dx=bx-ax,dz=bz-az,distance=Math.hypot(dx,dz);if(distance>=minDistance)return{ax:0,az:0,bx:0,bz:0};
 let directionLength=distance;if(distance<1e-5){const angle=(Number(seed)||1)*2.399963229728653;dx=Math.cos(angle);dz=Math.sin(angle);directionLength=1;distance=0}
 const push=(minDistance-distance)*.5,nx=dx/directionLength,nz=dz/directionLength;return{ax:-nx*push,az:-nz*push,bx:nx*push,bz:nz*push};
}
/** Frame-rate-independent camera damping. */
export function cameraFollowBlend(dt,rate=5){return 1-Math.exp(-Math.max(0,Number(rate)||0)*clamp(Number(dt)||0,0,.25))}
/** Damp camera travel with a speed limit, including changes of possession. */
export function cameraTravel(current,target,dt,rate=3,maxSpeed=24){
 const delta=target.map((v,i)=>v-current[i]),distance=Math.hypot(...delta),blend=Math.min(cameraFollowBlend(dt,rate),maxSpeed*Math.max(0,dt)/Math.max(distance,.001));
 return current.map((v,i)=>v+delta[i]*blend);
}
/** Compose a closer, lower live-run camera around the ball carrier. */
export function runCameraFraming(x,z){return{eye:[x*.96+.7,5.5,z-7.3],target:[x*.96,1.2,z+3.5]}}
/** Interpolate presentation only. Input, collisions and the replay recorder
 * continue to use the authoritative 60 Hz simulation coordinates. */
export function interpolatePresentation(previous,current,alpha,out={}){
 Object.assign(out,current);if(!previous)return out;const t=clamp(alpha,0,1);
 for(const key of['x','z','vx','vz','distance'])if(Number.isFinite(previous[key])&&Number.isFinite(current[key]))out[key]=previous[key]+(current[key]-previous[key])*t;
 out.heading=previous.heading+Math.atan2(Math.sin(current.heading-previous.heading),Math.cos(current.heading-previous.heading))*t;
 if(previous.action===current.action)out.actionT=previous.actionT+(current.actionT-previous.actionT)*t;
 if(previous.motion&&current.motion){out.motion={...current.motion};for(const key of['speed','run','turn','gait','stridePhase','fall','block'])if(Number.isFinite(previous.motion[key])&&Number.isFinite(current.motion[key]))out.motion[key]=previous.motion[key]+(current.motion[key]-previous.motion[key])*t;}
 return out;
}
/** Keep run concepts as coaching for Assist mode; Manual always obeys the player's stick. */
export function carrierControlVector(assist,inputX,inputZ,guideX=0,guideZ=0){
 const manualMagnitude=Math.hypot(inputX,inputZ);
 if(!assist){if(!manualMagnitude)return{x:0,z:0,manual:false};return{x:inputX/manualMagnitude,z:inputZ/manualMagnitude,manual:true}}
 const guideMagnitude=Math.hypot(guideX,guideZ);
 if(!guideMagnitude)return{x:0,z:1,manual:false};
 return{x:guideX/guideMagnitude,z:guideZ/guideMagnitude,manual:false};
}
/** Preserve a pre-snap direction briefly if mobile Safari cancels the held stick touch. */
export function openingRunControl(assist,inputX,inputZ,latchedX,latchedZ,guideX=0,guideZ=0,bufferActive=false){
 if(!assist&&bufferActive&&Math.hypot(inputX,inputZ)<.12&&Math.hypot(latchedX,latchedZ)>=.12){
  return carrierControlVector(false,latchedX,latchedZ,guideX,guideZ);
 }
 return carrierControlVector(assist,inputX,inputZ,guideX,guideZ);
}
/** Quantify a stick reversal so fast players still have to plant before a hard cut. */
export function cutSeverity(vx,vz,inputX,inputZ){
 const speed=Math.hypot(vx,vz),input=Math.hypot(inputX,inputZ);if(speed<3.4||input<.52)return 0;
 const dot=clamp((vx*inputX+vz*inputZ)/(speed*input),-1,1);return clamp((.72-dot)/1.72,0,1);
}
/** Resolve a block once per engagement rather than locking every matchup identically. */
export function blockOutcome(blockRating,shedRating,leverage=0,roll=.5){
 const edge=(Number(blockRating)-Number(shedRating))/100+Number(leverage||0),r=clamp(Number(roll)||0,0,1);
 if(r<clamp(.16-edge*.32,.05,.36))return'shed';
 if(edge>.18&&r>clamp(.995-edge*.045,.95,.99))return'pancake';
 return edge>.08?'steer':'stalemate';
}
/** A live knockdown has a finite hold and get-up; dead-ball tackles keep their finish. */
export function knockDownPlayer(p,time,type='miss',duration=.58,side=1){
 p.fallen=true;p.vx=p.vz=0;p.moving=false;p.engaged=false;p.engagedWith=null;p.blockStyle=null;
 Object.assign(p,{action:type,actionStarted:time,actionUntil:time+duration,actionT:0,actionSide:side});
}
/** Clear live-play overlays even when a catch immediately becomes a touchdown. */
export function releasePostPlay(p){
 p.engaged=false;p.engagedWith=null;p.blockStyle=null;p.ballTarget=null;p.sprinting=false;
 p.throwT=0;p.throwStyle=null;p.catchT=0;p.reactionT=0;p.reactionSide=0;p.routeStyle=null;p.coverageStyle=null;
 if(!p.fallen){p.action=null;p.actionT=0;p.contactWith=null;p.contactRole=null}
}
export function advancePlayerAction(p,time,dead=false){
 if(!p.action||!Number.isFinite(p.actionStarted)||!Number.isFinite(p.actionUntil))return;
 p.actionT=clamp((time-p.actionStarted)/Math.max(.001,p.actionUntil-p.actionStarted),0,1);
 if(p.action==='get-up'&&p.recoveryStart&&p.recoveryOffset){const step=smooth((p.actionT-.18)/.72);p.x=p.recoveryStart[0]+p.recoveryOffset[0]*step;p.z=p.recoveryStart[1]+p.recoveryOffset[1]*step}
 if(time<p.actionUntil)return;
 if(p.fallen){
  if(dead){p.actionT=1;return}
  if(p.action==='get-up'){p.fallen=false;p.fallHeading=undefined;p.recoveryStart=null;p.recoveryOffset=null;p.contactWith=null;p.contactRole=null;p.contactReady=time+.2;p.action=null;p.actionT=0;p.actionSide=0;return}
  if(time<p.actionUntil+.45){p.actionT=1;return}
  p.recoveryStart=[p.x,p.z];p.contactWith=null;p.contactRole=null;p.action='get-up';p.actionStarted=time;p.actionUntil=time+1.1;p.actionT=0;return;
 }
 p.action=null;p.actionT=0;p.actionSide=0;p.contactRole=null;p.contactWith=null;
}
/** Swap the default Mike assignment without duplicating a second-level target. */
export function identifyMikeAssignments(assignments,mikeIndex=16){
 const mike=clamp(Math.trunc(mikeIndex)||16,15,17);return assignments.map(([blocker,defender])=>[blocker,defender===16?mike:defender===mike?16:defender]);
}
export const QB_LATERAL_LIMIT=12;
/** Give each pursuit player a collapsing lane so the defense surrounds a
 * runner instead of forming an artificial single-file chase line. */
export function pursuitLaneOffset(defenderIndex,separation,runnerX=0){
 const lanes=[-2.25,1.85,-1.45,1.4,-1.0,.88,-2.65,2.45,-1.85,1.75,-.52],slot=Number.isFinite(Number(defenderIndex))?Math.trunc(Number(defenderIndex))-11:-1;
 if(slot<0||slot>=lanes.length)return 0;
 const collapse=clamp((Number(separation)-1.05)/7.25,.08,1),sidelineRoom=clamp((26-Math.abs(Number(runnerX)||0))/7,.28,1);
 return lanes[slot]*collapse*sidelineRoom;
}
/** Solve a bounded interception time using the defender's actual speed budget.
 * No catch-up teleport or speed bonus: beaten defenders still have to run. */
export function pursuitTarget(defender,runner,afterCatch=false,pursuitSpeed=null,role='primary'){
 const dx=runner.x-defender.x,dz=runner.z-defender.z,vx=runner.vx||0,vz=runner.vz||0,separation=Math.hypot(dx,dz),speed=pursuitSpeed??defenderPursuitSpeed(separation,afterCatch);
 const a=vx*vx+vz*vz-speed*speed,b=2*(dx*vx+dz*vz),c=dx*dx+dz*dz,disc=b*b-4*a*c;
 let intercept=separation/Math.max(speed,1);
 if(Math.abs(a)<.0001){if(b<-.0001)intercept=-c/b}
 else if(disc>=0){const roots=[(-b-Math.sqrt(disc))/(2*a),(-b+Math.sqrt(disc))/(2*a)].filter(t=>t>0);if(roots.length)intercept=Math.min(...roots)}
 const runnerSpeed=Math.hypot(vx,vz),fx=runnerSpeed>.5?vx/runnerSpeed:0,fz=runnerSpeed>.5?vz/runnerSpeed:1;
 const ahead=(defender.x-runner.x)*fx+(defender.z-runner.z)*fz;
 // Deep defenders keep a reachable intercept instead of charging the current
 // ball position. Trailing support keeps its own shoulder until contact range.
 const lead=clamp(intercept,.08,ahead>1.5?4:2.4)*clamp((separation-.65)/3,0,1),collapse=clamp((separation-2.5)/7,0,1);
 const lateral=(defender.x-runner.x)*fz-(defender.z-runner.z)*fx,side=Math.sign(lateral)||Math.sign(pursuitLaneOffset(defender.index,separation,runner.x))||1;
 const lane=role==='primary'?0:side*(role==='contain'?.55:1.65)*collapse;
 return{x:clamp(runner.x+vx*lead+fz*lane,-25.8,25.8),z:clamp(runner.z+vz*lead-fx*lane,0,112)};
}
/** Nearest defender attacks; a deeper outside defender keeps containment. */
export function pursuitRole(defender,runner,teammates){
 const free=teammates.filter(p=>p.team===defender.team&&!p.fallen&&!p.engaged),distance=p=>Math.hypot(p.x-runner.x,p.z-runner.z),nearest=free.reduce((best,p)=>!best||distance(p)<distance(best)?p:best,null);
 if(nearest===defender||distance(defender)<3)return'primary';
 const speed=Math.hypot(runner.vx||0,runner.vz||0),fx=speed>.5?runner.vx/speed:0,fz=speed>.5?runner.vz/speed:1;
 return (defender.x-runner.x)*fx+(defender.z-runner.z)*fz>1.5?'contain':'support';
}
/** Avoid teammates before overlap resolution, while converging for a tackle. */
export function pursuitSteering(defender,runner,teammates,speed,afterCatch=false){
 const role=pursuitRole(defender,runner,teammates),aim=pursuitTarget(defender,runner,afterCatch,speed,role),dx=aim.x-defender.x,dz=aim.z-defender.z,len=Math.hypot(dx,dz)||1;
 let x=dx/len,z=dz/len;const contact=Math.hypot(runner.x-defender.x,runner.z-defender.z),strength=clamp((contact-1)/4,0,.95);
 for(const other of teammates){if(other===defender||other.team!==defender.team||other.fallen||other.engaged)continue;const ox=defender.x-other.x,oz=defender.z-other.z,d=Math.hypot(ox,oz);if(d>.001&&d<2.1){const weight=(1-d/2.1)*strength;x+=ox/d*weight;z+=oz/d*weight}}
 const norm=Math.hypot(x,z)||1;return{x:x/norm,z:z/norm};
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
 const momentum=clamp(Number(context.momentum)||0,0,1),angle=clamp(Number(context.angle)||0,0,1),gang=Math.max(0,Number(context.gang)||0),skill=context.skill||null,roll=clamp(Number.isFinite(context.roll)?context.roll:.5,0,1),distance=Math.max(0,Number(context.distance)||0),defenderMomentum=clamp(Number(context.defenderMomentum)||0,0,1);
 const runner=(carrierRatings.breakTackle*.42+carrierRatings.strength*.22+carrierRatings.agility*.13+carrierRatings.carrying*.13)/100+momentum*.16+({truck:.18,spin:.12,juke:.1,hurdle:.06}[skill]||0);
 const tackler=(defenderRatings.tackle*.46+defenderRatings.strength*.22+defenderRatings.awareness*.13)/100+angle*.17+Math.min(gang,2)*.055;
 const edge=runner-tackler,escape=clamp(.16+edge*.72,.04,.62),miss=clamp(.04+(1-angle)*.13+(skill==='juke'||skill==='spin'?.09:0),.03,.28);
 if(roll<miss)return{type:'miss',edge};
 if(roll<miss+escape)return{type:'broken',edge};
 const bigHit=defenderRatings.strength+defenderRatings.tackle>178&&momentum<.72&&roll>.86;
 const gangTackle=gang>=2||(gang>=1&&edge<-.08&&roll>.82);
 const dive=!bigHit&&gang<1&&distance>.68&&defenderMomentum>.76&&angle>.62&&roll>.58;
 const stumble=!bigHit&&!dive&&gang<1&&edge>-.12&&momentum>.48&&roll>.52&&roll<.74;
 return{type:bigHit?'big-hit':gangTackle?'gang':dive?'dive':stumble?'stumble':'wrap',edge};
}
/** Presentation timing for a completed tackle. Gameplay owns the spot; this
 * only lets the carrier, tackler and optional helper finish the contact. */
export function contactPresentation(type,momentum=0,side=1){
 const speed=clamp(Number(momentum)||0,0,1),direction=Math.sign(Number(side)||1)||1;
 const profiles={
  wrap:{duration:1.08,carrierDrive:.38+speed*.30,tacklerDrive:.20,spread:.22,helper:false,shake:1},
  gang:{duration:1.2,carrierDrive:.24+speed*.22,tacklerDrive:.16,spread:.48,helper:true,shake:1.12},
  dive:{duration:.74,carrierDrive:.52+speed*.34,tacklerDrive:.11,spread:.14,helper:false,shake:1.18},
  'big-hit':{duration:.68,carrierDrive:.72+speed*.42,tacklerDrive:.08,spread:.16,helper:false,shake:1.35},
 };
 return Object.freeze({...profiles[type]||profiles.wrap,side:direction,type:profiles[type]?type:'wrap'});
}
export function coverageShell(playIndex){return['man','quarters','zone','robber'][clamp(Math.trunc(playIndex)||0,0,3)]}
export const DEFENSIVE_CALLS=Object.freeze([
 Object.freeze({id:'over-three',name:'4-3 OVER',coverage:'zone',pursuit:.98,blitzers:Object.freeze([]),reads:Object.freeze([.58,.76,.64]),fits:Object.freeze([-.7,.25,.85]),alignments:Object.freeze([[-5.8,.75],[-1.8,1],[1.4,.85],[5.7,1.1],[-7.2,5.3],[.8,5.6],[8.4,5.4],[-20,3.2],[-11.4,9.8],[20.5,4.2],[7.5,17.5]])}),
 Object.freeze({id:'under-man',name:'SAM PRESSURE',coverage:'man',pursuit:1.01,blitzers:Object.freeze([15]),reads:Object.freeze([.5,.7,.82]),fits:Object.freeze([-.95,-.2,.55]),alignments:Object.freeze([[-5.1,1],[-1,.7],[2.4,1],[5.8,.75],[-7.8,4.5],[-.8,4.9],[7.2,6.1],[-20.8,2.8],[-12,6.7],[20.8,3.1],[8.5,14.5]])}),
 Object.freeze({id:'nickel-quarters',name:'NICKEL QUARTERS',coverage:'quarters',pursuit:.94,blitzers:Object.freeze([]),reads:Object.freeze([.72,.84,.68]),fits:Object.freeze([-.35,.65,1.05]),alignments:Object.freeze([[-6.2,.85],[-2.1,.8],[2.1,.8],[6.2,.85],[-6.5,6.5],[1.1,6.8],[9.8,4.1],[-21,4.8],[-10.5,11.8],[20.5,5.1],[0,18.5]])}),
 Object.freeze({id:'double-a-robber',name:'DOUBLE A ROBBER',coverage:'robber',pursuit:1.03,blitzers:Object.freeze([16,17]),reads:Object.freeze([.46,.34,.48]),fits:Object.freeze([-.55,-.1,.55]),alignments:Object.freeze([[-5.6,.8],[-2.2,1],[2.2,1],[5.6,.8],[-7,4.8],[-1.15,2.8],[1.15,2.8],[-20.5,3.4],[-11.5,8.2],[20.5,3.4],[6.5,13.2]])}),
 Object.freeze({id:'edge-fire-three',name:'EDGE FIRE 3',coverage:'zone',pursuit:1.02,blitzers:Object.freeze([17]),reads:Object.freeze([.56,.8,.42]),fits:Object.freeze([-.8,.2,1.2]),alignments:Object.freeze([[-7.2,.5],[-2.3,.95],[1.5,.9],[6.8,.45],[-8.8,5.8],[0,7.2],[7.4,3.25],[-21.2,5.8],[-8.8,10.8],[20.8,5.7],[4.2,16.4]])}),
 Object.freeze({id:'press-trap',name:'PRESS TRAP',coverage:'man',pursuit:.99,blitzers:Object.freeze([15]),reads:Object.freeze([.44,.72,.62]),fits:Object.freeze([-.9,.05,.72]),alignments:Object.freeze([[-5.2,.65],[-1.8,.65],[1.8,.65],[5.2,.65],[-8.5,3.15],[0,5.4],[8.2,5.2],[-20.8,1.9],[-11.8,4.7],[20.8,2],[1.8,15.4]])}),
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
/** Receivers stalk the force defenders instead of jogging through a run play. */
export function perimeterBlockAssignments(runIndex=0){return[
 [[7,18],[9,20]],
 [[8,19],[9,20]],
 [[7,18],[8,19]],
 [[8,19],[9,20]],
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
export function runConceptDirection(runIndex,seconds,runnerX,runnerZ,scrimmageZ,direction=1){const concept=RUNS[clamp(Math.trunc(runIndex)||0,0,RUNS.length-1)],point=travel(concept.path,Math.max(0,seconds)*concept.pathSpeed+concept.pathLead),side=Math.sign(direction)||1,targetX=point[0]*side,dx=targetX-runnerX,dz=scrimmageZ+point[1]-runnerZ,length=Math.hypot(dx,dz)||1;return{x:dx/length,z:dz/length,targetX,targetZ:scrimmageZ+point[1]}}
export function predictPassDestination(path,startX,startZ,elapsed,duration,speed){const p=travel(path,Math.max(0,elapsed+duration)*speed);return[clamp(startX+p[0],-26.3,26.3),1.6,startZ+p[1]]}
export function start(){
 const r=new Renderer($('game')),stadium=makeStadium(r),meshy=createMeshyAthletes(r);let actors=[],frameId=0,elapsed=0,last=0,raf=0,messageUntil=0,recoveryLeft=0,postPlayElapsed=0,exchange=null,transitionFade=0,activeContact=null,pendingPlayMessage=null,pendingDriveEnd=null,soundContext=null,highlightFrames=[],lastHighlight=[],highlightSampleAt=-1,replaying=false,replayCursor=0,replayEndPhase='dead';
 let mode='run',selected=0,assist=initialAssistMode(location.search),phase='pre',paused=false,ended=false,flight=null,lastFlightEnd=null,looseBall=null,carrier=null,jukeUntil=0,jukeReady=0,simTime=0,lastSkill=null,lastSkillAt=-10,impactShake=0,catchStyle='rac',runDirection=1,mikeIndex=16,motioned=false,pumpReady=0,plantReady=0,turfFx=[],nextTurfFx=0,contactFx=null;
 const redZone=new URLSearchParams(location.search).get('scenario')==='redzone';
 const initialDrive={ball:redZone?85:25,down:1,toGo:10,clock:redZone?63:78,score:24,plays:0};
 let drive={...initialDrive},snapZ=10+initialDrive.ball,snapGainZ=10+lineToGain(initialDrive),stamina=1;
 let input={x:0,z:0,sprint:false,pointer:null,sprintPointer:null},snapDirection={x:0,z:0},snapDirectionUntil=0,camEye=[14,16,10],camTarget=[0,0,40],runCameraBlend=0,runCameraStart=null,flightCameraStart=null,deadCameraStart=null,defensiveCallIndex=0,defensiveCall=DEFENSIVE_CALLS[0],lastTackler=null;const keys=new Set();
 let qaStepping=false;let accumulator=0;let numSeed=175;const rand=()=>{numSeed=(Math.imul(numSeed,1664525)+1013904223)>>>0;return numSeed/4294967296};
 let previousPresentation=null,previousPresentationPhase=null,previousExchange=null,previousFlight=null,presentationSource=null,presentationActors=[];
 const specs=[['OL',-4.4,-.35,71],['OL',-2.2,-.35,64],['OL',0,-.35,55],['OL',2.2,-.35,68],['OL',4.4,-.35,79],['QB',0,-5,12],['RB',-2,-7,24],['WR',-21,0,11],['WR',-12,-.6,18],['WR',21,0,84],['TE',6.5,-.4,87],['DL',-5,.8,90],['DL',-1.7,.8,94],['DL',1.7,.8,97],['DL',5,.8,92],['LB',-8,5,53],['LB',0,5,54],['LB',8,5,58],['DB',-20,3,21],['DB',-12,9,23],['DB',20,4,29],['DB',8,17,31]];
 const receiverIndices=[7,8,9,10,6],receiverLabels=['X','Y','Z','A','B'];
  const replay=createGameplayReplayRecorder(()=>({simTime,phase,mode,selected,drive,input,assist,defense:defensiveCall.id,carrierIndex:carrier?.index??-1,lastSkill,runDirection,mikeIndex,motioned,players:actors}));
  const liveBallAnchor=(player,anchorPhase=phase)=>meshy.ballAnchor(player,anchorPhase)?.center||carriedBallAnchor(player,anchorPhase).slice(0,3);
  function setup(){messageUntil=0;$('message').classList.remove('show');snapZ=10+drive.ball;snapGainZ=10+lineToGain(drive);defensiveCall=situationalDefensiveCall(drive);defensiveCallIndex=DEFENSIVE_CALLS.indexOf(defensiveCall);runDirection=1;mikeIndex=16;motioned=false;plantReady=simTime;snapDirection={x:0,z:0};snapDirectionUntil=0;postPlayElapsed=0;runCameraBlend=0;runCameraStart=null;flightCameraStart=null;deadCameraStart=null;pendingPlayMessage=null;pendingDriveEnd=null;lastFlightEnd=null;looseBall=null;exchange=null;actors=specs.map(([role,x,z,number],index)=>({index,role,number,team:index>=11?1:0,ratings:playerRatings(role,index,index>=11?1:0),x,z:snapZ+z,startX:x,startZ:snapZ+z,heading:index>=11?Math.PI:0,vx:0,vz:0,distance:0,moving:false,sprinting:false,engaged:false,engagedWith:null,blockStyle:null,blockResult:null,blockResolvedAt:-1,routeStyle:null,coverageStyle:null,fallen:false,hasBall:index===2,throwT:0,throwStyle:null,catchT:0,catchStyle:null,action:null,actionT:0,actionSide:0,reactionT:0,reactionSide:0,contactReady:0}));defensiveCall.alignments.forEach(([x,z],i)=>{const p=actors[11+i];p.x=p.startX=x;p.z=p.startZ=snapZ+z});actors[2].ballTarget=[actors[2].x,.42,actors[2].z-.2];carrier=actors[5];flight=null;activeContact=null;phase='pre';stamina=1;elapsed=0;impactShake=0;turfFx=[];nextTurfFx=0;contactFx=null;catchStyle='rac';input={x:0,z:0,sprint:false,pointer:null,sprintPointer:null};keys.clear();$('knob').classList.remove('held');$('knob').style.transform='none';$('stick').setAttribute('aria-valuenow','0');$('stamina').firstElementChild.style.width=(mode==='pass'?0:100)+'%';jukeUntil=0;jukeReady=simTime;lastSkill=null;lastSkillAt=-10;prepareJerseys(r,actors);updateHud();updateControls();renderPlays();replay.event('setup',{down:drive.down,ball:drive.ball,defense:defensiveCall.id});replay.sample(true)}
 function updateHud(){$('score').textContent=drive.score;$('clock').textContent=Math.floor(Math.max(0,drive.clock)/60)+':'+String(Math.floor(Math.max(0,drive.clock)%60)).padStart(2,'0');$('down').textContent=downDistanceLabel(drive)+' · '+(drive.ball<50?'OWN '+drive.ball:drive.ball===50?'50':'OPP '+(100-drive.ball))}
  function renderPlays(){const plays=mode==='run'?RUNS:PASSES;$('plays').replaceChildren();plays.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.className=i===selected?'selected':'';b.innerHTML='<svg viewBox="0 0 48 28" aria-hidden="true"><path d="'+p.icon+'"/></svg><b>'+p.name+'</b>';b.onclick=()=>{if(phase!=='pre')return;selected=i;replay.event('play-select',{mode,play:p.id});renderPlays()};$('plays').appendChild(b)});$('playName').textContent=plays[selected].name;$('runTab').classList.toggle('selected',mode==='run');$('passTab').classList.toggle('selected',mode==='pass')}
  function chooseCatch(style){if(!CATCH_STYLES[style])return;catchStyle=style;replay.event('catch-style',{style});document.querySelectorAll('#catchChoices button').forEach(button=>button.classList.toggle('selected',button.dataset.catch===style));if(phase==='flight')$('instruction').textContent=CATCH_STYLES[style].label+' CATCH SELECTED'}
 function flipPlay(){if(phase!=='pre')return;runDirection*=-1;$('flipPlay').classList.toggle('active',runDirection<0);replay.event('pre-snap',{adjustment:'flip',direction:runDirection});renderPlays();message(runDirection<0?'PLAY FLIPPED LEFT':'PLAY FLIPPED RIGHT',.7)}
 function motionReceiver(){if(phase!=='pre')return;const receiver=actors[8],homeX=specs[8][1];motioned=!motioned;receiver.startX=receiver.x=motioned?-homeX:homeX;receiver.action=motioned?'motion':null;receiver.heading=motioned?-Math.PI/2:Math.PI/2;$('motionReceiver').classList.toggle('active',motioned);replay.event('pre-snap',{adjustment:'motion',receiver:receiver.index,active:motioned});message(motioned?'Y RECEIVER MOTIONED ACROSS':'MOTION RESET',.7)}
 function identifyMike(){if(phase!=='pre')return;mikeIndex=mikeIndex===17?15:mikeIndex+1;$('identifyMike').textContent='MIKE '+actors[mikeIndex].number;$('identifyMike').classList.toggle('active',mikeIndex!==16);replay.event('pre-snap',{adjustment:'mike',defender:mikeIndex});message('MIKE '+actors[mikeIndex].number+' IDENTIFIED',.75)}
 function pumpFake(){if(phase!=='pass'||simTime<pumpReady)return;const qb=actors[5];pumpReady=simTime+1.35;qb.throwT=.001;qb.throwStyle='pump';setTimedAction(qb,'pump',.34,0);for(const d of actors.filter(p=>p.team===1&&!defensiveCall.blitzers.includes(p.index))){if(Math.hypot(d.x-qb.x,d.z-qb.z)<22){d.reactionT=.001;d.reactionSide=Math.sign(qb.x-d.x)||1}}replay.event('pump-fake',{pressure:pocketPressure(Math.min(...actors.filter(p=>p.team===1&&!p.engaged).map(p=>Math.hypot(p.x-qb.x,p.z-qb.z)),8),elapsed)});message('PUMP FAKE · COVERAGE FROZEN',.65);navigator.vibrate?.(10)}
 function updateControls(){
  $('pre').hidden=phase!=='pre'||ended;$('live').hidden=!['pre','snap','handoff','pass','flight','run'].includes(phase)||paused||ended;$('live').dataset.phase=phase;$('hud').dataset.phase=phase;$('hud').dataset.assist=String(assist);$('catchChoices').hidden=phase!=='flight'||!flight||flight.t<.28;
  $('flipPlay').classList.toggle('active',runDirection<0);$('motionReceiver').classList.toggle('active',motioned);$('identifyMike').textContent='MIKE '+(actors[mikeIndex]?.number||54);$('identifyMike').classList.toggle('active',mikeIndex!==16);
  $('stick').setAttribute('aria-label',phase==='pre'?'Set movement direction before the snap':phase==='handoff'?'Keep holding movement through the handoff':phase==='pass'?'Move quarterback':'Move ball carrier');const qbRunner=phase==='run'&&carrier?.role==='QB';
  $('instruction').textContent=gameplayInstruction({phase,mode,assist,qbRunner});
  $('airMove').textContent=qbRunner?'SLIDE':'HURDLE';$('airMove').dataset.skill=qbRunner?'slide':'hurdle';$('power').textContent='TRUCK';$('throwAway').classList.remove('ready');$('throwAway').dataset.ready='false';$('throwAway').setAttribute('aria-label','Throwaway unavailable. Leave the pocket first.');$('control').textContent=(assist?'AUTO RUN':'MANUAL')+' ●';$('control').setAttribute('aria-pressed',String(assist));$('control').setAttribute('aria-label','Running control: '+(assist?'automatic':'manual')+'. Tap to change.');const stickDisabled=assist&&(phase==='run'||phase==='handoff');$('stick').style.opacity=stickDisabled?'.3':'1';$('stick').style.pointerEvents=stickDisabled?'none':'auto';$('targetLayer').replaceChildren();
  if(phase==='pass')receiverIndices.forEach((index,i)=>{const b=document.createElement('button');b.className='target';b.id='target-'+index;const badge=document.createElement('span');badge.className='target-label';badge.textContent=receiverLabels[i];const tether=document.createElement('span');tether.className='target-tether';tether.setAttribute('aria-hidden','true');b.append(tether,badge);b.setAttribute('aria-label','Throw to receiver '+receiverLabels[i]+'. Tap for bullet, hold for touch or lob.');let pressedAt=null;b.onpointerdown=e=>{pressedAt=performance.now();b.setPointerCapture(e.pointerId);e.preventDefault()};b.onpointerup=e=>{if(pressedAt===null)return;const held=performance.now()-pressedAt;pressedAt=null;throwTo(index,throwKindForHold(held));e.preventDefault()};b.onpointercancel=()=>{pressedAt=null};b.onclick=e=>{if(e.detail===0)throwTo(index,'bullet')};$('targetLayer').appendChild(b)})
 }
 function updateSkillButtons(){const ready=phase==='run'&&simTime>=jukeReady;document.querySelectorAll('#skillPad button').forEach(button=>{button.classList.toggle('cooldown',phase==='run'&&!ready);button.classList.toggle('ready',ready);button.setAttribute('aria-disabled',String(!ready))});$('pumpFake').classList.toggle('cooldown',phase==='pass'&&simTime<pumpReady)}
 function message(text,seconds=1.4){$('message').textContent=text;$('message').classList.add('show');messageUntil=performance.now()+seconds*1000}
 function stadiumSound(kind='snap'){try{const AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor)return;soundContext||=new AudioCtor();if(soundContext.state==='suspended')soundContext.resume();const now=soundContext.currentTime,duration=kind==='touchdown'?1.15:kind==='hit'?.22:.08,buffer=soundContext.createBuffer(1,Math.ceil(soundContext.sampleRate*duration),soundContext.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);const source=soundContext.createBufferSource(),filter=soundContext.createBiquadFilter(),gain=soundContext.createGain();source.buffer=buffer;filter.type=kind==='touchdown'?'bandpass':'lowpass';filter.frequency.value=kind==='touchdown'?720:kind==='hit'?180:420;gain.gain.setValueAtTime(kind==='touchdown'?.055:kind==='hit'?.08:.045,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);source.connect(filter).connect(gain).connect(soundContext.destination);source.start(now)}catch{}}
  function snap(){if(phase!=='pre'||paused||ended)return;if(mode==='run'&&Math.hypot(input.x,input.z)>=.12)snapDirection={x:input.x,z:input.z};if(mode==='run'&&Math.hypot(snapDirection.x,snapDirection.z)>=.12)snapDirectionUntil=simTime+1.35;phase='snap';elapsed=0;actors.forEach(p=>p.hasBall=false);exchange={kind:'snap',ball:[actors[2].x,.42,actors[2].z-.2],from:[actors[2].x,.42,actors[2].z-.2]};actors[5].action='receive-snap';actors[2].action='snap';drive.plays++;lastTackler=null;catchStyle='rac';carrier=actors[5];highlightFrames=[];highlightSampleAt=-1;replay.event('snap',{mode,play:(mode==='run'?RUNS:PASSES)[selected].id,defense:defensiveCall.id,runDirection,mikeIndex,motioned,openingX:snapDirection.x,openingZ:snapDirection.z});stadiumSound('snap');navigator.vibrate?.(7);message(mode==='run'?RUNS[selected].name:defensiveCall.blitzers.length?'PRESSURE LOOK · READ HOT':'READ THE COVERAGE',.85);updateControls()}
 function captureHighlight(){if(phase==='pre'||phase==='dead'||simTime-highlightSampleAt<.08)return;highlightSampleAt=simTime;highlightFrames.push({phase,exchange:exchange?{kind:exchange.kind,ball:[...exchange.ball]}:null,carrier:carrier?.index??5,players:actors.map(p=>({x:p.x,z:p.z,heading:p.heading,vx:p.vx,vz:p.vz,distance:p.distance,sprinting:p.sprinting,hasBall:p.hasBall,fallen:p.fallen,fallHeading:p.fallHeading,contactWith:p.contactWith,contactRole:p.contactRole,ballTarget:p.ballTarget,engaged:p.engaged,engagedWith:p.engagedWith,blockStyle:p.blockStyle,routeStyle:p.routeStyle,coverageStyle:p.coverageStyle,action:p.action,actionT:p.actionT,actionSide:p.actionSide,throwT:p.throwT,throwStyle:p.throwStyle,catchT:p.catchT,catchStyle:p.catchStyle}))});if(highlightFrames.length>100)highlightFrames.shift()}
 function applyHighlightFrame(frame){phase=frame.phase;exchange=frame.exchange?{...frame.exchange,ball:[...frame.exchange.ball]}:null;carrier=actors[frame.carrier]||actors[5];frame.players.forEach((state,index)=>Object.assign(actors[index],state))}
 function watchReplay(){if(!lastHighlight.length||replaying)return;replaying=true;replayCursor=0;replayEndPhase=phase;paused=false;$('paused').hidden=true;message('INSTANT REPLAY',9);applyHighlightFrame(lastHighlight[0])}
 function advanceReplay(dt){if(!replaying)return;replayCursor+=dt/.08*.68;const index=Math.min(lastHighlight.length-1,Math.floor(replayCursor));applyHighlightFrame(lastHighlight[index]);if(index>=lastHighlight.length-1){replaying=false;if(replayEndPhase==='pre')setup();else phase='dead';paused=true;$('paused').hidden=false;message('REPLAY COMPLETE',.8)}}
 function move(p,x,z,dt,turn=12){if(p.fallen){p.vx=p.vz=0;p.moving=false;return}const dx=x-p.x,dz=z-p.z,dist=Math.hypot(dx,dz);p.moving=dist>.001;p.distance+=dist;p.vx=dt>0?dx/dt:0;p.vz=dt>0?dz/dt:0;p.x=clamp(x,-26.3,26.3);p.z=z;if(dist>.001){const heading=Math.atan2(dx,dz),diff=Math.atan2(Math.sin(heading-p.heading),Math.cos(heading-p.heading));p.heading+=diff*Math.min(1,dt*turn)}}
 function chase(p,x,z,speed,dt){const dx=x-p.x,dz=z-p.z,len=Math.hypot(dx,dz)||1,step=Math.min(len,speed*dt);move(p,p.x+dx/len*step,p.z+dz/len*step,dt)}
 function accelerate(p,x,z,speed,dt,acceleration=19,deceleration=25){
  const next=locomotionStep(p.vx||0,p.vz||0,x,z,speed,dt,acceleration,deceleration);
  move(p,p.x+next.vx*dt,p.z+next.vz*dt,dt,10.5);p.vx=next.vx;p.vz=next.vz;
 }
 function resolvePlayerOverlaps(){
  for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){const a=actors[i],b=actors[j];if(a.fallen||b.fallen||a.contactWith===b.index||b.contactWith===a.index||a.engagedWith===b.index||b.engagedWith===a.index||((phase==='snap'||phase==='handoff')&&[5,6].includes(i)&&[5,6].includes(j)))continue;if(phase==='run'&&((a===carrier&&b.team!==a.team)||(b===carrier&&a.team!==b.team)))continue;const correction=separationCorrection(a.x,a.z,b.x,b.z,phase==='dead'?(pendingDriveEnd?.title==='TOUCHDOWN'?1.45:1.12):phase==='run'?(a.team===b.team?1.05:.86):(a.team===b.team?.94:.72),i*23+j+1);if(!correction.ax&&!correction.az)continue;a.x=clamp(a.x+correction.ax,-26.3,26.3);a.z+=correction.az;b.x=clamp(b.x+correction.bx,-26.3,26.3);b.z+=correction.bz}
 }
 function settlePlayers(dt){
  const contactIds=activeContact?new Set([activeContact.tackler,activeContact.helper,carrier?.index]):new Set(),drag=Math.exp(-9*dt);
  for(const p of actors){
   if(p.fallen||contactIds.has(p.index))continue;
   p.vx*=drag;p.vz*=drag;if(Math.hypot(p.vx,p.vz)<.08){p.vx=p.vz=0;p.moving=false;continue}
   move(p,p.x+p.vx*dt,p.z+p.vz*dt,dt,7);
  }
  resolvePlayerOverlaps();
 }

 function pursue(p,target,speed,dt,afterCatch=false){if(p.fallen)return;if(phase==='run'||phase==='handoff')speed=defenderRunSpeed(p)*defensiveCall.pursuit;const aim=pursuitTarget(p,target,afterCatch,speed),steer=pursuitSteering(p,target,actors,speed,afterCatch),distance=Math.hypot(aim.x-p.x,aim.z-p.z),approach=Math.hypot(target.vx||0,target.vz||0)<1.2?Math.min(speed,Math.max(.8,distance*4)):speed;accelerate(p,steer.x,steer.z,approach,dt,17,22)}
 function emitRunFx(){
  if(phase!=='run'||!carrier)return;const speed=Math.hypot(carrier.vx||0,carrier.vz||0);if(speed<4||simTime<nextTurfFx)return;
  const inv=1/(speed||1),forwardX=carrier.vx*inv,forwardZ=carrier.vz*inv,rightX=forwardZ,rightZ=-forwardX,side=(Math.floor(simTime*15)+carrier.index)%2?1:-1,jitter=(rand()-.5)*.18;
  turfFx.push({x:carrier.x-forwardX*.34+rightX*(side*.19+jitter),z:carrier.z-forwardZ*.34+rightZ*(side*.19+jitter),born:simTime,life:.34+rand()*.18,size:.25+rand()*.16,driftX:-forwardX*.38+rightX*side*.22,driftZ:-forwardZ*.38+rightZ*side*.22});
  if(turfFx.length>28)turfFx.shift();nextTurfFx=simTime+(carrier.sprinting?.055:.095);
 }
 function setTimedAction(p,type,duration,side=0){p.action=type;p.actionStarted=simTime;p.actionUntil=simTime+duration;p.actionT=0;p.actionSide=side}
 function beginSkillAction(type,duration,side=0){carrier.action=type;carrier.actionStarted=simTime;carrier.actionUntil=simTime+duration;carrier.actionT=0;carrier.actionSide=side}
 function updateSkillAction(){for(const p of actors)advancePlayerAction(p,simTime,phase==='dead'&&postPlayElapsed<1.35)}
 function beginContactSequence(tackler,outcome,helpers=[],speed=0){
  const length=Math.hypot(carrier.vx||0,carrier.vz||0),dirX=length>.2?carrier.vx/length:Math.sin(carrier.heading||0),dirZ=length>.2?carrier.vz/length:Math.cos(carrier.heading||0),side=Math.sign((tackler.x-carrier.x)*dirZ-(tackler.z-carrier.z)*dirX)||1,presentation=contactPresentation(outcome.type,speed/9.5,side),helper=presentation.helper?helpers.find(p=>p!==tackler&&!p.fallen)||null:null;
  activeContact={type:presentation.type,elapsed:0,...presentation,dirX,dirZ,rightX:dirZ,rightZ:-dirX,carrierStart:[carrier.x,carrier.z],tacklerStart:[tackler.x,tackler.z],tackler:tackler.index,tacklerHeading:Math.atan2(carrier.x-tackler.x,carrier.z-tackler.z),helper:helper?.index??null,helperStart:helper?[helper.x,helper.z]:null};
  contactFx={x:carrier.x,z:carrier.z,born:simTime,power:presentation.shake};
  setTimedAction(tackler,presentation.type,presentation.duration,side);setTimedAction(carrier,presentation.type,presentation.duration,-side);carrier.fallen=true;tackler.fallen=true;carrier.heading=Math.atan2(dirX,dirZ);carrier.fallHeading=tackler.fallHeading=carrier.heading;carrier.contactRole='carrier';carrier.contactWith=tackler.index;tackler.contactRole='tackler';tackler.contactWith=carrier.index;carrier.vx=carrier.vz=0;tackler.vx=tackler.vz=0;
  if(helper){setTimedAction(helper,'gang',presentation.duration,-side);helper.vx=helper.vz=0;helper.fallen=true;helper.fallHeading=carrier.heading;helper.contactRole='tackler';helper.contactWith=carrier.index}
  impactShake=presentation.shake;recoveryLeft=presentation.duration+.34;
 }
 function advanceContactSequence(dt){
  const c=activeContact;if(!c)return;c.elapsed=Math.min(c.duration,c.elapsed+dt);const raw=clamp(c.elapsed/c.duration,0,1),t=smooth((raw-.16)/.84),ball=carrier,tackler=actors[c.tackler],carrierX=c.carrierStart[0]+c.dirX*c.carrierDrive*t,carrierZ=c.carrierStart[1]+c.dirZ*c.carrierDrive*t;
 ball.x=clamp(carrierX,-26.3,26.3);ball.z=carrierZ;ball.vx=ball.vz=0;ball.actionT=raw;ball.moving=false;
 const tacklerX=carrierX-c.dirX*(.48-c.tacklerDrive*t)+c.rightX*c.side*(.48+.18*smooth((raw-.75)/.25)),tacklerZ=carrierZ-c.dirZ*(.48-c.tacklerDrive*t)+c.rightZ*c.side*(.48+.18*smooth((raw-.75)/.25));const close=smooth(raw/.24);tackler.x=c.tacklerStart[0]+(tacklerX-c.tacklerStart[0])*close;tackler.z=c.tacklerStart[1]+(tacklerZ-c.tacklerStart[1])*close;tackler.heading=c.tacklerHeading+Math.atan2(Math.sin(ball.heading-c.tacklerHeading),Math.cos(ball.heading-c.tacklerHeading))*smooth((raw-.10)/.42);tackler.actionT=raw;tackler.moving=false;
 if(c.helper!==null){const helper=actors[c.helper],targetX=carrierX-c.dirX*.25-c.rightX*c.side*.62,targetZ=carrierZ-c.dirZ*.25-c.rightZ*c.side*.62;helper.x=c.helperStart[0]+(targetX-c.helperStart[0])*t;helper.z=c.helperStart[1]+(targetZ-c.helperStart[1])*t;const facing=Math.atan2(ball.x-helper.x,ball.z-helper.z);helper.heading=facing+Math.atan2(Math.sin(ball.heading-facing),Math.cos(ball.heading-facing))*smooth((raw-.10)/.42);helper.actionT=raw;helper.moving=false}
  if(c.elapsed>=c.duration){tackler.recoveryOffset=[c.rightX*c.side*.62,c.rightZ*c.side*.62];if(c.helper!==null)actors[c.helper].recoveryOffset=[-c.rightX*c.side*.62,-c.rightZ*c.side*.62];activeContact=null;if(pendingPlayMessage){message(pendingPlayMessage,1.4);pendingPlayMessage=null}}
 }
  function performSkill(action){
   if(phase!=='run'||simTime<jukeReady||!carrier)return;
   replay.event('skill',{action,carrier:carrier.index});
  const defenders=actors.filter(p=>p.team===1&&!p.engaged&&!p.fallen),nearest=defenders.reduce((best,p)=>!best||Math.hypot(p.x-carrier.x,p.z-carrier.z)<Math.hypot(best.x-carrier.x,best.z-carrier.z)?p:best,null);
  const [rightX,rightZ]=cameraWorldVector(1,0,camEye,camTarget),[forwardX,forwardZ]=cameraWorldVector(0,1,camEye,camTarget);
  const defenderSide=nearest?(nearest.x-carrier.x)*rightX+(nearest.z-carrier.z)*rightZ:0;
  if(action==='slide'&&carrier.role==='QB'){
   lastSkill='slide';jukeReady=simTime+1;beginSkillAction('slide',.70,0);carrier.actionT=.48;carrier.fallen=true;carrier.slide=true;navigator.vibrate?.(14);endPlay('QB SLIDE',carrier.z-10);return;
  }
  if(action==='slide')action='hurdle';
  if(action==='juke'){
   const keyboardX=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),side=Math.abs(keyboardX||input.x)>.15?Math.sign(keyboardX||input.x):(defenderSide>0?-1:1),[dx,dz]=cameraWorldVector(side,0,camEye,camTarget);
   beginSkillAction('juke',.46,side);jukeUntil=simTime+.48;jukeReady=simTime+1.18;const targetHeading=Math.atan2(dx,dz),headingDiff=Math.atan2(Math.sin(targetHeading-carrier.heading),Math.cos(targetHeading-carrier.heading));carrier.heading+=headingDiff*.72;carrier.x=clamp(carrier.x+dx*.48,-25.8,25.8);carrier.z=clamp(carrier.z+dz*.48,10,110);carrier.vx=dx*7.4+forwardX*2.2;carrier.vz=dz*7.4+forwardZ*2.2;if(nearest&&Math.hypot(nearest.x-carrier.x,nearest.z-carrier.z)<4.2){nearest.reactionT=.001;nearest.reactionSide=-side}message('JUKE '+(side>0?'RIGHT':'LEFT'),.65);
  }else if(action==='spin-left'||action==='spin-right'){
   const side=action==='spin-left'?-1:1,[dx,dz]=cameraWorldVector(side,0,camEye,camTarget);beginSkillAction('spin',.62,side);jukeUntil=simTime+.44;jukeReady=simTime+1.32;carrier.x=clamp(carrier.x+dx*.34+forwardX*.36,-25.8,25.8);carrier.z=clamp(carrier.z+dz*.34+forwardZ*.36,10,110);carrier.vx=dx*3.8+forwardX*5.3;carrier.vz=dz*3.8+forwardZ*5.3;if(nearest&&Math.hypot(nearest.x-carrier.x,nearest.z-carrier.z)<3.8){nearest.reactionT=.001;nearest.reactionSide=side}message('SPIN '+(side>0?'RIGHT':'LEFT'),.7);
  }else if(action==='truck'){
   const target=defenders.filter(p=>{const dx=p.x-carrier.x,dz=p.z-carrier.z;return Math.hypot(dx,dz)<1.45&&dx*forwardX+dz*forwardZ>-.15}).reduce((best,p)=>!best||Math.hypot(p.x-carrier.x,p.z-carrier.z)<Math.hypot(best.x-carrier.x,best.z-carrier.z)?p:best,null);
   const lateral=target?Math.abs((target.x-carrier.x)*rightX+(target.z-carrier.z)*rightZ):0,presentation=lateral>.62?'stiff-arm':'truck';beginSkillAction(presentation,.48,defenderSide>=0?1:-1);jukeUntil=simTime+.42;jukeReady=simTime+1.12;stamina=clamp(stamina-.08,0,1);$('stamina').firstElementChild.style.width=(stamina*100)+'%';
   if(target){knockDownPlayer(target,simTime,'tackle',.65,defenderSide>=0?1:-1);impactShake=.72;message(presentation==='stiff-arm'?'STIFF ARM':'TRUCK',.72)}else message('TRUCK',.62);
   carrier.x=clamp(carrier.x+forwardX*.72,-25.8,25.8);carrier.z=clamp(carrier.z+forwardZ*.72,10,110);
  }else if(action==='hurdle'){
   beginSkillAction('hurdle',.62,0);jukeUntil=simTime+.52;jukeReady=simTime+1.38;stamina=clamp(stamina-.1,0,1);$('stamina').firstElementChild.style.width=(stamina*100)+'%';carrier.x=clamp(carrier.x+forwardX*1.12,-25.8,25.8);carrier.z=clamp(carrier.z+forwardZ*1.12,10,110);message('HURDLE',.7);
  }else return;
  lastSkill=action;lastSkillAt=simTime;navigator.vibrate?.(20);
 }
function coverage(dt){
  receiverIndices.forEach((idx,i)=>{const p=actors[idx],routeSpeed=(6.05+i*.12)*ratingMultiplier(p.ratings.speed,.91,1.1),pos=travel(PASSES[selected].routes[i],elapsed*routeSpeed);move(p,p.startX+pos[0]*runDirection,p.startZ+pos[1],dt);p.routeStyle=elapsed<.48?'release':Math.abs(p.motion?.turn||0)>1.05?'cut':'stem'});
  const shell=defensiveCall.coverage,targets=receiverIndices.map(i=>actors[i]),corners=[actors[18],actors[19],actors[20]],safety=actors[21];
  corners.forEach((d,i)=>{const t=targets[i],speed=(shell==='man'?5.85:5.2)*ratingMultiplier(d.ratings.coverage,.94,1.08);d.coverageStyle=elapsed<.62+i*.05?'pedal':Math.abs(d.motion?.turn||0)>1?'break':'match';if(elapsed<.18+i*.06)return;if(shell==='quarters'){chase(d,t.x,t.z+2.25,speed,dt)}else if(shell==='zone'){const zoneX=[-15,0,15][i],near=targets.reduce((best,p)=>Math.abs(p.x-zoneX)<Math.abs(best.x-zoneX)?p:best,targets[0]);chase(d,zoneX+(near.x-zoneX)*.4,clamp(near.z+1,snapZ+5,snapZ+18),speed,dt)}else{const undercut=shell==='robber'&&i===1?-.35:1.05;chase(d,t.x+(i===1?-1.1:Math.sign(t.x||1)*-1),t.z+undercut,speed,dt)}});
  safety.coverageStyle=elapsed<.75?'pedal':'break';if(shell==='quarters'){const deep=targets.reduce((a,b)=>a.z>b.z?a:b);chase(safety,deep.x*.28,deep.z+3.2,5.15*ratingMultiplier(safety.ratings.coverage,.94,1.08),dt)}else if(shell==='zone'){chase(safety,targets[1].x*.25,Math.max(snapZ+14,targets[1].z+3),4.9,dt)}else if(shell==='robber'){chase(safety,targets[1].x,targets[1].z-.8,6.15,dt)}else{const deep=targets.reduce((a,b)=>a.z>b.z?a:b);chase(safety,deep.x*.35,deep.z+2.7,5.35,dt)}
  const underneathTargets=[targets[3],targets[4],targets[1]];for(let i=15;i<18;i++){if(defensiveCall.blitzers.includes(i))continue;const d=actors[i],t=underneathTargets[i-15],zoneX=[-7,0,7][i-15],speed=(shell==='robber'?5.2:4.72)*ratingMultiplier(d.ratings.coverage,.94,1.08);d.coverageStyle=elapsed<.52?'pedal':Math.abs(d.motion?.turn||0)>.92?'break':'match';chase(d,shell==='man'?clamp(t.x,-12,12):zoneX,Math.min(t.z+(shell==='robber'?-.4:1),snapZ+12),speed,dt)}
 }
 function runClock(){return elapsed+(phase==='handoff'?.28:phase==='run'&&mode==='run'?(RUNS[selected].handoff+.83):0)}
 function runFit(defender,dt){
  if(defender.fallen)return;
  const clock=runClock(),readAt=runReadDelay(defensiveCallIndex,defender.index,selected),slot=defender.index-15,runSide=Math.sign(RUNS[selected].path[2][0]||1)*runDirection,falseSide=selected===2?-runSide:runSide,target=phase==='handoff'?actors[6]:carrier;
  if(clock<readAt){const fit=slot>=0&&slot<3?defensiveCall.fits[slot]:0,progress=clamp(clock/Math.max(readAt,.01),0,1);chase(defender,defender.startX+(fit+falseSide*.42)*progress,defender.startZ+.16*progress,slot>=0&&slot<3?1.65:1.25,dt);return}
  const separation=Math.hypot(defender.x-target.x,defender.z-target.z),speed=defenderPursuitSpeed(separation,mode==='pass')*defensiveCall.pursuit;pursue(defender,target,speed,dt,mode==='pass');
 }
 function engageBlock(blocker,defender,dt,runSide=0,index=0,isRun=false){
  if(!blocker||!defender||defender.fallen){if(blocker){blocker.engaged=false;blocker.engagedWith=null}if(defender){defender.engaged=false;defender.engagedWith=null}return}
  const clock=isRun?runClock():elapsed,distance=Math.hypot(defender.x-blocker.x,defender.z-blocker.z),secondLevel=defender.role==='LB',ratingEdge=(blocker.ratings.block-defender.ratings.blockShed)*.018,conceptBonus=isRun?RUNS[selected].blockLeverage:0;if(distance<2.05&&!blocker.blockResult){blocker.blockResult=blockOutcome(blocker.ratings.block,defender.ratings.blockShed,conceptBonus+(Math.abs(runSide)>.5?.04:0),rand());blocker.blockResolvedAt=clock;defender.blockResult=blocker.blockResult}
  const result=blocker.blockResult||'stalemate',resultTime=Math.max(0,clock-(blocker.blockResolvedAt<0?clock:blocker.blockResolvedAt)),shedScale=result==='shed'?.56:result==='pancake'?1.5:result==='steer'?1.18:1,shedAt=((secondLevel?2.75:2.05)+(index%3)*.24+ratingEdge+conceptBonus)*shedScale;
  if(result==='pancake'&&distance<1.82&&resultTime>.72){knockDownPlayer(defender,simTime,'pancake',.66,runSide||1);blocker.blockResult='finished';blocker.engaged=false;blocker.engagedWith=null;blocker.blockStyle='finish';return}
  if(distance<1.4&&clock<shedAt){
   blocker.engaged=defender.engaged=true;blocker.engagedWith=defender.index;defender.engagedWith=blocker.index;
   blocker.blockStyle=!['OL','TE'].includes(blocker.role)?'stalk':secondLevel?'climb':Math.abs(runSide)>.5&&[1,3].includes(selected)?'reach':'drive';blocker.actionSide=runSide;defender.blockStyle='shed';
   const drive=(.21+(index%2)*.06)*ratingMultiplier(blocker.ratings.strength,.85,1.18)*(result==='steer'?1.28:result==='pancake'?1.42:result==='shed'?.62:1),edge=runSide*(index>=4?.24:.08)*(1+conceptBonus)*(result==='steer'?1.55:result==='shed'?.45:1),targetX=defender.x+edge,targetZ=defender.z-.88;
   chase(blocker,targetX,targetZ,4.6*ratingMultiplier(blocker.ratings.acceleration,.9,1.08),dt);move(defender,defender.x+edge*dt,defender.z+drive*dt,dt,7);const contactHeading=Math.atan2(defender.x-blocker.x,defender.z-blocker.z);blocker.heading=contactHeading;defender.heading=contactHeading+Math.PI;
  }else{
   blocker.engaged=defender.engaged=false;blocker.engagedWith=defender.engagedWith=null;blocker.blockStyle=defender.blockStyle=null;
   if(isRun&&clock<Math.min(shedAt,secondLevel?2.05:1.2)){const targetHeading=Math.atan2(defender.x-blocker.x,defender.z-.82-blocker.z);chase(blocker,defender.x-runSide*.08,defender.z-.82,secondLevel?6.15:5.4,dt);blocker.heading=targetHeading;runFit(defender,dt)}else{const target=isRun&&phase==='handoff'?actors[6]:carrier;chase(blocker,defender.x,defender.z-.9,2.2,dt);pursue(defender,target,isRun?defenderPursuitSpeed(distance,false)*defensiveCall.pursuit:(index>=4?4.85:5.25),dt,phase==='run'&&mode==='pass')}
  }
 }
 function blockers(dt,isRun){
  if(isRun){
   const lane=RUNS[selected].path[2][0]*runDirection,side=lane<0?-1:1,assignments=[...identifyMikeAssignments(runBlockAssignments(selected),mikeIndex),...perimeterBlockAssignments(selected)],handled=new Set();
   assignments.forEach(([blockerIndex,defenderIndex],i)=>{handled.add(defenderIndex);engageBlock(actors[blockerIndex],actors[defenderIndex],dt,side,i,true)});
   return handled;
  }
  const rushers=[11,12,13,14,...defensiveCall.blitzers],desiredZ=snapZ-.4-Math.min(elapsed*.55,1.7);
  for(let i=0;i<5;i++){
   const p=actors[i];p.engaged=false;p.engagedWith=null;p.blockStyle='pass-set';
   if(i>=rushers.length){chase(p,p.startX,desiredZ,2.8,dt);p.heading=0}
  }
  rushers.forEach((defenderIndex,i)=>{
   const d=actors[defenderIndex],p=i<5?actors[i]:null,edge=i===0||i===3;
   d.engaged=false;d.engagedWith=null;d.blockStyle=null;
   if(d.fallen){if(p)chase(p,p.startX,desiredZ,2.8,dt);return}
   if(!p){if(elapsed<.9){chase(d,d.startX,d.startZ,.8,dt);d.heading=Math.PI}else pursue(d,carrier,5.65*ratingMultiplier(d.ratings.speed,.92,1.1),dt);return}
   const ratingEdge=(p.ratings.block-d.ratings.blockShed)*.016,release=clamp(1.75+i*.18+ratingEdge,1.05,3.15);
   if(elapsed<release){
    chase(p,p.startX,desiredZ,2.8,dt);p.heading=0;chase(d,p.x,p.z+.9,4.15,dt);d.heading=Math.atan2(p.x-d.x,p.z-d.z);
    if(Math.hypot(d.x-p.x,d.z-p.z)<1.3){d.engaged=p.engaged=true;d.engagedWith=p.index;p.engagedWith=d.index;p.blockStyle='pass-anchor';d.blockStyle=edge?((i+drive.plays)%2?'rush-rip':'rush-swim'):'bull-rush'}
   }else{
    pursue(d,carrier,(5.2+i*.08)*ratingMultiplier(d.ratings.speed,.92,1.1),dt);
    // A beaten lineman turns and follows; do not also pull him back to his set point.
    const angle=Math.atan2(d.x-p.x,d.z-p.z);chase(p,d.x,d.z+(Math.sign(p.z-d.z)||1)*.85,2.5,dt);p.heading=angle;
   }
  });
 }
 function sustainSupportBlock(blocker,d,dt){blocker.engaged=d.engaged=true;blocker.engagedWith=d.index;d.engagedWith=blocker.index;blocker.blockStyle='stalk';d.blockStyle='shed';const side=Math.sign(d.x-carrier.x)||1,drive=.12*ratingMultiplier(blocker.ratings.strength,.86,1.12);blocker.actionSide=side;chase(blocker,d.x-side*.08,d.z-.82,5.1*ratingMultiplier(blocker.ratings.acceleration,.9,1.08),dt);move(d,d.x+side*.035*dt,d.z+drive*dt,dt,7);const heading=Math.atan2(d.x-blocker.x,d.z-blocker.z);blocker.heading=heading;d.heading=heading+Math.PI}
 function supportBlockers(dt){
  const handled=new Set(),eligible=actors.filter(p=>p.team===0&&p!==carrier&&!p.fallen&&['RB','WR','TE'].includes(p.role));
  for(const blocker of eligible){
   const paired=Number.isInteger(blocker.engagedWith)?actors[blocker.engagedWith]:null;
   if(paired&&paired.engagedWith===blocker.index&&!paired.fallen&&Math.hypot(paired.x-blocker.x,paired.z-blocker.z)<2.35){handled.add(paired.index);sustainSupportBlock(blocker,paired,dt);continue}
   if(paired&&paired.engagedWith===blocker.index){paired.engaged=false;paired.engagedWith=null;paired.blockStyle=null}blocker.engaged=false;blocker.engagedWith=null;blocker.blockStyle=null;
   const candidates=actors.filter(d=>d.team===1&&!d.fallen&&!d.engaged&&!handled.has(d.index)&&d.z>=Math.max(carrier.z-1.8,blocker.z+.95));
   const target=candidates.reduce((best,d)=>{const score=Math.hypot(d.x-blocker.x,d.z-blocker.z)+(d.z<carrier.z?3.5:0);return!best||score<best.score?{d,score}:best},null);
   if(!target||target.score>9.5){blocker.engaged=false;blocker.engagedWith=null;chase(blocker,blocker.x,Math.max(blocker.z,carrier.z+4),4.35,dt);continue}
   const d=target.d,distance=Math.hypot(d.x-blocker.x,d.z-blocker.z);
   if(distance<1.4){handled.add(d.index);sustainSupportBlock(blocker,d,dt)}
   else{blocker.engaged=false;blocker.engagedWith=null;chase(blocker,d.x,d.z-.85,5.45*ratingMultiplier(blocker.ratings.acceleration,.9,1.08),dt)}
  }
  return handled;
 }
  function throwTo(index,kind='bullet'){if(phase!=='pass'||paused)return;const target=actors[index],routeIndex=receiverIndices.indexOf(index),profile=THROW_PROFILES[kind]||THROW_PROFILES.bullet,qb=actors[5],nearest=Math.min(...actors.filter(p=>p.team===1&&!p.engaged).map(p=>Math.hypot(p.x-qb.x,p.z-qb.z)),8),pressure=pocketPressure(nearest,elapsed),release=liveBallAnchor(qb,'pass');carrier.hasBall=false;qb.throwT=.001;qb.throwStyle=kind;const routeSpeed=(6.05+routeIndex*.12)*ratingMultiplier(target.ratings.speed,.91,1.1),duration=profile.duration+Math.abs(target.z-carrier.z)*profile.distanceScale,to=routeIndex>=0?predictPassDestination(PASSES[selected].routes[routeIndex],target.startX,target.startZ,elapsed,duration,routeSpeed):[target.x,1.6,target.z],leadX=0,leadZ=0,movingPenalty=qb.moving?.62:0,accuracy=ratingMultiplier(qb.ratings.throw,.74,1.03),error=(profile.error+pressure*1.18+movingPenalty)/accuracy;if(routeIndex>=0)to[0]=target.startX+(to[0]-target.startX)*runDirection;to[0]=clamp(to[0]+(rand()-.5)*2*error,-26.3,26.3);to[2]=clamp(to[2]+(rand()-.5)*1.25*error,10,110);replay.event('throw',{target:index,kind,pressure,leadX,leadZ});catchStyle='rac';flight={from:release,to,target:index,t:0,duration,arc:profile.arc,kind,pressure};flightCameraStart={eye:[...camEye],target:[...camTarget]};phase='flight';message(kind.toUpperCase()+' PASS · PICK A CATCH',.65);updateControls()}
 function throwAway(){
  if(phase!=='pass'||paused)return;const qb=actors[5];if(!canThrowAway(qb.x)){message('LEAVE THE POCKET TO THROW AWAY',.9);navigator.vibrate?.(12);return}
   const side=Math.sign(qb.x)||1,release=liveBallAnchor(qb,'pass'),nearest=Math.min(...actors.filter(p=>p.team===1&&!p.engaged).map(p=>Math.hypot(p.x-qb.x,p.z-qb.z)),8),pressure=pocketPressure(nearest,elapsed);replay.event('throwaway',{side,pressure});carrier.hasBall=false;qb.throwT=.001;qb.throwStyle='away';flight={from:release,to:[side*28.5,1.45,Math.min(109,snapZ+8.5)],target:null,t:0,duration:.46,arc:2.35,kind:'throwaway',pressure,throwAway:true};flightCameraStart={eye:[...camEye],target:[...camTarget]};phase='flight';message('THROWING IT AWAY',.65);updateControls()
 }
  function endPlay(reason,ballSpot,incomplete=false){if(phase==='dead'||ended)return;const old=drive.ball;captureHighlight();phase='dead';postPlayElapsed=0;flight=null;if(incomplete&&lastFlightEnd)looseBall={x:lastFlightEnd[0],z:lastFlightEnd[2],born:simTime,life:1.18};lastFlightEnd=null;input.x=0;input.z=0;input.sprint=false;keys.clear();actors.forEach(releasePostPlay);updateControls();message(reason,.9);if(carrier&&reason==='TACKLED')carrier.fallen=true;drive.ball=incomplete?old:clamp(Math.round(ballSpot),1,100);const gain=drive.ball-old;if(reason==='BIG HIT'||reason==='TOUCHDOWN'||gain>=15)lastHighlight=highlightFrames.slice();$('watchReplay').hidden=!lastHighlight.length;replay.event('play-end',{reason,gain,ball:drive.ball});replay.sample(true);if(['BIG HIT','TACKLED','GANG TACKLE','SACK'].includes(reason))stadiumSound('hit');let copy=reason;
  if(drive.ball>=100){drive.score+=6;stadiumSound('touchdown');navigator.vibrate?.([24,35,34]);message('TOUCHDOWN · CROWD ERUPTS',3);endDrive('TOUCHDOWN','You finished the drive. Practice results stay separate from your career.');return}
  if(!incomplete){copy+=' · '+(gain>=0?'+':'')+gain+' YDS'}
  if(gain>=drive.toGo){drive.down=1;drive.toGo=Math.min(10,100-drive.ball);copy=(lineToGain(drive)===100?'FIRST & GOAL':'FIRST DOWN')+' · +'+gain+' YDS'}else{drive.down++;drive.toGo=Math.max(1,drive.toGo-gain)}
  if(activeContact)pendingPlayMessage=copy;else message(copy,1.4);updateHud();updateControls();if(drive.down>4){endDrive('TURNOVER ON DOWNS','The defense held. Restart this practice drive to try again.');return}if(drive.clock<=0){endDrive('TIME EXPIRED','The clock reached zero. Your career is unchanged.');return}recoveryLeft=activeContact?Math.max(3.75,activeContact.duration+2.65):1.35;
 }
  function showDriveEnd(){if(!pendingDriveEnd)return;const{title,body}=pendingDriveEnd;pendingDriveEnd=null;paused=true;$('dialogTitle').textContent=title;$('dialogBody').textContent=body;$('resume').hidden=true;$('paused').hidden=false;updateHud();updateControls()}
  function endDrive(title,body){ended=true;phase='dead';actors.forEach(releasePostPlay);pendingDriveEnd={title,body,celebrating:false,showAt:simTime+Math.max(title==='TOUCHDOWN'?3.8:1.35,(activeContact?.duration||0)+2.75)};replay.event('drive-end',{title,ball:drive.ball,score:drive.score});replay.sample(true);updateHud();updateControls()}
  function pause(){if(ended||replaying)return;paused=!paused;replay.event(paused?'pause':'resume');replay.sample(true);input.x=input.z=0;input.sprint=false;input.pointer=input.sprintPointer=null;keys.clear();$('knob').classList.remove('held');$('knob').style.transform='none';$('dialogTitle').textContent='PAUSED';$('dialogBody').textContent='This preview never changes your career saves or season record.';$('resume').hidden=false;$('watchReplay').hidden=!lastHighlight.length||!['pre','dead'].includes(phase);$('paused').hidden=!paused;updateControls()}
 function tick(dt){transitionFade=Math.max(0,transitionFade-dt*2.5);$('playTransition').style.opacity=transitionFade;if(phase==='dead'){simTime+=dt;postPlayElapsed+=dt;if(activeContact)advanceContactSequence(dt);else updateSkillAction();settlePlayers(dt);if(pendingDriveEnd?.title==='TOUCHDOWN'&&!pendingDriveEnd.celebrating&&!activeContact&&!carrier.fallen&&Math.hypot(carrier.vx,carrier.vz)<.15){setTimedAction(carrier,'celebrate',2.2,0);pendingDriveEnd.celebrating=true;pendingDriveEnd.showAt=Math.max(pendingDriveEnd.showAt,simTime+2.3)}if(pendingDriveEnd&&simTime>=pendingDriveEnd.showAt&&!activeContact){showDriveEnd();return}if(!ended){recoveryLeft-=dt;if(recoveryLeft<.12){transitionFade=clamp(1-recoveryLeft/.12,0,.28);$('playTransition').style.opacity=transitionFade}if(recoveryLeft<=0){transitionFade=.28;setup();camera(1)}}return}if(phase==='pre')return;elapsed+=dt;simTime+=dt;updateSkillAction();for(const p of actors)if(p.reactionT>0){p.reactionT+=dt/.42;if(p.reactionT>=1)p.reactionT=0}drive.clock=Math.max(0,drive.clock-dt);updateHud();
  if(phase==='snap'){
   const qb=actors[5],center=actors[2],t=clamp(elapsed/.28,0,1),target=[qb.x,1.38,qb.z+.25];
   qb.action='receive-snap';qb.actionT=t;qb.ballTarget=target;center.action='snap';center.actionT=t;
   exchange.ball=exchange.from.map((v,i)=>v+(target[i]-v)*t);exchange.ball[1]+=Math.sin(t*Math.PI)*.12;blockers(dt,mode==='run');resolvePlayerOverlaps();
   if(t>=1){center.action=null;center.ballTarget=null;qb.hasBall=true;qb.action=null;qb.ballTarget=null;phase=mode==='run'?'handoff':'pass';elapsed=mode==='run'?0:.28;exchange=mode==='run'?{kind:selected===3?'pitch':'handoff',ball:target,qbStart:[qb.x,qb.z],rbStart:[actors[6].x,actors[6].z]}:null;updateControls()}
   return;
  }
  if(phase==='handoff'){
   const qb=actors[5],rb=actors[6],concept=RUNS[selected],duration=concept.handoff+.55,t=clamp(elapsed/duration,0,1),meshX=concept.mesh[0]*runDirection,meshZ=snapZ+concept.mesh[1],pitch=selected===3,side=Math.sign(meshX-qb.startX)||runDirection;
   const arrive=smooth(t/.84),qbHeading=qb.heading,qbX=pitch?side*.8:meshX-side*.76,qbZ=pitch?snapZ-4.65:meshZ-.12;
   move(qb,exchange.qbStart[0]+(qbX-exchange.qbStart[0])*smooth(t/.72),exchange.qbStart[1]+(qbZ-exchange.qbStart[1])*smooth(t/.72),dt,10);
   move(rb,exchange.rbStart[0]+(meshX-exchange.rbStart[0])*arrive,exchange.rbStart[1]+(meshZ-exchange.rbStart[1])*arrive,dt,10);
   const guide=runConceptDirection(selected,0,rb.x,rb.z,snapZ,runDirection),control=openingRunControl(assist,input.x,input.z,snapDirection.x,snapDirection.z,guide.x,guide.z,true),world=control.manual?cameraWorldVector(control.x,control.z,camEye,camTarget):[control.x,control.z];
   const facing=Math.atan2(rb.x-qb.x,rb.z-qb.z);qb.heading=qbHeading+Math.atan2(Math.sin(facing-qbHeading),Math.cos(facing-qbHeading))*(1-Math.exp(-9*dt));rb.heading=Math.atan2(meshX-exchange.rbStart[0],meshZ-exchange.rbStart[1]);
   const carrySide=(rb.index+rb.team)%2?-1:1,carryPoint=[rb.x+Math.cos(rb.heading)*carrySide*.22+Math.sin(rb.heading)*.22,1.30,rb.z-Math.sin(rb.heading)*carrySide*.22+Math.cos(rb.heading)*.22],meshPoint=[rb.x-Math.sin(qb.heading)*.16,1.30,rb.z-Math.cos(qb.heading)*.16],catchPoint=meshPoint.map((v,i)=>v+(carryPoint[i]-v)*smooth((t-.88)/.12)),grip=[qb.x+Math.sin(qb.heading)*.36,1.38,qb.z+Math.cos(qb.heading)*.36],reach=smooth((t-.45)/.40);
   if(pitch){
    // Freeze the release point once. Ownership is empty throughout the airborne pitch.
    if(t>=.46&&!exchange.release)exchange.release=[...grip];
    const flightT=clamp((t-.46)/.42,0,1);
    exchange.ball=exchange.release?exchange.release.map((v,i)=>v+(catchPoint[i]-v)*flightT):grip;
    exchange.ball[1]+=Math.sin(flightT*Math.PI)*.72;
    qb.hasBall=t<.46;rb.hasBall=t>=.88;
   }else{exchange.ball=grip.map((v,i)=>v+(catchPoint[i]-v)*reach);qb.hasBall=t<.88;rb.hasBall=t>=.88}
   qb.action='handoff';qb.actionT=t;qb.ballTarget=pitch?grip:t>.88?grip:exchange.ball;
   rb.action='receive-handoff';rb.actionT=t;
   // Show a receiving pocket, never arms reaching several yards after the ball.
   rb.ballTarget=t>.40?(t>.76?exchange.ball:catchPoint):null;
   if(rb.hasBall)carrier=rb;
   blockers(dt,true);resolvePlayerOverlaps();
   if(t>=1){qb.hasBall=false;qb.ballTarget=null;qb.action=null;qb.actionT=0;qb.vx=qb.vz=0;rb.hasBall=true;rb.ballTarget=null;rb.action=null;rb.actionT=0;const speed=control.manual?4.8:assist?4.6:0;rb.vx=world[0]*speed;rb.vz=world[1]*speed;snapDirectionUntil=simTime+.75;carrier=rb;phase='run';exchange=null;elapsed=0;updateControls()}
   return;
  }
  if(phase==='pass'||phase==='flight'){coverage(dt);blockers(dt,false);const qb=actors[5];
   resolvePlayerOverlaps();
   if(phase==='pass'){
    if(qb.throwStyle==='pump'&&simTime>=qb.actionUntil){qb.throwT=0;qb.throwStyle=null}
    let x=input.x,z=input.z;const kx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),kz=(keys.has('ArrowUp')||keys.has('w')?1:0)-(keys.has('ArrowDown')||keys.has('s')?1:0);if(kx||kz){const len=Math.hypot(kx,kz);x=kx/len;z=kz/len}if(x||z){[x,z]=cameraWorldVector(x,z,camEye,camTarget);const speed=qbMovementSpeed(qb.x,z);accelerate(qb,x,z,speed,dt,14,22);qb.x=clamp(qb.x,-QB_LATERAL_LIMIT,QB_LATERAL_LIMIT);qb.z=clamp(qb.z,snapZ-12,snapZ+.35)}else accelerate(qb,0,0,qbMovementSpeed(qb.x),dt,14,25);
    if(hasCrossedScrimmage(qb.z,snapZ)){phase='run';assist=false;elapsed=0;stamina=1;jukeUntil=simTime+.42;$('stamina').firstElementChild.style.width='100%';updateControls();message('QB SCRAMBLE · TAKE CONTROL',1);return}
    const rushers=actors.filter(p=>p.team===1&&!p.engaged&&!p.fallen&&(p.role==='DL'||defensiveCall.blitzers.includes(p.index))),nearest=Math.min(...rushers.map(p=>Math.hypot(p.x-qb.x,p.z-qb.z)),8),pressure=pocketPressure(nearest,elapsed),throwAwayReady=canThrowAway(qb.x);$('stamina').firstElementChild.style.width=(pressure*100)+'%';$('throwAway').classList.toggle('ready',throwAwayReady);$('throwAway').dataset.ready=String(throwAwayReady);$('throwAway').setAttribute('aria-label',throwAwayReady?'Throw the ball away':'Throwaway unavailable. Leave the pocket first.');$('instruction').textContent='MOVE QB · CROSS BLUE LINE TO RUN · PRESSURE '+Math.round(pressure*100)+'%';if(nearest<.92){const tackler=rushers.reduce((a,b)=>Math.hypot(a.x-qb.x,a.z-qb.z)<Math.hypot(b.x-qb.x,b.z-qb.z)?a:b),spot=drive.ball-sackLoss(snapZ,qb.z);lastTackler=tackler.index;beginContactSequence(tackler,{type:'wrap'},[],Math.hypot(qb.vx,qb.vz));endPlay('SACK',spot);return}
   }
   if(flight){flight.t+=dt/flight.duration;$('catchChoices').hidden=flight.t<.28;qb.throwT=clamp(flight.t,.001,1);if(flight.t>=1){lastFlightEnd=[...flight.to];if(flight.throwAway){flight=null;qb.throwT=0;qb.throwStyle=null;endPlay('THROWN AWAY',drive.ball,true);return}const landingX=flight.to[0],p=actors[flight.target],defenders=actors.filter(a=>a.team===1),closest=defenders.reduce((a,b)=>Math.hypot(a.x-flight.to[0],a.z-flight.to[2])<Math.hypot(b.x-flight.to[0],b.z-flight.to[2])?a:b),defenderBallDistance=Math.hypot(closest.x-flight.to[0],closest.z-flight.to[2]),receiverGap=Math.hypot(p.x-flight.to[0],p.z-flight.to[2]),distance=Math.min(...defenders.map(a=>Math.hypot(a.x-p.x,a.z-p.z))),leverage=clamp((receiverGap-defenderBallDistance+1)/2,0,1),style=catchStyle,chances=passOutcomeChances(distance,flight.pressure,flight.kind,receiverGap,leverage,{catchStyle:style,catchRating:p.ratings.catch,coverageRating:closest.ratings.coverage,throwRating:qb.ratings.throw}),roll=rand();flight=null;qb.throwT=0;qb.throwStyle=null;if(defenderBallDistance<1.85&&roll<chances.interception){lastFlightEnd=null;closest.hasBall=true;carrier=closest;setTimedAction(closest,'interception',.62,Math.sign(p.x-closest.x)||1);p.reactionT=.001;p.reactionSide=Math.sign(closest.x-p.x)||1;message('INTERCEPTED',1.2);endDrive('INTERCEPTED','The defender undercut the throw. Mix trajectory, timing and pocket movement on the next drive.');return}if(receiverGap>2.2||roll<chances.interception+chances.inaccurate){p.reactionT=.001;p.reactionSide=Math.sign(landingX-p.x)||1;endPlay('INACCURATE PASS',drive.ball,true);return}if(roll<chances.interception+chances.inaccurate+chances.breakup){const miss=distance>=2?'DROPPED PASS':distance<.7?'TIGHT WINDOW · PASS BROKEN UP':'PASS BROKEN UP';setTimedAction(closest,'breakup',.48,Math.sign(p.x-closest.x)||1);p.reactionT=.001;p.reactionSide=-closest.actionSide;endPlay(miss,drive.ball,true);return}lastFlightEnd=null;p.hasBall=true;p.catchT=.45;p.catchStyle=style;runCameraStart=null;runCameraBlend=0;p.action='catch-'+style;p.actionStarted=simTime;p.actionUntil=simTime+.58;p.actionT=0;carrier=p;phase='run';elapsed=0;jukeUntil=simTime+(style==='secure'?.28:.18);updateControls();message((distance<2?'CONTESTED ':'')+CATCH_STYLES[style].label+' CATCH · TAKE CONTROL',1)}}
   return;
  }
  if(phase==='run'){
   let x=input.x,z=input.z;const kx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),kz=(keys.has('ArrowUp')||keys.has('w')?1:0)-(keys.has('ArrowDown')||keys.has('s')?1:0);if(kx||kz){const len=Math.hypot(kx,kz);x=kx/len;z=kz/len}
   const liveMagnitude=Math.hypot(x,z);if(liveMagnitude>=.12)snapDirectionUntil=0;const concept=mode==='run'?RUNS[selected]:null,guide=concept?runConceptDirection(selected,elapsed,carrier.x,carrier.z,snapZ,runDirection):null,control=openingRunControl(assist,x,z,snapDirection.x,snapDirection.z,guide?.x,guide?.z,simTime<snapDirectionUntil);x=control.x;z=control.z;if(control.manual)[x,z]=cameraWorldVector(x,z,camEye,camTarget);
   const sprintHeld=input.sprint||keys.has('Shift'),boosting=sprintHeld&&stamina>0;carrier.sprinting=boosting;const cut=cutSeverity(carrier.vx,carrier.vz,x,z);if(cut>.38&&simTime>=plantReady){const agility=ratingMultiplier(carrier.ratings.agility,.82,1.08),retention=clamp(.76-cut*(boosting?.34:.22)+(agility-.82)*.35,.42,.82);carrier.vx*=retention;carrier.vz*=retention;plantReady=simTime+.42;setTimedAction(carrier,'cut',.34,Math.sign(x)||1);stamina=clamp(stamina-(boosting?.06:.025),0,1);if(cut>.68)message(boosting?'SPRINT CUT · SPEED LOST':'PLANT & CUT',.48)}const styleSpeed=mode==='pass'&&elapsed<1?(CATCH_STYLES[carrier.catchStyle||'rac']?.yac||1):1,conceptSpeed=concept?.speed||1,cutPenalty=cut>.38?clamp(1-cut*(boosting?.34:.2),.58,1):1,baseSpeed=(boosting?10.4:8.0)*ratingMultiplier(carrier.ratings.speed,.9,1.1)*conceptSpeed*styleSpeed*cutPenalty,launchBoost=control.manual&&elapsed<.30?1.42:1,acceleration=(boosting?19:24)*ratingMultiplier(carrier.ratings.acceleration,.88,1.14)*(concept?.acceleration||1)*launchBoost;stamina=clamp(stamina+(boosting?-.24:sprintHeld?0:.09)*dt,0,1);$('stamina').firstElementChild.style.width=(stamina*100)+'%';accelerate(carrier,x,z,baseSpeed,dt,acceleration,26);emitRunFx();carrier.catchT=Math.max(0,carrier.catchT-dt);
   if(mode==='run'&&carrier!==actors[5]){const qb=actors[5];accelerate(qb,0,0,0,dt,12,18)}
   const assigned=blockers(dt,mode==='run')||new Set();if(mode==='pass')for(const index of supportBlockers(dt))assigned.add(index);for(const p of actors.filter(p=>p.team===1&&p.role!=='DL'&&!p.engaged&&!p.fallen&&!assigned.has(p.index))){if(mode==='run')runFit(p,dt);else{const separation=Math.hypot(p.x-carrier.x,p.z-carrier.z);pursue(p,carrier,defenderPursuitSpeed(separation,true),dt,true)}}
   if(mode==='run'){const activeBlockers=new Set([...runBlockAssignments(selected),...perimeterBlockAssignments(selected)].map(([index])=>index));for(const p of actors.filter(p=>p.team===0&&(p.role==='WR'||p.role==='TE')&&p!==carrier&&!p.engaged&&!activeBlockers.has(p.index)))chase(p,p.x,Math.max(p.z,snapZ+Math.min(elapsed*5+4,18)),4.5,dt)}
   resolvePlayerOverlaps();
   if(carrier.z>=110){endPlay('TOUCHDOWN',100);return}if(Math.abs(carrier.x)>=26){endPlay('OUT OF BOUNDS',carrier.z-10);return}
   if(simTime>jukeUntil){
    const radius=tackleRadius(elapsed,mode==='pass'),contacts=radius?actors.filter(p=>p.team===1&&!p.engaged&&!p.fallen&&simTime>=p.contactReady&&tackleContactEligible(p,carrier,radius)):[];
    if(contacts.length){
     const d=contacts.reduce((best,p)=>Math.hypot(p.x-carrier.x,p.z-carrier.z)<Math.hypot(best.x-carrier.x,best.z-carrier.z)?p:best),speed=Math.hypot(carrier.vx,carrier.vz),defenderSpeed=Math.hypot(d.vx||0,d.vz||0),toDefenderX=d.x-carrier.x,toDefenderZ=d.z-carrier.z,toDefenderLength=Math.hypot(toDefenderX,toDefenderZ)||1,angle=clamp((carrier.vx*toDefenderX+carrier.vz*toDefenderZ)/(Math.max(speed,.1)*toDefenderLength)*.5+.5,0,1),helpers=actors.filter(p=>p.team===1&&p!==d&&!p.fallen&&!p.engaged&&Math.hypot(p.x-carrier.x,p.z-carrier.z)<1.25),outcome=contactOutcome(carrier.ratings,d.ratings,{momentum:clamp(speed/9.5,0,1),defenderMomentum:clamp(defenderSpeed/8.4,0,1),distance:toDefenderLength,angle,gang:helpers.length,skill:simTime-lastSkillAt<.8?lastSkill:null,roll:rand()});
     lastTackler=d.index;d.contactReady=simTime+.72;
     if(outcome.type==='miss'||outcome.type==='broken'||outcome.type==='stumble'){
      if(outcome.type==='stumble'){setTimedAction(d,'wrap',.58,Math.sign(d.x-carrier.x)||1);d.contactRole='tackler';d.contactWith=carrier.index;}else knockDownPlayer(d,simTime,outcome.type==='broken'?'tackle':'miss',.58,Math.sign(d.x-carrier.x)||1);d.actionT=.18;d.reactionT=.001;d.reactionSide=d.actionSide;setTimedAction(carrier,outcome.type==='stumble'?'stumble':'break-tackle',outcome.type==='stumble'?.62:.5,-d.actionSide);jukeUntil=simTime+(outcome.type==='stumble'?.28:.42);impactShake=outcome.type==='stumble'?.62:.48;carrier.vx*=outcome.type==='stumble'?.56:.82;carrier.vz*=outcome.type==='stumble'?.56:.82;message(outcome.type==='broken'?'BROKEN TACKLE':outcome.type==='stumble'?'STUMBLE · STAY UP':'TACKLER MISSED',.72);navigator.vibrate?.(outcome.type==='stumble'?22:16);
     }else{
      const spot=forwardProgressSpot(carrier.z,carrier.vz);beginContactSequence(d,outcome,helpers,speed);navigator.vibrate?.(outcome.type==='big-hit'?45:28);endPlay(outcome.type==='big-hit'?'BIG HIT':outcome.type==='gang'?'GANG TACKLE':'TACKLED',spot);return;
     }
    }
   }
   if(drive.clock<=0||elapsed>16)endPlay(drive.clock<=0?'TIME EXPIRED':'WHISTLE',carrier.z-10);
  }
 }
 function camera(dt){const isPocket=phase==='pre'||phase==='snap'||phase==='pass'||phase==='handoff'||phase==='flight',isDead=phase==='dead';let x=0,z=snapZ+2,mult=1;
  if(!isPocket&&!isDead){x=carrier.x*.55;z=carrier.z+5;if(flight){const t=clamp(flight.t,0,1);x=(flight.from[0]+(flight.to[0]-flight.from[0])*t)*.55;z=flight.from[2]+(flight.to[2]-flight.from[2])*t+4}}
  if(phase==='pass'||phase==='flight'){const deep=Math.max(...receiverIndices.map(i=>actors[i].z));z=actors[5].z+clamp((deep-actors[5].z)*.42,6,14);mult=clamp(1+(deep-actors[5].z-20)*.01,1,1.35)}
  // Hold the shot through contact. A whistle must not trigger a second zoom
  // back through the pursuers standing behind the carrier.
  if(isDead){const focus=carrier||actors[5];if(!deadCameraStart)deadCameraStart={eye:[...camEye],target:[...camTarget],x:focus.x,z:focus.z};const offset=[(focus.x-deadCameraStart.x)*.96,0,focus.z-deadCameraStart.z],desiredEye=deadCameraStart.eye.map((v,i)=>v+offset[i]+(i===1?.35:0)),desiredTarget=deadCameraStart.target.map((v,i)=>v+offset[i]);camEye=cameraTravel(camEye,desiredEye,dt,3);camTarget=cameraTravel(camTarget,desiredTarget,dt,3);impactShake=Math.max(0,impactShake-dt*3.8);r.camera(camEye,camTarget);return}
  const tracking=phase==='handoff'||phase==='run',focus=phase==='handoff'?actors[6]:carrier;runCameraBlend=clamp(runCameraBlend+(tracking?dt/1.15:-dt/.6),0,1);
  if(tracking&&!runCameraStart)runCameraStart={eye:[...camEye],target:[...camTarget],x:focus.x,z:focus.z};
  // Center the pocket and move closer without enlarging athlete geometry.
  // Keep the existing wide/long-flight presentation and receiver-fit guard.
  const runFrame=tracking?runCameraFraming(focus.x,focus.z):null;
  let desiredEye=tracking?runFrame.eye:[x+(isPocket?0:3.5*mult),(isPocket?5.15:8.0)*mult,(isPocket?snapZ:z)-(isPocket?14.5:24.5)*mult];
  let desiredTarget=tracking?runFrame.target:[x,1.42,phase==='pre'?snapZ-5:z];
  if(tracking){const t=smooth(runCameraBlend),offset=[(focus.x-runCameraStart.x)*.96,0,focus.z-runCameraStart.z];desiredEye=desiredEye.map((v,i)=>(runCameraStart.eye[i]+offset[i])*(1-t)+v*t);desiredTarget=desiredTarget.map((v,i)=>(runCameraStart.target[i]+offset[i])*(1-t)+v*t)}
  // Start following the intended receiver while the football is in the air.
  // Catching continues from the actual camera position, never a new fixed view.
  if(phase==='flight'&&flight){const start=flightCameraStart||{eye:camEye,target:camTarget},t=smooth(flight.t),to=flight.to;desiredEye=[to[0]*.94+.8,7.6,to[2]-17].map((v,i)=>start.eye[i]+(v-start.eye[i])*t);desiredTarget=[to[0]*.94,1.35,to[2]+3.8].map((v,i)=>start.target[i]+(v-start.target[i])*t)}
  // Fit actual projected heads/feet above the pre-snap controls. Do not pan the QB away.
  const pocketBottom=phase==='pre'?Math.min(r.height-100,$('pre').getBoundingClientRect().top-10):r.height-22;
  if(isPocket&&!tracking&&phase!=='flight'){for(let trial=0;trial<18;trial++){r.camera(desiredEye,desiredTarget);const watch=phase==='pre'?actors.filter(p=>!p.team):[actors[5],...receiverIndices.map(i=>actors[i])];const fits=watch.every(p=>{const h=r.project([p.x,2.1,p.z]),f=r.project([p.x,0,p.z]);return h.y>65&&f.y<pocketBottom&&h.x>24&&h.x<r.width-24});if(fits)break;desiredEye[1]*=1.055;desiredEye[2]=desiredTarget[2]+(desiredEye[2]-desiredTarget[2])*1.055}}
  if(tracking){for(let trial=0;trial<18;trial++){r.camera(desiredEye,desiredTarget);if(r.project([focus.x,0,focus.z]).y<r.height-90)break;desiredEye[1]*=1.045;desiredEye[2]=desiredTarget[2]+(desiredEye[2]-desiredTarget[2])*1.045}}
  const rate=phase==='flight'?5.5:phase==='pre'||phase==='handoff'?3.5:tracking?5.2:3.2;camEye=cameraTravel(camEye,desiredEye,dt,rate,phase==='pre'?80:24);camTarget=cameraTravel(camTarget,desiredTarget,dt,rate,phase==='pre'?80:28);const strength=impactShake*.12;impactShake=Math.max(0,impactShake-dt*3.8);r.camera([camEye[0]+Math.sin(simTime*91)*strength,camEye[1]+Math.cos(simTime*73)*strength*.45,camEye[2]],camTarget);
 }
 function scene(dt,now){r.begin();stadium.draw();
  // Keep both snap markers fixed through contact; reset together for the next down.
  r.add('plane',pose(0,.025,snapZ,53.15,1,.11),hex('#4599ba'),'',true);
  r.add('plane',pose(0,.03,snapGainZ,53.15,1,.13),hex('#e1c156'),'',true);
  // Chain crew anchors the broadcast view to the live down and distance.
  for(const [z,color,label]of[[snapZ,'#ef7e38',false],[snapGainZ,'#f4cc57',true]]){r.add('cylinder',segment([-27.25,.08,z],[-27.25,2.05,z],.055),hex(color),'',true);r.add('cube',pose(-27.25,label?2.02:1.62,z,label?.42:.58,label?.42:.34,.12),hex(color),'',true)}
  for(const p of actors){r.add('plane',pose(p.x+.13,.038,p.z-.12,1.65,1,1.15),[0,0,0,meshy.ready?.28:.75],'shadow',true)}
  turfFx=turfFx.filter(f=>simTime-f.born<f.life);for(const fx of turfFx){const age=simTime-fx.born,t=clamp(age/fx.life,0,1),size=fx.size*(1+t*.8);r.add('plane',pose(fx.x+fx.driftX*age,.043,fx.z+fx.driftZ*age,size,1,size*.64),[.61,.50,.28,(1-t)*.55],'turf-fx',true)}
  if(contactFx){const age=simTime-contactFx.born,t=age/.34;if(t<1){const size=(.55+t*2.6)*contactFx.power;r.add('plane',pose(contactFx.x,.055,contactFx.z,size,1,size),[1,.76,.28,(1-t)*.52],'impact-glow',true);for(let i=0;i<7;i++){const angle=i/7*Math.PI*2+.35,radius=t*(.45+i*.06)*contactFx.power,height=.10+Math.sin(t*Math.PI)*(.20+(i%3)*.07);r.add('sphere',pose(contactFx.x+Math.cos(angle)*radius,height,contactFx.z+Math.sin(angle)*radius,.025+(1-t)*.018),[.62,.49,.27,1],'',false,.04)}}else contactFx=null}
  if(carrier&&!ended){const cx=carrier.x,cz=carrier.z;r.add('plane',pose(cx,.036,cz,2.35,1,1.65),[1,1,1,.72],'player-glow',true);for(let i=0;i<32;i++){const a=i/32*2*Math.PI,b=(i+1)/32*2*Math.PI;r.add('cylinder',segment([cx+Math.cos(a)*.70,.045,cz+Math.sin(a)*.70],[cx+Math.cos(b)*.70,.045,cz+Math.sin(b)*.70],.025),hex('#ebce7a'),'',true)}}
  if(phase==='pre'){
   const lists=mode==='run'?[RUNS[selected].path.map(p=>[p[0]*runDirection,snapZ+p[1]])]:PASSES[selected].routes.map((pts,i)=>pts.map(p=>[actors[receiverIndices[i]].startX+p[0]*runDirection,actors[receiverIndices[i]].startZ+p[1]]));
   lists.forEach((pts,i)=>{for(let j=1;j<pts.length;j++){const a=pts[j-1],b=pts[j];r.add('cylinder',segment([a[0],.052,a[1]],[b[0],.052,b[1]],.036),hex(['#d2bb75','#bcced4','#819fae'][i%3]),'',true)}})
  }
  if(phase==='pre'&&actors[mikeIndex]){const m=actors[mikeIndex];for(let i=0;i<24;i++){const a=i/24*2*Math.PI,b=(i+1)/24*2*Math.PI;r.add('cylinder',segment([m.x+Math.cos(a)*.82,.05,m.z+Math.sin(a)*.82],[m.x+Math.cos(b)*.82,.05,m.z+Math.sin(b)*.82],.035),hex('#f0cc67'),'',true)}}
  if(!meshy.ready)for(const p of actors)drawAthlete(r,p,now/1000,phase);
  else meshy.queueShadows(actors,phase,now/1000);
  const stagedBall=phase==='pre'?[actors[2].x,.42,actors[2].z-.2]:exchange?.ball;
  if(stagedBall&&!ended){const[x,y,z]=stagedBall;r.add('sphere',pose(x,y,z,.13,.115,.22),hex('#713a22'));r.add('cylinder',segment([x-.065,y+.1,z],[x+.065,y+.1,z],.012),hex('#f3eee0'))}
  if(!stagedBall&&carrier?.hasBall&&!flight){const rigged=meshy.ballAnchor(carrier);if(rigged)r.add('cylinder',segment(rigged.a,rigged.b,.105),hex('#713a22'),'',false,.72);else{const[x,y,z,heading]=carriedBallAnchor(carrier,phase),fx=Math.sin(heading)*.17,fz=Math.cos(heading)*.17;r.add('cylinder',segment([x-fx,y,z-fz],[x+fx,y,z+fz],.105),hex('#713a22'),'',false,.72)}}
  if(flight){const t=clamp(flight.t,0,1),p=flight.from.map((v,i)=>v+(flight.to[i]-flight.from[i])*t),dx=flight.to[0]-flight.from[0],dz=flight.to[2]-flight.from[2],length=Math.hypot(dx,dz)||1,right=[dz/length,-dx/length];p[1]+=Math.sin(Math.PI*t)*flight.arc;r.add('sphere',pose(...p,.155,.14,.29),hex('#7d4226'));for(const offset of[-.07,0,.07])r.add('cylinder',segment([p[0]+right[0]*.095,p[1]+.10+offset*.18,p[2]+right[1]*.095],[p[0]-right[0]*.095,p[1]+.10+offset*.18,p[2]-right[1]*.095],.014),hex('#f3eee0'));r.add('plane',pose(p[0],.06,p[2],.52,1,.40),[0,0,0,.65],'shadow',true)}
  if(looseBall){const age=simTime-looseBall.born,t=clamp(age/looseBall.life,0,1);if(t>=1)looseBall=null;else{const bounce=Math.abs(Math.sin(age*16))*.36*(1-t),x=looseBall.x+age*.22,z=looseBall.z+age*.12,y=.16+bounce;r.add('sphere',pose(x,y,z,.17,.15,.31),hex('#7d4226'));r.add('cylinder',segment([x-.09,y+.10,z],[x+.09,y+.10,z],.014),hex('#f3eee0'));r.add('plane',pose(x,.06,z,.48,1,.36),[0,0,0,.58],'shadow',true)}}
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
 function simulate(dt){
  previousPresentation=actors.map(p=>({...p,motion:p.motion?{...p.motion}:null}));previousPresentationPhase=phase;previousExchange=exchange?{kind:exchange.kind,ball:[...exchange.ball]}:null;previousFlight=flight?{...flight}:null;
  tick(dt);for(const p of actors)advanceMotion(p,dt,phase);captureHighlight();replay.sample();
 }
 function present(dt,alpha=1){
  const authoritative=actors,holder=carrier,liveExchange=exchange,liveFlight=flight;
  if(presentationSource!==actors){presentationSource=actors;presentationActors=actors.map(p=>({...p}));previousPresentation=null;}
  if(previousPresentationPhase!==phase||replaying)alpha=1;
  actors=presentationActors.map((p,i)=>interpolatePresentation(previousPresentation?.[i],authoritative[i],alpha,p));carrier=holder?actors[holder.index]:null;
  if(exchange&&previousExchange?.kind===exchange.kind)exchange={...exchange,ball:exchange.ball.map((v,i)=>previousExchange.ball[i]+(v-previousExchange.ball[i])*alpha)};
  if(flight&&previousFlight)flight={...flight,t:previousFlight.t+(flight.t-previousFlight.t)*alpha};
  try{camera(dt);scene(dt,(simTime-(1-alpha)/60)*1000)}finally{actors=authoritative;carrier=holder;exchange=liveExchange;flight=liveFlight}
 }
 function loop(now){
  raf=requestAnimationFrame(loop);const dt=Math.min(.25,Math.max(0,(now-last)/1000)||.016);last=now;
  if(document.hidden||r.lost||(paused&&!activeContact&&!replaying))return;
  if(replaying)advanceReplay(dt);else if((!paused||activeContact)&&!qaStepping){accumulator+=dt;let steps=0;while(accumulator>=1/60&&steps++<15){simulate(1/60);accumulator-=1/60;if(paused&&!activeContact)break}}
  present(dt,replaying?1:accumulator*60);updateSkillButtons();if(now>messageUntil)$('message').classList.remove('show');frameId++;
 }
  function setMode(v){if(phase!=='pre')return;mode=v;selected=0;replay.event('mode',{mode:v});setup()}
  $('runTab').onclick=()=>setMode('run');$('passTab').onclick=()=>setMode('pass');$('snap').onpointerdown=e=>{snap();e.preventDefault()};$('snap').onclick=e=>{if(e.detail===0)snap()};$('flipPlay').onclick=flipPlay;$('motionReceiver').onclick=motionReceiver;$('identifyMike').onclick=identifyMike;$('pumpFake').onclick=pumpFake;$('throwAway').onclick=throwAway;$('control').onclick=()=>{assist=!assist;input.x=input.z=0;replay.event('control-mode',{assist});updateControls()};$('pause').onclick=pause;$('resume').onclick=pause;$('watchReplay').onclick=watchReplay;document.querySelectorAll('#catchChoices button').forEach(button=>button.onclick=()=>chooseCatch(button.dataset.catch));
  $('restart').onclick=()=>{replay.event('restart');drive={...initialDrive};paused=false;ended=false;$('paused').hidden=true;setup()};
  $('sendReport').onclick=async()=>{const button=$('sendReport'),status=$('reportStatus'),receipt=$('reportReceipt');if(button.disabled)return;button.disabled=true;button.textContent='SENDING…';status.className='';status.textContent='Uploading gameplay state only…';try{const result=await replay.submit($('reportNote').value);$('reportCode').textContent=result.id;receipt.hidden=false;button.hidden=true;status.className='sent';status.textContent='Upload complete. Codex can locate this report automatically.';button.dataset.reviewUrl=result.reviewUrl||'';receipt.scrollIntoView({block:'nearest',behavior:'smooth'});replay.event('report-sent',{id:result.id})}catch(error){button.disabled=false;button.textContent='SEND FAILED · RETRY';status.className='error';status.textContent=(error?.message||'The gameplay report could not be sent.')+' Your report is still saved on this screen.'}};
  $('copyReportCode').onclick=async()=>{const code=$('reportCode').textContent;if(!code)return;try{await navigator.clipboard.writeText(code);$('copyReportCode').textContent='COPIED ✓'}catch{$('copyReportCode').textContent='PRESS AND HOLD CODE'}};
 function joy(e){const box=$('stick').getBoundingClientRect(),dx=e.clientX-box.left-box.width/2,dy=e.clientY-box.top-box.height/2,max=box.width*.32,len=Math.hypot(dx,dy)||1,s=Math.min(1,max/len);input.x=dx*s/max;input.z=-dy*s/max;if((phase==='pre'||phase==='snap'||phase==='handoff')&&Math.hypot(input.x,input.z)>=.12)snapDirection={x:input.x,z:input.z};$('knob').classList.add('held');$('knob').style.transform=`translate(${dx*s}px,${dy*s}px)`;$('stick').setAttribute('aria-valuenow',input.x.toFixed(2))}
  $('stick').onpointerdown=e=>{if((assist&&phase==='run')||!['pre','snap','handoff','pass','run'].includes(phase))return;input.pointer=e.pointerId;$('stick').setPointerCapture(e.pointerId);joy(e);replay.event('stick-start',{x:input.x,z:input.z});e.preventDefault()};$('stick').onpointermove=e=>{if(input.pointer!==e.pointerId)return;joy(e);e.preventDefault()};const clearJoy=e=>{if(e?.pointerId!==undefined&&input.pointer!==null&&e.pointerId!==input.pointer)return;if(input.pointer!==null)replay.event('stick-end');input.x=input.z=0;input.pointer=null;$('knob').classList.remove('held');$('knob').style.transform='none';$('stick').setAttribute('aria-valuenow','0')};$('stick').onpointerup=clearJoy;$('stick').onpointercancel=clearJoy;$('stick').onlostpointercapture=clearJoy;
  const clearSprint=e=>{if(e&&input.sprintPointer!==e.pointerId)return;if(input.sprint)replay.event('sprint-end');input.sprint=false;input.sprintPointer=null};$('sprint').onpointerdown=e=>{input.sprint=true;input.sprintPointer=e.pointerId;replay.event('sprint-start');$('sprint').setPointerCapture(e.pointerId);e.preventDefault()};$('sprint').onpointerup=clearSprint;$('sprint').onpointercancel=clearSprint;$('sprint').onlostpointercapture=clearSprint;window.addEventListener('pointerup',clearSprint);window.addEventListener('pointercancel',clearSprint);
 document.querySelectorAll('#skillPad button').forEach(button=>{button.onpointerdown=e=>{if(phase!=='run'||simTime<jukeReady)return;let action=button.dataset.skill;if(action==='spin')action=input.x<-.15?'spin-left':'spin-right';button.classList.add('pressed');performSkill(action);e.preventDefault()};const release=()=>button.classList.remove('pressed');button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release});
 const stopSafariZoom=event=>event.preventDefault();for(const type of['gesturestart','gesturechange','gestureend'])document.addEventListener(type,stopSafariZoom,{passive:false});document.addEventListener('touchmove',event=>{if(event.touches.length>1)event.preventDefault()},{passive:false});
 window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();const key=normalizeControlKey(e.key),receiverSlot=receiverSlotForKey(key);keys.add(key);if(e.code==='Space'&&!e.repeat)snap();if(receiverSlot>=0&&!e.repeat)throwTo(receiverIndices[receiverSlot],throwKindForModifiers(e.shiftKey,e.altKey));if(phase==='flight'&&!e.repeat&&key==='c')chooseCatch('secure');if(phase==='flight'&&!e.repeat&&key==='v')chooseCatch('aggressive');if(phase==='flight'&&!e.repeat&&key==='b')chooseCatch('rac');if(key==='Escape'&&!e.repeat)pause();if(key==='j'&&!e.repeat)performSkill('juke');if(key==='q'&&!e.repeat)performSkill('spin-left');if(key==='e'&&!e.repeat)performSkill('spin-right');if(key==='r'&&!e.repeat)performSkill('truck');if(key==='f'&&!e.repeat)performSkill(carrier?.role==='QB'?'slide':'hurdle')});window.addEventListener('keyup',e=>keys.delete(normalizeControlKey(e.key)));
 window.addEventListener('blur',()=>{keys.clear();clearSprint();clearJoy();if(!paused&&!ended)pause()});document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden&&!paused&&!ended)pause()});window.addEventListener('resize',()=>{r.resize();last=performance.now();if(innerHeight>innerWidth&&!paused&&!ended)pause()});window.addEventListener('pagehide',()=>cancelAnimationFrame(raf));window.addEventListener('pageshow',e=>{if(e.persisted){last=performance.now();raf=requestAnimationFrame(loop)}});
 const portrait=matchMedia('(orientation:portrait)');portrait.addEventListener('change',event=>{if(event.matches&&!paused&&!ended)pause()});
 function forceContact(type='wrap',driveEnding=false){
  if(phase!=='run'||!carrier)return false;const contactType=['wrap','dive','gang','big-hit'].includes(type)?type:'wrap',tackler=actors[15],helper=actors[16];tackler.fallen=false;tackler.engaged=false;tackler.engagedWith=null;tackler.x=carrier.x+.64;tackler.z=carrier.z-.22;if(contactType==='gang'){helper.fallen=false;helper.engaged=false;helper.engagedWith=null;helper.x=carrier.x-.72;helper.z=carrier.z+.08}const speed=Math.max(5.8,Math.hypot(carrier.vx,carrier.vz));if(Math.hypot(carrier.vx,carrier.vz)<.2){carrier.vx=0;carrier.vz=speed}if(driveEnding){drive.down=4;drive.toGo=20}const spot=forwardProgressSpot(carrier.z,carrier.vz);lastTackler=tackler.index;beginContactSequence(tackler,{type:contactType},contactType==='gang'?[helper]:[],speed);endPlay(contactType==='big-hit'?'BIG HIT':contactType==='gang'?'GANG TACKLE':contactType==='dive'?'DIVING TACKLE':'TACKLED',spot);return true;
 }
 setup();camera(1);scene(.016,0);$('loading').hidden=true;raf=requestAnimationFrame(loop);
 // Test controls exist only on an explicitly requested QA URL. This isolated
 // practice renderer never reads or writes career saves or result payloads.
 if(new URLSearchParams(location.search).has('qa')){window.bk3dTest={manualFrames(){qaStepping=true;accumulator=0;cancelAnimationFrame(raf)},step(seconds){const n=Math.ceil(clamp(seconds,0,10)*60);for(let i=0;i<n;i++){if(!paused||activeContact)simulate(1/60);camera(1/60)}scene(.016,simTime*1000)},setSnapNumber(value){if(phase!=='pre')return false;drive.plays=Math.max(0,Math.trunc(Number(value)||0));setup();camera(1);scene(.016,simTime*1000);return true},forceContact,flipPlay,motionReceiver,identifyMike,pumpFake,watchReplay};window.bk3dDiagnostics=()=>{const qb=actors[5],nearest=Math.min(...actors.filter(p=>p.team===1&&!p.engaged&&!p.fallen&&(p.role==='DL'||defensiveCall.blitzers.includes(p.index))).map(p=>Math.hypot(p.x-qb.x,p.z-qb.z)),8);return({phase,mode,selected,assist,camera:{eye:[...camEye],target:[...camTarget]},exchange:exchange?{kind:exchange.kind,ball:[...exchange.ball]}:null,transitionFade,elapsed,simTime,paused,ended,lastSkill,lastTackler,catchStyle,preSnap:{runDirection,mikeIndex,motioned},replay:{available:lastHighlight.length,replaying},defense:{index:defensiveCallIndex,id:defensiveCall.id,name:defensiveCall.name,coverage:defensiveCall.coverage,blitzers:[...defensiveCall.blitzers]},contact:activeContact?{type:activeContact.type,elapsed:activeContact.elapsed,duration:activeContact.duration,tackler:activeContact.tackler,helper:activeContact.helper}:null,effects:{turf:turfFx.length,contact:Boolean(contactFx)},throwKind:flight?.kind||null,pocketPressure:phase==='pass'?pocketPressure(nearest,elapsed):0,frames:frameId,drawCalls:r.drawCalls,glError:r.gl.getError(),athletes:meshy.diagnostics(),players:actors.map(p=>({role:p.role,team:p.team,ratings:p.ratings,x:p.x,z:p.z,vx:p.vx,vz:p.vz,distance:p.distance,heading:p.heading,hasBall:p.hasBall,engaged:p.engaged,engagedWith:p.engagedWith,blockStyle:p.blockStyle,blockResult:p.blockResult,routeStyle:p.routeStyle,coverageStyle:p.coverageStyle,fallen:p.fallen,action:p.action,actionT:p.actionT,actionSide:p.actionSide,fallHeading:p.fallHeading,contactWith:p.contactWith,contactRole:p.contactRole,ballTarget:p.ballTarget,catchStyle:p.catchStyle,pose:p.motion?{speed:p.motion.speed,run:p.motion.run,ready:p.motion.ready,block:p.motion.block,turn:p.motion.turn,gait:p.motion.gait,fall:p.motion.fall}:null,head:r.project([p.x,2.1,p.z]),foot:r.project([p.x,0,p.z])})),drive:{...drive},field:{scrimmage:snapZ,lineToGain:snapGainZ},stamina,worldObjects:stadium.parts})};}
}
