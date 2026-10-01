import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
import {chromium} from 'playwright';
import {FORMATIONS,RUNS,PASSES,matchingPlays} from '../public/play-moment-3d/playbook.js';
import {runConceptDirection,runBlockAssignments,perimeterBlockAssignments} from '../public/play-moment-3d/game.js';
const all=matchingPlays();
assert.equal(all.length,32);assert.equal(new Set(all.map(e=>e.play.id)).size,32);
for(const {mode,play,index} of all){
 assert.ok(FORMATIONS.some(f=>f.id===play.formation));
 if(mode==='run'){
  assert.ok(play.path.length>=3);assert.ok(runBlockAssignments(index).length>=6);
  const pairs=[...runBlockAssignments(index),...perimeterBlockAssignments(index)];assert.equal(new Set(pairs.map(p=>p[0])).size,pairs.length);
  for(const side of [-1,1]){const v=runConceptDirection(index,1,0,30,35,side);assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.z));}
 }else{assert.equal(play.routes.length,5);for(const route of play.routes)assert.ok(route.length>=2)}
}
const root=resolve('public'),mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.glb':'model/gltf-binary'};
const server=createServer(async(req,res)=>{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/')){res.writeHead(403).end();return}try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'}).end(bytes)}catch{res.writeHead(404).end()}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_PATH?{executablePath:process.env.BROWSER_PATH}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors=[];let calls=0;
const base=process.env.BK_TEST_URL||`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html`;
try{
 const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(base+(base.includes('?')?'&':'?')+'qa=1',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.bk3dTest);
 await page.evaluate(()=>window.bk3dTest.manualFrames());
 assert.equal(await page.locator('.play-card').count(),32);
 for(const f of FORMATIONS.filter(f=>f.id!=='special-teams')){await page.locator(`#formationTabs [data-formation="${f.id}"]`).click();assert.equal(await page.locator('.play-card').count(),matchingPlays(f.id).length)}
 await page.locator('#filterPass').click();assert.equal(await page.locator('.play-card').count(),0);assert.equal(await page.locator('#breakHuddle').isDisabled(),true);
 await page.locator('#formationTabs [data-formation="all"]').click();await page.locator('#filterRead').click();assert.equal(await page.locator('.play-card').count(),2);
 await page.locator('#formationTabs [data-formation="shotgun"]').click();
 for(const size of [{width:844,height:390},{width:667,height:320},{width:1108,height:512}]){
  await page.setViewportSize(size);
  const boxes=await page.evaluate(()=>['playbookGrid','formationTabs','breakHuddle','filterRead'].map(id=>{const b=document.getElementById(id).getBoundingClientRect();return{id,x:b.x,y:b.y,right:b.right,bottom:b.bottom,w:b.width,h:b.height}}));
  for(const b of boxes){assert.ok(b.x>=0&&b.right<=size.width+1&&b.y>=0&&b.bottom<=size.height+1,JSON.stringify(b));if(b.id!=='playbookGrid')assert.ok(b.h>=44)}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 await page.setViewportSize({width:1108,height:512});await page.screenshot({path:'/tmp/bk-formation-playbook.png'});
 await page.setViewportSize({width:844,height:390});
 const choose=async(mode,index,formation)=>{
  const d=await page.evaluate(()=>window.bk3dDiagnostics());
  if(!d.playbook.open){if(!d.paused)await page.locator('#pause').click();await page.locator('#restart').click();}
  await page.locator(`#formationTabs [data-formation="${formation}"]`).click();
  await page.locator(`#call-${mode}-${index}`).click();await page.locator('#breakHuddle').click();
  assert.equal(await page.locator('#playbook').isHidden(),true);assert.equal(await page.locator('#playerNames').isHidden(),true);
 };
 for(const {mode,index,play} of all){
  await choose(mode,index,play.formation);
  const pre=await page.evaluate(()=>window.bk3dDiagnostics()),f=FORMATIONS.find(f=>f.id===play.formation);
  assert.equal(pre.playId,play.id);
  f.positions.forEach(([x,z],i)=>{assert.equal(pre.players[i+5].startX,x);assert.ok(Math.abs(pre.players[i+5].startZ-pre.field.scrimmage-z)<.001)});
  await page.locator('#playArt').click();assert.equal(await page.locator('#playerNames').isHidden(),false);
  const names=await page.locator('.player-name').allTextContents();assert.ok(names.every(n=>/^(WR|RB|TE)/.test(n)));
  await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:44,pointerType:'touch'});
  await page.evaluate(()=>window.bk3dTest.step(.3));
  let d=await page.evaluate(()=>window.bk3dDiagnostics());
  assert.equal(d.phase,play.direct?'run':mode==='run'?'handoff':'pass',play.id);
  if(play.direct){assert.equal(d.players[6].hasBall,true);assert.equal(d.players[5].hasBall,false)}
  if(mode==='run'&&!play.direct){await page.evaluate(t=>window.bk3dTest.step(t),play.handoff+.56);d=await page.evaluate(()=>window.bk3dDiagnostics());assert.equal(d.phase,'run',play.id);assert.equal(d.players[6].hasBall,true,play.id)}
  assert.equal(d.players.filter(p=>p.hasBall).length,1,play.id+' ownership');
  assert.ok(d.players.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));
  calls++;
 }
 // Both branches of each option, including changing the decision during the mesh.
 for(const {play,index} of all.filter(e=>e.play.option)){
  await choose('run',index,play.formation);
  await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:45,pointerType:'touch'});
  await page.evaluate(()=>window.bk3dTest.step(.5));await page.locator('#option-keep').click();
  await page.evaluate(()=>window.bk3dTest.step(1));
  const kept=await page.evaluate(()=>window.bk3dDiagnostics());assert.equal(kept.phase,'run');assert.equal(kept.players[5].hasBall,true);assert.equal(kept.players[6].hasBall,false);assert.equal(await page.locator('#optionChoices').isHidden(),true);
 }
 // Same-formation audibles must retain lineup and dismiss the panel.
 await choose('run',10,'iform');await page.locator('#adjustPlay').click();await page.locator('#audibleTab').click();await page.locator('#quickAudibles button').first().click();
 const audible=await page.evaluate(()=>window.bk3dDiagnostics());assert.equal(audible.formation,'iform');assert.equal(audible.players[8].role,'FB');assert.equal(audible.preSnap.panel,null);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'PASS',calls,optionBranches:4,mobileViewports:3,errors,screenshot:'/tmp/bk-formation-playbook.png'}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
