/** Verify action labels, pursuit roles, contact release, sack camera and scoring support. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(process.env.BK_REVIEW_ROOT||'public'),out=resolve(process.env.BK_REVIEW_OUT||'/tmp/bk-foundation');
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');const data=await readFile(name);res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.glb':'model/gltf-binary'})[extname(name)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?qa=1`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready);
 const rules=await page.evaluate(async()=>{const {pursuitRole,pursuitTarget}=await import('/play-moment-3d/game.js?v=gameplay-polish-47');const r={x:0,z:0,vx:0,vz:8},ds=[{index:11,team:1,x:0,z:-1},{index:12,team:1,x:1,z:-2},{index:13,team:1,x:-2,z:5}];return {roles:ds.map(d=>pursuitRole(d,r,ds)),targets:ds.map(d=>pursuitTarget(d,r,false,8,pursuitRole(d,r,ds)))}});assert.deepEqual(rules.roles,['primary','support','contain']);assert.ok(rules.targets[1].x>0&&rules.targets[2].x<0);
 for(const type of ['gang','low-wrap']){
  await page.locator('#restart').dispatchEvent('click');await page.locator('#filterRun').click();await page.locator('#call-run-5').click();await page.locator('#breakHuddle').click();await page.keyboard.down('ArrowUp');await page.locator('#snap').dispatchEvent('pointerdown');
  for(let i=0;i<30;i++){await page.evaluate(()=>window.bk3dTest.step(.1));if(await page.evaluate(()=>window.bk3dDiagnostics().phase==='run'))break;}
  for(const [width,height] of [[1108,512],[844,390],[667,375]]){await page.setViewportSize({width,height});const fit=await page.locator('#airMove').evaluate(b=>{const range=document.createRange();range.selectNodeContents(b);const text=range.getBoundingClientRect(),box=b.getBoundingClientRect();return{textLeft:text.left,textRight:text.right,left:box.left,right:box.right,width:box.width,height:box.height}});assert.ok(fit.textLeft>=fit.left&&fit.textRight<=fit.right,JSON.stringify(fit));assert.ok(fit.width>=44&&fit.height>=44);}
  await page.setViewportSize({width:844,height:390});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.evaluate(()=>window.bk3dTest.step(1/60));await page.screenshot({path:`${out}/controls.png`});
  await page.keyboard.up('ArrowUp');assert.equal(await page.evaluate(type=>window.bk3dTest.forceContact(type),type),true);
  assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().contact.type),type);
  for(const [stage,dt] of [['load',.22],['impact',.32],['ground',.85],['recover',.8]]){await page.evaluate(dt=>window.bk3dTest.step(dt),dt);const d=await page.evaluate(()=>window.bk3dDiagnostics());assert.equal(d.glError,0);assert.ok(d.players.every(p=>!p.engaged));if(d.contact&&stage==='impact'){const runner=d.players.find(p=>p.hasBall),tackler=d.players[d.contact.tackler];assert.ok(Math.hypot(runner.x-tackler.x,runner.z-tackler.z)>.68,'Contact bodies too close');}assert.ok(d.players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));await page.screenshot({path:`${out}/${type}-${stage}.png`});}
  await page.evaluate(()=>window.bk3dTest.step(3));assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().phase),'pre');
 }
 // A natural pocket sack: inspect every simulation frame through the camera transition.
 await page.locator('#restart').dispatchEvent('click');await page.locator('#filterPass').click();await page.locator('#call-pass-1').click();await page.locator('#breakHuddle').click();await page.locator('#snap').dispatchEvent('pointerdown');
 let d;for(let i=0;i<100;i++){await page.evaluate(()=>window.bk3dTest.step(.1));d=await page.evaluate(()=>window.bk3dDiagnostics());if(d.phase==='dead')break;}assert.equal(d.phase,'dead');
 let prev=d.camera,maxStep=0;for(let i=0;i<36;i++){await page.evaluate(()=>window.bk3dTest.step(1/60));d=await page.evaluate(()=>window.bk3dDiagnostics());maxStep=Math.max(maxStep,Math.hypot(...d.camera.eye.map((v,j)=>v-prev.eye[j])));prev=d.camera;}assert.ok(maxStep<.25,'Contact camera jolted: '+maxStep);await page.screenshot({path:out+'/sack.png'});
 // Scoring teammates must approach the scorer from their actual positions.
 await page.locator('#restart').dispatchEvent('click');await page.locator('#filterRun').click();await page.locator('#call-run-5').click();await page.locator('#breakHuddle').click();await page.keyboard.down('ArrowUp');await page.locator('#snap').dispatchEvent('pointerdown');
 for(let i=0;i<30;i++){await page.evaluate(()=>window.bk3dTest.step(.1));if(await page.evaluate(()=>window.bk3dDiagnostics().phase==='run'))break;}
 await page.keyboard.up('ArrowUp');assert.equal(await page.evaluate(()=>window.bk3dTest.touchdown()),true);const before=await page.evaluate(()=>window.bk3dDiagnostics());await page.evaluate(()=>window.bk3dTest.step(2));d=await page.evaluate(()=>window.bk3dDiagnostics());const scorer=d.players.find(p=>p.hasBall);const approaching=d.players.filter((p,i)=>!p.team&&!p.hasBall&&p.action==='celebrate'&&Math.hypot(p.x-scorer.x,p.z-scorer.z)<5&&Math.hypot(p.x-before.players[i].x,p.z-before.players[i].z)>.25);assert.ok(approaching.length>=2,'Teammates did not reach spaced celebration positions');await page.screenshot({path:out+'/touchdown.png'});await page.evaluate(()=>window.bk3dTest.step(1));await page.screenshot({path:out+'/touchdown-group.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',hitVariants:2,viewports:3,maxCameraStep:maxStep,approaching:approaching.length,errors}));

}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
