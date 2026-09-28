/** Reproducible goal-line render of production modules; no career state changes. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve(process.env.BK_SCENE_OUT||'/tmp/bk-stadium-presentation');await mkdir(out,{recursive:true});
let baseline=false;
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://local').pathname,name=resolve(root,'.'+path);if(!name.startsWith(root+'/'))throw Error('path');
 let data=baseline?execFileSync('git',['show',(process.env.BK_BASELINE_REF||'04df7efd')+':public'+path],{maxBuffer:12*1024*1024}):await readFile(name);
 if(path.endsWith('/game.js'))data=Buffer.from(data.toString().replace(' setup();camera(1);scene(.016,0);',`window.bkGoalFixture=()=>{drive={...initialDrive,ball:85,down:1,toGo:10};setup(false);}; setup();camera(1);scene(.016,0);`));
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.html':'text/html','.webp':'image/webp'})[extname(name)]||'application/octet-stream');res.end(data);
 }catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const reports=[];
try{
 for(const before of[true,false]){
  baseline=before;
  const page=await browser.newPage({viewport:{width:1290,height:590},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?qa=1`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());
  await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready&&window.bkSceneArtDiagnostics().crowd,{timeout:45000});
  await page.evaluate(()=>{window.bkGoalFixture();window.bk3dTest.step(3)});
  const d=await page.evaluate(()=>({game:window.bk3dDiagnostics(),graphics:window.bkGraphicsDiagnostics(),art:window.bkSceneArtDiagnostics()}));
  assert.equal(d.game.glError,0);assert.equal(d.graphics.overflows,0);assert.equal(d.game.drive.ball,85);assert.deepEqual(errors,[]);
  await page.screenshot({path:out+'/'+(before?'before':'after')+'.png'});
  reports.push({before,camera:d.game.camera,graphics:d.graphics,art:d.art});await page.close();
 }
 await writeFile(out+'/report.json',JSON.stringify(reports,null,2));console.log(JSON.stringify({status:'PASS',output:out,reports}));
}finally{await browser.close();await new Promise(r=>server.close(r))}
