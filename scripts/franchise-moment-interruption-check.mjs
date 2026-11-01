import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const bridge=fs.readFileSync(new URL('../public/franchise-play-moment-bridge.js',import.meta.url),'utf8');
assert(!/location\.(reload|href)|back\.click\(/.test(bridge),'Bridge must never navigate the application');
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||process.env.CHROMIUM_PATH||undefined,headless:true,args:['--no-sandbox']});
try {
for(const viewport of [{width:390,height:844},{width:844,height:390}]){
 const page=await browser.newPage({viewport});let loads=0;
 await page.route('http://bridge.test/**',route=>{
  const url=route.request().url();
  if(url.endsWith('/bridge.js'))return route.fulfill({contentType:'text/javascript',body:bridge});
  if(url.includes('franchise-play'))return route.fulfill({contentType:'text/html',body:'<button>Playable moment fixture</button>'});
  loads++;return route.fulfill({contentType:'text/html',body:`<div data-tab="solo"><div id="owner" data-bk-moment-season="ballknower_solo_run_v2" data-bk-moment-user="solo-user" data-bk-moment-year="cap"><button id="sim">SIMULATE WEEK 1</button></div></div><script>
  window.applied=0;window.simulations=0;document.documentElement.style.overflow='auto';
  localStorage.setItem('ballknower_solo_run_v2',JSON.stringify({roster:[{id:'cap-player'}],weeks:[]}));
  localStorage.setItem('ballknower_solo_franchise_v2:season',JSON.stringify({sentinel:true,weeks:[]}));
  document.querySelector('#sim').onclick=()=>{window.simulations++;if(window.delaySave)return;localStorage.setItem('ballknower_solo_run_v2',JSON.stringify({weeks:[{game:{homeMemberId:'solo-user',awayMemberId:'opponent',homeScore:10,awayScore:20},playerLines:[]}]}));document.querySelector('#sim').remove()};
  window.addEventListener('bk-play-moment-applied',()=>window.applied++);
  </script><script src="/bridge.js"></script>`});
 });
 await page.goto('http://bridge.test/');
 const open=async()=>{await page.locator('[data-bk-play-moment]').click();await page.locator('iframe').waitFor();return page.frames().find(f=>f!==page.mainFrame());};
 const send=async(frame,payload)=>frame.evaluate(data=>parent.postMessage(data,location.origin),payload);
 const result={type:'bk-play-moment-result',week:1,won:true,score:7};
 let frame=await open();
 await page.evaluate(data=>window.postMessage(data,location.origin),result);await page.waitForTimeout(150);
 assert.equal(await page.evaluate(()=>window.simulations),0,'Unrelated same-origin sender ignored');
 await send(frame,{...result,week:2});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.simulations),0,'Wrong week ignored');
 await send(frame,{type:'bk-play-moment-cancel'});await page.locator('iframe').waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'auto');
 frame=await open();await send(frame,result);await page.waitForFunction(()=>window.applied===1);
 assert.equal(loads,1,'Completion does not reload');
 assert.equal(await page.evaluate(()=>window.simulations),1);
 const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('ballknower_solo_run_v2')));
 assert.equal(save.weeks[0].game.winnerId,'solo-user');assert.equal(save.weeks[0].won,true);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ballknower_solo_franchise_v2:season')).sentinel),true,'Unrelated save unchanged');
 // A delayed completion is abandoned when its owning mode unmounts.
 await page.goto('http://bridge.test/');frame=await open();await page.evaluate(()=>window.delaySave=true);await send(frame,result);
 await page.waitForFunction(()=>window.simulations===1);await page.evaluate(()=>document.querySelector('#owner').remove());await page.waitForTimeout(250);
 assert.equal(await page.evaluate(()=>window.applied),0);assert.equal(loads,2);
 // Owner navigation while overlay is open cleans overlay and scroll lock.
 await page.goto('http://bridge.test/');await open();await page.evaluate(()=>document.querySelector('#owner').remove());await page.locator('iframe').waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>document.documentElement.style.overflow),'auto');
 await page.close();console.log(`PASS bridge completion, source/week guards, cancellation, stale owner and scoped save ${viewport.width}x${viewport.height}`);
}
}finally{await browser.close()}
