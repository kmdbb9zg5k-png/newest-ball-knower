import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'vite';
import { chromium } from 'playwright';

// Real components + fixture HTTP responses. No requests are allowed to reach
// production Supabase, and no QA route is added to the shipped application.
const base='http://127.0.0.1:4175';
const stem=`__bk_reconciliation_${process.pid}`;
const html=`${stem}.html`;
const entry=`${stem}.tsx`;
const artifacts='artifacts/fantasy-reconciliation';
const fixtureUser={id:'00000000-0000-4000-8000-000000000099',aud:'authenticated',role:'authenticated',is_anonymous:true,app_metadata:{provider:'anonymous'},user_metadata:{},created_at:'2026-09-01T00:00:00Z'};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:fixtureUser.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+7200})}.fixture-only`;
const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR42mP8z8AARAwMjDAGAC0KA/2BHvtYAAAAAElFTkSuQmCC','base64');
let server;
let browser;
const failures=[];
await mkdir(artifacts,{recursive:true});
await writeFile(html,`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body><div id="root"></div><script type="module" src="/${entry}"></script></body></html>`);
await writeFile(entry,`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {LeagueLiveDraftRoom} from './LeagueLiveDraftRoom';
import {FantasyPlayerDetail} from './FantasyPlayerDetail';
import {PLAYERS_DATABASE} from './players';
import {getLiveFantasyDraftGroup} from './liveFantasyRules';
import './index.css';
const w=window as any;
const view=new URLSearchParams(location.search).get('view')||'draft';
const positions=['QB','RB','RB','WR','WR','TE','RB','K','DST','WR','WR','QB','TE','RB','WR'];
const used=new Set();const picks:any[]=[];const rankings:any[]=[];
const members=Array.from({length:6},(_,index)=>{
 const id='qa-member-'+index;
 const roster=positions.map((position,round)=>{
  const player=PLAYERS_DATABASE.find(p=>getLiveFantasyDraftGroup(p)===position&&!used.has(p.id))!;
  if(!player)throw new Error('Fixture player pool incomplete for '+position);
  used.add(player.id);const overall=picks.length+1;
  picks.push({overall,round:round+1,memberId:id,playerId:player.id,group:position,pickedAt:'2026-09-01T00:00:00Z',source:'manual'});
  rankings.push({player_name:player.name,team:player.team,position,overall_rank:overall,adp:overall,position_rank:index+1,projected_points_2026:320-round*9+index*3,actual_points_2025:null});
  return player;
 });
 return {id,userId:index===0?'${fixtureUser.id}':'qa-user-'+index,userName:index===0?'Regression Manager':'Regression Opponent '+index,isCommissioner:index===0,isAi:false,status:'ready',roster,userAvatar:'data:image/png;base64,${tinyPng.toString('base64')}'};
});
w.__BK_QA_RANKINGS=rankings;
w.__BK_QA_BACK=0;w.__BK_QA_ACTION=0;
w.__BK_QA_CONTEXT={currentUser:{id:'${fixtureUser.id}',name:'Regression Manager'},activeLeague:{id:'qa-reconciliation',name:'QA Only',commissionerId:'${fixtureUser.id}',status:'drafting',settings:{regularSeasonWeeks:14,playoffTeams:6},members,liveDraft:{leagueId:'qa-reconciliation',status:'completed',orderMemberIds:members.map(m=>m.id),picks,pickIndex:picks.length,rounds:15,recoveryEnabled:true}},makeLiveFantasyDraftPick:()=>{throw new Error('Unexpected live pick')},finalizeLiveFantasyDraftRosters:()=>{throw new Error('Unexpected finalize')},resumeLiveFantasyDraftRecovery:()=>{throw new Error('Unexpected recovery')},claimExpiredLiveFantasyDraftPick:()=>{throw new Error('Unexpected timeout claim')},showToast:()=>{}};
const player={id:'qa-player-'+view,name:'Regression '+view,team:'PHI',position:view,teamCity:'Philadelphia',teamName:'Regression',ovr:75,salary:1};
const ranking={projected_points_2026:170,actual_points_2025:210,overall_rank:12,position_rank:3,projection_reason:'Fixture projection',projection_model:'fixture',updated_at:'2026-09-01T00:00:00Z',adp:12} as any;
createRoot(document.getElementById('root')!).render(view==='draft'?<LeagueLiveDraftRoom onBackToLobby={()=>w.__BK_QA_BACK++}/>:<FantasyPlayerDetail player={player as any} ownerName="Other Manager" ranking={ranking} onClose={()=>w.__BK_QA_CLOSED=true} primaryAction={{label:'TRADE FOR REGRESSION '+view,onAction:()=>w.__BK_QA_ACTION++}}/>);
`);

const statFixtures={
 QB:{passingAttempts:34,passingCompletions:22,passingYards:250,passingTouchdowns:2,interceptionsThrown:1,rushingAttempts:4,rushingYards:25,rushingTouchdowns:0,fumblesLost:0},
 RB:{rushingAttempts:17,rushingYards:88,rushingTouchdowns:1,targets:6,receptions:4,receivingYards:35,receivingTouchdowns:0,fumblesLost:0},
 WR:{targets:11,receptions:7,receivingYards:102,receivingTouchdowns:1,rushingAttempts:0,rushingYards:0,rushingTouchdowns:0,fumblesLost:0},
 TE:{targets:8,receptions:5,receivingYards:62,receivingTouchdowns:1,rushingAttempts:0,rushingYards:0,fumblesLost:0},
 K:{fieldGoalsAttempted:4,fieldGoalsMade:3,fieldGoalsMissed:1,extraPointsAttempted:2,extraPointsMade:2,extraPointsMissed:0},
 DST:{sacks:4,interceptions:1,fumbleRecoveries:2,defensiveTouchdowns:0,returnTouchdowns:0,safeties:0,blockedKicks:0,pointsAllowed:13},
};
const expectedHeaders={QB:['Pass Att','Cmp','Pass Yds','Pass TD','INT','Rush Att','FL'],RB:['Rush Att','Targets','Rec TD','FL'],WR:['Targets','Rec','Rec Yds','Rec TD','FL'],TE:['Targets','Rec Yds','Rec TD','FL'],K:['FG Att','FG','FG Miss','XP Att','XP','XP Miss'],DST:['Sacks','INT','FR','DEF TD','Return TD','Safeties','Blk','Pts Allowed']};

try {
 server=await createServer({configFile:'vite.config.ts',server:{host:'127.0.0.1',port:4175,strictPort:true},plugins:[{
  name:'qa-context-only',enforce:'pre',
  resolveId(source){if(source==='./BallKnowerContext')return '\0bk-qa-context';},
  load(id){if(id==='\0bk-qa-context')return 'export const useBallKnower=()=>window.__BK_QA_CONTEXT;';},
 }]});
 await server.listen();
 browser=await chromium.launch({headless:true});
 for(const width of [320,390,430]) {
  for(const view of ['draft','QB','RB','WR','TE','K','DST']) {
   const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
   const page=await context.newPage();
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   let corrected=false;
   await page.addInitScript(({token,user})=>localStorage.setItem('sb-gpnboygoosrmeydwjpvk-auth-token',JSON.stringify({access_token:token,refresh_token:'fixture-refresh',expires_at:Math.floor(Date.now()/1000)+7200,expires_in:7200,token_type:'bearer',user})),{token,user:fixtureUser});
   await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin===base)return route.continue();
    if(!url.hostname.endsWith('.supabase.co')){
      return route.fulfill({status:200,contentType:route.request().resourceType()==='image'?'image/png':'text/plain',body:route.request().resourceType()==='image'?tinyPng:''});
    }
    let body=[];
    if(url.pathname.endsWith('/auth/v1/user'))body=fixtureUser;
    else if(url.pathname.includes('ball_knower_fantasy_rankings'))body=await page.evaluate(()=>window.__BK_QA_RANKINGS);
    else if(url.pathname.includes('ball_knower_nfl_games'))body=Array.from({length:18},(_,i)=>i+1).filter(week=>week!==8).map(week=>({provider_game_id:'fixture-game-'+week,season:2026,week_number:week,away_team:'PHI',home_team:'DAL',kickoff_at:new Date(Date.UTC(2026,8,6+(week-1)*7)).toISOString(),game_status:week===1?'Final':week===2?'In Progress':'Scheduled',is_final:week===1}));
    else if(url.pathname.includes('ball_knower_player_week_scores')){
     const stats=statFixtures[view]||{};
     const zero=Object.fromEntries(Object.keys(stats).map(key=>[key,key==='pointsAllowed'?21:0]));
     const row=(season,week,stat,points,final)=>({id:'fixture-'+season+'-'+week,provider_game_id:'fixture-game-'+week,provider_player_id:'fixture-provider-'+view,season,week_number:week,player_name:'Regression '+view,team:season===2025?'NE':'PHI',position:view,opponent_team:'DAL',is_home:false,kickoff_at:'2026-09-06T17:00:00Z',game_status:final?'Final':'In Progress',is_final:final,stats:stat,fantasy_points:{ppr:points},projected_points:{ppr:999},pregame_projected_points:{ppr:17.4},pregame_projection_captured_at:'2026-09-01T00:00:00Z',pregame_projection_source:'Fixture pregame',pregame_projection_reason:'Captured before kickoff'});
     body=[row(2026,1,zero,0,true),row(2026,2,stats,corrected?31.5:12.3,corrected),row(2025,1,stats,20,true)];
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
   });
   if(view==='QB'&&width===390)await page.clock.install();
   try {
   await page.goto(base+'/'+html+'?view='+view,{waitUntil:'networkidle'});
   if(view==='draft') {
    await page.locator('[data-testid="fantasy-draft-analysis"] summary').first().waitFor();
    assert.equal(await page.locator('[data-testid="fantasy-draft-analysis"]').count(),7,'all six managers plus the current-user summary need report details');
    assert.equal(await page.locator('[aria-label$="profile photo"]').count(),6,'newer manager photos must remain on every manager card');
    for(const summary of await page.locator('details summary').all())await summary.click();
    const button=page.getByRole('button',{name:'Continue To Season',exact:true});
    assert.equal(await button.isEnabled(),true);
    await button.click();assert.equal(await page.evaluate(()=>window.__BK_QA_BACK),1);
   } else {
    await page.getByRole('button',{name:'Game Log',exact:true}).click();
    await page.locator('tbody tr').first().waitFor();
    assert.equal(await page.locator('tbody tr').count(),18,'2026 must preserve all 18 week slots');
    const headings=await page.locator('thead th').allTextContents();
    for(const heading of expectedHeaders[view])assert.ok(headings.includes(heading),view+' missing '+heading);
    assert.equal(await page.locator('tbody tr').first().locator('td').nth(2).textContent(),'0.0','actual zero points must not become unavailable');
    assert.equal(await page.locator('tbody tr').nth(2).locator('td').nth(2).textContent(),'—','future actual points must remain unavailable');
    assert.equal(await page.locator('tbody tr').filter({hasText:'Bye'}).count(),1,'one verified bye must remain visible');
    assert.equal(await page.locator('tbody tr').nth(1).locator('td').nth(3).textContent(),'17.4','captured pregame projection must beat later mutable data');
    if(view==='QB'&&width===390){
     corrected=true;await page.clock.fastForward('00:31');
     await page.waitForFunction(()=>document.querySelectorAll('tbody tr')[1]?.querySelectorAll('td')[2]?.textContent==='31.5');
     assert.equal(await page.locator('tbody tr').nth(1).locator('td').nth(3).textContent(),'17.4','correction must not replace the pregame snapshot');
    }
    const scroll=page.locator('table').locator('..');
    await scroll.evaluate(element=>{element.scrollLeft=element.scrollWidth;});
    const last=await page.locator('thead th').last().boundingBox();
    assert.ok(last&&last.x+last.width<=width+1,'last stat category must be reachable by horizontal scrolling');
    const trade=page.getByRole('button',{name:'TRADE FOR REGRESSION '+view,exact:true});
    await trade.scrollIntoViewIfNeeded();await trade.click();assert.equal(await page.evaluate(()=>window.__BK_QA_ACTION),1,'opponent player trade action was lost');
    await page.getByRole('button',{name:'2025',exact:true}).click();
    assert.equal(await page.locator('tbody tr').count(),1,'prior-team history must stay attached to the same player');
    await page.getByRole('button',{name:'2026',exact:true}).click();
   }
   const dimensions=await page.evaluate(()=>({width:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
   assert.ok(dimensions.document<=width+1&&dimensions.body<=width+1,view+' overflow at '+width+'px: '+JSON.stringify(dimensions));
   assert.deepEqual(errors,[],view+' had uncaught errors');
   await page.screenshot({path:artifacts+'/'+width+'-'+view+'.png',fullPage:true});
   } catch (error) {
    await page.screenshot({path:artifacts+'/'+width+'-'+view+'-failure.png',fullPage:true}).catch(()=>{});
    await writeFile(artifacts+'/'+width+'-'+view+'-failure.txt',JSON.stringify({error:String(error),errors,body:await page.locator('body').innerText().catch(()=>'' )},null,2));
    failures.push({width,view,error:String(error)});
    console.error('Reconciliation case failed',width,view,String(error));
   } finally { await context.close(); }
  }
 }
 assert.deepEqual(failures,[],'All reconciliation cases must pass');
 console.log('Reconciliation browser checks passed: actual six-team completed draft cards, photos, disclosure and season navigation; QB/RB/WR/TE/K/DST tables at 320/390/430px; 2025 history; 2026 schedule/bye; zeros, trade actions, live correction and immutable pregame projections. All backend traffic was mocked.');
} finally {
 await browser?.close();await server?.close();
 await rm(html,{force:true});await rm(entry,{force:true});
}
