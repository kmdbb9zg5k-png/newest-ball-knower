/** Capture complete deterministic plays at real simulation cadence. No synthetic art. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve(process.env.BK_REVIEW_ROOT||'public'),out=resolve(process.env.BK_REVIEW_OUT||'/tmp/bk-foundation'),fps=Number(process.env.BK_REVIEW_FPS||12);
if(!Number.isInteger(fps)||fps<1||60%fps)throw Error('Capture cadence must divide the 60 Hz simulation');
await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('window.bk3dTest={','window.bkFoundation={rig:meshy,renderer:r,players:()=>actors};window.bk3dTest={'));res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.glb':'model/gltf-binary'})[extname(name)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const report={fps,viewport:[1108,430],errors:[],plays:[]};
try{
 const page=await browser.newPage({viewport:{width:1108,height:430},deviceScaleFactor:1,hasTouch:true,isMobile:true});page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?qa=1`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready,{timeout:60000});
 for(const mode of (process.env.BK_REVIEW_SCENES||'run,pass').split(',')){
  await page.locator('#restart').dispatchEvent('click');await page.locator(mode==='run'?'#filterRun':'#filterPass').dispatchEvent('click');await page.locator(mode==='run'?'#call-run-5':'#call-pass-1').dispatchEvent('click');await page.locator('#breakHuddle').dispatchEvent('click');await page.evaluate(()=>{window.bk3dTest.seed(376);window.bk3dTest.step(1)});
  await mkdir(`${out}/${mode}`,{recursive:true});await page.screenshot({path:`${out}/${mode}/frame-0000.jpg`});
  await page.keyboard.down('ArrowUp');await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});
  const trace=[];let thrown=false,deadAt=null;
  for(let i=1;i<=fps*(mode==='pass'?14:10);i++){
   let d=await page.evaluate(()=>window.bk3dDiagnostics());
   if(mode==='pass'&&!thrown&&d.phase==='pass'&&d.elapsed>.85){await page.keyboard.up('ArrowUp');await page.evaluate(()=>{window.bk3dTest.seed(1000);window.bk3dTest.throwTo(8,'bullet')});thrown=true;}
   if(mode==='pass'&&d.phase==='run')await page.keyboard.down('ArrowUp');
   await page.evaluate(dt=>window.bk3dTest.step(dt),1/fps);d=await page.evaluate(()=>window.bk3dDiagnostics());
   trace.push({t:i/fps,phase:d.phase,drive:d.drive,camera:d.camera,carrier:d.players.find(p=>p.hasBall),contact:d.contact,glError:d.glError});
   await page.screenshot({path:`${out}/${mode}/frame-${String(i).padStart(4,'0')}.jpg`,quality:88});
   if(d.phase==='dead'&&deadAt===null)deadAt=i/fps;
   if(d.playbook.open||d.ended&&deadAt!==null&&i/fps-deadAt>4.1)break;
  }
  await page.keyboard.up('ArrowUp');
  assert.ok(trace.some(f=>f.phase==='run'),mode+' did not reach a live carry');
  assert.ok(trace.some(f=>f.phase==='dead'),mode+' did not complete');
  if(mode==='pass')assert.ok(trace.some(f=>f.phase==='flight'),'Pass was never released');
  assert.equal(trace.at(-1).phase,'pre','Play did not return to the playbook');
  report.plays.push({mode,trace});await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(mode,trace.length,trace.at(-1)?.phase,trace.at(-1)?.drive);
 }
 if(report.errors.length||report.plays.some(p=>p.trace.some(f=>f.glError)))throw Error(JSON.stringify(report.errors));
 console.log(JSON.stringify({status:'PASS',output:out}));
}finally{await browser.close();await new Promise(r=>server.close(r))}
