import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as math from '../public/play-moment-3d/renderer.js';
import {advanceMotion} from '../public/play-moment-3d/athlete.js';
import {knockDownPlayer,advancePlayerAction,blockOutcome,pursuitRole,pursuitTarget} from '../public/play-moment-3d/game.js';
import {groundedStride,meshyAnimationState} from '../public/play-moment-3d/meshy-athlete.js';
// Live recovery and dead-ball finishes must take different paths.
for(const type of['miss','tackle','pancake']){
 const p={vx:7,vz:4,engaged:true};knockDownPlayer(p,0,type,.6);assert.equal(p.vx,0);assert.equal(p.engaged,false);
 advancePlayerAction(p,.7);assert.ok(p.fallen);advancePlayerAction(p,1.06);assert.equal(p.action,'get-up');advancePlayerAction(p,1.5);assert.ok(p.fallen);advancePlayerAction(p,1.9);assert.equal(p.fallen,false);assert.equal(p.action,null);
 knockDownPlayer(p,2,type,.6);advancePlayerAction(p,10,true);assert.ok(p.fallen);assert.equal(p.actionT,1);
}
let pancakes=0;for(let i=0;i<1000;i++)if(blockOutcome(84,78,.5,i/1000)==='pancake')pancakes++;assert.ok(pancakes<40,`Too many knockdowns: ${pancakes}`);
const runner={x:20,z:45,vx:2,vz:7},near={index:15,team:1,x:17,z:45},safety={index:21,team:1,x:24,z:57},back={index:16,team:1,x:0,z:40};
assert.equal(pursuitRole(near,runner,[near,safety,back]),'primary');assert.equal(pursuitRole(safety,runner,[near,safety,back]),'contain');
const cutoff=pursuitTarget(safety,runner,false,8,'contain');assert.ok(cutoff.z>=safety.z-.6&&cutoff.x>runner.x&&cutoff.x<=25.4);
// During stance, model-space foot travel must cancel world movement exactly.
const stepA=groundedStride(.2),stepB=groundedStride(.3);assert.ok(stepA.planted&&stepB.planted);assert.ok(Math.abs((stepB.z-stepA.z)*1.17+.1)<1e-9);
assert.equal(meshyAnimationState({fallen:true,role:'LB',vx:8,vz:2},'run'),'tackle');

// Exercise the real game controller and camera math with only DOM/GPU I/O stubbed.
const source=fs.readFileSync(new URL('../public/play-moment-3d/game.js',import.meta.url),'utf8').replace(/^import.*;\n/gm,'').replace(/export /g,'');
function game(width=844,height=335){
 const elements=new Map(),events=new Map();let renderer;
 const element=id=>{if(elements.has(id))return elements.get(id);const el={id,hidden:false,children:[],style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},setPointerCapture(){},replaceChildren(){this.children=[]},append(...c){this.children.push(...c);for(const child of c)if(child.id)elements.set(child.id,child)},appendChild(c){this.append(c)},getBoundingClientRect(){return id==='pre'?{top:height-105,left:0,width,height:105}:id==='header'?{left:width*.3,right:width*.7,top:8,bottom:58}:id==='stick'?{left:30,top:height-110,width:90,height:90}:{left:0,top:0,width,height,right:width,bottom:height}}};Object.defineProperty(el,'firstElementChild',{get(){return this.children[0]||(this.children[0]={style:{}})}});elements.set(id,el);return el};
 class HeadlessRenderer{constructor(){renderer=this;this.width=width;this.height=height;this.vp=math.identity();this.gl={getError:()=>0};this.drawCalls=0;this.eye=[0,0,0]}camera=math.Renderer.prototype.camera;project=math.Renderer.prototype.project;begin(){}add(){}draw(){}lateBegin(){}drawLate(){}glow(){}}
 const noop=()=>{},context={...math,Renderer:HeadlessRenderer,drawAthlete:noop,prepareJerseys:noop,advanceMotion,makeStadium:()=>({draw:noop,parts:0}),createMeshyAthletes:()=>({ready:false,ballAnchor:()=>null,draw:noop,diagnostics:()=>({})}),createGameplayReplayRecorder:()=>({event:noop,sample:noop}),console,URLSearchParams,performance:{now:()=>0},location:{search:'?qa'},navigator:{vibrate:noop},document:{hidden:false,getElementById:element,createElement:()=>element('generated-'+elements.size),querySelector:()=>element('header'),querySelectorAll:()=>[],addEventListener:noop},requestAnimationFrame:()=>1,cancelAnimationFrame:noop,matchMedia:()=>({addEventListener:noop}),innerWidth:width,innerHeight:height,addEventListener:(name,fn)=>events.set(name,fn)};context.window=context;
 vm.createContext(context);vm.runInContext(source.replace('window.bk3dTest={','window.bk3dRenderActors=()=>actors.map(p=>({...p}));window.bk3dTest={')+'\nstart();',context);context.bk3dTest.manualFrames();
 return{context,element,events,renderer,step:t=>context.bk3dTest.step(t),read:()=>context.bk3dDiagnostics(),snap:()=>element('snap').onpointerdown({preventDefault:noop}),key:key=>events.get('keydown')({key,code:key,preventDefault:noop})};
}
for(const [w,h]of[[844,335],[932,430],[740,330]]){
 const g=game(w,h);g.element('passTab').onclick();g.snap();let result;
 for(let i=0;i<420;i++){g.step(1/60);result=g.read();if(result.phase==='dead')break}
 assert.equal(result.phase,'dead','A stationary QB should be sacked');assert.ok(result.contact,'Sack must start paired contact');assert.equal(result.players[5].fallen,true);assert.ok(result.players[result.lastTackler].fallen);
 const clock=result.drive.clock;g.step(.9);assert.equal(g.read().players[5].actionT,1,'QB must finish on turf');assert.equal(g.read().drive.clock,clock,'Dead-ball animation must not run the game clock');
 g.step(1);assert.equal(g.read().phase,'pre');for(const p of g.read().players)assert.equal(p.fallen,false);
 // Camera is continuous between dead ball and setup; then fits the offensive lineup.
 for(let i=0;i<150;i++)g.step(1/60);for(const p of g.read().players.filter(p=>!p.team)){assert.ok(p.foot.y<h-95&&p.head.y>55,`${w}: formation overlaps HUD`)}
}
for(let play=0;play<4;play++){
 const g=game();g.element('plays').children[play].onclick();g.key('ArrowUp');g.snap();let maxDown=0,frames=0;
 for(let i=0;i<650;i++){g.step(1/60);const d=g.read();maxDown=Math.max(maxDown,d.players.filter(p=>p.fallen).length);for(const p of d.players){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));if(p.fallen)assert.ok(Math.hypot(p.vx,p.vz)<.001,'Prone player must not chase')}frames++;if(d.phase==='dead')break}
 assert.ok(frames>20);console.log(`Run ${play}: ${frames} frames, maximum ${maxDown} downed players.`);
}
// Pass protectors move once per step and contact poses require proximity.
{
 const g=game();g.element('passTab').onclick();g.snap();let previous=g.read().players,turned=false;
 for(let frame=0;frame<220;frame++){
  g.step(1/60);const d=g.read();if(d.phase!=='pass')break;
  for(let index=0;index<5;index++){
   const p=d.players[index],before=previous[index];
   assert.ok(Math.hypot(p.x-before.x,p.z-before.z)<.07,'Pass blocker moved twice in one tick');
   if(d.elapsed>2.5&&!p.engaged&&Math.abs(p.heading)>.3)turned=true;
   if(p.engaged){const defender=d.players[p.engagedWith];assert.ok(Math.hypot(p.x-defender.x,p.z-defender.z)<1.6,'Block pose started before contact')}
  }
  previous=d.players;
 }
 assert.ok(turned,'A beaten blocker must turn to follow the rush');
}
// Follow an actual throw through flight/end with bounded camera motion.
{
 const g=game();g.element('passTab').onclick();g.snap();g.step(.7);g.key('x');assert.equal(g.read().phase,'flight');let previous=[...g.renderer.eye],maxCameraStep=0;
 for(let i=0;i<240;i++){g.step(1/60);const eye=g.renderer.eye,delta=Math.hypot(...eye.map((v,n)=>v-previous[n]));maxCameraStep=Math.max(maxCameraStep,delta);previous=[...eye];assert.ok(eye.every(Number.isFinite));}
 assert.ok(maxCameraStep<2,`Camera jumped ${maxCameraStep} yards in one frame`);console.log(`Pass/flight camera maximum per-frame travel: ${maxCameraStep.toFixed(3)} yards.`);
}
// Real renderer allocation growth: tiny material batches must not reserve 4096 instances.
let allocated=0;const gl=new Proxy({createVertexArray:()=>({}),createBuffer:()=>({}),bufferData:(target,data)=>{allocated+=typeof data==='number'?data:data.byteLength}}, {get:(o,k)=>o[k]??(()=>{})});
const r=Object.create(math.Renderer.prototype);Object.assign(r,{gl,shapes:{cube:{v:Array(24).fill(0),ix:[0,1,2]}},geometry:new Map(),batches:new Map(),overflows:0});
for(let i=0;i<60;i++)r.add('cube',math.identity(),[1,1,1,1],'material-'+i);const bytes=[...r.batches.values()].reduce((n,b)=>n+b.data.byteLength,0);assert.equal(r.geometry.size,1);assert.ok(bytes<200000);
for(let i=0;i<80;i++)r.add('cube',math.identity(),[1,1,1,1],'material-0');assert.ok([...r.batches.values()][0].capacity>=81);assert.equal(r.overflows,0);
console.log(`Recovery checks passed: sacks at three mobile sizes, four run concepts, get-ups, containment, planted step travel, shared geometry, ${bytes} instance bytes across 60 batches.`);

// Capture actual paired interactions for the real-mesh offline renderer.
const captureFlag=process.argv.indexOf('--capture');
if(captureFlag>=0){
 const scenarios=[];
 for(const scenario of['run tackle','QB sack']){
  const g=game(),frames=[];if(scenario==='QB sack')g.element('passTab').onclick();else g.key('ArrowUp');g.snap();let contactAt=-1,ids;
  for(let frame=0;frame<600;frame++){
   g.step(1/60);const d=g.read(),actors=g.context.bk3dRenderActors();
   frames.push({phase:d.phase,time:d.simTime,actors:actors.map((p,index)=>({index,role:p.role,team:p.team,number:p.number,x:p.x,z:p.z,heading:p.heading,vx:p.vx,vz:p.vz,distance:p.distance,sprinting:p.sprinting,hasBall:p.hasBall,engaged:p.engaged,blockStyle:p.blockStyle,action:p.action,actionT:p.actionT,actionSide:p.actionSide,fallHeading:p.fallHeading,fallen:p.fallen}))});
   if(contactAt<0&&d.contact){contactAt=frame;ids=[actors.find(p=>p.hasBall).index,d.lastTackler]}
   if(contactAt>=0&&frame>=contactAt+65)break;
  }
  assert.ok(contactAt>=0,'Recorded play must reach paired contact');
  const start=frames[contactAt].actors[ids[0]],origin=[start.x,start.z];
  for(const frame of frames)frame.actors=frame.actors.filter(p=>ids.includes(p.index)).map(p=>({...p,x:p.x-origin[0],z:p.z-origin[1]}));
  scenarios.push({label:scenario,frames,selected:[0,15,30,60].map(offset=>({frameIndex:contactAt+offset,label:`${scenario} +${(offset/60).toFixed(2)}s`}))});
 }
 fs.writeFileSync(process.argv[captureFlag+1],JSON.stringify(scenarios));
 console.log('Captured two actual paired contact sequences.');
}
