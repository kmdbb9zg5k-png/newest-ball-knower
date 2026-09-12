import assert from 'node:assert/strict';
import {mkdir,writeFile,stat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const base='http://127.0.0.1:4187',out='artifacts/solo-player-presentation';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4187','--strictPort'],{stdio:'inherit'});
const results=[];let browser;
try{
 for(let attempt=0;attempt<100;attempt++){try{if((await fetch(base)).ok)break;}catch{}if(attempt===99)throw Error('Preview server did not start');await new Promise(resolve=>setTimeout(resolve,200));}
 await mkdir(out,{recursive:true});
 for(const [engine,width] of [['chromium',320],['chromium',390],['chromium',1280],['webkit',390]]){
  browser=await (engine==='webkit'?webkit:chromium).launch({headless:true});
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1,isMobile:width<768,hasTouch:width<768,reducedMotion:'reduce'});
  const page=await context.newPage();const crashes=[];const generationCalls=[];
  page.on('pageerror',error=>crashes.push(error.message));
  page.on('request',request=>{if(request.method()==='POST'&&/my-player-art|generat/i.test(request.url()))generationCalls.push(request.url());});
  await page.route('**/*.supabase.co/**',route=>route.fulfill({status:403,contentType:'application/json',body:'{"message":"Isolated UI test, no account access"}'}));
  await page.route('**/_vercel/**',route=>route.fulfill({status:200,body:''}));
  await page.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname;
   const value=path==='/api/media'?{tracks:[],introUrl:null}:path==='/api/my-player-art'?{available:false}:path==='/api/nfl-news'?{available:true,articles:[]}:{ok:true,available:false,games:[]};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(value)});
  });
  await page.addInitScript(()=>{
   localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','1');localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off');
   for(const key of ['bk-guide-fantasy-hq-v3','bk-guide-picks-v3','bk-guide-the-gauntlet-v4','bk-guide-franchise-command-v1'])localStorage.setItem(key,'seen');
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.bk-home-stadium').waitFor();
  const openHub=async()=>{
   const home=page.getByRole('button',{name:'Ball Knower home',exact:true});await home.click();await page.locator('.bk-home-stadium').waitFor();
   await page.getByRole('button',{name:'Solo Mode',exact:true}).click();await page.locator('.bk-solo-presentation .bk-mode-card').first().waitFor();
  };
  const capture=async name=>{
   await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(120);
   const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,dialog:document.querySelector('.bk-solo-profile')?.getBoundingClientRect().toJSON()}));
   assert.ok(geometry.scroll<=width+1,`${engine} ${name} page overflow: ${geometry.scroll}`);
   if(geometry.dialog){assert.ok(geometry.dialog.left>=-1&&geometry.dialog.right<=width+1);assert.ok(geometry.dialog.bottom<=845);}
   await page.screenshot({path:`${out}/${engine}-${width}-${name}.png`,fullPage:false});results.push({engine,width,screen:name,...geometry});
  };
  await openHub();assert.equal(await page.locator('.bk-solo-presentation .bk-mode-card').count(),6);await capture('solo-hub');
  await page.locator('.bk-mode-card').filter({hasText:'CAP CHALLENGE'}).click();await page.locator('[data-page="cap"]').waitFor();
  const open=page.locator('[data-solo-player-id]').first();
  await open.waitFor();const playerId=await open.getAttribute('data-solo-player-id');
  const before=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(key=>!key.startsWith('ball-knower-solo-appearance-v1:')).map(key=>[key,localStorage.getItem(key)])));
  await open.click();const dialog=page.locator('.bk-solo-profile[role="dialog"]');await dialog.waitFor();
  await dialog.locator('.bk-solo-hero-art [data-render-state="ready"]').waitFor();
  assert.ok(await dialog.locator('.bk-solo-hero-art canvas').evaluate(canvas=>canvas.toDataURL().length>2500),'Character renderer must produce artwork');
  assert.equal(await dialog.locator('button button').count(),0,'Nested interactive controls are invalid');
  await capture('player-profile');
  await dialog.getByRole('tab',{name:'Game log',exact:true}).click();await dialog.getByText('No game log available',{exact:true}).waitFor();
  await dialog.getByRole('tab',{name:'Edit player',exact:true}).click();
  const selectedFace=await dialog.locator('.bk-solo-face-picker button[aria-pressed="true"]').getAttribute('aria-label');
  const next=(Number(selectedFace.split(' ')[1])%9)+1;
  await dialog.getByRole('button',{name:`Face ${next}`,exact:true}).click();
  await dialog.getByRole('button',{name:'power',exact:true}).click();
  await dialog.getByLabel('Jersey number',{exact:true}).fill('0');
  await dialog.locator('.bk-solo-editor-model [data-render-state="ready"]').waitFor();
  await capture('player-editor');
  await dialog.getByRole('button',{name:'Save changes',exact:true}).click();
  await dialog.getByText('Appearance saved. Ratings and career progress are unchanged.',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.bk-solo-profile-save .bk-solo-primary')?.disabled===true);
  await dialog.getByRole('button',{name:'Close player profile',exact:true}).click();await dialog.waitFor({state:'detached'});
  const after=await page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(key=>!key.startsWith('ball-knower-solo-appearance-v1:')).map(key=>[key,localStorage.getItem(key)])));
  assert.deepEqual(after,before,'Viewing and editing a cosmetic profile must not mutate career saves');
  await page.locator(`[data-solo-player-id="${playerId}"]`).first().click();await dialog.waitFor();
  assert.ok((await dialog.locator('.bk-solo-hero-position').textContent()).includes('#0'),'Jersey zero must survive reopen');
  await dialog.getByRole('tab',{name:'Edit player',exact:true}).click();
  assert.equal(await dialog.locator('.bk-solo-face-picker button[aria-pressed="true"]').getAttribute('aria-label'),`Face ${next}`);
  await dialog.getByRole('button',{name:'Face 1',exact:true}).click();
  if(next!==1){await dialog.getByRole('button',{name:'Close player profile',exact:true}).click();await dialog.getByText('You have unsaved appearance changes.',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Discard changes',exact:true}).click();}
  else await dialog.getByRole('button',{name:'Close player profile',exact:true}).click();
  for(const [title,screen] of [['Agent Mode','agent'],['Owner Office','owner'],['FRANCHISE COMMAND','franchise'],['MY PLAYER','my-player'],['FANTASY DRAFT','fantasy-franchise']]){
   await openHub();await page.locator('.bk-mode-card').filter({hasText:title}).click();await page.locator(`.bk-solo-presentation [data-page="${screen}"]`).first().waitFor();await capture(screen);
  }
  assert.deepEqual(generationCalls,[],'Normal player viewing must not call an AI image generator');
  assert.deepEqual(crashes,[]);
  const resources=await page.evaluate(()=>performance.getEntriesByType('resource').filter(entry=>entry.name.includes('/solo-characters/')).map(entry=>({url:new URL(entry.name).pathname,transferSize:entry.transferSize,encodedBodySize:entry.encodedBodySize})));
  results.push({engine,width,resources,generationCalls,crashes,physicalIphone:false});
  await context.close();await browser.close();browser=null;
 }
 const artBytes=(await Promise.all(['faces.webp','body.webp','regions.webp'].map(async file=>(await stat(`public/solo-characters/v1/${file}`)).size))).reduce((sum,value)=>sum+value,0);
 await writeFile(`${out}/results.json`,JSON.stringify({checkedAt:new Date().toISOString(),artBytes,results,physicalIphoneVerified:false,visualFidelityApproved:false,productionMutations:false},null,2));
 console.log(JSON.stringify({status:'functional presentation checks passed',sharedArtBytes:artBytes,browserCases:4,physicalIphoneVerified:false,visualFidelityApproved:false},null,2));
}finally{await browser?.close();server.kill('SIGTERM');}
