import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const handlesSource=readFileSync('footballOpponentHandles.ts','utf8');
const handles=[...handlesSource.split('] as const')[0].matchAll(/'([A-Za-z0-9]+)'/g)].map(m=>m[1]);
assert.equal(handles.length,50);assert.equal(new Set(handles).size,50);
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const fixture=`import React from 'react';import{createRoot}from'react-dom/client';import Arena from '/CommunityFootballArena.tsx';import '/index.css';createRoot(document.getElementById('root')).render(React.createElement(Arena,{me:location.search.includes('guest')?'':'me',friends:[{userId:'friend',displayName:'Fourth Down Club'}],onOpenAuth:()=>{document.body.dataset.auth='requested'}}));`;
const server=await createServer({cacheDir:'/tmp/bk-football-vite',server:{host:'127.0.0.1',port:3059,strictPort:true,watch:null,hmr:false},plugins:[{name:'football-fixture',enforce:'pre',transform(code,id){if(id.endsWith('/footballArena.ts')){const a=code.indexOf('export async function footballArenaAction'),b=code.indexOf('export const footballTotal');return code.slice(0,a)+`export async function footballArenaAction(action,args={}){const r=await fetch('/__arena-rpc',{method:'POST',body:JSON.stringify({action,args})});const data=await r.json();if(!r.ok)throw new Error(data.message);return data;}\n`+code.slice(b);}},configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url?.startsWith('/football-qa.html')){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,'<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0;background:#06090d;color:white"><div id="root"></div><script type="module" src="/football-qa.tsx"></script></body></html>'));}else next();});},resolveId(id){if(id==='/football-qa.tsx')return '\0football-qa.tsx';},load(id){if(id==='\0football-qa.tsx')return fixture;}}]});
await server.listen();await mkdir('artifacts/football-arena',{recursive:true});
let browser,currentPage,currentWidth,currentCalls,currentErrors;
const consoleErrors=[],networkFailures=[];
try{
 for(const width of (process.env.WIDTHS?JSON.parse(process.env.WIDTHS):[320,390,1280])){
  browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});

  const page=await browser.newPage({viewport:{width,height:844},hasTouch:width<768,isMobile:width<768});page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));let matches=[],calls=[],fail=true,opponentFinished=true,releaseQuickMatch;
  currentPage=page;currentWidth=width;currentCalls=calls;currentErrors=errors;
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push({width,text:message.text()});});
  page.on('requestfailed',request=>networkFailures.push({width,url:request.url(),failure:request.failure()}));
  // Passively observe the short kickoff presentation inside each newly loaded frame.
  // Software rendering can finish a return while automation makes cross-process calls.
  await page.addInitScript(()=>{
    if(window===window.top)return;
    const visible=element=>{
      if(!element||!element.getClientRects().length)return false;
      for(let node=element;node instanceof Element;node=node.parentElement){
        const style=getComputedStyle(node);
        if(node.hidden||style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse'||Number(style.opacity)===0)return false;
      }
      return true;
    };
    const observations=[];
    Object.defineProperty(window,'bkObservedKickoffs',{value:observations});
    const observe=()=>{
      const status=document.querySelector('#unitStatus'),loading=document.querySelector('#loading'),unit=document.querySelector('#liveUnits');
      if(observations.length||!status?.textContent?.includes('KICK RETURN')||visible(loading)||!visible(unit))return;
      observations.push({text:status.textContent,at:performance.now(),loadingVisible:false,unitVisible:true});
    };
    new MutationObserver(observe).observe(document,{subtree:true,childList:true,attributes:true,characterData:true});
    document.addEventListener('DOMContentLoaded',observe);
  });
  await page.route('**/*.supabase.co/**',r=>r.abort());
  await page.route('**/__arena-rpc',async route=>{
    const {action,args}=route.request().postDataJSON();calls.push({action,args});let result={};const m=matches.find(m=>m.id===args.id);
    if(action==='home')result={matches,standings:matches.some(m=>m.status==='completed')?[{user_id:'friend',name:'Fourth Down Club',games:1,wins:1,losses:0,ties:0,rating:3},{user_id:'me',name:'You',games:1,wins:0,losses:1,ties:0,rating:0}]:[]};
    if(action==='create')matches=[{id:'football-test',challenger_id:'me',opponent_id:'friend',challenger_team:args.team,opponent_team:'BRK',challenger_name:'My very long player display name',opponent_name:'Fourth Down Club',status:'active',winner_id:null,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),drives:(opponentFinished?[1,2,3]:[]).map(ordinal=>({user_id:'friend',ordinal,points:3,yards:50,plays:6,finished_at:new Date().toISOString(),forfeited:false}))}];
    if(action==='quick_match'){
      matches=[{id:'late-search',challenger_id:'me',opponent_id:null,challenger_team:args.team,opponent_team:null,challenger_name:'You',opponent_name:'',status:'open',winner_id:null,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),drives:[]}];
      await new Promise(resolve=>{releaseQuickMatch=resolve;});result={id:'late-search',status:'open'};
    }
    if(action==='cancel'){if(m)m.status='cancelled';result={cancelled:true};}
    if(action==='begin'){m.drives.push({user_id:'me',ordinal:args.drive,points:null,yards:null,plays:null,finished_at:null,deadline:new Date(Date.now()+720000).toISOString()});result={token:'drive-token-'+args.drive,drive:args.drive,deadline:new Date(Date.now()+720000).toISOString(),seed:42+args.drive,team:m.challenger_team,opponent:m.opponent_team};}
    if(action==='submit'||action==='forfeit'){
      if(action==='submit'&&fail){fail=false;await route.fulfill({status:503,json:{message:'Connection interrupted. Retry saving this result.'}});return;}
      const drive=m.drives.find(d=>d.user_id==='me'&&d.ordinal===args.drive);Object.assign(drive,action==='submit'?args.stats:{points:0,yards:0,plays:0},{finished_at:new Date().toISOString(),forfeited:action==='forfeit'});
      if(m.drives.filter(d=>d.finished_at).length===6){m.status='completed';m.winner_id='friend';}result={saved:true,points:drive.points};
    }
    await route.fulfill({json:result});
  });
  await page.goto('http://127.0.0.1:3059/football-qa.html?guest');
  await page.getByRole('button',{name:'Pick your team',exact:true}).waitFor();
  assert.doesNotMatch(await page.getByRole('region',{name:'Football H2H',exact:true}).innerText(),/log\s?in|sign\s?in/i);
  await page.getByRole('button',{name:'Pick your team',exact:true}).click();
  const selection=page.getByRole('dialog');
  await selection.getByRole('heading',{name:'Pick your team.'}).waitFor();
  assert.equal(await selection.locator('.bk-h2h-select-stars article').count(),3);
  assert(await selection.evaluate(el=>el.scrollWidth<=el.clientWidth),'Team selection fits '+width);
  await selection.getByRole('button',{name:'Browse all 32 teams'}).click();
  assert.equal(await selection.locator('#h2h-all-teams button').count(),32,'Every team remains reachable');
  await selection.locator('#h2h-all-teams button').filter({hasText:'Milwaukee'}).click();
  await selection.getByRole('heading',{name:/Milwaukee/}).waitFor();
  await page.screenshot({path:`artifacts/football-arena/teams-${width}.png`});
  await selection.getByRole('button',{name:'‹ Back',exact:true}).click();
  assert.equal(calls.length,0,'Guest selection does not call online RPC');
  await page.getByRole('button',{name:'Keep records'}).click();assert.equal(await page.locator('body').getAttribute('data-auth'),'requested');
  await page.goto('http://127.0.0.1:3059/football-qa.html');await page.getByLabel('Your team',{exact:true}).selectOption('MIL');await page.getByLabel('Opponent',{exact:true}).selectOption('friend');await page.getByRole('button',{name:'Challenge friend'}).click();await page.getByRole('button',{name:'Play drive 1 of 3'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'No overflow '+width);
  await page.screenshot({path:`artifacts/football-arena/lobby-${width}.png`,fullPage:true});
  if(width===390){
    await page.setViewportSize({width:1000,height:500});
    await page.getByRole('button',{name:'Play drive 1 of 3'}).click();
    for(let n=1;n<=3;n++){
      console.log(`Playing automatically launched official drive ${n} through kickoff and normal spike controls`);
      const iframe=page.locator(`iframe[src*="drive=${n}"]`);await iframe.waitFor();
      const frame=await iframe.elementHandle().then(e=>e.contentFrame());
      await frame.locator('#loading').waitFor({state:'hidden',timeout:120000});
      assert.equal(await frame.evaluate(()=>typeof window.bk3dTest),'undefined','Official frames have no QA game controls');
      assert.equal(await frame.locator('#restart').isVisible(),false,'No rematch button');
      await frame.waitForFunction(()=>window.bkObservedKickoffs?.length>0,{},{timeout:30000});
      assert.deepEqual(await frame.evaluate(()=>window.bkObservedKickoffs.map(({loadingVisible,unitVisible})=>({loadingVisible,unitVisible}))),[{loadingVisible:false,unitVisible:true}],'Every drive visibly presents its kickoff after loading');
      assert.equal(await frame.locator('#unitTouchback').isVisible(),false,'Opening kickoff cannot be skipped');
      await frame.locator('#breakHuddle').waitFor({state:'visible',timeout:45000});
      assert.match(await frame.locator('.club.away').getAttribute('aria-label'),/Brooklyn/);
      assert.doesNotMatch(await frame.locator('#hud').innerText(),/CPU|simulated/i);
      const before=calls.filter(c=>c.action==='submit').length;
      await page.evaluate(({drive})=>window.postMessage({type:'bk-arena-result',matchId:'football-test',token:'drive-token-'+drive,drive,stats:{points:8,yards:75,plays:1}},location.origin),{drive:n});
      await frame.evaluate(({drive})=>parent.postMessage({type:'bk-arena-result',matchId:'football-test',token:'wrong-token',drive,stats:{points:8,yards:75,plays:1}},location.origin),{drive:n});
      await frame.evaluate(({drive})=>parent.postMessage({type:'bk-arena-result',matchId:'football-test',token:'drive-token-'+drive,drive:drive+1,stats:{points:8,yards:75,plays:1}},location.origin),{drive:n});
      // A browser round trip lets queued message listeners run before checking RPC calls.
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      assert.equal(calls.filter(c=>c.action==='submit').length,before,'Wrong source, token and drive cannot save scores');
      for(let down=1;down<=4;down++){await frame.locator('#breakHuddle').click();await frame.locator('#miniSpike').click();}
      if(n===1){await page.getByRole('alert').filter({hasText:'Connection interrupted'}).waitFor();await page.getByRole('button',{name:'Retry saving result'}).click();}
      if(n<3)await page.locator(`iframe[src*="drive=${n+1}"]`).waitFor();
    }
    await page.getByRole('heading',{name:'You lose',exact:true}).waitFor();
    const statsTable=page.getByRole('table',{name:'Offensive stats'});await statsTable.waitFor();
    assert.match(await statsTable.innerText(),/Total yards/);
    assert.match(await statsTable.innerText(),/—/,'Old opponent drives without detailed stats are unavailable, not zero');
    await page.setViewportSize({width:390,height:844});
    assert(await page.getByRole('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'Final comparison fits mobile');
    await page.screenshot({path:'artifacts/football-arena/results.png',fullPage:true});
    await page.getByRole('button',{name:'Back to main screen',exact:true}).last().click();
    await page.getByRole('button',{name:'Match history',exact:true}).click();await page.getByText('OPPONENT WINS',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:/Play drive/}).count(),0);
    await page.getByRole('button',{name:'Standings',exact:true}).click();await page.getByText('1W · 0L · 0T',{exact:true}).waitFor();
    const submitted=calls.filter(c=>c.action==='submit');assert.equal(submitted.length,4,'Three results plus one failed-save retry');
    assert.deepEqual(submitted[0].args,submitted[1].args,'Failed save retries exact stats/token');
    assert(submitted.every(c=>c.args.stats.points===0&&c.args.stats.plays===4),'Real game bridge sent four-spike turnovers');
    assert.deepEqual(calls.filter(c=>c.action==='begin').map(c=>c.args.drive),[1,2,3],'All drives start once and advance automatically');
    // A lightweight iframe isolates session orchestration from the separately tested engine.
    await page.route('**/play-moment-3d-preview.html?**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Bridge fixture</body></html>'}));
    const sendResult=async (n,stats)=>{
      const iframe=page.locator(`iframe[src*="drive=${n}"]`);await iframe.waitFor();
      const handle=await iframe.elementHandle(),frame=await handle.contentFrame();
      await frame.waitForLoadState('domcontentloaded');
      await frame.evaluate(stats=>{const p=new URLSearchParams(location.search);parent.postMessage({type:'bk-arena-result',matchId:p.get('bkArena'),token:p.get('token'),drive:Number(p.get('drive')),stats},location.origin);},stats);
    };
    // Opponent totals must not become a fabricated victory before their drives arrive.
    opponentFinished=false;matches=[];
    await page.goto('http://127.0.0.1:3059/football-qa.html');
    await page.getByLabel('Opponent',{exact:true}).selectOption('friend');await page.getByRole('button',{name:'Challenge friend'}).click();
    await page.getByRole('button',{name:'Play drive 1 of 3'}).click();
    await sendResult(1,{points:3,yards:35,plays:6});
    await page.getByRole('button',{name:'Exit',exact:true}).click();
    await page.getByRole('alertdialog',{name:'Leave match?'}).waitFor();
    await page.waitForTimeout(2100);
    assert.equal(await page.locator('iframe[src*="drive=2"]').count(),0,'Exit confirmation pauses the next kickoff');
    await page.getByRole('button',{name:'Keep playing',exact:true}).click();
    for(let n=2;n<=3;n++)await sendResult(n,{points:3,yards:35,plays:6});
    await page.getByRole('heading',{name:/Waiting for your opponent/i}).waitFor();
    assert.equal(await page.getByRole('heading',{name:/^You win!$|^You lose$|^Tie game$/}).count(),0,'Pending opponent has no declared result');
    await page.screenshot({path:'artifacts/football-arena/opponent-pending.png'});
    const pending=matches[0];pending.drives.push(...[1,2,3].map(ordinal=>({user_id:'friend',ordinal,points:7,yards:60,plays:7,finished_at:new Date().toISOString(),forfeited:false})));
    pending.status='completed';pending.winner_id='friend';
    await page.getByRole('heading',{name:'You lose',exact:true}).waitFor({timeout:30000});
    await page.getByRole('button',{name:'Back to main screen',exact:true}).last().click();
    // Cancel before the quick-match response arrives: the late queue row must still close.
    matches=[];await page.goto('http://127.0.0.1:3059/football-qa.html');
    await page.getByRole('button',{name:'Pick your team',exact:true}).click();
    const queued=page.waitForRequest(r=>r.url().endsWith('/__arena-rpc')&&r.postDataJSON().action==='quick_match');
    await page.getByRole('button',{name:'Find opponent',exact:true}).click();await queued;
    await page.getByRole('button',{name:'Cancel search',exact:true}).click();
    const cancelled=page.waitForRequest(r=>r.url().endsWith('/__arena-rpc')&&r.postDataJSON().action==='cancel');
    assert.equal(typeof releaseQuickMatch,'function');releaseQuickMatch();await cancelled;
    await page.getByRole('heading',{name:'Pick your team.'}).waitFor();
    assert.equal(await page.locator('iframe').count(),0,'Late matchmaking response cannot launch a cancelled session');
    await page.getByRole('dialog').getByRole('button',{name:'‹ Back',exact:true}).click();
    // Guest matchmaking really lasts 30 seconds and then automatically starts all drives.
    await page.goto('http://127.0.0.1:3059/football-qa.html?guest');
    const beforeGuest=calls.length;
    await page.getByRole('button',{name:'Pick your team',exact:true}).click();
    const started=Date.now();await page.getByRole('button',{name:'Find opponent',exact:true}).click();
    assert.equal(await page.locator('iframe').count(),0,'Matchmaking is a separate screen');
    await page.locator('iframe[src*="drive=1"]').waitFor({timeout:40000});
    assert(Date.now()-started>=29000,'Guest matching does not skip the 30-second search');
    const opponentLabel=page.locator('.football-session-score small');await opponentLabel.waitFor();
    const chosenHandle=(await opponentLabel.innerText()).split(' · ')[0];assert(handles.includes(chosenHandle));
    assert.doesNotMatch(await page.getByRole('dialog').innerText(),/CPU|simulated|online player/i);
    for(let n=1;n<=3;n++)await sendResult(n,{points:8,yards:75,plays:1});
    await page.getByRole('heading',{name:/^You win!$|^Tie game$/}).waitFor();
    assert.equal(calls.length,beforeGuest,'Guest quick match uses no private online RPC');
    await page.screenshot({path:'artifacts/football-arena/guest-results.png'});

  }
  assert.deepEqual(errors,[]);await browser.close();
 }
 console.log('PASS browser: 320/390/1280 selection and results, all 32 teams, three automatic official kickoffs/drives, bridge source/token validation, exact save retry, offensive comparison, history and standings.');
}catch(error){
 const prefix=`artifacts/football-arena/failure-${currentWidth||'startup'}`;
 if(currentPage&&!currentPage.isClosed()){
  await currentPage.screenshot({path:prefix+'.png',fullPage:true,timeout:10000}).catch(()=>{});
  const frames=await Promise.all(currentPage.frames().map(async frame=>{
   try{return await frame.evaluate(()=>({url:location.href,title:document.title,text:document.body?.innerText,loading:document.querySelector('#loading')?.outerHTML,unitStatus:document.querySelector('#unitStatus')?.outerHTML,observedKickoffs:window.bkObservedKickoffs,visibleButtons:[...document.querySelectorAll('button')].filter(button=>button.getBoundingClientRect().width&&button.getBoundingClientRect().height).map(button=>({id:button.id,text:button.innerText,disabled:button.disabled})),diagnostics:typeof window.bk3dDiagnostics==='function'?window.bk3dDiagnostics():null}));}
   catch(reason){return {url:frame.url(),error:String(reason)};}
  }));
  await writeFile(prefix+'.json',JSON.stringify({failure:String(error.stack||error),width:currentWidth,calls:currentCalls,pageErrors:currentErrors,consoleErrors,networkFailures,frames},null,2)).catch(()=>{});
 }
 throw error;
}finally{await browser?.close();await server.close();}
