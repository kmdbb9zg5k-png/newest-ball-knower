import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join,extname,resolve} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../public'),out=process.env.BK_QA_OUTPUT||'/tmp/bk-football-mobile';
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{
 const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
 if(!p.startsWith(root+'/')){res.writeHead(403).end();return}
 try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary'})[extname(p)]||'application/octet-stream');res.end(await readFile(p))}catch{res.writeHead(404).end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=process.env.BK_QA_ORIGIN||`http://127.0.0.1:${server.address().port}`;
const launch=()=>chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--no-zygote','--single-process','--in-process-gpu','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];let browser;
try{
 for(const [width,height] of [[1108,512],[844,390]]){
  browser=await launch();const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1}),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  console.log('Opening',width,height);await page.goto(origin+'/play-moment-3d-preview.html?qa&v=football-pursuit-6');
  await page.waitForFunction(()=>window.bk3dDiagnostics?.().athletes.ready,{timeout:30000});
  await page.evaluate(()=>bk3dTest.manualFrames());
  const step=seconds=>page.evaluate(s=>bk3dTest.step(s),seconds);
  await step(.2);
  const initial=await page.evaluate(()=>bk3dDiagnostics());assert.equal(initial.glError,0);assert.equal(initial.players.length,22);
  const before=await page.locator('#stick').boundingBox();assert.ok(before&&before.y+before.height<=height);
  await page.screenshot({path:join(out,`${width}-presnap.png`)});
  // Hold the same pointer while a second touch snaps.
  await page.locator('#plays button').nth(3).click();
  await page.mouse.move(before.x+before.width*.3,before.y+before.height*.2);await page.mouse.down();
  await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:2,pointerType:'touch',bubbles:true});
  await step(.13);assert.equal(await page.evaluate(()=>bk3dDiagnostics().phase),'snap');
  assert.equal(await page.locator('#knob').evaluate(el=>el.classList.contains('held')),true);
  await step(.62);
  let d=await page.evaluate(()=>bk3dDiagnostics());assert.equal(d.phase,'handoff');assert.ok(d.players.every(p=>!p.hasBall),'Airborne toss has no holder');
  const during=await page.locator('#stick').boundingBox();assert.ok(Math.abs(during.y-before.y)<1&&Math.abs(during.x-before.x)<1,'Stick must stay fixed');
  await page.screenshot({path:join(out,`${width}-toss.png`)});
  await step(.52);d=await page.evaluate(()=>bk3dDiagnostics());assert.equal(d.phase,'run');assert.ok(d.players[6].hasBall);
  await page.mouse.up();await page.keyboard.down('ArrowUp');
  for(let i=0;i<9;i++)await step(.06);
  await page.screenshot({path:join(out,`${width}-pursuit.png`)});
  d=await page.evaluate(()=>bk3dDiagnostics());if(d.phase==='run')assert.ok(await page.evaluate(()=>bk3dTest.forceContact('wrap')));
  for(let i=0;i<12;i++)await step(.05);
  await page.screenshot({path:join(out,`${width}-contact.png`)});
  const dead=await page.evaluate(()=>bk3dDiagnostics());assert.equal(dead.phase,'dead');assert.equal(await page.locator('#live').isHidden(),true);
  await step(.6);const stopped=await page.evaluate(()=>bk3dDiagnostics());assert.equal(stopped.drive.clock,dead.drive.clock);
  assert.ok(stopped.players.filter(p=>!p.fallen).every(p=>Math.hypot(p.vx,p.vz)<.15));
  await step(2.3);await page.keyboard.up('ArrowUp');assert.equal(await page.evaluate(()=>bk3dDiagnostics().phase),'pre');
  await page.locator('#passTab').click();await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:2,pointerType:'touch',bubbles:true});await step(.65);
  assert.equal(await page.evaluate(()=>bk3dDiagnostics().phase),'pass');await page.keyboard.press('x');await step(.25);
  assert.equal(await page.evaluate(()=>bk3dDiagnostics().phase),'flight');
  await page.screenshot({path:join(out,`${width}-pass.png`)});
  // Portrait must offer recovery, then landscape controls must be reachable again.
  await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#rotate').isVisible(),true);
  await page.setViewportSize({width,height});
  assert.equal(await page.locator('#rotate').isVisible(),false);
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>bk3dDiagnostics().glError),0);
  results.push({width,height,players:22,snap:'passed',toss:'passed',heldTouch:'passed',contact:'passed',whistle:'passed',pass:'passed',rotation:'passed',errors});
  console.log('Passed',width,height);await browser.close();browser=null;
 }
 await writeFile(join(out,'report.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{await browser?.close();server.close()}
