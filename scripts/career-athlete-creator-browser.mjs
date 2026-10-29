import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const key='ballknower_solo_my_player_v2';
const fixture=`import React from'react';import{createRoot}from'react-dom/client';import{MyPlayerStory}from'/MyPlayerStory.tsx';import'/solo/soloPresentation.css';import'/broadcastScreens.css';import'/index.css';function App(){const[open,setOpen]=React.useState(true);return open?React.createElement(MyPlayerStory,{onBack:()=>setOpen(false)}):React.createElement('button',{onClick:()=>setOpen(true)},'Open career');}createRoot(document.getElementById('root')).render(React.createElement(App));`;
const server=await createServer({cacheDir:'/tmp/bk-career-creator-cache',server:{host:'127.0.0.1',port:3076,strictPort:true,watch:null,hmr:false},plugins:[{name:'career-creator-fixture',enforce:'pre',configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url?.startsWith('/career-creator-qa.html')){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,'<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0;background:#07090d;color:white"><div id="root"></div><script type="module" src="/career-creator-qa.js"></script></body></html>'));}else next();});},resolveId(id){if(id==='/career-creator-qa.js')return'\0career-creator';},load(id){if(id==='\0career-creator')return fixture;}}]});
await server.listen();await mkdir('artifacts/career-athlete-creator',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 for(const width of [320,390,1280]){
  const page=await browser.newPage({viewport:{width,height:844},deviceScaleFactor:2,isMobile:width<768,hasTouch:width<768});page.setDefaultTimeout(60000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/shader|WebGL|THREE/.test(m.text()))errors.push(m.text());});
  await page.route('**/api/**',r=>r.fulfill({json:{available:false}}));await page.route('**/*.supabase.co/**',r=>r.abort());
  await page.goto('http://127.0.0.1:3076/career-creator-qa.html');
  const dialog=page.getByRole('dialog',{name:'Create your career player',exact:true}),preview=dialog.locator('[data-athlete-live-preview]');
  await dialog.waitFor();await preview.locator('canvas').waitFor();await page.locator('[data-render-state=ready]').waitFor();
  assert.equal(await dialog.getByRole('tab').first().innerText(),'Player');assert.equal(await dialog.getByRole('tab',{name:'Player',exact:true}).getAttribute('aria-selected'),'true');
  const tab=name=>dialog.getByRole('tab',{name,exact:true}).click(),read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
  await dialog.getByRole('button',{name:'Save & enter the Combine',exact:true}).click();await dialog.getByText('Give your player a name.',{exact:true}).waitFor();assert(await dialog.isVisible());
  // Appearance-only edits must persist even before a name/body has been entered.
  await tab('Hair');await dialog.getByRole('button',{name:'Braids',exact:true}).click();await page.reload();await page.locator('[data-render-state=ready]').waitFor();assert.equal((await read()).hairStyle,'braids');assert.equal(await preview.getAttribute('data-hair-style'),'braids');
  await dialog.getByLabel('Career player name').fill('Eli Career');const jersey=dialog.getByLabel('Career jersey number');await jersey.fill('0');await jersey.press('Backspace');assert.equal(await jersey.inputValue(),'');await jersey.pressSequentially('21');
  await tab('Build');const bounds=await preview.boundingBox();await dialog.getByLabel('HEIGHT',{exact:true}).fill('79');await dialog.getByLabel('WEIGHT',{exact:true}).fill('280');await dialog.getByLabel('ARMS',{exact:true}).fill('81');assert.deepEqual(await preview.boundingBox(),bounds);
  await tab('Face');await dialog.getByRole('button',{name:'Fair',exact:true}).click();await dialog.getByRole('button',{name:'Mustache',exact:true}).click();
  await dialog.getByText('Optional career portrait',{exact:true}).click();await dialog.getByRole('button',{name:'Nico career portrait',exact:true}).click();assert(await dialog.locator('input[type=file]').count());assert(await dialog.getByLabel('Describe your portrait',{exact:true}).isVisible());
  await tab('Tattoos');await dialog.getByRole('button',{name:'Both Arms',exact:true}).click();await dialog.getByRole('button',{name:'Geometric',exact:true}).click();
  await tab('Player');await dialog.getByRole('button',{name:'CB',exact:true}).click();const before=await read();assert.equal(before.heightInches,79);assert.equal(before.weightLbs,280);assert.equal(before.armSize,81);assert.equal(before.hairStyle,'braids');assert.equal(before.skinTone,'fair');assert.equal(before.facialHair,'mustache');assert.equal(before.number,21);
  await page.screenshot({path:`artifacts/career-athlete-creator/player-${width}.png`});await tab('Hair');await page.screenshot({path:`artifacts/career-athlete-creator/hair-${width}.png`});
  const save=dialog.getByRole('button',{name:'Save & enter the Combine',exact:true});const box=await save.boundingBox();assert(box.y+box.height<=844);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  if(width===390){
   for(const viewport of [{width:390,height:600},{width:390,height:480},{width:844,height:390}]){await page.setViewportSize(viewport);await page.screenshot({path:`artifacts/career-athlete-creator/short-${viewport.width}x${viewport.height}.png`});const box=await save.boundingBox();assert(box.y>=0&&box.y+box.height<=viewport.height);assert((await preview.boundingBox()).height>100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
   await page.setViewportSize({width:390,height:844});
   // Storage failure must not advance into the career with an unsaved athlete.
   await page.evaluate(()=>{window.restoreStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='ballknower_solo_my_player_v2')throw new DOMException('Full','QuotaExceededError');return window.restoreStorageSet.call(this,k,v);};});
   await save.click();await dialog.getByRole('alert').filter({hasText:/could not be saved/}).waitFor();assert.equal((await read()).stage,'creator');await page.evaluate(()=>{Storage.prototype.setItem=window.restoreStorageSet;});
  }
  await dialog.getByRole('button',{name:'Back to Solo Franchise Hub',exact:true}).click();await page.getByRole('button',{name:'Open career',exact:true}).waitFor();assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');await page.getByRole('button',{name:'Open career',exact:true}).click();await page.locator('[data-render-state=ready]').waitFor();assert.equal(await dialog.getByLabel('Career jersey number').inputValue(),'21');assert.equal(await preview.getAttribute('data-hair-style'),'braids');
  await save.click();await dialog.waitFor({state:'hidden'});const saved=await read();assert.equal(saved.stage,'combine');assert(saved.combineId);for(const field of ['name','number','position','heightInches','weightLbs','armSize','hairStyle','skinTone','facialHair','tattooCoverage','tattooStyle','presetFaceId'])assert.equal(saved[field],before[field],field+' carries into career');
  await page.reload();await page.getByText('PRO COMBINE',{exact:true}).waitFor();assert.equal(await page.getByRole('dialog',{name:'Create your career player',exact:true}).count(),0);assert.equal((await read()).combineId,saved.combineId);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS career creator: shared 3D tabs, appearance-only save, zero-to-21 editing, position preservation, optional portraits, mobile fixed preview/footer, storage failure guard, back/reopen, Combine transition and reload.');
}finally{await browser.close();await server.close();}
