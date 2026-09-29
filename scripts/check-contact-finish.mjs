/** Real WebGL reproduction of short catch-to-contact shots and incomplete passes. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve(process.env.BK_FINISH_OUT||'/tmp/bk-contact-finish');await mkdir(out,{recursive:true});
const fixture=`window.bkFinishReview={rig:meshy,renderer:r,players:()=>actors,resolvePass(kind){
 if(!flight)return false;const p=actors[flight.target],d=actors[19];
 for(const a of actors)if(a.team){a.x=23;a.z=p.z+25}
 if(kind==='breakup'){d.x=p.x+.65;d.z=p.z+.20;d.engaged=false;d.engagedWith=null;d.heading=Math.atan2(p.x-d.x,p.z-d.z)}
 flight.to=[p.x,1.5,p.z+.08];flight.t=.999;flight.pressure=0;
 numSeed=kind==='breakup'?0:1000;return true;
 },laggedCatch(x){const oldX=carrier.x,oldZ=carrier.z;for(const p of actors){p.x+=x-oldX;p.z+=72-oldZ}carrier.x=x;carrier.z=72;camEye=[0,4.3,45];camTarget=[0,.65,67];runCameraStart=null;runCameraBlend=0;},prepareBlock(){const p=actors[0],d=actors[11];Object.assign(p,{x:-.6,z:68,heading:0,vx:0,vz:0,fallen:false,action:null,engaged:true,engagedWith:11,blockStyle:'drive'});Object.assign(d,{x:-.6,z:69.08,heading:Math.PI,vx:0,vz:0,fallen:false,action:null,engaged:true,engagedWith:0,blockStyle:'bull-rush'});return [p,d]}};window.bk3dTest={`;
const server=createServer(async(req,res)=>{try{const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('window.bk3dTest={',fixture));res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.glb':'model/gltf-binary'})[extname(name)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1108,height:430},hasTouch:true,isMobile:true,deviceScaleFactor:1});page.setDefaultTimeout(90000);const errors=[],report={catches:[],breakup:[],blocking:[]};page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?qa=1`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready,{timeout:45000});
 async function pass(kind){await page.locator('#restart').dispatchEvent('click');await page.locator('#filterPass').dispatchEvent('click');await page.locator('#call-pass-1').dispatchEvent('click');await page.locator('#breakHuddle').dispatchEvent('click');await page.evaluate(()=>window.bk3dTest.step(2));await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:2});await page.evaluate(()=>{window.bk3dTest.step(.8);window.bk3dTest.throwTo(8,'bullet');window.bk3dTest.step(.23)});assert.equal(await page.evaluate(kind=>window.bkFinishReview.resolvePass(kind),kind),true);await page.evaluate(()=>window.bk3dTest.step(1/60))}
 for(const [width,height,x]of[[1108,430,-18],[844,390,18],[667,320,-18]]){
  await page.setViewportSize({width,height});await pass('catch');assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().phase),'run');await page.evaluate(x=>window.bkFinishReview.laggedCatch(x),x);assert.equal(await page.evaluate(()=>window.bk3dTest.forceContact('wrap')),true);
  const trace=[];let last=await page.evaluate(()=>window.bk3dDiagnostics()),maxStep=0;
  // Render every 100 ms to exercise pose transitions, not just final static poses.
  const frameTime=width===1108?.1:.2,frames=width===1108?32:16;
  for(let i=0;i<frames;i++){
   await page.evaluate(dt=>window.bk3dTest.step(dt),frameTime);const d=await page.evaluate(()=>window.bk3dDiagnostics()),p=d.players.find(p=>p.hasBall);maxStep=Math.max(maxStep,Math.hypot(...d.camera.eye.map((v,j)=>v-last.camera.eye[j])));last=d;assert.equal(d.glError,0);assert.equal(d.phase,'dead');trace.push({t:(i+1)*frameTime,head:p.head,foot:p.foot,action:p.action,defender:d.players[15].action,eye:d.camera.eye});
   if((width===1108&&[0,3,6,10,14,18,22,26,31].includes(i))||(width!==1108&&[3,7].includes(i)))await page.screenshot({path:`${out}/catch-${width}-${i}.png`});
  }
  const framed=trace.find(f=>f.t>=1);assert.ok(Math.abs(framed.foot.x-width/2)<width*.13,JSON.stringify(framed));assert.ok(framed.foot.y>height*.35&&framed.foot.y<height*.82);assert.ok(framed.foot.y-framed.head.y>height*.16,'Contact must reach readable size');assert.ok(maxStep<24*frameTime+.1,'Camera exceeded its speed cap');assert.ok(trace.some(p=>p.action!=='get-up'&&p.defender==='get-up'),'Tackler should recover before carrier');assert.equal(trace.at(-1).action,null);assert.equal(trace.at(-1).defender,null);report.catches.push({width,height,maxStep,trace});
 }
 await page.setViewportSize({width:1108,height:430});await pass('breakup');let d=await page.evaluate(()=>window.bk3dDiagnostics());assert.equal(d.phase,'dead');assert.equal(d.players[19].action,'breakup');assert.equal(d.players[8].action,'catch-miss');
 for(let i=0;i<11;i++){await page.evaluate(()=>window.bk3dTest.step(.1));d=await page.evaluate(()=>window.bk3dDiagnostics());report.breakup.push({time:i/10,defender:d.players[19],receiver:d.players[8],states:d.athletes.states});assert.equal(d.glError,0);assert.equal(d.players.filter(p=>p.hasBall).length,0);if([0,2,4,7,10].includes(i))await page.screenshot({path:`${out}/breakup-${i}.png`})}
 assert.equal(report.breakup[2].defender.action,'breakup');assert.ok(report.breakup[2].states.includes('breakup'));assert.equal(report.breakup.at(-1).defender.action,null);assert.equal(report.breakup.at(-1).receiver.action,null);
 // Isolate the same rig at a fixed viewing distance to inspect hand resets and feet.
 await page.evaluate(async()=>{const {rig,renderer:r}=window.bkFinishReview,{pose}=await import('/play-moment-3d/renderer.js'),players=window.bkFinishReview.prepareBlock();rig.poseStates.clear();document.querySelector('#hud').style.display='none';r.camera([4,2.7,72],[0,1,68.5]);r.fov=42;window.drawBlockReview=t=>{r.begin();r.add('plane',pose(0,0,68,30,1,30),[.18,.36,.21,1],'',false,0,4);rig.queueShadows(players,'run',t);r.draw();rig.draw(players,'run',t);return [...rig.handTransforms.get(0).left.slice(12,15)]}});
 for(let i=0;i<15;i++){report.blocking.push(await page.evaluate(t=>window.drawBlockReview(t),i*.1));if([0,3,6,9,12].includes(i))await page.screenshot({path:`${out}/block-${i}.png`})}
 const range=Math.max(...report.blocking.map(v=>v[1]))-Math.min(...report.blocking.map(v=>v[1]));assert.ok(range>.13,`Hand reset only ${range}`);assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({report,errors},null,2));console.log(JSON.stringify({status:'PASS',output:out,blockingHandRange:range,catches:report.catches.map(x=>({width:x.width,maxStep:x.maxStep}))}));
}finally{await browser.close();await new Promise(r=>server.close(r))}
