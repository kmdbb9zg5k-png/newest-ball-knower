/** Render the whistle transition and stationary hand fighting on the real rig. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve(process.env.BK_MOTION_OUT||'/tmp/bk-motion');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);
 if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('window.bk3dTest={','window.bkMotionReview={rig:meshy,renderer:r,players:()=>actors};window.bk3dTest={'));
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.glb':'model/gltf-binary'})[extname(name)]||'application/octet-stream');res.end(data);
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1108,height:430},deviceScaleFactor:1,hasTouch:true,isMobile:true});page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?qa=1`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready,{timeout:45000});
 await page.locator('#breakHuddle').dispatchEvent('click');await page.keyboard.down('ArrowUp');await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});
 for(let i=0;i<25;i++){await page.evaluate(()=>window.bk3dTest.step(.1));if(await page.evaluate(()=>window.bk3dDiagnostics().phase==='run'))break;}
 assert.equal(await page.evaluate(()=>window.bk3dTest.forceContact('wrap')),true);await page.keyboard.up('ArrowUp');
 const samples=[];
 for(let i=0;i<25;i++){
  await page.evaluate(()=>window.bk3dTest.step(.1));
  if([0,4,11,23].includes(i)){
   samples.push(await page.evaluate(()=>{const d=window.bk3dDiagnostics();return{time:d.simTime,phase:d.phase,drive:d.drive,players:d.players.map(p=>({x:p.x,z:p.z,engaged:p.engaged,fallen:p.fallen,action:p.action}))}}));
   await page.screenshot({path:`${out}/whistle-${i}.png`});
  }
 }
 assert.ok(samples.every(s=>s.phase==='dead'));assert.ok(samples.every(s=>s.players.every(p=>!p.engaged)));assert.ok(samples.every(s=>s.drive.ball===samples[0].drive.ball));
 const motion=await page.evaluate(async()=>{
  const {rig,r}= {rig:window.bkMotionReview.rig,r:window.bkMotionReview.renderer}, {pose}=await import('/play-moment-3d/renderer.js');
  const a={index:0,role:'OL',number:68,team:0,x:-1.2,z:0,heading:0,vx:0,vz:0,distance:0,engaged:true,engagedWith:11,blockStyle:'pass-anchor'},b={index:11,role:'DL',number:94,team:1,x:-1.2,z:1.08,heading:Math.PI,vx:0,vz:0,distance:0,engaged:true,engagedWith:0,blockStyle:'bull-rush'},rest={index:7,role:'WR',number:18,team:0,x:1.2,z:0,heading:0,vx:0,vz:0,distance:0};
  const traces=[];rig.poseStates.clear();rig.actorMap=new Map([[0,a],[11,b],[7,rest]]);
  for(let i=0;i<=120;i++){
   const t=i/60;rig.phase='pass';rig.bonesFor(b,'pass',t);rig.bonesFor(a,'pass',t);rig.phase='dead';rig.bonesFor(rest,'dead',t);
   const hands=rig.handTransforms.get(0),idle=rig.poseStates.get(7).locals,head=rig.namedNodes['mixamorig:Head'];
   traces.push({hand:Array.from(hands.left.slice(12,15)),chest:Array.from(hands.chest.slice(12,15)),head:[...idle[head].r]});
  }
  let maxStep=0;for(let i=1;i<traces.length;i++)maxStep=Math.max(maxStep,Math.hypot(...traces[i].hand.map((v,j)=>v-traces[i-1].hand[j])));
  const handRange=Math.max(...traces.map(p=>p.hand[1]-p.chest[1]))-Math.min(...traces.map(p=>p.hand[1]-p.chest[1])),headRange=Math.max(...traces.map(p=>p.head[1]))-Math.min(...traces.map(p=>p.head[1]));
  document.querySelector('#hud').style.display='none';r.resize();r.fov=42;r.camera([3.8,2.7,5.7],[0,.9,.4]);
  window.drawMotionReview=t=>{r.begin();r.add('plane',pose(0,0,0,20,1,20),[.18,.36,.21,1],'',false,0,4);rig.queueShadows([a,b,rest],'dead',t);r.draw();rig.draw([a,b,rest],'dead',t)};
  window.drawMotionReview(2);return{handRange,headRange,maxStep,glError:r.gl.getError()};
 });
 await page.screenshot({path:`${out}/poses.png`});
 await writeFile(out+'/report.json',JSON.stringify({samples,motion,errors},null,2));
 assert.equal(motion.glError,0);assert.deepEqual(errors,[]);assert.ok(motion.maxStep<.10,JSON.stringify(motion));
 assert.ok(motion.handRange>.05,'Stationary blocking hands never reset');assert.ok(motion.headRange>.012,'Dead-ball players never look around');
 console.log(JSON.stringify({status:'PASS',motion,output:out}));
}finally{await browser.close();await new Promise(r=>server.close(r))}
