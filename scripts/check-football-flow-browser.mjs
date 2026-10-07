import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve('artifacts/five-minute');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);
 // Scenario controls exist only in this test server, never in shipped code.
 if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('onResult(result){','onResult(result){window.bkLastUnitResult=result;').replace('window.bk3dTest={',"window.bkMiniScenario={lateBlock(){liveUnit?.stop();mode='run';selected=0;elapsed=4;phase='run';const b=actors[0],d=actors[11];Object.assign(b,{x:0,z:40,blockResult:null,blockResolvedAt:-1,fallen:false});Object.assign(d,{x:0,z:41,fallen:false,liveContact:null});engageBlock(b,d,1/60,1,0,true);return {engaged:b.engaged,age:runClock()-b.blockResolvedAt}},inspectGrip(){const p=actors[5];r.camera([p.x+3,2.1,p.z+1.5],[p.x,1.1,p.z]);scene(.016,simTime*1000)},grip(){const p=actors[5],h=meshy.handTransforms.get(5),m=meshy.modelFor(p);return{anchor:meshy.ballAnchor(p),wrists:[h.left,h.right].map(hand=>Array.from(mul(m,hand)).slice(12,15))}},setVertical(){liveUnit?.stop();mode='pass';selected=PASSES.findIndex(p=>p.id==='verts');setup();},unit(){return liveUnit},startUnit,project(point){return r.project(point)},actors(){return actors},setDrive(values){Object.assign(drive,values);updateHud()},finishPlay(reason,spot,incomplete=false){phase='run';endPlay(reason,spot,incomplete)},endDrive,setup(){liveUnit?.stop();setup()},showFullState,setSession(values){Object.assign(mini,values);updateHud()},advanceFull};window.bk3dTest={"));
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.glb':'model/gltf-binary'})[extname(name)]||'application/octet-stream');res.end(data);
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});page.setDefaultTimeout(45000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html`;
 await page.goto(base+'?mode=five-minute&difficulty=pro&team=JCY&opponent=OKC&qa=1');
 await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready);
 const state=()=>page.evaluate(()=>({...window.bk3dDiagnostics(),lastResult:window.bkLastUnitResult})), step=seconds=>page.evaluate(s=>window.bk3dTest.step(s),seconds), click=id=>page.locator('#'+id).dispatchEvent('click');
 const setDrive=values=>page.evaluate(v=>window.bkMiniScenario.setDrive(v),values),setSession=values=>page.evaluate(v=>window.bkMiniScenario.setSession(v),values);
 const finish=(reason,spot,incomplete=false)=>page.evaluate(v=>window.bkMiniScenario.finishPlay(...v),[reason,spot,incomplete]);


 const start=async(kind,session={})=>{await setSession({possession:'away',pending:null,result:null,kickoff:null,conversion:null,cpu:{ball:25,down:1,toGo:10},...session});await setDrive({clock:180});await page.evaluate(k=>window.bkMiniScenario.startUnit(k),kind);};
 const visibleAction=async(label)=>{const d=await state();const u=d.unit;const pts=await page.evaluate(()=>{const u=window.bkMiniScenario.unit().state,a=window.bkMiniScenario.actors();return [a[u.controlled],a[u.carrier]].flatMap(p=>[[p.x,0,p.z],[p.x,2.2,p.z]]).map(p=>window.bkMiniScenario.project(p));});assert(pts.every(p=>p.visible&&p.x>8&&p.x<844-8&&p.y>65&&p.y<380),label+' '+JSON.stringify(pts));};
 // Exercise the real block solver after the usual early-snap window.
 const late=await page.evaluate(()=>window.bkMiniScenario.lateBlock());assert(late.engaged&&late.age===0,'Late-arriving block expires before contact');
 await start('defense');await click('unitCallDefense');await click('defenseReady');
 await page.evaluate(()=>{const u=window.bkMiniScenario.unit().state,a=window.bkMiniScenario.actors();u.stage='pass';u.snapTime=u.time-.8;u.target=8;u.windup=u.time||.01;u.quickRelease=true;u.controlled=21;for(const p of a.slice(11)){p.x=25;p.z=95;p.fallen=true;}a[8].x=4;a[8].z=55;a[5].hasBall=true;});
 let release=false,lastProgress=0,followFrames=0;
 for(let i=0;i<35;i++){
  await step(1/60);const d=await state(),p=d.players[5];
  if(d.unit?.stage==='flight'){
   if(!release){release=true;assert(p.throwT>=.42&&p.throwT<.50,'Ball release must use the shared arm clock')}
   if(p.throwT>0){assert(p.throwT>=lastProgress,'Throw follow-through ran backward');lastProgress=p.throwT;followFrames++}
  }
 }
 assert(release&&followFrames>5,'CPU release and follow-through not exercised');
 await page.screenshot({path:out+'/complete-flow-cpu-throw.png'});
 // Receiver reaches before ownership, then catches without teleporting.
 await start('defense');await click('unitCallDefense');await click('defenseReady');
 await page.evaluate(()=>{const u=window.bkMiniScenario.unit().state,a=window.bkMiniScenario.actors();for(const p of a.slice(11)){p.x=-25;p.z=90;p.fallen=true;}Object.assign(a[8],{x:4,z:50,vx:0,vz:0,hasBall:false});a[5].ratings.throw=99;u.stage='flight';u.snapTime=u.time;u.windup=u.time-.3;u.target=8;u.carrier=5;u.controlled=21;u.throwAway=false;u.releaseAt=u.time;u.flight={from:[0,1.5,40],to:[4,1.6,50],t:.9,duration:1,arc:1,target:8};window.bk3dTest.seed(1);});
 await step(1/60);
 const reach=await page.evaluate(()=>{const p=window.bkMiniScenario.actors()[8];return{receiving:p.receiving,hasBall:p.hasBall,target:p.ballTarget}});assert(reach.receiving&&!reach.hasBall&&reach.target,'Receiver should track/reach before possession');
 await page.screenshot({path:out+'/complete-flow-reach.png'});
 let prior=await page.evaluate(()=>{const p=window.bkMiniScenario.actors()[8];return{x:p.x,z:p.z}}),caught=false;
 for(let i=0;i<12;i++){await step(1/60);const d=await state(),p=d.players[8];assert(Math.hypot(p.x-prior.x,p.z-prior.z)<.20,'Catch teleported receiver');prior=p;if(d.unit?.stage==='run'){caught=true;assert(p.hasBall);break;}}
 assert(caught);await page.screenshot({path:out+'/complete-flow-catch.png'});
 assert.deepEqual(errors,[]);console.log('PASS late blocks, shared CPU release clock, forward follow-through, pre-catch reach and possession without teleportation.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
