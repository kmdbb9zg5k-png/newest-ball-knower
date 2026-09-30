import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve('artifacts/mini-games-drill');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);
 // Scenario controls exist only in this test server, never in shipped code.
 if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('window.bk3dTest={',"window.bkMiniScenario={setDrive(values){Object.assign(drive,values);updateHud()},finishPlay(reason,spot,incomplete=false){phase='run';endPlay(reason,spot,incomplete)},endDrive,setup};window.bk3dTest={"));
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.glb':'model/gltf-binary'})[extname(name)]||'application/octet-stream');res.end(data);
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});page.setDefaultTimeout(45000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html`;
 const open=async(query)=>{await page.goto(base+query);await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready);};
 const state=()=>page.evaluate(()=>window.bk3dDiagnostics());
 const step=seconds=>page.evaluate(s=>window.bk3dTest.step(s),seconds);
 const click=id=>page.locator('#'+id).dispatchEvent('click');
 const restart=()=>click('restart');
 const snap=async()=>{await click('breakHuddle');await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});};
 const ratings=[];
 for(const level of ['rookie','pro','all-pro']){
  await open(`?mode=two-minute&difficulty=${level}&qa=1`);
  let d=await state();assert.equal(d.drive.clock,120);assert.equal(d.drive.score,23);assert.equal(d.mini.level,level);ratings.push(d.players[18].ratings);
  await step(3);assert.equal((await state()).drive.clock,120);
  const boxes=await page.evaluate(()=>['.scorebug','#miniActions','.utility'].map(s=>{const b=document.querySelector(s).getBoundingClientRect();return{x:b.x,right:b.right,y:b.y,bottom:b.bottom}}));
  assert(boxes[2].right<=boxes[0].x&&boxes[0].right<=boxes[1].x,'Header controls must not overlap');
 }
 assert(ratings[0].coverage<ratings[1].coverage&&ratings[1].coverage<ratings[2].coverage);
 assert(ratings.every(r=>r.speed===ratings[0].speed));
 await page.screenshot({path:out+'/playbook-all-pro.png'});
 // A natural, controlled run must consume live time and return to the next play or finish the drive.
 await snap();await page.keyboard.down('ArrowUp');
 for(let i=0;i<30;i++){await step(.5);if((await state()).phase==='dead')break;}
 await page.keyboard.up('ArrowUp');let d=await state();assert(d.drive.clock<120);assert.equal(d.drive.plays,1);assert.equal(d.phase,'dead');
 await step(5);assert((await state()).playbook.open||(await state()).ended);
 await restart();await snap();await step(.7);
 await page.evaluate(()=>window.bkMiniScenario.finishPlay('TACKLED',31));
 const afterPlay=(await state()).drive.clock;await step(.3);assert((await state()).drive.clock<afterPlay);
 await click('miniTimeout');d=await state();assert.equal(d.mini.timeouts,2);const stopped=d.drive.clock;
 await step(4);assert.equal((await state()).drive.clock,stopped);
 await click('miniSpike');d=await state();assert.equal(d.drive.down,3);assert.equal(d.drive.clock,stopped-1);assert.equal(d.mini.running,false);
 await click('pause');const paused=(await state()).drive.clock;await step(4);assert.equal((await state()).drive.clock,paused);await click('resume');
 await page.screenshot({path:out+'/timeout-spike.png'});
 // A first down must keep the game clock running and reset the series.
 await page.evaluate(()=>{window.bkMiniScenario.setDrive({down:2,toGo:5});window.bkMiniScenario.finishPlay('OUT OF BOUNDS',40)});await step(3);
 d=await state();assert.equal(d.drive.down,1);assert.equal(d.drive.toGo,10);assert.equal(d.mini.running,false);
 await page.evaluate(()=>window.bkMiniScenario.finishPlay('PASS BROKEN UP',40,true));await step(3);assert.equal((await state()).mini.running,false);
 // Win on a final live play at zero; result, recap and difficulty-specific best.
 await restart();await snap();await step(.7);
 await page.evaluate(()=>{window.bkMiniScenario.setDrive({clock:0});window.bkMiniScenario.finishPlay('TOUCHDOWN',100)});await step(9);
 d=await state();assert(d.ended&&d.mini.result.won);assert.equal(d.drive.score,29);assert.equal(await page.locator('#dialogTitle').textContent(),'DRILL WON');
 await page.locator('#miniSummary summary').click();await page.screenshot({path:out+'/win-recap.png'});
 assert.equal(await page.locator('#restart').textContent(),'TRY AGAIN');assert.equal(await page.locator('#paused a').getAttribute('href'),'/?miniGames=1');
 await restart();d=await state();assert.equal(d.drive.clock,120);assert.equal(d.mini.timeouts,3);assert.equal(d.mini.log.length,0);
 for(const reason of ['TIME EXPIRED','TURNOVER ON DOWNS','INTERCEPTED','SAFETY']){
  if(reason==='TIME EXPIRED'){await snap();await step(.5);await page.evaluate(()=>{window.bkMiniScenario.finishPlay('TACKLED',26);window.bkMiniScenario.setDrive({clock:.1});});await step(4);}
  else if(reason==='TURNOVER ON DOWNS'){await page.evaluate(()=>{window.bkMiniScenario.setDrive({down:4});window.bkMiniScenario.finishPlay('PASS BROKEN UP',25,true)});await step(4);}
  else if(reason==='SAFETY'){await page.evaluate(()=>window.bkMiniScenario.finishPlay('SACK',-1));await step(4);}
  else {await page.evaluate(()=>window.bkMiniScenario.endDrive('INTERCEPTED',''));await step(4);}
  d=await state();assert.equal(d.mini.result.reason,reason);assert.equal(d.mini.result.won,false);assert.equal(await page.locator('#paused').isVisible(),true);await restart();
 }
 // Phone rotation and a second landscape size.
 await page.setViewportSize({width:390,height:844});assert(await page.locator('#rotate').isVisible());
 await page.setViewportSize({width:667,height:375});await click('resume');await page.screenshot({path:out+'/small-landscape.png'});
 assert(await page.evaluate(()=>{const a=document.querySelector('#miniActions').getBoundingClientRect(),s=document.querySelector('.scorebug').getBoundingClientRect();return a.x>=s.right&&a.right<=innerWidth}));
 await open('?qa=1');d=await state();assert.equal(d.mini,null);assert.equal(d.drive.clock,78);assert.equal(d.drive.score,24);assert.equal(await page.locator('#miniActions').count(),0);
 await snap();await step(.7);assert.notEqual((await state()).phase,'pre');
 assert.deepEqual(errors,[]);console.log('PASS: 3 levels, natural live play, clock/timeout/spike, first downs, incompletions, win at zero, all loss outcomes, replay/reset, rotation, mobile layout, unchanged practice.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
