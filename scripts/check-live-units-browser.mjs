import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve('artifacts/five-minute');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);
 // Scenario controls exist only in this test server, never in shipped code.
 if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('window.bk3dTest={',"window.bkMiniScenario={unit(){return liveUnit},startUnit,project(point){return r.project(point)},actors(){return actors},setDrive(values){Object.assign(drive,values);updateHud()},finishPlay(reason,spot,incomplete=false){phase='run';endPlay(reason,spot,incomplete)},endDrive,setup,setSession(values){Object.assign(mini,values);updateHud()},advanceFull};window.bk3dTest={"));
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
 assert.equal(d.mini.log.filter(e=>e.reason==='TOUCHDOWN').length,1,'One touchdown entry');
 assert.match(await page.locator('#down').innerText(),/CONVERSION/);
 await click('fullXP');d=await state();assert.equal(d.unit.kind,'extra-point');
 assert(d.camera.target[2]>d.camera.eye[2],'Extra point faces uprights');
 assert.equal(d.players[16].team,0,'Kicker wears home uniform');
 assert(d.players.slice(11).every(p=>p.z>85&&p.z<96),'Actual goal-kick formation');
 assert(await page.locator('#unitPad').isHidden());assert(await page.locator('#stick').isHidden());
 const aimStick=await page.locator('#kickAimStick').boundingBox();
 await page.mouse.move(aimStick.x+aimStick.width*.8,aimStick.y+aimStick.height*.5);await page.mouse.down();await step(.2);await page.mouse.up();
 const aimed=(await state()).unit.aim.x;assert(aimed<-.1,'Right on goal aiming stick moves target screen-right');await step(.2);assert.equal((await state()).unit.aim.x,aimed,'Target stays when stick released');
 await page.setViewportSize({width:667,height:375});await step(.1);
 assert(await page.evaluate(()=>['kickAimStick','unitKickButton'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&r.width>=44&&r.height>=44;})));
 await page.setViewportSize({width:844,height:390});await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await step(.1);
 const posts=await page.evaluate(()=>[[-3.1,3.2,117],[3.1,10,117]].map(p=>window.bkMiniScenario.project(p)));assert(posts.every(p=>p.visible&&p.x>0&&p.x<844&&p.y>65&&p.y<300),'Both uprights visible below scoreboard');
 await page.screenshot({path:out+'/extra-point-aim.png'});
 await click('unitKickButton');await step(.75);await click('unitKickButton');await step(3);await click('unitContinue');
 assert.equal((await state()).drive.score,7,'Accurate goal kick scores');assert.equal((await state()).mini.kickoff,'home');await click('fullNext');d=await state();assert.equal(d.unit.kind,'kickoff');assert(d.camera.target[2]<d.camera.eye[2],'Coverage faces returner');
 await step(.1);await page.screenshot({path:out+'/kickoff-aim.png'});

 await click('unitKickButton');await step(.75);await click('unitKickButton');await step(3.6);assert.equal((await state()).unit.stage,'run');
 for(let i=0;i<4&&(await state()).unit.stage!=='end';i++)await step(8);
 assert.equal((await state()).unit.stage,'end');await click('unitContinue');
 await setSession({pending:'away',nextBall:25,conversion:null,kickoff:null,possession:'home'});await click('fullPlayDefense');
 d=await state();assert.equal(d.unit.kind,'defense');assert.equal(await page.locator('#defenseCalls button').count(),3);
 await page.getByRole('button',{name:'Nickel',exact:true}).click();await page.locator('#defenseCalls button').first().click();
 await step(1);
 d=await state();const tapPlayer=d.players.map((p,index)=>({...p,index})).find(p=>p.index>=11&&p.index!==d.unit.controlled&&p.head.visible&&p.head.x>180&&p.head.x<650&&p.head.y>100&&p.foot.y<245);
 assert(tapPlayer,'A defender is visible for tap selection');
 await page.mouse.click((tapPlayer.head.x+tapPlayer.foot.x)/2,(tapPlayer.head.y+tapPlayer.foot.y)/2);
 assert.equal((await state()).unit.controlled,tapPlayer.index,'Tap switches to selected defender');
 await page.evaluate(()=>window.bkMiniScenario.unit().selectPlayer(16));
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
 d=await state();assert.equal(d.unit.kicking,'away');assert(d.camera.target[2]>d.camera.eye[2],'Return camera faces upfield');await click('unitKickButton');await step(3.6);assert.equal((await state()).unit.controlled,6);
 await page.keyboard.down('ArrowUp');await step(2);await page.keyboard.up('ArrowUp');
 await page.screenshot({path:out+'/kick-return.png'});
 for(let i=0;i<5&&(await state()).unit.stage!=='end';i++)await step(6);await click('unitContinue');
 // Field goals use the same aim controls and observed result, not a second random roll.
 await setSession({possession:'home',pending:null,conversion:null,kickoff:null,result:null});await setDrive({ball:80,clock:100,down:4});await page.evaluate(()=>window.bkMiniScenario.setup());
 await click('fullFieldGoal');assert.equal((await state()).unit.kind,'field-goal');const scoreBefore=(await state()).drive.score;
 await click('unitKickButton');await step(.75);await click('unitKickButton');await step(2);assert((await state()).unit.good);await click('unitContinue');assert.equal((await state()).drive.score,scoreBefore+3);
 // Deliberately wide kicks stay misses through scoring and keep the camera facing the posts.
 await setSession({possession:'home',pending:null,conversion:null,kickoff:null,result:null});await setDrive({ball:80,clock:100,down:4});await page.evaluate(()=>window.bkMiniScenario.setup());await click('fullFieldGoal');
 await page.locator('#kickAimStick').focus();for(let i=0;i<10;i++)await page.keyboard.press('ArrowRight');
 await click('unitKickButton');await step(.75);await click('unitKickButton');await step(2);d=await state();assert(!d.unit.good);assert.match(d.unit.result.reason,/WIDE/);assert(d.camera.target[2]>d.camera.eye[2]);await click('unitContinue');assert.equal((await state()).drive.score,scoreBefore+3);
 // A normal offensive down must return to the full playbook.
 await setSession({possession:'home',pending:null,conversion:null,kickoff:null,result:null});await setDrive({ball:25,clock:100,down:1,toGo:10});await page.evaluate(()=>window.bkMiniScenario.setup());await click('breakHuddle');await finish('TACKLED',28);await step(5);assert((await state()).playbook.open);assert(await page.locator('#playbook').isVisible());
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
