import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as playbook from '../public/play-moment-3d/playbook.js';
import {QB_THROW_RELEASE,quarterbackThrowDuration} from '../public/play-moment-3d/quarterback.js';
import {playerTopSpeed,playerRunSpeed} from '../public/play-moment-3d/game.js';
import * as math from '../public/play-moment-3d/renderer.js';
import {advanceMotion} from '../public/play-moment-3d/athlete.js';
import {knockDownPlayer,advancePlayerAction,blockOutcome,pursuitRole,pursuitTarget} from '../public/play-moment-3d/game.js';
import {groundedStride,meshyAnimationState} from '../public/play-moment-3d/meshy-athlete.js';
// Live recovery and dead-ball finishes must take different paths.
for(const type of['miss','tackle','pancake']){
 const p={vx:7,vz:4,engaged:true};knockDownPlayer(p,0,type,.6);assert.equal(p.vx,0);assert.equal(p.engaged,false);
 advancePlayerAction(p,.7);assert.ok(p.fallen);advancePlayerAction(p,1.06);assert.equal(p.action,'get-up');advancePlayerAction(p,1.5);assert.ok(p.fallen);advancePlayerAction(p,2.2);assert.equal(p.fallen,false);assert.equal(p.action,null);
 knockDownPlayer(p,2,type,.6);advancePlayerAction(p,10,true);assert.ok(p.fallen);assert.equal(p.actionT,1);
}
let pancakes=0;for(let i=0;i<1000;i++)if(blockOutcome(84,78,.5,i/1000)==='pancake')pancakes++;assert.ok(pancakes<40,`Too many knockdowns: ${pancakes}`);
const runner={x:20,z:45,vx:2,vz:7},near={index:15,team:1,x:17,z:45},safety={index:21,team:1,x:24,z:57},back={index:16,team:1,x:0,z:40};
assert.equal(pursuitRole(near,runner,[near,safety,back]),'primary');assert.equal(pursuitRole(safety,runner,[near,safety,back]),'contain');
const cutoff=pursuitTarget(safety,runner,false,8,'contain');assert.ok(cutoff.z>runner.z&&cutoff.z<safety.z&&cutoff.x>runner.x&&cutoff.x<=25.8);
// During stance, model-space foot travel must cancel world movement exactly.
const stepA=groundedStride(.2),stepB=groundedStride(.3);assert.ok(stepA.planted&&stepB.planted);assert.ok(Math.abs((stepB.z-stepA.z)*1.17+.1)<1e-9);
assert.equal(meshyAnimationState({fallen:true,role:'LB',vx:8,vz:2},'run'),'tackle');

// Exercise the real game controller and camera math with only DOM/GPU I/O stubbed.
const source=fs.readFileSync(new URL('../public/play-moment-3d/game.js',import.meta.url),'utf8').replace(/^import.*;\n/gm,'').replace(/^export\{.*;\n/gm,'').replace(/export /g,'');
function game(width=844,height=335,leavePlaybookOpen=false,assist=true){
 const elements=new Map(),events=new Map(),rendered=new Map();let renderer;
 const element=id=>{if(elements.has(id))return elements.get(id);const el={id,hidden:false,children:[],style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},setPointerCapture(){},replaceChildren(){this.children=[]},append(...c){this.children.push(...c);for(const child of c)if(child.id)elements.set(child.id,child)},appendChild(c){this.append(c)},getBoundingClientRect(){return ['pre','plays'].includes(id)?{top:height-105,left:0,width,height:105}:id==='header'?{left:width*.3,right:width*.7,top:8,bottom:58}:id==='moves'?{left:width-190,right:width-18,top:height-110,bottom:height-18,width:172,height:92}:id==='stick'?{left:30,right:120,top:height-110,bottom:height-20,width:90,height:90}:{left:0,top:0,width,height,right:width,bottom:height}}};Object.defineProperty(el,'firstElementChild',{get(){return this.children[0]||(this.children[0]={style:{}})}});elements.set(id,el);return el};
 class HeadlessRenderer{constructor(){renderer=this;this.width=width;this.height=height;this.vp=math.identity();this.gl={getError:()=>0};this.drawCalls=0;this.eye=[0,0,0]}camera=math.Renderer.prototype.camera;project=math.Renderer.prototype.project;begin(){}add(){}draw(){}lateBegin(){}drawLate(){}glow(){}}
 const noop=()=>{},context={...math,...playbook,QB_THROW_RELEASE,quarterbackThrowDuration,Renderer:HeadlessRenderer,drawAthlete:(_r,p,time)=>rendered.set(p.index,{...p,motion:p.motion?{...p.motion}:null,time}),prepareJerseys:noop,advanceMotion,makeStadium:()=>({draw:noop,parts:0}),createMeshyAthletes:()=>({ready:false,ballAnchor:()=>null,draw:noop,diagnostics:()=>({})}),createGameplayReplayRecorder:()=>({event:noop,sample:noop}),console,URLSearchParams,performance:{now:()=>0},location:{search:assist?'?qa&assist=1':'?qa'},navigator:{vibrate:noop},document:{hidden:false,getElementById:element,createElement:()=>element('generated-'+elements.size),querySelector:()=>element('header'),querySelectorAll:()=>[],addEventListener:noop},requestAnimationFrame:()=>1,cancelAnimationFrame:noop,matchMedia:()=>({addEventListener:noop}),innerWidth:width,innerHeight:height,addEventListener:(name,fn)=>events.set(name,fn)};context.window=context;
 vm.createContext(context);vm.runInContext(source.replace('window.bk3dTest={','window.bk3dRenderActors=()=>actors.map(p=>({...p}));window.bk3dFixture={throwTo,finish:endPlay,drive(values){Object.assign(drive,values)},mutate(fn){fn(actors)},touchdown(){endPlay("TOUCHDOWN",100)},seed(value){numSeed=value},present,camera};window.bk3dTest={')+'\nstart();',context);context.bk3dTest.manualFrames();if(!leavePlaybookOpen)element('breakHuddle').onclick();
 return{context,element,events,renderer,rendered,step:t=>context.bk3dTest.step(t),read:()=>context.bk3dDiagnostics(),snap:()=>element('snap').onpointerdown({preventDefault:noop}),key:key=>events.get('keydown')({key,code:key,preventDefault:noop})};
}
// The ball must follow center -> snap flight -> QB -> exchange -> RB.
for(let play=0;play<4;play++)for(const flip of[false,true]){
 const g=game();g.element('plays').children[play].onclick();if(flip)g.context.bk3dTest.flipPlay();
 const stick=g.element('stick').getBoundingClientRect();g.element('stick').onpointerdown({pointerId:1,clientX:stick.left+stick.width/2,clientY:stick.top+stick.height/2-25,preventDefault(){}});
 assert.equal(g.read().players[2].hasBall,true,'Center starts with ball');g.snap();g.step(.13);assert.equal(g.read().phase,'snap');assert.ok(g.read().players.every(p=>!p.hasBall),'Snap is in flight, not in RB hands');
 const midpoint=g.read().exchange.ball;assert.ok(midpoint[2]>30&&midpoint[2]<35,'Snap travels between center and QB');
 g.step(.19);let d=g.read();assert.equal(d.phase,'handoff');assert.equal(d.players[5].hasBall,true);assert.equal(d.players[6].hasBall,false);let qbTravel=0,transfer=false;
 for(let i=0;i<110;i++){
  g.step(1/60);d=g.read();qbTravel=Math.max(qbTravel,Math.hypot(d.players[5].x,d.players[5].z-30));
  assert.ok(d.players.filter(p=>p.hasBall).length<=1,'Only one player owns the ball');
  if(d.players[6].hasBall&&!transfer){transfer=true;const q=d.players[5],b=d.players[6],separation=Math.hypot(q.x-b.x,q.z-b.z);if(play!==3)assert.ok(separation<1.05,'Handoff transfers only at the mesh point');else assert.ok(separation>2,'Toss must travel through the air')}
  if(d.phase==='run')break;
 }
 assert.ok(transfer&&qbTravel>.6,'QB must move through exchange');assert.equal(d.phase,'run');
 const before={...d.players[6]};g.step(.12);const after=g.read().players[6];assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>.2,'Held stick remains active after exchange');
}
{
 const g=game();g.element('passTab').onclick();g.snap();g.step(.14);assert.equal(g.read().phase,'snap');g.step(.16);assert.equal(g.read().phase,'pass');assert.equal(g.read().players[5].hasBall,true);
}
for(const [w,h]of[[844,335],[932,430],[740,330]]){
 const g=game(w,h);g.element('passTab').onclick();g.snap();let result;
 for(let i=0;i<420;i++){g.step(1/60);result=g.read();if(result.phase==='dead')break}
 assert.equal(result.phase,'dead','A stationary QB should be sacked');assert.ok(result.contact,'Sack must start paired contact');assert.equal(result.players[5].fallen,true);assert.ok(result.players[result.lastTackler].fallen);
 const clock=result.drive.clock;g.step(1.15);assert.equal(g.read().players[5].actionT,1,'QB must finish on turf');assert.equal(g.read().drive.clock,clock,'Dead-ball animation must not run the game clock');
 g.step(1.8);assert.ok(g.read().players.every(p=>!p.fallen),'Players must get up before reset');g.step(1.1);assert.equal(g.read().phase,'pre');for(const p of g.read().players)assert.equal(p.fallen,false);
 // Camera is continuous between dead ball and setup; then fits the offensive lineup.
 for(let i=0;i<150;i++)g.step(1/60);for(const p of g.read().players.filter(p=>!p.team)){assert.ok(p.foot.y<h-95&&p.head.y>55,`${w}: formation overlaps HUD`)}
}
for(let play=0;play<4;play++){
 const g=game();g.element('plays').children[play].onclick();g.key('ArrowUp');g.snap();let maxDown=0,frames=0;
 for(let i=0;i<650;i++){g.step(1/60);const d=g.read();maxDown=Math.max(maxDown,d.players.filter(p=>p.fallen).length);for(const p of d.players){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));if(p.fallen)assert.ok(Math.hypot(p.vx,p.vz)<.001,'Prone player must not chase')}frames++;if(d.phase==='dead')break}
 assert.ok(frames>20);console.log(`Run ${play}: ${frames} frames, maximum ${maxDown} downed players, spot ${g.read().drive.ball}.`);
}
// Pass protectors move once per step and contact poses require proximity.
{
 const g=game();g.element('passTab').onclick();g.snap();let previous=g.read().players,turned=false;
 for(let frame=0;frame<220;frame++){
  g.step(1/60);const d=g.read();if(d.phase==='snap'){previous=d.players;continue}if(d.phase!=='pass')break;
  for(let index=0;index<5;index++){
   const p=d.players[index],before=previous[index];
   assert.ok(p.distance-before.distance<=2.8/60+.001,'Pass blocker locomotion applied twice');
   assert.ok(Math.hypot(p.x-before.x,p.z-before.z)<.22,'Collision correction teleported blocker');
   if(d.elapsed>2.5&&!p.engaged&&Math.abs(p.heading)>.3)turned=true;
   if(p.engaged){const defender=d.players[p.engagedWith];assert.ok(Math.hypot(p.x-defender.x,p.z-defender.z)<1.6,'Block pose started before contact')}
  }
  previous=d.players;
 }
 assert.ok(turned,'A beaten blocker must turn to follow the rush');
}
// Follow an actual throw through flight/end with bounded camera motion.
{
 const g=game();g.element('passTab').onclick();g.snap();g.step(.7);g.key('x');g.step(.23);assert.equal(g.read().phase,'flight');let previous=[...g.renderer.eye],maxCameraStep=0;
 for(let i=0;i<240;i++){g.step(1/60);const eye=g.renderer.eye,delta=Math.hypot(...eye.map((v,n)=>v-previous[n]));maxCameraStep=Math.max(maxCameraStep,delta);previous=[...eye];assert.ok(eye.every(Number.isFinite));}
 assert.ok(maxCameraStep<2,`Camera jumped ${maxCameraStep} yards in one frame`);console.log(`Pass/flight camera maximum per-frame travel: ${maxCameraStep.toFixed(3)} yards.`);
}
// Reproduce the recording's sideline pursuit, whistle and snap-control states.
for(const play of[1,3])for(const call of[0,2,4]){
 const g=game();g.context.bk3dTest.setSnapNumber(call);g.element('plays').children[play].onclick();
 const box=g.element('stick').getBoundingClientRect();
 const steer=(x,z)=>g.element('stick').onpointerdown({pointerId:1,clientX:box.left+box.width/2+x*box.width*.32,clientY:box.top+box.height/2-z*box.height*.32,preventDefault(){}});
 steer(-.7,.7);g.snap();let airborne=0,endedAt=0;
 for(let i=0;i<900;i++){
  g.step(1/60);const d=g.read();
  if(d.exchange?.kind==='pitch'&&d.elapsed>.48&&d.elapsed<.78){assert.ok(d.players.every(p=>!p.hasBall),'Pitch flight must have no owner');airborne++}
  if(d.phase==='run')steer(d.players[6].x<-19?0:-.65,1);
  if(d.phase==='dead'){endedAt=i;break}
 }
 assert.ok(endedAt>0,'A sideline run must resolve');if(play===3)assert.ok(airborne>5,'Pitch should have a readable flight');
 const atWhistle=g.read(),clock=atWhistle.drive.clock;
 assert.equal(g.element('live').hidden,true,'Live controls must disappear at the whistle');
 g.step(.7);const resting=g.read();
 for(let i=0;i<22;i++)if(!resting.players[i].fallen)assert.ok(Math.hypot(resting.players[i].vx,resting.players[i].vz)<.15,'Upright players stop after whistle');
 assert.equal(resting.drive.clock,clock);
 console.log(`Sideline ${play}, defense ${call}: spot ${atWhistle.drive.ball}, resolved in ${(endedAt/60).toFixed(2)}s.`);
}

// The new recording catches a ball and reaches the goal line before catchT
// expires. Test the actual finish path with the live catch overlay still set.
{
 const g=game(1108,512);g.key('ArrowUp');g.snap();g.step(1.5);
 g.context.bk3dFixture.mutate(actors=>{const p=actors[6];p.catchT=.4;p.throwT=.3;p.reactionT=.6;p.z=110;p.action='hurdle';p.actionT=.5;actors[15].x=p.x+.5;actors[15].z=p.z;actors[15].reactionT=.7;});
 g.context.bk3dFixture.touchdown();g.step(.8);
 const d=g.read();assert.ok(d.ended);assert.equal(d.drive.score,30);
 const poses=g.context.bk3dRenderActors();
 for(const p of poses){assert.equal(p.catchT,0);assert.equal(p.throwT,0);assert.equal(p.reactionT,0);if(!p.fallen)assert.ok(['rest','celebrate'].includes(meshyAnimationState(p,'dead')));}
 assert.equal(poses[6].action,'celebrate');
 assert.ok(Math.hypot(poses[6].x-poses[15].x,poses[6].z-poses[15].z)>=1.4,'Finish must leave space around the scorer');
 assert.equal(g.element('live').hidden,true);g.step(3.5);assert.ok(g.read().paused);
}
// Require a successful catch, rather than allowing the camera test to pass
// after an incompletion. Track screen motion at the ownership transition.
for(const targetKey of ['x','y','z']){
 const g=game(844,390);g.element('passTab').onclick();g.element('plays').children[1].onclick();g.snap();g.step(.8);g.context.bk3dFixture.seed(500);g.key(targetKey);
 let previous=g.read(),caught=false,maxEyeStep=0,catchPixels=0;
 for(let frame=0;frame<170;frame++){
  g.step(1/60);const d=g.read();
  maxEyeStep=Math.max(maxEyeStep,Math.hypot(...d.camera.eye.map((v,i)=>v-previous.camera.eye[i])));
  if(previous.phase==='flight'&&d.phase==='run'){
   caught=true;const index=d.players.findIndex(p=>p.hasBall),a=previous.players[index].head,b=d.players[index].head;
   catchPixels=Math.hypot(a.x-b.x,a.y-b.y);assert.ok(catchPixels<18,`Catch camera moved ${catchPixels}px`);
  }
  previous=d;if(d.phase==='dead')break;
 }
 assert.ok(caught,`Camera case ${targetKey} must catch the pass`);assert.ok(maxEyeStep<=1.084);
 console.log(`Caught ${targetKey}: camera step ${maxEyeStep.toFixed(3)} yards, receiver motion ${catchPixels.toFixed(2)}px at catch.`);
}

// Real renderer allocation growth: tiny material batches must not reserve 4096 instances.
let allocated=0;const gl=new Proxy({createVertexArray:()=>({}),createBuffer:()=>({}),bufferData:(target,data)=>{allocated+=typeof data==='number'?data:data.byteLength}}, {get:(o,k)=>o[k]??(()=>{})});
const r=Object.create(math.Renderer.prototype);Object.assign(r,{gl,shapes:{cube:{v:Array(24).fill(0),ix:[0,1,2]}},geometry:new Map(),batches:new Map(),overflows:0});
for(let i=0;i<60;i++)r.add('cube',math.identity(),[1,1,1,1],'material-'+i);const bytes=[...r.batches.values()].reduce((n,b)=>n+b.data.byteLength,0);assert.equal(r.geometry.size,1);assert.ok(bytes<200000);
for(let i=0;i<80;i++)r.add('cube',math.identity(),[1,1,1,1],'material-0');assert.ok([...r.batches.values()][0].capacity>=81);assert.equal(r.overflows,0);
console.log(`Recovery checks passed: sacks at three mobile sizes, four run concepts, get-ups, containment, planted step travel, shared geometry, ${bytes} instance bytes across 60 batches.`);

// Capture actual controller states, including shared ball/contact targets.
function renderFrame(g){const d=g.read();return{phase:d.phase,time:d.simTime,ball:d.exchange?.ball||null,actors:g.context.bk3dRenderActors().map(p=>({...p,motion:p.motion?{...p.motion}:null}))}}
function centerFrames(frames,ids,origin){for(const frame of frames){if(frame.ball)frame.ball=[frame.ball[0]-origin[0],frame.ball[1],frame.ball[2]-origin[1]];frame.actors=frame.actors.filter(p=>ids.includes(p.index)).map(p=>({...p,x:p.x-origin[0],z:p.z-origin[1],ballTarget:p.ballTarget?[p.ballTarget[0]-origin[0],p.ballTarget[1],p.ballTarget[2]-origin[1]]:null}))}}
const captureFlag=process.argv.indexOf('--capture');
if(captureFlag>=0){
 const scenarios=[];
 for(const scenario of['run tackle','QB sack']){
  const g=game(),frames=[];if(scenario==='QB sack')g.element('passTab').onclick();else g.key('ArrowUp');g.snap();let contactAt=-1,ids;
  for(let frame=0;frame<900;frame++){
   g.step(1/60);const d=g.read();frames.push(renderFrame(g));
   if(contactAt<0&&d.contact){contactAt=frame;ids=[frames.at(-1).actors.find(p=>p.hasBall).index,d.lastTackler]}
   if(contactAt>=0&&frame>=contactAt+155)break;
  }
  assert.ok(contactAt>=0,'Recorded play must reach paired contact');
  const start=frames[contactAt].actors[ids[0]];centerFrames(frames,ids,[start.x,start.z]);
  scenarios.push({label:scenario,frames,selected:[5,27,63,145].map(offset=>({frameIndex:contactAt+offset,label:`${scenario} +${(offset/60).toFixed(2)}s`}))});
 }
 fs.writeFileSync(process.argv[captureFlag+1],JSON.stringify(scenarios));console.log('Captured paired tackles and recovery.');
}
const exchangeFlag=process.argv.indexOf('--capture-exchanges');
if(exchangeFlag>=0){
 const scenarios=[];
 for(const play of[0,3]){
  const g=game(),frames=[];g.element('plays').children[play].onclick();g.snap();
  for(let frame=0;frame<115;frame++){g.step(1/60);frames.push(renderFrame(g))}
  centerFrames(frames,[2,5,6],[0,30]);
  scenarios.push({label:play?'pitch':'handoff',frames,selected:(play?[6,26,50,72]:[6,26,53,84]).map(frameIndex=>({frameIndex,label:`${play?'Pitch':'Handoff'} ${(frameIndex/60).toFixed(2)}s`}))});
 }
 fs.writeFileSync(process.argv[exchangeFlag+1],JSON.stringify(scenarios));console.log('Captured center/QB/RB exchanges.');
}

const blockFlag=process.argv.indexOf('--capture-blocks');
if(blockFlag>=0){
 const scenarios=[];
 for(const mode of['run','pass']){
  const g=game(),frames=[];if(mode==='pass')g.element('passTab').onclick();g.snap();
  for(let frame=0;frame<125;frame++){g.step(1/60);frames.push(renderFrame(g))}
  centerFrames(frames,[0,11],[-4.4,34.65]);
  scenarios.push({label:mode+' blocking',frames,selected:[25,45,70,108].map(frameIndex=>({frameIndex,label:`${mode} block ${(frameIndex/60).toFixed(2)}s`}))});
 }
 fs.writeFileSync(process.argv[blockFlag+1],JSON.stringify(scenarios));console.log('Captured sustained run/pass blocks.');
}

// Holding an empty sprint must settle into a steady run, not regenerate one
// frame of stamina and repeatedly restart the animation transition.
for(const keyboard of [false,true]){
 const g=game();g.snap();g.step(1.4);
 g.context.bk3dFixture.mutate(players=>players.filter(p=>p.team).forEach(p=>{p.x=100;p.z=100}));
 const stick=g.element('stick').getBoundingClientRect();
 g.element('stick').onpointerdown({pointerId:1,clientX:stick.left+45,clientY:stick.top,preventDefault(){}});
 const press=()=>keyboard?g.key('Shift'):g.element('sprint').onpointerdown({pointerId:2,preventDefault(){}});
 const release=()=>keyboard?g.events.get('keyup')({key:'Shift',code:'Shift'}):g.element('sprint').onpointerup({pointerId:2});
 const advance=()=>{g.context.bk3dFixture.mutate(players=>players.forEach(p=>{if(p.hasBall){p.x=0;p.z=40}else if(p.team){p.x=100;p.z=100}}));g.step(1/60)};
 press();let peakSprintSpeed=0;for(let i=0;i<300;i++){advance();const running=g.context.bk3dRenderActors().find(p=>p.hasBall);if(running.sprinting)peakSprintSpeed=Math.max(peakSprintSpeed,Math.hypot(running.vx,running.vz))}assert.ok(peakSprintSpeed>10,`Sprint reaches the quicker target speed: ${peakSprintSpeed.toFixed(2)}`);assert.equal(g.read().stamina,0);
 for(let i=0;i<60;i++){
  advance();assert.equal(g.read().phase,'run');assert.equal(g.read().stamina,0);
  const carrier=g.context.bk3dRenderActors().find(p=>p.hasBall);assert.ok(Math.hypot(carrier.vx,carrier.vz)>7.7,'Exhausted carrier keeps the quicker normal run speed');
  assert.equal(carrier.sprinting,false,'Empty held sprint must stay in run animation');
 }
 release();g.step(.5);assert.ok(g.read().stamina>.04,'Release restores stamina');
 press();g.step(1/60);assert.equal(g.context.bk3dRenderActors().find(p=>p.hasBall).sprinting,true,'Recovered sprint works again');
}
console.log('Exhausted sprint stays stable for touch and keyboard');

// Exercise interpolation through the real present() path, not just its helper.
{
 const g=game();g.snap();g.step(1.2);g.context.bk3dFixture.present(0,1);const before=g.read().players;g.step(1/60);const authoritative=g.read().players;
 g.context.bk3dFixture.present(1/120,.5);
 const shown=g.rendered.get(6),expected=(before[6].z+authoritative[6].z)/2;
 assert.ok(Math.abs(shown.z-expected)<1e-9,'120 Hz render interpolates the moving carrier');
 assert.equal(g.read().players[6].z,authoritative[6].z,'Rendering cannot mutate simulation positions');
 assert.ok(Number.isFinite(shown.motion.stridePhase),'Render gait phase stays finite');
 g.context.bk3dFixture.present(1/120,1);assert.equal(g.rendered.get(6).z,authoritative[6].z);
 console.log('Real presentation path: interpolated carrier, finite stride phase, authoritative state unchanged.');
}

// Ball stays owned through the windup, leaves once, and arm timing does not
// stretch with the length or arc of the pass.
for(const kind of ['bullet','touch','lob']){
 const g=game();g.element('passTab').onclick();g.snap();g.step(.8);
 const duration=quarterbackThrowDuration(kind),release=duration*QB_THROW_RELEASE;
 g.context.bk3dFixture.throwTo(7,kind);
 assert.equal(g.read().phase,'pass');assert.ok(g.read().throwing);assert.ok(g.read().players[5].hasBall);
 g.step(release-.025);assert.ok(g.read().players[5].hasBall,'Windup cannot launch a chest pass');
 g.step(.04);assert.equal(g.read().phase,'flight');assert.equal(g.read().players[5].hasBall,false);assert.equal(g.read().throwing,null);
 const before=g.read().simTime;g.step(.1);const d=g.read();
 assert.ok(d.players[5].throwT>QB_THROW_RELEASE,'Follow-through continues after release');
 assert.ok(Math.abs(d.players[5].throwT-(d.simTime-.8)/duration)<.04,'Throw pose follows its own clock');
 assert.ok(d.simTime>before);
}
// A scramble is a commitment to carry with the same player and ratings.
// Pausing freezes a pending release, and a sack cancels it without a ghost pass.
for(const interruptedBy of ['pause','sack']){
 const g=game();g.element('passTab').onclick();g.snap();g.step(.8);g.key('x');
 if(interruptedBy==='pause'){
  const before=g.read().simTime;g.element('pause').onclick();g.step(.5);
  assert.equal(g.read().simTime,before);assert.ok(g.read().players[5].hasBall);assert.ok(g.read().throwing);
  g.element('resume').onclick();g.step(.24);assert.equal(g.read().phase,'flight');
 }else{
  g.context.bk3dFixture.mutate(players=>{const qb=players[5],d=players[11];d.x=qb.x;d.z=qb.z+.1;d.engaged=false;d.engagedWith=null;players[0].x=100});
  g.step(1/60);assert.equal(g.read().phase,'dead');assert.equal(g.read().throwing,null);
  g.step(.3);assert.equal(g.read().phase,'dead');assert.equal(g.read().throwKind,null);
 }
}
// Sprint and ordinary running both use the same curve at every position.
for(const rating of [35,55,75,95,99])for(const sprint of [false,true]){
 const g=game();g.element('passTab').onclick();g.snap();g.step(.4);
 g.context.bk3dFixture.mutate(players=>{players.filter(p=>p.team).forEach(p=>{p.x=100;p.z=200});const q=players[5];q.ratings={...q.ratings,speed:rating};q.x=16;q.z=28});
 g.element('scramble').onclick();if(sprint)g.key('Shift');g.step(1.2);
 const d=g.read(),q=d.players[5];assert.equal(d.phase,'run');assert.ok(q.hasBall);assert.equal(g.element('scramble').hidden,true);
 assert.ok(Math.abs(Math.hypot(q.vx,q.vz)-playerRunSpeed(q,sprint))<.04,`SPD ${rating} ${sprint?'sprint':'run'} ignores rating`);
 g.key('x');assert.equal(g.read().phase,'run','Tucked QB cannot throw');
 for(const role of ['QB','RB','WR','TE','OL','DL','LB','DB'])assert.equal(playerTopSpeed({role,ratings:{speed:rating}}),playerTopSpeed(q),'Position must not override speed rating');
}
{
 const g=game();g.element('passTab').onclick();g.snap();g.step(.4);
 g.context.bk3dFixture.mutate(players=>{players.filter(p=>p.team).forEach(p=>{p.x=100;p.z=200});const q=players[5];q.x=16;q.z=28});
 const target=g.read().field.lineToGain;g.element('scramble').onclick();g.step(5);
 assert.equal(g.read().phase,'run');assert.ok(g.read().players[5].z>target+12,'QB must keep running well past the first-down line');
 const spot=g.read().players[5].z-10;g.context.bk3dFixture.finish('TACKLED',spot);
 assert.equal(g.read().drive.down,1);assert.equal(g.read().drive.ball,Math.round(spot));assert.equal(g.read().drive.toGo,10);
}
{
 const g=game();g.element('passTab').onclick();g.snap();g.step(.4);
 g.context.bk3dFixture.mutate(players=>{players.filter(p=>p.team).forEach(p=>{p.x=100;p.z=-200});const q=players[5];q.x=16;q.z=28;q.ratings={...q.ratings,speed:35}});
 g.context.bk3dFixture.drive({clock:.2});g.element('scramble').onclick();g.step(10);g.step(6.4);
 assert.equal(g.read().drive.clock,0);assert.equal(g.read().phase,'run','Neither clock zero nor the old 16-second cap may whistle a live carry');
 g.context.bk3dFixture.mutate(players=>{players[5].z=109.98});g.step(.1);
 assert.equal(g.read().phase,'dead');assert.equal(g.read().drive.score,30,'A scrambling QB can finish a touchdown');
}
// Manual button + keyboard shortcut, and the existing cross-line conversion.
for(const via of ['button','keyboard','line']){
 const g=game();g.element('pause').onclick();g.element('control').onclick();g.element('resume').onclick();g.element('passTab').onclick();g.snap();g.step(.4);
 g.context.bk3dFixture.mutate(players=>{players.filter(p=>p.team).forEach(p=>{p.x=100;p.z=200});players[5].x=16;if(via==='line')players[5].z=35.2});
 g.key('ArrowUp');if(via==='button')g.element('scramble').onclick();if(via==='keyboard')g.key('g');g.step(.1);
 assert.equal(g.read().phase,'run');assert.equal(g.read().assist,false);assert.ok(g.read().players[5].hasBall);
}
console.log('QB checks passed: three timed deliveries, ten rating/sprint cases, scramble controls, extra yards, first-down spot and touchdown after clock zero.');

// Play calling freezes the game until the chosen call is confirmed. Exercise
// filtering, pause/resume, return from the line, next down and drive restart.
{
 const g=game(667,290,true),clock=g.read().drive.clock;
 assert.equal(g.read().playbook.open,true);assert.equal(g.element('playbookGrid').children.length,32);
 assert.equal(g.element('pre').hidden,true);assert.equal(g.element('live').hidden,true);
 g.snap();g.key('Space');g.step(4);assert.equal(g.read().phase,'pre');assert.equal(g.read().drive.clock,clock);assert.equal(g.read().drive.plays,0);
 g.element('filterPass').onclick();assert.equal(g.element('playbookGrid').children.length,14);assert.ok(g.element('playbookGrid').children.every(p=>p.dataset.mode==='pass'));
 g.element('call-pass-1').onclick();assert.equal(g.element('callName').textContent,'VERTICALS');assert.equal(g.read().mode,'run','Draft call must not start gameplay');
 g.element('pause').onclick();assert.equal(g.element('playbook').hidden,true);g.element('resume').onclick();assert.equal(g.element('playbook').hidden,false);assert.equal(g.read().playbook.choice.index,1);
 g.element('filterRun').onclick();assert.equal(g.element('playbookGrid').children.length,18);assert.ok(g.element('playbookGrid').children.every(p=>p.dataset.mode==='run'));
 g.element('filterAll').onclick();assert.equal(g.element('playbookGrid').children.length,32);g.element('call-pass-1').onclick();
 g.element('breakHuddle').onclick();assert.equal(g.read().playbook.open,false);assert.equal(g.read().mode,'pass');assert.equal(g.read().selected,1);assert.equal(g.element('playName').textContent,'VERTICALS');assert.equal(g.element('pre').hidden,false);
 g.element('flipPlay').onclick();assert.equal(g.read().preSnap.runDirection,-1);
 g.element('openPlaybook').onclick();assert.equal(g.read().playbook.choice.index,1);g.element('call-run-2').onclick();g.element('breakHuddle').onclick();assert.equal(g.read().mode,'run');assert.equal(g.read().selected,2);assert.equal(g.read().preSnap.runDirection,1);
 g.snap();g.step(2);assert.equal(g.read().phase,'run');g.context.bk3dTest.forceContact('big-hit');assert.equal(g.element('instruction').hidden,true,'No setup banner after the whistle');g.step(5);assert.equal(g.read().phase,'pre');assert.equal(g.read().playbook.open,true);assert.equal(g.read().drive.down,2);
 const nextClock=g.read().drive.clock;g.step(4);assert.equal(g.read().drive.clock,nextClock);
 assert.ok(g.read().replay.available>0);g.element('pause').onclick();g.element('watchReplay').onclick();assert.equal(g.read().replay.replaying,true);assert.equal(g.element('playbook').hidden,true);g.step(8);assert.equal(g.read().paused,true);g.element('resume').onclick();assert.equal(g.element('playbook').hidden,false);assert.equal(g.read().drive.clock,nextClock);
 g.element('pause').onclick();g.element('restart').onclick();assert.equal(g.read().playbook.open,true);assert.equal(g.read().drive.down,1);assert.equal(g.read().drive.clock,78);
 console.log('Playbook: 32 calls, filters, confirmation, pause, audibles, next down and restart passed.');
}

// Pre-snap tools must change the real controller without resetting the formation.
{
 const g=game(),clock=g.read().drive.clock;
 assert.equal(g.read().preSnap.playArt,false);assert.equal(g.element('prePanel').hidden,true);
 assert.equal(g.element('playerNames').hidden,true);
 g.element('playArt').onclick();assert.equal(g.read().preSnap.playArt,true);assert.equal(g.element('playerNames').hidden,false);
 g.element('playArt').onclick();assert.equal(g.read().preSnap.playArt,false);assert.equal(g.element('playerNames').hidden,true);
 g.key('p');assert.equal(g.read().preSnap.playArt,true);g.events.get('keyup')({key:'p'});assert.equal(g.read().preSnap.playArt,true,'Play art remains visible after releasing P');
 g.key('p');assert.equal(g.read().preSnap.playArt,false);
 g.element('adjustPlay').onclick();assert.equal(g.read().preSnap.panel,'adjust');g.key('Escape');assert.equal(g.read().preSnap.panel,null);assert.equal(g.read().paused,false);
 g.element('adjustPlay').onclick();g.element('flipPlay').onclick();g.element('audibleTab').onclick();
 let choices=g.element('quickAudibles').children;
 assert.equal(choices.length,3);assert.equal(new Set(choices.map(p=>p.dataset.mode+p.dataset.index)).size,3);
 assert.ok(choices.every(p=>p.dataset.mode!=='run'||p.dataset.index!=='0'));
 const positions=JSON.stringify(g.read().players.map(p=>[p.x,p.z]));choices[1].onclick();
 assert.equal(g.read().mode,'pass');assert.equal(g.read().playbook.open,false);assert.equal(g.read().preSnap.panel,null);assert.equal(g.read().preSnap.runDirection,-1);assert.equal(JSON.stringify(g.read().players.map(p=>[p.x,p.z])),positions);
 assert.equal(g.element('identifyMike').hidden,true);assert.equal(g.read().drive.clock,clock);
 g.element('control').onclick();assert.equal(g.read().assist,true,'Mode changes belong in pause settings');
 g.key('p');g.element('pause').onclick();assert.equal(g.read().preSnap.playArt,false);g.element('control').onclick();g.element('resume').onclick();assert.equal(g.read().assist,false);
 g.element('pause').onclick();g.element('restart').onclick();assert.equal(g.read().assist,false,'Restart preserves the chosen running mode');
}
// Receiver motion follows a continuous path behind the blockers, animates from
// travelled distance and finishes set before a snap. No game time is consumed.
for(const reverse of [false,true]){
 const g=game(),initial=g.read(),clock=initial.drive.clock;
 g.element('motionReceiver').onclick();assert.equal(g.read().players[8].x,-12,'Motion must not teleport');assert.ok(g.element('snap').disabled);g.snap();assert.equal(g.read().phase,'pre');
 g.step(1);let p=g.read().players[8];assert.ok(Math.hypot(p.x+12,p.z-initial.players[8].z)>.5);assert.ok(p.pose.run>.3);assert.ok(['walk','run'].includes(meshyAnimationState(p,'pre')));
 g.element('pause').onclick();const paused=JSON.stringify(g.read().players.map(p=>[p.x,p.z,p.vx,p.vz,p.heading,p.pose]));g.step(2);assert.equal(JSON.stringify(g.read().players.map(p=>[p.x,p.z,p.vx,p.vz,p.heading,p.pose])),paused);g.element('resume').onclick();
 if(reverse)g.element('motionReceiver').onclick();
 let previous=g.read().players[8],steps=0;
 while(g.read().preSnap.moving&&steps++<650){
  g.step(1/60);const d=g.read();p=d.players[8];
  assert.ok(Math.hypot(p.x-previous.x,p.z-previous.z)<=.09,'Motion jumped a frame');
  for(let i=0;i<5;i++)assert.ok(Math.hypot(p.x-d.players[i].x,p.z-d.players[i].z)>1.3,'Motion crossed an offensive lineman');
  for(let i=0;i<22;i++)if(i!==8){assert.equal(d.players[i].x,initial.players[i].x);assert.equal(d.players[i].z,initial.players[i].z)}
  previous=p;
 }
 assert.ok(steps<650,'Motion must finish');assert.equal(p.x,reverse?-12:12);assert.equal(p.z,initial.players[8].z);assert.equal(p.startX,p.x);assert.equal(p.startZ,p.z);assert.equal(p.heading,0);assert.equal(p.action,null);assert.equal(g.element('snap').disabled,false);assert.equal(g.read().drive.clock,clock);assert.equal(g.read().drive.plays,0);
 g.element('adjustPlay').onclick();g.element('audibleTab').onclick();g.element('quickAudibles').children[1].onclick();assert.equal(g.read().players[8].startX,p.x,'Quick audible preserves completed motion');
 g.key('p');g.snap();assert.equal(g.read().phase,'snap');assert.equal(g.read().preSnap.playArt,false);assert.equal(g.element('prePanel').hidden,true);
}
console.log('Pre-snap flow: hold/release art, quick audibles, pause running settings and continuous receiver motion passed.');

// Recording regression: default manual control survives the catch and a held
// joystick is immediately effective without lifting and touching again.
for(const target of['x','y','z']){
 const g=game(844,390,false,false);assert.equal(g.read().assist,false);
 g.element('passTab').onclick();g.element('plays').children[1].onclick();g.snap();g.step(.8);g.context.bk3dFixture.seed(500);g.key(target);
 let caught=false,flightFrames=0,maxTurn=0,prior=null;
 for(let frame=0;frame<120;frame++){
  g.step(1/60);const d=g.read(),angle=Math.atan2(d.camera.target[0]-d.camera.eye[0],d.camera.target[2]-d.camera.eye[2]);
  if(prior!==null)maxTurn=Math.max(maxTurn,Math.abs(Math.atan2(Math.sin(angle-prior),Math.cos(angle-prior))));prior=angle;
  if(d.phase==='flight'){
   flightFrames++;const p=d.players[{x:7,y:8,z:9}[target]];
   assert.ok(p.head.visible&&p.head.x>0&&p.head.x<844&&p.head.y>45&&p.foot.y<350,'Intended receiver left the flight frame');
   const box=g.element('stick').getBoundingClientRect();g.element('stick').onpointerdown({pointerId:1,clientX:box.left+box.width*.8,clientY:box.top+box.height*.5,preventDefault(){}});
  }
  if(d.phase==='run'){
   caught=true;const caughtPlayer=d.players.find(p=>p.hasBall);assert.ok(caughtPlayer.foot.y-caughtPlayer.head.y>39,`Catch too small: ${caughtPlayer.foot.y-caughtPlayer.head.y}`);assert.equal(d.assist,false);assert.equal(g.element('stick').style.pointerEvents,'auto');const index=d.players.findIndex(p=>p.hasBall),before=d.players[index];
   g.context.bk3dFixture.mutate(actors=>actors.filter(p=>p.team===1).forEach(p=>{p.x=24;p.z=100}));g.step(.12);const after=g.read().players[index];
   const fx=d.camera.target[0]-d.camera.eye[0],fz=d.camera.target[2]-d.camera.eye[2];
   assert.ok((after.x-before.x)*(-fz)+(after.z-before.z)*fx>0,'Held joystick did not steer the new receiver');break;
  }
 }
 assert.ok(caught&&flightFrames>10);assert.ok(maxTurn<.05,'Camera yaw snapped during flight/catch');
}
// A collapsing engaged block and a closing free rusher must warn before contact.
{
 const {pocketThreat}=await import('../public/play-moment-3d/game.js');const qb={x:0,z:0,vx:0,vz:0};
 assert.ok(pocketThreat(qb,[{x:0,z:3.2,engaged:true}],1)>.1);
 assert.ok(pocketThreat(qb,[{x:0,z:5,vz:-5}],1)>pocketThreat(qb,[{x:0,z:5,vz:0}],1));
 const g=game();g.element('passTab').onclick();g.snap();let warned=false,sacked=false;
 for(let i=0;i<420;i++){g.step(1/60);const d=g.read();if(d.phase==='pass'&&d.pocketPressure>.15)warned=true;if(d.phase==='dead'){sacked=true;assert.ok(d.contact);assert.ok(!g.element('message').textContent.startsWith('SACK'),'Sack announced before contact finish');g.step(1.2);assert.match(g.element('message').textContent,/SACK/);break}}
 assert.ok(warned&&sacked);
}
console.log('Recording regressions passed: manual catch steering, receiver flight framing, bounded yaw, early pressure and synchronized sack result.');

// Phone recording: rollout body must clear both thumb-control rectangles.
for(const [width,height]of[[667,320],[844,335],[1108,430]])for(const direction of['ArrowLeft','ArrowRight']){
 const g=game(width,height,false,false);g.element('passTab').onclick();g.snap();g.step(.35);g.key(direction);
 for(let frame=0;frame<125;frame++){
  g.step(1/60);const d=g.read();if(d.phase!=='pass')break;const p=d.players[5];
  for(const id of['stick','moves']){const b=g.element(id).getBoundingClientRect();assert.ok(!(p.foot.x+16>b.left&&p.foot.x-16<b.right&&p.foot.y>b.top&&p.head.y<b.bottom),`${width} ${direction}: QB hidden by ${id}`)}
  assert.ok(p.foot.y-p.head.y>height*.10,'Rollout QB too small');
 }
}
{
 const g=game(844,390,false,false);g.element('passTab').onclick();g.element('plays').children[1].onclick();g.snap();g.step(.8);g.context.bk3dFixture.seed(500);g.key('y');let caught=false;
 for(let i=0;i<120;i++){g.step(1/60);if(g.read().phase==='run'){caught=true;break}}
 assert.ok(caught);g.context.bk3dTest.touchdown();g.step(2);
 const d=g.read(),p=d.players.find(p=>p.hasBall);assert.ok(p.foot.y-p.head.y>70,'Touchdown shot remains too distant');assert.equal(p.action,'celebrate');assert.equal(d.drive.score,30);
}
console.log('Phone composition regressions passed: six live rollouts avoid controls; readable touchdown close-up and celebration.');
