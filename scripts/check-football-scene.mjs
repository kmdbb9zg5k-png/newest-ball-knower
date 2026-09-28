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
const server=createServer(async(req,res)=>{try{const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');const data=await readFile(name);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.html':'text/html','.webp':'image/webp'})[extname(name)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{}),...(process.env.BK_TEST_URL?{proxy:{server:process.env.HTTPS_PROXY||process.env.HTTP_PROXY}}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1,hasTouch:true,isMobile:true,ignoreHTTPSErrors:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=process.env.BK_TEST_URL||`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?qa=1`;
 await page.goto(url,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.bk3dDiagnostics?.().athletes.ready&&window.bkSceneArtDiagnostics?.().sideline,{timeout:45000});
 assert.deepEqual(await page.evaluate(()=>window.bkSceneArtDiagnostics()),{turf:true,crowd:true,sideline:true,failed:[]});
 await page.evaluate(()=>window.bk3dTest.manualFrames());const frames=[];
 for(const [width,height]of[[667,320],[844,335],[844,390],[1290,590]]){
  await page.setViewportSize({width,height});await page.waitForFunction(w=>innerWidth===w,width);await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
  for(const formation of['shotgun','pistol','singleback','iform','wildcat']){
   await page.locator('#openPlaybook').dispatchEvent('click');
   await page.locator(`#formationTabs [data-formation="${formation}"]`).dispatchEvent('click');
   await page.locator('.play-card').first().dispatchEvent('click');await page.locator('#breakHuddle').dispatchEvent('click');
   await page.evaluate(()=>window.bk3dTest.step(3));
   const d=await page.evaluate(()=>({game:window.bk3dDiagnostics(),graphics:window.bkGraphicsDiagnostics()}));
   assert.equal(d.game.formation,formation);assert.equal(d.game.phase,'pre');assert.equal(d.game.glError,0);assert.equal(d.graphics.overflows,0);
   for(const p of d.game.players.filter(p=>!p.team))assert.ok(p.head.visible&&p.head.x>22&&p.head.x<width-22&&p.head.y>60&&p.foot.y<height-80,JSON.stringify({width,height,formation,p}));
   frames.push({width,height,formation,eye:d.graphics.eye,drawCalls:d.graphics.drawCalls});
   if(formation==='shotgun'||formation==='iform'&&width===1290)await page.screenshot({path:`${out}/${formation}-${width}x${height}.png`});
  }
 }
 // Optional art failures must leave a playable scene with the procedural fallback.
 const fallback=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1,ignoreHTTPSErrors:true});fallback.on('pageerror',e=>errors.push(e.message));
 await fallback.route('**/stadium-*-v1.webp',route=>route.abort('failed'));
 await fallback.goto(url,{waitUntil:'networkidle'});await fallback.waitForFunction(()=>window.bk3dDiagnostics?.().athletes.ready&&window.bkSceneArtDiagnostics?.().failed.length===3,{timeout:45000});
 await fallback.evaluate(()=>window.bk3dTest.manualFrames());await fallback.locator('#filterPass').click();await fallback.locator('.play-card').first().click();await fallback.locator('#breakHuddle').click();
 await fallback.locator('#snap').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});await fallback.evaluate(()=>window.bk3dTest.step(.4));
 const d=await fallback.evaluate(()=>({game:window.bk3dDiagnostics(),graphics:window.bkGraphicsDiagnostics(),art:window.bkSceneArtDiagnostics()}));
 assert.equal(d.game.phase,'pass');assert.equal(d.game.glError,0);assert.equal(d.graphics.overflows,0);assert.equal(d.art.turf,false);assert.equal(d.art.crowd,false);assert.equal(d.art.sideline,false);
 await fallback.screenshot({path:out+'/optional-art-fallback.png'});await fallback.close();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',frames,fallback:d.art,pageErrors:errors,screenshots:out}));
}finally{await browser.close();await new Promise(r=>server.close(r))}
