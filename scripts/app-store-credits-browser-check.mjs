import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const baseURL='http://127.0.0.1:4174';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4174','--strictPort'],{stdio:'inherit'});
let browser;
async function ready(){
  for(let attempt=0;attempt<80;attempt++){
    if(server.exitCode!==null)throw new Error(`Preview exited: ${server.exitCode}`);
    try{if((await fetch(baseURL)).ok)return;}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw new Error('Preview did not become ready');
}
try{
  await ready();
  await mkdir('artifacts/app-store-credits',{recursive:true});
  browser=await chromium.launch({headless:true});
  for(const width of [320,390]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
    const page=await context.newPage();
    const crashes=[],legacyLogoRequests=[];
    page.on('pageerror',error=>crashes.push(error.message));
    page.on('request',request=>{if(/espncdn\.com\/i\/teamlogos/.test(request.url()))legacyLogoRequests.push(request.url());});
    await page.route('**/api/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      const payload=path==='/api/media'?{tracks:[],introUrl:null}:{ok:true};
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
    });
    await page.route('**/_vercel/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
    await page.addInitScript(()=>{
      localStorage.setItem('ball-knower-team-setup-v2','complete');
      localStorage.setItem('ball-knower-intro-completed-v1','1');
      localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');
      localStorage.setItem('ball-knower-intro-sound-v1','off');
    });
    await page.goto(baseURL,{waitUntil:'domcontentloaded'});
    await page.locator('.bk-app-shell[data-tab="home"]').waitFor();
    await page.getByRole('button',{name:'Photo Credits',exact:true}).click();
    const dialog=page.getByRole('dialog',{name:'Ball Knower launch information'});
    await dialog.getByRole('heading',{name:'Photo Credits',exact:true}).waitFor();
    await dialog.getByRole('link',{name:'Original file and history',exact:true}).first().waitFor();
    assert.ok(
      await dialog.getByRole('link',{name:'Original file and history',exact:true}).count() >= 100,
      'The in-app credits must expose the expanded licensed Fantasy portrait set.',
    );
    const box=await dialog.boundingBox();
    assert.ok(box&&box.x>=-1&&box.x+box.width<=width+1,'Credits dialog must fit the viewport');
    assert.equal(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1),true,'Credits must not overflow horizontally');
    const links=await dialog.locator('a[href]').evaluateAll(elements=>elements.map(element=>({href:element.getAttribute('href'),rel:element.getAttribute('rel')})));
    assert.ok(links.some(link=>link.href?.startsWith('https://commons.wikimedia.org/')));
    assert.ok(links.some(link=>link.href?.startsWith('https://creativecommons.org/')));
    await page.screenshot({path:`artifacts/app-store-credits/credits-${width}.png`,fullPage:true});
    await dialog.getByRole('button',{name:'Close',exact:true}).click();
    await page.getByRole('navigation',{name:'Primary navigation'}).waitFor();
    assert.deepEqual(crashes,[]);
    assert.deepEqual(legacyLogoRequests,[]);
    await context.close();
  }
  console.log('Credits are reachable in the production-built app at 320px and 390px; no legacy team-logo requests.');
}finally{
  await browser?.close();
  server.kill('SIGTERM');
}
