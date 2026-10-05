/** Reproduce a canvas layout change that arrives after the window resize event. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve(process.env.OUT||'artifacts/game-viewport');
await mkdir(out,{recursive:true});
const injection=`window.viewportReview={
 render(){camera(1/60);scene(1/60,simTime*1000)},
 sample(){const box=r.canvas.getBoundingClientRect();return{phase,layout:[box.width,box.height],projection:[r.width,r.height],buffer:[r.canvas.width,r.canvas.height],stretch:(box.width/box.height)/(r.width/r.height),glError:r.gl.getError()}}
};`;
const server=createServer(async(req,res)=>{try{
 const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');
 let body=await readFile(name);if(name.endsWith('/game.js'))body=Buffer.from(body.toString().replace('window.bk3dTest={',injection+'window.bk3dTest={'));
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.glb':'model/gltf-binary','.css':'text/css'})[extname(name)]||'application/octet-stream');res.end(body);
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const results=[],errors=[];
try{
 for(const mode of ['two-minute','five-minute']){
  const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(90000);
  await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?mode=${mode}&team=JCY&opponent=BRK&qa=1`);
  await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready);
  await page.locator('#breakHuddle').click();await page.evaluate(()=>window.bk3dTest.step(.2));
  const stages=[['ready',null],['handoff',.65],['run',.9],['contact',.35]];
  for(const [stage,seconds] of stages){
   if(stage==='handoff')await page.locator('#snap').dispatchEvent('pointerdown',{pointerType:'touch',pointerId:1});
   if(stage==='contact')assert(await page.evaluate(()=>window.bk3dTest.forceContact('wrap')),'Contact starts from a live run');
   if(seconds)await page.evaluate(s=>window.bk3dTest.step(s),seconds);
   // Mobile chrome/orientation can settle the canvas AFTER window.resize.
   // Keep the HUD unchanged: the bug should affect only the WebGL surface.
   await page.evaluate(()=>{const c=document.querySelector('#game');c.style.height='780px';window.dispatchEvent(new Event('resize'));c.style.height='100%';window.viewportReview.render()});
   const sample=await page.evaluate(()=>window.viewportReview.sample());results.push({mode,stage,...sample});
   assert.equal(sample.phase,({ready:'pre',handoff:'handoff',run:'run',contact:'dead'})[stage]);
   await page.screenshot({path:`${out}/${mode}-${stage}.jpg`,type:'jpeg',quality:88});
   if(!process.env.CAPTURE_BROKEN)assert(Math.abs(sample.stretch-1)<.005,`${mode}/${stage}: 3D world stretched ${sample.stretch.toFixed(2)}x after layout settled`);
   assert.equal(sample.glError,0);
  }
  if(!process.env.CAPTURE_BROKEN){
   // Toolbar height changes, full rotation, and returning from the page cache.
   for(const [width,height] of [[1108,442],[1108,512],[390,844],[844,390]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>window.viewportReview.render());
    const sample=await page.evaluate(()=>window.viewportReview.sample());results.push({mode,stage:'resize',...sample});assert(Math.abs(sample.stretch-1)<.005);assert.equal(sample.glError,0);
   }
   await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));window.bk3dTest.manualFrames();window.viewportReview.render()});
   const sample=await page.evaluate(()=>window.viewportReview.sample());assert(Math.abs(sample.stretch-1)<.005);
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/results.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({results,errors}));
}finally{await browser.close();server.close()}
