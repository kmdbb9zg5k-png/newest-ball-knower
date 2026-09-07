import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {verifyNews} from './release-backend-preflight.mjs';
const live=process.argv.includes('--live');
assert.ok(live||process.argv.includes('--fixture'),'Choose --fixture for regression CI or --live for a production-provider check');
let news;
if(live){
  const response=await fetch('https://ballknowerofficial.com/api/nfl-news',{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000)});
  news=await response.json();verifyNews(response,news);
}else{
  news={available:true,provider:'Tank01',fetchedAt:new Date().toISOString(),articles:[{id:'https://publisher.example/story',url:'https://publisher.example/story',headline:'Example headline used only in automated testing',source:'Test publisher',published:null,image:null,description:''}]};
}
const base='http://127.0.0.1:4175';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4175','--strictPort'],{stdio:'inherit'});
let browser;
try{
  let ready=false;
  for(let i=0;i<80;i++){
    if(server.exitCode!==null)throw Error('Preview exited');
    try{if((await fetch(base)).ok){ready=true;break}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(ready,'Preview failed to start');
  await mkdir('artifacts/news-release',{recursive:true});
  browser=await chromium.launch({headless:true});
  for(const width of [320,390]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
    const page=await context.newPage();const crashes=[];let outage=false;
    page.on('pageerror',error=>crashes.push(error.message));
    await page.route('**/api/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      const payload=path==='/api/nfl-news'?(outage?{available:false,articles:[]}:news):path==='/api/media'?{tracks:[],introUrl:null}:{ok:true};
      await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(payload)});
    });
    await page.route('**/_vercel/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
    await page.addInitScript(()=>{
      localStorage.setItem('ball-knower-team-setup-v2','complete');
      localStorage.setItem('ball-knower-intro-completed-v1','1');
      localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');
      localStorage.setItem('ball-knower-intro-sound-v1','off');
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.locator('.bk-app-shell[data-tab="home"]').waitFor();
    await page.getByRole('button',{name:'NFL News',exact:true}).click();
    await page.locator('article').first().waitFor();
    assert.equal(await page.locator('article').count(),news.articles.length);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'News must not overflow on mobile');
    const links=await page.locator('article a').evaluateAll(elements=>elements.map(a=>({href:a.getAttribute('href'),rel:a.getAttribute('rel')})));
    assert.ok(links.every(link=>link.rel.includes('noopener')&&link.rel.includes('noreferrer')));
    assert.equal(await page.locator('article img').count(),0);
    await page.screenshot({path:`artifacts/news-release/news-${live?'live':'fixture'}-${width}.png`,fullPage:false});
    outage=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await page.getByText('NFL news is temporarily unavailable. Use Refresh to try again.').waitFor();
    assert.equal(await page.locator('article').count(),0,'Outage must clear stale articles');
    outage=false;await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await page.locator('article').first().waitFor();
    assert.equal(await page.locator('article').count(),news.articles.length);
    assert.deepEqual(crashes,[]);await context.close();
  }
  await writeFile('artifacts/news-release/result.json',JSON.stringify({checkedAt:new Date().toISOString(),dataSource:live?'public production Tank01 endpoint':'synthetic regression fixture',articleCount:news.articles.length,viewports:[320,390],outageAndRecovery:true,physicalIphoneTest:false},null,2));
  console.log('Built-app mobile News navigation, headline rendering, outage and recovery passed.');
}finally{await browser?.close();server.kill('SIGTERM')}
