import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4212',...(process.env.MINI_PREVIEW_DIR?['--outDir',process.env.MINI_PREVIEW_DIR]:[])],{stdio:'ignore'});
for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:4212')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,headless:true,args:['--no-sandbox']});
await mkdir('artifacts/mini-mode-tabs',{recursive:true});
try {
 for (const width of [320,390,1280]) {
  const page=await browser.newPage({viewport:{width,height:844},hasTouch:true});page.setDefaultTimeout(45000);const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});
  await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tracks:[],introUrl:null,available:false,articles:[],games:[]})}));
  await page.addInitScript(()=>{localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','1');localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off');});
  await page.goto('http://127.0.0.1:4212');await page.getByRole('button',{name:'Explore Mini Games'}).click();const menu=page.getByRole('dialog');
  assert.equal(await menu.getByRole('tab').count(),3);assert.equal(await menu.getByRole('tab',{selected:true}).textContent(),'Two-Minute Drill');
  for(const name of ['Two-Minute Drill','Five-Minute Game','Combine']) {
   const tab=menu.getByRole('tab',{name,exact:true});await tab.click();assert.equal(await tab.getAttribute('aria-selected'),'true');
   assert.equal(await menu.getByRole('tabpanel').count(),1);assert.equal(await menu.getByRole('tabpanel').getAttribute('aria-labelledby'),await tab.getAttribute('id'));
   assert(await tab.evaluate(el=>{const r=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return r.left>=p.left-1&&r.right<=p.right+1}),'Selected tab stays in view');
  }
  assert.equal(await menu.locator('.bk-mini-carousel').count(),0);assert.equal(await menu.getByRole('link',{name:'Start Game'}).count(),0);
  await page.keyboard.press('ArrowRight');assert.equal(await menu.getByRole('tab',{selected:true}).textContent(),'Two-Minute Drill');
  await page.keyboard.press('End');assert.equal(await menu.getByRole('tab',{selected:true}).textContent(),'Combine');
  await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');assert.equal(await menu.getByRole('tab',{selected:true}).textContent(),'Five-Minute Game');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'mini-tab-five-minute');
  await menu.getByRole('radio',{name:'Pro',exact:true}).check();
  await menu.getByRole('button',{name:'Select Bison',exact:true}).click();assert.equal(await menu.getByRole('tab').count(),3);
  await menu.getByRole('button',{name:'Select Stampede',exact:true}).click();assert.equal(await menu.getByRole('tab').count(),3);
  assert((await menu.getByRole('link',{name:'Start Game'}).getAttribute('href')).includes('mode=five-minute&difficulty=pro&team=OKC&opponent=OMA'));
  await menu.getByRole('tab',{name:'Two-Minute Drill',exact:true}).click();
  assert(await menu.getByRole('radio',{name:'Pro',exact:true}).isChecked());assert.equal(await menu.locator('.bk-mini-carousel h4').textContent(),'Oklahoma City Bison');
  await menu.getByRole('button',{name:'Select Bison',exact:true}).click();await menu.getByRole('button',{name:'Select Stampede',exact:true}).click();
  assert((await menu.getByRole('link',{name:'Start Game'}).getAttribute('href')).includes('mode=two-minute&difficulty=pro&team=OKC&opponent=OMA'));
  await menu.getByRole('tab',{name:'Five-Minute Game',exact:true}).click();await menu.getByRole('button',{name:'Close Mini Games'}).click();await page.getByRole('button',{name:'Explore Mini Games'}).click();
  assert.equal(await menu.getByRole('tab',{selected:true}).textContent(),'Five-Minute Game');
  await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`artifacts/mini-mode-tabs/tabs-${width}.png`});
  assert(await menu.evaluate(el=>el.scrollWidth<=el.clientWidth),'Dialog never overflows horizontally');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS tabs 320/390/1280: all modes reachable, keyboard navigation/focus, Combine placeholder, tabs throughout setup/review, preserved teams/level, both launch URLs and saved mode.');
} finally { await browser.close();server.kill(); }
