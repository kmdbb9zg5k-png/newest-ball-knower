// Full Agent year through visible controls. All account/API traffic is isolated.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {preview} from 'vite';
import {chromium} from 'playwright';
const out='artifacts/agent-season';await mkdir(out,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:4193,strictPort:true}});
const launch=process.env.BK_CHROMIUM_MODULE ? await import(process.env.BK_CHROMIUM_MODULE) : null;
const launchBrowser=async()=>chromium.launch(launch ? {headless:true,executablePath:await launch.default.executablePath(),args:launch.default.args} : {headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox']});
const key='ballknower_player_agent_v4';
const results=[];let browser;
try{
 for(const width of (process.env.BK_QA_WIDTHS||'390,320,1280').split(',').map(Number)){
  browser=await launchBrowser();
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const cloud=new Map();let signings=0;
  const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',is_anonymous:true,created_at:'2026-01-01T00:00:00Z',app_metadata:{provider:'anonymous',providers:['anonymous']},user_metadata:{}};
  const session={access_token:'qa-local-token',refresh_token:'qa-local-refresh',token_type:'bearer',expires_in:36000,expires_at:Math.floor(Date.now()/1000)+36000,user};
  await page.route('**/*',async r=>{
   const url=new URL(r.request().url());const path=url.pathname;
   if(url.hostname==='127.0.0.1'&&!path.startsWith('/api/'))return r.continue();
   if(url.hostname.endsWith('.supabase.co')){
    if(path==='/auth/v1/signup'||path==='/auth/v1/token')return r.fulfill({json:session});
    if(path==='/auth/v1/user')return r.fulfill({json:user});
    if(path==='/auth/v1/settings')return r.fulfill({json:{external:{}}});
    if(path.endsWith('/rpc/commit_ball_knower_expected_agent_signing')){
      const data=r.request().postDataJSON();assert.equal(data.p_expected_user_id,user.id);cloud.set('player_agent_career',data.p_after_value);signings++;return r.fulfill({json:null});
    }
    if(path.endsWith('/ball_knower_user_state')){
     if(r.request().method()==='POST'){
      const data=r.request().postDataJSON();for(const row of Array.isArray(data)?data:[data])cloud.set(row.state_key,row.value);
      return r.fulfill({json:Array.isArray(data)?data:[data]});
     }
     const name=url.searchParams.get('state_key')?.replace(/^eq\./,'');
     if(name)return r.fulfill({json:cloud.has(name)?{value:cloud.get(name)}:null});
     return r.fulfill({json:[...cloud].map(([state_key,value])=>({state_key,value,updated_at:new Date().toISOString()}))});
    }
    return r.fulfill({json:[]});
   }
   if(path.startsWith('/api/'))return r.fulfill({json:{available:false,tracks:[],introUrl:null,ok:true,games:[],articles:[]}});
   return r.abort();
  });
  await page.addInitScript(()=>{localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','2');localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off')});
  const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  const shot=async name=>process.env.BK_QA_SKIP_SHOTS==='1'?undefined:page.screenshot({path:`${out}/${width}-${name}.png`,animations:'disabled',timeout:30000});
  const open=async()=>{if(width>=600){await page.getByRole('button',{name:'Explore Ball Knower',exact:true}).click();await page.getByRole('dialog',{name:'Explore Ball Knower',exact:true}).getByRole('button',{name:/^Solo careers/}).click();}else await page.getByRole('button',{name:'Play Solo Mode',exact:true}).click();await page.getByRole('button',{name:'Choose Career',exact:true}).click();await page.getByRole('region',{name:'Choose your career',exact:true}).getByRole('button',{name:/^Agent/}).click();await page.locator('[data-page="agent"]').waitFor();await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>scrollY),0,'Agent entry resets prior screen scroll');};
  await page.goto('http://127.0.0.1:4193',{waitUntil:'domcontentloaded'});await open();
  await page.getByRole('button',{name:'CONTINUE',exact:true}).click();await page.getByRole('button',{name:'CREATE YOUR AGENT',exact:true}).click();await page.getByLabel('Agent name',{exact:true}).fill('Season QA');await page.getByLabel('Home city',{exact:true}).fill('Whitehall');await page.getByRole('button',{name:'BEGIN MY CAREER',exact:true}).click();await page.getByRole('navigation',{name:'Agent career sections'}).waitFor();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>scrollY),0,'Creating an agent opens at the top');await shot('entry');
  if(process.env.BK_QA_ART==='1'){
   for(const scene of ['headquarters','growth','recruiting']){const art=page.locator(`[data-agent-scene="${scene}"]`).first();await art.scrollIntoViewIfNeeded();await art.locator('img').evaluate(img=>img.decode());assert(await art.locator('img').evaluate(img=>img.naturalWidth>0));await shot(`art-${scene}`);}
   assert.equal(await page.locator('[data-page="agent"] img[src^="/community/"]').count(),0);
  }
  const advance=async()=>{await page.getByRole('button',{name:/^(ADVANCE ONE WEEK|BEGIN NEXT SEASON)$/}).click();};
  const dismissLevel=async()=>{const level=page.getByRole('dialog',{name:'Reputation level up'});if(await level.count())await level.getByRole('button').click();};
  const meeting=page.getByRole('dialog',{name:/Private meeting/});
  async function recruit(index=0, poorPitch=false){
   await page.locator('#agent-prospects .bk-solo-selection > button:first-child:enabled').nth(index).click();
   if(process.env.BK_QA_ART==='1'){const art=meeting.locator('[data-agent-scene="recruiting"] img');await art.evaluate(img=>img.decode());await shot('art-meeting');}
   for(let round=0;round<2;round++){
    const choices=meeting.locator('button').filter({hasNotText:'CLOSE'});
    await (poorPitch ? choices.nth(round===0?3:2) : choices.first()).click();await page.waitForTimeout(200);
   }
   await page.waitForFunction(()=>!localStorage.getItem('ballknower_player_agent_signing_pending_v1'));
   await dismissLevel();
   if(await meeting.count()){const copy=await meeting.innerText();assert(!copy.includes('Another Agent tab changed'),'One-tab recruiting must not report a false save conflict');console.log('Meeting result',width,copy.slice(-400));await meeting.getByRole('button',{name:'Close private meeting'}).click();}
  }
  await page.getByRole('navigation',{name:'Agent career sections'}).getByRole('link',{name:'Recruit',exact:true}).click();
  await page.getByLabel('Filter prospects by position').selectOption('P');await shot('empty-position');
  await page.getByLabel('Filter prospects by position').selectOption('ALL');
  await recruit(0,true);
  assert.equal((await read()).clients.length,0);assert(Object.keys((await read()).recruitLockouts).length===1);
  assert(await page.locator('#agent-prospects .bk-solo-selection > button:first-child').filter({hasText:'SIGNED ELSEWHERE'}).first().isDisabled());
  for(let attempts=0;attempts<6&&(await read()).clients.length<1;attempts++){
   if((await read()).weeklyActionsUsed>=2)await advance();await recruit();
  }
  assert((await read()).clients.length>0,'Normal recruiting must sign the first client');assert(signings>0,'Recruiting used account-bound cloud verification');
  if((await read()).weeklyActionsUsed>=2)await advance();
  await page.getByRole('button',{name:'ENTER NEGOTIATION ROOM',exact:true}).first().click();
  const room=page.getByRole('dialog',{name:/Negotiation room/});await shot('contract');
  assert(await room.evaluate(el=>el.scrollWidth<=el.clientWidth),'Contract room must not overflow horizontally');
  const leave=await room.getByRole('button',{name:'LEAVE',exact:true}).boundingBox();assert(leave&&leave.x>=0&&leave.x+leave.width<=width,'Contract exit stays visible on narrow screens');
  if(process.env.BK_QA_LAYOUT_ONLY==='1'){
   await room.getByRole('button',{name:'LEAVE',exact:true}).click();assert.equal(await room.count(),0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
   results.push({width,layout:'pass',exitReachable:true,errors});await context.close();await browser.close();console.log('PASS Agent layout and contract exit',width);continue;
  }
  await room.getByRole('button',{name:'GUARANTEES',exact:true}).click();await room.getByRole('button',{name:/ACCEPT CLUB OFFER/}).click();
  let state=await read();assert.equal(state.dealHistory.length,1);assert(state.cashK>150);assert.equal(state.clients[0].futureDeal.startYear,2027);
  await page.getByRole('button',{name:/RECRUITING DIRECTOR/}).click();assert.equal((await read()).staff.length,1);
  if((await read()).weeklyActionsUsed>=2)await advance();
  await recruit();assert.equal((await read()).clients.length,2,'A second signing preserves the first client and contract');
  // Deterministic league-event rolls exercise a trade request without editing the save.
  await page.evaluate(()=>{Math.random=()=>0.01;});
  let decisions=0,trades=0;const phases=new Set();
  while((await read()).seasonYear===2026){
   state=await read();phases.add(state.phase);
   const available=()=>page.locator('#agent-clients button:enabled');
   for(const client of state.clients){
    if((await read()).weeklyActionsUsed>=2)break;
    if(client.career.pendingEvent){
     if(process.env.BK_QA_ART==='1'){const scene={playing_time:'role',trade:'trade',injury:'injury',family:'family',contract:'contract',brand:'brand'}[client.career.pendingEvent.kind];const art=page.locator(`#agent-clients [data-agent-scene="${scene}"]`).first();await art.scrollIntoViewIfNeeded();await art.locator('img').evaluate(img=>img.decode());assert(await art.locator('img').evaluate(img=>img.naturalWidth>0));await shot(`event-${scene}`);}
     const choice={playing_time:'FIGHT FOR HIM',trade:'FIGHT FOR HIM',injury:'SUPPORT HIM',family:'SUPPORT HIM',contract:'MAKE A BUSINESS MOVE',brand:'MAKE A BUSINESS MOVE'}[client.career.pendingEvent.kind];
     await available().filter({hasText:choice}).first().click();decisions++;
    }
    const trade=page.getByRole('button',{name:/^(WORK THE PHONES|PUSH AGAIN)$/}).first();
    if(await trade.count()&&await trade.isEnabled()){const used=(await read()).weeklyActionsUsed;await trade.click();assert.equal((await read()).weeklyActionsUsed,used+1);trades++;}
   }
   state=await read();
   if(state.weeklyActionsUsed>=2){
    assert.equal(await page.locator('#agent-prospects .bk-solo-selection > button:first-child:enabled').count(),0,'No recruiting beyond weekly budget');
    assert.equal(await page.getByRole('button',{name:'ENTER NEGOTIATION ROOM',exact:true}).and(page.locator(':enabled')).count(),0);
   }
   if(state.phase==='regular'&&state.seasonWeek===6&&process.env.BK_QA_SKIP_RELOADS!=='1'){await shot('week-six');await page.reload({waitUntil:'domcontentloaded'});await open();assert.equal((await read()).seasonWeek,6);await page.evaluate(()=>{Math.random=()=>0.01;});}
   if(state.phase==='regular'&&state.seasonWeek===10){const blocked=page.getByRole('button',{name:/^(WORK THE PHONES|PUSH AGAIN)$/});for(let i=0;i<await blocked.count();i++)assert(await blocked.nth(i).isDisabled());}
   if(state.phase==='offseason'&&state.seasonWeek===4)await shot('season-end');
   await advance();state=await read();console.log('Agent week',width,state.seasonYear,state.phase,state.seasonWeek,'clients',state.clients.length);
   assert.equal(state.weeklyActionsUsed,0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No horizontal overflow');
  }
  state=await read();assert.equal(state.seasonYear,2027);assert.equal(state.simulatedDate,'2027-09-03');assert.equal(state.profile.age,23);assert.equal(state.seasonHistory.length,1);assert(decisions>=5);assert(trades>0);assert(phases.has('postseason')&&phases.has('offseason'));assert.equal(state.clients.length,2);assert.equal(state.dealHistory.length,1);
  await page.getByText('Season checkpoints · 1',{exact:true}).click();await shot('next-season');
  if(process.env.BK_QA_SKIP_RELOADS!=='1'){await page.reload({waitUntil:'domcontentloaded'});await open();}
  assert.equal((await read()).seasonYear,2027);assert.equal((await read()).clients.length,2);assert.deepEqual(errors,[]);
  await page.getByRole('button',{name:'SOLO',exact:true}).click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>scrollY),0);
  await page.locator('.bk-mode-card').filter({hasText:'Agent Mode'}).click();await page.locator('[data-page="agent"]').waitFor();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>scrollY),0,'Direct Agent shortcut also starts at the top');
  results.push({width,reloads:process.env.BK_QA_SKIP_RELOADS!=='1',decisions,trades,signings,year:state.seasonYear,clients:state.clients.length,deal:state.clients[0].futureDeal,errors});
  await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));
  await context.close();await browser.close();console.log('PASS Agent full season',width);
 }
 await writeFile(`${out}/${process.env.BK_QA_LAYOUT_ONLY==='1'?'layout-results':'results'}.json`,JSON.stringify(results,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));}
