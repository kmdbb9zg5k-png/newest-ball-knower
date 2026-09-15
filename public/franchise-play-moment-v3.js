(()=>{
'use strict';
const $=id=>document.getElementById(id);
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const num=v=>Number.isFinite(Number(v))?Number(v):null;
const avg=(...values)=>{const list=values.flat().map(num).filter(v=>v!==null);return list.length?list.reduce((a,b)=>a+b,0)/list.length:80};
const readJson=key=>{try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}};
const vibrate=ms=>{try{navigator.vibrate?.(ms)}catch{}};

const params=new URLSearchParams(location.search);
const base=readJson('ballknower_solo_franchise_v2')||{};
const season=readJson('ballknower_solo_franchise_v2:season')||{};
const week=Math.max(1,Number(params.get('week'))||((season.weeks||[]).length+1));
const roster=Array.isArray(season.roster)&&season.roster.length?season.roster:(Array.isArray(base.roster)?base.roster:[]);

const fallbackArt=[
 '/solo-characters/v2/my-player-presets/darius/full-body.webp',
 '/solo-characters/v2/my-player-presets/malik/full-body.webp',
 '/solo-characters/v2/my-player-presets/nico/full-body.webp',
 '/solo-characters/v2/my-player-presets/mason/full-body.webp'
];
const rating=p=>Number(p?.ovr||p?.overallRating||80);
const best=positions=>roster.filter(p=>positions.includes(p.position)).sort((a,b)=>rating(b)-rating(a))[0];
const attr=(p,key,fb)=>num(p?.attributes?.[key])??num(p?.positionSpecificRatings?.[key])??num(p?.[key])??num(p?.ovr)??fb;
const attrAny=(p,keys,fb)=>{for(const key of keys){const value=attr(p,key,null);if(value!==null)return value}return num(p?.ovr)??fb};
const art=(p,i)=>p?.simulatedFullBodyUrl||p?.fullBodyUrl||p?.fullBodyArt||fallbackArt[i%fallbackArt.length];

const qb=best(['QB'])||roster[0]||{id:'demo-qb',name:'QB',ovr:80,attributes:{}};
const rb=best(['RB','HB','FB'])||roster.find(p=>p.position==='WR')||{id:'demo-rb',name:'J. Carter',position:'RB',ovr:82,attributes:{athleticism:84,footballIQ:80}};
const skill=roster.filter(p=>['WR','TE','RB','HB'].includes(p.position)).sort((a,b)=>rating(b)-rating(a));
const targets=[skill[0],skill[1],skill[2]].map((p,i)=>p||{id:'demo-rec-'+i,name:['X Receiver','Slot Receiver','Z Receiver'][i],position:'WR',ovr:80,attributes:{athleticism:80,receiving:80,footballIQ:80}});
const ol=roster.filter(p=>['OT','LT','RT','OG','LG','RG','C'].includes(p.position)).sort((a,b)=>rating(b)-rating(a));
const blockers=[0,1,2,3,4].map((_,i)=>ol[i]||{id:'demo-ol-'+i,name:'OL',position:'OL',ovr:78,attributes:{passBlocking:78,runBlocking:78}});

const qbAcc=avg(attrAny(qb,['shortAccuracy','mediumAccuracy','deepAccuracy','passing'],80));
const qbDecision=avg(attrAny(qb,['decisionMaking','footballIQ','awareness'],80));
const qbPocket=avg(attrAny(qb,['pocketPresence','throwUnderPressure','footballIQ'],80));
const passPro=ol.length?avg(ol.map(p=>attrAny(p,['passBlocking','passBlock','blocking'],rating(p)))):78;
const runBlock=ol.length?avg(ol.map(p=>attrAny(p,['runBlocking','runBlock','blocking'],rating(p)))):78;
const receiverSpeed=avg(targets.map(p=>attrAny(p,['speed','athleticism'],rating(p))));
const routeSkill=avg(targets.map(p=>avg(attrAny(p,['receiving','routeRunning'],rating(p)),attrAny(p,['footballIQ','awareness'],rating(p)))));
const rbSpeed=avg(attrAny(rb,['speed','athleticism'],rating(rb)));
const rbAgility=avg(attrAny(rb,['agility','elusiveness','athleticism'],rating(rb)));
const rbPower=avg(attrAny(rb,['strength','breakTackle','power'],rating(rb)));
const rbVision=avg(attrAny(rb,['vision','footballIQ','awareness'],rating(rb)));

const scenarios=[
 {name:'TWO-MINUTE DRILL',score:24,opp:27,clock:78,ball:25,down:1,toGo:10,timeouts:2},
 {name:'RED ZONE TAKEOVER',score:20,opp:24,clock:42,ball:82,down:2,toGo:7,timeouts:2},
 {name:'4TH & GOAL',score:17,opp:21,clock:11,ball:94,down:4,toGo:6,timeouts:1},
 {name:'HAIL MARY',score:23,opp:28,clock:8,ball:48,down:1,toGo:10,timeouts:0}
];
const scenario=scenarios[(week-1)%scenarios.length];

const passPlays={
 mesh:{name:'MESH',diagram:'↗ ⇆ ↖',routes:{x:[[18,88],[20,68],[43,55],[67,55]],slot:[[48,88],[49,68],[38,60],[25,60]],z:[[82,88],[80,69],[77,48],[76,27]]}},
 verts:{name:'4 VERTS',diagram:'↑ ↑ ↑',routes:{x:[[18,88],[18,67],[18,45],[18,20]],slot:[[48,88],[48,66],[51,43],[53,18]],z:[[82,88],[82,66],[84,42],[83,18]]}},
 flood:{name:'FLOOD',diagram:'↗ → ↑',routes:{x:[[18,88],[20,69],[34,58],[45,52]],slot:[[48,88],[50,70],[64,61],[79,60]],z:[[82,88],[82,68],[74,49],[62,36]]}},
 dagger:{name:'DAGGER',diagram:'↑ ↗ ⟂',routes:{x:[[18,88],[18,67],[21,43],[48,43]],slot:[[48,88],[49,67],[52,52],[72,52]],z:[[82,88],[82,67],[82,44],[81,23]]}}
};
const runPlays={
 stretch:{name:'HB STRETCH',diagram:'→ ↗',path:[[50,96],[52,90],[64,82],[77,72],[84,60],[87,46]]},
 zone:{name:'INSIDE ZONE',diagram:'↑ ↗',path:[[50,96],[50,88],[48,78],[46,66],[47,51],[47,36]]},
 counter:{name:'COUNTER',diagram:'← ↗',path:[[50,96],[42,91],[38,84],[50,76],[60,64],[63,49]]},
 toss:{name:'HB TOSS',diagram:'↗ →',path:[[50,96],[62,92],[74,84],[84,72],[88,57],[87,42]]}
};

const field=$('field'),routes=$('routes'),ball=$('ball'),pressure=$('pressure'),pressureLabel=$('pressureLabel');
const snapBtn=$('snapBtn'),timeoutBtn=$('timeoutBtn'),targetWrap=$('targets'),targetBtns=[...document.querySelectorAll('.target')];
const manualHud=$('manualHud'),joystick=$('joystick'),joyKnob=$('joyKnob');
const skillBtns=[...document.querySelectorAll('.skill')];

const state={
 score:scenario.score,opp:scenario.opp,clock:scenario.clock,ballYard:scenario.ball,down:scenario.down,toGo:scenario.toGo,timeouts:scenario.timeouts,
 mode:'pass',play:'mesh',control:'manual',live:false,throwing:false,ended:false,phase:'pre',snapAt:0,last:0,raf:0,plays:0,
 qbStats:{yards:0,td:0,int:0},receiverStats:{},rushStats:{},receivers:{},defenders:[],blockers:[],qb:null,runner:null,
 finalWon:false,joystick:{x:0,y:0,pointerId:null},sprinting:false,stamina:100,evadeUntil:0,evadeType:'',evaded:new Set(),
 graceUntil:0,runStartY:96,playStartBall:scenario.ball,assistIndex:1,stunned:new Map(),blocked:new Map(),runElapsed:0
};

$('scenarioName').textContent=scenario.name;
$('userName').textContent=String(base.teamAbbr||base.teamName||'KNOWERS').slice(0,14).toUpperCase();
$('oppName').textContent=(params.get('opponent')||'CPU').slice(0,14).toUpperCase();

function modePlays(){return state.mode==='pass'?passPlays:runPlays}
function currentPlay(){return modePlays()[state.play]||Object.values(modePlays())[0]}
function setControl(mode){state.control=mode==='assist'?'assist':'manual';$('manualBtn').classList.toggle('active',state.control==='manual');$('assistBtn').classList.toggle('active',state.control==='assist');manualHud.classList.toggle('assist',state.control==='assist');if(state.phase==='run')showManualHud(true);updateHelp()}
function setMode(mode){if(state.live||state.ended)return;state.mode=mode==='run'?'run':'pass';state.play=state.mode==='run'?'stretch':'mesh';$('passMode').classList.toggle('active',state.mode==='pass');$('runMode').classList.toggle('active',state.mode==='run');targetWrap.classList.toggle('hidden',state.mode==='run');renderPlaybook();updateRatings();resetPlay()}

function updateRatings(){
 if(state.mode==='pass'){
  $('primaryRating').textContent=Math.round(qbAcc);$('primaryLabel').textContent='QB ACC';
  $('lineRating').textContent=Math.round(passPro);$('lineLabel').textContent='PASS PRO';
  $('speedRating').textContent=Math.round(receiverSpeed);$('speedLabel').textContent='WR SPD';
  $('skillRating').textContent=Math.round(routeSkill);$('skillLabel').textContent='ROUTE';
  pressureLabel.textContent='POCKET PRESSURE';
 }else{
  $('primaryRating').textContent=Math.round(rbSpeed);$('primaryLabel').textContent='RB SPD';
  $('lineRating').textContent=Math.round(runBlock);$('lineLabel').textContent='RUN BLK';
  $('speedRating').textContent=Math.round(rbAgility);$('speedLabel').textContent='AGILITY';
  $('skillRating').textContent=Math.round(rbPower);$('skillLabel').textContent='POWER';
  pressureLabel.textContent='SPRINT ENERGY';
 }
}

function renderPlaybook(){
 const wrap=$('playbook');wrap.innerHTML='';
 Object.entries(modePlays()).forEach(([id,play])=>{
  const b=document.createElement('button');b.type='button';b.className='playcall'+(state.play===id?' active':'');b.dataset.play=id;
  b.innerHTML='<span class="diagram">'+play.diagram+'</span><b>'+play.name+'</b>';
  b.addEventListener('click',()=>{if(state.live)return;state.play=id;renderPlaybook();drawRoutes();updateSelectedPlay()});wrap.appendChild(b);
 });
 updateSelectedPlay();
}
function updateSelectedPlay(){$('playType').textContent=state.mode==='pass'?'PASS PLAY':'RUN PLAY';$('selectedPlayName').textContent=currentPlay().name}

const starts={x:[18,86],slot:[48,86],z:[82,86],qb:[50,93],runner:[50,97]};
const blockerStarts=[[30,84],[40,84],[50,84],[60,84],[70,84]];
const defStarts=[[13,67],[27,61],[39,68],[50,60],[62,67],[75,61],[88,68]];
const coverage=clamp(79+((week*3)%7),76,88),passRush=clamp(80+((week*5)%8),77,89),runDefense=clamp(79+((week*7)%9),76,89);
const pocketLimit=clamp(4.2+(passPro-passRush)*.035+(qbPocket-80)*.014,3.15,5.45);

function makePlayer(id,kind,p,x,y,label,i){
 const el=document.createElement('button');el.type='button';el.className='player '+kind+(id==='qb'?' qb':'');el.dataset.id=id;
 el.innerHTML='<span class="portrait-mask"><img src="'+art(p,i)+'" alt="" draggable="false"></span><span class="tag">'+label+'</span>';
 el.style.left=x+'%';el.style.top=y+'%';
 if(kind==='offense'&&['x','slot','z'].includes(id))el.addEventListener('click',()=>throwTo(id));else el.tabIndex=-1;
 field.appendChild(el);return{id,el,p,x,y,segment:0};
}
function setPos(p,x,y){p.x=clamp(x,4,96);p.y=clamp(y,7,99);p.el.style.left=p.x+'%';p.el.style.top=p.y+'%';p.el.style.setProperty('--scale',String(.70+p.y*.0036))}
function clearPlayers(){field.querySelectorAll('.player').forEach(n=>n.remove())}
function setup(){
 clearPlayers();
 state.blockers=blockerStarts.map((pos,i)=>makePlayer('ol'+i,'blocker',blockers[i],pos[0],pos[1],'',i));
 state.receivers={x:makePlayer('x','offense',targets[0],...starts.x,'X',0),slot:makePlayer('slot','offense',targets[1],...starts.slot,'SLOT',1),z:makePlayer('z','offense',targets[2],...starts.z,'Z',2)};
 state.qb=makePlayer('qb','offense',qb,...starts.qb,'QB',3);
 if(state.mode==='run')state.runner=makePlayer('runner','offense runner',rb,...starts.runner,'RB',1);else state.runner=null;
 state.defenders=defStarts.map((pos,i)=>makePlayer('d'+i,'defense',targets[i%3],pos[0],pos[1],'D',i));
 drawRoutes();
}

function drawRoutes(){
 routes.innerHTML='';
 if(state.mode==='pass'){
  Object.entries(currentPlay().routes).forEach(([id,pts])=>{
   const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('class','route '+id);path.setAttribute('d',pts.map((p,i)=>(i?'L':'M')+' '+p[0]+' '+p[1]).join(' '));routes.appendChild(path);
  });
 }else{
  const pts=currentPlay().path;const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('class','route runroute');path.setAttribute('d',pts.map((p,i)=>(i?'L':'M')+' '+p[0]+' '+p[1]).join(' '));routes.appendChild(path);
 }
}
function routePos(pts,t){const count=pts.length-1,scaled=Math.min(.999,t)*count,index=Math.floor(scaled),u=scaled-index,a=pts[index],b=pts[index+1];return{x:a[0]+(b[0]-a[0])*u,y:a[1]+(b[1]-a[1])*u,seg:index}}

function resetInput(){state.joystick.x=0;state.joystick.y=0;state.joystick.pointerId=null;joyKnob.style.transform='translate(0,0)';state.sprinting=false;skillBtns.forEach(b=>b.classList.remove('active'))}
function showManualHud(show){manualHud.classList.toggle('show',show);manualHud.setAttribute('aria-hidden',show?'false':'true');manualHud.classList.toggle('assist',state.control==='assist');joystick.style.opacity=state.control==='assist'?'.28':'1';joystick.style.pointerEvents=state.control==='assist'?'none':'auto'}
function resetPlay(){
 cancelAnimationFrame(state.raf);state.live=false;state.throwing=false;state.phase='pre';state.evadeUntil=0;state.evadeType='';state.evaded=new Set();state.stunned.clear();state.blocked.clear();state.stamina=100;state.assistIndex=1;state.runElapsed=0;resetInput();
 pressure.style.width=state.mode==='run'?'100%':'0%';ball.style.display='none';snapBtn.disabled=false;snapBtn.classList.remove('live');snapBtn.querySelector('b').textContent='SNAP BALL';
 [...$('playbook').querySelectorAll('button')].forEach(b=>b.disabled=false);targetBtns.forEach(b=>{b.disabled=true;b.dataset.open='0'});showManualHud(false);routes.style.opacity='1';setup();updateHud();updateHelp();
}

function snap(){
 if(state.live||state.ended)return;state.live=true;state.throwing=false;state.snapAt=performance.now();state.last=state.snapAt;state.plays++;state.phase=state.mode==='pass'?'pass':'handoff';state.playStartBall=state.ballYard;state.runStartY=starts.runner[1];
 routes.style.opacity='.22';snapBtn.disabled=true;snapBtn.classList.add('live');snapBtn.querySelector('b').textContent='PLAY LIVE';[...$('playbook').querySelectorAll('button')].forEach(b=>b.disabled=true);
 if(state.mode==='pass'){targetBtns.forEach(b=>b.disabled=false);Object.values(state.receivers).forEach(r=>r.el.classList.add('run'));state.qb.el.classList.add('run');}
 else{state.runner.el.classList.add('run');state.qb.el.classList.add('run')}
 state.defenders.forEach(d=>d.el.classList.add('run'));state.blockers.forEach(b=>b.el.classList.add('run'));log('Snap',currentPlay().name);vibrate(12);state.raf=requestAnimationFrame(frame);
}
function frame(now){
 if(!state.live)return;const dt=Math.min(.05,(now-state.last)/1000);state.last=now;
 if(state.mode==='pass')passFrame(now,dt);else runFrame(now,dt);
 if(state.live)state.raf=requestAnimationFrame(frame);
}

function passFrame(now,dt){
 const elapsed=(now-state.snapAt)/1000;
 Object.entries(state.receivers).forEach(([id,r])=>{
  const spd=attrAny(r.p,['speed','athleticism'],rating(r.p)),route=avg(attrAny(r.p,['receiving','routeRunning'],rating(r.p)),attrAny(r.p,['footballIQ','awareness'],rating(r.p)));
  const duration=clamp(4.75-(spd-80)*.018-(route-80)*.009,3.7,5.25),pos=routePos(currentPlay().routes[id],Math.min(1,elapsed/duration));
  if(pos.seg!==r.segment){r.segment=pos.seg;r.el.classList.add('cut');setTimeout(()=>r.el.classList.remove('cut'),180)}setPos(r,pos.x,pos.y);
 });
 setPos(state.qb,50,93+Math.min(3.1,elapsed*.9));
 const assign=[['x',0,3.6,2.8],['x',1,-7,5.9],['slot',2,3.3,3],['slot',3,-8,5.2],['z',4,-7,5.4],['z',5,-3.2,2.8]];
 assign.forEach(([rid,di,ox,oy],i)=>{const r=state.receivers[rid],d=state.defenders[di];if(!d)return;const route=avg(attrAny(r.p,['receiving','routeRunning'],rating(r.p)),attrAny(r.p,['footballIQ','awareness'],rating(r.p))),react=clamp(.52+(coverage-route)*.012,.24,.78),factor=Math.max(0,elapsed-react-i*.018),tx=r.x+Number(ox),ty=r.y+Number(oy),chase=clamp(4.4+(coverage-80)*.06,2.8,6.5);setPos(d,d.x+(tx-d.x)*Math.min(1,factor)*dt*chase,d.y+(ty-d.y)*Math.min(1,factor)*dt*chase)});
 updateOpen();pressure.style.width=Math.min(100,elapsed/pocketLimit*100)+'%';if(elapsed>=pocketLimit&&!state.throwing)sack();
}
function distToDefense(id){const r=state.receivers[id];let min=999;state.defenders.forEach(d=>{min=Math.min(min,Math.hypot((r.x-d.x)*.62,r.y-d.y))});return min}
function updateOpen(){Object.entries(state.receivers).forEach(([id,r])=>{const dist=distToDefense(id),route=avg(attrAny(r.p,['receiving','routeRunning'],rating(r.p)),attrAny(r.p,['footballIQ','awareness'],rating(r.p))),open=dist+(route-80)*.07>7.1;r.el.classList.toggle('open',open);const b=targetBtns.find(x=>x.dataset.target===id);if(b)b.dataset.open=open?'1':'0'})}
function throwTo(id){
 if(!state.live||state.throwing||state.ended||state.mode!=='pass')return;state.throwing=true;cancelAnimationFrame(state.raf);const r=state.receivers[id],elapsed=(performance.now()-state.snapAt)/1000,pressureRatio=clamp(elapsed/pocketLimit,0,1),distance=distToDefense(id),depth=Math.max(2,(86-r.y)*.74),catchRating=avg(attrAny(r.p,['receiving','catching'],rating(r.p)),rating(r.p)),route=avg(attrAny(r.p,['receiving','routeRunning'],80),attrAny(r.p,['footballIQ','awareness'],80)),openScore=distance+(route-80)*.08-pressureRatio*2.4;
 state.qb.el.classList.remove('run');state.qb.el.classList.add('throw');Object.values(state.receivers).forEach(x=>x.el.classList.remove('run'));targetBtns.forEach(b=>b.disabled=true);vibrate(10);
 flyBall(state.qb.x,state.qb.y-3,r.x,r.y-3,()=>{const pickRisk=clamp(.22-openScore*.022+(80-qbDecision)*.004+pressureRatio*.13,.025,.36),catchChance=clamp(.52+openScore*.05+(catchRating-78)*.008+(qbAcc-78)*.005-pressureRatio*.12-depth*.0025,.18,.97),roll=Math.random();if(roll<pickRisk){state.qbStats.int++;finish(false,'INTERCEPTED','The defender undercut the window.');return}if(roll>catchChance){incomplete(id,distance);return}catchBall(id,depth,distance)});
}
function flyBall(x1,y1,x2,y2,done){ball.style.display='block';const start=performance.now(),duration=430+Math.hypot(x2-x1,y2-y1)*7;function go(now){const t=Math.min(1,(now-start)/duration),ease=1-Math.pow(1-t,2),arc=Math.sin(Math.PI*t)*7;ball.style.left=x1+(x2-x1)*ease+'%';ball.style.top=y1+(y2-y1)*ease-arc+'%';ball.style.transform='translate(-50%,-50%) rotate('+(22+t*520)+'deg)';if(t<1)requestAnimationFrame(go);else{ball.style.display='none';done()}}requestAnimationFrame(go)}
function catchBall(id,depth,coverageDist){
 const r=state.receivers[id];r.el.classList.add('catch');const speed=attrAny(r.p,['speed','athleticism'],80),yac=Math.max(0,Math.round((coverageDist-4)*.65+(speed-75)*.08+Math.random()*4)),yards=Math.max(3,Math.round(depth+yac));state.qbStats.yards+=yards;const row=state.receiverStats[r.p.id]||{id:r.p.id,name:r.p.name,receptions:0,yards:0,td:0};row.receptions++;row.yards+=yards;state.receiverStats[r.p.id]=row;state.ballYard=Math.min(100,state.ballYard+yards);state.clock=Math.max(0,state.clock-Math.max(5,Math.round((performance.now()-state.snapAt)/1000)+4));toastMsg((coverageDist>8?'WIDE OPEN · ':'')+'COMPLETE +'+yards+' YDS','good');log('Complete',(r.p.name||'Receiver')+' +'+yards);vibrate(16);
 if(state.ballYard>=100){state.score+=6;state.qbStats.td++;row.td++;r.el.classList.remove('catch');r.el.classList.add('celebrate');updateHud();setTimeout(()=>finish(state.score>state.opp,'TOUCHDOWN','You took control and finished the drive.'),450);return}
 advanceDown(yards,false);if(!state.ended)setTimeout(resetPlay,480);
}
function incomplete(id,distance){state.clock=Math.max(0,state.clock-4);state.down++;toastMsg(distance<5?'BROKEN UP':'INCOMPLETE','bad');log('Incomplete',state.receivers[id].p.name||'Receiver');if(state.down>4){finish(false,'TURNOVER ON DOWNS','Four chances are gone.');return}if(state.clock<=0){finish(false,'TIME EXPIRED','The final pass hit the turf.');return}updateHud();setTimeout(resetPlay,420)}
function sack(){state.live=false;state.down++;state.ballYard=Math.max(1,state.ballYard-7);state.toGo+=7;state.clock=Math.max(0,state.clock-9);state.qb.el.classList.remove('run');state.qb.el.classList.add('hit');toastMsg('SACK · -7 YDS','bad');log('Sack','Pocket collapsed');vibrate(30);if(state.down>4){finish(false,'TURNOVER ON DOWNS','The rush ended the drive.');return}if(state.clock<=0){finish(false,'TIME EXPIRED','The sack burned the final seconds.');return}updateHud();setTimeout(resetPlay,600)}

function runFrame(now,dt){
 const elapsed=(now-state.snapAt)/1000;state.runElapsed=elapsed;
 if(state.phase==='handoff'){
  const handoff=Math.min(1,elapsed/.48),path=currentPlay().path,a=path[0],b=path[1];setPos(state.runner,a[0]+(b[0]-a[0])*handoff,a[1]+(b[1]-a[1])*handoff);setPos(state.qb,50,91+handoff*2);
  moveRunDefense(dt,now,true);pressure.style.width='100%';
  if(handoff>=1){state.phase='run';state.graceUntil=now+420;state.runStartY=state.runner.y;state.playStartBall=state.ballYard;state.runner.el.classList.add('runner');state.qb.el.classList.remove('run');showManualHud(true);toastMsg(state.control==='manual'?'YOU HAVE CONTROL':'ASSIST IS DRIVING THE LANE','good');log('Handoff',rb.name||'Running back');vibrate(14)}return;
 }
 if(state.phase!=='run')return;
 const runner=state.runner,speedBase=clamp(18+(rbSpeed-75)*.33,16,27),sprintMult=state.sprinting&&state.stamina>0?1.28:1;
 if(state.sprinting&&state.stamina>0)state.stamina=Math.max(0,state.stamina-dt*31);else state.stamina=Math.min(100,state.stamina+dt*8);
 pressure.style.width=state.stamina+'%';
 let vx=0,vy=0;
 if(state.control==='manual'){
  vx=state.joystick.x;vy=state.joystick.y;
  if(Math.abs(vx)+Math.abs(vy)<.08)vy=-.12;
 }else{
  const path=currentPlay().path,target=path[Math.min(state.assistIndex,path.length-1)]||[50,10],dx=target[0]-runner.x,dy=target[1]-runner.y,dist=Math.hypot(dx,dy)||1;vx=dx/dist;vy=dy/dist;if(dist<7&&state.assistIndex<path.length-1)state.assistIndex++;if(state.assistIndex>=path.length-1&&runner.y<target[1]+5){vx=(50-runner.x)*.02;vy=-1}
  const threat=nearestDefender(runner);if(threat&&threat.distance<9){vx+=clamp((runner.x-threat.player.x)*.08,-.55,.55);const mag=Math.hypot(vx,vy)||1;vx/=mag;vy/=mag}
 }
 const agilityMult=1+(rbAgility-80)*.004;setPos(runner,runner.x+vx*speedBase*sprintMult*agilityMult*dt,runner.y+vy*speedBase*sprintMult*dt);
 moveRunBlockers(dt,now);moveRunDefense(dt,now,false);checkRunCollisions(now);if(!state.live)return;
 if(runner.y<=9||state.ballYard+runYards()>=100){finishRun(true,'TOUCHDOWN');return}
 if(runner.x<=4.5||runner.x>=95.5){finishRun(false,'OUT OF BOUNDS');return}
 if(elapsed>12){finishRun(false,'WHISTLE');return}
}
function moveRunBlockers(dt,now){
 state.blockers.forEach((b,i)=>{const lane=currentPlay().path[Math.min(2,currentPlay().path.length-1)],tx=lane[0]+(i-2)*5,ty=lane[1]+5;setPos(b,b.x+(tx-b.x)*dt*2.1,b.y+(ty-b.y)*dt*2.1);let bestD=null,best=999;state.defenders.forEach(d=>{const dist=Math.hypot((b.x-d.x)*.7,b.y-d.y);if(dist<best){best=dist;bestD=d}});if(bestD&&best<8.5){const blockChance=clamp(.62+(runBlock-runDefense)*.012,.3,.88);if(!state.blocked.has(bestD.id)&&Math.random()<blockChance){state.blocked.set(bestD.id,now+650+Math.random()*650);b.el.classList.add('blocked');setTimeout(()=>b.el.classList.remove('blocked'),450)}}});
}
function moveRunDefense(dt,now,preHandoff){
 const target=state.runner||state.qb;
 state.defenders.forEach((d,i)=>{if((state.stunned.get(d.id)||0)>now)return;const blockedUntil=state.blocked.get(d.id)||0,slow=blockedUntil>now?.26:1;let tx=target.x,ty=target.y;if(preHandoff){tx=currentPlay().path[2]?.[0]||50;ty=currentPlay().path[2]?.[1]||78}const dx=tx-d.x,dy=ty-d.y,dist=Math.hypot(dx*.72,dy)||1;const speed=clamp(15.5+(runDefense-78)*.25+(i%3)*.35,14,21)*slow;setPos(d,d.x+(dx/dist)*speed*dt,d.y+(dy/dist)*speed*dt)});
}
function nearestDefender(p){let player=null,distance=999;state.defenders.forEach(d=>{const dist=Math.hypot((p.x-d.x)*.72,p.y-d.y);if(dist<distance){distance=dist;player=d}});return player?{player,distance}:null}
function checkRunCollisions(now){
 if(now<state.graceUntil)return;const runner=state.runner;
 for(const d of state.defenders){if((state.stunned.get(d.id)||0)>now)continue;const dist=Math.hypot((runner.x-d.x)*.72,runner.y-d.y);if(dist>4.7)continue;
  if(now<state.evadeUntil&&!state.evaded.has(d.id)){
   state.evaded.add(d.id);const skill=state.evadeType,skillRating=skill==='stiff'?rbPower:rbAgility,baseChance=skill==='spin'?.68:skill==='juke'?.64:.58,chance=clamp(baseChance+(skillRating-runDefense)*.012,.28,.9);
   if(Math.random()<chance){state.stunned.set(d.id,now+700);d.el.classList.add('hit');setTimeout(()=>d.el.classList.remove('hit'),360);toastMsg(skill.toUpperCase()+' BEAT THE TACKLE','good');log('Broken tackle',skill.toUpperCase());vibrate(18);continue}
  }
  finishRun(false,'TACKLED');return;
 }
}
function runYards(){const scale=(100-state.playStartBall)/Math.max(1,state.runStartY-9);return Math.round((state.runStartY-state.runner.y)*scale)}
function finishRun(touchdown,reason){
 if(!state.live)return;state.live=false;cancelAnimationFrame(state.raf);showManualHud(false);resetInput();const yards=touchdown?100-state.playStartBall:clamp(runYards(),-6,100-state.playStartBall);const row=state.rushStats[rb.id]||{id:rb.id,name:rb.name||'Running back',attempts:0,yards:0,td:0};row.attempts++;row.yards+=yards;state.rushStats[rb.id]=row;state.ballYard=clamp(state.playStartBall+yards,1,100);const elapsed=Math.max(1,Math.round(state.runElapsed));state.clock=Math.max(0,state.clock-Math.max(4,elapsed+4));
 if(touchdown||state.ballYard>=100){state.score+=6;row.td++;state.runner.el.classList.add('celebrate');toastMsg('TOUCHDOWN · '+yards+' YDS','good');log('Rush TD',(rb.name||'RB')+' '+yards+' yards');updateHud();setTimeout(()=>finish(state.score>state.opp,'TOUCHDOWN','You ran it in and took control of the moment.'),420);return}
 toastMsg(reason+' · '+(yards>=0?'+':'')+yards+' YDS',yards>=state.toGo?'good':'bad');log('Rush',(rb.name||'RB')+' '+(yards>=0?'+':'')+yards);vibrate(reason==='TACKLED'?28:12);advanceDown(yards,true);if(!state.ended)setTimeout(resetPlay,620);
}
function triggerSkill(type){if(!state.live||state.phase!=='run'||state.ended)return;if(type==='sprint')return;const now=performance.now();if(now<state.evadeUntil-120)return;state.evadeType=type;state.evadeUntil=now+(type==='spin'?520:420);state.evaded=new Set();state.runner.el.classList.add('skill');setTimeout(()=>state.runner?.el.classList.remove('skill'),330);const b=skillBtns.find(x=>x.dataset.skill===type);b?.classList.add('active');setTimeout(()=>b?.classList.remove('active'),300);vibrate(10)}

function advanceDown(yards,isRun){
 if(yards>=state.toGo){state.down=1;state.toGo=10}else{state.toGo=Math.max(1,state.toGo-yards);state.down++}
 if(state.down>4){finish(false,'TURNOVER ON DOWNS','The defense got the stop.');return}
 if(state.clock<=0){finish(false,'TIME EXPIRED',isRun?'The run ended as the clock hit zero.':'The clock hit zero.');return}
 updateHud();
}
function useTimeout(){if(state.timeouts<=0||state.live||state.ended)return;state.timeouts--;toastMsg('TIMEOUT · CLOCK STOPPED','good');log('Timeout',state.timeouts+' remaining');updateHud()}
function finish(won,title,body){cancelAnimationFrame(state.raf);state.live=false;state.ended=true;state.finalWon=Boolean(won);showManualHud(false);$('resultEyebrow').textContent=won?'CLUTCH MOMENT':'DRIVE OVER';$('resultTitle').textContent=title;$('resultBody').textContent=body+' '+state.score+'-'+state.opp+' with '+fmt(state.clock)+' left.';$('result').classList.add('show');updateHud();vibrate(won?[20,35,20]:35)}
function payload(){return{type:'bk-play-moment-result',won:Boolean(state.finalWon),week,scenario:scenario.name,score:state.score,opponentScore:state.opp,clockLeft:state.clock,plays:state.plays,controlMode:state.control,qb:{id:qb.id,name:qb.name,passYards:state.qbStats.yards,passTD:state.qbStats.td,interceptions:state.qbStats.int},receivers:Object.values(state.receiverStats),rushers:Object.values(state.rushStats)}}
function apply(){const data=payload();try{localStorage.setItem('ballknower_franchise_play_moment_pending_v1',JSON.stringify(data))}catch{}if(window.parent!==window)window.parent.postMessage(data,location.origin);else location.href='/'}
function cancel(){if(window.parent!==window)window.parent.postMessage({type:'bk-play-moment-cancel'},location.origin);else history.back()}
function updateHud(){
 $('userScore').textContent=state.score;$('oppScore').textContent=state.opp;$('clock').textContent=fmt(state.clock);$('toText').textContent=state.timeouts;$('timeoutCopy').textContent=state.timeouts+' REMAINING';const ord=['','1ST','2ND','3RD','4TH'];$('downText').textContent=(ord[state.down]||'4TH')+' & '+state.toGo;$('yardText').textContent=state.ballYard<50?'OWN '+state.ballYard:state.ballYard===50?'50':'OPP '+(100-state.ballYard);$('driveText').textContent=(100-state.ballYard)+' YDS';timeoutBtn.disabled=state.timeouts<=0||state.live||state.ended;
}
function updateHelp(){if(state.mode==='pass')$('help').innerHTML='<b>Read the coverage.</b> Tap a receiver when he separates. Your roster controls speed, routes, accuracy and pocket time.';else $('help').innerHTML=state.control==='manual'?'<b>Manual control.</b> Use the left stick to steer. Sprint, Juke, Spin and Stiff Arm on the right.':'<b>Assist control.</b> The runner follows the designed lane. You still trigger Sprint and skill moves.'}
function fmt(sec){sec=Math.max(0,Math.round(sec));return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')}
let toastTimer=0;function toastMsg(text,type){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').className='toast show '+type;toastTimer=setTimeout(()=>$('toast').className='toast',1150)}
function log(type,text){const d=document.createElement('div');d.className='item';d.innerHTML='<b>'+type+':</b> '+text;$('logItems').prepend(d);$('status').textContent=state.ended?'DRIVE FINISHED':state.live?'PLAY LIVE':'HURRY-UP OFFENSE'}

function joystickPoint(event){const rect=joystick.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,dx=event.clientX-cx,dy=event.clientY-cy,max=rect.width*.32,dist=Math.hypot(dx,dy)||1,scale=Math.min(1,max/dist),px=dx*scale,py=dy*scale;joyKnob.style.transform='translate('+px+'px,'+py+'px)';state.joystick.x=clamp(px/max,-1,1);state.joystick.y=clamp(py/max,-1,1)}
joystick.addEventListener('pointerdown',e=>{if(state.control!=='manual'||state.phase!=='run')return;state.joystick.pointerId=e.pointerId;joystick.setPointerCapture?.(e.pointerId);joystickPoint(e);e.preventDefault()});
joystick.addEventListener('pointermove',e=>{if(state.joystick.pointerId!==e.pointerId)return;joystickPoint(e);e.preventDefault()});
const endJoy=e=>{if(state.joystick.pointerId!==null&&e.pointerId!==undefined&&state.joystick.pointerId!==e.pointerId)return;state.joystick.pointerId=null;state.joystick.x=0;state.joystick.y=0;joyKnob.style.transform='translate(0,0)'};
joystick.addEventListener('pointerup',endJoy);joystick.addEventListener('pointercancel',endJoy);

skillBtns.forEach(b=>{const type=b.dataset.skill;if(type==='sprint'){b.addEventListener('pointerdown',e=>{if(state.phase!=='run')return;state.sprinting=true;b.classList.add('active');vibrate(8);e.preventDefault()});const stop=()=>{state.sprinting=false;b.classList.remove('active')};b.addEventListener('pointerup',stop);b.addEventListener('pointercancel',stop);b.addEventListener('pointerleave',stop)}else b.addEventListener('click',()=>triggerSkill(type))});
$('manualBtn').addEventListener('click',()=>setControl('manual'));$('assistBtn').addEventListener('click',()=>setControl('assist'));$('passMode').addEventListener('click',()=>setMode('pass'));$('runMode').addEventListener('click',()=>setMode('run'));
targetBtns.forEach(b=>b.addEventListener('click',()=>throwTo(b.dataset.target)));snapBtn.addEventListener('click',snap);timeoutBtn.addEventListener('click',useTimeout);$('applyBtn').addEventListener('click',apply);$('closeBtn').addEventListener('click',cancel);

renderPlaybook();updateRatings();setControl('manual');setup();updateHud();updateHelp();log('Situation',scenario.name+' · Week '+week);
})();
