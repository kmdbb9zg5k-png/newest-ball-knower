import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve('artifacts/five-minute');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);
 // Scenario controls exist only in this test server, never in shipped code.
 if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('onResult(result){','onResult(result){window.bkLastUnitResult=result;').replace('window.bk3dTest={',"window.bkMiniScenario={inspectGrip(){const p=actors[5];r.camera([p.x+3,2.1,p.z+1.5],[p.x,1.1,p.z]);scene(.016,simTime*1000)},grip(){const p=actors[5],h=meshy.handTransforms.get(5),m=meshy.modelFor(p);return{anchor:meshy.ballAnchor(p),wrists:[h.left,h.right].map(hand=>Array.from(mul(m,hand)).slice(12,15))}},setVertical(){liveUnit?.stop();mode='pass';selected=PASSES.findIndex(p=>p.id==='verts');setup();},unit(){return liveUnit},startUnit,project(point){return r.project(point)},actors(){return actors},setDrive(values){Object.assign(drive,values);updateHud()},finishPlay(reason,spot,incomplete=false){phase='run';endPlay(reason,spot,incomplete)},endDrive,setup(){liveUnit?.stop();setup()},showFullState,setSession(values){Object.assign(mini,values);updateHud()},advanceFull};window.bk3dTest={"));
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
 await start('defense');await click('unitCallDefense');await click('defenseReady');assert.equal((await state()).unit.stage,'snap','Ready starts the snap');await step(.2);await visibleAction('snap framing');
 // Fit a deep selected safety and QB together without losing the backfield.
 await page.evaluate(()=>{const u=window.bkMiniScenario.unit().state,a=window.bkMiniScenario.actors();u.stage='pre';u.preSnapRemaining=Infinity;u.controlled=21;a[21].x=16;a[21].z=58;});await step(2);await visibleAction('deep safety framing');await page.screenshot({path:out+'/flow-defense-framing.png'});
 // A completed pass must switch again at the actual catch point.
 await page.evaluate(()=>{const u=window.bkMiniScenario.unit().state,a=window.bkMiniScenario.actors();for(const p of a.slice(11)){p.x=-24;p.z=90;p.fallen=false;}a[15].x=12;a[15].z=50;a[7].x=10;a[7].z=50;a[5].ratings.throw=99;u.stage='flight';u.carrier=5;u.target=7;u.controlled=21;u.throwAway=false;u.releaseAt=u.time;u.flight={from:[0,1.8,30],to:[10,1.6,50],t:.99,duration:.2,arc:3,target:7};window.bk3dTest.seed(1);});await step(.02);let d=await state();assert.equal(d.unit.stage,'run');assert.equal(d.unit.controlled,15,'Switch to closest at catch');
 // Handoffs also select a useful defender, and manual selection remains respected.
 await start('defense');await click('unitCallDefense');await click('defenseReady');await page.evaluate(()=>{const u=window.bkMiniScenario.unit().state,a=window.bkMiniScenario.actors();u.stage='handoff';u.snapTime=u.time-.61;u.controlled=21;for(const p of a.slice(11)){p.x=24;p.z=90;}a[16].x=a[6].x+3;a[16].z=a[6].z;});await step(.02);assert.equal((await state()).unit.controlled,16);await page.evaluate(()=>window.bkMiniScenario.unit().selectPlayer(21));await step(.1);assert.equal((await state()).unit.controlled,21,'Manual selection has priority');
 // Kick return begins immediately, with no Receive Kickoff confirmation.
 await start('kickoff',{kicking:'away',kickoff:'away'});assert.equal((await state()).unit.stage,'kick-flight');assert(await page.locator('#unitKickButton').isHidden());await step(.4);await page.screenshot({path:out+'/flow-auto-receive.png'});
 await start('kickoff',{possession:'home',kickoff:'home'});await click('unitKickButton');await step(.75);await click('unitKickButton');await step(1/60);d=await state();assert(d.camera.target[2]>d.camera.eye[2]);await visibleAction('kickoff release framing');await step(.7);const ballInFrame=await page.evaluate(()=>{const f=window.bkMiniScenario.unit().state.flight;const t=f.t;return window.bkMiniScenario.project(f.from.map((v,i)=>v+(f.to[i]-v)*t+(i===1?Math.sin(Math.PI*t)*f.arc:0)));});assert(ballInFrame.visible&&ballInFrame.y>65&&ballInFrame.y<350,'Airborne kick remains below scoreboard');await page.screenshot({path:out+'/flow-kickoff-air.png'});
 for(let i=0;i<10&&(await state()).unit?.kind==='kickoff';i++)await step(4);assert.equal((await state()).unit.kind,'defense');assert((await state()).unit.book);
 const before=(await state()).drive.clock;await click('unitCallDefense');await click('defenseReady');
 for(let i=0;i<80&&!((await state()).unit?.book||(await state()).playbook.open||(await state()).mini.kickoff);i++)await step(.4);
 d=await state();assert(d.lastResult);assert(Math.abs(before-d.drive.clock-d.lastResult.seconds)<.02,'Live play is charged exactly once, without 10-second runoff');assert(await page.locator('#unitTop').isHidden());
 await setSession({possession:'home',pending:null,kickoff:null,conversion:null,result:null});await setDrive({ball:43,down:1,toGo:10,clock:180});await page.evaluate(()=>window.bkMiniScenario.setVertical());await click('breakHuddle');await click('snap');await step(.6);
 await page.evaluate(()=>{for(const p of window.bkMiniScenario.actors().slice(11,18)){p.fallen=true;p.x=25;p.z=0;}});await step(3);
 d=await state();assert.equal(d.phase,'pass');const gaps=[7,8,9].map(i=>Math.min(...d.players.slice(18).map(p=>Math.hypot(p.x-d.players[i].x,p.z-d.players[i].z))));assert(gaps.reduce((a,b)=>a+b)/gaps.length<6,'Secondary carries vertical routes instead of jogging behind: '+gaps);await page.screenshot({path:out+'/flow-vertical-coverage.png'});
 assert.deepEqual(errors,[]);console.log('PASS immediate snap/receive, ball+defender framing, catch/handoff switching, manual selection, complete kickoff/defensive possession and exact live clock.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
