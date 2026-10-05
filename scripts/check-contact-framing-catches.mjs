/** Regression cases from the October 4 iPhone recording; scenarios are test-only. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve('artifacts/contact-framing');await mkdir(out,{recursive:true});
const injection=`window.bkRegression={
 render(){present(1/60,1)},
 step(seconds){for(let i=0;i<Math.ceil(seconds*60);i++){if(!paused||activeContact)simulate(1/60);camera(1/60);}present(1/60,1)},
 release(){let n=0;while(phase==='pass'&&n++<60){simulate(1/60);camera(1/60);}present(1/60,1)},
 body(index){const p=actors[index],h=meshy.handTransforms.get(index),m=meshy.modelFor(p);return{chest:[...mul(m,h.chest)].slice(12,15),fallen:p.fallen,action:p.action,t:p.actionT}},
 reset(){liveUnit?.stop();conversionDrive=null;mini=fullSession(miniConfig.mode,true);drive={...initialDrive};paused=false;ended=false;$('paused').hidden=true;miniUI.reset();mode='run';selected=0;setup(false);phase='run';playbookOpen=false;carrier=actors[6];actors.forEach(p=>{p.hasBall=p===carrier;p.x=(p.index-11)*2;p.z=30;p.vx=p.vz=0;});Object.assign(carrier,{x:0,z:40,vz:7});elapsed=1;cameraReset=true;camera(1);updateControls();},
 terminal(kind){if(kind==='fourth'){drive.down=4;drive.toGo=25;}if(kind==='clock')drive.clock=0;if(kind==='conversion'){conversionDrive={...drive};mini.conversion='home';drive.ball=98;}},
 unit(kind,kicking='away'){liveUnit?.stop();conversionDrive=null;mini=fullSession(miniConfig.mode,true);Object.assign(mini,{possession:kind==='defense'?'away':'home',kickoff:kind==='kickoff'?kicking:null,conversion:null});drive={...initialDrive};paused=false;ended=false;$('paused').hidden=true;miniUI.reset();startUnit(kind);},
 unitContact(){const u=liveUnit.state;u.book=false;u.stage='run';u.carrier=6;u.controlled=16;for(const p of actors){p.x=(p.index-11)*2;p.z=45;p.hasBall=p.index===6;}Object.assign(actors[6],{x:0,z:60,vz:7});Object.assign(actors[16],{x:.65,z:59.8,vz:7});liveUnit.forceContact(actors[16],actors[6]);},
 unitView(stage,x=0,z=60){const u=liveUnit.state;u.book=false;u.stage=stage;u.carrier=6;u.controlled=16;u.flight=null;Object.assign(actors[6],{x,z,hasBall:true});Object.assign(actors[16],{x:x+1.2,z:z-1});liveUnit.refresh();const v=liveUnit.view();camEye=[...v.eye];camTarget=[...v.target];r.fov=v.fov;fieldCamera(camEye,camTarget);scene(.016,simTime*1000);return v;},
 defenseFlight(x,t,qbZ=30){const u=liveUnit.state;u.stage='flight';u.book=false;u.carrier=5;u.controlled=16;u.flight={from:[0,1.8,30],to:[x,1.6,75],t,duration:1,arc:3,target:7};Object.assign(actors[5],{x:0,z:qbZ,hasBall:false});Object.assign(actors[7],{x,z:75});Object.assign(actors[16],{x:x+1,z:74});flight=u.flight;liveUnit.refresh();return liveUnit.view();},
 kickFlight(t){const u=liveUnit.state;u.stage='kick-flight';u.book=false;u.carrier=16;u.controlled=u.kicking==='away'?6:16;u.flight={from:[0,.3,75],to:[0,1,18],t,duration:3.5,arc:17,target:6};actors[6].x=0;actors[6].z=18;actors[16].x=0;actors[16].z=75;flight=u.flight;liveUnit.refresh();camera(1/60);return {view:liveUnit.view(),camera:{eye:[...r.eye],target:[...r.target]}};},
 pass(kind='bullet'){liveUnit?.stop();mini=fullSession(miniConfig.mode,true);drive={...initialDrive};paused=false;ended=false;$('paused').hidden=true;miniUI.reset();mode='pass';selected=PASSES.findIndex(p=>p.id==='verts');setup(false);playbookOpen=false;phase='pass';elapsed=.8;carrier=actors[5];carrier.hasBall=true;for(const p of actors.filter(p=>p.team===1)){p.x=25;p.z=105;p.startX=25;p.startZ=105;}rand=()=>.99;cameraReset=true;camera(1);updateControls();throwTo(7,kind);},
 snapshot(){return {phase,postPlayElapsed,pendingWhistle:pendingWhistle?{...pendingWhistle}:null,flight:flight?{t:flight.t,duration:flight.duration,catchChosen:flight.catchChosen}:null,catchVisible:!$('catchChoices').hidden,clock:drive.clock,carrier:carrier?.index,unitStage:liveUnit?.state?.stage,view:liveUnit?.view(),down:drive.down,ball:drive.ball,score:drive.score,conversion:mini.conversion,result:mini.result,log:mini.log.length}},
};`;
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!path.startsWith(root+'/'))throw Error('path');let bytes=await readFile(path);
 if(path.endsWith('/game.js'))bytes=Buffer.from(bytes.toString().replace('const rand=()=>','let rand=()=>').replace('window.bk3dTest={',injection+'window.bk3dTest={'));
 if(path.endsWith('/live-units.js'))bytes=Buffer.from(bytes.toString().replace('return {start,tick,stop,view,','return {forceContact:(t,r)=>beginTackle(t,r,false,{reason:"TACKLED",gain:4,ball:54}),start,tick,stop,view,'));
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary'})[extname(path)]||'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const results=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});page.setDefaultTimeout(45000);page.on('pageerror',e=>errors.push(e.message));
 const step=async seconds=>{await page.evaluate(t=>{window.bkRegression.step(t)},seconds);};
 const shot=()=>page.evaluate(()=>window.bkRegression.snapshot());
 for(const mode of ['two-minute','five-minute']){
  await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?mode=${mode}&qa=1`);await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready);
  assert.equal(await page.locator('#error').isVisible(),false);assert((await page.locator('#breakHuddle').boundingBox()).height>=40);
  for(const kind of ['wrap','big-hit','gang','dive','drag-down','fourth','clock','conversion']){
   await page.evaluate(k=>{window.bkRegression.reset();window.bkRegression.terminal(k);},kind);
   const before=await shot();assert(await page.evaluate(k=>window.bk3dTest.forceContact(['fourth','clock','conversion'].includes(k)?'wrap':k),kind));
   const started=await shot();assert(started.pendingWhistle);assert.equal(started.down,before.down,'Down must not advance at initial contact');assert.equal(started.log,before.log);
   const duration=await page.evaluate(()=>window.bk3dDiagnostics().contact.duration);await step(duration-.07);
   let s=await shot();assert(s.pendingWhistle&&s.phase==='dead','Contact must remain alive until landing');assert.equal(s.down,before.down);
   await step(.09);s=await shot();assert(s.pendingWhistle,'Brief turf finish must render before transition');
   const d=await page.evaluate(()=>window.bk3dDiagnostics()),b=await page.evaluate(id=>window.bkRegression.body(id),s.carrier);
   assert(b.fallen&&b.t>.95);assert(b.chest[1]<.75,`${kind} chest must reach turf: ${b.chest[1]}`);
   if(kind==='wrap')await page.screenshot({path:out+'/'+mode+'-tackle.png'});
   await step(.25);s=await shot();assert(!s.pendingWhistle,'Result must settle exactly once after contact');assert(s.log>before.log||kind==='conversion');
   results.push({mode,contact:kind,chestHeight:b.chest[1],settled:true});console.log('PASS contact',mode,kind);
  }
  for(const kind of ['defense','kickoff']){
   await page.evaluate(k=>{window.bkRegression.unit(k);window.bkRegression.unitContact()},kind);await step(1.16);
   let s=await shot();assert.equal(s.unitStage,'contact');const b=await page.evaluate(()=>window.bkRegression.body(6));assert(b.chest[1]<.75);await step(.2);s=await shot();assert.notEqual(s.unitStage,'contact');
   results.push({mode,unitContact:kind,chestHeight:b.chest[1]});
  }
  await page.evaluate(()=>window.bkRegression.unit('defense'));
  for(const x of [-20,0,20]){
   const view=await page.evaluate(x=>window.bkRegression.unitView('run',x),x),d=await page.evaluate(()=>window.bk3dDiagnostics());
   assert(Math.hypot(...view.eye.map((v,i)=>v-view.target[i]))<15,'Close defense must use offensive-scale framing');
   for(const i of [6,16]){assert(d.players[i].head.visible&&d.players[i].foot.visible);assert(d.players[i].head.y>60&&d.players[i].foot.y<365);assert(d.players[i].foot.y-d.players[i].head.y>45,'Players must be readable on mobile');}
  }
  assert.equal(await page.locator('#paused').isVisible(),false);await page.screenshot({path:out+'/'+mode+'-defense.png'});
  for(const x of [-20,0,20]){
   for(const t of [.2,.7,.95]){
    const normal=await page.evaluate(v=>window.bkRegression.defenseFlight(v.x,v.t),{x,t});
    const distant=await page.evaluate(v=>window.bkRegression.defenseFlight(v.x,v.t,-20),{x,t});
    assert.deepEqual(distant,normal,'Released quarterback must not widen defensive pass framing');
    if(t===.95)assert(Math.hypot(...normal.eye.map((v,i)=>v-normal.target[i]))<15,'Deep catch coverage must stay close');
   }
   results.push({mode,defenseFlightX:x,quarterbackExcluded:true});
  }
  for(const kicking of ['home','away']){
   await page.evaluate(k=>window.bkRegression.unit('kickoff',k),kicking);let previous=null,maxBoom=0;
   for(let i=0;i<=210;i++){
    const {view,camera}=await page.evaluate(t=>window.bkRegression.kickFlight(t),i/210),boom=camera.eye.map((v,j)=>v-camera.target[j]);
    assert(Math.hypot(...view.eye.map((v,j)=>v-view.target[j]))<15,'Kick apex must not zoom out the field');
    if(previous&&i>1)maxBoom=Math.max(maxBoom,Math.hypot(...boom.map((v,j)=>v-previous[j])));previous=boom;
    if(i===175){await page.evaluate(()=>window.bkRegression.render());const d=await page.evaluate(()=>window.bk3dDiagnostics());const focus=kicking==='home'?16:6;assert(d.players[focus].head.visible&&d.players[focus].foot.visible,'Controlled coverage player or returner must stay visible during kick flight');assert(d.players[focus].foot.y-d.players[focus].head.y>45,'Controlled athlete remains readable');await page.screenshot({path:out+'/'+mode+'-kick-'+kicking+'.png'});}
   }
   assert(maxBoom<=7/60+.001);results.push({mode,kick:kicking,frames:211,maxBoom});
  }
  for(const style of ['rac','secure','aggressive']){
   await page.evaluate(()=>window.bkRegression.pass());assert.equal((await shot()).catchVisible,false,'No catch choices before release');
   await page.evaluate(()=>window.bkRegression.release());
   let s=await shot();assert.equal(s.phase,'flight');assert(s.catchVisible);
   const clock=s.clock;await step(.85);s=await shot();assert(s.catchVisible&&s.phase==='flight','Short pass must allow a late mobile catch selection');assert(s.flight.t>0&&s.flight.t<1,'The game continues during the choice');
   if(style==='rac')await page.screenshot({path:out+'/'+mode+'-catch.png'});
   await page.locator(`[data-catch="${style}"]`).dispatchEvent('pointerdown',{pointerType:'touch',pointerId:1});
   s=await shot();assert(s.flight.catchChosen);assert.equal(await page.locator(`[data-catch="${style}"]`).getAttribute('aria-pressed'),'true');
   const startT=s.flight.t,duration=s.flight.duration;await step(1/60);s=await shot();if(s.flight)assert(Math.abs(s.flight.t-startT-(1/60)/duration)<.001,'Selection resumes normal speed');
   await step(.4);s=await shot();assert.equal(s.phase,'run');assert.equal(s.catchVisible,false);assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().catchStyle),style);
   results.push({mode,catch:style,lateSelectionSeconds:.85,clockElapsed:clock-s.clock});console.log('PASS catch',mode,style);
  }
  await page.evaluate(()=>window.bkRegression.pass());await page.evaluate(()=>window.bkRegression.release());await step(1.1);assert.equal((await shot()).phase,'run','Default RAC must complete without input');
  assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().glError),0);
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/results.json',JSON.stringify({status:'PASS',results,errors},null,2));console.log(JSON.stringify({status:'PASS',cases:results.length,results}));
}finally{await browser.close();server.close()}
