/** Verify full-speed scrambling, RB pace, body contact and second-effort tackling. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(process.env.BK_REVIEW_ROOT||'public'),out=resolve(process.env.BK_REVIEW_OUT||'/tmp/bk-foundation');
await mkdir(out,{recursive:true});
// Inject arrangements only into the local test server, never the shipped game.
const fixture=`window.bkCarryFixture=(kind)=>{
 if(kind==='clear'){
  for(const p of actors)if(p!==carrier){p.x=20+(p.index%3)*2;p.z=12+p.index*1.5;p.vx=p.vz=0;p.engaged=false;p.engagedWith=null;p.liveContact=null;p.contactWith=null;p.action=null;p.contactReady=0;}
  carrier.x=0;carrier.z=70;carrier.vx=carrier.vz=0;carrier.heading=0;carrier.action=null;carrier.catchT=0;elapsed=1;jukeUntil=0;return;
 }
 const d=actors[kind==='helper'?20:21];Object.assign(d,{x:carrier.x+(kind==='helper'?-.82:.82),z:carrier.z,vx:carrier.vx,vz:carrier.vz,engaged:false,engagedWith:null,fallen:false,contactReady:0,liveContact:null,action:null});
 numSeed=kind==='miss'?1972:1800;
};`;
const server=createServer(async(req,res)=>{try{const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);if(name.endsWith('/game.js'))data=data.toString().replace('window.bk3dTest={',fixture+'window.bk3dTest={');res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.glb':'model/gltf-binary'})[extname(name)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?qa=1`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready);
 const rules=await page.evaluate(async()=>{
  const g=await import('/play-moment-3d/game.js?v=carry-control-48'),r={role:'RB',x:0,z:0,vx:0,vz:8,ratings:{speed:90}},d={team:1,x:.82,z:0,vx:0,vz:8},helper={team:1,x:-1,z:0};
  return {parallel:g.tackleContactEligible(d,r,g.tackleRadius(.3)),far:g.tackleContactEligible({...d,x:1.5},r,1.05),helper:g.pursuitRole(helper,r,[{...d,liveContact:{}},helper],1),cooldown:g.pursuitRole(helper,r,[{...d,contactReady:2},helper],1),rb:g.carrierRunSpeed(r),oldRB:g.playerRunSpeed(r),qb:g.carrierRunSpeed({...r,role:'QB'}),top:g.playerTopSpeed(r),rollout:g.qbMovementSpeed(7,0,r)};
 });assert.equal(rules.parallel,true);assert.equal(rules.far,false);assert.equal(rules.helper,'primary');assert.equal(rules.cooldown,'primary');assert.equal(rules.qb,rules.top);assert.equal(rules.rollout,rules.top);assert.ok(rules.rb<rules.oldRB);
 async function play(mode,index){await page.locator('#restart').dispatchEvent('click');await page.locator(mode==='pass'?'#filterPass':'#filterRun').click();await page.locator(`#call-${mode}-${index}`).click();await page.locator('#breakHuddle').click();await page.locator('#snap').dispatchEvent('pointerdown');for(let i=0;i<30;i++){await page.evaluate(()=>window.bk3dTest.step(.1));if(await page.evaluate(()=>['pass','run'].includes(window.bk3dDiagnostics().phase)))break;}}
 await play('pass',1);await page.locator('#scramble').click();assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().phase),'run');await page.evaluate(()=>window.bkCarryFixture('clear'));await page.keyboard.down('ArrowUp');await page.evaluate(()=>window.bk3dTest.step(1));let d=await page.evaluate(()=>window.bk3dDiagnostics()),qb=d.players.find(p=>p.hasBall);assert.equal(qb.role,'QB');assert.ok(Math.hypot(qb.vx,qb.vz)>=qb.topSpeed*.98,'Scramble requires no Sprint button');await page.screenshot({path:out+'/qb-scramble.png'});await page.keyboard.up('ArrowUp');
 await play('run',5);await page.evaluate(()=>window.bkCarryFixture('clear'));const before=await page.evaluate(()=>window.bk3dDiagnostics());await page.keyboard.down('ArrowUp');await page.evaluate(()=>window.bk3dTest.step(1));d=await page.evaluate(()=>window.bk3dDiagnostics());const rb=d.players.find(p=>p.hasBall),clockDelta=before.drive.clock-d.drive.clock;assert.equal(rb.role,'RB');assert.ok(Math.hypot(rb.vx,rb.vz)<rb.topSpeed*.75);assert.ok(Math.abs(before.drive.clock-d.drive.clock-1)<.001,'RB clock must run at real simulation speed');await page.screenshot({path:out+'/rb-pace.png'});await page.keyboard.up('ArrowUp');
 // Actual collision/outcome loop, with deterministic parallel bodies and no forced endPlay.
 await page.evaluate(()=>{window.bkCarryFixture('clear');window.bkCarryFixture('finish');window.bk3dTest.step(1/60)});d=await page.evaluate(()=>window.bk3dDiagnostics());assert.equal(d.phase,'dead','Body contact must finish a tackle');assert.ok(d.contact);await page.evaluate(()=>window.bk3dTest.step(.35));await page.screenshot({path:out+'/rb-contact.png'});
 await play('run',5);await page.evaluate(()=>{window.bkCarryFixture('clear');window.bkCarryFixture('miss');window.bk3dTest.step(1/60)});d=await page.evaluate(()=>window.bk3dDiagnostics());assert.equal(d.phase,'run','Fixture must produce a missed first tackle');assert.equal(d.players[21].action,'wrap-release');
 await page.evaluate(()=>{window.bkCarryFixture('helper');window.bk3dTest.step(1/60)});d=await page.evaluate(()=>window.bk3dDiagnostics());assert.equal(d.phase,'dead','Second defender must finish immediately after first miss');assert.equal(d.contact.tackler,20);
 assert.deepEqual(errors,[]);assert.equal(d.glError,0);console.log(JSON.stringify({status:'PASS',rules,qbSpeed:Math.hypot(qb.vx,qb.vz),rbSpeed:Math.hypot(rb.vx,rb.vz),clockDelta,helper:d.contact.tackler,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
