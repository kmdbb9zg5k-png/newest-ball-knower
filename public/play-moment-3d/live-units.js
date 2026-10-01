import {DEFENSE_PLAYS,DEFENSE_FORMATIONS,defenseAlignment,defenseAssignment,nearestDefender,defensiveTackleChance,defensiveDiagram} from './defense-playbook.js?v=complete-game-1';
import {PASSES} from './playbook.js?v=football-foundation-44';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const goalKick=kind=>kind==='extra-point'||kind==='field-goal';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const speed=p=>5.2+6*(clamp(p.ratings.speed,35,99)-35)/64;
const pathPoint=(path,d)=>{for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d<=l){const t=d/(l||1);return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]}d-=l}return path.at(-1)};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** On-field defense and kick returns. Actors/rendering are shared with offense. */
export function createLiveUnits({config, getActors, inputVector, onResult, onSimulate, onStatus, random=Math.random}) {
 let aimPointer=null,aimInput=[0,0];
 let state=null, call=DEFENSE_PLAYS[0],formation='4–3', art=false,press=0,shift=0,paused=false;
 const root=document.createElement('section');root.id='liveUnits';root.hidden=true;
 root.innerHTML='<section id="defenseBook" aria-label="Defensive playbook"><div class="unit-book-heading"><div><span class="eyebrow">DEFENSIVE PLAYBOOK</span><h2>CALL YOUR DEFENSE</h2></div><button id="unitSimBook">SIMULATE THIS PLAY</button></div><div id="defenseFormations" role="group" aria-label="Defensive formations"></div><div id="defenseCalls"></div></section><div id="unitTop"><span id="unitStatus" role="status"></span><button id="unitSim">SIMULATE NEXT PLAY</button></div><div id="unitPre"><button id="unitBook">PLAYBOOK</button><button id="unitArt" aria-pressed="false">SHOW PLAY</button><button id="unitPress">PRESS</button><button id="unitBack">BACK OFF</button><button id="unitShift">SHIFT LINE</button><button id="unitReady">READY</button></div><div id="unitPad"><button id="unitSwitch">SWITCH</button><button id="unitPrimary">TACKLE</button><button id="unitSecondary">HIT STICK</button></div><div id="unitKick"><div id="kickGuide"><span id="kickHelp">MOVE STICK TO AIM</span><div class="kick-meter"><span class="kick-zone"></span><i id="kickPower"></i></div></div><button id="unitKickButton">KICK</button><button id="unitTouchback">TAKE TOUCHBACK</button></div><div id="kickAimPad"><span>AIM KICK</span><div id="kickAimStick" role="slider" tabindex="0" aria-label="Aim kick. Arrow keys move target." aria-valuemin="-24" aria-valuemax="24" aria-valuenow="0"><i id="kickAimKnob"></i></div></div><div id="unitResult" role="status"><h2></h2><button id="unitContinue">CONTINUE →</button></div>';
 document.getElementById('hud').after(root);
 const $=id=>root.querySelector('#'+id);
 const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;return b};
 function renderBook(){
  $('defenseFormations').replaceChildren(...DEFENSE_FORMATIONS.map(f=>{const b=button(f,()=>{formation=f;renderBook()});b.setAttribute('aria-pressed',String(f===formation));return b}));
  $('defenseCalls').replaceChildren(...DEFENSE_PLAYS.filter(p=>p.formation===formation).map(p=>{const b=button('',()=>{call=p;state.book=false;align();refresh()});b.innerHTML=defensiveDiagram(p)+`<strong>${escape(p.name)}</strong><span>${p.coverage==='man'?'MAN COVERAGE':'ZONE COVERAGE'}${p.blitz.length?' · BLITZ':''}</span>`;return b}));
 }
 function align(){const a=getActors();for(let i=11;i<22;i++){const[x,z]=defenseAlignment(call,i-11,press,shift);a[i].x=a[i].startX=x;a[i].z=a[i].startZ=state.snapZ+z;a[i].heading=Math.PI;}}
 function control(index){if(!canSelect(index))return false;state.controlled=index;state.switchUntil=state.time+.24;onStatus?.('CONTROL · '+getActors()[index].lastName);return true;}
 function canSelect(index){return Boolean(state&&!paused&&!state.book&&!goalKick(state.kind)&&!['kick','end'].includes(state.stage)&&index>=11&&index<22&&!getActors()[index].fallen&&!(state.kind==='kickoff'&&state.kicking==='away'));}
 function selectPlayer(index){const selected=control(index);if(selected)refresh();return selected;}
 function switchPlayer(){if(!state)return;const a=getActors(),target=state.flight?a[state.flight.target]:a[state.carrier];selectPlayer(nearestDefender(a,target,state.controlled));}
 function resetAimInput(){aimPointer=null;aimInput=[0,0];$('kickAimKnob').style.transform='none';}
 function steerAim(e){const rect=$('kickAimStick').getBoundingClientRect(),radius=rect.width*.35;let x=(e.clientX-rect.left-rect.width/2)/radius,y=(e.clientY-rect.top-rect.height/2)/radius;const length=Math.max(1,Math.hypot(x,y));aimInput=[x/length,-y/length];$('kickAimKnob').style.transform=`translate(${x/length*radius}px,${y/length*radius}px)`;}
 $('kickAimStick').onpointerdown=e=>{if(!state||paused||state.stage!=='kick'||state.kicking!=='home'||aimPointer!==null)return;aimPointer=e.pointerId;$('kickAimStick').setPointerCapture(e.pointerId);steerAim(e);e.preventDefault();};
 $('kickAimStick').onpointermove=e=>{if(e.pointerId!==aimPointer)return;steerAim(e);e.preventDefault();};
 for(const event of ['pointerup','pointercancel','lostpointercapture'])$('kickAimStick').addEventListener(event,e=>{if(e.pointerId===aimPointer)resetAimInput();});
 $('kickAimStick').onkeydown=e=>{if(!state||paused||state.stage!=='kick')return;const keys={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};if(keys[e.key]){e.preventDefault();e.stopPropagation();adjustAim(...keys[e.key],.12);}};
 function adjustAim(x,z,dt){const goal=goalKick(state.kind);state.aim.x=clamp(state.aim.x+x*(goal?-1:1)*dt*(goal?5:16),goal?-8:-24,goal?8:24);if(goal)state.aim.y=clamp(state.aim.y+z*dt*4,1,9);else state.aim.z=clamp(state.aim.z-z*dt*14,11,38);$('kickAimStick').setAttribute('aria-valuenow',state.aim.x.toFixed(1));$('kickAimStick').setAttribute('aria-valuetext',goal?`Target ${Math.abs(state.aim.x).toFixed(1)} yards ${state.aim.x>0?'left':'right'}, ${state.aim.y.toFixed(1)} high`:`Landing at own ${Math.round(state.aim.z-10)}, ${Math.abs(state.aim.x).toFixed(1)} yards ${state.aim.x>0?'right':'left'}`);}
 function start(kind,{ball=25,down=1,toGo=10,clock=120,kicking='away',conversion=false}={}){
  const a=getActors();paused=false;press=0;shift=0;art=false;resetAimInput();
  state={kind,stage:kind==='defense'?'pre':'kick',book:kind==='defense',ball,down,toGo,snapZ:ball+10,time:0,liveTime:0,clock,carrier:5,controlled:kind==='defense'?16:kicking==='away'?6:16,flight:null,pass:false,target:null,switched:false,action:null,actionUntil:0,cooldown:0,shedUntil:0,switchUntil:0,kicking,conversion,result:null,simNext:false,route:PASSES[Math.floor(random()*PASSES.length)],power:0,timing:false,aim:{x:0,y:5.5,z:18}};
  a.forEach(p=>{p.hasBall=false;p.engaged=false;p.fallen=false;p.action=null;p.throwT=0;p.ballTarget=null;p.vx=p.vz=0;});
  if(kind==='defense') {align();a[2].hasBall=true;state.stagedBall=[a[2].x,.42,state.snapZ-.2];}
  else if(goalKick(kind)) {
   state.snapZ=kind==='extra-point'?95:ball+10;state.kickZ=state.snapZ-7;state.carrier=15;state.controlled=16;
   // Nine blockers, a holder, and a kicker. The kicking unit attacks +Z.
   a.slice(11).forEach((p,j)=>{p.x=(j-4)*1.2;p.z=state.snapZ-.4;p.heading=0;});
   [11,12,13,14,17,18,19,20,21].forEach((id,j)=>{a[id].x=(j-4)*1.2;a[id].z=state.snapZ-.4;});
   a[15].x=0;a[15].z=state.kickZ;a[15].action='hold-kick';a[16].x=-1.8;a[16].z=state.kickZ-2.5;
   a.slice(0,11).forEach((p,i)=>{p.x=(i-5)*1.25;p.z=state.snapZ+1+(i%2)*.6;p.heading=Math.PI;});
   state.stagedBall=[0,.25,state.kickZ];a.forEach(p=>{p.startX=p.x;p.startZ=p.z;});
  }
  else {
   state.carrier=16;a.forEach((p,i)=>{p.x=i<11?(i-5)*4:(i-16)*4;p.z=i<11?(i===6?14:29+(i%3)*5):78+(i%2)*2;p.startX=p.x;p.startZ=p.z;p.heading=i<11?0:Math.PI;});
   a[6].x=0;a[6].z=18;a[16].x=0;a[16].z=75;a[16].heading=Math.PI;state.stagedBall=[0,.22,75];a.forEach(p=>{p.startX=p.x;p.startZ=p.z;});
  }
  root.hidden=false;document.body.classList.add('playing-unit');renderBook();refresh();
 }
 function refresh(){if(!state)return;
  const pre=state.stage==='pre',end=state.stage==='end',kick=state.stage==='kick';
  $('defenseBook').hidden=!state.book;$('unitPre').hidden=!pre||state.book;$('unitPad').hidden=state.book||end||kick||goalKick(state.kind)||state.stage==='kick-flight';
  document.body.classList.toggle('unit-no-movement',state.book||end||kick||goalKick(state.kind));
  document.getElementById('stick').setAttribute('aria-label',state.kind==='kickoff'&&state.kicking==='away'?'Move returner':'Move selected defender');
  $('unitKick').hidden=!kick;$('unitTouchback').hidden=state.kind!=='kickoff'||state.kicking!=='away';
  $('unitKickButton').textContent=state.kicking==='away'?'RECEIVE KICKOFF':state.timing?'KICK':'START KICK';
  $('kickAimPad').hidden=!kick||state.kicking==='away';$('kickGuide').hidden=state.kicking==='away';
  $('kickHelp').textContent=state.timing?'KICK IN THE GOLD ZONE':'MOVE STICK TO AIM · THEN START KICK';
  $('unitResult').hidden=!end;$('unitTop').hidden=state.book||end;
  $('unitSim').hidden=state.kind!=='defense';$('unitSim').textContent=state.simNext?'NEXT PLAY: SIMULATED':'SIMULATE NEXT PLAY';
  $('unitArt').setAttribute('aria-pressed',String(art));$('unitArt').textContent=art?'HIDE PLAY':'SHOW PLAY';
  const flight=state.stage==='flight',p=getActors()[state.controlled],rush=p.index<15&&state.stage==='pass';
  $('unitPrimary').textContent=flight?'SWAT':rush?'SHED BLOCK':state.kind==='kickoff'&&state.kicking==='away'?'JUKE':'TACKLE';
  $('unitSecondary').textContent=flight?'INTERCEPT':state.kind==='kickoff'&&state.kicking==='away'?'SPRINT':'HIT STICK';
  $('unitSwitch').hidden=state.kind==='kickoff'&&state.kicking==='away';
  $('unitStatus').textContent=goalKick(state.kind)?`${state.kind==='extra-point'?'EXTRA POINT':'FIELD GOAL'} · ${kick?'AIM BETWEEN THE UPRIGHTS':'WATCH THE KICK'}`:state.kind==='defense'?`${call.name} · ${pre?'Move your defender, then READY':p.lastName+' · '+state.stage.toUpperCase()}`:state.kicking==='away'?'KICK RETURN · STEER YOUR RETURNER':'KICKOFF · KICK, THEN COVER THE RETURN';
 }
 function finish(result){if(!state||state.stage==='end')return;state.result={...result,seconds:state.liveTime,pass:state.pass,runner:state.carrier,simNext:state.simNext};state.stage='end';state.flight=null;getActors().forEach(p=>{p.vx=p.vz=0;p.moving=false;p.engaged=false});$('unitResult').querySelector('h2').textContent=result.reason;refresh();}
 function tackle(hit=false){if(!state||state.time<state.cooldown||!['run','pass'].includes(state.stage))return;const a=getActors(),p=a[state.controlled],runner=a[state.carrier];state.cooldown=state.time+(hit?1.2:.6);if(distance(p,runner)>(hit?2:1.65)){p.action='dive';p.actionT=.1;p.fallen=hit;state.recover=state.time+.75;return;}
  const good=random()<defensiveTackleChance(p,runner,hit);p.action=hit?'big-hit':'wrap';p.actionT=.3;
  if(good){runner.fallen=true;p.fallen=true;const fumble=hit&&random()<.06+(p.ratings.tackle-runner.ratings.carrying)*.001;finish({reason:fumble?'FUMBLE RECOVERED':state.stage==='pass'?'SACK':hit?'BIG HIT':'TACKLED',gain:Math.round(runner.z-state.snapZ),ball:clamp(Math.round(runner.z-10),0,100),interception:fumble,sack:state.stage==='pass'});}
  else {p.fallen=true;state.recover=state.time+1;onStatus?.('MISSED TACKLE');}
 }
 function action(kind){if(!state||paused||goalKick(state.kind)||state.book||state.stage==='end'||state.stage==='pre')return;
  if(state.stage==='flight'){state.action=kind==='primary'?'swat':'intercept';state.actionUntil=state.time+.65;const p=getActors()[state.controlled];p.catchT=.15;p.catchStyle=kind==='primary'?'rac':'aggressive';return;}
  if(state.kind==='kickoff'&&state.kicking==='away'){if(kind==='primary'){const p=getActors()[state.controlled];p.action='juke';p.actionT=.3;p.x=clamp(p.x+(inputVector()[0]<0?-1.2:1.2),-26,26);state.jukeUntil=state.time+.4;}state.burst=state.time+(kind==='primary'?.4:1.2);return;}
  const p=getActors()[state.controlled];
  if(kind==='primary'&&p.index<15&&state.stage==='pass'&&p.engaged){p.engaged=false;state.shedUntil=state.time+.65;p.x+=p.x<0?-1.1:1.1;onStatus?.('BLOCK SHED');return;}
  tackle(kind==='secondary');
 }
 $('unitSwitch').onclick=switchPlayer;$('unitPrimary').onclick=()=>action('primary');$('unitSecondary').onclick=()=>action('secondary');
 $('unitBook').onclick=()=>{state.book=true;refresh()};$('unitArt').onclick=()=>{art=!art;refresh()};
 $('unitPress').onclick=()=>{press=-3;align();refresh()};$('unitBack').onclick=()=>{press=5;align();refresh()};$('unitShift').onclick=()=>{shift=shift===0?-2:shift===-2?2:0;align();refresh()};
 $('unitReady').onclick=()=>{state.stage='snap';state.startedAt=state.time;state.pass=random()<(state.toGo>6||state.clock<40?.76:.43);state.passAt=(config.level.id==='rookie'?2.2:config.level.id==='all-pro'?1.3:1.7)+random()*1.1;getActors()[2].hasBall=false;getActors()[2].action='snap';getActors()[5].action='receive-snap';refresh()};
 $('unitSimBook').onclick=()=>{stop();onSimulate()};$('unitSim').onclick=()=>{if(state.stage==='pre'){stop();onSimulate()}else{state.simNext=!state.simNext;refresh()}};
 $('unitKickButton').onclick=()=>kick();$('unitTouchback').onclick=()=>{if(state?.kind==='kickoff'&&state.kicking==='away'&&state.stage==='kick')finish({reason:'TOUCHBACK · OWN 25',ball:25,seconds:0});};
 $('unitContinue').onclick=()=>{const result=state.result;stop();onResult(result)};
 function kick(){
  if(!state||paused||state.stage!=='kick')return;
  if(state.kicking==='home'&&!state.timing){state.timing=true;state.meterTime=0;refresh();return;}
  const a=getActors(),goal=goalKick(state.kind),power=state.kicking==='home'?state.power:.78,aim=state.kicking==='home'?state.aim:{x:(random()-.5)*20,y:5.5,z:14};
  const error=(power<.65?power-.65:power>.9?power-.9:0),rating=config.matchup.home.kicker.overall;
  const x=aim.x+error*(goal?18:24)*(1+(90-rating)*.01);
  const to=goal?[x,Math.max(.2,aim.y-Math.max(0,.65-power)*16),117]:[clamp(x,-26,26),1.4,clamp(aim.z+(.78-power)*18,7,42)];
  if(goal){state.good=Math.abs(to[0])<3.0&&to[1]>3.3;state.miss=to[1]<=3.3?'SHORT / LOW':to[0]<0?'WIDE RIGHT':'WIDE LEFT';}
  state.stagedBall=null;a[15].action=null;a[16].hasBall=false;a[16].action='kick';a[16].actionT=.1;
  if(goal){a[16].x=-.6;a[16].z=state.kickZ-.7;}
  state.stage='kick-flight';state.flight={from:[0,.3,goal?state.kickZ:75],to,t:0,duration:goal?1.8:3.5,arc:goal?7:17,target:6};state.controlled=state.kicking==='away'?6:16;resetAimInput();refresh();
 }
 function move(p,x,z,dt,max=speed(p),smooth=true){const dx=x-p.x,dz=z-p.z,len=Math.hypot(dx,dz)||1;let vx=dx/len*Math.min(max,len/dt),vz=dz/len*Math.min(max,len/dt);if(smooth){const f=Math.min(1,dt*8);vx=p.vx+(vx-p.vx)*f;vz=p.vz+(vz-p.vz)*f}p.x=clamp(p.x+vx*dt,-27,27);p.z+=vz*dt;p.vx=vx;p.vz=vz;p.moving=Math.hypot(vx,vz)>.1;p.distance+=Math.hypot(vx,vz)*dt;if(p.moving)p.heading=Math.atan2(vx,vz);p.sprinting=max>speed(p)*.9;}
 function controlled(dt){const p=getActors()[state.controlled];if(p.fallen)return;const v=inputVector();const blend=state.time<state.switchUntil?.32:1;move(p,p.x+v[0]*10,p.z+v[1]*10,dt,speed(p)*(state.burst>state.time?1:.9)*Math.min(1,Math.hypot(...v))*blend);if(state.stage==='pre')p.z=Math.max(state.snapZ+.5,p.z);}
 function tick(dt){if(!state||paused||state.stage==='end')return;state.time+=dt;const a=getActors();for(const p of a){if(p.catchT>0)p.catchT=Math.max(0,p.catchT-dt);if(['kick','juke'].includes(p.action)){p.actionT=Math.min(1,(p.actionT||0)+dt*1.8);if(p.actionT>=1)p.action=null;}}
  if(state.recover&&state.time>=state.recover){a[state.controlled].fallen=false;state.recover=0;}
  if(state.book)return;if(state.stage==='kick'){if(state.kicking==='home')adjustAim(...aimInput,dt);if(state.timing){state.meterTime+=dt;state.power=.5-.5*Math.cos(state.meterTime*2.8);}else state.power=0;$('kickPower').style.left=(state.power*100)+'%';return;}
  if(state.stage==='pre'){controlled(dt);return;}
  if(state.kind==='defense'||state.kind==='kickoff'&&state.stage==='run')state.liveTime+=dt;state.clock=Math.max(0,state.clock-dt);
  if(state.stage==='snap'){const t=clamp((state.time-state.startedAt)/.3,0,1);state.stagedBall=[0,.45+t*.9,state.snapZ-5*t];if(t>=1){state.stagedBall=null;a[2].action=null;a[5].action=null;state.stage=state.pass?'pass':'handoff';state.carrier=5;a[5].hasBall=true;state.snapTime=state.time;refresh()}return;}
  if(state.stage==='kick-flight'){
   const f=state.flight;f.t+=dt/f.duration;if(goalKick(state.kind)){if(f.t>=1)finish({reason:`${state.kind==='extra-point'?'EXTRA POINT':'FIELD GOAL'} ${state.good?'GOOD':'MISSED · '+state.miss}`,good:state.good,kind:state.kind});return;}move(a[6],f.to[0],f.to[2],dt,speed(a[6]));for(let i=11;i<22;i++)if(i!==state.controlled)move(a[i],a[6].x+(i-16)*2,a[6].z+12,dt,speed(a[i])*.85);if(state.kicking==='home')controlled(dt);
   if(f.t>=1){state.stage='run';state.flight=null;state.carrier=6;a[6].x=f.to[0];a[6].z=f.to[2];a[6].hasBall=true;if(a[6].z<=10){finish({reason:'TOUCHBACK · OWN 25',ball:25});return;}if(state.kicking==='home')control(nearestDefender(a,a[6]));refresh()}return;
  }
  if(state.stage==='handoff'){const t=state.time-state.snapTime;move(a[6],a[5].x,a[5].z-.6,dt,5);a[5].action='handoff';a[5].actionT=clamp(t/.6,0,1);a[6].action='receive-handoff';a[6].actionT=clamp(t/.6,0,1);if(t>.6){a[5].action=null;a[6].action=null;a[5].hasBall=false;a[6].hasBall=true;state.carrier=6;state.stage='run';refresh()}}
  const offense=a.slice(0,11),defense=a.slice(11),runner=a[state.carrier];
  if(state.stage==='pass'||state.stage==='flight'){
   [7,8,9,10,6].forEach((id,i)=>{const p=a[id],pt=pathPoint(state.route.routes[i],Math.max(0,state.time-state.snapTime)*speed(p)*.72);move(p,p.startX+pt[0],p.startZ+pt[1],dt,speed(p)*.8)});
   for(const p of defense){if(p.index===state.controlled||p.fallen)continue;const assignment=defenseAssignment(call,p.index-11,state.snapZ,a);const target=state.stage==='flight'&&state.time-state.releaseAt>.22+(100-p.ratings.awareness)*.006?a[state.target]:assignment;move(p,target.x,target.z,dt,speed(p)*(assignment.type==='rush'?.85:.82));}
   for(let i=0;i<5;i++){const block=offense[i],def=defense[i%4];move(block,def.x,Math.max(state.snapZ-2,def.z-.8),dt,4);if(distance(block,def)<1.3&&state.shedUntil<state.time){def.engaged=block.engaged=true;def.engagedWith=block.index;block.engagedWith=def.index;def.blockStyle='shed';block.blockStyle='pass';if(random()<dt*(.6+(def.ratings.blockShed-block.ratings.block)*.025))def.x+=def.x<0?-.7:.7;else {def.z=Math.max(def.z,block.z+.75);def.vz=0}}}
   if(state.stage==='pass'){
    const pressure=defense.filter(p=>distance(p,a[5])<3).length;
    if(pressure&&state.time-state.snapTime>.8){move(a[5],a[5].x+(a[5].x<=0?-2:2),a[5].z+1,dt,speed(a[5])*.65);if(Math.abs(a[5].x)>8&&random()<dt*.8){state.stage='run';refresh()}}
    if(defense.some(p=>p.index!==state.controlled&&!p.fallen&&distance(p,a[5])<1)){a[5].fallen=true;finish({reason:'SACK',gain:Math.round(a[5].z-state.snapZ),sack:true});return;}
    if(state.time-state.snapTime>=state.passAt&&!state.windup){state.target=[7,8,9,10,6].sort((i,j)=>Math.min(...defense.map(d=>distance(d,a[j])))-Math.min(...defense.map(d=>distance(d,a[i]))))[0];state.windup=state.time;}
    if(state.windup){a[5].throwT=clamp((state.time-state.windup)/.45,.01,1);a[5].throwStyle='bullet';if(state.time-state.windup>.28){const target=a[state.target],duration=.6+Math.abs(target.z-a[5].z)*.013;state.flight={from:[a[5].x,1.8,a[5].z],to:[clamp(target.x+target.vx*duration,-26,26),1.6,clamp(target.z+target.vz*duration,10,112)],t:0,duration,arc:3,target:state.target};a[5].hasBall=false;state.stage='flight';state.releaseAt=state.time;control(nearestDefender(a,target));state.switched=true;refresh();}}
   }else{
    a[5].throwT=Math.max(0,a[5].throwT-dt*2);const f=state.flight;f.t+=dt/f.duration;
    if(f.t>=1){const target=a[f.target],p=a[state.controlled],at={x:f.to[0],z:f.to[2]},nearest=defense.filter(d=>!d.fallen).sort((x,y)=>distance(x,at)-distance(y,at))[0];const userClose=distance(p,at)<2.4,active=state.actionUntil>=state.time;
     if(userClose&&active&&state.action==='swat'){finish({reason:'PASS SWATTED',incomplete:true,gain:0});return;}
     const userPick=userClose&&active&&state.action==='intercept'&&random()<clamp(.4+p.ratings.catch*.004,.4,.82);
     const aiPick=nearest.index!==state.controlled&&distance(nearest,at)<1.15&&random()<.22;
     if(userPick||aiPick){finish({reason:'INTERCEPTED',interception:true,gain:Math.round(at.z-state.snapZ)});return;}
     if(distance(target,at)>3.5||random()<clamp(.04+(90-a[5].ratings.throw)*.003+(distance(nearest,at)<1.5?.3:0),.02,.5)){finish({reason:'INCOMPLETE',incomplete:true,gain:0});return;}
     target.x=at.x;target.z=at.z;target.hasBall=true;target.catchT=.15;state.carrier=target.index;state.stage='run';state.flight=null;refresh();
    }
   }
  }
  if(state.stage==='run'){
   const runner=a[state.carrier],manual=state.kind==='kickoff'&&state.kicking==='away';
   if(!manual){const nearest=defense.filter(p=>!p.fallen).sort((x,y)=>distance(x,runner)-distance(y,runner))[0];const avoid=distance(nearest,runner)<4?(runner.x<nearest.x?-1:1)*3:0;move(runner,clamp(runner.x+avoid,-24,24),runner.z+12,dt,speed(runner)*.92);}
   for(const p of defense){p.engaged=false;if(p.index===state.controlled||p.fallen)continue;move(p,runner.x+runner.vx*.15,runner.z+runner.vz*.15,dt,speed(p)*.9);if(distance(p,runner)<1&&state.time>(state.contactGrace||0)){if(random()<defensiveTackleChance(p,runner)-(state.jukeUntil>state.time?.35:0)){runner.fallen=true;p.fallen=true;finish({reason:'TACKLED',gain:Math.round(runner.z-state.snapZ),ball:clamp(Math.round(runner.z-10),0,100)});return;}state.contactGrace=state.time+.6;p.x+=p.x<runner.x?-1:1;}}
   for(const p of offense){if(p===runner)continue;const target=defense.filter(d=>!d.fallen).sort((x,y)=>distance(x,p)-distance(y,p))[0];if(target){move(p,target.x,target.z-.8,dt,speed(p)*.75);if(distance(p,target)<1.2&&target.index!==state.controlled){target.z+=.2*dt;target.x+=Math.sign(target.x-runner.x)*.4*dt;target.engaged=true;target.blockStyle='shed';p.engaged=true;p.blockStyle='stalk';}}}
   if(runner.z>=110){finish({reason:'TOUCHDOWN',gain:100-state.ball,ball:100,touchdown:true});return;}
   if(runner.z<=10||Math.abs(runner.x)>=26.4){finish({reason:runner.z<=10?'SAFETY':'OUT OF BOUNDS',gain:Math.round(runner.z-state.snapZ),ball:clamp(Math.round(runner.z-10),0,100),out:true});return;}
  }
  controlled(dt);
  if(state.liveTime>25)finish({reason:'WHISTLE',gain:Math.round(a[state.carrier].z-state.snapZ),ball:clamp(Math.round(a[state.carrier].z-10),0,100)});
 }
 function view(){
  if(!state)return null;const a=getActors();
  // Goal kicks never use the reverse-facing defense camera or chase the landing point.
  if(goalKick(state.kind))return {eye:[-3,10,state.kickZ-17],target:[-3,1.5,112],fov:50};
  const defending=state.kind==='defense'||state.kicking==='home',direction=defending?-1:1;
  if(state.stage==='kick')return defending?{eye:[0,22,96],target:[0,0,42],fov:55}:{eye:[0,15,0],target:[0,1,35],fov:55};
  if(state.stage==='pre'||state.book)return {eye:[0,16,state.snapZ+23],target:[0,1,state.snapZ-3],fov:55};
  const player=a[state.controlled],f=state.flight,t=f?clamp(f.t,0,1):0;
  const ball=f?{x:f.from[0]+(f.to[0]-f.from[0])*t,z:f.from[2]+(f.to[2]-f.from[2])*t}:a[state.carrier];
  const separation=Math.hypot(player.x-ball.x,player.z-ball.z),wide=clamp(separation*.32,0,16);
  const x=player.x+(ball.x-player.x)*.55,z=player.z+(ball.z-player.z)*.55;
  return {eye:[x,10+wide,z-direction*(17+wide)],target:[x,1.5,z+direction*4],fov:55};
 }
 function aimTarget(){return state?.stage==='kick'&&state.kicking==='home'?{point:goalKick(state.kind)?[state.aim.x,state.aim.y,117]:[state.aim.x,.08,state.aim.z],vertical:goalKick(state.kind)}:null;}
 function stop(){root.hidden=true;document.body.classList.remove('playing-unit','unit-no-movement');resetAimInput();state=null;}
 return {start,tick,stop,view,aimTarget,refresh,action,switchPlayer,selectPlayer,canSelect,get state(){return state},setPaused(value){paused=value;resetAimInput();root.hidden=value||!state},get art(){return state?.kind==='defense'&&state.stage==='pre'&&art?getActors().slice(11).map(p=>({from:p,to:defenseAssignment(call,p.index-11,state.snapZ,getActors())})):[]}};
}
