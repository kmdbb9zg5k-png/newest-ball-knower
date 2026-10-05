import {referenceCarryFrame,referencePocketFrame} from './reference-camera.js?v=full-possession-52';
import {routePoint,pursuitRead,contactImpact} from './football-flow.js?v=complete-flow-46';
import {QB_THROW_RELEASE} from './quarterback.js?v=football-finish-21';
import {interceptPoint} from './field-awareness.js?v=contact-camera-11';
import {cpuRead} from './cpu-offense.js?v=contact-camera-11';
import {DEFENSE_PLAYS,DEFENSE_FORMATIONS,defenseAlignment,defenseAssignment,nearestDefender,defensiveTackleChance,defensiveDiagram} from './defense-playbook.js?v=contact-camera-11';
import {PASSES} from './playbook.js?v=contact-camera-11';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const returnKick=kind=>kind==='kickoff'||kind==='punt';
const goalKick=kind=>kind==='extra-point'||kind==='field-goal';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const speed=p=>5.2+6*(clamp(p.ratings.speed,35,99)-35)/64;
const pathPoint=(path,d)=>routePoint(path,d,false);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** On-field defense and kick returns. Actors/rendering are shared with offense. */
export function createLiveUnits({config, getActors, inputVector, onResult, onSimulate, onStatus, getAspect=()=>2, random=Math.random}) {
 let aimPointer=null,aimInput=[0,0];
 let state=null, call=DEFENSE_PLAYS[0],formation='4–3', art=false,press=0,shift=0,paused=false;
 const root=document.createElement('section');root.id='liveUnits';root.hidden=true;
 root.innerHTML='<section id="defenseBook" aria-label="Defensive playbook"><div class="unit-book-heading"><div><h2>CALL DEFENSE</h2><p id="defensePersonnel"></p></div><button id="unitSimBook"><span aria-hidden="true">▶</span> Simulate Play</button></div><div id="defenseFormations" role="group" aria-label="Defensive formations"></div><div id="defenseCalls"></div><div id="defensePreview" hidden><button id="closeDefensePreview" aria-label="Close play preview">✕</button><div id="defensePreviewDiagram"></div><strong id="defensePreviewName"></strong><span class="defense-legend">CYAN · COVERAGE &nbsp; ORANGE · RUSH</span></div></section><div id="unitTop"><span id="unitStatus" role="status"></span><button id="unitSim">SIMULATE NEXT PLAY</button></div><div id="unitPre"><button id="unitBook">PLAYBOOK</button><button id="unitArt" aria-pressed="false">SHOW PLAY</button><button id="unitPress">PRESS</button><button id="unitBack">BACK OFF</button><button id="unitShift">SHIFT LINE</button><button id="unitReady">READY</button></div><div id="unitPad"><button id="unitSwitch">SWITCH</button><button id="unitPrimary">TACKLE</button><button id="unitSecondary">HIT STICK</button></div><div id="unitKick"><div id="kickGuide"><span id="kickHelp">MOVE STICK TO AIM</span><div class="kick-meter"><span class="kick-zone"></span><i id="kickPower"></i></div></div><button id="unitKickButton">KICK</button><button id="unitTouchback">TAKE TOUCHBACK</button><button id="unitFairCatch">FAIR CATCH</button></div><div id="kickAimPad"><span>AIM KICK</span><div id="kickAimStick" role="slider" tabindex="0" aria-label="Aim kick. Arrow keys move target." aria-valuemin="-24" aria-valuemax="24" aria-valuenow="0"><i id="kickAimKnob"></i></div></div><div id="unitResult" role="status"><h2></h2><button id="unitContinue">CONTINUE →</button></div>';
 document.getElementById('hud').after(root);
 const $=id=>root.querySelector('#'+id);
 // Adjustments belong inside the playbook; live defense has only two actions.
 $('defenseBook').append($('unitPre'));$('unitBook').hidden=true;$('unitReady').hidden=true;
 const adjustments=document.createElement('div');adjustments.id='defenseAdjustments';adjustments.hidden=true;adjustments.setAttribute('role','group');adjustments.setAttribute('aria-label','Defensive adjustments');
 adjustments.append($('unitPress'),$('unitBack'),$('unitShift'));$('defenseBook').append(adjustments);
 const adjustButton=document.createElement('button');adjustButton.id='unitAdjust';adjustButton.innerHTML='<span aria-hidden="true">☷</span> ADJUSTMENTS <span aria-hidden="true">⌃</span>';adjustButton.setAttribute('aria-expanded','false');adjustButton.setAttribute('aria-controls','defenseAdjustments');$('unitPre').append(adjustButton);
 const selection=document.createElement('div');selection.id='defenseSelection';selection.innerHTML='<span>SELECTED PLAY</span><strong id="defenseSelectedName"></strong><span id="defenseSelectedType"></span>';$('unitPre').append(selection);
 const confirm=document.createElement('button');confirm.id='unitCallDefense';confirm.innerHTML='CALL DEFENSE <span aria-hidden="true">→</span>';$('unitPre').append(confirm);
 const coverageLabel=p=>(p.coverage==='man'?'MAN COVERAGE':'ZONE COVERAGE')+(p.blitz.length?' · BLITZ':'');
 function closePanels(){art=false;$('defensePreview').hidden=true;adjustments.hidden=true;adjustButton.setAttribute('aria-expanded','false');}
 function selectCall(p){call=p;align();renderBook();refresh();}
 confirm.onclick=()=>{if(!state||paused||!state.book)return;closePanels();state.book=false;align();$('unitReady').onclick();refresh();};
 adjustButton.onclick=()=>{adjustments.hidden=!adjustments.hidden;adjustButton.setAttribute('aria-expanded',String(!adjustments.hidden));art=false;$('defensePreview').hidden=true;refresh();};
 $('closeDefensePreview').onclick=()=>{art=false;refresh();$('unitArt').focus();};
 $('defenseBook').addEventListener('keydown',e=>{if(e.key==='Escape'){closePanels();refresh();adjustButton.focus();}});
 const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b};
 function renderBook(){
  if(call.formation!==formation)call=DEFENSE_PLAYS.find(p=>p.formation===formation);
  $('defensePersonnel').textContent=formation.toUpperCase()+' · '+({'4–3':'4 LINEMEN · 3 LINEBACKERS',Nickel:'5 DEFENSIVE BACKS',Dime:'6 DEFENSIVE BACKS','Goal Line':'HEAVY FRONT'})[formation];
  $('defenseFormations').replaceChildren(...DEFENSE_FORMATIONS.map(f=>{const b=button(f,()=>{formation=f;closePanels();selectCall(DEFENSE_PLAYS.find(p=>p.formation===f))});b.setAttribute('aria-pressed',String(f===formation));return b}));
  $('defenseCalls').replaceChildren(...DEFENSE_PLAYS.filter(p=>p.formation===formation).map(p=>{const b=button('',()=>selectCall(p));b.dataset.play=p.id;b.setAttribute('aria-pressed',String(p.id===call.id));b.innerHTML=defensiveDiagram(p)+`<i class="defense-check" aria-hidden="true">✓</i><strong>${escape(p.name)}</strong><span>${coverageLabel(p)}</span>`;return b}));
  $('defenseSelectedName').textContent=call.name;$('defenseSelectedType').textContent=coverageLabel(call);
  $('defensePreviewDiagram').innerHTML=defensiveDiagram(call,'preview');$('defensePreviewName').textContent=call.name+' · '+coverageLabel(call);
 }
 function align(){const a=getActors();for(let i=11;i<22;i++){const[x,z]=defenseAlignment(call,i-11,press,shift);a[i].x=a[i].startX=x;a[i].z=a[i].startZ=state.snapZ+z;a[i].heading=Math.PI;}}
 function control(index){if(!canSelect(index))return false;const previous=getActors()[state.controlled];state.switchFrom={x:previous.x,z:previous.z};state.selectedAt=state.time;state.controlled=index;state.switchUntil=state.time+.55;onStatus?.('CONTROL · '+getActors()[index].lastName);return true;}
 function canSelect(index){return Boolean(state&&!paused&&!state.book&&!goalKick(state.kind)&&!['kick','contact','end'].includes(state.stage)&&index>=11&&index<22&&!getActors()[index].fallen&&!(returnKick(state.kind)&&state.kicking==='away'));}
 function selectPlayer(index){const selected=control(index);if(selected){state.manualSelectionAt=state.time;refresh();}return selected;}
 function autoSelect(target){const index=nearestDefender(getActors(),target);if(index>=11&&index!==state.controlled)control(index);}
 function switchPlayer(){if(!state)return;const a=getActors(),target=state.flight?a[state.flight.target]:a[state.carrier];selectPlayer(nearestDefender(a,target,state.controlled));}
 function resetAimInput(){aimPointer=null;aimInput=[0,0];$('kickAimKnob').style.transform='none';}
 function steerAim(e){const rect=$('kickAimStick').getBoundingClientRect(),radius=rect.width*.35;let x=(e.clientX-rect.left-rect.width/2)/radius,y=(e.clientY-rect.top-rect.height/2)/radius;const length=Math.max(1,Math.hypot(x,y));aimInput=[x/length,-y/length];$('kickAimKnob').style.transform=`translate(${x/length*radius}px,${y/length*radius}px)`;}
 $('kickAimStick').onpointerdown=e=>{if(!state||paused||state.stage!=='kick'||state.kicking!=='home'||aimPointer!==null)return;aimPointer=e.pointerId;$('kickAimStick').setPointerCapture(e.pointerId);steerAim(e);e.preventDefault();};
 $('kickAimStick').onpointermove=e=>{if(e.pointerId!==aimPointer)return;steerAim(e);e.preventDefault();};
 for(const event of ['pointerup','pointercancel','lostpointercapture'])$('kickAimStick').addEventListener(event,e=>{if(e.pointerId===aimPointer)resetAimInput();});
 $('kickAimStick').onkeydown=e=>{if(!state||paused||state.stage!=='kick')return;const keys={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};if(keys[e.key]){e.preventDefault();e.stopPropagation();adjustAim(...keys[e.key],.12);}};
 function adjustAim(x,z,dt){const goal=goalKick(state.kind);state.aim.x=clamp(state.aim.x+x*(goal?-1:1)*dt*(goal?5:16),goal?-8:-24,goal?8:24);if(goal)state.aim.y=clamp(state.aim.y+z*dt*4,1,9);else state.aim.z=state.kind==='punt'?clamp(state.aim.z-z*dt*14,state.puntLine-60,state.puntLine-25):clamp(state.aim.z-z*dt*14,11,38);$('kickAimStick').setAttribute('aria-valuenow',state.aim.x.toFixed(1));$('kickAimStick').setAttribute('aria-valuetext',goal?`Target ${Math.abs(state.aim.x).toFixed(1)} yards ${state.aim.x>0?'left':'right'}, ${state.aim.y.toFixed(1)} high`:`Landing at own ${Math.round(state.aim.z-10)}, ${Math.abs(state.aim.x).toFixed(1)} yards ${state.aim.x>0?'right':'left'}`);}
 function start(kind,{ball=25,down=1,toGo=10,clock=120,kicking='away',conversion=false,deficit=0}={}){
  const a=getActors();paused=false;press=0;shift=0;closePanels();resetAimInput();
  state={kind,stage:kind==='defense'?'pre':'kick',book:kind==='defense',ball,down,toGo,snapZ:ball+10,time:0,liveTime:0,clock,deficit,carrier:5,controlled:kind==='defense'?16:kicking==='away'?6:16,flight:null,pass:false,target:null,switched:false,action:null,actionUntil:0,cooldown:0,shedUntil:0,switchUntil:0,kicking,conversion,result:null,simNext:false,route:PASSES.filter(p=>!p.fake)[Math.floor(random()*PASSES.filter(p=>!p.fake).length)],power:0,timing:false,aim:{x:0,y:5.5,z:18}};
  a.forEach(p=>{p.hasBall=false;p.engaged=false;p.fallen=false;p.action=null;p.throwT=0;p.ballTarget=null;p.lookTarget=null;p.receiving=false;p.pursuitRead=null;p.qbPocket=false;p.kickShed=false;p.unitBlock=null;p.contactRole=null;p.contactWith=null;p.actionT=0;p.vx=p.vz=0;});
  if(kind==='defense') {align();a[2].hasBall=true;state.stagedBall=[a[2].x,.42,state.snapZ-.2];}
  else if(kind==='punt'){
   state.puntLine=110-ball;state.puntZ=state.puntLine+Math.min(13,Math.max(4,ball+6));state.snapZ=state.puntLine;state.carrier=16;
   a.slice(0,11).forEach((p,i)=>{p.x=(i-5)*3;p.z=state.puntLine-2-(i%3)*2;p.heading=0;});
   a.slice(11).forEach((p,i)=>{p.x=(i-5)*2;p.z=state.puntLine+1;p.heading=Math.PI;});
   a[17].x=0;a[17].z=state.puntLine;a[16].x=0;a[16].z=state.puntZ;
   const length=42+(config.matchup[kicking].punter.overall-75)*.3;
   state.aim.z=state.puntLine-length;a[6].x=0;a[6].z=Math.max(11,state.aim.z);state.stagedBall=[0,.45,state.puntLine];
   a.forEach(p=>{p.startX=p.x;p.startZ=p.z;});
  }
  else if(goalKick(kind)) {
   state.snapZ=kind==='extra-point'?95:ball+10;state.kickZ=state.snapZ-7;state.carrier=15;state.controlled=16;
   // Nine blockers, a holder, and a kicker. The kicking unit attacks +Z.
   a.slice(11).forEach((p,j)=>{p.x=(j-4)*1.2;p.z=state.snapZ-.4;p.heading=0;});
   [11,12,13,14,17,18,19,20,21].forEach((id,j)=>{a[id].x=(j-4)*1.2;a[id].z=state.snapZ-.4;});
   a[15].x=.65;a[15].z=state.kickZ;a[15].action='hold-kick';a[16].x=-1.8;a[16].z=state.kickZ-2.5;
   a.slice(0,11).forEach((p,i)=>{p.x=(i-5)*1.25;p.z=state.snapZ+([3,7].includes(i)?4:1+(i%2)*.6);p.heading=Math.PI;});
   state.stagedBall=[0,.45,state.snapZ];a.forEach(p=>{p.startX=p.x;p.startZ=p.z;});
  }
  else {
   state.carrier=16;a.forEach((p,i)=>{p.x=i<11?(i-5)*4:(i-16)*4;p.z=i<11?(i===6?14:29+(i%3)*5):78+(i%2)*2;p.startX=p.x;p.startZ=p.z;p.heading=i<11?0:Math.PI;});
   a[6].x=0;a[6].z=18;a[16].x=0;a[16].z=75;a[16].heading=Math.PI;state.stagedBall=[0,.22,75];a.forEach(p=>{p.startX=p.x;p.startZ=p.z;});
  }
  root.hidden=false;document.body.classList.add('playing-unit');renderBook();refresh();if(returnKick(kind)&&kicking==='away')kick();
 }
 function refresh(){if(!state)return;
  const pre=state.stage==='pre',end=state.stage==='end',kick=state.stage==='kick';
  $('defenseBook').hidden=!state.book;$('unitPre').hidden=!state.book;$('unitPad').hidden=state.book||end||kick||goalKick(state.kind)||['punt-snap','kick-flight','contact'].includes(state.stage);
  document.body.classList.toggle('unit-no-movement',state.book||end||kick||goalKick(state.kind)||['punt-snap','contact'].includes(state.stage));
  document.getElementById('stick').setAttribute('aria-label',returnKick(state.kind)&&state.kicking==='away'?'Move returner':'Move selected defender');
  $('unitKick').hidden=!kick&&!(state.kind==='punt'&&['punt-snap','kick-flight'].includes(state.stage)&&state.kicking==='away');$('unitFairCatch').hidden=!(state.kind==='punt'&&state.kicking==='away'&&['kick','punt-snap','kick-flight'].includes(state.stage));$('unitFairCatch').textContent=state.fairCatch?'FAIR CATCH CALLED':'FAIR CATCH';$('unitKickButton').hidden=!kick;$('unitKick').classList.toggle('return-only',state.kind==='punt'&&state.kicking==='away');$('unitTouchback').hidden=true;
  $('unitKickButton').textContent=state.kicking==='away'?(state.kind==='punt'?'RECEIVE PUNT':'RECEIVE KICKOFF'):state.timing?(state.kind==='punt'?'PUNT':'KICK'):(state.kind==='punt'?'START PUNT':'START KICK');
  $('kickAimPad').hidden=!kick||state.kicking==='away';$('kickGuide').hidden=state.kicking==='away';
  $('kickHelp').textContent=state.timing?'KICK IN THE GOLD ZONE':'MOVE STICK TO AIM · THEN START KICK';
  $('unitResult').hidden=true;$('unitTop').hidden=state.book||end;
  $('unitSim').hidden=true;$('unitSim').textContent=state.simNext?'NEXT PLAY: SIMULATED':'SIMULATE NEXT PLAY';
  $('defensePreview').hidden=!(state.book&&art);$('unitPress').setAttribute('aria-pressed',String(press===-3));$('unitBack').setAttribute('aria-pressed',String(press===5));$('unitShift').textContent='SHIFT LINE · '+(shift<0?'LEFT':shift>0?'RIGHT':'CENTER');$('unitArt').setAttribute('aria-pressed',String(art));$('unitArt').textContent=art?'HIDE PLAY':'SHOW PLAY';
  const p=getActors()[state.controlled];
  $('unitPrimary').textContent=returnKick(state.kind)&&state.kicking==='away'?'JUKE':'TACKLE';
  $('unitSecondary').textContent=returnKick(state.kind)&&state.kicking==='away'?'SPRINT':'HIT STICK';
  $('unitSwitch').hidden=true;
  $('unitStatus').textContent=goalKick(state.kind)?`${state.kind==='extra-point'?'EXTRA POINT':'FIELD GOAL'} · ${kick?'AIM BETWEEN THE UPRIGHTS':'WATCH THE KICK'}`:state.kind==='defense'?`${call.name} · ${pre?'Tap a defender · Snap in '+Math.max(0,Math.ceil(state.readyAt-state.time))+'s':p.lastName+' · '+state.stage.toUpperCase()}`:state.kicking==='away'?(state.kind==='punt'?'PUNT RETURN · RETURN OR FAIR CATCH':'KICK RETURN · STEER YOUR RETURNER'):state.kind==='punt'?'PUNT · KICK, THEN COVER THE RETURN':'KICKOFF · KICK, THEN COVER THE RETURN';
 }
 function finish(result){if(!state||state.stage==='end')return;state.result={...result,...(state.kind==='punt'?{kind:'punt',kicking:state.kicking}:{}),seconds:state.liveTime,pass:state.pass,runner:state.carrier,simNext:state.simNext};state.stage='end';state.flight=null;getActors().forEach(p=>{p.vx=p.vz=0;p.moving=false;p.engaged=false});$('unitResult').querySelector('h2').textContent=result.reason;refresh();}
 // Keep contact alive long enough for the shared wrap/hit pose to reach the turf.
 function beginTackle(tackler,runner,hit,result){
  const impact=contactImpact(runner,tackler),heading=Math.atan2(impact.x,impact.z),travel=clamp(Math.hypot(runner.vx,runner.vz)*.09+impact.energy*.22,.15,hit?.9:.65);
  state.contact={started:state.time,duration:hit?.8:1.15,runner:runner.index,tackler:tackler.index,x:runner.x,z:runner.z,dx:Math.sin(heading)*travel,dz:Math.cos(heading)*travel,result};
  state.stage='contact';state.flight=null;runner.hasBall=true;runner.qbPocket=false;
  for(const [p,other,role]of[[runner,tackler,'carrier'],[tackler,runner,'tackler']]){p.engaged=false;p.fallen=true;p.action=hit?'big-hit':'wrap';p.actionT=.001;p.contactWith=other.index;p.contactRole=role;p.contactVariant=hit?'shoulder-hit':impact.variant;p.actionSide=role==='carrier'?-impact.side:impact.side;p.fallHeading=heading;p.vx=p.vz=0;}
  state.contact.offset={x:tackler.x-runner.x,z:tackler.z-runner.z};runner.fallHeading=tackler.fallHeading=heading;refresh();
 }
 function tackleFrame(dt){
  const c=state.contact,a=getActors(),t=clamp((state.time-c.started)/c.duration,0,1),ease=1-(1-t)**3;
  for(const p of a){p.vx*=Math.exp(-dt*9);p.vz*=Math.exp(-dt*9);p.moving=false;p.engaged=false;}
  const runner=a[c.runner],tackler=a[c.tackler];runner.x=c.x+c.dx*ease;runner.z=c.z+c.dz*ease;const side=Math.sign(c.offset.x*Math.cos(runner.fallHeading)-c.offset.z*Math.sin(runner.fallHeading))||1,separate=.62+.28*ease,close=clamp(t/.3,0,1),dx=Math.cos(runner.fallHeading)*side*separate-Math.sin(runner.fallHeading)*.32,dz=-Math.sin(runner.fallHeading)*side*separate-Math.cos(runner.fallHeading)*.32;tackler.x=runner.x+c.offset.x+(dx-c.offset.x)*close;tackler.z=runner.z+c.offset.z+(dz-c.offset.z)*close;
  runner.actionT=tackler.actionT=Math.max(.001,t);
  if(state.time-c.started>=c.duration+.12)finish(c.result);
 }
 // An established pair advances as a contact, with planted feet and bounded push.
 function engageBlock(blocker,rusher,dt,run=false){
  if(!blocker.unitBlock||blocker.unitBlock.target!==rusher.index||state.time-blocker.unitBlock.at>.1){
   const length=distance(blocker,rusher)||1;
   blocker.unitBlock={target:rusher.index,started:state.time,x:(blocker.x+rusher.x)/2,z:(blocker.z+rusher.z)/2,nx:(rusher.x-blocker.x)/length,nz:(rusher.z-blocker.z)/length};
  }
  const pair=blocker.unitBlock;pair.at=state.time;
  const settle=clamp((state.time-pair.started)/.18,0,1),advantage=(blocker.ratings.block-rusher.ratings.blockShed)/100;
  const push=clamp((run?.28:-.10)+advantage*.8,-.45,.55)*settle;
  pair.x+=pair.nx*push*dt;pair.z+=pair.nz*push*dt;
  for(const [p,sign,style]of[[blocker,-1,run?'stalk':'pass-anchor'],[rusher,1,'bull-rush']]){
   const x=pair.x+pair.nx*.48*sign,z=pair.z+pair.nz*.48*sign;
   p.vx=pair.nx*push;p.vz=pair.nz*push;p.x+=(x-p.x)*Math.min(1,dt*20);p.z+=(z-p.z)*Math.min(1,dt*20);p.distance+=Math.abs(push)*dt;p.moving=Math.abs(push)>.1;p.engaged=true;p.engagedWith=sign<0?rusher.index:blocker.index;p.blockStyle=style;p.heading=Math.atan2(pair.nx,pair.nz)+(sign>0?Math.PI:0);
  }
 }
 function tackle(hit=false){if(!state||state.time<state.cooldown||!['run','pass'].includes(state.stage))return;const a=getActors(),p=a[state.controlled],runner=a[state.carrier];state.cooldown=state.time+(hit?1.2:.6);if(distance(p,runner)>(hit?2:1.65)){p.action='dive';p.actionT=.1;p.fallen=hit;state.recoverPlayer=p.index;state.recover=state.time+.75;return;}
  const good=random()<defensiveTackleChance(p,runner,hit);p.action=hit?'big-hit':'wrap';p.actionT=.3;
  if(good){const fumble=hit&&random()<.06+(p.ratings.tackle-runner.ratings.carrying)*.001;beginTackle(p,runner,hit,{reason:fumble?'FUMBLE RECOVERED':state.stage==='pass'?'SACK':hit?'BIG HIT':'TACKLED',gain:Math.round(runner.z-state.snapZ),ball:clamp(Math.round(runner.z-10),0,100),interception:fumble,sack:state.stage==='pass'});}
  else {p.fallen=true;state.recoverPlayer=p.index;state.recover=state.time+1;onStatus?.('MISSED TACKLE');}
 }
 function action(kind){if(!state||paused||goalKick(state.kind)||state.book||state.stage==='end'||state.stage==='pre'||state.stage==='contact')return;
  if(state.stage==='flight'){state.action=kind==='primary'?'swat':'intercept';state.actionUntil=state.time+.65;const p=getActors()[state.controlled];p.catchT=.15;p.catchStyle=kind==='primary'?'rac':'aggressive';return;}
  if(returnKick(state.kind)&&state.kicking==='away'){if(kind==='primary'){const p=getActors()[state.controlled];p.action='juke';p.actionT=.3;p.x=clamp(p.x+(inputVector()[0]<0?-1.2:1.2),-26,26);state.jukeUntil=state.time+.4;}state.burst=state.time+(kind==='primary'?.4:1.2);return;}
  const p=getActors()[state.controlled];
  if(kind==='primary'&&p.index<15&&state.stage==='pass'&&p.engaged){p.engaged=false;state.shedUntil=state.time+.65;p.x+=p.x<0?-1.1:1.1;onStatus?.('BLOCK SHED');return;}
  tackle(kind==='secondary');
 }
 $('unitSwitch').onclick=switchPlayer;$('unitPrimary').onclick=()=>action('primary');$('unitSecondary').onclick=()=>action('secondary');
 $('unitBook').onclick=()=>{state.book=true;refresh()};$('unitArt').onclick=()=>{art=!art;adjustments.hidden=true;adjustButton.setAttribute('aria-expanded','false');refresh()};
 $('unitPress').onclick=()=>{press=press===-3?0:-3;align();refresh()};$('unitBack').onclick=()=>{press=press===5?0:5;align();refresh()};$('unitShift').onclick=()=>{shift=shift===0?-2:shift===-2?2:0;align();refresh()};
 $('unitReady').onclick=()=>{state.stage='snap';state.startedAt=state.time;state.pass=random()<(state.clock<65&&state.deficit>0?.85:state.toGo>7?.76:state.clock<90&&state.deficit<0?.25:.43);state.hot=call.blitz.length>0&&random()<clamp((getActors()[5].ratings.awareness||75)/100,.5,.95);state.passAt=(config.level.id==='rookie'?2.2:config.level.id==='all-pro'?1.3:1.7)+random()*1.1;getActors()[2].hasBall=false;getActors()[2].action='snap';getActors()[5].action='receive-snap';refresh()};
 $('unitSimBook').onclick=()=>{stop();onSimulate()};$('unitSim').onclick=()=>{if(state.stage==='pre'){stop();onSimulate()}else{state.simNext=!state.simNext;refresh()}};
 $('unitFairCatch').onclick=()=>{if(state?.kind==='punt'&&state.kicking==='away'&&['kick','punt-snap','kick-flight'].includes(state.stage)){state.fairCatch=true;refresh();}};
 $('unitKickButton').onclick=()=>kick();$('unitTouchback').onclick=()=>{if(state?.kind==='kickoff'&&state.kicking==='away'&&state.stage==='kick')finish({reason:'TOUCHBACK · OWN 25',ball:25,seconds:0});};
 $('unitContinue').onclick=()=>{if(state?.stage!=='end')return;const result=state.result;stop();onResult(result)};
 function kick(){
  if(!state||paused||state.stage!=='kick')return;
  if(state.kicking==='home'&&!state.timing){state.timing=true;state.meterTime=0;refresh();return;}
  const a=getActors(),goal=goalKick(state.kind),power=state.kicking==='home'?state.power:.78,aim=state.kicking==='home'?state.aim:{x:(random()-.5)*20,y:5.5,z:14};
  if(state.kind==='punt'){
   const error=power<.65?power-.65:power>.9?power-.9:0;
   const to=[clamp(state.aim.x+error*20,-29,29),1.2,state.aim.z+Math.max(0,.75-power)*35-Math.max(0,power-.9)*10];
   state.pendingFlight={from:[0,.8,state.puntZ],to,t:0,duration:3.4,arc:18,target:6};state.stage='punt-snap';state.kickStarted=state.time;state.stagedBall=[0,.45,state.puntLine];a[17].action='snap';resetAimInput();refresh();return;
  }
  const error=(power<.65?power-.65:power>.9?power-.9:0),rating=config.matchup.home.kicker.overall;
  const x=aim.x+error*(goal?18:24)*(1+(90-rating)*.01);
  const to=goal?[x,Math.max(.2,aim.y-Math.max(0,.65-power)*16),117]:[clamp(x,-26,26),1.4,clamp(aim.z+(.78-power)*18,7,42)];
  if(goal){state.good=Math.abs(to[0])<3.0&&to[1]>3.3;state.miss=to[1]<=3.3?'SHORT / LOW':to[0]<0?'WIDE RIGHT':'WIDE LEFT';}
  state.stagedBall=null;a[15].action=null;a[16].hasBall=false;a[16].action='kick';a[16].actionT=.1;
  if(goal){a[16].action=null;a[15].action='hold-kick';a[17].action='snap';state.kickStarted=state.time;state.stagedBall=[0,.45,state.snapZ];}
  state.stage=goal?'kick-snap':'kick-flight';state.flight={from:[0,.3,goal?state.kickZ:75],to,t:0,duration:goal?1.8:3.5,arc:goal?7:17,target:6};state.controlled=state.kicking==='away'?6:16;if(goal){state.pendingFlight=state.flight;state.flight=null;}resetAimInput();refresh();
 }
 function move(p,x,z,dt,max=speed(p),smooth=true){const dx=x-p.x,dz=z-p.z,len=Math.hypot(dx,dz)||1;let vx=dx/len*Math.min(max,len/dt),vz=dz/len*Math.min(max,len/dt);if(smooth){const f=Math.min(1,dt*8);vx=p.vx+(vx-p.vx)*f;vz=p.vz+(vz-p.vz)*f}p.x=clamp(p.x+vx*dt,-27,27);p.z+=vz*dt;p.vx=vx;p.vz=vz;p.moving=Math.hypot(vx,vz)>.1;p.distance+=Math.hypot(vx,vz)*dt;if(p.moving){const aim=Math.atan2(vx,vz);p.heading+=Math.atan2(Math.sin(aim-p.heading),Math.cos(aim-p.heading))*(1-Math.exp(-dt*12));}p.sprinting=max>speed(p)*.9;}
 // Each rusher seeks the kick point; nearby protectors meet and hold their lane.
 function kickLines(dt){
  const a=getActors(),blockers=[11,12,13,14,17,18,19,20,21].map(i=>a[i]);
  // Fan out from the kick point: protect both edges before doubling inside.
  const available=new Set(blockers),protection=state.kickProtection||new Map();
  const threats=a.slice(0,11).filter(p=>!p.fallen&&!p.kickShed&&![3,7].includes(p.index)).sort((p,q)=>{const edge=p=>p.index===0||p.index===10;return Number(edge(q))-Number(edge(p))||distance(p,{x:0,z:state.kickZ})-distance(q,{x:0,z:state.kickZ});});
  if(!state.kickProtection)for(const rusher of threats){let nearest=null;for(const b of available)if(!nearest||distance(b,rusher)<distance(nearest,rusher))nearest=b;if(nearest){protection.set(rusher.index,nearest);available.delete(nearest);}}
  state.kickProtection=protection;
  for(const p of a){p.engaged=false;p.engagedWith=null;}
  for(const rusher of a.slice(0,11)){
   if(rusher.fallen)continue;
   // Two second-level defenders cover a fake; nine rushers attack nine protectors.
   if([3,7].includes(rusher.index)){move(rusher,rusher.startX,state.snapZ+2,dt,3);continue;}
   const protector=protection.get(rusher.index);
   const edge=rusher.index===0||rusher.index===10;
   move(rusher,edge&&rusher.z>state.snapZ-2?Math.sign(rusher.startX)*6.5:0,state.kickZ,dt,speed(rusher)*.8);
   if(protector){
    move(protector,rusher.x,Math.max(state.kickZ+1.8,rusher.z-.8),dt,4.5);
    if(distance(protector,rusher)<1.25){
     if(!rusher.kickShed)engageBlock(protector,rusher,dt);
     // Rating advantage can produce a real penetration, never an automatic score roll.
     if(!rusher.kickShed&&random()<dt*clamp(.04+(rusher.ratings.blockShed-protector.ratings.block)*.006,.01,.28))rusher.kickShed=true;
     if(rusher.kickShed){rusher.x+=Math.sign(rusher.x||1)*dt*2;protector.z+=dt*.45;}
     else{rusher.vz=protector.vz;}
    }
   }
   if(state.stage==='kick-flight'&&state.flight?.t<.32){
    const f=state.flight,t=f.t,ball={x:f.from[0]+(f.to[0]-f.from[0])*t,z:f.from[2]+(f.to[2]-f.from[2])*t},height=f.from[1]+(f.to[1]-f.from[1])*t+Math.sin(t*Math.PI)*f.arc;
    if(distance(rusher,ball)<1.6){rusher.catchT=.3;rusher.catchStyle='aggressive';if(height<2.8){state.good=false;state.miss='BLOCKED';finish({reason:(state.kind==='extra-point'?'EXTRA POINT':'FIELD GOAL')+' BLOCKED',good:false,blocked:true,kind:state.kind});return;}}
   }
  }
 }
 function controlled(dt){const p=getActors()[state.controlled];if(p.fallen)return;const v=inputVector();move(p,p.x+v[0]*10,p.z+v[1]*10,dt,speed(p)*(state.burst>state.time?1:.9)*Math.min(1,Math.hypot(...v)));if(state.stage==='pre')p.z=Math.max(state.snapZ+.5,p.z);}
 function tick(dt){if(!state||paused)return;if(state.stage==='end'){const result=state.result;stop();onResult(result);return;}state.time+=dt;const a=getActors();a[5].qbPocket=state.kind==='defense'&&['snap','pass'].includes(state.stage);for(const p of a){if(p.catchT>0)p.catchT=Math.max(0,p.catchT-dt);if(['kick','juke'].includes(p.action)&&!(p.action==='kick'&&state.stage==='kick-snap')){p.actionT=Math.min(1,(p.actionT||0)+dt*1.8);if(p.actionT>=1)p.action=null;}}
  if(state.recover&&state.time>=state.recover){a[state.recoverPlayer??state.controlled].fallen=false;a[state.recoverPlayer??state.controlled].action=null;state.recover=0;}
  if(state.stage==='contact'){tackleFrame(dt);return;}if(state.book)return;if(state.stage==='kick'){if(state.kicking==='home')adjustAim(...aimInput,dt);if(state.timing){state.meterTime+=dt;state.power=.5-.5*Math.cos(state.meterTime*2.8);}else state.power=0;$('kickPower').style.left=(state.power*100)+'%';return;}
  if(state.stage==='pre'){controlled(dt);refresh();if(state.time>=state.readyAt)$('unitReady').onclick();return;}
  if(state.kind==='defense'||state.kind==='punt'||state.kind==='kickoff'&&state.stage==='run')state.liveTime+=dt;state.clock=Math.max(0,state.clock-dt);
  if(state.stage==='snap'){const t=clamp((state.time-state.startedAt)/.3,0,1);state.stagedBall=[0,.45+t*.9,state.snapZ-5*t];if(t>=1){state.stagedBall=null;a[2].action=null;a[5].action=null;state.stage=state.pass?'pass':'handoff';state.carrier=5;a[5].hasBall=true;state.snapTime=state.time;refresh()}return;}
  if(state.stage==='punt-snap'){
   const t=state.time-state.kickStarted;state.stagedBall=[0,t<.45?.45+Math.sin(t/.45*Math.PI)*.7:1,state.puntLine+(state.puntZ-state.puntLine)*clamp(t/.45,0,1)];
   for(let i=0;i<5;i++){move(a[i],a[16].x,a[16].z,dt,speed(a[i])*.8);const blocker=a[[11,12,13,14,18][i]];move(blocker,a[i].x,a[i].z+.7,dt,4);if(distance(blocker,a[i])<1.5)engageBlock(blocker,a[i],dt);}
   a[16].action=t<.45?'receive-snap':'kick';a[16].actionT=clamp((t-.45)/.6,.01,.55);
   if(a.slice(0,5).some(p=>distance(p,a[16])<1.1)){finish({reason:'PUNT BLOCKED · RECOVERED',ball:clamp(state.puntZ-10,1,99),blocked:true,touchdown:state.puntZ>=110});return;}
   if(t>.95){state.stagedBall=null;a[17].action=null;state.flight=state.pendingFlight;state.pendingFlight=null;state.stage='kick-flight';refresh();}return;
  }
  if(state.stage==='kick-snap'){
   const t=state.time-state.kickStarted;kickLines(dt);
   state.stagedBall=[0,t<.35?.45+Math.sin(t/.35*Math.PI)*.45:.25,state.snapZ+(state.kickZ-state.snapZ)*clamp(t/.35,0,1)];
   move(a[16],.19,state.kickZ-.52,dt,3.7,false);a[16].heading=0;if(t>=.55){a[16].action='kick';a[16].actionT=clamp((t-.55)/.6,0,.5);}a[15].ballTarget=t>=.35?[0,.25,state.kickZ]:null;if(t>=.35)a[17].action=null;
   if(t>=.85){a[17].action=null;a[16].action='kick';a[16].actionT=.5;a[15].ballTarget=null;state.stagedBall=null;state.flight=state.pendingFlight;state.pendingFlight=null;state.stage='kick-flight';refresh();}return;
  }
  if(state.stage==='kick-flight'){
   const f=state.flight;f.t+=dt/f.duration;if(goalKick(state.kind)){kickLines(dt);if(state.stage==='end')return;if(f.t>=1)finish({reason:`${state.kind==='extra-point'?'EXTRA POINT':'FIELD GOAL'} ${state.good?'GOOD':'MISSED · '+state.miss}`,good:state.good,kind:state.kind});return;}move(a[6],f.to[0],f.to[2],dt,speed(a[6]));for(let i=11;i<22;i++)if(i!==state.controlled)move(a[i],a[6].x+(i-16)*2,a[6].z+12,dt,speed(a[i])*.85);if(state.kicking==='home')controlled(dt);
   if(f.t>=1){
    if(state.kind==='punt'){
     const spot=f.to[2]-10,coverage=Math.min(...a.slice(11).map(p=>Math.hypot(p.x-f.to[0],p.z-f.to[2])));
     if(spot<=0){finish({reason:'PUNT · TOUCHBACK · OWN 20',ball:20});return;}
     if(Math.abs(f.to[0])>26.4){finish({reason:'PUNT OUT OF BOUNDS',ball:clamp(spot,1,99),out:true});return;}
     if(state.fairCatch||state.kicking==='home'&&coverage<6){finish({reason:'PUNT · FAIR CATCH',ball:clamp(spot,1,99),fairCatch:true});return;}
    }
    state.stage='run';state.flight=null;state.carrier=6;a[6].x=f.to[0];a[6].z=f.to[2];a[6].hasBall=true;if(a[6].z<=10){finish({reason:'TOUCHBACK · OWN 25',ball:25});return;}if(state.kicking==='home')autoSelect(a[6]);refresh()}return;
  }
  if(state.stage==='handoff'){const t=state.time-state.snapTime;move(a[6],a[5].x,a[5].z-.6,dt,5);a[5].action='handoff';a[5].actionT=clamp(t/.6,0,1);a[6].action='receive-handoff';a[6].actionT=clamp(t/.6,0,1);if(t>.6){a[5].action=null;a[6].action=null;a[5].hasBall=false;a[6].hasBall=true;state.carrier=6;state.stage='run';autoSelect(a[6]);refresh()}}
  for(const p of a){p.engaged=false;p.engagedWith=null;}
  const offense=a.slice(0,11),defense=a.slice(11),runner=a[state.carrier];
  if(state.stage==='pass'||state.stage==='flight'){
   [7,8,9,10,6].forEach((id,i)=>{const p=a[id],pt=pathPoint(state.hot&&id===6?[[0,0],[6,1],[12,4]]:state.hot&&id===10?[[0,0],[0,4],[-6,6]]:state.route.routes[i],Math.max(0,state.time-state.snapTime)*speed(p)*.72);const f=state.stage==='flight'&&!state.throwAway&&state.flight?.target===id?state.flight:null;move(p,f?f.to[0]:p.startX+pt[0],f?f.to[2]:p.startZ+pt[1],dt,speed(p)*.8);p.lookTarget=null;p.ballTarget=null;p.receiving=false;if(f){const t=clamp(f.t,0,1),ball=f.from.map((v,k)=>v+(f.to[k]-v)*t);ball[1]+=Math.sin(Math.PI*t)*f.arc;p.lookTarget=ball;if((1-t)*f.duration<.22&&Math.hypot(ball[0]-p.x,ball[2]-p.z)<1.6&&ball[1]<2.7){p.receiving=true;p.ballTarget=ball;}}});
   for(const p of defense){if(p.index===state.controlled||p.fallen)continue;const assignment=defenseAssignment(call,p.index-11,state.snapZ,a);const target=state.stage==='flight'&&state.time-state.releaseAt>.22+(100-p.ratings.awareness)*.006?a[state.target]:assignment;move(p,target.x,target.z,dt,speed(p)*(assignment.type==='rush'?.85:.82));}
   for(let i=0;i<5;i++){const block=offense[i],def=defense[i];move(block,def.x,Math.max(state.snapZ-2,def.z-.8),dt,4);if(distance(block,def)<1.3&&state.shedUntil<state.time){if((def.unitShedUntil||0)<state.time){engageBlock(block,def,dt);if(state.time-block.unitBlock.started>.65&&random()<dt*clamp(.20+(def.ratings.blockShed-block.ratings.block)*.008,.05,.65))def.unitShedUntil=state.time+.7;}else{def.engaged=false;move(def,def.x+Math.sign(def.x||1)*1.2,def.z-1,dt,3);block.unitBlock=null;}}}
   if(state.stage==='pass'){
    const read=cpuRead(a,{snapZ:state.snapZ,elapsed:state.time-state.snapTime,toGo:state.toGo,level:config.level.id,clock:state.clock,deficit:state.deficit});state.read=read.action;state.pressure=read.pressure;
    const sacker=defense.find(p=>p.index!==state.controlled&&!p.fallen&&!p.engaged&&distance(p,a[5])<1);if(sacker){beginTackle(sacker,a[5],false,{reason:'SACK',gain:Math.round(a[5].z-state.snapZ),sack:true});return;}
    if(!state.windup){
     if(read.action==='throw'){state.target=read.target;state.windup=state.time;state.quickRelease=read.quick;}
     else if(read.action==='away'){state.throwAway=true;state.target=6;state.windup=state.time;}
     else if(read.action==='escape'){move(a[5],clamp(a[5].x+read.side*5,-23,23),a[5].z+2,dt,speed(a[5])*.9);if(a[5].z>state.snapZ+.2){state.stage='run';state.pass=false;state.scramble=true;a[5].qbPocket=false;refresh();}}
    }
    if(state.windup){a[5].throwDuration=state.quickRelease?.43:.56;a[5].throwT=clamp((state.time-state.windup)/a[5].throwDuration,.01,1);a[5].throwStyle='bullet';const facing=a[state.target];if(facing){const aim=Math.atan2(facing.x-a[5].x,facing.z-a[5].z);a[5].heading+=Math.atan2(Math.sin(aim-a[5].heading),Math.cos(aim-a[5].heading))*Math.min(1,dt*18);}if(a[5].throwT>=QB_THROW_RELEASE){const target=a[state.target],duration=.35+Math.abs(target.z-a[5].z)*.016;state.flight={from:[a[5].x,1.8,a[5].z],to:state.throwAway?[Math.sign(a[5].x||1)*30,1,state.snapZ+3]:[clamp(target.x+target.vx*duration,-26,26),1.6,clamp(target.z+target.vz*duration,10,112)],t:0,duration,arc:state.quickRelease?1.3:3,target:state.target};a[5].hasBall=false;state.stage='flight';state.releaseAt=state.time;if(!state.throwAway)autoSelect({x:state.flight.to[0],z:state.flight.to[2]});state.switched=true;refresh();}}
   }else{
    const followThrough=(state.time-state.windup)/(a[5].throwDuration||.56);a[5].throwT=followThrough<1?followThrough:0;const f=state.flight;f.t+=dt/f.duration;
    if(f.t>=1){if(state.throwAway){finish({reason:'QB THROWS IT AWAY',incomplete:true,gain:0});return;}const target=a[f.target],p=a[state.controlled],at={x:f.to[0],z:f.to[2]},nearest=defense.filter(d=>!d.fallen).sort((x,y)=>distance(x,at)-distance(y,at))[0];const userClose=!p.fallen&&distance(p,at)<2.4,active=state.actionUntil>=state.time;
     if(userClose&&active&&state.action==='swat'){finish({reason:'PASS SWATTED',incomplete:true,gain:0});return;}
     const userPick=userClose&&active&&state.action==='intercept'&&random()<clamp(.4+p.ratings.catch*.004,.4,.82);
     const aiPick=nearest&&nearest.index!==state.controlled&&distance(nearest,at)<1.15&&random()<.22;
     if(userPick||aiPick){finish({reason:'INTERCEPTED',interception:true,gain:Math.round(at.z-state.snapZ)});return;}
     if(distance(target,at)>1.8||random()<clamp(.04+(90-a[5].ratings.throw)*.003+(nearest&&distance(nearest,at)<1.5?.3:0),.02,.5)){finish({reason:'INCOMPLETE',incomplete:true,gain:0});return;}
     target.hasBall=true;target.receiving=false;target.ballTarget=null;target.lookTarget=null;target.catchT=.45;target.catchStyle='rac';state.carrier=target.index;state.stage='run';state.flight=null;autoSelect(target);refresh();
    }
   }
  }
  if(state.stage==='run'){
   const runner=a[state.carrier],manual=returnKick(state.kind)&&state.kicking==='away';
   if(!manual&&Math.hypot(...inputVector())<.12&&state.time-(state.manualSelectionAt??-10)>.8){const nearest=nearestDefender(a,runner),current=a[state.controlled];if(current.fallen||distance(current,runner)>10&&distance(a[nearest],runner)+6<distance(current,runner))autoSelect(runner);}
   if(!manual){const nearest=defense.filter(p=>!p.fallen).sort((x,y)=>distance(x,runner)-distance(y,runner))[0];const avoid=nearest&&distance(nearest,runner)<4?(runner.x<nearest.x?-1:1)*3:0;move(runner,clamp(runner.x+avoid,-24,24),runner.z+12,dt,speed(runner)*.92);}
   for(const p of defense){p.engaged=false;if(p.index===state.controlled||p.fallen)continue;const aim=pursuitRead(p,runner,interceptPoint(p,runner,speed(p)*.98),state.time);move(p,aim.x,aim.z,dt,speed(p)*.98);if(distance(p,runner)<1&&state.time>(state.contactGrace||0)){if(random()<defensiveTackleChance(p,runner)-(state.jukeUntil>state.time?.35:0)){beginTackle(p,runner,false,{reason:'TACKLED',gain:Math.round(runner.z-state.snapZ),ball:clamp(Math.round(runner.z-10),0,100)});return;}state.contactGrace=state.time+.6;p.x+=p.x<runner.x?-1:1;}}
   for(const p of offense){if(p===runner)continue;const target=defense.filter(d=>!d.fallen&&!d.engaged).sort((x,y)=>distance(x,p)-distance(y,p))[0];if(target){move(p,target.x,target.z-.8,dt,speed(p)*.75);if(distance(p,target)<1.2&&target.index!==state.controlled){engageBlock(p,target,dt,true);}}}
   if(runner.z>=110){finish({reason:'TOUCHDOWN',gain:100-state.ball,ball:100,touchdown:true});return;}
   if(runner.z<=10||Math.abs(runner.x)>=26.4){finish({reason:runner.z<=10?'SAFETY':'OUT OF BOUNDS',safety:runner.z<=10,gain:Math.round(runner.z-state.snapZ),ball:clamp(Math.round(runner.z-10),0,100),out:true});return;}
  }
  controlled(dt);
  if(state.liveTime>25)finish({reason:'WHISTLE',gain:Math.round(a[state.carrier].z-state.snapZ),ball:clamp(Math.round(a[state.carrier].z-10),0,100)});
 }
 function view(){
  if(!state)return null;const a=getActors();
  // Goal kicks never use the reverse-facing defense camera or chase the landing point.
  if(goalKick(state.kind)){const t=state.flight?clamp((state.flight.t-.18)/.7,0,1):state.stage==='end'&&!state.result?.blocked?1:0,e=t*t*(3-2*t);return {eye:[-1.8+1.2*e,4.8+1.2*e,state.kickZ-11.5+4.5*e],target:[-1.8*(1-e),2.0+2.6*e,state.kickZ+14+(103-state.kickZ)*e],fov:46-4*e};}
  const defending=state.kind==='defense'||state.kicking==='home';
  if(state.kind==='punt'&&['kick','punt-snap'].includes(state.stage))return defending?{eye:[0,6,Math.min(128,state.puntZ+12)],target:[0,1.2,state.puntZ-6],fov:48}:{eye:[0,5.8,Math.max(2,a[6].z-10)],target:[0,1.5,a[6].z+12],fov:48};
  if(state.stage==='kick')return defending?{eye:[0,5.8,85],target:[0,1.4,61],fov:48}:{eye:[0,5.8,7],target:[0,1.5,30],fov:48};
  const selected=a[state.controlled],f=state.flight,t=f?clamp(f.t,0,1):0;
  const ball=f?f.from.map((v,i)=>v+(f.to[i]-v)*t+(i===1?Math.sin(Math.PI*t)*f.arc:0)):[a[state.carrier].x,1.3,a[state.carrier].z];
  if(returnKick(state.kind)){
   // Returners retain one shot through the catch. On kick coverage the
   // selected defender stays in view, looking toward the returner; fitting
   // both ends of a 60-yard kick would make every athlete miniature.
   if(state.kicking==='away')return referenceCarryFrame(a[6]);
   const focus=state.stage==='contact'?a[6]:selected;
   return {eye:[focus.x,4.8,focus.z+6.6],target:[focus.x,.9,focus.z-2.4],fov:56};
  }
  if(state.kind==='defense'&&(state.book||['pre','snap','handoff','pass'].includes(state.stage))){
   const qb=a[5],view=referencePocketFrame(qb,state.snapZ,getAspect(),qb.z,17,state.book);
   // Pan toward a selected edge defender without changing the camera distance.
   const shift=clamp((selected.x-qb.x)*.35,-5,5);view.eye[0]+=shift;view.target[0]+=shift;return view;
  }
  const focus=f?{x:ball[0],z:ball[2]}:a[state.carrier];
  return referenceCarryFrame(focus);
 }
 function aimTarget(){return state?.stage==='kick'&&state.kicking==='home'?{point:goalKick(state.kind)?[state.aim.x,state.aim.y,117]:[state.aim.x,.08,state.aim.z],vertical:goalKick(state.kind)}:null;}
 function stop(){root.hidden=true;document.body.classList.remove('playing-unit','unit-no-movement');resetAimInput();state=null;}
 return {start,tick,stop,view,aimTarget,refresh,action,switchPlayer,selectPlayer,canSelect,get state(){return state},setPaused(value){paused=value;resetAimInput();root.hidden=value||!state},get art(){return state?.kind==='defense'&&state.stage==='pre'&&art?getActors().slice(11).map(p=>({from:p,to:defenseAssignment(call,p.index-11,state.snapZ,getActors())})):[]}};
}
