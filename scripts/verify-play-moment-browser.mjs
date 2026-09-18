import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);
const { chromium }=require('playwright');

const publicRoot=join(dirname(fileURLToPath(import.meta.url)),'..','public');
const mime={'.css':'text/css','.glb':'model/gltf-binary','.html':'text/html','.js':'text/javascript','.json':'application/json'};
const server=createServer(async(request,response)=>{
 const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname),relative=normalize(pathname==='/'?'play-moment-3d-preview.html':pathname).replace(/^[/\\]+/,'');
 const file=join(publicRoot,relative);if(!file.startsWith(publicRoot)){response.writeHead(403).end();return}
 try{const body=await readFile(file);response.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'}).end(body)}catch{response.writeHead(404).end('Not found')}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port,browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:1108,height:512},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await context.newPage(),pageErrors=[],consoleErrors=[];
 page.on('pageerror',error=>pageErrors.push(String(error)));
 page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('tripo-gridiron-pro.glb'))consoleErrors.push(message.text())});
 await page.goto(`http://127.0.0.1:${port}/play-moment-3d-preview.html?qa=1`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.querySelector('#loading')?.hidden||!document.querySelector('#error')?.hidden,{timeout:15000});
 assert.equal(await page.locator('#error').isHidden(),true,'The game must not show its renderer error screen');
 assert.equal(await page.locator('#loading').isHidden(),true,'The game must finish loading');
 assert.equal(await page.locator('#snap').isVisible(),true,'Snap control must render');
 assert.equal(await page.locator('#stick').isVisible(),true,'Movement stick must render before the snap');

 const stick=await page.locator('#stick').boundingBox();
 assert.ok(stick,'Movement stick must have a touchable box');
 await page.mouse.move(stick.x+stick.width*.78,stick.y+stick.height*.18);
 await page.mouse.down();
 await page.waitForTimeout(60);
 await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:2,pointerType:'touch',clientX:950,clientY:440,bubbles:true});
 await page.waitForTimeout(60);
 const handoff=await page.evaluate(()=>({diagnostics:window.bk3dDiagnostics(),liveHidden:document.querySelector('#live').hidden,stickHeld:document.querySelector('#knob').classList.contains('held'),instruction:document.querySelector('#instruction').textContent}));
 assert.equal(handoff.diagnostics.phase,'handoff','A held-stick snap must enter the handoff immediately');
 assert.equal(handoff.liveHidden,false,'The live control layer must remain mounted through the handoff');
 assert.equal(handoff.stickHeld,true,'The original stick pointer must remain held while the other thumb snaps');
 assert.match(handoff.instruction,/KEEP HOLDING/);

 await page.evaluate(()=>{window.bk3dTest.manualFrames();window.bk3dTest.step(.55)});
 const run=await page.evaluate(()=>window.bk3dDiagnostics());
 assert.equal(run.phase,'run','The shortened exchange must hand control to the runner');
 const runner=run.players.find(player=>player.hasBall);
 assert.ok(runner&&Math.hypot(runner.vx,runner.vz)>4.5,'The runner must carry the held direction into a live launch');
 assert.ok(Math.abs(runner.x+2)>.2,'Held direction must influence the runner before the exchange ends');
 await page.mouse.up();

 await page.screenshot({path:'/tmp/ball-knower-gameplay-fixed.png'});
 assert.deepEqual(pageErrors,[],'No uncaught browser errors are allowed');
 assert.deepEqual(consoleErrors,[],'No unexpected console errors are allowed');
 console.log(JSON.stringify({status:'PASS',viewport:await page.evaluate(()=>[innerWidth,innerHeight]),handoff:{liveMounted:!handoff.liveHidden,stickHeld:handoff.stickHeld},run:{speed:Number(Math.hypot(runner.vx,runner.vz).toFixed(2)),x:Number(runner.x.toFixed(2)),z:Number(runner.z.toFixed(2))},screenshot:'/tmp/ball-knower-gameplay-fixed.png'},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
