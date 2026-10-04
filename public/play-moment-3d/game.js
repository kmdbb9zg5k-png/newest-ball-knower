import {routePoint,pursuitRead,passSetPoint,contactImpact,pocketSpeedFactor,renderDue} from './football-flow.js?v=complete-flow-46';
import {safeFieldCamera} from './field-awareness.js?v=contact-camera-11';
import {createLiveUnits} from './live-units.js?v=complete-flow-46';
import {fullInitialDrive,fullSession,fullLog,fullRecord,fullOffenseEnd,fullContinue,fullCpuPlay,fullKick,fullCpuResult,fullConversion,fullKickoffResult,fullCpuKickChoice,fullPuntResult} from './five-minute.js?v=contact-camera-11';
import {rosterRatings,rosterIdentity} from './mini-teams.js?v=contact-camera-11';
import{RUNS,PASSES,FORMATIONS,FIELD_GOAL_PLAY,formationForPlay,matchingPlays,blockingScheme}from'./playbook.js?v=contact-camera-11';
export{RUNS,PASSES}from'./playbook.js?v=contact-camera-11';
import{Renderer,pose,segment,hex,mul,ry}from'./renderer.js?v=football-foundation-44';
import{drawAthlete,prepareJerseys,advanceMotion}from'./athlete.js?v=reference-motion-45';
import{createMeshyAthletes}from'./meshy-athlete.js?v=complete-flow-46';
import{createMeshyAthletes as createReferenceAthletes}from'./reference-athlete.js?v=reference-helmets-49';
import{makeStadium}from'./stadium.js?v=contact-camera-11';
import{createGameplayReplayRecorder}from'./replay.js';
import {miniClock,miniGameFromSearch,miniInitialDrive,miniSession,miniRatings,miniSnap,miniWhistle,miniBetweenPlays,miniTimeout,miniSpike,miniFinish} from './mini-games.js?v=contact-camera-11';
import {createMiniGamesUI} from './mini-games-ui.js?v=contact-camera-11';
import{QB_THROW_RELEASE,quarterbackThrowDuration}from'./quarterback.js?v=football-finish-21';
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
export function initialAssistMode(search=''){return new URLSearchParams(search).get('assist')==='1'}
export function gameplayInstruction({phase,mode='run',assist=true,qbRunner=false}={}){
 if(phase==='pre')return mode==='pass'?'CHOOSE A ROUTE · SNAP THE BALL':'AIM RUN DIRECTION WITH THE STICK · SNAP';
 if(phase==='snap')return'WATCH THE EXCHANGE';
 if(phase==='handoff')return assist?'HANDOFF · AUTO ROUTE ACTIVE':'HOLD THE STICK THROUGH THE HANDOFF';
 if(phase==='pass')return'PICK A RECEIVER · SCRAMBLE TO RUN';
 if(phase==='flight')return'CHOOSE YOUR CATCH · SECURE, AGGRESSIVE OR RUN';
 if(phase==='run')return assist?'AUTO RUNNING · TAP A MOVE OR SPRINT':'STEER · SPRINT · JUKE · SPIN · POWER';
 if(phase==='dead')return'PLAY OVER · SETTING UP THE NEXT DOWN';
 return'';
}
export function receiverSlotForKey(key){const slot={x:0,y:1,z:2,'1':0,'2':1,'3':2,'4':3,'5':4}[normalizeControlKey(key)];return Number.isInteger(slot)?slot:-1}
export function catchBreakupChance(separation){return separation<.7?.9:separation<1.2?.68:separation<2?.3:.04}
export function defenderPursuitSpeed(separation,afterCatch=false){const base=afterCatch?7.65:6.8,ceiling=afterCatch?8.85:8.55;return clamp(base+Math.max(0,separation-1)*(afterCatch?.14:.11),base,ceiling)}
/** A defender's running speed comes from his ratings, not his distance to the ball. */
export function playerTopSpeed(player){const rating=Number(player?.ratings?.speed);return 5.2+6*(clamp(Number.isFinite(rating)?rating:78,35,99)-35)/64}
export function playerRunSpeed(player,sprinting=false){return playerTopSpeed(player)*(sprinting?1:.8)}
/** Carry pace is separate from route speed and the approved running animation. */
export function carrierRunSpeed(player,sprinting=false){return player.role==='QB'?playerTopSpeed(player):playerRunSpeed(player,sprinting)*(player.role==='RB'?.92:1)}
export function routeRunSpeed(player){return playerRunSpeed(player)*.86}
export function defenderRunSpeed(defender){return playerTopSpeed(defender)*.98}
export function tackleRadius(possessionSeconds,afterCatch=false){const grace=afterCatch?.18:.25;if(possessionSeconds<grace)return 0;return 1.05}
/** Require real convergence before a tackle begins so parallel runners do not
 * magnetically snap into contact. Very close body contact still counts. */
export function tackleContactEligible(defender,runner,radius){
 const dx=(runner.x||0)-(defender.x||0),dz=(runner.z||0)-(defender.z||0),distance=Math.hypot(dx,dz);
 if(!radius||distance>=radius)return false;
 if(distance<=.9)return true;
 // An arm-length chase from behind can initiate a wrap even at matched pace.
 const pace=Math.hypot(runner.vx||0,runner.vz||0),behind=pace>.5&&(dx*(runner.vx||0)+dz*(runner.vz||0))/(distance*pace)>.65;
 if(behind)return true;
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
 const proximity=clamp((6-nearestRusherDistance)/5.25,0,1),late=clamp((seconds-2.1)/3,0,1);
 return clamp(proximity*.78+late*.3,0,1);
}
/** Pressure includes collapsing blocks, with free rushers projected briefly ahead. */
export function pocketThreat(quarterback,defenders,seconds){
 let nearest=8;
 for(const d of defenders){
  if(d.fallen)continue;
  const dx=quarterback.x-d.x,dz=quarterback.z-d.z,distance=Math.hypot(dx,dz),closing=((d.vx||0)-(quarterback.vx||0))*dx/Math.max(distance,.01)+((d.vz||0)-(quarterback.vz||0))*dz/Math.max(distance,.01);
  nearest=Math.min(nearest,d.engaged?distance+1.8:distance-Math.max(0,closing)*.28);
 }
 return pocketPressure(nearest,seconds);
}
/** Move eye and aim as one rig; different damping creates an unintended camera turn. */
export function cameraRigTravel(eye,target,desiredEye,desiredTarget,dt,rate=5,maxSpeed=24){
 const distance=Math.max(Math.hypot(...desiredEye.map((v,i)=>v-eye[i])),Math.hypot(...desiredTarget.map((v,i)=>v-target[i]))),blend=Math.min(cameraFollowBlend(dt,rate),maxSpeed*Math.max(0,dt)/Math.max(distance,.001));
 return{eye:eye.map((v,i)=>v+(desiredEye[i]-v)*blend),target:target.map((v,i)=>v+(desiredTarget[i]-v)*blend)};
}
export function sackLoss(scrimmageZ,qbZ){return clamp(Math.round(scrimmageZ-qbZ)+1,3,12)}
export function hasCrossedScrimmage(qbZ,scrimmageZ){return qbZ>=scrimmageZ+.15}
export function canThrowAway(qbX){return Math.abs(Number(qbX)||0)>6}
export function qbMovementSpeed(qbX,forwardInput=0,quarterback={ratings:{speed:78}}){return playerTopSpeed(quarterback)*pocketSpeedFactor(qbX,forwardInput)}
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
/** Compose a readable elevated live-run camera around the ball carrier. */
export function runCameraFraming(x,z,vx=0,vz=0){
 const pace=clamp(Math.hypot(vx,vz)/10,0,1),leadX=clamp(vx*.22,-1.4,1.4),leadZ=clamp(vz*.16,-1.2,1.6);
 return{eye:[x+.45+leadX*.35,4.7+pace*.12,z-9.2+leadZ],target:[x+leadX,1.2,z+3.2+leadZ]};
}
/** Finish the catch shot after the whistle, keeping the contact centered.
 * Choose once: reacting to moving bystanders every frame makes the view weave. */
export function contactCameraFraming(focus,players=[]){
 const offsets=[[.7,5.2,-7.2],[-3.3,5.2,-7.2],[3.3,5.2,-7.2]];
 let best=offsets[0],bestCost=Infinity;
 for(const offset of offsets){
  const ex=focus.x+offset[0],ez=focus.z+offset[2],length2=offset[0]**2+offset[2]**2;let cost=Math.abs(offset[0])*.06;
  for(const p of players){
   if(p===focus||p.fallen||p.contactWith===focus.index)continue;
   const t=clamp(((p.x-ex)*-offset[0]+(p.z-ez)*-offset[2])/length2,0,1),gap=Math.hypot(p.x-(ex-offset[0]*t),p.z-(ez-offset[2]*t));
   if(t>.04&&t<.92&&gap<1.05&&offset[1]*(1-t)+.8*t<2.5)cost+=(1.05-gap)*3;
  }
  if(cost<bestCost){bestCost=cost;best=offset}
 }
 return{offset:best,eye:[focus.x+best[0],best[1],focus.z+best[2]],target:[focus.x,.8,focus.z]};
}
/** Select a scoring shot with a clear sightline, without moving any players.
 * Keep the run's rear quarter; penalize bodies between the lens and scorer.
 * The chosen offset is held for the entire celebration to avoid side switching. */
export function touchdownCameraFraming(scorer,players=[]){
 const offsets=[[-3.2,3.1,-5.2],[3.2,3.1,-5.2],[-4.2,3.1,-2.8],[4.2,3.1,-2.8]];
 let best=offsets[0],bestCost=Infinity;
 for(const offset of offsets){
  const ex=scorer.x+offset[0],ez=scorer.z+offset[2],dx=-offset[0],dz=-offset[2],length2=dx*dx+dz*dz;
  let cost=Math.abs(offset[0])*.04;
  for(const p of players){if(p===scorer||p.fallen)continue;
   const t=((p.x-ex)*dx+(p.z-ez)*dz)/length2;
   if(t<=0||t>=.94)continue;
   const lateral=Math.abs((p.x-ex)*dz-(p.z-ez)*dx)/Math.sqrt(length2);
   cost+=Math.max(0,1.35-lateral)*(1.5-t)*(p.team===scorer.team?2:3);
  }
  if(cost<bestCost){best=offset;bestCost=cost}
 }
 return{eye:[scorer.x+best[0],best[1],scorer.z+best[2]],target:[scorer.x,1.0,scorer.z],offset:[...best]};
}
/** Orbit outside the scorer, limited to one radian/second for a calmer reveal. */
export function touchdownCameraTravel(eye,target,desiredEye,desiredTarget,dt){
 const blend=cameraFollowBlend(dt,3),dx=eye[0]-desiredTarget[0],dz=eye[2]-desiredTarget[2],tx=desiredEye[0]-desiredTarget[0],tz=desiredEye[2]-desiredTarget[2];
 const radius=Math.hypot(dx,dz),desiredRadius=Math.hypot(tx,tz),from=Math.atan2(dx,dz),to=Math.atan2(tx,tz),delta=Math.atan2(Math.sin(to-from),Math.cos(to-from));
 const maxTurn=Math.max(0,dt),angle=from+clamp(delta*blend,-maxTurn,maxTurn),distance=Math.max(4.5,radius+(desiredRadius-radius)*blend);
 return{eye:[desiredTarget[0]+Math.sin(angle)*distance,eye[1]+(desiredEye[1]-eye[1])*blend,desiredTarget[2]+Math.cos(angle)*distance],target:target.map((v,i)=>v+(desiredTarget[i]-v)*blend)};
}
/** Interpolate presentation only. Input, collisions and the replay recorder
 * continue to use the authoritative 60 Hz simulation coordinates. */
export function interpolatePresentation(previous,current,alpha,out={}){
 Object.assign(out,current);if(!previous)return out;const t=clamp(alpha,0,1);
 for(const key of['x','z','vx','vz','distance','throwT'])if(Number.isFinite(previous[key])&&Number.isFinite(current[key]))out[key]=previous[key]+(current[key]-previous[key])*t;
 out.heading=previous.heading+Math.atan2(Math.sin(current.heading-previous.heading),Math.cos(current.heading-previous.heading))*t;
 if(previous.action===current.action)out.actionT=previous.actionT+(current.actionT-previous.actionT)*t;
 if(previous.motion&&current.motion){out.motion={...current.motion};for(const key of['speed','run','turn','gait','stridePhase','fall','block','vx','vz','acceleration','lean','bank'])if(Number.isFinite(previous.motion[key])&&Number.isFinite(current.motion[key]))out.motion[key]=previous.motion[key]+(current.motion[key]-previous.motion[key])*t;}
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
/** RAC keeps moving upfield without a held stick; steering always takes priority. */
export function racControlVector(inputX,inputZ){
 return Math.hypot(inputX,inputZ)>=.12?carrierControlVector(false,inputX,inputZ):{x:0,z:1,manual:false};
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
 p.fallen=true;p.vx=p.vz=0;p.moving=false;p.engaged=false;p.engagedWith=null;p.blockStyle=null;p.liveContact=null;p.contactWith=null;p.contactRole=null;
 Object.assign(p,{action:type,actionStarted:time,actionUntil:time+duration,actionT:0,actionSide:side});
}
/** Clear live-play overlays even when a catch immediately becomes a touchdown. */
export function releasePostPlay(p){
 // Former blocking pairs take one short backward recovery step after the whistle.
 // Preserve the step when endPlay also calls endDrive for a score or turnover.
 if(p.engaged&&!p.fallen&&!p.hasBall){p.wasBlocking=true;p.disengage={heading:p.heading||0,elapsed:0,delay:.08+(p.index%4)*.045};}
 const finish=['interception','breakup','catch-miss'].includes(p.action);
 p.engaged=false;p.engagedWith=null;p.blockStyle=null;if(p.action!=='interception')p.ballTarget=null;p.sprinting=false;p.liveContact=null;
 p.throwT=0;p.throwStyle=null;p.throwStarted=null;p.catchT=0;p.receiving=false;p.lookTarget=null;if(!finish){p.reactionT=0;p.reactionSide=0}p.routeStyle=null;p.coverageStyle=null;
 if(!p.fallen&&!finish){p.action=null;p.actionT=0;p.contactWith=null;p.contactRole=null}
}
export function advancePlayerAction(p,time,dead=false){
 if(!p.action||!Number.isFinite(p.actionStarted)||!Number.isFinite(p.actionUntil))return;
 p.actionT=clamp((time-p.actionStarted)/Math.max(.001,p.actionUntil-p.actionStarted),0,1);
 if(p.action==='interception'&&p.possessionFrom){const t=smooth(p.actionT/.82),h=p.heading||0,side=(p.index+p.team)%2?-1:1,target=[p.x+Math.sin(h)*.25+Math.cos(h)*side*.20,1.18,p.z+Math.cos(h)*.25-Math.sin(h)*side*.20];p.ballTarget=p.possessionFrom.map((v,i)=>v+(target[i]-v)*t);if(p.actionT>=1){p.ballTarget=null;p.possessionFrom=null}}
 if(p.action==='get-up'&&p.recoveryStart&&p.recoveryOffset){const step=smooth((p.actionT-.04)/.34);p.x=p.recoveryStart[0]+p.recoveryOffset[0]*step;p.z=p.recoveryStart[1]+p.recoveryOffset[1]*step}
 if(time<p.actionUntil)return;
 if(p.fallen){
  if(dead){p.actionT=1;return}
  if(p.action==='get-up'){p.fallen=false;p.contactVariant=null;p.fallHeading=undefined;p.recoveryStart=null;p.recoveryOffset=null;p.contactWith=null;p.contactRole=null;p.contactReady=time+.2;p.action=null;p.actionT=0;p.actionSide=0;return}
  if(time<p.actionUntil+(p.recoveryHold??(.36+(p.index%4||0)*.065))){p.actionT=1;return}
  p.recoveryStart=[p.x,p.z];p.recoverySide=p.hasBall?((p.index+p.team)%2?1:-1):(p.actionSide||1);p.recoveryRole=p.contactRole;p.contactWith=null;p.contactRole=null;p.action='get-up';p.actionStarted=time;p.actionUntil=time+(p.hasBall?1.20:p.recoveryRole==='tackler'?1.02:1.02+(p.index%3||0)*.085);p.actionT=0;return;
 }
 p.action=null;p.actionT=0;p.actionSide=0;p.contactRole=null;p.contactWith=null;p.breakupTarget=null;
}
/** Failed contact has a reach, a brief struggle, and a planted recovery.
 * It must not start with an unearned full-body knockdown. */
export function beginGlancingContact(runner,defender,time,type='broken'){
 const side=Math.sign((defender.x-runner.x)*Math.cos(runner.heading||0)-(defender.z-runner.z)*Math.sin(runner.heading||0))||1;
 defender.engaged=false;defender.engagedWith=null;defender.blockStyle=null;
 defender.liveContact={runner:runner.index,type,started:time,side};
 Object.assign(defender,{action:'wrap-release',actionStarted:time,actionUntil:time+.82,actionT:0,actionSide:side,contactRole:'tackler',contactWith:runner.index,contactReady:time+1.8});
 Object.assign(runner,{action:type==='stumble'?'stumble':'break-tackle',actionStarted:time,actionUntil:time+.76,actionT:0,actionSide:-side});
 const retention=type==='stumble'?.56:type==='broken'?.68:.9;runner.vx*=retention;runner.vz*=retention;
}
export function advanceGlancingContact(defender,runner,time,dt){
 const c=defender.liveContact;if(!c)return;
 const age=time-c.started,grip=c.type==='miss'?.10:.30;
 if(age>=.82||!runner||runner.fallen){defender.liveContact=null;defender.contactWith=null;defender.contactRole=null;return}
 const oldX=defender.x,oldZ=defender.z,h=runner.heading||0,release=smooth((age-grip)/.32),targetX=runner.x+Math.cos(h)*c.side*(.65+.42*release)-Math.sin(h)*(.12+.6*release),targetZ=runner.z-Math.sin(h)*c.side*(.65+.42*release)-Math.cos(h)*(.12+.6*release),dx=targetX-oldX,dz=targetZ-oldZ,distance=Math.hypot(dx,dz)||1,step=Math.min(distance,(age<grip?playerTopSpeed(defender):3.2*(1-release)+.7)*dt);
 defender.x=clamp(oldX+dx/distance*step,-26.3,26.3);defender.z=oldZ+dz/distance*step;defender.vx=(defender.x-oldX)/dt;defender.vz=(defender.z-oldZ)/dt;defender.distance+=step;
 const facing=Math.atan2(runner.x-defender.x,runner.z-defender.z);defender.heading+=Math.atan2(Math.sin(facing-defender.heading),Math.cos(facing-defender.heading))*Math.min(1,dt*8);
 if(age>grip+.16){defender.contactWith=null;defender.contactRole=null}
}
/** Swap the default Mike assignment without duplicating a second-level target. */
export function identifyMikeAssignments(assignments,mikeIndex=16){
 const mike=clamp(Math.trunc(mikeIndex)||16,15,17);return assignments.map(([blocker,defender])=>[blocker,defender===16?mike:defender===mike?16:defender]);
}
export const QB_LATERAL_LIMIT=26;
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
 const lead=clamp(intercept,.08,ahead>1.5?4:2.4)*clamp((separation-.65)/3,0,1),collapse=clamp((separation-2.5)/4,0,1);
 const lateral=(defender.x-runner.x)*fz-(defender.z-runner.z)*fx,side=Math.sign(lateral)||Math.sign(pursuitLaneOffset(defender.index,separation,runner.x))||1;
 const lane=role==='primary'?0:side*(role==='contain'?1.3:1.7+(defender.index%3)*.65)*collapse;
 return{x:clamp(runner.x+vx*lead+fz*lane,-25.8,25.8),z:clamp(runner.z+vz*lead-fx*lane,0,112)};
}
/** Nearest defender attacks; a deeper outside defender keeps containment. */
export function pursuitRole(defender,runner,teammates,time=0){
 const free=teammates.filter(p=>p.team===defender.team&&!p.fallen&&!p.engaged&&!p.liveContact&&time>=(p.contactReady||0)),distance=p=>Math.hypot(p.x-runner.x,p.z-runner.z),nearest=free.reduce((best,p)=>!best||distance(p)<distance(best)?p:best,null);
 if(nearest===defender)return'primary';
 const speed=Math.hypot(runner.vx||0,runner.vz||0),fx=speed>.5?runner.vx/speed:0,fz=speed>.5?runner.vz/speed:1;
 return (defender.x-runner.x)*fx+(defender.z-runner.z)*fz>1.5?'contain':'support';
}
/** Avoid teammates before overlap resolution, while converging for a tackle. */
export function pursuitSteering(defender,runner,teammates,speed,afterCatch=false,time=0){
 const role=pursuitRole(defender,runner,teammates,time),aim=pursuitRead(defender,runner,pursuitTarget(defender,runner,afterCatch,speed,role),time),dx=aim.x-defender.x,dz=aim.z-defender.z,len=Math.hypot(dx,dz)||1;
 let x=dx/len,z=dz/len;const contact=Math.hypot(runner.x-defender.x,runner.z-defender.z),strength=clamp((contact-.75)/2,.12,1.25);
 for(const other of teammates){if(other===defender||other.team!==defender.team||other.fallen||other.engaged)continue;const ox=defender.x-other.x,oz=defender.z-other.z,d=Math.hypot(ox,oz);if(d>.001&&d<2.6){const weight=(1-d/2.6)*strength;x+=ox/d*weight;z+=oz/d*weight}}
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
 const finish=angle<.32?'drag-down':angle<.70?'shoulder-hit':defenderMomentum>.58&&distance>.45?'low-wrap':'wrap';
 return{type:bigHit?'big-hit':gangTackle?'gang':dive?'dive':stumble?'stumble':finish,edge};
}
/** Presentation timing for a completed tackle. Gameplay owns the spot; this
 * only lets the carrier, tackler and optional helper finish the contact. */
export function contactPresentation(type,momentum=0,side=1){
 const speed=clamp(Number(momentum)||0,0,1),direction=Math.sign(Number(side)||1)||1;
 const profiles={
  wrap:{duration:1.08,carrierDrive:.38+speed*.30,tacklerDrive:.20,spread:.22,helper:false,shake:1},
  'shoulder-hit':{duration:.86,carrierDrive:.44+speed*.30,tacklerDrive:.14,spread:.22,lateral:.48,helper:false,shake:1.22},
  'low-wrap':{duration:1.00,carrierDrive:.48+speed*.28,tacklerDrive:.12,spread:.16,lateral:.06,helper:false,shake:1.08},
  'drag-down':{duration:1.34,carrierDrive:.24+speed*.22,tacklerDrive:.24,spread:.18,lateral:.25,helper:false,shake:.92},
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
 ][blockingScheme(runIndex)].map(pair=>pair.slice())}
/** Receivers stalk the force defenders instead of jogging through a run play. */
export function perimeterBlockAssignments(runIndex=0){return[
 [[7,18],[9,20]],
 [[8,19],[9,20]],
 [[7,18],[8,19]],
 [[8,19],[9,20]],
 ][blockingScheme(runIndex)].map(pair=>pair.slice())}
/** Defenders must diagnose a handoff/misdirection before using predictive pursuit. */
export function runReadDelay(callIndex,defenderIndex,runIndex=0){
 const call=DEFENSIVE_CALLS[((Math.trunc(callIndex)||0)%DEFENSIVE_CALLS.length+DEFENSIVE_CALLS.length)%DEFENSIVE_CALLS.length];
 if(defenderIndex>=15&&defenderIndex<=17)return call.reads[defenderIndex-15]+(blockingScheme(runIndex)===2?(defenderIndex===16?.24:.1):0);
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
// Use live route coordinates and fit the drawing to its players and arrowheads.
function playDiagram(play,kind,direction=1){
 const point=([x,z])=>[70+x*2.3*direction,60-z*1.35];
 const formation=formationForPlay(play),positions=formation.positions,origins=[positions[2],positions[3],positions[4],positions[5],positions[1]];
 const routes=kind==='kick'?[[positions[0],[0,20]]]:kind==='run'?[[positions[play.fake?0:1],...play.path],...(play.option?[[positions[0],...play.keepPath]]:[])]:play.routes.map((path,i)=>path.map(([x,z])=>[x+origins[i][0],z+origins[i][1]]));
 const bounds=[];
 const lines=routes.map((route,i)=>{const points=route.map(point),end=points.at(-1),before=points.at(-2),angle=Math.atan2(end[1]-before[1],end[0]-before[0]);const wing=side=>[end[0]-4*Math.cos(angle+side*.6),end[1]-4*Math.sin(angle+side*.6)],arrow=[wing(-1),end,wing(1)];bounds.push(...points,...arrow);return '<g class="route route-'+i+'"><polyline points="'+points.map(p=>p.join(',')).join(' ')+'"/><polyline points="'+arrow.map(p=>p.join(',')).join(' ')+'"/></g>'}).join('');
 const players=[[-4.4,-.35],[-2.2,-.35],[0,-.35],[2.2,-.35],[4.4,-.35],positions[0],...origins].map(p=>{const[x,y]=point(p);bounds.push([x,y]);return '<circle cx="'+x+'" cy="'+y+'" r="2"/>'}).join('');
 const left=Math.min(...bounds.map(p=>p[0]))-7,top=Math.min(...bounds.map(p=>p[1]))-7,right=Math.max(...bounds.map(p=>p[0]))+7,bottom=Math.max(...bounds.map(p=>p[1]))+7;
 return '<svg class="play-diagram" viewBox="'+[left,top,right-left,bottom-top].join(' ')+'" aria-hidden="true" focusable="false"><path class="diagram-yard" d="M'+left+' 20H'+right+'M'+left+' 40H'+right+'M'+left+' 60H'+right+'"/>'+lines+'<g class="diagram-players">'+players+'</g></svg>';
}
function travel(path,distance){return routePoint(path,distance)}
export function runConceptDirection(runIndex,seconds,runnerX,runnerZ,scrimmageZ,direction=1,keep=false){const concept=RUNS[clamp(Math.trunc(runIndex)||0,0,RUNS.length-1)],point=travel(keep&&concept.keepPath?concept.keepPath:concept.path,Math.max(0,seconds)*concept.pathSpeed+concept.pathLead),side=Math.sign(direction)||1,targetX=point[0]*side,dx=targetX-runnerX,dz=scrimmageZ+point[1]-runnerZ,length=Math.hypot(dx,dz)||1;return{x:dx/length,z:dz/length,targetX,targetZ:scrimmageZ+point[1]}}
export function predictPassDestination(path,startX,startZ,elapsed,duration,speed){const p=travel(path,Math.max(0,elapsed+duration)*speed);return[clamp(startX+p[0],-26.3,26.3),1.6,startZ+p[1]]}
export function start(){
 const miniConfig=miniGameFromSearch(location.search),fullGame=Boolean(miniConfig);let mini=fullGame?fullSession(miniConfig.mode,true):miniConfig?miniSession():null;
 function fieldCamera(eye,target){const shot=safeFieldCamera(eye,target);r.camera(shot.eye,shot.target);}
 const r=new Renderer($('game')),stadium=makeStadium(r),meshy=fullGame?createReferenceAthletes(r):createMeshyAthletes(r);let actors=[],frameId=0,elapsed=0,last=0,raf=0,messageUntil=0,recoveryLeft=0,postPlayElapsed=0,deadBallFocus=null,exchange=null,transitionFade=0,activeContact=null,pendingPlayMessage=null,pendingDriveEnd=null,soundContext=null,highlightFrames=[],lastHighlight=[],highlightSampleAt=-1,replaying=false,replayCursor=0,replayEndPhase='dead';
 let playbookOpen=true,bookFilter='all',bookFormation='all',optionChoice='give',bookChoice={mode:'run',index:0};
 let mode='run',selected=0,assist=initialAssistMode(location.search),phase='pre',paused=false,ended=false,flight=null,lastFlightEnd=null,looseBall=null,carrier=null,jukeUntil=0,jukeReady=0,simTime=0,lastSkill=null,lastSkillAt=-10,impactShake=0,catchStyle='rac',runDirection=1,mikeIndex=16,motioned=false,receiverMotion=null,prePanel=null,playArtVisible=false,plantReady=0,turfFx=[],nextTurfFx=0,contactFx=null;
 const redZone=new URLSearchParams(location.search).get('scenario')==='redzone';
 const initialDrive=fullGame?fullInitialDrive(miniConfig.mode):miniConfig?miniInitialDrive():{ball:redZone?85:25,down:1,toGo:10,clock:redZone?63:78,score:24,plays:0};
 let drive={...initialDrive},snapZ=10+initialDrive.ball,snapGainZ=10+lineToGain(initialDrive),stamina=1;
 let input={x:0,z:0,sprint:false,pointer:null,sprintPointer:null},snapDirection={x:0,z:0},snapDirectionUntil=0,camEye=[14,16,10],camTarget=[0,0,40],cameraReset=true,runCameraBlend=0,runCameraStart=null,flightCameraStart=null,deadCameraStart=null,defensiveCallIndex=0,defensiveCall=DEFENSIVE_CALLS[0],lastTackler=null;const keys=new Set();
 let qaStepping=false;let accumulator=0;let numSeed=175;const rand=()=>{numSeed=(Math.imul(numSeed,1664525)+1013904223)>>>0;return numSeed/4294967296};
 let pendingThrow=null,liveUnit=null,conversionDrive=null;
 let previousPresentation=null,previousPresentationPhase=null,previousExchange=null,previousFlight=null,presentationSource=null,presentationActors=[];
 // Stable fictional identities for this isolated practice roster.
 const practiceLastNames=['Bennett','Cruz','Foster','Hayes','Brooks','Mercer','Vega','Reed','Ellis','Banks','Cole','Stone','Grant','Price','Ford','Ward','Knox','Blake','Cross','West','Hill','Shaw'];
 const specs=[['OL',-4.4,-.35,71],['OL',-2.2,-.35,64],['OL',0,-.35,55],['OL',2.2,-.35,68],['OL',4.4,-.35,79],['QB',0,-5,12],['RB',-2,-7,24],['WR',-21,0,11],['WR',-12,-.6,18],['WR',21,0,84],['TE',6.5,-.4,87],['DL',-5,.8,90],['DL',-1.7,.8,94],['DL',1.7,.8,97],['DL',5,.8,92],['LB',-8,5,53],['LB',0,5,54],['LB',8,5,58],['DB',-20,3,21],['DB',-12,9,23],['DB',20,4,29],['DB',8,17,31]];
 const receiverIndices=[7,8,9,10,6],receiverKeys=['X','Y','Z','A','B'];
  const replay=createGameplayReplayRecorder(()=>({simTime,phase,mode,selected,drive,input,assist,defense:defensiveCall.id,carrierIndex:carrier?.index??-1,lastSkill,runDirection,mikeIndex,motioned,players:actors}));
  const liveBallAnchor=(player,anchorPhase=phase)=>meshy.ballAnchor(player,anchorPhase)?.center||carriedBallAnchor(player,anchorPhase).slice(0,3);
 function currentPlay(){return(mode==='run'?RUNS:PASSES)[selected]}
 function applyFormation(){
  const f=formationForPlay(currentPlay());
  f.positions.forEach(([x,z],i)=>{const p=actors[i+5];p.x=p.startX=x;p.z=p.startZ=snapZ+z});
  if(f.id==='special-teams'){
   for(let i=0;i<5;i++){actors[i].x=actors[i].startX=(i-2)*1.25;}
   actors[5].action='hold-kick';actors[6].role='K';
   if(miniConfig){const team=miniConfig.matchup.home;Object.assign(actors[6],rosterIdentity(team.kicker,team));actors[6].ratings=rosterRatings(playerRatings('RB',6,0),team.kicker);}
   for(const i of[7,8,9,10])actors[i].role='TE';
   actors.slice(11).forEach((p,i)=>{p.x=p.startX=(i-5)*1.25;p.z=p.startZ=snapZ+1+(i%2)*.6;});
  }
  // Condensed shotgun splits match the reference's readable formation.
  // Move the outside corners with their receiver alignment, not the interior fits.
  if(f.id==='shotgun')for(const p of actors.filter(p=>p.team&&Math.abs(p.x)>18)){p.x=p.startX=p.x*17/21;}
  if(f.fullback){Object.assign(actors[8],{role:'FB',number:44,lastName:'Nash',ratings:playerRatings('RB',8,0)});if(miniConfig){const team=miniConfig.matchup.home;Object.assign(actors[8],rosterIdentity(team.fullback,team));actors[8].ratings=rosterRatings(playerRatings('RB',8,0),team.fullback)}}
 }
 function chooseOption(choice){
  if(paused||ended||playbookOpen||mode!=='run'||!currentPlay().option||!['pre','snap','handoff'].includes(phase)||(phase==='handoff'&&elapsed>(currentPlay().handoff+.55)*.7))return;
  optionChoice=choice;replay.event('option-choice',{choice});updateControls();
 }
  function setup(showPlaybook=true){cameraReset=true;playbookOpen=showPlaybook;bookChoice={mode,index:selected};optionChoice='give';pendingThrow=null;messageUntil=0;$('message').classList.remove('show');snapZ=10+drive.ball;snapGainZ=10+lineToGain(drive);defensiveCall=situationalDefensiveCall(drive);defensiveCallIndex=DEFENSIVE_CALLS.indexOf(defensiveCall);runDirection=1;mikeIndex=16;motioned=false;receiverMotion=null;prePanel=null;playArtVisible=false;plantReady=simTime;snapDirection={x:0,z:0};snapDirectionUntil=0;postPlayElapsed=0;runCameraBlend=0;runCameraStart=null;flightCameraStart=null;deadCameraStart=null;deadBallFocus=null;pendingPlayMessage=null;pendingDriveEnd=null;lastFlightEnd=null;looseBall=null;exchange=null;actors=specs.map(([role,x,z,number],index)=>({index,role,number,lastName:practiceLastNames[index],team:index>=11?1:0,ratings:miniRatings(playerRatings(role,index,index>=11?1:0),index>=11?1:0,miniConfig?.level),x,z:snapZ+z,startX:x,startZ:snapZ+z,heading:index>=11?Math.PI:0,vx:0,vz:0,distance:0,moving:false,sprinting:false,engaged:false,engagedWith:null,blockStyle:null,blockResult:null,blockResolvedAt:-1,routeStyle:null,coverageStyle:null,fallen:false,hasBall:index===2,throwT:0,throwStyle:null,catchT:0,catchStyle:null,action:null,actionT:0,actionSide:0,throwStarted:null,throwDuration:0,reactionT:0,reactionSide:0,contactReady:0}));if(miniConfig){actors.forEach((p,index)=>{const team=p.team?miniConfig.matchup.away:miniConfig.matchup.home,player=team.lineup[index];Object.assign(p,rosterIdentity(player,team,Boolean(p.team)));p.ratings=miniRatings(rosterRatings(playerRatings(p.role,index,p.team),player),p.team,miniConfig.level);})}defensiveCall.alignments.forEach(([x,z],i)=>{const p=actors[11+i];p.x=p.startX=x;p.z=p.startZ=snapZ+z});applyFormation();actors[2].ballTarget=[actors[2].x,.42,actors[2].z-.2];carrier=actors[5];flight=null;activeContact=null;phase='pre';stamina=1;elapsed=0;impactShake=0;turfFx=[];nextTurfFx=0;contactFx=null;catchStyle='rac';input={x:0,z:0,sprint:false,pointer:null,sprintPointer:null};keys.clear();$('knob').classList.remove('held');$('knob').style.transform='none';$('stick').setAttribute('aria-valuenow','0');$('stamina').firstElementChild.style.width=(mode==='pass'?0:100)+'%';jukeUntil=0;jukeReady=simTime;lastSkill=null;lastSkillAt=-10;prepareJerseys(r,actors);$('playerNames').replaceChildren();for(const p of actors.filter(p=>p.team===0&&['WR','RB','TE'].includes(p.role))){const label=document.createElement('span'),position=document.createElement('span'),name=document.createElement('span');label.id='player-name-'+p.index;label.className='player-name';position.className='player-position';position.textContent=p.role;name.textContent=p.lastName;label.append(position,name);label.setAttribute('aria-label',p.role+' '+p.lastName+', number '+p.number);$('playerNames').appendChild(label)}updateHud();updateControls();renderPlays();renderPlaybook();replay.event('setup',{down:drive.down,ball:drive.ball,defense:defensiveCall.id});replay.sample(true)}
 function updateHud(){$('score').textContent=drive.score;$('clock').textContent=miniClock(drive.clock);$('down').textContent=ended&&drive.ball>=100?'TOUCHDOWN · +6 POINTS':downDistanceLabel(drive)+' · '+(drive.ball<50?'OWN '+drive.ball:drive.ball===50?'50':'OPP '+(100-drive.ball));if(mini)miniUI?.update(mini,drive,phase,paused,ended,Boolean(receiverMotion));if(conversionDrive)$('down').textContent=playbookOpen?'TOUCHDOWN · CALL YOUR CONVERSION':currentPlay().fake?'TWO-POINT TRY · '+currentPlay().name:'TWO-POINT TRY';if(liveUnit?.state){const u=liveUnit.state;$('down').textContent=u.kind==='defense'?`CPU BALL · ${mini.cpu.down} & ${mini.cpu.toGo} · ${mini.cpu.ball<50?'OWN '+mini.cpu.ball:'OPP '+(100-mini.cpu.ball)}`:u.kind==='extra-point'?'EXTRA POINT':u.kind==='field-goal'?'FIELD GOAL':u.kind==='punt'?(u.kicking==='home'?'PUNT':'PUNT RETURN'):u.kicking==='home'?'KICKOFF':'KICK RETURN';}}
 function renderPlays(){
  const plays=mode==='run'?RUNS:PASSES;$('plays').replaceChildren();
  plays.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.className=i===selected?'selected':'';b.setAttribute('aria-pressed',String(i===selected));b.innerHTML=playDiagram(p,mode,runDirection)+'<b>'+p.name+'</b>';b.onclick=()=>{if(phase!=='pre'||playbookOpen||paused)return;selected=i;replay.event('play-select',{mode,play:p.id});renderPlays();$('plays').children[i]?.focus?.({preventScroll:true})};$('plays').appendChild(b)});
  $('playName').textContent=plays[selected].name;for(const kind of ['run','pass']){$(kind+'Tab').classList.toggle('selected',mode===kind);$(kind+'Tab').setAttribute('aria-pressed',String(mode===kind))}
 }
 function renderPlaybook(){
  const grid=$('playbookGrid'),scrollTop=grid.scrollTop;grid.replaceChildren();
  if(!mini?.conversion&&bookFormation==='special-teams')bookFormation='all';
  for(const tab of $('formationTabs').children)if(tab.dataset.formation==='special-teams')tab.hidden=mini?.conversion!=='home';
  $('playbookTitle').textContent=mini?.conversion==='home'?'CALL YOUR CONVERSION':'CALL YOUR PLAY';
  const entries=matchingPlays(bookFormation,bookFilter);
  if(!entries.some(e=>e.mode===bookChoice.mode&&e.index===bookChoice.index)&&entries.length)bookChoice={mode:entries[0].mode,index:entries[0].index};
  for(const {mode:kind,index:i,play:p} of entries){
   const b=document.createElement('button'),chosen=bookChoice.mode===kind&&bookChoice.index===i;b.type='button';b.id='call-'+kind+'-'+i;b.className='play-card'+(chosen?' selected':'');b.dataset.mode=kind;b.dataset.index=String(i);b.dataset.formation=p.formation;b.setAttribute('aria-pressed',String(chosen));b.setAttribute('aria-label',p.name+', '+formationForPlay(p).name+', '+kind+' play');b.innerHTML='<span class="play-card-heading"><b>'+p.name+'</b><small>'+(p.option?'READ':kind.toUpperCase())+'</small></span>'+playDiagram(p,kind)+'<span class="play-card-formation">'+formationForPlay(p).name+'</span>';
   b.onclick=()=>{if(!playbookOpen||paused)return;bookChoice={mode:kind,index:i};renderPlaybook();$(b.id).focus?.({preventScroll:true})};grid.appendChild(b);
  }
  grid.scrollTop=scrollTop;
  if(!entries.length){const empty=document.createElement('p');empty.className='playbook-empty';empty.textContent='No '+(bookFilter==='read'?'read options':bookFilter+' plays')+' in this formation. Choose another filter.';grid.appendChild(empty)}
  for(const [filter,id]of[['all','filterAll'],['run','filterRun'],['pass','filterPass'],['read','filterRead']]){$(id).setAttribute('aria-pressed',String(bookFilter===filter));$(id).classList.toggle('selected',bookFilter===filter)}
  for(const button of $('formationTabs').children){const active=button.dataset.formation===bookFormation;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active))}
  const play=bookChoice.mode==='kick'?FIELD_GOAL_PLAY:(bookChoice.mode==='run'?RUNS:PASSES)[bookChoice.index];
  $('breakHuddle').disabled=!entries.length;
  $('callName').textContent=entries.length?play.name:'CHOOSE A FORMATION';$('callType').textContent=entries.length?formationForPlay(play).name+' · '+(bookChoice.mode==='kick'?'1 POINT':mini?.conversion==='home'?'2 POINTS':play.option?'READ OPTION':bookChoice.mode.toUpperCase()):'NO MATCHING PLAYS';
  $('playCount').textContent=entries.length+' PLAYS';
 }
 function openPlaybook(){if(phase!=='pre'||paused||ended)return;playbookOpen=true;prePanel=null;setPlayArt(false);bookChoice={mode,index:selected};bookFormation=currentPlay().formation;bookFilter='all';clearJoy();keys.clear();renderPlaybook();updateControls();$('call-'+mode+'-'+selected)?.focus?.({preventScroll:true})}
 function breakHuddle(){if(!playbookOpen||paused||ended||phase!=='pre'||!matchingPlays(bookFormation,bookFilter).length)return;if(bookChoice.mode==='kick'){drive={...conversionDrive};conversionDrive=null;bookFormation='all';startUnit('extra-point');return;}mode=bookChoice.mode;selected=bookChoice.index;if(conversionDrive){drive.ball=currentPlay().fake?85:98;drive.down=1;drive.toGo=currentPlay().fake?15:2;}replay.event('play-call',{mode,play:(mode==='run'?RUNS:PASSES)[selected].id});setup(false);$('snap').focus?.({preventScroll:true})}
  function chooseCatch(style){if(!CATCH_STYLES[style]||phase!=='flight'||!flight||flight.throwAway||paused)return;catchStyle=style;replay.event('catch-style',{style});document.querySelectorAll('#catchChoices button').forEach(button=>{button.classList.toggle('selected',button.dataset.catch===style);button.setAttribute('aria-pressed',String(button.dataset.catch===style))});if(phase==='flight'||pendingThrow)$('instruction').textContent=CATCH_STYLES[style].label+' CATCH SELECTED'}
 function flipPlay(){if(phase!=='pre'||playbookOpen||paused)return;runDirection*=-1;$('flipPlay').classList.toggle('active',runDirection<0);replay.event('pre-snap',{adjustment:'flip',direction:runDirection});renderPlays();updateControls();message(runDirection<0?'PLAY FLIPPED LEFT':'PLAY FLIPPED RIGHT',.7)}
 function motionReceiver(){
  if(phase!=='pre'||playbookOpen||paused||formationForPlay(currentPlay()).fullback)return;
  const receiver=actors[8],homeX=formationForPlay(currentPlay()).positions[3][0];motioned=!motioned;
  const targetX=motioned?-homeX:homeX,direction=Math.sign(targetX-receiver.x)||1;
  // Travel behind the line, clear the blockers, then return to the slot depth.
  receiverMotion={points:[[receiver.x,snapZ-2.5],[targetX-direction*3,snapZ-2.5],[targetX,snapZ+formationForPlay(currentPlay()).positions[3][1]]],settle:0};
  receiver.action='pre-motion';prePanel=null;setPlayArt(false);updateControls();
  replay.event('pre-snap',{adjustment:'motion',receiver:receiver.index,active:motioned});
 }
 function advanceReceiverMotion(dt){
  if(!receiverMotion||playbookOpen)return;
  const p=actors[8];
  if(receiverMotion.points.length){
   const [x,z]=receiverMotion.points[0],dx=x-p.x,dz=z-p.z,distance=Math.hypot(dx,dz),speed=Math.min(5,playerTopSpeed(p)*.66,Math.sqrt(18*distance));
   if(distance<=Math.max(.065,Math.hypot(p.vx,p.vz)*dt)){
    move(p,x,z,dt);p.vx=p.vz=0;receiverMotion.points.shift();
    if(!receiverMotion.points.length){p.startX=p.x;p.startZ=p.z;p.action=null;p.moving=false;receiverMotion.settle=.35}
   }else accelerate(p,dx/distance,dz/distance,speed,dt,12,18);
  }else{
   p.heading+=Math.atan2(Math.sin(-p.heading),Math.cos(-p.heading))*Math.min(1,dt*12);
   receiverMotion.settle-=dt;
   if(receiverMotion.settle<=0){p.heading=0;receiverMotion=null;updateControls()}
  }
 }
 function setPlayArt(visible){
  playArtVisible=Boolean(visible&&phase==='pre'&&!playbookOpen&&!paused&&!ended&&!replaying&&!prePanel);
  $('playArt').setAttribute('aria-pressed',String(playArtVisible));
  $('playArt').firstElementChild.textContent=playArtVisible?'HIDE PLAY':'SHOW PLAY';
  $('playArt').setAttribute('aria-label',(playArtVisible?'Hide':'Show')+' play routes and receiver names. Keyboard P.');
  $('playerNames').hidden=!playArtVisible;
  if(playArtVisible)positionPlayerNames();
 }
 function togglePlayArt(){if(phase!=='pre'||playbookOpen||paused||ended)return;const visible=!playArtVisible;prePanel=null;updateControls();setPlayArt(visible)}
 function closePrePanel(focus=false){prePanel=null;updateControls();if(focus)$('adjustPlay').focus?.({preventScroll:true})}
 function showPrePanel(panel){if(phase!=='pre'||playbookOpen||paused||ended)return;prePanel=panel;setPlayArt(false);renderAudibles();updateControls()}
 function renderAudibles(){
  const choices=matchingPlays(currentPlay().formation).filter(e=>e.mode!==mode||e.index!==selected).sort((a,b)=>Number(a.mode===mode)-Number(b.mode===mode)).slice(0,3).map(e=>[e.mode,e.index]);
  $('quickAudibles').replaceChildren();
  for(const [kind,index]of choices){const play=(kind==='run'?RUNS:PASSES)[index],button=document.createElement('button');button.type='button';button.dataset.mode=kind;button.dataset.index=String(index);button.innerHTML='<small>'+kind.toUpperCase()+'</small><b>'+play.name+'</b>';button.setAttribute('aria-label','Audible to '+play.name+', '+kind+' play');button.onclick=()=>{if(phase!=='pre'||playbookOpen||paused)return;mode=kind;selected=index;prePanel=null;optionChoice='give';setPlayArt(false);replay.event('audible',{mode,play:play.id});renderPlays();updateControls();$('snap').focus?.({preventScroll:true})};$('quickAudibles').appendChild(button)}
 }
 function identifyMike(){if(phase!=='pre'||playbookOpen||paused||mode!=='run')return;mikeIndex=mikeIndex===17?15:mikeIndex+1;$('identifyMike').textContent='MIKE '+actors[mikeIndex].number;$('identifyMike').classList.toggle('active',mikeIndex!==16);replay.event('pre-snap',{adjustment:'mike',defender:mikeIndex});message('MIKE '+actors[mikeIndex].number+' IDENTIFIED',.75)}
 function updateControls(){if(liveUnit?.state){$('playbook').hidden=true;$('pre').hidden=true;$('live').hidden=paused;$('live').dataset.phase='run';$('hud').dataset.phase='run';$('hud').dataset.playbook='false';$('catchChoices').hidden=true;$('targetLayer').replaceChildren();$('playerNames').hidden=true;$('skillPad').hidden=true;$('instruction').hidden=true;$('stick').style.opacity='1';$('stick').style.pointerEvents='auto';$('miniActions').hidden=true;return;}$('skillPad').hidden=false;
  document.querySelectorAll('#catchChoices button').forEach(button=>{button.classList.toggle('selected',button.dataset.catch===catchStyle);button.setAttribute('aria-pressed',String(button.dataset.catch===catchStyle))});
  const optionActive=mode==='run'&&currentPlay().option&&!playbookOpen&&!paused&&!ended&&!prePanel&&['pre','snap','handoff'].includes(phase);$('optionChoices').hidden=!optionActive;for(const choice of ['give','keep']){$('option-'+choice).setAttribute('aria-pressed',String(optionChoice===choice));$('option-'+choice).disabled=phase==='handoff'&&elapsed>(currentPlay().handoff+.55)*.7}
  $('motionReceiver').disabled=Boolean(formationForPlay(currentPlay()).fullback);
  $('playbook').hidden=!playbookOpen||paused||ended||replaying||phase==='cpu';$('hud').dataset.playbook=String(playbookOpen);$('control').hidden=false;$('instruction').hidden=playbookOpen||phase==='dead'||phase==='cpu';$('pre').hidden=phase!=='pre'||playbookOpen||paused||ended;$('live').hidden=!['pre','snap','handoff','pass','flight','run'].includes(phase)||playbookOpen||paused||ended||replaying;$('live').dataset.phase=pendingThrow?'windup':phase;$('hud').dataset.phase=pendingThrow?'windup':phase;$('hud').dataset.assist=String(assist);$('catchChoices').hidden=!(mode==='pass'&&!playbookOpen&&!paused&&!ended&&!replaying&&!prePanel&&(phase==='flight'&&flight&&!flight.throwAway));
  $('prePanel').hidden=!prePanel||phase!=='pre'||playbookOpen||paused||ended;$('adjustPlay').setAttribute('aria-expanded',String(Boolean(prePanel)));$('adjustPane').hidden=prePanel!=='adjust';$('audiblePane').hidden=prePanel!=='audible';$('adjustTab').setAttribute('aria-pressed',String(prePanel==='adjust'));$('audibleTab').setAttribute('aria-pressed',String(prePanel==='audible'));$('identifyMike').hidden=mode!=='run';$('adjustHelp').textContent=mode==='run'?'Mike sets which linebacker the run blockers target.':'Flip mirrors the routes. Motion moves the slot receiver.';$('snap').disabled=Boolean(receiverMotion);$('snapLabel').textContent=receiverMotion?'GETTING SET':'SNAP BALL';$('flipPlay').setAttribute('aria-pressed',String(runDirection<0));$('motionReceiver').setAttribute('aria-pressed',String(motioned));setPlayArt(playArtVisible);
  $('flipPlay').classList.toggle('active',runDirection<0);$('motionReceiver').classList.toggle('active',motioned);$('identifyMike').textContent='MIKE '+(actors[mikeIndex]?.number||54);$('identifyMike').classList.toggle('active',mikeIndex!==16);
  $('stick').setAttribute('aria-label',phase==='pre'?'Set movement direction before the snap':phase==='handoff'?'Keep holding movement through the handoff':phase==='pass'?'Move quarterback':'Move ball carrier');const qbRunner=phase==='run'&&carrier?.role==='QB';
  $('instruction').textContent=optionActive?'READ THE EDGE · GIVE TO HB OR KEEP WITH QB':gameplayInstruction({phase:pendingThrow&&!pendingThrow.throwAway?'flight':phase,mode,assist,qbRunner});
  $('airMove').textContent=qbRunner?'SLIDE':'HURDLE';$('airMove').dataset.skill=qbRunner?'slide':'hurdle';$('power').textContent='TRUCK';$('throwAway').classList.remove('ready');$('throwAway').dataset.ready='false';$('throwAway').setAttribute('aria-label','Throwaway unavailable. Leave the pocket first.');$('control').textContent='RUNNING: '+(assist?'AUTOMATIC':'MANUAL');$('controlHelp').textContent=assist?'Ball carriers run automatically. You still move the quarterback in the pocket.':'Steer the quarterback and ball carrier with the joystick or arrow keys.';$('control').setAttribute('aria-pressed',String(assist));$('control').setAttribute('aria-label','Running control: '+(assist?'automatic':'manual')+'. Tap to change.');const stickDisabled=assist&&(phase==='run'||phase==='handoff');$('stick').style.opacity=stickDisabled?'.3':'1';$('stick').style.pointerEvents=stickDisabled?'none':'auto';$('targetLayer').replaceChildren();
  $('scramble').hidden=phase!=='pass'||Boolean(pendingThrow);
  if(phase==='pass'&&!pendingThrow)receiverIndices.forEach((index,i)=>{const b=document.createElement('button');b.className='target';b.id='target-'+index;const badge=document.createElement('span');badge.className='target-label';badge.textContent=actors[index].role;const tether=document.createElement('span');tether.className='target-tether';tether.setAttribute('aria-hidden','true');b.append(tether,badge);b.setAttribute('aria-label','Throw to '+actors[index].role+' number '+actors[index].number+'. Keyboard '+receiverKeys[i]+'. Tap for bullet, hold for touch or lob.');let pressedAt=null;b.onpointerdown=e=>{pressedAt=performance.now();b.setPointerCapture(e.pointerId);e.preventDefault()};b.onpointerup=e=>{if(pressedAt===null)return;const held=performance.now()-pressedAt;pressedAt=null;throwTo(index,throwKindForHold(held));e.preventDefault()};b.onpointercancel=()=>{pressedAt=null};b.onclick=e=>{if(e.detail===0)throwTo(index,'bullet')};$('targetLayer').appendChild(b)})
 }
 function updateSkillButtons(){const ready=phase==='run'&&simTime>=jukeReady;document.querySelectorAll('#skillPad button').forEach(button=>{button.classList.toggle('cooldown',phase==='run'&&!ready);button.classList.toggle('ready',ready);button.setAttribute('aria-disabled',String(!ready))})}
 function message(text,seconds=1.4){$('message').textContent=text;$('message').classList.add('show');messageUntil=performance.now()+seconds*1000}
 function stadiumSound(kind='snap'){try{const AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor)return;soundContext||=new AudioCtor();if(soundContext.state==='suspended')soundContext.resume();const now=soundContext.currentTime,duration=kind==='touchdown'?1.15:kind==='hit'?.22:.08,buffer=soundContext.createBuffer(1,Math.ceil(soundContext.sampleRate*duration),soundContext.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);const source=soundContext.createBufferSource(),filter=soundContext.createBiquadFilter(),gain=soundContext.createGain();source.buffer=buffer;filter.type=kind==='touchdown'?'bandpass':'lowpass';filter.frequency.value=kind==='touchdown'?720:kind==='hit'?180:420;gain.gain.setValueAtTime(kind==='touchdown'?.055:kind==='hit'?.08:.045,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);source.connect(filter).connect(gain).connect(soundContext.destination);source.start(now)}catch{}}
  function snap(){if(phase!=='pre'||playbookOpen||paused||ended||receiverMotion)return;prePanel=null;setPlayArt(false);if(mode==='run'&&Math.hypot(input.x,input.z)>=.12)snapDirection={x:input.x,z:input.z};if(mode==='run'&&Math.hypot(snapDirection.x,snapDirection.z)>=.12)snapDirectionUntil=simTime+1.35;if(mini){miniSnap(mini);miniUI.update(mini,drive,'snap',paused,ended,false)}phase='snap';elapsed=0;actors.forEach(p=>p.hasBall=false);exchange={kind:'snap',ball:[actors[2].x,.42,actors[2].z-.2],from:[actors[2].x,.42,actors[2].z-.2]};actors[formationForPlay(currentPlay()).snapReceiver||5].action='receive-snap';actors[2].action='snap';drive.plays++;lastTackler=null;carrier=actors[5];highlightFrames=[];highlightSampleAt=-1;replay.event('snap',{mode,play:(mode==='run'?RUNS:PASSES)[selected].id,defense:defensiveCall.id,runDirection,mikeIndex,motioned,openingX:snapDirection.x,openingZ:snapDirection.z});stadiumSound('snap');navigator.vibrate?.(7);message(mode==='run'?RUNS[selected].name:defensiveCall.blitzers.length?'PRESSURE LOOK · READ HOT':'READ THE COVERAGE',.85);updateControls()}
 function captureHighlight(){if(phase==='pre'||phase==='dead'||simTime-highlightSampleAt<.08)return;highlightSampleAt=simTime;highlightFrames.push({phase,exchange:exchange?{kind:exchange.kind,ball:[...exchange.ball]}:null,carrier:carrier?.index??5,players:actors.map(p=>({x:p.x,z:p.z,heading:p.heading,vx:p.vx,vz:p.vz,distance:p.distance,sprinting:p.sprinting,hasBall:p.hasBall,fallen:p.fallen,fallHeading:p.fallHeading,contactWith:p.contactWith,contactRole:p.contactRole,contactVariant:p.contactVariant,ballTarget:p.ballTarget,engaged:p.engaged,engagedWith:p.engagedWith,blockStyle:p.blockStyle,routeStyle:p.routeStyle,coverageStyle:p.coverageStyle,action:p.action,actionT:p.actionT,actionSide:p.actionSide,throwT:p.throwT,throwStyle:p.throwStyle,catchT:p.catchT,catchStyle:p.catchStyle}))});if(highlightFrames.length>100)highlightFrames.shift()}
 function applyHighlightFrame(frame){phase=frame.phase;exchange=frame.exchange?{...frame.exchange,ball:[...frame.exchange.ball]}:null;carrier=actors[frame.carrier]||actors[5];frame.players.forEach((state,index)=>Object.assign(actors[index],state))}
 function watchReplay(){if(mini||!lastHighlight.length||replaying)return;replaying=true;replayCursor=0;replayEndPhase=phase;paused=false;$('paused').hidden=true;message('INSTANT REPLAY',9);applyHighlightFrame(lastHighlight[0]);updateControls()}
 function advanceReplay(dt){if(!replaying)return;replayCursor+=dt/.08*.68;const index=Math.min(lastHighlight.length-1,Math.floor(replayCursor));applyHighlightFrame(lastHighlight[index]);if(index>=lastHighlight.length-1){replaying=false;if(replayEndPhase==='pre')setup();else phase='dead';paused=true;$('paused').hidden=false;message('REPLAY COMPLETE',.8);updateControls()}}
 function move(p,x,z,dt,turn=12){if(p.liveContact)return;if(p.fallen){p.vx=p.vz=0;p.moving=false;return}const dx=x-p.x,dz=z-p.z,dist=Math.hypot(dx,dz);p.moving=dist>.001;p.distance+=dist;p.vx=dt>0?dx/dt:0;p.vz=dt>0?dz/dt:0;p.x=clamp(x,-26.3,26.3);p.z=z;if(dist>.001){const heading=Math.atan2(dx,dz),diff=Math.atan2(Math.sin(heading-p.heading),Math.cos(heading-p.heading));p.heading+=diff*Math.min(1,dt*turn)}}
 function chase(p,x,z,speed,dt){const dx=x-p.x,dz=z-p.z,len=Math.hypot(dx,dz)||1,step=Math.min(len,Math.min(speed,playerTopSpeed(p))*dt);move(p,p.x+dx/len*step,p.z+dz/len*step,dt)}
 function accelerate(p,x,z,speed,dt,acceleration=19,deceleration=25){
  if(p.liveContact)return;
  const next=locomotionStep(p.vx||0,p.vz||0,x,z,Math.min(speed,playerTopSpeed(p)),dt,acceleration,deceleration);
  move(p,p.x+next.vx*dt,p.z+next.vz*dt,dt,10.5);p.vx=next.vx;p.vz=next.vz;
 }
 function resolvePlayerOverlaps(){
  for(let sweep=0;sweep<3;sweep++)for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){const a=actors[i],b=actors[j];if((a.fallen&&b.fallen)||a.contactWith===b.index||b.contactWith===a.index||a.engagedWith===b.index||b.engagedWith===a.index||((phase==='snap'||phase==='handoff')&&[5,6].includes(i)&&[5,6].includes(j)))continue;if(phase==='run'&&((a===carrier&&b.team!==a.team)||(b===carrier&&a.team!==b.team)))continue;const correction=separationCorrection(a.x,a.z,b.x,b.z,phase==='dead'?(pendingDriveEnd?.title==='TOUCHDOWN'?1.45:1.12):phase==='run'?(a.team===b.team?1.22:.86):(a.team===b.team?1.08:.88),i*23+j+1);if(!correction.ax&&!correction.az)continue;const fixedA=a.fallen||a.contactWith!=null,fixedB=b.fallen||b.contactWith!=null;if(fixedA&&fixedB)continue;if(!fixedA){a.x=clamp(a.x+correction.ax*(fixedB?2:1),-26.3,26.3);a.z+=correction.az*(fixedB?2:1)}if(!fixedB){b.x=clamp(b.x+correction.bx*(fixedA?2:1),-26.3,26.3);b.z+=correction.bz*(fixedA?2:1)}}
 }
 function settlePlayers(dt){
  const contactIds=activeContact?new Set([activeContact.tackler,activeContact.helper,carrier?.index]):new Set(),drag=Math.exp(-9*dt);
  for(const p of actors){
   if(p.fallen||contactIds.has(p.index))continue;
   if(p.celebrateTarget){const target=p.celebrateTarget,dx=target.x-p.x,dz=target.z-p.z,len=Math.hypot(dx,dz);if(len>.25){move(p,p.x+dx/len*Math.min(len,5.2*dt),p.z+dz/len*Math.min(len,5.2*dt),dt,6);continue}p.celebrateTarget=null;p.vx=p.vz=0;p.heading=Math.atan2(carrier.x-p.x,carrier.z-p.z);setTimedAction(p,'celebrate',2.8,p.index%2?1:-1);}
   if(p.action==='celebrate'){p.vx=p.vz=0;p.moving=false;continue}
   if(p.action==='breakup'||p.action==='catch-miss'){p.vx=p.vz=0;continue}
   if(p!==carrier&&!p.wasBlocking&&!p.disengage&&!p.recoveryWatch&&carrier&&Math.hypot(p.x-carrier.x,p.z-carrier.z)<10){const dx=p.x-carrier.x,dz=p.z-carrier.z,len=Math.hypot(dx,dz)||1;p.recoveryWatch={x:p.x+dx/len*(.35+(p.index%3)*.12),z:p.z+dz/len*(.35+(p.index%3)*.12),delay:.12+(p.index%4)*.04}}
   if(p.recoveryWatch&&postPlayElapsed>p.recoveryWatch.delay){const watch=p.recoveryWatch,dx=watch.x-p.x,dz=watch.z-p.z,len=Math.hypot(dx,dz);if(len>.025&&postPlayElapsed<.85){const step=Math.min(len,1.15*dt);move(p,p.x+dx/len*step,p.z+dz/len*step,dt,5);continue}const facing=Math.atan2(carrier.x-p.x,carrier.z-p.z);p.heading+=Math.atan2(Math.sin(facing-p.heading),Math.cos(facing-p.heading))*Math.min(1,dt*2)}
   if(p.disengage){
    const release=p.disengage,previous=smooth((release.elapsed-release.delay)/.55);release.elapsed+=dt;
    const progress=smooth((release.elapsed-release.delay)/.55),step=(progress-previous)*.65;
    if(step>0){move(p,p.x-Math.sin(release.heading)*step,p.z-Math.cos(release.heading)*step,dt,0);if(progress===1){p.disengage=null;p.wasBlocking=false;p.vx=p.vz=0};continue}
   }
   p.vx*=drag;p.vz*=drag;if(Math.hypot(p.vx,p.vz)<.08){p.vx=p.vz=0;p.moving=false;continue}
   move(p,p.x+p.vx*dt,p.z+p.vz*dt,dt,7);
  }
  resolvePlayerOverlaps();
 }

 function pursue(p,target,speed,dt,afterCatch=false){if(p.fallen)return;if(phase==='run'||phase==='handoff')speed=defenderRunSpeed(p)*defensiveCall.pursuit;const aim=pursuitTarget(p,target,afterCatch,speed),steer=pursuitSteering(p,target,actors,speed,afterCatch,simTime),distance=Math.hypot(aim.x-p.x,aim.z-p.z),approach=Math.hypot(target.vx||0,target.vz||0)<1.2?Math.min(speed,Math.max(.8,distance*4)):speed;accelerate(p,steer.x,steer.z,approach,dt,17,22)}
 function emitRunFx(){
  if(phase!=='run'||!carrier)return;const speed=Math.hypot(carrier.vx||0,carrier.vz||0);if(speed<4||simTime<nextTurfFx)return;
  const inv=1/(speed||1),forwardX=carrier.vx*inv,forwardZ=carrier.vz*inv,rightX=forwardZ,rightZ=-forwardX,side=(Math.floor(simTime*15)+carrier.index)%2?1:-1,jitter=(rand()-.5)*.18;
  turfFx.push({x:carrier.x-forwardX*.34+rightX*(side*.19+jitter),z:carrier.z-forwardZ*.34+rightZ*(side*.19+jitter),born:simTime,life:.34+rand()*.18,size:.25+rand()*.16,driftX:-forwardX*.38+rightX*side*.22,driftZ:-forwardZ*.38+rightZ*side*.22});
  if(turfFx.length>28)turfFx.shift();nextTurfFx=simTime+(carrier.sprinting?.055:.095);
 }
 function setTimedAction(p,type,duration,side=0){p.action=type;p.actionStarted=simTime;p.actionUntil=simTime+duration;p.actionT=0;p.actionSide=side}
 function beginSkillAction(type,duration,side=0){carrier.action=type;carrier.actionStarted=simTime;carrier.actionUntil=simTime+duration;carrier.actionT=0;carrier.actionSide=side}
 function updateSkillAction(){for(const p of actors)advancePlayerAction(p,simTime,phase==='dead'&&postPlayElapsed<1.35&&p.recoveryHold==null)}
 function beginContactSequence(tackler,outcome,helpers=[],speed=0){
  const impact=contactImpact(carrier,tackler),dirX=impact.x,dirZ=impact.z,side=impact.side,presentation=contactPresentation(outcome.type==='wrap'?impact.variant:outcome.type,Math.max(speed/9.5,impact.energy),side),helper=presentation.helper?helpers.find(p=>p!==tackler&&!p.fallen&&!p.liveContact&&simTime>=p.contactReady&&Math.hypot(p.x-carrier.x,p.z-carrier.z)<1.8)||null:null;
  activeContact={type:presentation.type,elapsed:0,...presentation,dirX,dirZ,rightX:dirZ,rightZ:-dirX,carrierStart:[carrier.x,carrier.z],tacklerStart:[tackler.x,tackler.z],tackler:tackler.index,tacklerHeading:Math.atan2(carrier.x-tackler.x,carrier.z-tackler.z),helper:helper?.index??null,helperStart:helper?[helper.x,helper.z]:null};
  contactFx={x:carrier.x,z:carrier.z,born:simTime,power:presentation.shake};
  const action=['shoulder-hit','low-wrap','drag-down'].includes(presentation.type)?'wrap':presentation.type;carrier.contactVariant=tackler.contactVariant=presentation.type;setTimedAction(tackler,action,presentation.duration,side);setTimedAction(carrier,action,presentation.duration,-side);carrier.fallen=true;tackler.fallen=true;carrier.heading=Math.atan2(dirX,dirZ);carrier.fallHeading=tackler.fallHeading=carrier.heading;carrier.contactRole='carrier';carrier.recoveryHold=.55;carrier.contactWith=tackler.index;tackler.recoveryHold=.16;tackler.contactRole='tackler';tackler.contactWith=carrier.index;carrier.vx=carrier.vz=0;tackler.vx=tackler.vz=0;
  if(helper){setTimedAction(helper,'gang',presentation.duration,-side);helper.vx=helper.vz=0;helper.fallen=true;helper.fallHeading=carrier.heading;helper.contactRole='tackler';helper.recoveryHold=.34;helper.contactWith=carrier.index}
  impactShake=presentation.shake;recoveryLeft=presentation.duration+.34;
 }
 function advanceContactSequence(dt){
  const c=activeContact;if(!c)return;c.elapsed=Math.min(c.duration,c.elapsed+dt);const raw=clamp(c.elapsed/c.duration,0,1),t=smooth((raw-.16)/.84),ball=carrier,tackler=actors[c.tackler],carrierX=c.carrierStart[0]+c.dirX*c.carrierDrive*t+c.rightX*c.side*(c.lateral||0)*t,carrierZ=c.carrierStart[1]+c.dirZ*c.carrierDrive*t+c.rightZ*c.side*(c.lateral||0)*t;
 ball.x=clamp(carrierX,-26.3,26.3);ball.z=carrierZ;ball.vx=ball.vz=0;ball.actionT=raw;ball.moving=false;
 const tacklerX=carrierX-c.dirX*(.56-c.tacklerDrive*t)+c.rightX*c.side*(.70+.22*smooth((raw-.60)/.40)),tacklerZ=carrierZ-c.dirZ*(.56-c.tacklerDrive*t)+c.rightZ*c.side*(.70+.22*smooth((raw-.60)/.40));const close=smooth(raw/.24);tackler.x=c.tacklerStart[0]+(tacklerX-c.tacklerStart[0])*close;tackler.z=c.tacklerStart[1]+(tacklerZ-c.tacklerStart[1])*close;tackler.heading=c.tacklerHeading+Math.atan2(Math.sin(ball.heading-c.tacklerHeading),Math.cos(ball.heading-c.tacklerHeading))*smooth((raw-.10)/.42);tackler.actionT=raw;tackler.moving=false;
 if(c.helper!==null){const helper=actors[c.helper],targetX=carrierX-c.dirX*.25-c.rightX*c.side*.88,targetZ=carrierZ-c.dirZ*.25-c.rightZ*c.side*.88;helper.x=c.helperStart[0]+(targetX-c.helperStart[0])*t;helper.z=c.helperStart[1]+(targetZ-c.helperStart[1])*t;const facing=Math.atan2(ball.x-helper.x,ball.z-helper.z);helper.heading=facing+Math.atan2(Math.sin(ball.heading-facing),Math.cos(ball.heading-facing))*smooth((raw-.10)/.42);helper.actionT=raw;helper.moving=false}
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
  receiverIndices.forEach((idx,i)=>{const p=actors[idx],routeSpeed=routeRunSpeed(p),pos=travel(PASSES[selected].routes[i],elapsed*routeSpeed);move(p,p.startX+pos[0]*runDirection,p.startZ+pos[1],dt);p.routeStyle=elapsed<.48?'release':Math.abs(p.motion?.turn||0)>1.05?'cut':'stem';p.lookTarget=null;p.receiving=false;p.ballTarget=null;if(flight?.target===idx){const t=clamp(flight.t,0,1),ball=flight.from.map((v,k)=>v+(flight.to[k]-v)*t);ball[1]+=Math.sin(Math.PI*t)*flight.arc;p.lookTarget=ball;if((1-t)*flight.duration<.22&&Math.hypot(ball[0]-p.x,ball[2]-p.z)<1.6&&ball[1]<2.7){p.receiving=true;p.ballTarget=ball;}}});
  const shell=defensiveCall.coverage,targets=receiverIndices.map(i=>actors[i]),corners=[actors[18],actors[19],actors[20]],safety=actors[21];
  const landing=flight&&!flight.throwAway&&flight.t*flight.duration>.24?{x:flight.to[0],z:flight.to[2]}:null,reacting=new Set(landing?[...corners,safety].filter(p=>!p.fallen).sort((a,b)=>Math.hypot(a.x-landing.x,a.z-landing.z)-Math.hypot(b.x-landing.x,b.z-landing.z)).slice(0,2):[]);
  corners.forEach((d,i)=>{if(reacting.has(d)){chase(d,landing.x,landing.z,playerTopSpeed(d)*.95,dt);return;}const t=targets[i],speed=playerTopSpeed(d)*(shell==='man'?.9:.88);d.coverageStyle=elapsed<.62+i*.05?'pedal':Math.abs(d.motion?.turn||0)>1?'break':'match';if(elapsed<.18+i*.06)return;if(shell==='quarters'){chase(d,t.x,t.z+2.25,speed,dt)}else if(shell==='zone'){const zoneX=[-15,0,15][i],near=targets.reduce((best,p)=>Math.abs(p.x-zoneX)<Math.abs(best.x-zoneX)?p:best,targets[0]);chase(d,zoneX+(near.x-zoneX)*.4,clamp(near.z+1,snapZ+5,110),speed,dt)}else{const undercut=shell==='robber'&&i===1?-.35:1.05;chase(d,t.x+(i===1?-1.1:Math.sign(t.x||1)*-1),t.z+undercut,speed,dt)}});
  safety.coverageStyle=elapsed<.75?'pedal':'break';if(reacting.has(safety)){chase(safety,landing.x,landing.z,playerTopSpeed(safety)*.95,dt)}else if(shell==='quarters'){const deep=targets.reduce((a,b)=>a.z>b.z?a:b);chase(safety,deep.x,deep.z+3.2,playerTopSpeed(safety)*.9,dt)}else if(shell==='zone'){chase(safety,targets.reduce((a,b)=>a.z>b.z?a:b).x,Math.max(snapZ+14,...targets.map(p=>p.z+3)),playerTopSpeed(safety)*.9,dt)}else if(shell==='robber'){chase(safety,targets[1].x,targets[1].z-.8,playerTopSpeed(safety)*.9,dt)}else{const deep=targets.reduce((a,b)=>a.z>b.z?a:b);chase(safety,deep.x,deep.z+2.7,playerTopSpeed(safety)*.9,dt)}
  const underneathTargets=[targets[3],targets[4],targets[1]];for(let i=15;i<18;i++){if(defensiveCall.blitzers.includes(i))continue;const d=actors[i],t=underneathTargets[i-15],zoneX=[-7,0,7][i-15],speed=playerTopSpeed(d)*(shell==='robber'?.86:.82);d.coverageStyle=elapsed<.52?'pedal':Math.abs(d.motion?.turn||0)>.92?'break':'match';chase(d,shell==='man'?clamp(t.x,-12,12):zoneX,Math.min(t.z+(shell==='robber'?-.4:1),snapZ+12),speed,dt)}
 }
 function runClock(){return elapsed+(phase==='handoff'?.28:phase==='run'&&mode==='run'?(RUNS[selected].handoff+.83):0)}
 function runFit(defender,dt){
  if(defender.fallen)return;
  const clock=runClock(),readAt=runReadDelay(defensiveCallIndex,defender.index,selected)*(miniConfig?.level.readScale||1),slot=defender.index-15,runSide=Math.sign(RUNS[selected].path[2][0]||1)*runDirection,falseSide=blockingScheme(selected)===2?-runSide:runSide,target=phase==='handoff'?actors[6]:carrier;
  if(clock<readAt){const fit=slot>=0&&slot<3?defensiveCall.fits[slot]:0,progress=clamp(clock/Math.max(readAt,.01),0,1);chase(defender,defender.startX+(fit+falseSide*.42)*progress,defender.startZ+.16*progress,slot>=0&&slot<3?1.65:1.25,dt);return}
  const separation=Math.hypot(defender.x-target.x,defender.z-target.z),speed=defenderPursuitSpeed(separation,mode==='pass')*defensiveCall.pursuit;pursue(defender,target,speed,dt,mode==='pass');
 }
 function engageBlock(blocker,defender,dt,runSide=0,index=0,isRun=false){
  if(!blocker||!defender||defender.fallen||defender.liveContact){if(blocker){blocker.engaged=false;blocker.engagedWith=null}if(defender){defender.engaged=false;defender.engagedWith=null}return}
  const clock=isRun?runClock():elapsed,distance=Math.hypot(defender.x-blocker.x,defender.z-blocker.z),secondLevel=defender.role==='LB',ratingEdge=(blocker.ratings.block-defender.ratings.blockShed)*.018,conceptBonus=isRun?RUNS[selected].blockLeverage:0;if(distance<2.05&&!blocker.blockResult){blocker.blockResult=blockOutcome(blocker.ratings.block,defender.ratings.blockShed,conceptBonus+(Math.abs(runSide)>.5?.04:0),rand());blocker.blockResolvedAt=clock;defender.blockResult=blocker.blockResult}
  const result=blocker.blockResult||'stalemate',resultTime=Math.max(0,clock-(blocker.blockResolvedAt<0?clock:blocker.blockResolvedAt)),shedScale=result==='shed'?.56:result==='pancake'?1.5:result==='steer'?1.18:1,shedAt=((secondLevel?2.75:2.05)+(index%3)*.24+ratingEdge+conceptBonus)*shedScale;
  if(result==='pancake'&&distance<1.82&&resultTime>.72){knockDownPlayer(defender,simTime,'pancake',.66,runSide||1);blocker.blockResult='finished';blocker.engaged=false;blocker.engagedWith=null;blocker.blockStyle='finish';return}
  if(distance<1.4&&resultTime<shedAt){
   blocker.engaged=defender.engaged=true;blocker.engagedWith=defender.index;defender.engagedWith=blocker.index;
   blocker.blockStyle=!['OL','TE'].includes(blocker.role)?'stalk':secondLevel?'climb':Math.abs(runSide)>.5&&[1,3].includes(blockingScheme(selected))?'reach':'drive';blocker.actionSide=runSide;defender.blockStyle='shed';
   const drive=(.21+(index%2)*.06)*ratingMultiplier(blocker.ratings.strength,.85,1.18)*(result==='steer'?1.28:result==='pancake'?1.42:result==='shed'?.62:1),edge=runSide*(index>=4?.24:.08)*(1+conceptBonus)*(result==='steer'?1.55:result==='shed'?.45:1),targetX=defender.x+edge,targetZ=defender.z-1.02;
   chase(blocker,targetX,targetZ,4.6*ratingMultiplier(blocker.ratings.acceleration,.9,1.08),dt);move(defender,defender.x+edge*dt,defender.z+drive*dt,dt,7);const contactHeading=Math.atan2(defender.x-blocker.x,defender.z-blocker.z);blocker.heading=contactHeading;defender.heading=contactHeading+Math.PI;
  }else{
   blocker.engaged=defender.engaged=false;blocker.engagedWith=defender.engagedWith=null;blocker.blockStyle=defender.blockStyle=null;
   if(isRun&&clock<Math.min(shedAt,secondLevel?2.05:1.2)){const targetHeading=Math.atan2(defender.x-blocker.x,defender.z-.82-blocker.z);chase(blocker,defender.x-runSide*.08,defender.z-.82,secondLevel?6.15:5.4,dt);blocker.heading=targetHeading;runFit(defender,dt)}else{const target=isRun&&phase==='handoff'?actors[6]:carrier;chase(blocker,defender.x,defender.z-.9,2.2,dt);pursue(defender,target,isRun?defenderPursuitSpeed(distance,false)*defensiveCall.pursuit:(index>=4?4.85:5.25),dt,phase==='run'&&mode==='pass')}
  }
 }
 function blockers(dt,isRun){
  if(isRun){
   const lane=RUNS[selected].path[2][0]*runDirection,side=lane<0?-1:1,assignments=[...identifyMikeAssignments(runBlockAssignments(selected),mikeIndex),...perimeterBlockAssignments(selected)],handled=new Set();
   if(currentPlay().option){const readEnd=runDirection>0?14:11,pair=assignments.find(a=>a[1]===readEnd),used=new Set(assignments.map(a=>a[1])),climb=[15,17,16].find(i=>!used.has(i));if(pair&&climb!==undefined)pair[1]=climb;runFit(actors[readEnd],dt)}
   if(formationForPlay(currentPlay()).fullback){const used=new Set(assignments.map(a=>a[1])),target=[16,15,17,19].find(i=>!used.has(i));const prior=assignments.findIndex(a=>a[0]===8);if(prior>=0)assignments.splice(prior,1);if(target!==undefined)assignments.push([8,target])}
   assignments.forEach(([blockerIndex,defenderIndex],i)=>{const blocker=actors[blockerIndex];let defender=actors[blocker.climbTarget??defenderIndex];if(defender.fallen){const next=actors.filter(d=>d.team===1&&!d.fallen&&!d.engaged&&!handled.has(d.index)&&d.z>blocker.z&&d.z<carrier.z+10).sort((a,b)=>Math.hypot(a.x-blocker.x,a.z-blocker.z)-Math.hypot(b.x-blocker.x,b.z-blocker.z))[0];if(next){defender=next;blocker.climbTarget=next.index;blocker.blockResult=null;blocker.blockResolvedAt=-1;}}handled.add(defender.index);engageBlock(blocker,defender,dt,side,i,true)});
   return handled;
  }
  const rushers=[11,12,13,14,...defensiveCall.blitzers].sort((a,b)=>actors[a].startX-actors[b].startX),desiredZ=snapZ-.4-Math.min(elapsed*.55,1.7);
  for(let i=0;i<5;i++){
   const p=actors[i];p.engaged=false;p.engagedWith=null;p.blockStyle='pass-set';
   if(rushers.length===4&&i===2){const threat=rushers.map(id=>actors[id]).filter(d=>!d.fallen&&!d.engaged&&Math.abs(d.x-carrier.x)<3).sort((a,b)=>Math.hypot(a.x-carrier.x,a.z-carrier.z)-Math.hypot(b.x-carrier.x,b.z-carrier.z))[0];chase(p,threat?clamp(threat.x,-3,3):p.startX,threat?Math.max(desiredZ,threat.z-.95):desiredZ,3.3,dt);p.heading=0;if(threat&&Math.hypot(p.x-threat.x,p.z-threat.z)<1.35){threat.passHelpUntil=simTime+.22;}}
  }
  rushers.forEach((defenderIndex,i)=>{
   const d=actors[defenderIndex],p=i<5?actors[rushers.length===4?[0,1,3,4][i]:i]:null,edge=Math.abs(d.startX)>3;
   d.engaged=false;d.engagedWith=null;d.blockStyle=null;
   if(d.fallen||d.liveContact){if(p)chase(p,p.startX,desiredZ,2.8,dt);return}
   if(!p){if(elapsed<.9){chase(d,d.startX,d.startZ,.8,dt);d.heading=Math.PI}else pursue(d,carrier,5.65*ratingMultiplier(d.ratings.speed,.92,1.1),dt);return}
   if(p.passHoldUntil==null){const edge=(p.ratings.block-d.ratings.blockShed)*.035;p.passHoldUntil=clamp(1.85+edge+rand()*1.65,1.25,4.2)}const release=p.passHoldUntil+((d.passHelpUntil||0)>simTime?.22:0);
   if(elapsed<release){
    const beat=elapsed*3.8+i*1.7,set=passSetPoint(p,d,carrier,snapZ,elapsed),setX=set.x+Math.sin(beat)*.10,setZ=set.z+Math.cos(beat*.8)*.06;chase(p,setX,setZ,2.8,dt);chase(d,p.x+Math.sin(beat)*.11,p.z+1.08,4.15,dt);p.heading=Math.atan2(d.x-p.x,d.z-p.z);d.heading=p.heading+Math.PI;
    if(Math.hypot(d.x-p.x,d.z-p.z)<1.3){d.engaged=p.engaged=true;d.engagedWith=p.index;p.engagedWith=d.index;p.blockStyle='pass-anchor';d.blockStyle=edge?((i+drive.plays)%2?'rush-rip':'rush-swim'):'bull-rush'}
   }else{
    // Work around the block before closing on the QB. A beaten blocker
    // keeps his recovery lane instead of joining the tackle pile.
    const side=Math.sign(d.startX)||((i%2)*2-1),cleared=d.z<p.z-.7;
    if(!p.passRecovered&&elapsed>release+.22&&!cleared&&d.z>p.z-.15&&Math.abs(d.x-p.x)<1.1&&Math.hypot(d.x-p.x,d.z-p.z)<1.45&&carrier.z<p.z-1.3){p.passRecovered=true;p.passHoldUntil=elapsed+.45*ratingMultiplier(p.ratings.awareness,.85,1.1);}
    if(!cleared&&Math.hypot(d.x-p.x,d.z-p.z)<2.4)chase(d,p.x+side*1.45,p.z-1.05,4.1,dt);else pursue(d,carrier,(5.2+i*.08)*ratingMultiplier(d.ratings.speed,.92,1.1),dt);
    const angle=Math.atan2(d.x-p.x,d.z-p.z),nearQB=Math.hypot(p.x-carrier.x,p.z-carrier.z)<2.4;
    chase(p,nearQB?carrier.x+side*2.6:p.startX,Math.max(desiredZ,carrier.z+2.2),nearQB?2.8:1.7,dt);p.heading=angle;
   }
  });
  return new Set(rushers);
 }
 function sustainSupportBlock(blocker,d,dt){blocker.engaged=d.engaged=true;blocker.engagedWith=d.index;d.engagedWith=blocker.index;blocker.blockStyle='stalk';d.blockStyle='shed';const side=Math.sign(d.x-carrier.x)||1,drive=.12*ratingMultiplier(blocker.ratings.strength,.86,1.12);blocker.actionSide=side;chase(blocker,d.x-side*.08,d.z-.98,5.1*ratingMultiplier(blocker.ratings.acceleration,.9,1.08),dt);move(d,d.x+side*.035*dt,d.z+drive*dt,dt,7);const heading=Math.atan2(d.x-blocker.x,d.z-blocker.z);blocker.heading=heading;d.heading=heading+Math.PI}
 function escortCarrier(p,dt){
  if(carrier.z<=snapZ+18){chase(p,p.x,Math.max(p.z,snapZ+Math.min(elapsed*5+4,18)),4.5,dt);return}
  const side=p.x<carrier.x?-1:1;chase(p,clamp(carrier.x+side*(3.2+p.index%2),-24,24),carrier.z-4-(p.index%3),playerRunSpeed(p)*.94,dt);
 }
 function supportBlockers(dt){
  const handled=new Set(),eligible=actors.filter(p=>p.team===0&&p!==carrier&&!p.fallen&&['RB','WR','TE'].includes(p.role));
  for(const blocker of eligible){
   const paired=Number.isInteger(blocker.engagedWith)?actors[blocker.engagedWith]:null;
   if(paired&&paired.engagedWith===blocker.index&&!paired.fallen&&!paired.liveContact&&Math.hypot(paired.x-blocker.x,paired.z-blocker.z)<2.35){handled.add(paired.index);sustainSupportBlock(blocker,paired,dt);continue}
   if(paired&&paired.engagedWith===blocker.index){paired.engaged=false;paired.engagedWith=null;paired.blockStyle=null}blocker.engaged=false;blocker.engagedWith=null;blocker.blockStyle=null;
   const candidates=actors.filter(d=>d.team===1&&!d.fallen&&!d.liveContact&&!d.engaged&&!handled.has(d.index)&&d.z>=Math.max(carrier.z-1.8,blocker.z+.95));
   const target=candidates.reduce((best,d)=>{const score=Math.hypot(d.x-blocker.x,d.z-blocker.z)+(d.z<carrier.z?3.5:0);return!best||score<best.score?{d,score}:best},null);
   if(!target||target.score>9.5){blocker.engaged=false;blocker.engagedWith=null;escortCarrier(blocker,dt);continue}
   const d=target.d,distance=Math.hypot(d.x-blocker.x,d.z-blocker.z);
   if(distance<1.4){handled.add(d.index);sustainSupportBlock(blocker,d,dt)}
   else{blocker.engaged=false;blocker.engagedWith=null;chase(blocker,d.x,d.z-.85,5.45*ratingMultiplier(blocker.ratings.acceleration,.9,1.08),dt)}
  }
  return handled;
 }
  function startThrow(payload){
   const qb=actors[5],duration=quarterbackThrowDuration(payload.kind);
   qb.throwStarted=simTime;qb.throwDuration=duration;qb.throwT=.001;qb.throwStyle=payload.throwAway?'away':payload.kind;qb.action=null;qb.ballTarget=null;
   pendingThrow={...payload,releaseAt:simTime+duration*QB_THROW_RELEASE};
   message('SETTING · '+(payload.throwAway?'THROW AWAY':payload.kind.toUpperCase()+' PASS'),.5);updateControls();
  }
  function throwTo(index,kind='bullet'){
   if(phase!=='pass'||pendingThrow||paused)return;
   const target=actors[index],routeIndex=receiverIndices.indexOf(index),profile=THROW_PROFILES[kind]||THROW_PROFILES.bullet,qb=actors[5];
   const nearest=Math.min(...actors.filter(p=>p.team===1&&!p.engaged).map(p=>Math.hypot(p.x-qb.x,p.z-qb.z)),8),pressure=pocketThreat(qb,actors.filter(p=>p.team===1),elapsed);
   const delay=quarterbackThrowDuration(kind)*QB_THROW_RELEASE,duration=profile.duration+Math.abs(target.z-qb.z)*profile.distanceScale;
   const to=routeIndex>=0?predictPassDestination(PASSES[selected].routes[routeIndex],target.startX,target.startZ,elapsed+delay,duration,routeRunSpeed(target)):[target.x,1.6,target.z];
   const movingPenalty=clamp(Math.hypot(qb.vx||0,qb.vz||0)/playerTopSpeed(qb),0,1)*.62,accuracy=ratingMultiplier(qb.ratings.throw,.74,1.03),error=(profile.error+pressure*1.18+movingPenalty)/accuracy;
   if(routeIndex>=0)to[0]=target.startX+(to[0]-target.startX)*runDirection;
   to[0]=clamp(to[0]+(rand()-.5)*2*error,-26.3,26.3);to[2]=clamp(to[2]+(rand()-.5)*1.25*error,10,110);
   replay.event('throw',{target:index,kind,pressure,leadX:0,leadZ:0});startThrow({to,target:index,duration,arc:profile.arc,kind,pressure});
  }
  function throwAway(){
   if(phase!=='pass'||pendingThrow||paused)return;const qb=actors[5];if(!canThrowAway(qb.x)){message('LEAVE THE POCKET TO THROW AWAY',.9);navigator.vibrate?.(12);return}
   const side=Math.sign(qb.x)||1,nearest=Math.min(...actors.filter(p=>p.team===1&&!p.engaged).map(p=>Math.hypot(p.x-qb.x,p.z-qb.z)),8),pressure=pocketThreat(qb,actors.filter(p=>p.team===1),elapsed);
   replay.event('throwaway',{side,pressure});startThrow({to:[side*28.5,1.45,Math.min(109,snapZ+8.5)],target:null,duration:.46,arc:2.35,kind:'throwaway',pressure,throwAway:true});
  }
  function scramble(source='button'){
   if(phase!=='pass'||pendingThrow||paused||!actors[5].hasBall)return false;
   const qb=actors[5];carrier=qb;phase='run';elapsed=0;stamina=1;qb.throwT=0;qb.throwStyle=null;qb.throwStarted=null;qb.action=null;qb.ballTarget=null;
   if(source==='line')assist=false;
   if(!assist&&Math.hypot(input.x,input.z)<.12&&!keys.has('ArrowUp')&&!keys.has('w')){snapDirection={x:0,z:1};snapDirectionUntil=simTime+.45}
   runCameraBlend=0;runCameraStart=null;jukeUntil=simTime+.18;replay.event('scramble',{source,speed:qb.ratings.speed});updateControls();message(assist?'QB SCRAMBLE · AUTO RUN':'QB SCRAMBLE · STEER, SPRINT OR SLIDE',1);return true;
  }
  function endPlay(reason,ballSpot,incomplete=false){if(phase==='dead'||ended)return;if(conversionDrive){finishTry(!incomplete&&ballSpot>=100);return;}const old=drive.ball;pendingThrow=null;captureHighlight();phase='dead';postPlayElapsed=0;flight=null;if(incomplete&&lastFlightEnd)looseBall={x:lastFlightEnd[0],y:lastFlightEnd[1],z:lastFlightEnd[2],side:deadBallFocus?.actionSide||1,born:simTime,life:1.18};lastFlightEnd=null;input.x=0;input.z=0;input.sprint=false;keys.clear();actors.forEach(releasePostPlay);updateControls();if(activeContact){messageUntil=0;$('message').classList.remove('show')}else message(reason,.9);if(carrier&&reason==='TACKLED')carrier.fallen=true;drive.ball=incomplete?old:clamp(Math.round(ballSpot),1,100);const gain=drive.ball-old;if(reason==='BIG HIT'||reason==='TOUCHDOWN'||gain>=15)lastHighlight=highlightFrames.slice();$('watchReplay').hidden=!lastHighlight.length;replay.event('play-end',{reason,gain,ball:drive.ball});replay.sample(true);if(['BIG HIT','TACKLED','GANG TACKLE','SACK'].includes(reason))stadiumSound('hit');let copy=reason;
  if(mini){miniWhistle(mini,drive,reason,gain,incomplete);if(fullGame){const entry=mini.log.at(-1);entry.side='home';entry.overtime=mini.overtime;fullRecord(mini,'home',{gain,pass:mode==='pass'&&(incomplete||carrier?.role!=='QB'),incomplete,sack:reason==='SACK',touchdown:ballSpot>=100,quarterback:miniConfig.matchup.home.lineup[5],runner:[...miniConfig.matchup.home.lineup,miniConfig.matchup.home.fullback].find(p=>p.id===carrier?.playerId)});}if(!incomplete&&ballSpot<=0){if(!fullGame)document.querySelector('.away strong').textContent='29';endDrive('SAFETY','');return}}
  if(drive.ball>=100){drive.score+=6;stadiumSound('touchdown');navigator.vibrate?.([24,35,34]);message('TOUCHDOWN · CROWD ERUPTS',3);endDrive('TOUCHDOWN','You finished the drive. Practice results stay separate from your career.');return}
  if(!incomplete){copy+=' · '+(gain>=0?'+':'')+gain+' YDS'}
  if(gain>=drive.toGo){drive.down=1;drive.toGo=Math.min(10,100-drive.ball);copy=(lineToGain(drive)===100?'FIRST & GOAL':'FIRST DOWN')+' · +'+gain+' YDS'}else{drive.down++;drive.toGo=Math.max(1,drive.toGo-gain)}
  if(activeContact)pendingPlayMessage=copy;else message(copy,1.4);updateHud();updateControls();if(drive.down>4){endDrive('TURNOVER ON DOWNS','The defense held. Restart this practice drive to try again.');return}if(drive.clock<=0&&!mini?.overtime){endDrive('TIME EXPIRED','The clock reached zero. Your career is unchanged.');return}recoveryLeft=fullGame?(activeContact?Math.max(0,activeContact.duration-activeContact.elapsed):0):(activeContact?Math.max(3.75,activeContact.duration+2.65):1.35);
 }
  function showDriveEnd(){if(!pendingDriveEnd)return;const{title,body}=pendingDriveEnd;pendingDriveEnd=null;paused=true;$('dialogTitle').textContent=mini&&title==='TOUCHDOWN'?'DRILL WON':title;$('dialogBody').textContent=body;if(mini)miniUI.result(mini,drive);$('resume').hidden=true;$('paused').hidden=false;updateHud();updateControls()}
  function endDrive(title,body){if(ended)return;if(conversionDrive){finishTry(title==='TOUCHDOWN');return;}if(fullGame){fullOffenseEnd(mini,drive,title,{interceptionSpot:title==='INTERCEPTED'?clamp(Math.round((carrier?.z||35)-10),0,100):drive.ball,quarterback:miniConfig.matchup.home.lineup[5]});showFullState();return}if(mini){if(['INTERCEPTED','TIME EXPIRED','TURNOVER ON DOWNS','SAFETY'].includes(title))mini.log.push({reason:title,gain:null,clock:drive.clock,ball:drive.ball});miniFinish(mini,drive,title);body=title==='TOUCHDOWN'?'You drove 75 yards and scored the winning touchdown.':title==='TIME EXPIRED'?'The clock ran out. Use the sidelines, spikes, and timeouts to save time.':title==='INTERCEPTED'?'The defense picked it off. Your drive ends here.':title==='SAFETY'?'The defense stopped you in your own end zone.':'The defense held on fourth down. Try another drive.';}pendingThrow=null;ended=true;phase='dead';actors.forEach(releasePostPlay);pendingDriveEnd={title,body,celebrating:false,showAt:simTime+Math.max(title==='TOUCHDOWN'?3.8:1.35,(activeContact?.duration||0)+2.75)};replay.event('drive-end',{title,ball:drive.ball,score:drive.score});replay.sample(true);updateHud();updateControls()}
  function pause(){if(ended||replaying)return;paused=!paused;liveUnit?.setPaused(paused);prePanel=null;setPlayArt(false);replay.event(paused?'pause':'resume');replay.sample(true);input.x=input.z=0;input.sprint=false;input.pointer=input.sprintPointer=null;keys.clear();$('knob').classList.remove('held');$('knob').style.transform='none';$('dialogTitle').textContent='PAUSED';$('dialogBody').textContent=fullGame?'Play offense, defense, and kick returns. You can simulate defense between plays. Ties go to equal-possession overtime.':mini?'Down four. Score a touchdown before time runs out. In-bounds plays keep the clock running.':'This preview never changes your career saves or season record.';$('resume').hidden=false;$('watchReplay').hidden=!lastHighlight.length||!['pre','dead'].includes(phase);$('paused').hidden=!paused;updateControls();if(mini)updateHud()}
 function tick(dt){if(liveUnit?.state){if(!paused){simTime+=dt;liveUnit.tick(dt);const u=liveUnit.state;if(u){carrier=actors[u.carrier];flight=u.flight;exchange=u.stagedBall?{kind:'snap',ball:u.stagedBall}:null;updateHud();if(!mini.overtime&&!mini.conversion)$('clock').textContent=miniClock(drive.clock-u.liveTime);}}return;}if(fullGame&&phase==='cpu'){simTime+=dt;if(!paused&&!ended&&!mini.pending&&!mini.conversion&&!mini.kickoff&&mini.auto){mini.wait-=dt;if(mini.wait<=0)advanceFull();}updateHud();return}if(mini&&!ended&&!paused&&!conversionDrive){const event=miniBetweenPlays(mini,drive,phase,dt);if(event==='TIME EXPIRED'){endDrive(event,'');return}if(event==='DELAY OF GAME'){setup();message('DELAY OF GAME · 5 YARDS OR HALF THE DISTANCE',1.8)}updateHud()}transitionFade=Math.max(0,transitionFade-dt*2.5);$('playTransition').style.opacity=transitionFade;if(phase==='dead'){simTime+=dt;postPlayElapsed+=dt;if(activeContact)advanceContactSequence(dt);else updateSkillAction();settlePlayers(dt);if(pendingDriveEnd?.title==='TOUCHDOWN'&&!pendingDriveEnd.celebrating&&!activeContact&&!carrier.fallen&&Math.hypot(carrier.vx,carrier.vz)<.15){setTimedAction(carrier,'celebrate',2.6,0);const friends=actors.filter(p=>p.team===carrier.team&&p!==carrier&&!p.fallen).sort((a,b)=>Math.hypot(a.x-carrier.x,a.z-carrier.z)-Math.hypot(b.x-carrier.x,b.z-carrier.z)).slice(0,3);friends.forEach((p,i)=>{p.disengage=null;p.recoveryWatch=null;p.wasBlocking=false;p.celebrateTarget={x:clamp(carrier.x+(i-1)*2.0,-24,24),z:carrier.z+1.8+(i%2)*1.4};p.action=null;});const arrival=friends.length?Math.hypot(friends[0].x-carrier.x,friends[0].z-carrier.z)/5.2:0;pendingDriveEnd.showAt=Math.max(pendingDriveEnd.showAt,simTime+clamp(arrival+2.4,4,7));pendingDriveEnd.celebrating=true;pendingDriveEnd.showAt=Math.max(pendingDriveEnd.showAt,simTime+3.1)}if(pendingDriveEnd&&simTime>=pendingDriveEnd.showAt&&!activeContact){showDriveEnd();return}if(!ended){recoveryLeft-=dt;if(recoveryLeft<.12){transitionFade=clamp(1-recoveryLeft/.12,0,.28);$('playTransition').style.opacity=transitionFade}if(recoveryLeft<=0){transitionFade=.28;setup();camera(1)}}return}if(phase==='pre'){if(receiverMotion&&!playbookOpen){simTime+=dt;advanceReceiverMotion(dt)}return}elapsed+=dt;simTime+=dt;updateSkillAction();for(const p of actors)if(p.reactionT>0){p.reactionT+=dt/.42;if(p.reactionT>=1)p.reactionT=0}if(!mini?.overtime&&!conversionDrive)drive.clock=Math.max(0,drive.clock-dt);updateHud();const throwingQB=actors[5];if(throwingQB.throwStarted!==null&&throwingQB.throwStarted!==undefined){throwingQB.throwT=clamp((simTime-throwingQB.throwStarted)/throwingQB.throwDuration,.001,1);if(throwingQB.throwT>=1&&!pendingThrow){throwingQB.throwT=0;throwingQB.throwStyle=null;throwingQB.throwStarted=null}}
  if(phase==='snap'){
   const qb=actors[formationForPlay(currentPlay()).snapReceiver||5],center=actors[2],t=clamp(elapsed/(currentPlay().fake?.48:.28),0,1),target=[qb.x,currentPlay().fake?.65:1.38,qb.z+.25];
   qb.action='receive-snap';qb.actionT=t;qb.ballTarget=target;center.action='snap';center.actionT=t;
   exchange.ball=exchange.from.map((v,i)=>v+(target[i]-v)*t);exchange.ball[1]+=Math.sin(t*Math.PI)*.12;blockers(dt,mode==='run');resolvePlayerOverlaps();
   if(t>=1){center.action=null;center.ballTarget=null;qb.hasBall=true;qb.action=null;qb.ballTarget=null;carrier=qb;const direct=currentPlay().direct;phase=direct?'run':mode==='run'?'handoff':'pass';elapsed=mode==='run'?0:.28;exchange=mode==='run'&&!direct?{kind:currentPlay().pitch?'pitch':'handoff',ball:target,qbStart:[qb.x,qb.z],rbStart:[actors[6].x,actors[6].z]}:null;updateControls()}
   return;
  }
  if(phase==='handoff'){
   const qb=actors[5],rb=actors[6],concept=RUNS[selected],duration=concept.handoff+.55,t=clamp(elapsed/duration,0,1),meshX=concept.mesh[0]*runDirection,meshZ=snapZ+concept.mesh[1],pitch=Boolean(concept.pitch),keep=concept.option&&optionChoice==='keep',side=Math.sign(meshX-qb.startX)||runDirection;
   if(concept.option&&t>.7){$('option-give').disabled=true;$('option-keep').disabled=true}
   const arrive=smooth(t/.84),qbHeading=qb.heading,qbX=pitch?side*.8:meshX-side*.76,qbZ=pitch?snapZ-4.65:meshZ-.12;
   move(qb,exchange.qbStart[0]+(qbX-exchange.qbStart[0])*smooth(t/.72),exchange.qbStart[1]+(qbZ-exchange.qbStart[1])*smooth(t/.72),dt,10);
   move(rb,exchange.rbStart[0]+(meshX-exchange.rbStart[0])*arrive,exchange.rbStart[1]+(meshZ-exchange.rbStart[1])*arrive,dt,10);
   const guide=runConceptDirection(selected,0,keep?qb.x:rb.x,keep?qb.z:rb.z,snapZ,runDirection,keep),control=openingRunControl(assist,input.x,input.z,snapDirection.x,snapDirection.z,guide.x,guide.z,true),world=control.manual?cameraWorldVector(control.x,control.z,camEye,camTarget):[control.x,control.z];
   const facing=Math.atan2(rb.x-qb.x,rb.z-qb.z);qb.heading=qbHeading+Math.atan2(Math.sin(facing-qbHeading),Math.cos(facing-qbHeading))*(1-Math.exp(-9*dt));rb.heading=Math.atan2(meshX-exchange.rbStart[0],meshZ-exchange.rbStart[1]);
   const carrySide=(rb.index+rb.team)%2?-1:1,carryPoint=[rb.x+Math.cos(rb.heading)*carrySide*.22+Math.sin(rb.heading)*.22,1.30,rb.z-Math.sin(rb.heading)*carrySide*.22+Math.cos(rb.heading)*.22],meshPoint=[rb.x-Math.sin(qb.heading)*.16,1.30,rb.z-Math.cos(qb.heading)*.16],catchPoint=meshPoint.map((v,i)=>v+(carryPoint[i]-v)*smooth((t-.88)/.12)),grip=[qb.x+Math.sin(qb.heading)*.36,1.38,qb.z+Math.cos(qb.heading)*.36],reach=smooth((t-.45)/.40);
   if(pitch){
    // Freeze the release point once. Ownership is empty throughout the airborne pitch.
    if(t>=.46&&!exchange.release)exchange.release=[...grip];
    const flightT=clamp((t-.46)/.42,0,1);
    exchange.ball=exchange.release?exchange.release.map((v,i)=>v+(catchPoint[i]-v)*flightT):grip;
    exchange.ball[1]+=Math.sin(flightT*Math.PI)*.72;
    qb.hasBall=t<.46;rb.hasBall=t>=.88;
   }else{exchange.ball=grip.map((v,i)=>v+(catchPoint[i]-v)*reach*(keep?1-smooth((t-.7)/.3):1));qb.hasBall=keep||t<.88;rb.hasBall=!keep&&t>=.88}
   qb.action='handoff';qb.actionT=t;qb.ballTarget=pitch?grip:t>.88?grip:exchange.ball;
   rb.action='receive-handoff';rb.actionT=t;
   // Show a receiving pocket, never arms reaching several yards after the ball.
   rb.ballTarget=t>.40?(t>.76?exchange.ball:catchPoint):null;
   if(rb.hasBall)carrier=rb;
   blockers(dt,true);resolvePlayerOverlaps();
   if(t>=1){qb.hasBall=Boolean(keep);qb.ballTarget=null;qb.action=null;qb.actionT=0;qb.vx=qb.vz=0;rb.hasBall=!keep;rb.ballTarget=null;rb.action=null;rb.actionT=0;carrier=keep?qb:rb;const speed=control.manual?4.8:assist?4.6:0;carrier.vx=world[0]*speed;carrier.vz=world[1]*speed;snapDirectionUntil=simTime+.75;phase='run';exchange=null;elapsed=0;updateControls()}
   return;
  }
  if(phase==='pass'||phase==='flight'){coverage(dt);blockers(dt,false);const qb=actors[5];
   resolvePlayerOverlaps();
   if(phase==='pass'){
    if(pendingThrow){const aim=Math.atan2(pendingThrow.to[0]-qb.x,pendingThrow.to[2]-qb.z),heading=qb.heading;accelerate(qb,0,0,0,dt,14,30);qb.heading=heading+Math.atan2(Math.sin(aim-heading),Math.cos(aim-heading))*Math.min(1,dt*20)}else{
    let x=input.x,z=input.z;const kx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),kz=(keys.has('ArrowUp')||keys.has('w')?1:0)-(keys.has('ArrowDown')||keys.has('s')?1:0);if(kx||kz){const len=Math.hypot(kx,kz);x=kx/len;z=kz/len}if(x||z){[x,z]=cameraWorldVector(x,z,camEye,camTarget);const speed=qbMovementSpeed(qb.x,z,qb);accelerate(qb,x,z,speed,dt,14,22);}else if(qb.startZ>snapZ-4&&qb.z>snapZ-5&&elapsed<1.45)accelerate(qb,0,-1,3.6,dt,14,25);else accelerate(qb,0,0,qbMovementSpeed(qb.x,0,qb),dt,14,25);const pocketFace=qb.heading;qb.heading=pocketFace+Math.atan2(Math.sin(-pocketFace),Math.cos(-pocketFace))*Math.min(1,dt*(Math.abs(qb.x)<5?14:5));
    }
    // End at real field boundaries; the pocket is not a movement cage.
    if(Math.abs(qb.x)>=QB_LATERAL_LIMIT||qb.z<=0){endPlay(qb.z<=0?'SAFETY':'OUT OF BOUNDS',Math.round(qb.z-10));return}
    if(!pendingThrow&&hasCrossedScrimmage(qb.z,snapZ)){scramble('line');return}
    const rushers=actors.filter(p=>p.team===1&&!p.engaged&&!p.fallen&&(p.role==='DL'||defensiveCall.blitzers.includes(p.index))),nearest=Math.min(...rushers.map(p=>Math.hypot(p.x-qb.x,p.z-qb.z)),8),pressure=pocketThreat(qb,actors.filter(p=>p.team===1),elapsed),throwAwayReady=canThrowAway(qb.x);$('stamina').firstElementChild.style.width=(pressure*100)+'%';$('throwAway').classList.toggle('ready',throwAwayReady);$('throwAway').dataset.ready=String(throwAwayReady);$('throwAway').setAttribute('aria-label',throwAwayReady?'Throw the ball away':'Throwaway unavailable. Leave the pocket first.');$('instruction').textContent=(pendingThrow?'SETTING TO THROW · PRESSURE ':'SCRAMBLE TO RUN · PRESSURE ')+Math.round(pressure*100)+'%';if(nearest<.92){const tackler=rushers.reduce((a,b)=>Math.hypot(a.x-qb.x,a.z-qb.z)<Math.hypot(b.x-qb.x,b.z-qb.z)?a:b),spot=drive.ball-sackLoss(snapZ,qb.z);lastTackler=tackler.index;beginContactSequence(tackler,{type:'wrap'},[],Math.hypot(qb.vx,qb.vz));endPlay('SACK',spot);return}
    if(pendingThrow&&simTime+1e-9>=pendingThrow.releaseAt){
     const payload=pendingThrow;pendingThrow=null;flight={...payload,from:[...liveBallAnchor(qb,'pass')],t:0};qb.hasBall=false;qb.vx=qb.vz=0;qb.moving=false;
     flightCameraStart={eye:[...camEye],target:[...camTarget]};phase='flight';replay.event('release',{kind:flight.kind});message(flight.throwAway?'THROWING IT AWAY':flight.kind.toUpperCase()+' PASS · PICK A CATCH',.65);updateControls();return;
    }
   }
   if(flight){flight.t+=dt/flight.duration;$('catchChoices').hidden=Boolean(flight.throwAway);if(flight.t>=1){lastFlightEnd=[...flight.to];if(flight.throwAway){flight=null;qb.throwT=0;qb.throwStyle=null;endPlay('THROWN AWAY',drive.ball,true);return}const landingX=flight.to[0],p=actors[flight.target],defenders=actors.filter(a=>a.team===1),closest=defenders.reduce((a,b)=>Math.hypot(a.x-flight.to[0],a.z-flight.to[2])<Math.hypot(b.x-flight.to[0],b.z-flight.to[2])?a:b),defenderBallDistance=Math.hypot(closest.x-flight.to[0],closest.z-flight.to[2]),receiverGap=Math.hypot(p.x-flight.to[0],p.z-flight.to[2]),distance=Math.min(...defenders.map(a=>Math.hypot(a.x-p.x,a.z-p.z))),leverage=clamp((receiverGap-defenderBallDistance+1)/2,0,1),style=catchStyle,chances=passOutcomeChances(distance,flight.pressure,flight.kind,receiverGap,leverage,{catchStyle:style,catchRating:p.ratings.catch,coverageRating:closest.ratings.coverage,throwRating:qb.ratings.throw}),roll=rand();flight=null;if(defenderBallDistance<1.85&&roll<chances.interception){closest.possessionFrom=[...lastFlightEnd];closest.ballTarget=[...lastFlightEnd];lastFlightEnd=null;actors.forEach(a=>a.hasBall=false);closest.hasBall=true;carrier=closest;setTimedAction(closest,'interception',.90,Math.sign(p.x-closest.x)||1);p.reactionT=.001;p.reactionSide=Math.sign(closest.x-p.x)||1;message('INTERCEPTED',1.2);endDrive('INTERCEPTED','The defender undercut the throw. Mix trajectory, timing and pocket movement on the next drive.');return}if(receiverGap>2.2||roll<chances.interception+chances.inaccurate){deadBallFocus=p;setTimedAction(p,'catch-miss',.78,Math.sign(landingX-p.x)||1);endPlay('INACCURATE PASS',drive.ball,true);return}if(roll<chances.interception+chances.inaccurate+chances.breakup){const miss=distance>=2?'DROPPED PASS':distance<.7?'TIGHT WINDOW · PASS BROKEN UP':'PASS BROKEN UP';deadBallFocus=p;if(distance<2){setTimedAction(closest,'breakup',.78,Math.sign(p.x-closest.x)||1);closest.breakupTarget=[...lastFlightEnd]}setTimedAction(p,'catch-miss',.86,Math.sign(closest.x-p.x)||1);endPlay(miss,drive.ball,true);return}lastFlightEnd=null;p.receiving=false;p.ballTarget=null;p.lookTarget=null;p.hasBall=true;p.catchT=.45;p.catchStyle=style;runCameraStart=null;runCameraBlend=0;p.action='catch-'+style;p.actionStarted=simTime;p.actionUntil=simTime+.58;p.actionT=0;carrier=p;phase='run';elapsed=0;jukeUntil=simTime+(style==='secure'?.36:.30);updateControls();message((distance<2?'CONTESTED ':'')+CATCH_STYLES[style].label+' CATCH',1)}}
   return;
  }
  if(phase==='run'){
   let x=input.x,z=input.z;const kx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),kz=(keys.has('ArrowUp')||keys.has('w')?1:0)-(keys.has('ArrowDown')||keys.has('s')?1:0);if(kx||kz){const len=Math.hypot(kx,kz);x=kx/len;z=kz/len}
   const liveMagnitude=Math.hypot(x,z);if(liveMagnitude>=.12)snapDirectionUntil=0;const concept=mode==='run'?RUNS[selected]:null,guide=concept?runConceptDirection(selected,elapsed,carrier.x,carrier.z,snapZ,runDirection,carrier===actors[5]&&optionChoice==='keep'):null,control=mode==='pass'&&carrier.catchStyle==='rac'?racControlVector(x,z):openingRunControl(assist,x,z,snapDirection.x,snapDirection.z,guide?.x,guide?.z,simTime<snapDirectionUntil);x=control.x;z=control.z;if(control.manual)[x,z]=cameraWorldVector(x,z,camEye,camTarget);
   const sprintHeld=input.sprint||keys.has('Shift'),boosting=sprintHeld&&stamina>0;carrier.sprinting=boosting||carrier.role==='QB';const cut=cutSeverity(carrier.vx,carrier.vz,x,z);if(cut>.38&&simTime>=plantReady&&carrier.catchT<=0){plantReady=simTime+.42;const turnSide=Math.sign(carrier.vz*x-carrier.vx*z)||1;setTimedAction(carrier,'cut',.34,turnSide);stamina=clamp(stamina-(boosting?.06:.025),0,1);if(cut>.68)message(boosting?'SPRINT CUT · SPEED LOST':'PLANT & CUT',.48)}const styleSpeed=mode==='pass'&&carrier.role!=='QB'&&elapsed<1?(CATCH_STYLES[carrier.catchStyle||'rac']?.yac||1):1,cutPenalty=cut>.38?clamp(1-cut*(boosting?.34:.2),.58,1):1,contactSpeed=carrier.action==='break-tackle'&&carrier.actionT<.8?.68:carrier.action==='stumble'?.56:1,baseSpeed=carrierRunSpeed(carrier,boosting)*(carrier.role==='RB'?Math.min(1,styleSpeed):styleSpeed)*cutPenalty*contactSpeed,acceleration=(boosting?19:24)*ratingMultiplier(carrier.ratings.acceleration,.88,1.14)*ratingMultiplier(carrier.ratings.agility,.92,1.08)*(concept?.acceleration||1);stamina=clamp(stamina+(boosting?-.24:sprintHeld?0:.09)*dt,0,1);$('stamina').firstElementChild.style.width=(stamina*100)+'%';accelerate(carrier,x,z,baseSpeed,dt,acceleration,26);emitRunFx();carrier.catchT=Math.max(0,carrier.catchT-dt);
   if(mode==='run'&&carrier===actors[5]&&currentPlay().option)chase(actors[6],actors[6].x-runDirection*.8,snapZ+3,5,dt);
   if(mode==='run'&&carrier!==actors[5]){const qb=actors[5];accelerate(qb,0,0,0,dt,12,18)}
   const assigned=blockers(dt,mode==='run')||new Set();if(mode==='pass')for(const index of supportBlockers(dt))assigned.add(index);for(const p of actors.filter(p=>p.team===1&&p.role!=='DL'&&!p.engaged&&!p.fallen&&!assigned.has(p.index))){if(mode==='run')runFit(p,dt);else{const separation=Math.hypot(p.x-carrier.x,p.z-carrier.z);pursue(p,carrier,defenderPursuitSpeed(separation,true),dt,true)}}
   if(mode==='run'){const activeBlockers=new Set([...runBlockAssignments(selected),...perimeterBlockAssignments(selected)].map(([index])=>index));for(const p of actors.filter(p=>p.team===0&&(p.role==='WR'||p.role==='TE')&&p!==carrier&&!p.engaged&&!activeBlockers.has(p.index)))escortCarrier(p,dt)}
   for(const d of actors)if(d.liveContact)advanceGlancingContact(d,actors[d.liveContact.runner],simTime,dt);
   resolvePlayerOverlaps();
   if(carrier.z>=110){endPlay('TOUCHDOWN',100);return}if(Math.abs(carrier.x)>=26){endPlay('OUT OF BOUNDS',carrier.z-10);return}
   if(simTime>jukeUntil){
    const radius=tackleRadius(elapsed,mode==='pass'),contacts=radius?actors.filter(p=>p.team===1&&!p.engaged&&!p.fallen&&simTime>=p.contactReady&&tackleContactEligible(p,carrier,radius)):[];
    if(contacts.length){
     const d=contacts.reduce((best,p)=>Math.hypot(p.x-carrier.x,p.z-carrier.z)<Math.hypot(best.x-carrier.x,best.z-carrier.z)?p:best),speed=Math.hypot(carrier.vx,carrier.vz),defenderSpeed=Math.hypot(d.vx||0,d.vz||0),toDefenderX=d.x-carrier.x,toDefenderZ=d.z-carrier.z,toDefenderLength=Math.hypot(toDefenderX,toDefenderZ)||1,angle=clamp((carrier.vx*toDefenderX+carrier.vz*toDefenderZ)/(Math.max(speed,.1)*toDefenderLength)*.5+.5,0,1),helpers=actors.filter(p=>p.team===1&&p!==d&&!p.fallen&&!p.engaged&&!p.liveContact&&simTime>=p.contactReady&&Math.hypot(p.x-carrier.x,p.z-carrier.z)<1.25),outcome=contactOutcome(carrier.ratings,d.ratings,{momentum:clamp(speed/9.5,0,1),defenderMomentum:clamp(defenderSpeed/8.4,0,1),distance:toDefenderLength,angle,gang:helpers.length,skill:simTime-lastSkillAt<.8?lastSkill:null,roll:rand()});
     lastTackler=d.index;d.contactReady=simTime+.72;
     if(outcome.type==='miss'||outcome.type==='broken'||outcome.type==='stumble'){
      beginGlancingContact(carrier,d,simTime,outcome.type);impactShake=outcome.type==='stumble'?.62:.48;message(outcome.type==='broken'?'BROKEN TACKLE':outcome.type==='stumble'?'STUMBLE · STAY UP':'TACKLER MISSED',.72);navigator.vibrate?.(outcome.type==='stumble'?22:16);
     }else{
      const spot=forwardProgressSpot(carrier.z,carrier.vz);beginContactSequence(d,outcome,helpers,speed);navigator.vibrate?.(outcome.type==='big-hit'?45:28);endPlay(carrier.role==='QB'&&carrier.z<snapZ?'SACK':outcome.type==='big-hit'?'BIG HIT':outcome.type==='gang'?'GANG TACKLE':'TACKLED',spot);return;
     }
    }
   }
   // A live carry continues beyond the first-down line and through clock zero.
   // Only a tackle, sideline, slide or score ends it; endPlay settles the drive.
  }
 }
 function referenceCamera(dt){r.fov=50;const isPocket=phase==='pre'||phase==='snap'||phase==='pass'||phase==='handoff',isDead=phase==='dead';let x=0,z=snapZ+2,mult=1;
  if(!isPocket&&!isDead){x=carrier.x*.55;z=carrier.z+5;if(flight){const t=clamp(flight.t,0,1);x=(flight.from[0]+(flight.to[0]-flight.from[0])*t)*.55;z=flight.from[2]+(flight.to[2]-flight.from[2])*t+4}}
  if(phase==='pass'){x=actors[5].x*.75;const deep=Math.max(...receiverIndices.map(i=>actors[i].z));z=(deep+actors[5].z)*.5;mult=clamp(1+(deep-actors[5].z-16)*.018,1,1.7)}
  // Let the camera settle around the finish instead of freezing at the whistle.
  if(isDead){const focus=carrier||actors[5],settle=clamp(postPlayElapsed/.75,0,1),desiredEye=[focus.x*.76+1.2,4.85+settle*.3,focus.z-6.95-settle*.75],desiredTarget=[focus.x*.82,.92,focus.z+2.35+settle*.35],blend=cameraFollowBlend(dt,2.7);camEye=camEye.map((v,i)=>v+(desiredEye[i]-v)*blend);camTarget=camTarget.map((v,i)=>v+(desiredTarget[i]-v)*blend);const strength=impactShake*.12;impactShake=Math.max(0,impactShake-dt*3.8);fieldCamera([camEye[0]+Math.sin(simTime*91)*strength,camEye[1]+Math.cos(simTime*73)*strength*.45,camEye[2]],camTarget);return}
  const tracking=phase==='run';
  // Center the pocket and move closer without enlarging athlete geometry.
  // Keep the existing wide/long-flight presentation and receiver-fit guard.
  const desiredEye=tracking?[carrier.x*.97+.9,4.55,carrier.z-6.15]:[x+(isPocket?0:3.5*mult),(isPocket?5.55:8.0)*mult,(isPocket?snapZ:z)-(isPocket?18:24.5)*mult];
  const desiredTarget=tracking?[carrier.x*.97,.94,carrier.z+4.2]:[x,1.42,z];
  // Fit actual projected heads/feet above the pre-snap controls. Do not pan the QB away.
  if(isPocket){for(let trial=0;trial<8;trial++){fieldCamera(desiredEye,desiredTarget);const watch=phase==='pre'?actors.filter(p=>!p.team):[actors[5],...receiverIndices.map(i=>actors[i])];const fits=watch.every(p=>{const h=r.project([p.x,2.1,p.z]),f=r.project([p.x,0,p.z]);return h.y>65&&f.y<r.height-(phase==='pre'?85:22)&&h.x>24&&h.x<r.width-24});if(fits)break;desiredEye[1]*=1.055;desiredEye[2]=desiredTarget[2]+(desiredEye[2]-desiredTarget[2])*1.055}}
  if(tracking){for(let trial=0;trial<6;trial++){fieldCamera(desiredEye,desiredTarget);if(r.project([carrier.x,0,carrier.z]).y<r.height-90)break;desiredEye[1]*=1.045;desiredEye[2]=desiredTarget[2]+(desiredEye[2]-desiredTarget[2])*1.045}}
  const blend=cameraFollowBlend(dt,phase==='pre'?10:phase==='handoff'?4.2:3.8);camEye=camEye.map((v,i)=>v+(desiredEye[i]-v)*blend);camTarget=camTarget.map((v,i)=>v+(desiredTarget[i]-v)*blend);const strength=impactShake*.12;impactShake=Math.max(0,impactShake-dt*3.8);fieldCamera([camEye[0]+Math.sin(simTime*91)*strength,camEye[1]+Math.cos(simTime*73)*strength*.45,camEye[2]],camTarget);
 }
 function camera(dt){if(liveUnit?.state){const view=liveUnit.view();r.fov=view.fov||55;const reverse=(camTarget[2]-camEye[2])*(view.target[2]-view.eye[2])<0;const shot=reverse?{eye:[...view.eye],target:[...view.target]}:cameraRigTravel(camEye,camTarget,view.eye,view.target,dt,4,25);camEye=shot.eye;camTarget=shot.target;fieldCamera(camEye,camTarget);return;}if(fullGame){referenceCamera(dt);return;}const lens=r.width/r.height>1.5?(['snap','pass'].includes(phase)?58:50):46;r.fov=Number.isFinite(r.fov)?r.fov+(lens-r.fov)*cameraFollowBlend(dt,5):lens;const isPocket=phase==='pre'||phase==='snap'||phase==='pass'||phase==='handoff'||phase==='flight',isDead=phase==='dead';let x=0,z=snapZ+2,mult=1;
  if(!isPocket&&!isDead){x=carrier.x*.55;z=carrier.z+5;if(flight){const t=clamp(flight.t,0,1);x=(flight.from[0]+(flight.to[0]-flight.from[0])*t)*.55;z=flight.from[2]+(flight.to[2]-flight.from[2])*t+4}}
  if(phase==='pass'||phase==='flight'){x=actors[5].x*.82;const deep=Math.max(...receiverIndices.map(i=>actors[i].z));z=actors[5].z+clamp((deep-actors[5].z)*.42,6,14);mult=clamp(1+(deep-actors[5].z-20)*.01,1,1.35)}
  // A catch may be tackled before the live camera arrives. Continue into a
  // centered contact shot instead of freezing the unfinished flight view.
  if(isDead&&typeof pendingDriveEnd!=='undefined'&&pendingDriveEnd?.title==='TOUCHDOWN'&&!activeContact){
   const f=carrier,offset=pendingDriveEnd.cameraOffset||(pendingDriveEnd.cameraOffset=touchdownCameraFraming(f,actors).offset),eye=[f.x+offset[0],offset[1],f.z+offset[2]],target=[f.x,1.0,f.z];
   const shot=touchdownCameraTravel(camEye,camTarget,eye,target,dt);camEye=shot.eye;camTarget=shot.target;fieldCamera(camEye,camTarget);return;
  }
  if(isDead&&pendingDriveEnd?.title==='INTERCEPTED'){const focus=carrier,shot=cameraRigTravel(camEye,camTarget,[focus.x+.35,3.5,focus.z-7.8],[focus.x,1.1,focus.z],dt,2.6,12);camEye=shot.eye;camTarget=shot.target;fieldCamera(camEye,camTarget);return}
  if(isDead){
   const focus=deadBallFocus||carrier||actors[5];
   if(!deadCameraStart)deadCameraStart={...contactCameraFraming(focus,actors),eye:[...camEye],target:[...camTarget]};
   const offset=deadCameraStart.offset,desiredEye=[focus.x+offset[0],offset[1],focus.z+offset[2]],desiredTarget=[focus.x,.8,focus.z];
   // Aim reaches the play before the dolly arrives. Both paths stay bounded;
   // coupling their speed here kept sideline tackles at the edge of the shot.
   const blend=smooth(postPlayElapsed/1.05),eye=desiredEye.map((v,i)=>deadCameraStart.eye[i]+(v-deadCameraStart.eye[i])*blend),target=desiredTarget.map((v,i)=>deadCameraStart.target[i]+(v-deadCameraStart.target[i])*blend),shot=cameraRigTravel(camEye,camTarget,eye,target,dt,4,14);camEye=shot.eye;camTarget=shot.target;
   impactShake=Math.max(0,impactShake-dt*3.8);fieldCamera(camEye,camTarget);return;
  }
  const tracking=phase==='handoff'||phase==='run',focus=phase==='handoff'?actors[6]:carrier;runCameraBlend=clamp(runCameraBlend+(tracking?dt/1.05:-dt/1.05),0,1);
  if(tracking&&!runCameraStart)runCameraStart={eye:[...camEye],target:[...camTarget],x:focus.x,z:focus.z};
  // Center the pocket and move closer without enlarging athlete geometry.
  // Fit the formation horizontally; tilt around the athlete before adding distance.
  const runFrame=tracking?runCameraFraming(focus.x,focus.z,focus.motion?.vx??focus.vx??0,focus.motion?.vz??focus.vz??0):null;
  let desiredEye=tracking?runFrame.eye:[x+(isPocket?0:3.5*mult),(isPocket?4.3:8.0)*mult,(isPocket?snapZ:z)-(isPocket?14.3:24.5)*mult];
  let desiredTarget=tracking?runFrame.target:[x,1.65,phase==='pre'?snapZ-1.5:z];
  if(tracking){const t=smooth(runCameraBlend),offset=[(focus.x-runCameraStart.x)*.96,0,focus.z-runCameraStart.z];desiredEye=desiredEye.map((v,i)=>(runCameraStart.eye[i]+offset[i])*(1-t)+v*t);desiredTarget=desiredTarget.map((v,i)=>(runCameraStart.target[i]+offset[i])*(1-t)+v*t)}
  // Start following the intended receiver while the football is in the air.
  // Catching continues from the actual camera position, never a new fixed view.
  if(phase==='flight'&&flight){const start=flightCameraStart||{eye:camEye,target:camTarget},t=smooth(clamp(flight.t*1.18,0,1)),to=flight.to;desiredEye=[to[0]+.45,5.25,to[2]-7.2].map((v,i)=>start.eye[i]+(v-start.eye[i])*t);desiredTarget=[to[0],.9,to[2]+2.2].map((v,i)=>start.target[i]+(v-start.target[i])*t)}
  // Fit actual projected heads/feet above the pre-snap controls. Do not pan the QB away.
  const pocketBottom=phase==='pre'?(playbookOpen?r.height-100:Math.min(r.height-100,$('pre').getBoundingClientRect().top-10)):r.height-100;
  if(isPocket&&!tracking&&phase!=='flight'){
   for(let trial=0;trial<(phase==='pre'?30:18);trial++){
    fieldCamera(desiredEye,desiredTarget);const watch=phase==='pre'?actors.filter(p=>!p.team):[actors[5]],bounds=watch.map(p=>({head:r.project([p.x,2.1,p.z]),foot:r.project([p.x,0,p.z])}));
    const top=Math.min(...bounds.map(p=>p.head.y)),bottom=Math.max(...bounds.map(p=>p.foot.y)),widthFits=bounds.every(p=>p.head.x>24&&p.head.x<r.width-24);
    if(top>65&&bottom<pocketBottom&&widthFits)break;
    // Fit the compact adjustment row and snap button, tilting slightly
    // before shrinking an otherwise well-sized team.
    if(widthFits&&bottom>=pocketBottom&&top>80){desiredTarget[1]-=.25;continue}
    desiredEye[2]=desiredTarget[2]+(desiredEye[2]-desiredTarget[2])*1.035;
   }
  }
  if(tracking){
   // Centered runners can use the space BETWEEN the controls. Solve pitch,
   // not distance: zooming out here made every live carry look miniature.
   const footLimit=Math.min(r.height*.76,r.height-64);
   for(let trial=0;trial<32;trial++){fieldCamera(desiredEye,desiredTarget);if(r.project([focus.x,0,focus.z]).y<footLimit)break;desiredTarget[1]-=.12;}
  }
  const rate=phase==='flight'?5.5:phase==='pre'||phase==='handoff'?3.5:tracking?5.2:3.2;const rig=cameraRigTravel(camEye,camTarget,desiredEye,desiredTarget,dt,phase==='flight'?16:rate,phase==='pre'?80:phase==='flight'?42:24);camEye=cameraReset?[...desiredEye]:rig.eye;camTarget=cameraReset?[...desiredTarget]:rig.target;cameraReset=false;
  if(phase==='pass'||phase==='run'||phase==='handoff'){
   const player=phase==='pass'?actors[5]:focus,rects=['stick','moves'].map(id=>$(id).getBoundingClientRect()).filter(b=>b.width>0&&b.width<r.width*.6);
   for(let trial=0;trial<12;trial++){fieldCamera(camEye,camTarget);const head=r.project([player.x,2.1,player.z]),foot=r.project([player.x,0,player.z]);const blocked=rects.some(b=>foot.x+22>b.left&&foot.x-22<b.right&&foot.y>b.top-16&&head.y<b.bottom);if(!blocked)break;camTarget[1]-=.10;}
  }
  const strength=impactShake*.12;impactShake=Math.max(0,impactShake-dt*3.8);fieldCamera([camEye[0]+Math.sin(simTime*91)*strength,camEye[1]+Math.cos(simTime*73)*strength*.45,camEye[2]],camTarget);
 }
 function scene(dt,now){r.sceneTime=now/1000;r.begin();stadium.draw();
  // Keep both snap markers fixed through contact; reset together for the next down.
  if(!liveUnit?.state||liveUnit.state.kind==='defense'){
  r.add('plane',pose(0,.025,snapZ,53.15,1,.11),hex('#4599ba'),'',true);
  r.add('plane',pose(0,.03,snapGainZ,53.15,1,.13),hex('#e1c156'),'',true);
  // Chain crew anchors the broadcast view to the live down and distance.
  for(const [z,color,label]of[[snapZ,'#ef7e38',false],[snapGainZ,'#f4cc57',true]]){r.add('cylinder',segment([-27.25,.08,z],[-27.25,2.05,z],.055),hex(color),'',true);r.add('cube',pose(-27.25,label?2.02:1.62,z,label?.42:.58,label?.42:.34,.12),hex(color),'',true)}
  }
  for(const p of actors){r.add('plane',pose(p.x,.038,p.z,.92,1,.66),[0,0,0,meshy.ready?.18:.75],'shadow',true)}
  turfFx=turfFx.filter(f=>simTime-f.born<f.life);for(const fx of turfFx){const age=simTime-fx.born,t=clamp(age/fx.life,0,1),size=fx.size*(1+t*.8);r.add('plane',pose(fx.x+fx.driftX*age,.043,fx.z+fx.driftZ*age,size,1,size*.64),[.61,.50,.28,(1-t)*.55],'turf-fx',true)}
  if(contactFx){const age=simTime-contactFx.born,t=age/.34;if(t<1){const size=(.55+t*2.6)*contactFx.power;r.add('plane',pose(contactFx.x,.055,contactFx.z,size,1,size),[1,.76,.28,(1-t)*.52],'impact-glow',true);for(let i=0;i<7;i++){const angle=i/7*Math.PI*2+.35,radius=t*(.45+i*.06)*contactFx.power,height=.10+Math.sin(t*Math.PI)*(.20+(i%3)*.07);r.add('sphere',pose(contactFx.x+Math.cos(angle)*radius,height,contactFx.z+Math.sin(angle)*radius,.025+(1-t)*.018),[.62,.49,.27,1],'',false,.04)}}else contactFx=null}
  if(carrier&&(!ended||pendingDriveEnd?.title==='INTERCEPTED')){const selectedPlayer=liveUnit?.state?actors[liveUnit.state.controlled]:carrier,cx=selectedPlayer.x,cz=selectedPlayer.z,selectedFlash=liveUnit?.state?Math.max(0,1-(liveUnit.state.time-(liveUnit.state.selectedAt??-10))/.7):0;r.add('plane',pose(cx,.036,cz,2.35,1,1.65),[1,1,1,.72],'player-glow',true);for(let i=0;i<32;i++){const a=i/32*2*Math.PI,b=(i+1)/32*2*Math.PI;r.add('cylinder',segment([cx+Math.cos(a)*.70,.045,cz+Math.sin(a)*.70],[cx+Math.cos(b)*.70,.045,cz+Math.sin(b)*.70],(liveUnit?.state ? .035+selectedFlash*.015 : .025)),hex(liveUnit?.state?'#7be4ed':'#ebce7a'),'',true)}}
  const kickTarget=liveUnit?.aimTarget();
  if(kickTarget){const {point:[x,y,z],vertical}=kickTarget;for(let i=0;i<40;i++){const a=i*Math.PI/20,b=(i+1)*Math.PI/20,rad=vertical?.55:1.6;r.add('cylinder',segment([x+Math.cos(a)*rad,y+(vertical?Math.sin(a)*rad:0),z+(vertical?0:Math.sin(a)*rad)],[x+Math.cos(b)*rad,y+(vertical?Math.sin(b)*rad:0),z+(vertical?0:Math.sin(b)*rad)],.06),hex('#f3d77d'),'',true);}r.add('cylinder',segment([x-.85,y,z],[x+.85,y,z],.035),hex('#ffffff'),'',true);r.add('cylinder',segment(vertical?[x,y-.85,z]:[x,y,z-.85],vertical?[x,y+.85,z]:[x,y,z+.85],.035),hex('#ffffff'),'',true);}
  for(const line of liveUnit?.art||[]){r.add('cylinder',segment([line.from.x,.08,line.from.z],[line.to.x,.08,line.to.z],.045),hex(line.to.type==='rush'?'#e88671':'#a5cbd7'),'',true);if(line.to.type==='zone'){for(let i=0;i<24;i++){const a=i*Math.PI/12,b=(i+1)*Math.PI/12;r.add('cylinder',segment([line.to.x+Math.cos(a)*4,.08,line.to.z+Math.sin(a)*2.5],[line.to.x+Math.cos(b)*4,.08,line.to.z+Math.sin(b)*2.5],.035),hex('#a5cbd7'),'',true);}}}
  if(phase==='pre'&&playArtVisible&&!playbookOpen){
   const lists=mode==='run'?[RUNS[selected].path,...(currentPlay().option?[currentPlay().keepPath]:[])].map(path=>path.map(p=>[p[0]*runDirection,snapZ+p[1]])):PASSES[selected].routes.map((pts,i)=>pts.map(p=>[actors[receiverIndices[i]].x+p[0]*runDirection,actors[receiverIndices[i]].z+p[1]]));
   lists.forEach((pts,i)=>{for(let j=1;j<pts.length;j++){const a=pts[j-1],b=pts[j];r.add('cylinder',segment([a[0],.052,a[1]],[b[0],.052,b[1]],.036),hex(['#d2bb75','#bcced4','#819fae'][i%3]),'',true)}})
  }
  if(phase==='pre'&&!playbookOpen&&mode==='run'&&(playArtVisible||prePanel==='adjust')&&actors[mikeIndex]){const m=actors[mikeIndex];for(let i=0;i<24;i++){const a=i/24*2*Math.PI,b=(i+1)/24*2*Math.PI;r.add('cylinder',segment([m.x+Math.cos(a)*.82,.05,m.z+Math.sin(a)*.82],[m.x+Math.cos(b)*.82,.05,m.z+Math.sin(b)*.82],.035),hex('#f0cc67'),'',true)}}
  if(!meshy.ready)for(const p of actors)drawAthlete(r,p,now/1000,liveUnit?.state&&(liveUnit.state.stage==='pre'||['extra-point','field-goal'].includes(liveUnit.state.kind)&&liveUnit.state.stage==='kick')?'pre':phase);
  else meshy.queueShadows(actors,phase,now/1000);
  const stagedBall=phase==='pre'?[actors[2].x,.42,actors[2].z-.2]:exchange?.ball;
  if(stagedBall&&!ended){const[x,y,z]=stagedBall;r.add('football',segment([x,y,z-.17],[x,y,z+.17],.105),[1,1,1,1],'',false,.08,5)}
  if(!stagedBall&&carrier?.hasBall&&!flight){const rigged=meshy.ballAnchor(carrier);if(rigged)r.add('football',segment(rigged.a,rigged.b,.105),[1,1,1,1],'',false,.08,5);else{const[x,y,z,heading]=carriedBallAnchor(carrier,phase),fx=Math.sin(heading)*.17,fz=Math.cos(heading)*.17;r.add('football',segment([x-fx,y,z-fz],[x+fx,y,z+fz],.105),[1,1,1,1],'',false,.08,5)}}
  if(flight){const t=clamp(flight.t,0,1),p=flight.from.map((v,i)=>v+(flight.to[i]-flight.from[i])*t),dx=flight.to[0]-flight.from[0],dz=flight.to[2]-flight.from[2];p[1]+=Math.sin(Math.PI*t)*flight.arc;const axis=[dx,flight.to[1]-flight.from[1]+Math.cos(Math.PI*t)*Math.PI*flight.arc,dz],axisLength=Math.hypot(...axis)||1,a=p.map((v,i)=>v-axis[i]/axisLength*.19),b=p.map((v,i)=>v+axis[i]/axisLength*.19);r.add('football',mul(segment(a,b,.112),ry(simTime*22)),[1,1,1,1],'',false,.08,5);r.add('plane',pose(p[0],.06,p[2],.52,1,.40),[0,0,0,.65],'shadow',true)}
  if(looseBall){const age=simTime-looseBall.born,t=clamp(age/looseBall.life,0,1);if(t>=1)looseBall=null;else{const fall=Math.sqrt(Math.max(0,(looseBall.y-.16)/7)),bounce=Math.abs(Math.sin(Math.max(0,age-fall)*16))*.24*(1-t),x=looseBall.x+age*.85*looseBall.side,z=looseBall.z+age*.42,y=age<fall?Math.max(.16,looseBall.y-7*age*age):.16+bounce;const tilt=Math.sin(age*14)*.075;r.add('football',mul(segment([x-.17,y-tilt,z-.08],[x+.17,y+tilt,z+.08],.112),ry(age*9)),[1,1,1,1],'',false,.08,5);r.add('plane',pose(x,.06,z,.48,1,.36),[0,0,0,.58],'shadow',true)}}
  r.draw();meshy.draw(actors,liveUnit?.state&&(liveUnit.state.stage==='pre'||['extra-point','field-goal'].includes(liveUnit.state.kind)&&liveUnit.state.stage==='kick')?'pre':liveUnit?.state?.stage==='end'?'dead':phase,now/1000);if(fullGame)meshy.drawJerseyNumbers(actors);
  positionPlayerNames();
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
 function positionPlayerNames(){
  if($('playerNames').hidden)return;
  // Use roster identities and measured pill dimensions; never label the other team.
  const occupied=[],bottom=$('pre').getBoundingClientRect().top-6;
  for(const p of actors.filter(p=>p.team===0&&['WR','RB','TE'].includes(p.role))){
   const label=$('player-name-'+p.index),foot=r.project([p.x,0,p.z]);
   label.hidden=false;
   const width=label.offsetWidth,height=label.offsetHeight,x=clamp(foot.x,width/2+4,r.width-width/2-4),y=foot.y+4;
   const box={left:x-width/2,right:x+width/2,top:y,bottom:y+height};
   const visible=foot.visible&&foot.x>=0&&foot.x<=r.width&&y>=72&&box.bottom<bottom&&!occupied.some(b=>box.left<b.right+3&&box.right>b.left-3&&box.top<b.bottom+2&&box.bottom>b.top-2);
   label.hidden=!visible;if(!visible)continue;
   label.style.left=x+'px';label.style.top=y+'px';occupied.push(box);
  }
 }
 function simulate(dt){
  previousPresentation=actors.map(p=>({...p,motion:p.motion?{...p.motion}:null}));previousPresentationPhase=phase;previousExchange=exchange?{kind:exchange.kind,ball:[...exchange.ball]}:null;previousFlight=flight?{...flight}:null;
  tick(dt);for(const p of actors)advanceMotion(p,dt,liveUnit?.state&&(liveUnit.state.stage==='pre'||['extra-point','field-goal'].includes(liveUnit.state.kind)&&liveUnit.state.stage==='kick')?'pre':liveUnit?.state?.stage==='end'?'dead':phase);captureHighlight();replay.sample();
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
 let lastDraw=NaN;
 function loop(now){
  raf=requestAnimationFrame(loop);const dt=Math.min(.25,Math.max(0,(now-last)/1000)||.016);last=now;
  if(document.hidden||r.lost||(paused&&!activeContact&&!replaying))return;
  if(replaying)advanceReplay(dt);else if((!paused||activeContact)&&!qaStepping){accumulator+=dt;let steps=0;while(accumulator>=1/60&&steps++<15){simulate(1/60);accumulator-=1/60;if(paused&&!activeContact)break}}
  if(!renderDue(now,lastDraw))return;const drawDt=Number.isFinite(lastDraw)?Math.min(.1,(now-lastDraw)/1000):dt;lastDraw=now;present(drawDt,replaying?1:accumulator*60);updateSkillButtons();if(now>messageUntil)$('message').classList.remove('show');frameId++;
 }
  function setMode(v){if(phase!=='pre'||playbookOpen||paused)return;mode=v;selected=0;replay.event('mode',{mode:v});setup(false)}
  for(const f of [{id:'all',name:'ALL FORMATIONS'},...FORMATIONS]){const button=document.createElement('button');button.type='button';button.dataset.formation=f.id;button.textContent=f.name;button.onclick=()=>{if(!playbookOpen||paused)return;bookFormation=f.id;bookFilter='all';$('playbookGrid').scrollTop=0;renderPlaybook()};$('formationTabs').appendChild(button)}
  $('option-give').onclick=()=>chooseOption('give');$('option-keep').onclick=()=>chooseOption('keep');
  $('breakHuddle').onclick=breakHuddle;$('openPlaybook').onclick=openPlaybook;for(const [filter,id] of [['all','filterAll'],['run','filterRun'],['pass','filterPass'],['read','filterRead']])$(id).onclick=()=>{if(!playbookOpen||paused)return;bookFilter=filter;$('playbookGrid').scrollTop=0;renderPlaybook()};
  $('runTab').onclick=()=>setMode('run');$('passTab').onclick=()=>setMode('pass');$('snap').onpointerdown=e=>{snap();e.preventDefault()};$('snap').onclick=e=>{if(e.detail===0)snap()};$('flipPlay').onclick=flipPlay;$('motionReceiver').onclick=motionReceiver;$('identifyMike').onclick=identifyMike;$('scramble').onclick=()=>scramble();$('throwAway').onclick=throwAway;$('control').onclick=()=>{if(!paused)return;assist=!assist;input.x=input.z=0;replay.event('control-mode',{assist});updateControls()};$('pause').onclick=pause;$('resume').onclick=pause;$('watchReplay').onclick=watchReplay;document.querySelectorAll('#catchChoices button').forEach(button=>button.onclick=()=>chooseCatch(button.dataset.catch));
  $('adjustPlay').onclick=()=>prePanel?closePrePanel():showPrePanel('adjust');$('adjustTab').onclick=()=>showPrePanel('adjust');$('audibleTab').onclick=()=>showPrePanel('audible');$('closePrePanel').onclick=()=>closePrePanel(true);
  $('playArt').onclick=togglePlayArt;
  document.addEventListener('pointerdown',e=>{if(prePanel&&!e.target?.closest?.('#pre'))closePrePanel()});
  let playerTap=null;
  $('game').addEventListener('pointerdown',e=>{if(!liveUnit?.state||paused)return;playerTap={id:e.pointerId,x:e.clientX,y:e.clientY};});
  $('game').addEventListener('pointercancel',()=>{playerTap=null;});
  $('game').addEventListener('pointerup',e=>{
   const tap=playerTap;playerTap=null;if(!tap||tap.id!==e.pointerId||paused||!liveUnit?.state||Math.hypot(tap.x-e.clientX,tap.y-e.clientY)>12)return;
   const rect=$('game').getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
   const hits=actors.filter(p=>liveUnit.canSelect(p.index)).map(p=>{const head=r.project([p.x,2.1,p.z]),foot=r.project([p.x,0,p.z]);const cx=(head.x+foot.x)/2,cy=(head.y+foot.y)/2;return {p,head,foot,cx,cy,radius:Math.max(22,Math.abs(foot.y-head.y)/2+8)};}).filter(h=>h.head.visible&&h.foot.visible&&Math.abs(x-h.cx)<=Math.max(22,h.radius*.55)&&Math.abs(y-h.cy)<=h.radius).sort((a,b)=>Math.hypot(x-a.cx,y-a.cy)-Math.hypot(x-b.cx,y-b.cy));
   if(hits[0]){liveUnit.selectPlayer(hits[0].p.index);navigator.vibrate?.(7);}
  });
  $('restart').onclick=()=>{liveUnit?.stop();conversionDrive=null;if(currentPlay().fake){mode='run';selected=0;bookFormation='all';}replay.event('restart');drive={...initialDrive};if(mini){mini=fullGame?fullSession(miniConfig.mode,true):miniSession();miniUI.reset();document.querySelector('.away strong').textContent=miniConfig?.mode==='two-minute'?'27':'0'}paused=false;ended=false;$('paused').hidden=true;setup()};
  $('sendReport').onclick=async()=>{const button=$('sendReport'),status=$('reportStatus'),receipt=$('reportReceipt');if(button.disabled)return;button.disabled=true;button.textContent='SENDING…';status.className='';status.textContent='Uploading gameplay state only…';try{const result=await replay.submit($('reportNote').value);$('reportCode').textContent=result.id;receipt.hidden=false;button.hidden=true;status.className='sent';status.textContent='Upload complete. Codex can locate this report automatically.';button.dataset.reviewUrl=result.reviewUrl||'';receipt.scrollIntoView({block:'nearest',behavior:'smooth'});replay.event('report-sent',{id:result.id})}catch(error){button.disabled=false;button.textContent='SEND FAILED · RETRY';status.className='error';status.textContent=(error?.message||'The gameplay report could not be sent.')+' Your report is still saved on this screen.'}};
  $('copyReportCode').onclick=async()=>{const code=$('reportCode').textContent;if(!code)return;try{await navigator.clipboard.writeText(code);$('copyReportCode').textContent='COPIED ✓'}catch{$('copyReportCode').textContent='PRESS AND HOLD CODE'}};
 function joy(e){const box=$('stick').getBoundingClientRect(),dx=e.clientX-box.left-box.width/2,dy=e.clientY-box.top-box.height/2,max=box.width*.32,len=Math.hypot(dx,dy)||1,s=Math.min(1,max/len);input.x=dx*s/max;input.z=-dy*s/max;if((phase==='pre'||phase==='snap'||phase==='handoff')&&Math.hypot(input.x,input.z)>=.12)snapDirection={x:input.x,z:input.z};$('knob').classList.add('held');$('knob').style.transform=`translate(${dx*s}px,${dy*s}px)`;$('stick').setAttribute('aria-valuenow',input.x.toFixed(2))}
  $('stick').onpointerdown=e=>{if(playbookOpen||paused||(!liveUnit?.state&&assist&&phase==='run')||(!liveUnit?.state&&!['pre','snap','handoff','pass','flight','run'].includes(phase)))return;input.pointer=e.pointerId;$('stick').setPointerCapture(e.pointerId);joy(e);replay.event('stick-start',{x:input.x,z:input.z});e.preventDefault()};$('stick').onpointermove=e=>{if(input.pointer!==e.pointerId)return;joy(e);e.preventDefault()};const clearJoy=e=>{if(e?.pointerId!==undefined&&input.pointer!==null&&e.pointerId!==input.pointer)return;if(input.pointer!==null)replay.event('stick-end');input.x=input.z=0;input.pointer=null;$('knob').classList.remove('held');$('knob').style.transform='none';$('stick').setAttribute('aria-valuenow','0')};$('stick').onpointerup=clearJoy;$('stick').onpointercancel=clearJoy;$('stick').onlostpointercapture=clearJoy;
  const clearSprint=e=>{if(e&&input.sprintPointer!==e.pointerId)return;if(input.sprint)replay.event('sprint-end');input.sprint=false;input.sprintPointer=null};$('sprint').onpointerdown=e=>{input.sprint=true;input.sprintPointer=e.pointerId;replay.event('sprint-start');$('sprint').setPointerCapture(e.pointerId);e.preventDefault()};$('sprint').onpointerup=clearSprint;$('sprint').onpointercancel=clearSprint;$('sprint').onlostpointercapture=clearSprint;window.addEventListener('pointerup',clearSprint);window.addEventListener('pointercancel',clearSprint);
 document.querySelectorAll('#skillPad button').forEach(button=>{button.onpointerdown=e=>{if(phase!=='run'||simTime<jukeReady)return;let action=button.dataset.skill;if(action==='spin')action=input.x<-.15?'spin-left':'spin-right';button.classList.add('pressed');performSkill(action);e.preventDefault()};const release=()=>button.classList.remove('pressed');button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release});
 const stopSafariZoom=event=>event.preventDefault();for(const type of['gesturestart','gesturechange','gestureend'])document.addEventListener(type,stopSafariZoom,{passive:false});document.addEventListener('touchmove',event=>{if(event.touches.length>1)event.preventDefault()},{passive:false});
 window.addEventListener('keydown',e=>{if(phase==='pre'&&!paused&&!playbookOpen){if(e.target?.id==='playArt'&&['Space','Enter'].includes(e.code)){e.preventDefault();if(!e.repeat)togglePlayArt();return}if(e.key?.toLowerCase()==='p'&&!e.target?.closest?.('textarea,input,[contenteditable]')){e.preventDefault();if(!e.repeat)togglePlayArt();return}if(e.key==='Escape'&&playArtVisible){e.preventDefault();setPlayArt(false);return}if(e.key==='Escape'&&prePanel){e.preventDefault();closePrePanel(true);return}}if(e.key!=='Escape'&&(e.target?.closest?.('textarea,input')||(['Space','Enter'].includes(e.code)&&e.target?.closest?.('button,a'))))return;if(playbookOpen){if(e.key==='Escape'&&!e.repeat)pause();return}if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();const key=normalizeControlKey(e.key),receiverSlot=receiverSlotForKey(key);keys.add(key);if(e.code==='Space'&&!e.repeat)snap();if(receiverSlot>=0&&!e.repeat)throwTo(receiverIndices[receiverSlot],throwKindForModifiers(e.shiftKey,e.altKey));if(mode==='pass'&&phase==='flight'&&!paused&&!e.repeat&&key==='c')chooseCatch('secure');if(mode==='pass'&&phase==='flight'&&!paused&&!e.repeat&&key==='v')chooseCatch('aggressive');if(mode==='pass'&&phase==='flight'&&!paused&&!e.repeat&&key==='b')chooseCatch('rac');if(key==='g'&&!e.repeat)scramble();if(key==='Escape'&&!e.repeat)pause();if(key==='j'&&!e.repeat)performSkill('juke');if(key==='q'&&!e.repeat)performSkill('spin-left');if(key==='e'&&!e.repeat)performSkill('spin-right');if(key==='r'&&!e.repeat)performSkill('truck');if(key==='f'&&!e.repeat)performSkill(carrier?.role==='QB'?'slide':'hurdle')});window.addEventListener('keyup',e=>{keys.delete(normalizeControlKey(e.key))});
 window.addEventListener('blur',()=>{keys.clear();clearSprint();clearJoy();if(!paused&&!ended)pause()});document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden&&!paused&&!ended)pause()});window.addEventListener('resize',()=>{r.resize();last=performance.now();if(innerHeight>innerWidth&&!paused&&!ended)pause()});window.addEventListener('pagehide',()=>cancelAnimationFrame(raf));window.addEventListener('pageshow',e=>{if(e.persisted){last=performance.now();raf=requestAnimationFrame(loop)}});
 const portrait=matchMedia('(orientation:portrait)');portrait.addEventListener('change',event=>{if(event.matches&&!paused&&!ended)pause()});
 function forceContact(type='wrap',driveEnding=false){
  if(phase!=='run'||!carrier)return false;const contactType=['wrap','dive','gang','big-hit','shoulder-hit','low-wrap','drag-down'].includes(type)?type:'wrap',tackler=actors[15],helper=actors[16];tackler.fallen=false;tackler.engaged=false;tackler.engagedWith=null;tackler.x=carrier.x+.64;tackler.z=carrier.z-.22;if(contactType==='gang'){helper.fallen=false;helper.engaged=false;helper.engagedWith=null;helper.x=carrier.x-.72;helper.z=carrier.z+.08}const speed=Math.max(5.8,Math.hypot(carrier.vx,carrier.vz));if(Math.hypot(carrier.vx,carrier.vz)<.2){carrier.vx=0;carrier.vz=speed}if(driveEnding){drive.down=4;drive.toGo=20}const spot=forwardProgressSpot(carrier.z,carrier.vz);lastTackler=tackler.index;beginContactSequence(tackler,{type:contactType},contactType==='gang'?[helper]:[],speed);endPlay(contactType==='big-hit'?'BIG HIT':contactType==='gang'?'GANG TACKLE':contactType==='dive'?'DIVING TACKLE':'TACKLED',spot);return true;
 }
 function showFullState(){
  pendingThrow=null;flight=null;activeContact=null;pendingDriveEnd=null;pendingPlayMessage=null;input.x=input.z=0;input.sprint=false;input.pointer=input.sprintPointer=null;keys.clear();playbookOpen=false;prePanel=null;receiverMotion=null;setPlayArt(false);actors.forEach(releasePostPlay);
  phase='cpu';mini.running=false;
  if(mini.result){ended=true;paused=true;$('dialogTitle').textContent=mini.result.reason;$('dialogBody').textContent=(mini.overtime?'Final after overtime. ':'Final whistle. ')+(mini.log.at(-1)?.reason||'');$('resume').hidden=true;miniUI.result(mini,drive);$('paused').hidden=false;}
  if(mini.conversion==='home'&&!mini.result){openConversionPlaybook();return;}
  if(!mini.result){
   if(mini.kickoff){startUnit('kickoff');return;}
   if(mini.pending)fullContinue(mini,drive);
   if(mini.result){showFullState();return;}
   if(mini.possession==='home'){setup();camera(1);return;}
   if(mini.defenseMode==='play'){startUnit('defense');return;}
   mini.wait=0;
  }
  updateHud();updateControls();
 }
 function openConversionPlaybook(){
  conversionDrive={...drive};drive.ball=85;drive.down=1;drive.toGo=15;bookFormation='special-teams';bookFilter='all';
  mode='run';selected=0;setup();bookChoice={mode:'kick',index:0};renderPlaybook();updateHud();updateControls();camera(1);
 }
 function advanceFull(){
  if(!fullGame||paused||ended||phase!=='cpu'||mini.conversion)return;
  if(mini.kickoff){startUnit('kickoff');return;}
  if(mini.pending){fullContinue(mini,drive);if(mini.possession==='home'){setup();camera(1);updateHud();return;}}
  else if(mini.defenseMode==='play'){startUnit('defense');return;}else fullCpuPlay(mini,drive,miniConfig,rand);
  mini.wait=2.8;if(mini.possession==='away'&&!mini.pending&&!mini.result&&mini.defenseMode==='play'){startUnit('defense');return;}if(mini.result)showFullState();else updateHud();
 }
 function kickFull(kind){if(!fullGame||paused||ended||phase!=='pre'||receiverMotion)return;if(fullKick(mini,drive,'home',kind,miniConfig.matchup.home,rand)){drive.plays++;showFullState();}}
 const miniUI=createMiniGamesUI(miniConfig,{
  playDefense(){if(paused||ended||mini.result||mini.conversion||mini.kickoff)return;mini.defenseMode='play';if(mini.pending==='away')fullContinue(mini,drive);if(mini.possession==='away'&&!mini.pending)startUnit('defense');},
  extraPoint(){if(mini.conversion==='home'){if(conversionDrive){drive={...conversionDrive};conversionDrive=null;}startUnit('extra-point');}},
  twoPoint(){if(mini.conversion!=='home')return;conversionDrive??={...drive};drive.ball=98;drive.down=1;drive.toGo=2;bookFormation='all';mode='run';selected=0;setup();},
  punt(){if(fullGame&&!paused&&!ended&&phase==='pre'&&!receiverMotion&&!mini.overtime&&!mini.conversion)startUnit('punt')},fieldGoal(){if(fullGame&&!paused&&!ended&&phase==='pre'&&!receiverMotion&&117-drive.ball<=65)startUnit('field-goal')},next:advanceFull,auto(){if(!fullGame||paused||ended)return;mini.auto=!mini.auto;mini.wait=2.8;updateHud()},
  defenseTimeout(){if(!fullGame||paused||ended||mini.pending||mini.possession!=='away'||mini.timeouts<=0||mini.overtime||mini.defenseTimeout)return;mini.timeouts--;mini.defenseTimeout=true;fullLog(mini,drive,'home','TIMEOUT · Next CPU snap has no huddle runoff');updateHud()},
  timeout(){if(paused||ended||!miniTimeout(mini,drive,phase))return;replay.event('timeout',{remaining:mini.timeouts});message('TIMEOUT · CLOCK STOPPED',1.2);updateHud()},
  spike(){if(paused||ended||receiverMotion||!miniSpike(mini,drive,phase))return;replay.event('spike');if(fullGame){const entry=mini.log.at(-1);entry.side='home';entry.overtime=mini.overtime;fullRecord(mini,'home',{pass:true,incomplete:true,quarterback:miniConfig.matchup.home.lineup[5]});}if(drive.down>4){endDrive('TURNOVER ON DOWNS','');return}if(drive.clock<=0&&!mini?.overtime){endDrive('TIME EXPIRED','');return}setup();message('SPIKE · CLOCK STOPPED · DOWN USED',1.5)}
 });
 function finishTry(good){const saved=conversionDrive;conversionDrive=null;drive={...saved};mode='run';selected=0;bookFormation='all';fullConversion(mini,drive,'two-point',good);showFullState();}
 function startUnit(kind){
  if(kind==='defense'){const kick=fullCpuKickChoice(mini,drive,miniConfig.matchup.away.kicker.overall);if(kick==='punt'){startUnit('punt');return;}if(kick){fullKick(mini,drive,'away',kick,miniConfig.matchup.away,rand);showFullState();return;}}
  setup(false);playbookOpen=false;phase='unit';exchange=null;flight=null;
  const goal=kind==='extra-point'||kind==='field-goal';
  const puntSide=kind==='punt'?mini.possession:null;const cpuOffense=kind==='defense'||goal||kind==='kickoff'&&mini.kickoff==='home'||kind==='punt'&&puntSide==='home';
  actors.forEach((p,index)=>{const side=index<11?(cpuOffense?'away':'home'):(cpuOffense?'home':'away'),team=miniConfig.matchup[side],player=team.lineup[index];p.team=side==='home'?0:1;Object.assign(p,rosterIdentity(player,team,side==='away'));p.ratings=miniRatings(rosterRatings(playerRatings(p.role,index,p.team),player),p.team,miniConfig.level);});
  if(goal){const team=miniConfig.matchup.home;[11,12,13,14,17,18,19,20,21,15].forEach((index,j)=>{const source=team.lineup[[0,1,2,3,4,10,6,7,8,5][j]];Object.assign(actors[index],rosterIdentity(source,team));actors[index].role=j===9?'QB':j<5?'OL':'TE';});}
  const offset=mini.cpu.ball-drive.ball;actors.forEach(p=>{p.z+=offset;p.startZ+=offset;});if(kind==='kickoff'||kind==='punt'||goal){const side=kind==='punt'?puntSide:goal?'home':mini.kickoff,kicking=miniConfig.matchup[side];Object.assign(actors[16],rosterIdentity(kind==='punt'?kicking.punter:kicking.kicker,kicking,side==='away'));actors[16].role='K';}
  prepareJerseys(r,actors);snapZ=10+mini.cpu.ball;snapGainZ=Math.min(110,snapZ+mini.cpu.toGo);
  liveUnit.start(kind,{ball:goal||kind==='punt'&&puntSide==='home'?drive.ball:mini.cpu.ball,down:mini.cpu.down,toGo:mini.cpu.toGo,clock:drive.clock,deficit:drive.score-mini.awayScore,kicking:kind==='punt'?puntSide:goal?'home':mini.kickoff});
  // Establish the new facing before accepting movement; never orbit through the stands.
  const view=liveUnit.view();camEye=[...view.eye];camTarget=[...view.target];r.fov=view.fov||55;fieldCamera(camEye,camTarget);
  carrier=actors[liveUnit.state.carrier];exchange=liveUnit.state.stagedBall?{kind:'snap',ball:liveUnit.state.stagedBall}:null;updateControls();updateHud();
 }
 if(fullGame)liveUnit=createLiveUnits({config:miniConfig,getActors:()=>actors,getAspect:()=>r.width/r.height,random:rand,
  inputVector(){let x=input.x,z=input.z;if(keys.has('ArrowLeft')||keys.has('a'))x=-1;if(keys.has('ArrowRight')||keys.has('d'))x=1;if(keys.has('ArrowUp')||keys.has('w'))z=1;if(keys.has('ArrowDown')||keys.has('s'))z=-1;return cameraWorldVector(x,z,camEye,camTarget)},onStatus:message,
  onSimulate(){phase='cpu';fullCpuPlay(mini,drive,miniConfig,rand);showFullState();},
  onResult(result){
   flight=null;exchange=null;
   if(result.kind==='punt'){fullPuntResult(mini,drive,result);showFullState();return;}
   if(result.kind==='field-goal'){fullKick(mini,drive,'home','field-goal',miniConfig.matchup.home,rand,result.good);drive.plays++;showFullState();return;}
   if(mini.conversion==='home'){fullConversion(mini,drive,'extra-point',result.good);showFullState();return;}
   if(mini.kickoff){fullKickoffResult(mini,drive,result);if(!mini.result&&!mini.conversion&&!mini.kickoff&&mini.possession==='home'){setup();updateHud();return;}}
   else {fullCpuResult(mini,drive,miniConfig,{...result,live:true,runner:miniConfig.matchup.away.lineup[result.runner]});if(result.simNext)mini.defenseMode='simulate';}
   showFullState();
  }
 });
 setup();camera(1);scene(.016,0);$('loading').hidden=true;raf=requestAnimationFrame(loop);
 // Test controls exist only on an explicitly requested QA URL. This isolated
 // practice renderer never reads or writes career saves or result payloads.
 if(new URLSearchParams(location.search).has('qa')){window.bk3dTest={unitAction(action){liveUnit?.action(action)},unitSwitch(){liveUnit?.switchPlayer()},touchdown(){if(phase!=='run')return false;const delta=110-carrier.z;for(const p of actors)p.z+=delta;camEye[2]+=delta;camTarget[2]+=delta;carrier.z=110;endPlay('TOUCHDOWN',100);return true},throwTo,seed(value){numSeed=Number(value)||1},manualFrames(){qaStepping=true;accumulator=0;cancelAnimationFrame(raf)},step(seconds){const n=Math.ceil(clamp(seconds,0,10)*60);for(let i=0;i<n;i++){if(replaying)advanceReplay(1/60);else if(!paused||activeContact)simulate(1/60);camera(1/60)}scene(.016,simTime*1000)},setSnapNumber(value){if(phase!=='pre')return false;drive.plays=Math.max(0,Math.trunc(Number(value)||0));setup(playbookOpen);camera(1);scene(.016,simTime*1000);return true},forceContact,flipPlay,motionReceiver,identifyMike,watchReplay};window.bk3dDiagnostics=()=>{const qb=actors[5],nearest=Math.min(...actors.filter(p=>p.team===1&&!p.engaged&&!p.fallen&&(p.role==='DL'||defensiveCall.blitzers.includes(p.index))).map(p=>Math.hypot(p.x-qb.x,p.z-qb.z)),8);return({unit:liveUnit?.state?{...liveUnit.state}:null,mini:mini?{...mini,level:miniConfig.level.id}:null,phase,mode,selected,assist,playbook:{open:playbookOpen,filter:bookFilter,formation:bookFormation,choice:{...bookChoice}},formation:currentPlay().formation,playId:currentPlay().id,optionChoice,throwing:pendingThrow?{releaseAt:pendingThrow.releaseAt}:null,camera:{eye:[...r.eye],target:[...r.target]},exchange:exchange?{kind:exchange.kind,ball:[...exchange.ball]}:null,transitionFade,elapsed,simTime,paused,ended,lastSkill,lastTackler,catchStyle,preSnap:{runDirection,mikeIndex,motioned,moving:Boolean(receiverMotion),panel:prePanel,playArt:playArtVisible},replay:{available:lastHighlight.length,replaying},defense:{index:defensiveCallIndex,id:defensiveCall.id,name:defensiveCall.name,coverage:defensiveCall.coverage,blitzers:[...defensiveCall.blitzers]},contact:activeContact?{type:activeContact.type,elapsed:activeContact.elapsed,duration:activeContact.duration,tackler:activeContact.tackler,helper:activeContact.helper}:null,effects:{turf:turfFx.length,contact:Boolean(contactFx)},throwKind:flight?.kind||null,pocketPressure:phase==='pass'?pocketThreat(qb,actors.filter(p=>p.team===1),elapsed):0,frames:frameId,drawCalls:r.drawCalls,glError:r.gl.getError(),athletes:meshy.diagnostics(),players:actors.map(p=>({role:p.role,lastName:p.lastName,number:p.number,playerId:p.playerId,teamAbbr:p.teamAbbr,overall:p.overall,kitJersey:p.kitJersey,team:p.team,ratings:p.ratings,x:p.x,z:p.z,startX:p.startX,startZ:p.startZ,vx:p.vx,vz:p.vz,distance:p.distance,heading:p.heading,hasBall:p.hasBall,engaged:p.engaged,engagedWith:p.engagedWith,blockStyle:p.blockStyle,blockResult:p.blockResult,routeStyle:p.routeStyle,coverageStyle:p.coverageStyle,fallen:p.fallen,action:p.action,actionT:p.actionT,actionSide:p.actionSide,fallHeading:p.fallHeading,contactWith:p.contactWith,contactRole:p.contactRole,contactVariant:p.contactVariant,ballTarget:p.ballTarget,lookTarget:p.lookTarget,receiving:p.receiving,catchStyle:p.catchStyle,throwT:p.throwT,throwStyle:p.throwStyle,topSpeed:playerTopSpeed(p),pose:p.motion?{speed:p.motion.speed,run:p.motion.run,ready:p.motion.ready,block:p.motion.block,turn:p.motion.turn,gait:p.motion.gait,fall:p.motion.fall}:null,head:r.project([p.x,2.1,p.z]),foot:r.project([p.x,0,p.z])})),drive:{...drive},field:{scrimmage:snapZ,lineToGain:snapGainZ},stamina,worldObjects:stadium.parts})};}
}
