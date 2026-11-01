import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const live=process.argv.includes('--live');
let news={available:true,provider:'Currents',fetchedAt:new Date().toISOString(),articles:[
 {headline:'Example headline for the Home regression test',url:'https://publisher.example/one'},
 {headline:'Another headline tests rotation without moving the page',url:'https://publisher.example/two'},
 {headline:'Third headline tests next and pause controls',url:'https://publisher.example/three'},
]};
if(live){
 const r=await fetch('https://ballknowerofficial.com/api/nfl-news',{redirect:'error',signal:AbortSignal.timeout(12_000)});
 assert.equal(r.status,200);news=await r.json();assert.equal(news.available,true);assert.ok(news.articles.length>1);
}
const base='http://127.0.0.1:4178';const out='artifacts/home-broadcast';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4178','--strictPort'],{stdio:'inherit'});
let browser;
const configure=async(context)=>{
 let newsCalls=0;
 const page=await context.newPage();const crashes=[];
 page.on('pageerror',error=>crashes.push(error.message));
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path==='/api/nfl-news')newsCalls++;
  const data=path==='/api/nfl-news'?news:path==='/api/media'?{tracks:[],introUrl:null}:{ok:true};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 // Isolate visual tests from account creation, telemetry and production mutations.
 await page.route('**/*.supabase.co/**',route=>route.fulfill({status:403,contentType:'application/json',body:'{"message":"Visual test: no account requests"}'}));
 await page.route('**/_vercel/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
 await page.addInitScript(()=>{
  localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','1');
  localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off');
 });
 return{page,crashes,calls:()=>newsCalls};
};
try{
 await mkdir(out,{recursive:true});
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,250))}assert.ok(ready);
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}: {})});
 const results=[];
 for(const width of [320,390,430,1280]){
  const context=await browser.newContext({viewport:{width,height:width===1280?900:844},deviceScaleFactor:2,isMobile:width<768,hasTouch:width<768});
  const {page,crashes,calls}=await configure(context);
  await page.clock.install();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const hero=page.locator('.bk-home-stadium');const strip=page.getByRole('region',{name:'NFL headlines'});
  await hero.waitFor();await strip.locator('a[title]').waitFor();
  if(news.provider==='Currents'){const attribution=strip.getByRole('link',{name:'Powered by Currents News API',exact:true});await attribution.waitFor();assert.equal(await attribution.getAttribute('href'),'https://currentsapi.services/');const bounds=await attribution.evaluate(element=>{const link=element.getBoundingClientRect(),strip=element.closest('.bk-home-news-strip').getBoundingClientRect();return{top:link.top,bottom:link.bottom,left:link.left,right:link.right,stripTop:strip.top,stripBottom:strip.bottom,stripLeft:strip.left,stripRight:strip.right}});assert.ok(bounds.top>=bounds.stripTop&&bounds.bottom<=bounds.stripBottom&&bounds.left>=bounds.stripLeft&&bounds.right<=bounds.stripRight,'Currents attribution remains visible inside ticker');}
  await page.waitForFunction(()=>document.querySelector('.bk-home-legacy-art')?.naturalWidth>0);
  // Real app fonts, not a separate mockup typography layer.
  await page.evaluate(()=>document.fonts.ready);
  const geometry=await page.evaluate(()=>{
   const h=document.querySelector('header').getBoundingClientRect(),hero=document.querySelector('.bk-home-stadium').getBoundingClientRect();
   return{width:innerWidth,documentWidth:document.documentElement.scrollWidth,headerBottom:h.bottom,heroTop:hero.top,heroHeight:hero.height};
  });
  assert.ok(geometry.documentWidth<=width+1,'No horizontal overflow');
  assert.ok(geometry.heroTop>=geometry.headerBottom-1,'Fixed headline strip must not cover hero');
  if(width<768){
   const buttons=page.getByRole('navigation',{name:'Primary navigation'}).locator('button');
   assert.equal(await buttons.count(),7);
   assert.ok((await buttons.evaluateAll(items=>items.map(e=>parseFloat(getComputedStyle(e).fontSize)))).every(size=>size>=8&&size<=11),'Bottom labels must remain compact and readable');
  }
  assert.equal(await page.locator('.bk-home-primary-modes button').count(),4);
  assert.equal(await page.locator('.bk-home-floodlight').count(),0,'Approved cover has no flicker overlays');
  const photo=await page.locator('.bk-home-legacy-art').evaluate(e=>({w:e.naturalWidth,h:e.naturalHeight}));assert.deepEqual(photo,{w:1354,h:1162});
  assert.equal(await page.locator('.bk-home-motion').count(),0,'Home must not render a motion button');
  const ratio=await hero.locator('img').evaluate(e=>e.getBoundingClientRect().width/e.getBoundingClientRect().height);
  assert(Math.abs(ratio-1354/1162)<.01,'Cover must not crop or stretch');
  assert.equal(await hero.locator('button,a').count(),0,'Artwork has no invisible actions');
  assert.equal(Math.round(geometry.heroHeight),width<360?350:width<640?378:440,'Original hero height restored');
  await page.screenshot({path:`${out}/home-${width}.png`,fullPage:false});
  if(width===390){
   const before=await strip.locator('a[title]').getAttribute('href');await page.clock.runFor(10_050);
   assert.notEqual(await strip.locator('a[title]').getAttribute('href'),before,'Headlines rotate');
   await page.getByRole('button',{name:'Pause headline rotation',exact:true}).click();
   const frozen=await strip.locator('a[title]').getAttribute('href');await page.clock.runFor(20_100);
   assert.equal(await strip.locator('a[title]').getAttribute('href'),frozen,'Pause holds the current headline');
   await page.getByRole('button',{name:'Next headline',exact:true}).click();assert.notEqual(await strip.locator('a[title]').getAttribute('href'),frozen);
   await page.getByRole('button',{name:'Hide headlines',exact:true}).click();
   const hiddenCalls=calls();await page.clock.runFor(240_100);assert.equal(calls(),hiddenCalls,'Hidden headlines must not poll');
   await page.getByRole('button',{name:'Show headlines',exact:true}).click();await strip.locator('a[title]').waitFor();
   await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.bk-home-stadium')?.getAttribute('data-motion')==='off');
   assert.equal(await hero.getAttribute('data-motion'),'off');
   assert.equal(await hero.evaluate(e=>getComputedStyle(e).animationName),'none');
   assert.equal(await page.locator('.bk-home-floodlight').count(),0);
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.locator('.bk-home-primary-modes').getByRole('button',{name:'Fantasy',exact:true}).click();await page.locator('.bk-app-shell[data-tab="fantasy"]').waitFor();
   // The destination shell mounts before its lazy-loaded first-visit guide.
   // Wait for the real guide and close it normally, never click through it.
   const guideClose=page.getByRole('button',{name:'Close instructions',exact:true});
   await guideClose.waitFor();await guideClose.click();
   await page.getByRole('dialog',{name:'Fantasy instructions',exact:true}).waitFor({state:'hidden'});
   assert.equal(await page.locator('.bk-home-news-strip').count(),1,'Fantasy overview now shares the approved ticker');
   await page.getByRole('button',{name:'Cheat Sheet',exact:true}).click();
   await page.waitForFunction(()=>!document.querySelector('.bk-home-news-strip'));
   assert.equal(await page.locator('.bk-home-news-strip').count(),0,'Research stays focused and stops ticker polling');
   const beforeLeaving=calls();await page.clock.runFor(130_000);assert.equal(calls(),beforeLeaving,'Unmounted ticker stops polling');
   await page.getByRole('button',{name:'Ball Knower home',exact:true}).click();await hero.waitFor();
   await page.getByRole('button',{name:'Open NFL News',exact:true}).click();await page.locator('.bk-app-shell[data-tab="news"]').waitFor();
   assert.equal(await page.locator('.bk-home-news-strip').count(),1,'News retains access to the shared headline strip');
  }
  await page.getByRole('button',{name:'Ball Knower home',exact:true}).click();await hero.waitFor();
  await hero.locator('img').evaluate(e=>e.dispatchEvent(new Event('error')));
  await hero.getByRole('heading',{name:'Know ball. Play ball. Build your legacy.'}).waitFor();
  assert.equal(await hero.locator('button,a').count(),0);
  assert.deepEqual(crashes,[]);results.push({width,...geometry,articleCount:news.articles.length});await context.close();
 }
 if(live){
  // Uninterrupted capture of the real built app; no fabricated leagues or scores.
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,recordVideo:{dir:`${out}/video`,size:{width:390,height:844}}});
  const {page}=await configure(context);await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('.bk-home-news-strip a[title]').waitFor();await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(1200);await page.screenshot({path:`${out}/home-live-390.png`});
  await page.waitForTimeout(11_500);await context.close();
 }
 await writeFile(`${out}/results.json`,JSON.stringify({source:live?'actual public news feed captured for browser verification':'explicit synthetic regression fixture',checkedAt:new Date().toISOString(),results,physicalIphoneTest:false,productionAccountMutations:false},null,2));
 console.log('Home broadcast: phone/desktop rendering, nav, no motion control, reduced motion, rotation/pause/next/hide, cache and unmount passed.');
}finally{await browser?.close();server.kill('SIGTERM')}
