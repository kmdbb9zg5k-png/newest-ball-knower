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
  const page=await browser.newPage({viewport:{width,height:844},hasTouch:true});page.setDefaultTimeout(45000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tracks:[],introUrl:null,available:false,articles:[],games:[]})}));
  await page.addInitScript(()=>{localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','1');localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off');});
  await page.goto('http://127.0.0.1:4212');await page.getByRole('button',{name:'Explore Mini Games'}).click();const menu=page.getByRole('dialog');
  assert.equal(await menu.getByRole('tab').count(),0);
  assert.equal(await menu.locator('.bk-mini-mode-card').count(),3);
  assert.equal(await menu.getByText('Rookie',{exact:true}).count(),0);
  const boxes=await menu.locator('.bk-mini-mode-card').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,width:r.width}}));
  assert(boxes[1].top>boxes[0].bottom && boxes[2].top>boxes[1].bottom);
  await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`artifacts/mini-mode-tabs/cards-${width}.png`});
  await menu.getByRole('button',{name:/Combine Drills/}).click();assert.equal(await menu.getByRole('link',{name:'Start Game'}).count(),0);
  await menu.getByRole('button',{name:'Back to game modes'}).click();
  for (const [name,id] of [['Five-Minute Game','five-minute'],['Two-Minute Warning','two-minute']]) {
   await menu.getByRole('button',{name:new RegExp(name)}).click();
   await menu.getByRole('heading',{name:'Choose Difficulty'}).waitFor();
   assert.equal(await menu.locator('.bk-mini-carousel').count(),0);
   await menu.getByRole('button',{name:/^Pro /}).click();
   await menu.getByRole('heading',{name:'Pick Your Team'}).waitFor();
   assert.equal(await menu.locator('.bk-mini-difficulty-options').count(),0);
   await menu.getByRole('button',{name:'Select Bison',exact:true}).click();
   await menu.getByRole('button',{name:'Select Stampede',exact:true}).click();
   assert((await menu.getByRole('link',{name:'Start Game'}).getAttribute('href')).includes(`mode=${id}&difficulty=pro&team=OKC&opponent=OMA`));
   await menu.getByRole('button',{name:'Change my team'}).click();
   await menu.getByRole('button',{name:'Back to difficulty'}).click();
   await menu.getByRole('heading',{name:'Choose Difficulty'}).waitFor();
   await menu.getByRole('button',{name:'Back to game modes'}).click();
  }
  assert(await menu.evaluate(el=>el.scrollWidth<=el.clientWidth),'Dialog never overflows horizontally');
  await menu.getByRole('button',{name:'Close Mini Games'}).click();await page.getByRole('button',{name:'Explore Mini Games'}).click();
  await menu.getByRole('heading',{name:'Pick Your Game'}).waitFor();
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS stacked cards 320/390/1280: separate difficulty, both launch URLs, team/review flow, back navigation, Combine preview and reopen.');
} finally { await browser.close();server.kill(); }
