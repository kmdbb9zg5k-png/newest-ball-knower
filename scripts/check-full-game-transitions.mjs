import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve('docs/qa/coherent-players');await mkdir(out,{recursive:true});
// Drive the actual camera through an exchange, flight, catch and live run.
// All scenario controls are injected by this test server, never shipped.
const scenario=`window.bkCoherence={start(kind,x=18){liveUnit?.stop();phase=kind==='handoff'?'pre':'pass';flight=null;carrier=actors[kind==='handoff'?6:7];cameraReset=true;for(const p of actors){p.x=(p.index%5-2)*3;p.z=snapZ+7+Math.floor(p.index/5)*2;p.hasBall=false;}Object.assign(actors[5],{x:0,z:snapZ-5});Object.assign(carrier,{x:kind==='handoff'?0:x,z:kind==='handoff'?snapZ-5:snapZ+22});for(let i=0;i<120;i++)camera(1/60);flightCameraStart={eye:[...camEye],target:[...camTarget]};},step(kind,t,x=18){if(kind==='handoff'){phase=t<.45?'handoff':'run';carrier.x=Math.min(t,1)*x;carrier.z=snapZ-5+t*8;carrier.hasBall=true;}else if(t<1){phase='flight';flight={from:[0,1.8,snapZ-5],to:[x,1,snapZ+22],t,arc:3};}else{phase='run';flight=null;carrier.x=x;carrier.z=snapZ+22+(t-1)*9;carrier.hasBall=true;}camera(1/60);const ball=flight?[flight.from[0]+(flight.to[0]-flight.from[0])*t,1.8+Math.sin(Math.PI*t)*3,flight.from[2]+(flight.to[2]-flight.from[2])*t]:[carrier.x,1.2,carrier.z];return{eye:[...r.eye],target:[...r.target],ball:r.project(ball),head:r.project([carrier.x,2.1,carrier.z]),foot:r.project([carrier.x,0,carrier.z])};},render(){scene(.016,simTime*1000)}};`;
const server=createServer(async(req,res)=>{try{const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('window.bk3dTest={',scenario+'window.bk3dTest={'));res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.glb':'model/gltf-binary'})[extname(name)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true}),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));const results=[];
 for(const mode of ['two-minute','five-minute']){
  await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?mode=${mode}&qa=1`);await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready);await page.locator('#breakHuddle').dispatchEvent('click');
  for(const kind of ['handoff','catch'])for(const x of [-18,0,18]){
   const frames=await page.evaluate(({kind,x})=>{window.bkCoherence.start(kind,x);return Array.from({length:181},(_,f)=>window.bkCoherence.step(kind,f/60,x))},{kind,x});let maxBoom=0,maxYaw=0,maxAim=0;
   for(let i=1;i<frames.length;i++){
    const a=frames[i-1],b=frames[i],ba=a.eye.map((v,k)=>v-a.target[k]),bb=b.eye.map((v,k)=>v-b.target[k]);
    maxBoom=Math.max(maxBoom,Math.hypot(...bb.map((v,k)=>v-ba[k])));maxAim=Math.max(maxAim,Math.hypot(...b.target.map((v,k)=>v-a.target[k])));
    const yaw=Math.atan2(bb[0],-bb[2])-Math.atan2(ba[0],-ba[2]);maxYaw=Math.max(maxYaw,Math.abs(Math.atan2(Math.sin(yaw),Math.cos(yaw))));
    assert(b.ball.visible&&b.ball.y>60&&b.ball.y<380,JSON.stringify({mode,kind,x,frame:i,ball:b.ball}));
    if(i>60)assert(b.head.visible&&b.foot.visible,`${kind} player visible after possession`);
   }
   assert(maxBoom<=7/60+.0001,JSON.stringify({kind,x,maxBoom}));assert(maxYaw<.025,JSON.stringify({kind,x,maxYaw}));assert(maxAim<=100/60+.0001,JSON.stringify({kind,x,maxAim}));results.push({mode,kind,x,maxBoom,maxYaw,maxAim});
  }
  await page.evaluate(()=>window.bkCoherence.render());await page.screenshot({path:out+'/transition-'+mode+'.jpg',type:'jpeg',quality:90});
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS',checks:'both modes: left/center/right handoffs and catches, 2,172 transition frames, ball/player visibility, bounded zoom and yaw',results}));
}finally{await browser.close();server.close()}
