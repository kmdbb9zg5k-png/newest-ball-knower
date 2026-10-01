import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve('artifacts/five-minute');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);
 // Scenario controls exist only in this test server, never in shipped code.
 if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('window.bk3dTest={',"window.bkMiniScenario={unit(){return liveUnit},actors(){return actors},setDrive(values){Object.assign(drive,values);updateHud()},finishPlay(reason,spot,incomplete=false){phase='run';endPlay(reason,spot,incomplete)},endDrive,setup,setSession(values){Object.assign(mini,values);updateHud()},advanceFull};window.bk3dTest={"));
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.glb':'model/gltf-binary'})[extname(name)]||'application/octet-stream');res.end(data);
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});page.setDefaultTimeout(45000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html`;
 await page.goto(base+'?mode=five-minute&difficulty=pro&team=JCY&opponent=OKC&qa=1');
 await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready);
 const state=()=>page.evaluate(()=>window.bk3dDiagnostics()), step=seconds=>page.evaluate(s=>window.bk3dTest.step(s),seconds), click=id=>page.locator('#'+id).dispatchEvent('click');
 const setDrive=values=>page.evaluate(v=>window.bkMiniScenario.setDrive(v),values),setSession=values=>page.evaluate(v=>window.bkMiniScenario.setSession(v),values);
 const finish=(reason,spot,incomplete=false)=>page.evaluate(v=>window.bkMiniScenario.finishPlay(...v),[reason,spot,incomplete]);

 let d=await state();assert.equal(d.drive.clock,300);await click('breakHuddle');await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});await step(.8);assert((await state()).drive.clock<300);
 await finish('TOUCHDOWN',100);d=await state();assert.equal(d.drive.score,6);assert.equal(d.mini.conversion,'home');assert(!d.ended);
 await click('fullXP');assert.equal((await state()).unit.kind,'extra-point');await step(.6);await click('unitKickButton');await step(3);await click('unitContinue');
 assert.equal((await state()).mini.kickoff,'home');await click('fullNext');assert.equal((await state()).unit.kind,'kickoff');
 await step(.6);await click('unitKickButton');await step(3);assert.equal((await state()).unit.stage,'run');
 for(let i=0;i<4&&(await state()).unit.stage!=='end';i++)await step(8);
 assert.equal((await state()).unit.stage,'end');await click('unitContinue');
 await setSession({pending:'away',nextBall:25,conversion:null,kickoff:null,possession:'home'});await click('fullPlayDefense');
 d=await state();assert.equal(d.unit.kind,'defense');assert.equal(await page.locator('#defenseCalls button').count(),3);
 await page.getByRole('button',{name:'Nickel',exact:true}).click();await page.locator('#defenseCalls button').first().click();
 await click('unitArt');await click('unitPress');await click('unitShift');await step(2);
 const before=(await state()).players[16];const stick=await page.locator('#stick').boundingBox();
 await page.mouse.move(stick.x+stick.width*.8,stick.y+stick.height*.5);await page.mouse.down();await step(.3);await page.mouse.up();
 assert(Math.hypot((await state()).players[16].x-before.x,(await state()).players[16].z-before.z)>.1,'Defensive joystick moves selected player');
 await page.screenshot({path:out+'/live-defense-presnap.png'});
 await click('unitReady');
 for(let i=0;i<20&&!['flight','end'].includes((await state()).unit.stage);i++)await step(.25);
 d=await state();console.log('DEFENSE',d.unit.stage,d.unit.pass,d.unit.target,d.unit.controlled);
 if(d.unit.stage==='flight'){assert(d.unit.switched);assert(d.unit.controlled>=11);await click('unitPrimary');}
 for(let i=0;i<5&&(await state()).unit.stage!=='end';i++)await step(6);
 assert.equal((await state()).unit.stage,'end');await page.screenshot({path:out+'/live-defense-result.png'});await click('unitContinue');
 // Manual tackle and queued simulation use real on-field controls.
 await setSession({pending:'away',nextBall:25,conversion:null,kickoff:null,possession:'home'});await click('fullPlayDefense');await page.locator('#defenseCalls button').first().click();await click('unitReady');await step(.4);
 await page.evaluate(()=>{const u=window.bkMiniScenario.unit().state,a=window.bkMiniScenario.actors();u.stage='run';u.carrier=6;u.controlled=16;a[6].hasBall=true;a[16].x=a[6].x+.4;a[16].z=a[6].z;});
 await click('unitSim');assert((await state()).unit.simNext);await click('unitPrimary');
 for(let i=0;i<5&&(await state()).unit.stage!=='end';i++){await step(1);await click('unitPrimary');}
 assert.equal((await state()).unit.stage,'end');await click('unitContinue');assert.equal((await state()).mini.defenseMode,'simulate');
 await setSession({pending:'home',nextBall:25,conversion:null,kickoff:'away',possession:'away'});await click('fullNext');
 assert.equal((await state()).unit.kicking,'away');await click('unitKickButton');await step(3);assert.equal((await state()).unit.controlled,6);
 await page.keyboard.down('ArrowUp');await step(2);await page.keyboard.up('ArrowUp');
 await page.screenshot({path:out+'/kick-return.png'});
 for(let i=0;i<5&&(await state()).unit.stage!=='end';i++)await step(6);await click('unitContinue');
 await page.goto(base+'?mode=two-minute&difficulty=all-pro&team=JCY&opponent=OKC&qa=1');await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());
 d=await state();assert.equal(d.drive.clock,120);assert.equal(d.drive.score,23);assert.equal(d.mini.awayScore,27);
 await setDrive({clock:49});await finish('TOUCHDOWN',100);assert(!(await state()).ended);assert.equal((await state()).mini.conversion,'home');
 await click('fullTwo');assert.equal((await state()).drive.ball,98);await finish('TOUCHDOWN',100);d=await state();assert.equal(d.drive.score,31);assert.equal(d.drive.clock,49);assert.equal(d.mini.kickoff,'home');
 // Small landscape has reachable controls and horizontally contained play cards.
 await setSession({kickoff:'away',pending:'home'});await click('fullNext');await click('unitTouchback');await click('unitContinue');
 await setSession({pending:'away',nextBall:25,conversion:null,kickoff:null,possession:'home'});await click('fullPlayDefense');
 await page.setViewportSize({width:667,height:375});await step(1);
 assert(await page.locator('#defenseBook').evaluate(el=>el.scrollWidth<=el.clientWidth));
 await page.screenshot({path:out+'/defense-book-small.png'});
 await page.locator('#defenseCalls button').first().click();await step(1);
 assert(await page.evaluate(()=>['unitReady','unitPrimary','unitSecondary','unitSwitch'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})));
 assert.deepEqual(errors,[]);console.log('PASS continuing two-minute mode, conversion choices, kickoffs, returns, defensive playbook, live CPU play and results.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
