import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve('artifacts/five-minute');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);
 // Scenario controls exist only in this test server, never in shipped code.
 if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('onResult(result){','onResult(result){window.bkLastUnitResult=result;').replace('window.bk3dTest={',"window.bkMiniScenario={rearChase(){phase='run';mode='pass';carrier=actors[5];elapsed=2;jukeUntil=0;input.z=1;for(const p of actors){p.x=-20;p.z=10;p.engaged=false;p.engagedWith=null;}Object.assign(carrier,{x:15,z:65,vx:0,vz:8,hasBall:true});Object.assign(actors[15],{x:15,z:64.01,vx:0,vz:8,contactReady:0});updateControls();},inspectGrip(){const p=actors[5];r.camera([p.x+3,2.1,p.z+1.5],[p.x,1.1,p.z]);scene(.016,simTime*1000)},grip(){const p=actors[5],h=meshy.handTransforms.get(5),m=meshy.modelFor(p);return{anchor:meshy.ballAnchor(p),wrists:[h.left,h.right].map(hand=>Array.from(mul(m,hand)).slice(12,15))}},setVertical(){liveUnit?.stop();mode='pass';selected=PASSES.findIndex(p=>p.id==='verts');setup();},unit(){return liveUnit},startUnit,project(point){return r.project(point)},actors(){return actors},setDrive(values){Object.assign(drive,values);updateHud()},finishPlay(reason,spot,incomplete=false){phase='run';endPlay(reason,spot,incomplete)},endDrive,setup(){liveUnit?.stop();setup()},showFullState,setSession(values){Object.assign(mini,values);updateHud()},advanceFull};window.bk3dTest={"));
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


 // Backed-up offense must remain in front of the tunnel and fully visible.
 await setDrive({ball:1,down:1,toGo:10,clock:243.2});await page.evaluate(()=>window.bkMiniScenario.setup());await click('breakHuddle');await step(.2);
 let d=await state();assert(d.camera.eye[2]>=-14);assert(d.players[5].head.visible);await page.screenshot({path:out+'/polish-own-one.png'});assert(d.players[5].head.y>65&&d.players[5].foot.y<350,'Own-goal QB must remain visible');
 await page.screenshot({path:out+'/polish-own-one.png'});
 // Matched-speed rear contact is eligible; lateral parallel runners remain separate.
 const contact=await page.evaluate(async()=>{const {tackleContactEligible}=await import('/play-moment-3d/game.js?v=contact-camera-11');const runner={x:0,z:20,vx:0,vz:8};return [tackleContactEligible({x:0,z:19,vx:0,vz:8},runner,1.05),tackleContactEligible({x:1,z:20,vx:0,vz:8},runner,1.05),tackleContactEligible({x:0,z:18,vx:0,vz:8},runner,1.05)];});assert.deepEqual(contact,[true,false,false]);
 await page.evaluate(()=>window.bkMiniScenario.rearChase());await step(1/60);d=await state();assert.equal(d.lastTackler,15,'Trailing defender must initiate real contact');
 // Return clock must never gain a displayed second when its result settles.
 await setSession({kickoff:'away',possession:'away',pending:null,conversion:null,result:null});await setDrive({clock:246.2});await page.evaluate(()=>window.bkMiniScenario.startUnit('kickoff'));
 let previous=Infinity,samples=0;for(let i=0;i<45;i++){await step(.5);const now=await page.locator('#clock').textContent();const [m,s]=now.split(':').map(Number),n=m*60+s;assert(n<=previous,`Clock gained time: ${previous} -> ${n}`);previous=n;samples++;d=await state();if(!d.unit)break;}assert(!d.unit,'Kickoff should settle');assert(samples>3);
 await setSession({possession:'away',kickoff:null,cpu:{ball:25,down:4,toGo:10}});await page.evaluate(()=>window.bkMiniScenario.startUnit('punt'));await step(.3);
 const punt=await page.evaluate(()=>{const box=document.querySelector('#unitKick').getBoundingClientRect();return{width:box.width,guide:getComputedStyle(document.querySelector('#kickGuide')).display,fair:!document.querySelector('#unitFairCatch').hidden};});assert(punt.width<220&&punt.guide==='none'&&punt.fair);await page.screenshot({path:out+'/polish-punt.png'});
 await setSession({possession:'home',kickoff:null,conversion:'home'});await page.evaluate(()=>window.bkMiniScenario.startUnit('extra-point'));await click('unitKickButton');await step(.75);await click('unitKickButton');await step(.45);d=await state();
 assert(d.players.some(p=>p.engagedWith===0),'Left edge should draw a protector');assert(d.players.some(p=>p.engagedWith===10),'Right edge should draw a protector');await page.screenshot({path:out+'/polish-extra-point.png'});
 await page.evaluate(()=>{window.bkMiniScenario.unit().stop();window.bkMiniScenario.setSession({conversion:null});window.bkMiniScenario.setDrive({ball:25});window.bkMiniScenario.setup();});await step(.1);
 const cards=await page.evaluate(()=>[...document.querySelectorAll('.play-card')].map(p=>({height:p.getBoundingClientRect().height,font:parseFloat(getComputedStyle(p.querySelector('b')).fontSize)})));assert(cards.length&&cards.every(c=>c.height>=132&&c.font>=12));await page.screenshot({path:out+'/polish-playbook.png'});
 assert.deepEqual(errors,[]);console.log('PASS goal-line visibility, rear tackle eligibility, monotonic return clock, compact fair catch, edge protection and readable mobile playbook.');
}finally{await browser.close();server.close();}
