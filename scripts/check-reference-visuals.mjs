import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve('artifacts/five-minute');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);
 // Scenario controls exist only in this test server, never in shipped code.
 if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('window.bk3dTest={',"window.bkMiniScenario={cameraCase(kind,x=0,z=55){liveUnit?.stop();phase=kind;carrier=actors[kind==='pass'?5:6];runCameraStart=null;runCameraBlend=0;deadCameraStart=null;deadBallFocus=null;activeContact=null;pendingDriveEnd=null;flight=null;for(const p of actors){p.x=(p.index%5-2)*3;p.z=z+5+Math.floor(p.index/5)*3;}Object.assign(carrier,{x,z,vx:0,vz:7,hasBall:true});if(kind==='flight'){flight={from:[0,1.8,snapZ],to:[x,1,z],t:.85};flightCameraStart={eye:[...camEye],target:[...camTarget]};}updateControls();},frame(seconds){for(let i=0;i<seconds*60;i++)camera(1/60);scene(.016,simTime*1000)}};window.bk3dTest={"));
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.glb':'model/gltf-binary'})[extname(name)]||'application/octet-stream');res.end(data);
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
for(const mode of ['two-minute','five-minute']){
await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?mode=${mode}&qa=1`);await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready);await page.locator('#breakHuddle').dispatchEvent('click');await page.evaluate(()=>window.bkMiniScenario.frame(2));
await page.screenshot({path:out+`/camera-${mode}-pre.png`});
await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});await page.evaluate(()=>window.bk3dTest.step(1.2));const live=await page.evaluate(()=>window.bk3dDiagnostics());assert(live.drive.plays===1,'Natural snap runs');const holder=live.players.find(p=>p.hasBall);assert(holder?.head.visible&&holder?.foot.visible,'Natural ball carrier visible');assert.equal(live.glError,0);await page.screenshot({path:out+`/camera-${mode}-natural.png`});
for(const [kind,x,z] of [['pass',18,30],['run',0,55],['run',22,55],['flight',-18,75],['dead',22,55],['run',0,11]]){
await page.evaluate(v=>{window.bkMiniScenario.cameraCase(...v);window.bkMiniScenario.frame(3)},[kind,x,z]);const d=await page.evaluate(()=>window.bk3dDiagnostics()),p=d.players[kind==='pass'?5:6];assert(d.athletes.asset.endsWith('/tripo-gridiron-pro.glb'),'Original reference asset is active');assert(p.head.visible&&p.foot.visible,`${mode} ${kind} carrier visible`);assert(p.head.y>60&&p.foot.y<330,`${kind} vertical framing ${p.head.y}..${p.foot.y}`);assert(p.head.x>100&&p.head.x<744,`${kind} horizontal framing`);await page.screenshot({path:out+`/camera-${mode}-${kind}-${x}-${z}.png`});
}
}
assert.deepEqual(errors,[]);console.log('PASS both modes: pre-snap, central/sideline run, pass arrival, whistle, own goal-line; carrier head/feet visible clear of scoreboard and controls; no page errors.');
}finally{await browser.close();server.close();}
