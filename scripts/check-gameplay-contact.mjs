/** Real WebGL gate for the athlete materials, shaped bodies and mobile scene. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {footballGeometry} from '../public/play-moment-3d/renderer.js';
const ball=footballGeometry();
assert.ok(ball.v.every(Number.isFinite));
assert.ok(ball.ix.every(i=>i>=0&&i<ball.v.length/8));
for(let i=0;i<ball.v.length;i+=8)assert.ok(Math.abs(Math.hypot(...ball.v.slice(i+3,i+6))-1)<1e-5);
const root=resolve('public'),out=resolve(process.env.BK_SCENE_OUT||'/tmp/bk-scene-check');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('window.bk3dTest={',`window.bkReferenceCarry=()=>{const dx=-17-carrier.x,dz=84-carrier.z;for(const p of actors){p.x+=dx;p.z+=dz;if(p.team){p.x=8+(p.index%4);p.z=carrier.z-18;}}camEye[0]+=dx;camEye[2]+=dz;camTarget[0]+=dx;camTarget[2]+=dz;runCameraStart=null;return true};window.bk3dTest={`));res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.html':'text/html','.webp':'image/webp'})[extname(name)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{}),...(process.env.BK_TEST_URL?{proxy:{server:process.env.HTTPS_PROXY||process.env.HTTP_PROXY}}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1,hasTouch:true,isMobile:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?qa=1`;
 const read=()=>page.evaluate(()=>window.bk3dDiagnostics());
 async function start(){
  await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready,{timeout:45000});
  await page.locator('#filterPass').dispatchEvent('click');await page.locator('#call-pass-1').dispatchEvent('click');await page.locator('#breakHuddle').dispatchEvent('click');
  await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:3,pointerType:'touch'});
 }
 await start();let sack=false;const frames=[];
 for(let i=0;i<65;i++){
  await page.evaluate(()=>window.bk3dTest.step(.1));const d=await read();assert.equal(d.glError,0);assert.equal(d.assist,false);
  if(i%8===0){await page.screenshot({path:`${out}/pocket-${i}.png`});frames.push({i,pressure:d.pocketPressure,phase:d.phase})}
  if(d.phase==='dead'){sack=true;assert.ok(d.contact);assert.equal(await page.locator('#message').evaluate(e=>e.classList.contains('show')),false);await page.screenshot({path:`${out}/contact-start.png`});await page.evaluate(()=>window.bk3dTest.step(.45));await page.screenshot({path:`${out}/contact-middle.png`});await page.evaluate(()=>window.bk3dTest.step(.8));await page.screenshot({path:`${out}/contact-finish.png`});assert.match(await page.locator('#message').textContent(),/SACK/);break}
 }
 assert.ok(sack,'Stationary QB must still be sackable');
 await start();await page.evaluate(()=>{window.bk3dTest.step(.8);window.bk3dTest.seed(500);window.bk3dTest.throwTo(8,'bullet')});let caught=false;
 for(let i=0;i<24;i++){
  await page.evaluate(()=>window.bk3dTest.step(.05));const d=await read();assert.equal(d.glError,0);
  if(d.phase==='flight'){assert.equal(await page.locator('#stick').isVisible(),true,'Joystick hidden during flight');}
  if(d.phase==='flight')await page.locator('#stick').evaluate(e=>{const b=e.getBoundingClientRect();e.setPointerCapture=()=>{};e.dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,clientX:b.left+b.width*.8,clientY:b.top+b.height*.5,bubbles:true}))});
  if(i%3===0)await page.screenshot({path:`${out}/flight-${i}.png`});
  if(d.phase==='run'){const receiver=d.players.find(p=>p.hasBall);assert.ok(receiver.foot.y-receiver.head.y>39,'Receiver too small at catch');caught=true;assert.equal(d.assist,false);assert.equal(await page.locator('#stick').evaluate(e=>getComputedStyle(e).pointerEvents),'auto');await page.screenshot({path:`${out}/catch-manual.png`});await page.evaluate(()=>window.bk3dTest.step(.18));await page.screenshot({path:`${out}/catch-steer.png`});break}
  assert.notEqual(d.phase,'dead','Seeded catch became an incomplete pass');
 }
 assert.ok(caught);
 // A sustained, moving 26-yard carry at the recording's viewport catches
 // camera pull-back that a stationary, teleported touchdown test misses.
 await page.setViewportSize({width:1108,height:430});
 await page.evaluate(()=>window.bkReferenceCarry());
 await page.locator('#stick').dispatchEvent('pointerup',{pointerId:1});
 await page.keyboard.down('ArrowUp');await page.keyboard.down('Shift');
 let touchdown=false;
 for(let i=0;i<60;i++){
  await page.evaluate(()=>window.bk3dTest.step(.1));const d=await read(),p=d.players.find(p=>p.hasBall);
  if(i>10&&d.phase==='run')assert.ok(p.foot.y-p.head.y>430*.17,`Moving carrier too small: ${p.foot.y-p.head.y}`);
  if(i===14||i===24)await page.screenshot({path:`${out}/sustained-run-${i}.png`});
  if(d.phase==='dead'){assert.equal(d.drive.score,30);touchdown=true;break;}
 }
 await page.keyboard.up('ArrowUp');await page.keyboard.up('Shift');assert.ok(touchdown,'Full carry did not reach the goal line');
 await page.evaluate(()=>window.bk3dTest.step(2));await page.screenshot({path:`${out}/touchdown-close.png`});
 const td=await read(),scorer=td.players.find(p=>p.hasBall);assert.equal(scorer.action,'celebrate');assert.ok(scorer.foot.y-scorer.head.y>430*.27,'Touchdown too distant');
 for(const direction of['ArrowLeft','ArrowRight']){
  await page.setViewportSize({width:667,height:320});await start();await page.evaluate(()=>window.bk3dTest.step(.35));await page.keyboard.down(direction);
  for(let i=0;i<12;i++){
   await page.evaluate(()=>window.bk3dTest.step(.1));const d=await read();assert.equal(d.phase,'pass');const p=d.players[5];
   const rects=await page.evaluate(()=>['stick','moves'].map(id=>{const b=document.getElementById(id).getBoundingClientRect();return{left:b.left,right:b.right,top:b.top,bottom:b.bottom}}));
   for(const b of rects)assert.ok(!(p.foot.x+16>b.left&&p.foot.x-16<b.right&&p.foot.y>b.top&&p.head.y<b.bottom),'QB under controls');
   assert.ok(p.foot.y-p.head.y>32,'QB too small');
  }
  await page.screenshot({path:`${out}/rollout-${direction}.png`});await page.keyboard.up(direction);
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',sack,caught,frames,pageErrors:errors}));
}finally{await browser.close();await new Promise(r=>server.close(r))}
