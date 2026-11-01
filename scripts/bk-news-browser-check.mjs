import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const news={available:true,provider:'Currents',fetchedAt:new Date().toISOString(),articles:[{id:'https://publisher.example/story',url:'https://publisher.example/story',headline:'Example headline used only in automated testing',source:'Test publisher',published:null,image:null,description:''}]};
const base='http://127.0.0.1:4176';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4176','--strictPort','--outDir','/tmp/bk-news-opt-in'],{stdio:'inherit'});
let browser;
try{
  let ready=false;
  for(let i=0;i<80;i++){
    if(server.exitCode!==null)throw Error('Preview exited');
    try{if((await fetch(base)).ok){ready=true;break}}catch{}
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert.ok(ready,'Preview failed to start');
  await mkdir('artifacts/bk-news-review',{recursive:true});
  browser=await chromium.launch({headless:true});
  for(const width of [320,390]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
    const page=await context.newPage();const crashes=[];let outage=false;let v1State='available';const requested=[];
    page.on('pageerror',error=>crashes.push(error.message));
    await page.route('**/api/**',async route=>{
      const path=new URL(route.request().url()).pathname;
      requested.push(path);
      if(path==='/api/bk/v1/news'){const payload=v1State==='outage'?{available:false,items:[]}:{available:true,kind:'news',provider:v1State==='unknown'?'Unrecognized test provider':'Currents',items:news.articles,updatedAt:new Date(Date.now()-(v1State==='stale'?16*60_000:0)).toISOString()};return route.fulfill({status:v1State==='outage'?503:200,contentType:'application/json',body:JSON.stringify(payload)});}
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
    // Home's independent ticker intentionally uses the compatibility endpoint. Wait for its
    // initial load, then measure only requests made by the NewsHub migration.
    await page.getByRole('region',{name:'NFL headlines',exact:true}).getByRole('link',{name:news.articles[0].headline,exact:true}).waitFor();
    const homeLegacyRequests=requested.filter(path=>path==='/api/nfl-news').length;
    await page.getByRole('button',{name:'NFL News',exact:true}).click();
    await page.locator('article').first().waitFor();
    assert.equal(await page.locator('article').count(),news.articles.length);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'News must not overflow on mobile');
    const links=await page.locator('article a').evaluateAll(elements=>elements.map(a=>({href:a.getAttribute('href'),rel:a.getAttribute('rel')})));
    assert.ok(links.every(link=>link.rel.includes('noopener')&&link.rel.includes('noreferrer')));
    assert.equal(await page.locator('article img').count(),0);
    await page.screenshot({path:`artifacts/bk-news-review/news-opt-in-${width}.png`,fullPage:false});
    assert.ok(requested.includes('/api/bk/v1/news'),'opt-in build must request v1');
    assert.equal(requested.filter(path=>path==='/api/nfl-news').length,homeLegacyRequests,'healthy NewsHub v1 must not add compatibility requests');
    await page.locator('[data-page="news"]').getByRole('link',{name:'Powered by Currents News API',exact:true}).waitFor();
    const providerLink=page.locator('[data-page="news"]').getByRole('link',{name:'Powered by Currents News API',exact:true});
    assert.equal(await providerLink.getAttribute('href'),'https://currentsapi.services/');
    v1State='unknown';await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.locator('[data-page="news"]').getByText('Headlines supplied by News provider.',{exact:false}).waitFor();assert.equal(await providerLink.count(),0,'Unrecognized provider must not receive Currents branding');
    for(const state of ['outage','stale']){v1State=state;const before=requested.filter(path=>path==='/api/nfl-news').length;const compatibilityResponse=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/nfl-news');await page.getByRole('button',{name:'Refresh',exact:true}).click();await compatibilityResponse;await providerLink.waitFor();assert.ok(requested.filter(path=>path==='/api/nfl-news').length>before,'Unavailable v1 recovers through the compatibility endpoint');assert.equal(await page.locator('article').count(),news.articles.length);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);}
    v1State='outage';outage=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await page.getByText('NFL news is temporarily unavailable. Use Refresh to try again.').waitFor();
    assert.equal(await page.locator('article').count(),0,'Outage must clear stale articles');
    v1State='available';outage=false;await page.getByRole('button',{name:'Refresh',exact:true}).click();
    await page.locator('article').first().waitFor();
    assert.equal(await page.locator('article').count(),news.articles.length);
    assert.deepEqual(crashes,[]);await context.close();
  }
  await writeFile('artifacts/bk-news-review/result.json',JSON.stringify({checkedAt:new Date().toISOString(),dataSource:'synthetic regression fixture',articleCount:news.articles.length,viewports:[320,390],outageAndRecovery:true,physicalIphoneTest:false},null,2));
  console.log('Opt-in Sports API News mobile rendering, provider fallback, stale fallback, outage and recovery passed.');
}finally{await browser?.close();server.kill('SIGTERM')}
