/** CI-only failure injection into the real WebGL field and animation callback. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';

const root=resolve('public'),out=resolve('artifacts/game-failure');
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const file=resolve(root,'.'+new URL(req.url,'http://local').pathname);
 if(!file.startsWith(root+'/'))throw Error('path');
 let body=await readFile(file);
 if(file.endsWith('/game.js'))body=Buffer.from(body.toString().replace('window.bk3dTest={',`window.bkFailureFixture={
  failNextFrame(){r.draw=()=>{throw new Error('Injected field render failure')};window.bk3dTest.resumeFrames()},
  loseContext(){const ext=r.gl.getExtension('WEBGL_lose_context');if(!ext)throw Error('Context loss test extension unavailable');ext.loseContext()}
 };window.bk3dTest={`));
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.webp':'image/webp','.json':'application/json'})[extname(file)]||'application/octet-stream');
 res.end(body);
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const results=[];
try{
 for(const mode of ['two-minute','five-minute']){
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
  page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const url=`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?mode=${mode}&qa=1&manualFrames=1`;
  const ready=async()=>{
   await page.waitForFunction(()=>window.bk3dTest&&window.bk3dDiagnostics().athletes.ready);
   await page.evaluate(()=>window.bk3dTest.manualFrames());
   assert.equal(await page.locator('#error').isVisible(),false);
   assert.equal((await page.evaluate(()=>window.bk3dDiagnostics())).glError,0);
  };
  const checkRecovery=async stage=>{
   await page.locator(`#error[data-failure="${stage}"]`).waitFor({state:'visible'});
   assert(await page.getByRole('button',{name:'Retry field',exact:true}).isVisible());
   assert.equal(await page.evaluate(()=>document.activeElement?.id),'retryGame');
   for(const id of ['hud','loading','paused','rotate'])assert.equal(await page.locator('#'+id).isVisible(),false,`${id} covers recovery`);
   await page.setViewportSize({width:390,height:844});
   const bounds=await page.locator('#retryGame').boundingBox();
   assert(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=390&&bounds.y+bounds.height<=844,'Retry remains reachable in portrait');
   assert.equal(await page.locator('#rotate').isVisible(),false,'Portrait guidance cannot mask recovery');
   await page.screenshot({path:`${out}/${mode}-${stage}-portrait.png`});
   await page.setViewportSize({width:844,height:390});
  };
  await page.goto(url);await ready();
  await page.locator('#breakHuddle').click();
  await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});
  await page.evaluate(()=>window.bk3dTest.step(.5));
  await page.evaluate(()=>window.bkFailureFixture.failNextFrame());
  await checkRecovery('runtime');
  const stopped=await page.evaluate(()=>window.bk3dDiagnostics().simTime);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().simTime),stopped,'A failed field must not keep simulating');
  await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Retry field',exact:true}).click()]);
  assert.equal(page.url(),url,'Retry reloads the same field instead of navigating home');
  await ready();
  await page.evaluate(()=>window.bkFailureFixture.loseContext());
  await checkRecovery('graphics');
  await Promise.all([page.waitForEvent('load'),page.getByRole('button',{name:'Retry field',exact:true}).click()]);
  await ready();assert.deepEqual(errors,[],'Runtime/context failures are handled without uncaught page errors');
  results.push({mode,runtime:'recovered',graphics:'recovered',portrait:'reachable',uncaughtErrors:errors});
  await page.close();
 }
 await writeFile(out+'/results.json',JSON.stringify({results,limitation:'Software-rendered CI checks do not certify physical iPhone performance.'},null,2));
 console.log('PASS real-frame and WebGL-context recovery, portrait visibility, stopped simulation and same-URL retries in both full-game modes');
}finally{await browser.close();await new Promise(r=>server.close(r));}
