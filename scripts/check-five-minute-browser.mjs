import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve('artifacts/five-minute');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);
 // Scenario controls exist only in this test server, never in shipped code.
 if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('window.bk3dTest={',"window.bkMiniScenario={setDrive(values){Object.assign(drive,values);updateHud()},finishPlay(reason,spot,incomplete=false){phase='run';endPlay(reason,spot,incomplete)},endDrive,setup,setSession(values){Object.assign(mini,values);updateHud()},advanceFull};window.bk3dTest={"));
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
 let d=await state();assert.equal(d.drive.clock,300);assert.equal(d.drive.score,0);assert.equal(await page.locator('.away strong').textContent(),'0');assert(await page.locator('#fullPunt').isVisible());assert(await page.locator('#fullFieldGoal').isDisabled());
 await step(3);assert.equal((await state()).drive.clock,300);
 // Natural offense snap, then a complete possession change without leaving the game.
 await click('breakHuddle');await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});await step(.8);assert((await state()).drive.clock<300);
 await finish('TOUCHDOWN',100);d=await state();assert.equal(d.drive.score,7);assert.equal(d.mini.pending,'away');assert(!d.ended);assert(await page.locator('#fullDefense').isVisible());
 await click('fullNext');assert.equal((await state()).mini.possession,'away');
 await click('fullAuto');assert.equal((await state()).mini.auto,false);const count=(await state()).mini.log.length;await step(8);assert.equal((await state()).mini.log.length,count);
 await click('fullDefenseTimeout');assert.equal((await state()).mini.timeouts,2);
 const clock=(await state()).drive.clock;await click('fullNext');d=await state();assert(d.mini.log.length>count);assert.equal(d.drive.clock,clock-5);
 await page.screenshot({path:out+'/defense-play.png'});
 // Pause freezes the simulation; resume restores it.
 await click('pause');const frozen=(await state()).drive.clock;await step(5);assert.equal((await state()).drive.clock,frozen);await click('resume');
 // Step an entire CPU possession, inspect the result, and return to the offensive playbook.
 for(let i=0;i<40&&(await state()).mini.pending===null;i++)await click('fullNext');
 assert.equal((await state()).mini.pending,'home');await click('fullNext');assert.equal((await state()).phase,'pre');assert((await state()).playbook.open);
 // Field goal and punt controls update score and possession.
 await setDrive({ball:80});await click('fullFieldGoal');assert.equal((await state()).mini.pending,'away');await click('restart');
 await click('fullPunt');assert.equal((await state()).mini.pending,'away');assert((await state()).mini.log.at(-1).reason.startsWith('PUNT'));
 await click('restart');await setDrive({down:4,ball:40});await finish('INCOMPLETE',40,true);assert.equal((await state()).mini.pending,'away');await click('fullNext');assert.equal((await state()).mini.cpu.ball,60);
 await click('restart');await finish('SACK',-1);assert.equal((await state()).mini.awayScore,2);assert.equal((await state()).mini.nextBall,35);
 // Regulation win, recap, player stats, rematch reset.
 await click('restart');await setDrive({score:7,clock:.1});await setSession({started:true,running:true});await step(1);d=await state();assert(d.ended&&d.mini.result.won);assert.equal(await page.locator('#dialogTitle').textContent(),'VICTORY');assert(await page.locator('#miniSummary table').isVisible());await page.screenshot({path:out+'/final-score.png'});
 await click('restart');d=await state();assert.equal(d.drive.clock,300);assert.equal(d.mini.log.length,0);assert.equal(d.mini.timeouts,3);assert.equal(d.mini.awayScore,0);
 // Tied regulation → home OT TD → CPU gets its guaranteed possession → final.
 await setDrive({clock:.1});await setSession({started:true,running:true});await step(1);assert.equal((await state()).mini.overtime,1);await click('fullNext');assert.equal((await state()).drive.ball,75);assert(await page.locator('#fullPunt').isDisabled());await step(3);assert.equal((await state()).drive.clock,0);
 await finish('TOUCHDOWN',100);assert(!(await state()).ended);await click('fullNext');assert.equal((await state()).mini.cpu.ball,75);
 await setSession({cpu:{ball:20,down:4,toGo:80}});await click('fullNext');assert((await state()).ended);assert.equal(await page.locator('#dialogTitle').textContent(),'VICTORY');
 // A complete game with no injected score/clock: punt each user possession, watch every CPU snap, reach a final.
 await click('restart');
 for(let i=0;i<300&&!(await state()).ended;i++){
  const current=await state();
  if(current.phase==='cpu')await click('fullNext');
  else if(current.mini.overtime)await click('fullFieldGoal');
  else await click('fullPunt');
 }
 d=await state();assert(d.ended&&d.mini.result);assert.equal(d.drive.clock,0);assert(d.mini.stats.away.plays>0);assert(d.mini.log.length>10);
 await page.screenshot({path:out+'/complete-game-final.png'});
 // Small landscape controls remain within viewport; portrait rotates safely.
 await click('restart');await page.setViewportSize({width:667,height:375});
 assert(await page.evaluate(()=>['#fullPunt','#fullFieldGoal','#breakHuddle'].every(id=>{const r=document.querySelector(id).getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})));
 await click('fullPunt');await page.screenshot({path:out+'/small-defense.png'});await page.setViewportSize({width:390,height:844});assert(await page.locator('#rotate').isVisible());
 assert.deepEqual(errors,[]);console.log('PASS full-game browser: live snap, TD/possession, CPU play-by-play/pause/timeout, FG/punt, downs/safety, final stats/rematch, paired OT, mobile controls/rotation.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
