import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const out='artifacts/solo-ui',base='http://127.0.0.1:4187';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4187','--strictPort'],{stdio:'ignore'});
let browser;const results=[];
try{
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,200))}
 await mkdir(out,{recursive:true});
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
 for(const width of [390,320,1280]){
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1,isMobile:width<768,hasTouch:width<768,reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*.supabase.co/**',r=>r.fulfill({status:403,contentType:'application/json',body:'{"message":"isolated UI test"}'}));
  await page.route('**/_vercel/**',r=>r.fulfill({status:200,body:''}));
  await page.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;const data=path==='/api/media'?{tracks:[],introUrl:null}:path==='/api/nfl-news'?{available:true,articles:[]}:{available:false,ok:true,games:[]};return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})});
  await page.addInitScript(()=>{localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','1');localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off');localStorage.setItem('bk-guide-franchise-command-v1','seen')});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.bk-home-stadium').waitFor({timeout:45000});
  const hub=async()=>{await page.getByRole('button',{name:'Ball Knower home',exact:true}).click();await page.locator('.bk-home-stadium').waitFor();await page.getByRole('button',{name:'Solo Mode',exact:true}).click();await page.locator('.bk-mode-card').first().waitFor()};
  const shot=async name=>{await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(100);const w=await page.evaluate(()=>document.documentElement.scrollWidth);assert(w<=width+1,`${name} overflow ${w} at ${width}`);await page.screenshot({path:`${out}/${name}-${width}.png`});results.push({screen:name,width})};
  await hub();await shot('hub');await page.locator('.bk-mode-card').filter({hasText:'CAP CHALLENGE'}).click();const open=page.locator('[data-solo-player-id]').first();await open.waitFor();await open.click();
  const dialog=page.locator('.bk-solo-profile');await dialog.waitFor();await dialog.locator('.bk-solo-hero-art [data-render-state="ready"]').waitFor();await shot('profile');
  await dialog.getByRole('tab',{name:'Edit player',exact:true}).click();await dialog.getByLabel('Jersey number',{exact:true}).fill('0');await dialog.getByRole('button',{name:'Face 2',exact:true}).click();await dialog.getByRole('button',{name:'power',exact:true}).click();await dialog.locator('.bk-solo-editor-model [data-render-state="ready"]').waitFor();await shot('editor');await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await dialog.getByText('Appearance saved. Ratings and career progress are unchanged.',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Close player profile',exact:true}).click();await open.click();await dialog.waitFor();assert((await dialog.locator('.bk-solo-hero-position').textContent()).includes('#0'));await dialog.getByRole('button',{name:'Close player profile',exact:true}).click();
  for(const [mode,pageId] of [['Agent Mode','agent'],['Owner Office','owner'],['FRANCHISE COMMAND','franchise'],['MY PLAYER','my-player'],['FANTASY DRAFT','fantasy-franchise']]){await hub();await page.locator('.bk-mode-card').filter({hasText:mode}).click();await page.locator(`[data-page="${pageId}"]`).first().waitFor();await shot(pageId)}
  assert.deepEqual(errors,[]);await context.close();
 }
 await writeFile(`${out}/results.json`,JSON.stringify({results,physicalIphone:false},null,2));console.log('PASS: 3 widths, all six entry screens, player profile, appearance save/reopen.');
}finally{await browser?.close();server.kill()}
