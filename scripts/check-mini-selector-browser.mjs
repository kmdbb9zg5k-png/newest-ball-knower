import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4203'],{stdio:'ignore'});
for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:4203')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,headless:true,args:['--no-sandbox']});
await mkdir('artifacts/mini-selector',{recursive:true});
try{
 for(const width of [320,390,1280]){
  const page=await browser.newPage({viewport:{width,height:844},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tracks:[],introUrl:null,available:false,articles:[],games:[]})}));
  await page.addInitScript(()=>{localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','1');localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off');});
  await page.goto('http://127.0.0.1:4203');await page.getByRole('button',{name:'Explore Mini Games'}).click();
  const menu=page.getByRole('dialog');const selector=()=>menu.locator('.bk-mini-carousel');
  assert.equal((await selector().locator('h4').textContent()),'Oklahoma City Bison');
  assert((await selector().locator('.bk-mini-carousel-position').textContent()).includes('16 / 32'));
  const art=selector().locator('.bk-mini-carousel-art');
  await art.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:200,clientY:200}]});await art.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:120,clientY:205}]});assert.equal(await selector().locator('h4').textContent(),'Omaha Stampede');
  await art.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:120,clientY:205}]});await art.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:200,clientY:200}]});assert.equal(await selector().locator('h4').textContent(),'Oklahoma City Bison');
  await art.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:200,clientY:200}]});await art.dispatchEvent('touchend',{changedTouches:[{identifier:1,clientX:120,clientY:500}]});assert.equal(await selector().locator('h4').textContent(),'Oklahoma City Bison','Vertical scrolling must not switch teams');
  const seen=new Set();
  for(let i=0;i<32;i++){
   seen.add(await selector().locator('h4').textContent());
   await page.waitForFunction(()=>[...document.querySelectorAll('.bk-mini-carousel-art img,.bk-mini-team-logo-backdrop')].every(img=>img.complete&&img.naturalWidth>0));
   assert.equal(await selector().locator('.bk-mini-star-players>div').count(),3);
   await page.evaluate(()=>document.fonts.ready);
   assert(await page.evaluate(()=>document.fonts.check('800 14px BKMiniDisplay')),'Local display font must load');
   assert(await selector().locator('.bk-mini-star-players strong>span').evaluateAll(names=>names.every(name=>name.scrollWidth<=name.clientWidth)),'Every first and last name must fit on one line');
   assert(await selector().evaluate(el=>el.scrollWidth<=el.clientWidth),'Carousel must not overflow');
   await selector().getByRole('button',{name:'Next team',exact:true}).click();
  }
  assert.equal(seen.size,32);assert.equal(await selector().locator('h4').textContent(),'Oklahoma City Bison');
  await selector().getByRole('button',{name:'Previous team'}).click();assert.equal(await selector().locator('h4').textContent(),'Milwaukee Lakehawks');
  await page.keyboard.press('ArrowRight');assert.equal(await selector().locator('h4').textContent(),'Oklahoma City Bison');
  await selector().scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/mini-selector/carousel-${width}.png`});
  await selector().getByRole('button',{name:'Select Bison',exact:true}).click();
  assert.equal(await menu.getByRole('region',{name:'Select your opponent',exact:true}).count(),1);
  const opponents=new Set();
  for(let i=0;i<31;i++){opponents.add(await selector().locator('h4').textContent());await selector().getByRole('button',{name:'Next team',exact:true}).click();}
  assert.equal(opponents.size,31);assert(!opponents.has('Oklahoma City Bison'));
  await selector().getByRole('button',{name:'Browse all 31 teams'}).click();await selector().getByRole('searchbox').fill('Jersey');await selector().getByRole('button',{name:/Jersey City Knights.*OVR/}).click();
  await page.waitForFunction(()=>document.querySelector('.bk-mini-carousel h4').getBoundingClientRect().top>=document.querySelector('dialog').getBoundingClientRect().top);
  assert.deepEqual(await selector().locator('.bk-mini-star-players strong').allTextContents(),['Jordan Norwood','Cedric Norwood','Tariq Norwood']);
  await page.waitForFunction(()=>[...document.querySelectorAll('.bk-mini-carousel-art img')].every(img=>img.complete&&img.naturalWidth>0));
  await selector().scrollIntoViewIfNeeded();await page.screenshot({path:`artifacts/mini-selector/knights-${width}.png`});
  await selector().getByRole('button',{name:'Select Knights',exact:true}).click();assert.equal(await selector().count(),0);
  assert((await menu.getByRole('link',{name:'Play Two-Minute Drill'}).getAttribute('href')).endsWith('&team=OKC&opponent=JCY'));
  await menu.getByRole('button',{name:'Back to Home'}).click();await page.getByRole('button',{name:'Explore Mini Games'}).click();assert(await menu.getByRole('button',{name:'Choose opponent: Jersey City Knights'}).isVisible());
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS 320/390/1280: all 32 portraits/logos load, team 16 default, arrows wrap, keyboard, true star labels, 31 opponents exclude home, confirmation and correct launch.');
}finally{await browser.close();server.kill();}
