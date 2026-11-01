import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve(process.env.OUT||'artifacts/five-minute');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{
 const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);
 // Scenario controls exist only in this test server, never in shipped code.
 if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('window.bk3dTest={',"window.bkMiniScenario={setDrive(values){Object.assign(drive,values);updateHud()},finishPlay(reason,spot,incomplete=false){phase='run';endPlay(reason,spot,incomplete)},endDrive,setup,setSession(values){Object.assign(mini,values);updateHud()},advanceFull};window.bk3dTest={"));
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.glb':'model/gltf-binary'})[extname(name)]||'application/octet-stream');res.end(data);
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});page.setDefaultTimeout(45000);const errors=[],completeGames=[];page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html`;
 await page.goto(base+'?mode=five-minute&difficulty=pro&team=JCY&opponent=OKC&qa=1&manualFrames=1');
 await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>{window.bk3dTest.manualFrames();window.bk3dTest.seed(742)});await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready);
 const state=()=>page.evaluate(()=>window.bk3dDiagnostics()), step=seconds=>page.evaluate(s=>window.bk3dTest.step(s),seconds), click=id=>page.locator('#'+id).click();
 const verifyRecapScroll=async()=>{
  const result=await page.evaluate(()=>{
   const panel=document.querySelector('#paused>div'),last=[...document.querySelectorAll('#miniSummary .full-final-stats tr')].at(-1),button=document.querySelector('#restart');
   const contained=el=>{const a=el.getBoundingClientRect(),b=panel.getBoundingClientRect();return a.top>=Math.max(0,b.top)-1&&a.bottom<=Math.min(innerHeight,b.bottom)+1&&a.left>=0&&a.right<=innerWidth;};
   last.scrollIntoView({block:'nearest'});const statsReachable=contained(last),statsScroll=panel.scrollTop;
   button.scrollIntoView({block:'nearest'});return{statsReachable,statsScroll,rematchReachable:contained(button),overflow:getComputedStyle(panel).overflowY};
  });
  assert(result.statsReachable&&result.rematchReachable,JSON.stringify(result));return result;
 };
 const setDrive=values=>page.evaluate(v=>window.bkMiniScenario.setDrive(v),values),setSession=values=>page.evaluate(v=>window.bkMiniScenario.setSession(v),values);
 const finish=(reason,spot,incomplete=false)=>page.evaluate(v=>window.bkMiniScenario.finishPlay(...v),[reason,spot,incomplete]);
 let d=await state();assert.equal(d.drive.clock,300);assert.equal(d.drive.score,0);assert.equal(await page.locator('.away strong').textContent(),'0');assert(await page.locator('#fullPunt').isVisible());assert(await page.locator('#fullFieldGoal').isDisabled());
 await step(3);assert.equal((await state()).drive.clock,300);
 // Natural offense snap, then a complete possession change without leaving the game.
 await click('breakHuddle');await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});await step(.8);assert((await state()).drive.clock<300);
 // TD begins a conversion playbook; the extra point is a real kick, not an automatic seventh point.
 await finish('TOUCHDOWN',100);d=await state();assert.equal(d.drive.score,6);assert.equal(d.mini.conversion,'home');assert(!d.ended);assert(d.playbook.open);
 assert(await page.locator('#formationTabs [data-formation="special-teams"]').isVisible());
 const kick=async()=>{const u=(await state()).unit;assert(u&&u.stage==='kick');if(u.kicking==='home'){await click('unitKickButton');await step(.75);assert((await state()).unit.power>.65);await click('unitKickButton');}else if(await page.locator('#unitKickButton').isVisible())await click('unitKickButton');else await step(1);};
 const settleUnit=async()=>{const first=await state(),kind=first.unit?.kind,count=first.mini.log.length;for(let i=0;i<30;i++){const cur=await state();if(cur.ended||!cur.unit||cur.unit.kind!==kind||cur.mini.log.length>count)return cur;await step(2);}throw Error('Unit did not finish: '+JSON.stringify((await state()).unit));};
 const restart=async()=>{const cur=await state();if(!cur.paused&&!cur.ended)await click('pause');await click('restart');};
 await click('breakHuddle');assert.equal((await state()).unit.kind,'extra-point');await kick();await settleUnit();
 d=await state();assert.equal(d.drive.score,7);assert.equal(d.mini.conversion,null);assert.equal(d.unit.kind,'kickoff');
 await kick();await settleUnit();d=await state();assert.equal(d.mini.possession,'away');assert.equal(d.unit.kind,'defense');assert(d.unit.book);
 // Actually call a defense and play a snap before exercising the optional Simulate Play control.
 await click('unitCallDefense');await click('defenseReady');await step(.5);await page.keyboard.down('ArrowLeft');await step(.25);await page.keyboard.up('ArrowLeft');
 await click('pause');const frozen=(await state()).simTime;await step(5);assert.equal((await state()).simTime,frozen);await click('resume');
 await settleUnit();await page.screenshot({path:out+'/defense-play.png'});
 console.log('PASS touchdown -> manual PAT -> kickoff -> defensive snap and pause');
 // Each normal-control iteration advances a visible UI or the ordinary simulation clock.
 // No actor, score, outcome or game-clock injection is used in completeMatch.
 const completeMatch=async()=>{
  let actions=0,liveDefense=0;const started=Date.now();
  for(;actions<500;actions++){
   const cur=await state();if(cur.ended)return{actions,liveDefense,state:cur};
   assert(Date.now()-started<300000,'Complete match exceeded five-minute wall-clock budget');
   assert.equal(cur.glError,0);assert(cur.players.filter(p=>p.hasBall).length<=1,'Ball has multiple owners');
   if(cur.unit){
    if(cur.unit.kind==='defense'&&cur.unit.book){
     if(liveDefense<2){await click('unitCallDefense');await click('defenseReady');liveDefense++;}
     else await click('unitSimBook');
    }else if(cur.unit.stage==='kick')await kick();
    else await step(5);
   }else if(cur.playbook.open){
    if(cur.mini.conversion==='home')await click('breakHuddle');
    else if(cur.mini.overtime)await click('fullFieldGoal');
    else await click('fullPunt');
   }else if(cur.phase==='cpu')await click('fullNext');
   else await step(5);
   if(actions%25===0)console.log('Match progress',JSON.stringify({actions,clock:(await state()).drive.clock}));
  }
  throw Error('Complete match exceeded action budget: '+JSON.stringify(await state()));
 };
 // Situational transitions retain test-only setup, followed by actual interactive controls.
 await restart();await setDrive({ball:80});await click('fullFieldGoal');assert.equal((await state()).unit.kind,'field-goal');await kick();await settleUnit();assert.equal((await state()).drive.score,3);
 await restart();await setDrive({down:4,ball:40});await finish('INCOMPLETE',40,true);d=await state();assert.equal(d.mini.possession,'away');assert.equal(d.mini.cpu.ball,60);assert.equal(d.unit.kind,'defense');
 await restart();await finish('SACK',-1);assert.equal((await state()).mini.awayScore,2);assert.equal((await state()).mini.cpu.ball,35);
 await restart();await setDrive({score:7,clock:.1});await setSession({started:true,running:true});await step(1);d=await state();assert(d.ended&&d.mini.result.won);assert.equal(await page.locator('#dialogTitle').textContent(),'VICTORY');assert(await page.locator('#miniSummary table').isVisible());await page.screenshot({path:out+'/final-score.png'});
 await restart();d=await state();assert.equal(d.drive.clock,300);assert.equal(d.mini.log.length,0);assert.equal(d.mini.timeouts,3);assert.equal(d.mini.awayScore,0);
 // Equal-possession overtime must still give the visitor its possession after the home TD/PAT.
 await setDrive({clock:.1});await setSession({started:true,running:true});await step(1);d=await state();assert.equal(d.mini.overtime,1);assert.equal(d.drive.ball,75);assert(await page.locator('#fullPunt').isDisabled());
 await finish('TOUCHDOWN',100);await click('breakHuddle');await kick();await settleUnit();d=await state();assert(!d.ended);assert.equal(d.mini.cpu.ball,75);assert.equal(d.mini.possession,'away');
 const ot=await completeMatch();assert(ot.state.ended&&ot.state.mini.result);console.log('PASS paired overtime through final');
 // Both shipped full-game modes reach a result without injected scores, clocks, positions or outcomes.
 for(const mode of ['two-minute','five-minute']){
  await page.goto(base+'?mode='+mode+'&difficulty=pro&team=JCY&opponent=OKC&qa=1&manualFrames=1');
  await page.waitForFunction(()=>window.bk3dDiagnostics?.().athletes.ready);await page.evaluate(()=>{window.bk3dTest.manualFrames();window.bk3dTest.seed(742)});
  const result=await completeMatch();d=result.state;
  assert.equal(d.drive.clock,0);assert(d.mini.stats.away.plays>0);assert(d.mini.log.length>5);assert(await page.locator('#miniSummary table').isVisible());
  await page.screenshot({path:out+'/'+mode+'-complete-final.png'});await verifyRecapScroll();
  const report={mode,actions:result.actions,liveDefense:result.liveDefense,score:d.drive.score,away:d.mini.awayScore,plays:d.mini.stats.away.plays,overtime:d.mini.overtime};completeGames.push(report);console.log('PASS complete normal-control match',JSON.stringify(report));
 }
 await restart();await page.setViewportSize({width:667,height:375});
 assert(await page.evaluate(()=>['#fullPunt','#fullFieldGoal','#breakHuddle'].every(id=>{const r=document.querySelector(id).getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})));
 await click('fullPunt');await page.screenshot({path:out+'/small-punt.png'});await page.setViewportSize({width:390,height:844});assert(await page.locator('#rotate').isVisible());
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({status:'PASS',completeGames,errors,coverage:'PAT/kickoff/live defense/pause, situational FG/downs/safety/final/rematch/paired OT, complete matches with normal controls and optional Simulate Play, mobile layouts'},null,2));console.log('PASS full-game browser: manual PAT/kickoff, live defense/pause, FG/downs/safety, final/rematch, paired OT, complete two/five-minute matches, mobile controls.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
