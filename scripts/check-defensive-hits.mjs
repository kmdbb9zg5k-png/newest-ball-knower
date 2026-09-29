/** Exercise post-snap catch selection, mobile hit targets and automatic RAC carry. */
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
 const selected=await page.evaluate(async()=>{const {contactOutcome,playerRatings}=await import('/play-moment-3d/game.js?v=defensive-hits-46');return [.15,.5,.9].map(angle=>contactOutcome(playerRatings('RB'),playerRatings('DB'),{angle,momentum:.7,defenderMomentum:.7,distance:.6,roll:.95}).type)});assert.deepEqual(selected,['drag-down','shoulder-hit','low-wrap']);
 for(const type of ['shoulder-hit','low-wrap','drag-down']){
  await page.locator('#restart').dispatchEvent('click');await page.locator('#filterRun').click();await page.locator('#call-run-5').click();await page.locator('#breakHuddle').click();await page.keyboard.down('ArrowUp');await page.locator('#snap').dispatchEvent('pointerdown');
  for(let i=0;i<30;i++){await page.evaluate(()=>window.bk3dTest.step(.1));if(await page.evaluate(()=>window.bk3dDiagnostics().phase==='run'))break;}
  await page.keyboard.up('ArrowUp');assert.equal(await page.evaluate(type=>window.bk3dTest.forceContact(type),type),true);
  assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().contact.type),type);
  for(const [stage,dt] of [['load',.22],['impact',.32],['ground',.85],['recover',.8]]){await page.evaluate(dt=>window.bk3dTest.step(dt),dt);const d=await page.evaluate(()=>window.bk3dDiagnostics());assert.equal(d.glError,0);assert.ok(d.players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));await page.screenshot({path:`${out}/${type}-${stage}.png`});}
  await page.evaluate(()=>window.bk3dTest.step(3));assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().phase),'pre');
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',variants:3,errors}));

}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
