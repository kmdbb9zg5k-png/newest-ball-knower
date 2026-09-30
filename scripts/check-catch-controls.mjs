/** Exercise post-release catch selection, mobile hit targets and automatic RAC carry. */
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
 await page.locator('#filterPass').click();await page.locator('#call-pass-1').click();await page.locator('#breakHuddle').click();
 assert.equal(await page.locator('#catchChoices').isVisible(),false);await page.locator('#snap').dispatchEvent('pointerdown');
 assert.equal(await page.locator('#catchChoices').isVisible(),false,'Hidden during snap');
 await page.evaluate(()=>{window.bk3dTest.seed(376);window.bk3dTest.step(1.5)});
 assert.equal(await page.locator('#catchChoices').isVisible(),false,'Hidden in pocket');
 await page.keyboard.press('c');assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().catchStyle),'rac','Pre-throw shortcut must not select a catch');
 await page.evaluate(()=>{window.bk3dTest.seed(1000);window.bk3dTest.throwTo(8,'bullet')});
 assert.equal(await page.locator('#catchChoices').isVisible(),false,'Hidden during windup');
 for(let i=0;i<60;i++){await page.evaluate(()=>window.bk3dTest.step(1/60));if(await page.evaluate(()=>window.bk3dDiagnostics().phase==='flight'))break;}
 assert.equal(await page.locator('#catchChoices').isVisible(),true,'Visible after release');
 for(const [width,height] of [[1108,512],[844,390],[667,375]]){
  await page.setViewportSize({width,height});if(await page.locator('#resume').isVisible())await page.locator('#resume').click();await page.evaluate(()=>window.bk3dTest.step(.02));
  assert.equal(await page.locator('#instruction').isVisible(),false);
  for(const style of ['secure','aggressive','rac']){const b=page.locator(`[data-catch="${style}"]`);await b.click();assert.equal(await b.getAttribute('aria-pressed'),'true');const box=await b.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height);}
  await page.screenshot({path:`${out}/catch-${width}.png`});
 }
 await page.setViewportSize({width:844,height:390});
 await page.locator('[data-catch="secure"]').click();assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().catchStyle),'secure');
 await page.locator('[data-catch="rac"]').click();
 let d;for(let i=0;i<120;i++){await page.evaluate(()=>window.bk3dTest.step(1/60));d=await page.evaluate(()=>window.bk3dDiagnostics());if(d.phase==='run'||d.phase==='dead')break;}
 assert.equal(d.phase,'run','Expected completed pass');assert.equal(await page.locator('#catchChoices').isVisible(),false,'Hidden after catch');assert.equal(d.assist,false);const caught=d.players.find(p=>p.hasBall);assert.equal(caught.catchStyle,'rac');
 await page.evaluate(()=>window.bk3dTest.step(.1));d=await page.evaluate(()=>window.bk3dDiagnostics());const running=d.players.find(p=>p.hasBall);assert.ok(running.z>caught.z,'RAC must advance without input');assert.ok(running.vz>0,'RAC must keep forward velocity');
 const vectors=await page.evaluate(async()=>{const {racControlVector}=await import('/play-moment-3d/game.js?v=defensive-hits-46');return [racControlVector(0,0),racControlVector(1,0),racControlVector(0,-1),racControlVector(.01,.01)]});
 assert.deepEqual(vectors,[{x:0,z:1,manual:false},{x:1,z:0,manual:true},{x:0,z:-1,manual:true},{x:0,z:1,manual:false}]);assert.deepEqual(errors,[]);assert.equal(d.glError,0);
 console.log(JSON.stringify({status:'PASS',viewports:3,catchZ:caught.z,runZ:running.z,vz:running.vz,errors}));
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
