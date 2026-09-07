import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium,webkit} from 'playwright';
const out='artifacts/picks-screen',base='http://127.0.0.1:4184';
const future=new Date(Date.now()+86400_000).toISOString();
const day=future.slice(0,10);
const game={id:'picks-fixture-1',away:'Dallas Cowboys',home:'Philadelphia Eagles',awayAbbr:'DAL',homeAbbr:'PHI',season:2026,week:1,seasonType:'REG',date:future,scheduleDate:day,status:'Scheduled',homeSpread:-3.5,awaySpread:3.5,overUnder:44.5};
const fixture={available:true,linesAvailable:true,games:[game,{...game,id:'picks-fixture-final',away:'Baltimore Ravens',awayAbbr:'BAL',home:'Buffalo Bills',homeAbbr:'BUF',status:'Final',awayScore:20,homeScore:24},{...game,id:'picks-fixture-live',away:'New York Giants',awayAbbr:'NYG',home:'New York Jets',homeAbbr:'NYJ',status:'Live'},{...game,id:'picks-fixture-week2',week:2,scheduleDate:new Date(Date.now()+8*86400_000).toISOString().slice(0,10),date:null}]};
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4184','--strictPort'],{stdio:'inherit'});
const results=[];let browser;
async function contextFor(engine,width,{hungSync=false}={}){
  const context=await engine.newContext({viewport:{width,height:844},deviceScaleFactor:1,isMobile:width<768,hasTouch:width<768});
  const page=await context.newPage();const crashes=[];page.on('pageerror',error=>crashes.push(error.message));
  let boardMode='ok',saved=[],saves=0;
  await page.route('**/*.supabase.co/**',route=>route.fulfill({status:403,contentType:'application/json',body:'{"message":"Isolated browser test. No account access."}'}));
  await page.route('**/_vercel/**',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
  await page.route('https://a.espncdn.com/**',route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64')}));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let data={ok:true};let status=200;
    if(path==='/api/nfl-sportsbook'){
      if(boardMode==='hang')return;
      if(boardMode==='failure'){status=503;data={available:false,games:[]}}
      else if(boardMode==='empty')data={available:true,linesAvailable:false,games:[]};
      else data=fixture;
    }else if(path==='/api/prediction-picks'){
      if(hungSync)return;
      const body=route.request().method()==='POST'?route.request().postDataJSON():{};
      if(body.action==='save'){
        saves++;await new Promise(resolve=>setTimeout(resolve,180));
        saved=[{...body.pick,lockedAt:new Date().toISOString()}];
      }else if(body.action==='delete')saved=[];
      data={ok:true,picks:saved};
    }else if(path==='/api/nfl-news')data={available:true,articles:[]};
    else if(path==='/api/media')data={tracks:[],introUrl:null};
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.addInitScript(()=>{
    localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','1');localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off');localStorage.setItem('bk-guide-picks-v2','seen');
    const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',is_anonymous:true,app_metadata:{provider:'anonymous'},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
    localStorage.setItem('sb-gpnboygoosrmeydwjpvk-auth-token',JSON.stringify({access_token:'isolated-browser-fixture',refresh_token:'isolated-refresh-fixture',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+86400,expires_in:86400,user}));
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.bk-home-stadium').waitFor();
  for(const button of await page.getByRole('button',{name:'Picks',exact:true}).all())if(await button.isVisible()){await button.click();break}
  await page.locator('.bk-picks-game').first().waitFor({timeout:5000});
  return {context,page,crashes,setMode:mode=>{boardMode=mode},saved:()=>saved,saves:()=>saves};
}
try{
  let ready=false;for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break}}catch{}await new Promise(resolve=>setTimeout(resolve,200))}assert.ok(ready);
  await mkdir(out,{recursive:true});
  for(const [name,engine,widths]of [['chromium',chromium,[320,390,768,1280]],['webkit',webkit,[390]]]){
    browser=await engine.launch({headless:true});
    for(const width of widths){
      const c=await contextFor(browser,width);const {page}=c;
      const stage=page.locator('.bk-picks-screen');
      assert.equal(await stage.locator('.bk-scene-motion').count(),0,'no Motion On control on Picks');
      await page.evaluate(()=>document.fonts.ready);
      const geometry=await page.evaluate(()=>{
        const header=document.querySelector('.bk-picks-screen .bk-scene-masthead');const input=document.querySelector('.bk-picks-search input');const toolbar=document.querySelector('.bk-picks-toolbar');
        const primary=[...document.querySelectorAll('.bk-picks-filters button')].map(button=>button.getBoundingClientRect().height);
        const compact=[...document.querySelectorAll('.bk-picks-team-buttons button')].map(button=>button.getBoundingClientRect().height);
        const cards=[...document.querySelectorAll('.bk-picks-game')].map(card=>card.getBoundingClientRect().height);
        return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,heroHeight:header.getBoundingClientRect().height,inputFont:getComputedStyle(input).fontSize,toolbarBackground:getComputedStyle(toolbar).backgroundColor,primaryButtons:primary,compactPickButtons:compact,cardHeights:cards};
      });
      assert.ok(geometry.scrollWidth<=width+1);assert.ok(geometry.heroHeight<125,JSON.stringify(geometry));assert.equal(geometry.inputFont,'16px');assert.equal(geometry.toolbarBackground,'rgba(0, 0, 0, 0)');
      assert.ok(geometry.primaryButtons.every(height=>height>=43),'status filters must remain practical phone targets');
      assert.ok(geometry.compactPickButtons.every(height=>height>=31),'compact right-side pick controls must remain usable');
      assert.ok(geometry.cardHeights.every(height=>height>=80),'matchup rows must retain the approved compact card height');
      await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:false});
      const first=page.locator(`[data-game-id="${game.id}"]`);
      await page.getByRole('button',{name:'Upcoming',exact:true}).click();assert.equal(await page.locator('.bk-picks-game').count(),1);
      await page.getByRole('button',{name:'Completed',exact:true}).click();assert.equal(await page.locator('.bk-picks-game').count(),1);
      await page.getByRole('button',{name:'Live',exact:true}).click();assert.equal(await page.locator('.bk-picks-game').count(),1);
      await page.getByRole('button',{name:'All Games',exact:true}).click();
      await page.getByRole('searchbox',{name:'Search teams'}).fill('  PHI  ');assert.equal(await page.locator('.bk-picks-game').count(),1);
      await page.getByRole('button',{name:'Clear team search'}).click();
      const weekSelect=page.getByRole('combobox',{name:'NFL week'});
      await weekSelect.selectOption({label:'Week 2'});assert.equal(await page.locator('.bk-picks-game').count(),1);
      assert.ok(await page.getByText('Picks open when kickoff time is confirmed.').isVisible());assert.ok(await page.locator('.bk-picks-team-buttons button').first().isDisabled());
      await weekSelect.selectOption({label:'Week 1'});
      const pick=first.getByRole('button',{name:'Philadelphia Eagles -3.5',exact:true});
      await pick.evaluate(button=>{button.click();button.click()});
      await page.waitForFunction(()=>document.querySelector('.bk-picks-summary-heading')?.textContent.includes('1 saved'));
      assert.equal(c.saves(),1,'rapid double tap must only send one save');assert.equal(c.saved()[0].lockedLine,-3.5);
      await page.getByRole('button',{name:'Philadelphia Eagles -3.5 · Remove pick',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('.bk-picks-summary-heading')?.textContent.includes('0 saved'));
      await pick.click();await page.waitForFunction(()=>document.querySelector('.bk-picks-summary-heading')?.textContent.includes('1 saved'));
      c.setMode('failure');await page.getByRole('button',{name:'Refresh picks',exact:true}).click();await page.getByRole('button',{name:'Retry matchups',exact:true}).waitFor();
      assert.equal(await page.locator('.bk-picks-game').count(),0);assert.ok((await page.locator('.bk-picks-summary-heading').textContent()).includes('1 saved'));
      if(width===390)await page.screenshot({path:`${out}/${name}-outage.png`});
      c.setMode('ok');await page.getByRole('button',{name:'Retry matchups',exact:true}).click();await first.waitFor();
      c.setMode('empty');await page.getByRole('button',{name:'Refresh picks',exact:true}).click();await page.getByText('No NFL matchups scheduled right now.').waitFor();
      assert.equal(await page.getByRole('button',{name:'Retry matchups',exact:true}).count(),0);
      if(width===390)await page.screenshot({path:`${out}/${name}-empty.png`});
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForFunction(()=>document.querySelector('.bk-picks-screen')?.getAttribute('data-motion')==='off',{},{timeout:3000});
      assert.equal(await stage.getAttribute('data-motion'),'off');
      assert.deepEqual(c.crashes,[]);results.push({engine:name,width,geometry,saving:true,filters:true,outageRecovery:true,validEmpty:true,reducedMotion:true});await c.context.close();
    }
    if(name==='chromium'){
      const c=await contextFor(browser,390,{hungSync:true});
      assert.ok(await c.page.locator(`[data-game-id="${game.id}"]`).isVisible(),'hung grading must not block the matchup request');
      await c.page.clock.install();c.setMode('hang');await c.page.getByRole('button',{name:'Refresh picks',exact:true}).click();
      await c.page.clock.runFor(21_000);await c.page.getByRole('button',{name:'Retry matchups',exact:true}).waitFor({timeout:5000});
      c.setMode('ok');await c.page.getByRole('button',{name:'Retry matchups',exact:true}).click();await c.page.locator('.bk-picks-game').first().waitFor();
      results.push({hungCloudDoesNotBlockBoard:true,hungFeedHasRetryAfterDeadline:true});await c.context.close();
    }
    await browser.close();browser=null;
  }
  await writeFile(`${out}/results.json`,JSON.stringify({tests:results,source:'Explicit synthetic fixtures, all APIs intercepted; no production account writes',physicalIphoneTest:false},null,2));
  console.log('Picks actual production-bundle browser checks passed.',JSON.stringify(results));
}finally{await browser?.close();server.kill('SIGTERM')}
