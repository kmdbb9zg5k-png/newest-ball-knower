import{Renderer,pose,segment,hex}from'./renderer.js';
import{drawAthlete,prepareJerseys,advanceMotion}from'./athlete.js';
import{makeStadium}from'./stadium.js';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function cameraWorldVector(screenX,screenZ,eye,target){const fx=target[0]-eye[0],fz=target[2]-eye[2],l=Math.hypot(fx,fz)||1;return[(-fz*screenX+fx*screenZ)/l,(fx*screenX+fz*screenZ)/l]}
export function normalizeControlKey(key){return typeof key==='string'&&key.length===1?key.toLowerCase():key}
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
const RUNS=[{id:'zone',name:'INSIDE ZONE',path:[[0,0],[-2,4],[-3,12],[0,25]],icon:'M24 23L24 13L17 5M17 5L17 11M17 5L23 5'}, {id:'stretch',name:'HB STRETCH',path:[[0,0],[7,2],[14,7],[17,25]],icon:'M12 23L18 14L36 6M36 6L29 6M36 6L34 13'}, {id:'counter',name:'COUNTER',path:[[0,0],[-5,1],[-6,4],[5,12],[9,25]],icon:'M26 23L15 19L15 13L31 5M31 5L24 5M31 5L29 11'}, {id:'toss',name:'HB TOSS',path:[[0,0],[9,-1],[18,6],[20,25]],icon:'M10 23L34 18L36 5M36 5L30 10M36 5L41 11'}];
const PASSES=[{id:'mesh',name:'MESH',routes:[[[0,0],[0,5],[17,9],[28,9]],[[0,0],[0,6],[-5,10],[-14,10]],[[0,0],[0,8],[-3,18],[-3,32]]],icon:'M5 23L5 14L35 6M42 23L42 14L12 6'}, {id:'verts',name:'VERTICALS',routes:[[[0,0],[0,35]],[[0,0],[2,35]],[[0,0],[0,35]]],icon:'M8 23L8 4M24 23L24 4M40 23L40 4M4 9L8 4L12 9M20 9L24 4L28 9M36 9L40 4L44 9'}, {id:'flood',name:'FLOOD',routes:[[[0,0],[0,8],[17,14],[24,18]],[[0,0],[0,5],[20,9]],[[0,0],[0,12],[-4,29]]],icon:'M6 23L6 14L24 8M22 23L22 16L42 16M39 23L39 4'}, {id:'dagger',name:'DAGGER',routes:[[[0,0],[0,16],[19,16]],[[0,0],[1,24],[5,32]],[[0,0],[0,20],[-17,20]]],icon:'M8 23L8 9L22 9M26 23L26 3M40 23L40 14L29 14'}];
function travel(path,distance){for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);if(distance<=len){const t=distance/len;return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]}distance-=len}const a=path[path.length-1];return[a[0],a[1]+distance]}
export function predictPassDestination(path,startX,startZ,elapsed,duration,speed){const p=travel(path,Math.max(0,elapsed+duration)*speed);return[clamp(startX+p[0],-26.3,26.3),1.6,startZ+p[1]]}
export function start(){
 const r=new Renderer($('game')),stadium=makeStadium(r);let actors=[],frameId=0,elapsed=0,last=0,raf=0,messageUntil=0,recoveryLeft=0;
 let mode='run',selected=0,assist=false,phase='pre',paused=false,ended=false,flight=null,carrier=null,jukeUntil=0,jukeReady=0;
 const redZone=new URLSearchParams(location.search).get('scenario')==='redzone';
 const initialDrive={ball:redZone?85:25,down:1,toGo:10,clock:redZone?63:78,score:24,plays:0};
 let drive={...initialDrive},snapZ=10+initialDrive.ball,stamina=1;
 let input={x:0,z:0,sprint:false,pointer:null},camEye=[14,16,10],camTarget=[0,0,40];const keys=new Set();
 let qaStepping=false;let accumulator=0;let numSeed=175;const rand=()=>{numSeed=(Math.imul(numSeed,1664525)+1013904223)>>>0;return numSeed/4294967296};
 const specs=[['OL',-4.4,-.35,71],['OL',-2.2,-.35,64],['OL',0,-.35,55],['OL',2.2,-.35,68],['OL',4.4,-.35,79],['QB',0,-5,12],['RB',-2,-7,24],['WR',-21,0,11],['WR',-12,-.6,18],['WR',21,0,84],['TE',6.5,-.4,87],['DL',-5,.8,90],['DL',-1.7,.8,94],['DL',1.7,.8,97],['DL',5,.8,92],['LB',-8,5,53],['LB',0,5,54],['LB',8,5,58],['DB',-20,3,21],['DB',-12,9,23],['DB',20,4,29],['DB',8,17,31]];
 const receiverIndices=[7,8,9];
 function setup(){snapZ=10+drive.ball;actors=specs.map(([role,x,z,number],index)=>({index,role,number,team:index>=11?1:0,x,z:snapZ+z,startX:x,startZ:snapZ+z,heading:index>=11?Math.PI:0,distance:0,moving:false,engaged:false,fallen:false,hasBall:index===5,throwT:0,catchT:0}));carrier=actors[5];flight=null;phase='pre';stamina=1;elapsed=0;input={x:0,z:0,sprint:false,pointer:null};keys.clear();$('knob').style.transform='none';jukeReady=0;prepareJerseys(r,actors);updateHud();updateControls();renderPlays()}
 function updateHud(){const ord=['1ST','2ND','3RD','4TH'];$('score').textContent=drive.score;$('clock').textContent=Math.floor(Math.max(0,drive.clock)/60)+':'+String(Math.floor(Math.max(0,drive.clock)%60)).padStart(2,'0');$('down').textContent=ord[Math.min(3,drive.down-1)]+' & '+drive.toGo+' · '+(drive.ball<50?'OWN '+drive.ball:drive.ball===50?'50':'OPP '+(100-drive.ball))}
 function renderPlays(){const plays=mode==='run'?RUNS:PASSES;$('plays').replaceChildren();plays.forEach((p,i)=>{const b=document.createElement('button');b.type='button';b.className=i===selected?'selected':'';b.innerHTML='<svg viewBox="0 0 48 28" aria-hidden="true"><path d="'+p.icon+'"/></svg><b>'+p.name+'</b>';b.onclick=()=>{if(phase!=='pre')return;selected=i;renderPlays()};$('plays').appendChild(b)});$('playName').textContent=plays[selected].name;$('runTab').classList.toggle('selected',mode==='run');$('passTab').classList.toggle('selected',mode==='pass')}
 function updateControls(){const live=phase!=='pre'&&phase!=='dead';$('pre').hidden=phase!=='pre'||ended;$('live').hidden=phase!=='run'||paused||ended;$('instruction').textContent=phase==='pre'?'Practice preview · No career saves are changed':phase==='pass'?'Tap X, Y or Z to throw.':' ';$('control').textContent=(assist?'ASSIST':'MANUAL')+' ●';$('stick').style.opacity=assist?'.3':'1';$('stick').style.pointerEvents=assist?'none':'auto';$('targetLayer').replaceChildren();if(phase==='pass')receiverIndices.forEach((index,i)=>{const b=document.createElement('button');b.className='target';b.id='target-'+index;const badge=document.createElement('span');badge.className='target-label';badge.textContent=['X','Y','Z'][i];const tether=document.createElement('span');tether.className='target-tether';tether.setAttribute('aria-hidden','true');b.append(tether,badge);b.setAttribute('aria-label','Throw to receiver '+['X','Y','Z'][i]);b.onclick=()=>throwTo(index);$('targetLayer').appendChild(b)})}
 function message(text,seconds=1.4){$('message').textContent=text;$('message').classList.add('show');messageUntil=performance.now()+seconds*1000}
 function snap(){if(phase!=='pre'||paused||ended)return;phase=mode==='run'?'handoff':'pass';elapsed=0;drive.plays++;carrier=actors[5];message(mode==='run'?RUNS[selected].name:'READ THE COVERAGE',.85);updateControls()}
 function move(p,x,z,dt,turn=12){const dx=x-p.x,dz=z-p.z,dist=Math.hypot(dx,dz);p.moving=dist>.001;p.distance+=dist;p.x=clamp(x,-26.3,26.3);p.z=z;if(dist>.001){const heading=Math.atan2(dx,dz),diff=Math.atan2(Math.sin(heading-p.heading),Math.cos(heading-p.heading));p.heading+=diff*Math.min(1,dt*turn)}}
 function chase(p,x,z,speed,dt){const dx=x-p.x,dz=z-p.z,len=Math.hypot(dx,dz)||1,step=Math.min(len,speed*dt);move(p,p.x+dx/len*step,p.z+dz/len*step,dt)}
 function coverage(dt){receiverIndices.forEach((idx,i)=>{const p=actors[idx],pos=travel(PASSES[selected].routes[i],elapsed*(6.3+i*.2));move(p,p.startX+pos[0],p.startZ+pos[1],dt)});chase(actors[10],9,snapZ+Math.min(elapsed*4,11),4,dt);for(let i=0;i<4;i++){const d=actors[18+i],t=actors[receiverIndices[Math.min(i,2)]];if(elapsed>.22+i*.08)chase(d,t.x+(i%2?1.3:-1.3),t.z+1.2,5.8,dt)}for(let i=15;i<18;i++){const d=actors[i],t=actors[receiverIndices[i-15]];chase(d,clamp(t.x,-10,10),Math.min(t.z+1,snapZ+12),4.6,dt)}}
 function blockers(dt,isRun){for(let i=0;i<5;i++){const p=actors[i],d=actors[11+Math.min(i,3)];p.engaged=true;const lane=isRun?RUNS[selected].path[1][0]*.28:0;const desiredZ=snapZ+(isRun?Math.min(elapsed*1.7,4):-.4-Math.min(elapsed*.55,1.7));chase(p,p.startX+lane,desiredZ,2.8,dt);p.heading=0;if(elapsed<2.3+(i%2)*.4){chase(d,p.x,p.z+.9,4,dt);d.engaged=true;d.heading=Math.PI}else{d.engaged=false;chase(d,carrier.x,carrier.z,5,dt)}}}
 function throwTo(index){if(phase!=='pass'||paused)return;const target=actors[index],routeIndex=receiverIndices.indexOf(index);carrier.hasBall=false;actors[5].throwT=.001;const duration=.60+Math.abs(target.z-carrier.z)*.008,to=routeIndex>=0?predictPassDestination(PASSES[selected].routes[routeIndex],target.startX,target.startZ,elapsed,duration,6.3+routeIndex*.2):[target.x,1.6,target.z];flight={from:[carrier.x,1.55,carrier.z],to,target:index,t:0,duration};phase='flight';updateControls()}
 function endPlay(reason,ballSpot,incomplete=false){if(phase==='dead'||ended)return;const old=drive.ball;phase='dead';flight=null;input.x=0;input.z=0;input.sprint=false;keys.clear();actors.forEach(p=>{p.moving=false;p.engaged=false});if(carrier&&reason==='TACKLED')carrier.fallen=true;drive.ball=incomplete?old:clamp(Math.round(ballSpot),1,100);const gain=drive.ball-old;let copy=reason;
  if(drive.ball>=100){drive.score+=6;message('TOUCHDOWN',3);endDrive('TOUCHDOWN','You finished the drive. Practice results stay separate from your career.');return}
  if(!incomplete){copy+=' · '+(gain>=0?'+':'')+gain+' YDS'}
  if(gain>=drive.toGo){drive.down=1;drive.toGo=Math.min(10,100-drive.ball)}else{drive.down++;drive.toGo=Math.max(1,drive.toGo-gain)}
  message(copy,1.4);updateHud();updateControls();if(drive.down>4){endDrive('TURNOVER ON DOWNS','The defense held. Restart this practice drive to try again.');return}if(drive.clock<=0){endDrive('TIME EXPIRED','The clock reached zero. Your career is unchanged.');return}recoveryLeft=1.2;
 }
 function endDrive(title,body){ended=true;paused=true;phase='dead';$('dialogTitle').textContent=title;$('dialogBody').textContent=body;$('resume').hidden=true;$('paused').hidden=false;updateHud();updateControls()}
 function pause(){if(ended)return;paused=!paused;input.x=input.z=0;input.sprint=false;input.pointer=null;keys.clear();$('knob').style.transform='none';$('dialogTitle').textContent='PAUSED';$('dialogBody').textContent='This preview never changes your career saves or season record.';$('resume').hidden=false;$('paused').hidden=!paused;updateControls()}
 function tick(dt){if(phase==='dead'){if(!ended){recoveryLeft-=dt;if(recoveryLeft<=0)setup()}return}if(phase==='pre')return;elapsed+=dt;drive.clock=Math.max(0,drive.clock-dt);updateHud();
  if(phase==='handoff'){const a=actors[5],b=actors[6];const t=clamp(elapsed/.55,0,1);move(b,-2+2*t,snapZ-7+3.4*t,dt);a.heading=-.3;blockers(dt,true);if(t>=1){a.hasBall=false;b.hasBall=true;carrier=b;phase='run';elapsed=0;updateControls()}return}
  if(phase==='pass'||phase==='flight'){coverage(dt);blockers(dt,false);chase(actors[5],0,snapZ-5-Math.min(elapsed*.4,1.2),.55,dt);actors[5].heading=0;
   if(phase==='pass'&&elapsed>4.6){endPlay('SACK',drive.ball-6);return}
   if(flight){flight.t+=dt/flight.duration;actors[5].throwT=clamp(flight.t,.001,1);if(flight.t>=1){const p=actors[flight.target],distance=Math.min(...actors.filter(a=>a.team===1).map(a=>Math.hypot(a.x-p.x,a.z-p.z)));flight=null;actors[5].throwT=0;if(distance<.9&&rand()<.65){message('PASS BROKEN UP');endPlay('INCOMPLETE',drive.ball,true);return}p.hasBall=true;p.catchT=.35;carrier=p;phase='run';elapsed=0;updateControls();message('COMPLETE · TAKE CONTROL',1)}}
   return;
  }
  if(phase==='run'){
   let x=input.x,z=input.z;const kx=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),kz=(keys.has('ArrowUp')||keys.has('w')?1:0)-(keys.has('ArrowDown')||keys.has('s')?1:0);if(kx||kz){const len=Math.hypot(kx,kz);x=kx/len;z=kz/len}
   if(assist){const gain=Math.max(0,carrier.z-snapZ);const path=mode==='run'?RUNS[selected].path:[[carrier.x,0],[carrier.x,35]];let t=path.find(p=>p[1]>gain+3)||[carrier.x,110-snapZ];const dx=t[0]-carrier.x,dz=snapZ+t[1]-carrier.z,len=Math.hypot(dx,dz)||1;x=dx/len;z=dz/len}else if(!x&&!z)z=.24;
   // Manual steering is camera-relative, so thumb-right means screen-right.
   if(!assist)[x,z]=cameraWorldVector(x,z,camEye,camTarget);
   const boosting=(input.sprint||keys.has('Shift'))&&stamina>0,speed=boosting?9.2:7.2;stamina=clamp(stamina+(boosting?-.31:.09)*dt,0,1);$('stamina').firstElementChild.style.width=(stamina*100)+'%';move(carrier,carrier.x+x*speed*dt,carrier.z+z*speed*dt,dt,10);carrier.catchT=Math.max(0,carrier.catchT-dt);
   blockers(dt,true);for(const p of actors.filter(p=>p.team===1&&p.role!=='DL'))chase(p,carrier.x,carrier.z+1,6.5,dt);
   for(const p of actors.filter(p=>p.team===0&&p.role==='WR'&&p!==carrier))chase(p,p.x,snapZ+Math.min(elapsed*5+4,18),4.5,dt);
   if(carrier.z>=110){endPlay('TOUCHDOWN',100);return}if(Math.abs(carrier.x)>=26){endPlay('OUT OF BOUNDS',carrier.z-10);return}
   if(elapsed>.75&&performance.now()>jukeUntil){const d=actors.find(p=>p.team===1&&Math.hypot(p.x-carrier.x,p.z-carrier.z)<.8);if(d){endPlay('TACKLED',carrier.z-10);return}}
   if(drive.clock<=0||elapsed>16)endPlay(drive.clock<=0?'TIME EXPIRED':'WHISTLE',carrier.z-10);
  }
 }
 function camera(dt){const isPocket=phase==='pre'||phase==='pass',isDead=phase==='dead';let x=0,z=snapZ+2,mult=1;
  if(!isPocket&&!isDead){x=carrier.x*.55;z=carrier.z+5;if(flight){const t=clamp(flight.t,0,1);x=(flight.from[0]+(flight.to[0]-flight.from[0])*t)*.55;z=flight.from[2]+(flight.to[2]-flight.from[2])*t+4}}
  if(phase==='pass'){const deep=Math.max(...receiverIndices.map(i=>actors[i].z));z=(deep+actors[5].z)*.5;mult=clamp(1+(deep-actors[5].z-16)*.018,1,1.7)}
  // Keep contact in view until the next down; move closer only after possession.
  if(isDead){r.camera(camEye,camTarget);return}
  const tracking=phase==='run';
  // Center the pocket and move closer without enlarging athlete geometry.
  // Keep the existing wide/long-flight presentation and receiver-fit guard.
  const desiredEye=tracking?[carrier.x*.9+3,7.4,carrier.z-11]:[x+(isPocket?0:4*mult),(isPocket?6.5:8.5)*mult,(isPocket?snapZ:z)-(isPocket?22:27)*mult];
  const desiredTarget=tracking?[carrier.x*.9,.6,carrier.z+3.5]:[x,1.8,z];
  // Fit actual projected heads/feet above the pre-snap controls. Do not pan the QB away.
  if(isPocket){for(let trial=0;trial<8;trial++){r.camera(desiredEye,desiredTarget);const watch=phase==='pre'?actors.filter(p=>!p.team):[actors[5],...receiverIndices.map(i=>actors[i])];const fits=watch.every(p=>{const h=r.project([p.x,2.1,p.z]),f=r.project([p.x,0,p.z]);return h.y>65&&f.y<r.height-(phase==='pre'?85:22)&&h.x>24&&h.x<r.width-24});if(fits)break;desiredEye[1]*=1.055;desiredEye[2]=desiredTarget[2]+(desiredEye[2]-desiredTarget[2])*1.055}}
  const blend=phase==='pre'?Math.min(1,dt*10):Math.min(1,dt*5);camEye=camEye.map((v,i)=>v+(desiredEye[i]-v)*blend);camTarget=camTarget.map((v,i)=>v+(desiredTarget[i]-v)*blend);r.camera(camEye,camTarget);
 }
 function scene(dt,now){r.begin();stadium.draw();
  // Ground-space field markings share the same perspective as the athletes.
  r.add('plane',pose(0,.025,snapZ,53.15,1,.11),hex('#4599ba'),'',true);
  r.add('plane',pose(0,.03,Math.min(110,snapZ+drive.toGo),53.15,1,.13),hex('#e1c156'),'',true);
  for(const p of actors){r.add('plane',pose(p.x+.13,.038,p.z-.12,1.65,1,1.15),[0,0,0,.75],'shadow',true)}
  if(carrier&&!ended){const cx=carrier.x,cz=carrier.z;for(let i=0;i<32;i++){const a=i/32*2*Math.PI,b=(i+1)/32*2*Math.PI;r.add('cylinder',segment([cx+Math.cos(a)*.70,.045,cz+Math.sin(a)*.70],[cx+Math.cos(b)*.70,.045,cz+Math.sin(b)*.70],.025),hex('#ebce7a'),'',true)}}
  if(phase==='pre'){
   const lists=mode==='run'?[RUNS[selected].path.map(p=>[p[0],snapZ+p[1]])]:PASSES[selected].routes.map((pts,i)=>pts.map(p=>[actors[receiverIndices[i]].startX+p[0],actors[receiverIndices[i]].startZ+p[1]]));
   lists.forEach((pts,i)=>{for(let j=1;j<pts.length;j++){const a=pts[j-1],b=pts[j];r.add('cylinder',segment([a[0],.052,a[1]],[b[0],.052,b[1]],.036),hex(['#d2bb75','#bcced4','#819fae'][i%3]),'',true)}})
  }
  for(const p of actors)drawAthlete(r,p,now/1000,phase);
  if(flight){const t=clamp(flight.t,0,1),p=flight.from.map((v,i)=>v+(flight.to[i]-flight.from[i])*t);p[1]+=Math.sin(Math.PI*t)*3.3;r.add('sphere',pose(...p,.12,.12,.23),hex('#7d4226'));r.add('plane',pose(p[0],.06,p[2],.45,1,.35),[0,0,0,.65],'shadow',true)}
  r.draw();
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
 $('runTab').onclick=()=>setMode('run');$('passTab').onclick=()=>setMode('pass');$('snap').onclick=snap;$('control').onclick=()=>{assist=!assist;input.x=input.z=0;updateControls()};$('pause').onclick=pause;$('resume').onclick=pause;
 $('restart').onclick=()=>{drive={...initialDrive};paused=false;ended=false;$('paused').hidden=true;setup()};
 function joy(e){const box=$('stick').getBoundingClientRect(),dx=e.clientX-box.left-box.width/2,dy=e.clientY-box.top-box.height/2,max=box.width*.32,len=Math.hypot(dx,dy)||1,s=Math.min(1,max/len);input.x=dx*s/max;input.z=-dy*s/max;$('knob').style.transform=`translate(${dx*s}px,${dy*s}px)`;$('stick').setAttribute('aria-valuenow',input.x.toFixed(2))}
 $('stick').onpointerdown=e=>{if(assist||phase!=='run')return;input.pointer=e.pointerId;$('stick').setPointerCapture(e.pointerId);joy(e);e.preventDefault()};$('stick').onpointermove=e=>{if(input.pointer!==e.pointerId)return;joy(e);e.preventDefault()};const clearJoy=()=>{input.x=input.z=0;input.pointer=null;$('knob').style.transform='none'};$('stick').onpointerup=clearJoy;$('stick').onpointercancel=clearJoy;$('stick').onlostpointercapture=clearJoy;
 $('sprint').onpointerdown=e=>{input.sprint=true;$('sprint').setPointerCapture(e.pointerId);e.preventDefault()};$('sprint').onpointerup=()=>input.sprint=false;$('sprint').onpointercancel=()=>input.sprint=false;$('sprint').onlostpointercapture=()=>input.sprint=false;
 const juke=()=>{const now=performance.now();if(phase!=='run'||now<jukeReady)return;const keyboardX=(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),side=(keyboardX||input.x)<0?-1:1,[dx,dz]=cameraWorldVector(side,0,camEye,camTarget);jukeUntil=now+520;jukeReady=now+1500;const targetHeading=Math.atan2(dx,dz),headingDiff=Math.atan2(Math.sin(targetHeading-carrier.heading),Math.cos(targetHeading-carrier.heading));carrier.heading+=headingDiff*.45;carrier.x=clamp(carrier.x+dx*1.15,-25.8,25.8);carrier.z=clamp(carrier.z+dz*1.15,10,110);message('JUKE '+(side>0?'RIGHT':'LEFT'),.45)};$('juke').onclick=juke;
 window.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();const key=normalizeControlKey(e.key);keys.add(key);if(e.code==='Space'&&!e.repeat)snap();if(['1','2','3'].includes(key))throwTo(receiverIndices[Number(key)-1]);if(key==='Escape'&&!e.repeat)pause();if(key==='j')juke()});window.addEventListener('keyup',e=>keys.delete(normalizeControlKey(e.key)));
 window.addEventListener('blur',()=>{keys.clear();input.sprint=false;clearJoy();if(!paused&&!ended)pause()});document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden&&!paused&&!ended)pause()});window.addEventListener('resize',()=>{r.resize();last=performance.now();if(innerHeight>innerWidth&&!paused&&!ended)pause()});window.addEventListener('pagehide',()=>cancelAnimationFrame(raf));window.addEventListener('pageshow',e=>{if(e.persisted){last=performance.now();raf=requestAnimationFrame(loop)}});
 const portrait=matchMedia('(orientation:portrait)');portrait.addEventListener('change',event=>{if(event.matches&&!paused&&!ended)pause()});
 setup();camera(1);scene(.016,0);$('loading').hidden=true;raf=requestAnimationFrame(loop);
 // Test controls exist only on an explicitly requested QA URL. This isolated
 // practice renderer never reads or writes career saves or result payloads.
 if(new URLSearchParams(location.search).has('qa')){window.bk3dTest={manualFrames(){qaStepping=true;accumulator=0;cancelAnimationFrame(raf)},step(seconds){const n=Math.ceil(clamp(seconds,0,10)*60);for(let i=0;i<n;i++){if(!paused)simulate(1/60);camera(1/60)}scene(.016,performance.now())}};window.bk3dDiagnostics=()=>({phase,paused,ended,frames:frameId,drawCalls:r.drawCalls,glError:r.gl.getError(),players:actors.map(p=>({role:p.role,team:p.team,x:p.x,z:p.z,distance:p.distance,heading:p.heading,pose:p.motion?{speed:p.motion.speed,run:p.motion.run,ready:p.motion.ready,block:p.motion.block,turn:p.motion.turn,gait:p.motion.gait,fall:p.motion.fall}:null,head:r.project([p.x,2.1,p.z]),foot:r.project([p.x,0,p.z])})),drive:{...drive},stamina,worldObjects:stadium.parts});}
}