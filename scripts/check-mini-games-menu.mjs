import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4199'],{stdio:'ignore'});
for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:4199')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,headless:true,args:['--no-sandbox']});
await mkdir('artifacts/mini-games-drill',{recursive:true});
try{
 for(const width of [320,390,1280]){
  const page=await browser.newPage({viewport:{width,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tracks:[],introUrl:null,available:false,articles:[],games:[]})}));
  await page.addInitScript(()=>{localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','1');localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off');});
  await page.goto('http://127.0.0.1:4199');
  await page.getByRole('button',{name:'Explore Mini Games'}).click();
  const dialog=page.getByRole('dialog');
  for(const [name,id] of [['Rookie','rookie'],['Pro','pro'],['All-Pro','all-pro']]){
   await dialog.getByRole('radio',{name,exact:true}).check();
   assert.equal(await dialog.getByRole('link',{name:'Play Two-Minute Drill'}).getAttribute('href'),`/play-moment-3d-preview.html?mode=two-minute&difficulty=${id}`);
  }
  assert.equal(await dialog.getByText('Coming soon',{exact:true}).count(),2);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await dialog.getByRole('radio',{name:'All-Pro',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:`artifacts/mini-games-drill/menu-${width}.png`});
  await dialog.getByRole('button',{name:'Back to Home'}).click();assert.equal(await dialog.isVisible(),false);
  await page.goto('http://127.0.0.1:4199/?miniGames=1');await dialog.waitFor();
  assert(await dialog.getByRole('radio',{name:'All-Pro',exact:true}).isChecked());
  assert.equal(new URL(page.url()).search,'');
  await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),false);
  await page.getByRole('button',{name:'Play Solo Mode',exact:true}).click();await page.locator('.bk-mode-card').first().waitFor();
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: menu at 320/390/1280, accessible difficulty radios, correct launch URLs, saved level, return to menu, close/Escape, and Solo navigation.');
}finally{await browser.close();server.kill();}
