// Run after npm run build: BROWSER_PATH=/path/to/chromium node scripts/drill-retry-browser.mjs
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname} from 'node:path';
const root=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.glb':'model/gltf-binary'};
const server=process.env.BK_TEST_URL?null:createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname,file=resolve(root,'.'+(path==='/'?'/index.html':path));
 if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
 try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'}).end(bytes);}catch{res.writeHead(404).end();}
});
if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=process.env.BK_TEST_URL||`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});

// Fault-injected scene checks exercise real drill components/state without a GPU
// for the full mode matrix. The companion my-player-drill-retry-browser test uses the real renderer.
const stub=`export async function createCombineScene(host,athlete,onLost){
 const stats=window.__retryStats??={created:0,disposed:0,live:0};stats.created++;
 if(window.__retryFail)throw Error('Injected renderer load failure');
 const canvas=document.createElement('canvas');canvas.dataset.retryScene='true';host.append(canvas);stats.live++;
 const lose=e=>{e.preventDefault();onLost();};canvas.addEventListener('webglcontextlost',lose);
 let disposed=false;return {draw(run){window.__retrySnapshot={phase:run.phase,clock:run.clock,distance:run.distance,score:run.score,reps:run.reps};},setAthlete(){},setGhost(){},setGhostState(){},dispose(){if(disposed)return;disposed=true;stats.disposed++;stats.live--;canvas.removeEventListener('webglcontextlost',lose);canvas.remove();}};
}`;
const resume=async page=>{const button=page.getByRole('button',{name:'RESUME',exact:true});if(await button.isVisible())await button.click();};
try{
 for(const drill of (process.env.BK_DRILLS?.split(',')||['dash','broad-jump','shuttle','bench','routes','one-on-one','rb','db'])){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await context.route('**/api/**',r=>r.fulfill({json:{available:false}}));await context.route('**/*.supabase.co/**',r=>r.abort());
  await context.route('**/assets/scene-*.js',r=>r.fulfill({contentType:'text/javascript',body:stub}));
  await context.route('**/*.glb*',r=>r.abort());
  const page=await context.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let navigations=0;page.on('framenavigated',f=>{if(f===page.mainFrame())navigations++;});
  await page.addInitScript(()=>{window.__retryFail=true;window.__rbWrites=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='bk-rb-drill-v1')window.__rbWrites++;return original.call(this,key,value);};});
  if(drill==='rb')await page.clock.install();
  await page.goto(base+'/combine.html?drill='+drill);await page.getByRole('button',{name:/^Save & start /}).click();
  const retry=page.getByRole('button',{name:'RETRY DRILL',exact:true});await retry.waitFor();const initialNavigations=navigations;
  await retry.click();await retry.waitFor();assert.equal(navigations,initialNavigations,'Repeated failed retry must stay in '+drill);
  await page.evaluate(()=>window.__retryFail=false);await retry.click();await page.waitForFunction(()=>window.__retryStats?.live===1);await retry.waitFor({state:'hidden'});await resume(page);
  const main=page.locator('main.combine-game');assert.equal(await main.getAttribute('data-phase'),'idle');
  const start=drill==='dash'?page.locator('.combine-action'):drill==='broad-jump'?page.getByRole('button',{name:'Left power',exact:true}):page.locator('.skill-start,.route-start');
  await start.click();await page.waitForFunction(()=>['running','power'].includes(document.querySelector('main.combine-game')?.dataset.phase));await page.waitForTimeout(250);
  await page.locator('canvas[data-retry-scene]').dispatchEvent('webglcontextlost',{cancelable:true});await retry.waitFor();
  const held=await page.evaluate(()=>window.__retrySnapshot),phase=await main.getAttribute('data-phase');
  const saved=await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>/^bk-(combine|broad|agility|strength|route|rb|db)/.test(key))));
  await retry.click();await page.waitForFunction(()=>window.__retryStats?.live===1);await retry.waitFor({state:'hidden'});
  assert.equal(await main.getAttribute('data-phase'),phase,'Retry preserves phase in '+drill);
  assert.equal(await page.locator('canvas[data-retry-scene]').count(),1);
  const restored=await page.evaluate(()=>window.__retrySnapshot);for(const k of ['clock','distance','score','reps'])if(typeof held[k]==='number')assert(Math.abs((restored[k]??held[k])-held[k])<.2,drill+' preserves '+k);
  assert.deepEqual(await page.evaluate(()=>Object.fromEntries(Object.entries(localStorage).filter(([key])=>/^bk-(combine|broad|agility|strength|route|rb|db)/.test(key)))),saved,'Retry must not write duplicate results');
  assert.equal(navigations,initialNavigations);await resume(page);assert.deepEqual(errors,[]);
  if(drill==='rb'){
   // Advance only browser time; the real RB physics and result calculations run.
   for(let rep=1;rep<=5;rep++){
    for(let tick=0;tick<30&&await main.getAttribute('data-phase')!=='result';tick++)await page.clock.runFor(1000);
    assert.equal(await main.getAttribute('data-phase'),'result','Rep '+rep+' naturally finishes');
    assert.equal(await page.locator('.route-results > span').count(),rep,'Completed reps survive renderer retry');
    if(rep<5){assert.equal(await page.evaluate(()=>window.__rbWrites),0);await page.getByRole('button',{name:'NEXT REP',exact:true}).click();}
   }
   await page.getByRole('heading',{name:'SESSION COMPLETE',exact:true}).waitFor();
   const final=await page.evaluate(()=>({rows:JSON.parse(localStorage.getItem('bk-rb-drill-v1')),writes:window.__rbWrites}));
   assert.equal(final.rows.length,1);assert.equal(final.writes,1,'Completed session saves exactly once');
   await page.locator('canvas[data-retry-scene]').dispatchEvent('webglcontextlost',{cancelable:true});await retry.waitFor();await retry.click();
   await page.waitForFunction(()=>window.__retryStats?.live===1);await retry.waitFor({state:'hidden'});await resume(page);await page.clock.runFor(1000);
   await page.getByRole('heading',{name:'SESSION COMPLETE',exact:true}).waitFor();
   assert.equal(await page.locator('.route-results > span').count(),5);
   assert.deepEqual(await page.evaluate(()=>({rows:JSON.parse(localStorage.getItem('bk-rb-drill-v1')),writes:window.__rbWrites})),final,'Retry after completion cannot duplicate score');
   assert.equal(navigations,initialNavigations);
   console.log('PASS RB completes all five natural reps after recovery; exactly one saved score; result-screen retry preserves five results without another save');
  }
  console.log('PASS',drill,'repeat failed initialization, local successful retry, mid-attempt context recovery, one scene and no navigation/result writes');await context.close();
 }
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
