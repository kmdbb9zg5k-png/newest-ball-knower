import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium, webkit } from 'playwright';
const base='http://127.0.0.1:4188',out='artifacts/fantasy-hq-gold';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4188','--strictPort'],{stdio:'inherit'});
const userId='22222222-2222-4222-8222-222222222222',stamp='2026-09-08T12:00:00Z';
const rankingRows=['QB','RB','WR','TE','K','DST'].flatMap((position,g)=>Array.from({length:100},(_,i)=>({player_key:`qa-${position}-${i}`,player_name:`QA ${position} ${i}`,team:'PHI',position,overall_rank:i*6+g+1,adp:i*6+g+1,position_rank:i+1,actual_points_2025:100,projected_points_2026:200-i,point_change:100-i,projection_reason:'Explicit browser fixture',actual_source_name:'QA fixture',actual_source_url:'https://example.invalid',projection_source_name:'QA fixture',projection_source_url:null,projection_model:'QA',updated_at:stamp})));
const members=Array.from({length:10},(_,i)=>({id:`m${i}`,userId:i===0?userId:`qa-${i}`,userName:i===0?'Elijah':`Manager ${i}`,isCommissioner:i===0,status:'ready',roster:Array.from({length:15},(_,j)=>({id:`qa-${i}-${j}`,name:`QA Player ${i}-${j}`,team:'PHI',teamCity:'Philadelphia',position:['QB','RB','RB','WR','WR','TE','WR','K','DST','RB','WR','TE','QB','RB','WR'][j],salary:0,ovr:50,attributes:{athleticism:50,footballIQ:50}}))}));
const leagues=[{id:'qa-golden-arm',name:'Golden Arm League',code:'BK-QATEST',commissionerId:userId,commissionerName:'Greg',maxMembers:10,salaryCap:200,status:'drafting',createdAt:stamp,settings:{rosterSize:15,scoringFormat:'ppr',regularSeasonWeeks:14,nflSeason:2026},members}, {id:'qa-second',name:'Sunday Night League',code:'BK-SECOND',commissionerId:userId,commissionerName:'Elijah',maxMembers:10,salaryCap:200,status:'drafting',createdAt:stamp,settings:{rosterSize:15,scoringFormat:'half_ppr',regularSeasonWeeks:14,nflSeason:2026},members}];
const draft={league_id:leagues[0].id,status:'completed',rounds:15,pick_index:150,order_member_ids:['m1','m2','m0','m3','m4','m5','m6','m7','m8','m9'],picks:Array.from({length:150},(_,i)=>({overall:i+1,round:Math.floor(i/10)+1,memberId:`m${i%10}`,playerId:`qa-pick-${i}`,group:'WR',pickedAt:stamp,source:'manual'})),started_at:stamp,completed_at:stamp,updated_at:stamp,pick_seconds:60};
let browser,activePage;const results=[];
try{
 await mkdir(out,{recursive:true});let ready=false,lastProbe='No response';
 for(let i=0;i<100;i++){
  if(server.exitCode!==null)throw Error(`Preview exited ${server.exitCode}`);
  try{const response=await fetch(base);lastProbe=`HTTP ${response.status}`;if(response.ok){ready=true;break;}}catch(error){lastProbe=`${error.message}: ${error.cause?.message||''}`;}
  await new Promise(resolve=>setTimeout(resolve,200));
 }
 assert.ok(ready,`Preview did not become ready at ${base}: ${lastProbe}`);
 for(const engine of ['chromium','webkit']){
  browser=await(engine==='chromium'?chromium:webkit).launch({headless:true});
  for(const width of engine==='chromium'?[390,320,430,1280]:[390]){
   const context=await browser.newContext({viewport:{width,height:844},isMobile:width<768,hasTouch:width<768,reducedMotion:'reduce'});
   const page=await context.newPage();activePage=page;const crashes=[],mutations=[],backgroundPreferences=[];page.on('pageerror',e=>crashes.push(e.message));
   let empty=false,failScores=false,failActivity=false,activityContent=false;
   const userStateRows=new Map();
   const user={id:userId,aud:'authenticated',role:'authenticated',email:'qa@example.invalid',is_anonymous:false,user_metadata:{name:'Elijah',full_name:'Elijah'},app_metadata:{provider:'email',providers:['email']},created_at:stamp};
   const token=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:userId,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+86400})).toString('base64url'),'fixture-only'].join('.');
   const session={user,access_token:token,refresh_token:'fixture-only',token_type:'bearer',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400};
   await page.route('**/*.supabase.co/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname,method=route.request().method();const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'};
    const send=(body,status=200)=>route.fulfill({status,contentType:'application/json',headers,body:JSON.stringify(body)});
    if(method==='OPTIONS')return send({});
    if(path.startsWith('/auth/'))return send(path==='/auth/v1/user'?user:session);
    if(method!=='GET'){
     const payload=route.request().postDataJSON();
     const writes=Array.isArray(payload)?payload:[payload];
     // The unchanged SoundtrackContext debounces this preference write by 500ms.
     // Count every other non-GET request; never ignore league, draft, or roster writes.
     const soundtrackPreference=path.endsWith('/ball_knower_user_state')&&writes.length>0&&writes.every(row=>row?.state_key==='soundtrack_preferences');
     (soundtrackPreference?backgroundPreferences:mutations).push(path);
    }
    if(path.endsWith('/ball_knower_user_state')){
     // Mirror PostgREST upsert-return semantics so the existing cloud provider
     // acknowledges startup preferences rather than retrying unacknowledged rows.
     if(method==='POST'){
      const payload=route.request().postDataJSON(),rows=(Array.isArray(payload)?payload:[payload]).map(row=>({...row,updated_at:stamp}));
      for(const row of rows)userStateRows.set(row.state_key,row);
      return send(rows);
     }
     const filter=url.searchParams.get('state_key')||'';
     const rows=[...userStateRows.values()].filter(row=>!filter||filter===`eq.${row.state_key}`||(filter.startsWith('in.')&&filter.includes(row.state_key)));
     return send(filter.startsWith('eq.')?rows[0]||null:rows);
    }
    if(path.endsWith('/ball_knower_fantasy_rankings'))return send(rankingRows.filter(r=>r.position!=='DST'));
    if(path.endsWith('/ball_knower_leagues')){
     const rows=(empty?[]:leagues).filter(l=>!url.searchParams.get('id')?.startsWith('eq.')||url.searchParams.get('id')===`eq.${l.id}`).map(l=>({id:l.id,name:l.name,code:l.code,max_members:l.maxMembers,salary_cap:l.salaryCap,commissioner_auth_id:l.commissionerId,commissioner_name:l.commissionerName,status:l.status,created_at:l.createdAt,settings:l.settings}));
     return send(url.searchParams.get('id')?.startsWith('eq.')?rows[0]||null:rows);
    }
    if(path.endsWith('/ball_knower_league_members')){
     if(url.searchParams.get('auth_user_id'))return send(empty?[]:leagues.map(l=>({league_id:l.id})));
     const query=url.searchParams.get('league_id')||'';return send((empty?[]:leagues).filter(l=>!query||query.includes(l.id)).flatMap(l=>l.members.map(m=>({id:m.id,league_id:l.id,auth_user_id:m.userId,user_name:m.userName,is_commissioner:m.isCommissioner,status:m.status,roster:m.roster}))));
    }
    if(path.endsWith('/ball_knower_live_drafts'))return send(empty?[]:[draft].filter(d=>(url.searchParams.get('league_id')||'').includes(d.league_id)));
    if(path.endsWith('/ball_knower_weekly_scores'))return failScores?send({message:'Fixture score outage'},503):send([1,2].flatMap(week=>members.map((m,i)=>({league_id:leagues[0].id,member_id:m.id,week_number:week,live_points:i===0?0:80-i,projected_points:120-i,is_final:week===2,score_details:{hasProjectedTotal:i!==8,players:[]},updated_at:stamp}))));
    if(path.endsWith('/ball_knower_transactions'))return failActivity?send({message:'Fixture activity outage'},503):send(activityContent?[{id:'qa-txn',summary:'QA trade receipt',created_at:stamp}]:[]);
    if(path.endsWith('/ball_knower_league_messages'))return send(activityContent?[{id:'qa-notice',body:'QA commissioner announcement',kind:'announcement',created_at:stamp},{id:'qa-chat',body:'QA chat must not appear here',kind:'chat',created_at:stamp}]:[]);
    if(path.includes('join_or_create_ball_knower_public_league'))return send({message:'Explicit public-matchmaking fixture outage'},503);
    if(path.endsWith('/ball_knower_user_profiles'))return send(null);
    if(path.endsWith('/rpc/ensure_ball_knower_progress_profile'))return send([{user_id:userId,display_name:'Elijah',bk_rating:50,xp:0,level:1}]);
    if(path.includes('/rpc/'))return send(null);
    return send([]);
   });
   if(page.routeWebSocket)await page.routeWebSocket(/supabase\.co/,socket=>socket.close());
   await page.route('**/_vercel/**',r=>r.fulfill({status:200,body:''}));
   await page.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(path==='/api/media'?{tracks:[],introUrl:null}:path==='/api/nfl-news'?{available:true,articles:[{id:'qa',url:'https://example.invalid',headline:'Fantasy HQ visual test — fixture headline',source:'QA',image:null}]}:{ok:true})});});
   await page.addInitScript(({user,session,leagues})=>{localStorage.setItem('sb-gpnboygoosrmeydwjpvk-auth-token',JSON.stringify(session));localStorage.setItem('ballknower_user_v1',JSON.stringify({id:user.id,name:'Elijah',email:user.email,createdAt:user.created_at}));localStorage.setItem('ballknower_leagues_v1',JSON.stringify(leagues));localStorage.setItem('ballknower_active_league_id_v1',leagues[0].id);for(const [k,v]of Object.entries({'ball-knower-team-setup-v2':'complete','ball-knower-intro-completed-v1':'1','ball-knower-favorite-team':'Philadelphia Eagles','ball-knower-intro-sound-v1':'off','bk-guide-fantasy-hq-v3':'seen'}))localStorage.setItem(k,v);},{user,session,leagues});
   await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('.bk-home-stadium').waitFor();
   const go=async name=>{for(const b of await page.getByRole('button',{name,exact:true}).all())if(await b.isVisible()){await b.click();return;}throw Error(`Missing ${name}`);};
   await go('Fantasy');await page.locator('.bk-hq-premium').waitFor();await page.getByText('Draft complete',{exact:true}).first().waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(300);
   assert.equal(await page.getByTestId('fantasy-tool-grid').locator('button').count(),5);
   assert.equal(await page.locator('.bk-fantasy-league-pair').count(),2);
   assert.match(await page.locator('.bk-hq-league-status-panel').first().innerText(),/#3/);
   assert.equal(await page.locator('.bk-fantasy-league-facts').first().getByText('15 drafted',{exact:true}).count(),1);
   const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,hero:document.querySelector('.bk-fantasy-hq-hero').getBoundingClientRect().height,tools:[...document.querySelectorAll('[data-testid="fantasy-tool-grid"] button')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height,width:r.width};})}));
   assert.ok(bounds.scroll<=width+1);assert.ok(bounds.tools.every(b=>b.left>=0&&b.right<=width+1&&b.height>=44&&b.width>=44));if(width<640)assert.ok(bounds.hero<=210);
   await writeFile(`${out}/${engine}-${width}-geometry.json`,JSON.stringify(bounds,null,2));await page.screenshot({path:`${out}/${engine}-${width}-hq.png`});await page.screenshot({path:`${out}/${engine}-${width}-full.png`,fullPage:true});
   await page.getByRole('button',{name:'My Leagues (2)',exact:true}).click();let dialog=page.getByRole('dialog',{name:'My Leagues',exact:true});await dialog.waitFor();assert.equal(await dialog.locator('.bk-hq-league-list button').count(),2);await dialog.getByRole('button',{name:'Close My Leagues'}).click();
   await page.getByTestId('fantasy-tool-grid').getByRole('button',{name:/Draft Simulation/}).click();dialog=page.getByRole('dialog',{name:'Draft Simulation',exact:true});await dialog.waitFor();await dialog.getByRole('button',{name:'Run draft simulation',exact:true}).waitFor();const before=mutations.length;const savedLeagues=await page.evaluate(()=>localStorage.getItem('ballknower_leagues_v1'));
   await dialog.getByRole('button',{name:'Run draft simulation',exact:true}).click();await dialog.getByRole('button',{name:'Run another simulation',exact:true}).waitFor();assert.equal(await dialog.locator('.bk-hq-mock-picks li').count(),150);await dialog.getByRole('button',{name:'Run another simulation',exact:true}).click();assert.equal(mutations.length,before,`Practice must not perform backend writes: ${JSON.stringify(mutations.slice(before))}`);assert.equal(await page.evaluate(()=>localStorage.getItem('ballknower_leagues_v1')),savedLeagues,'Practice must not change saved league state');await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
   await page.getByTestId('fantasy-tool-grid').getByRole('button',{name:/Matchup Analyzer/}).click();dialog=page.getByRole('dialog',{name:'Matchup Analyzer',exact:true});await dialog.locator('.bk-hq-matchup').first().waitFor();assert.equal(await dialog.locator('.bk-hq-matchup').count(),5);assert.match(await dialog.innerText(),/0\.0/);assert.match(await dialog.innerText(),/—/);await dialog.getByLabel('Week',{exact:true}).selectOption('2');await dialog.getByText('Final',{exact:true}).first().waitFor();
   failScores=true;await dialog.getByLabel('Week',{exact:true}).selectOption('3');await dialog.getByRole('alert').waitFor();failScores=false;await dialog.getByRole('button',{name:'Retry matchups'}).click();await dialog.locator('.bk-hq-matchup').first().waitFor();await dialog.getByRole('button',{name:'Close Matchup Analyzer'}).click();
   failActivity=true;await page.getByRole('navigation',{name:'Fantasy views'}).getByRole('button',{name:'Cheat Sheet',exact:true}).click();await page.getByRole('heading',{name:'Player Cheat Sheet'}).waitFor();assert.equal(await page.locator('.bk-hq-premium').count(),0);await page.getByRole('navigation',{name:'Fantasy views'}).getByRole('button',{name:'League HQ',exact:true}).click();
   await page.locator('.bk-hq-activity [role=alert]').waitFor();failActivity=false;activityContent=true;await page.getByRole('button',{name:'Retry activity',exact:true}).click();await page.getByText('QA trade receipt',{exact:true}).waitFor();assert.equal(await page.locator('.bk-hq-activity li').count(),2);assert.doesNotMatch(await page.locator('.bk-hq-activity').innerText(),/QA chat must not appear/);
   await page.getByTestId('fantasy-tool-grid').locator('button').nth(0).click();await page.locator('#close-create-league-modal-btn').waitFor();await page.locator('#close-create-league-modal-btn').click();
   await page.getByTestId('fantasy-tool-grid').locator('button').nth(1).click();await page.locator('#close-join-league-modal-btn').waitFor();await page.locator('#close-join-league-modal-btn').click();
   await page.locator('.bk-hq-public-tool').click();await page.locator('.bk-fantasy-public-error').waitFor();assert.ok(mutations.some(path=>path.includes('join_or_create_ball_knower_public_league')),'Public matchmaking must retain its existing RPC path');
   await page.getByRole('navigation',{name:'Fantasy views'}).getByRole('button',{name:'How it works',exact:true}).click();await page.getByRole('dialog',{name:'Fantasy instructions'}).waitFor();await page.getByRole('button',{name:'Close instructions'}).click();
   assert.deepEqual(crashes,[]);results.push({engine,width,bounds,initialLeagues:2,tools:5,mockPicks:150,matchups:5,activityRecovery:true,createJoinEntrypoints:true,publicMatchmakingError:true,backgroundPreferenceWrites:backgroundPreferences.length,source:'Isolated account/rankings/scores fixtures',productionMutations:false,physicalIphone:false});await context.close();activePage=null;
  }
  await browser.close();browser=null;
 }
 await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));console.log('Fantasy HQ gold browser checks passed in Chromium 320/390/430/1280 and WebKit390.');
}catch(error){let body='';if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:`${out}/failure.png`,fullPage:true}).catch(()=>{});body=await activePage.locator('body').innerText().catch(()=>'');}await mkdir(out,{recursive:true});await writeFile(`${out}/failure.txt`,`${error.stack||error}\n${body}`);throw error;}finally{await browser?.close();server.kill('SIGTERM');}
