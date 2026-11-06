import assert from 'node:assert/strict';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';

// Remote CI only. Real draft UI, context and Supabase HTTP adapters; a shared
// in-memory authority and controlled realtime transport replace every backend.
// This proves two isolated browser contexts, not two real authenticated users.
const base='http://127.0.0.1:4189',artifacts='artifacts/fantasy-draft-reconnect';
const stem=`__bk_draft_reconnect_${process.pid}`,html=`${stem}.html`,entry=`${stem}.tsx`;
const stamp=new Date().toISOString(),leagueId='qa-shared-draft';
const users=Array.from({length:6},(_,index)=>({id:`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`,aud:'authenticated',role:'authenticated',email:`manager-${index}@example.invalid`,is_anonymous:false,user_metadata:{name:`Fixture Manager ${index}`,full_name:`Fixture Manager ${index}`},app_metadata:{provider:'email',providers:['email']},created_at:stamp}));
const members=users.map((user,index)=>({id:`fixture-member-${index}`,league_id:leagueId,auth_user_id:user.id,user_name:user.user_metadata.name,is_commissioner:index===0,is_ai:false,status:'building',roster:[]}));
const league={id:leagueId,name:'Isolated shared draft',code:'BK-FIXTURE',max_members:6,salary_cap:200,commissioner_auth_id:users[0].id,commissioner_name:users[0].user_metadata.name,status:'drafting',created_at:stamp,settings:{rosterSize:15,scoringFormat:'ppr',nflSeason:2026}};
let draft={league_id:leagueId,status:'active',rounds:15,pick_index:0,order_member_ids:members.map(member=>member.id),picks:[],started_at:stamp,updated_at:stamp,pick_seconds:60,pick_started_at:stamp,pick_deadline_at:new Date(Date.now()+600_000).toISOString(),recovery_enabled:true};
const appLeague=()=>({...league,maxMembers:6,salaryCap:200,commissionerId:league.commissioner_auth_id,commissionerName:league.commissioner_name,createdAt:stamp,members:members.map(member=>({id:member.id,userId:member.auth_user_id,userName:member.user_name,isCommissioner:member.is_commissioner,isAi:false,status:member.status,roster:[]})),liveDraft:{leagueId,status:draft.status,rounds:15,pickIndex:draft.pick_index,orderMemberIds:draft.order_member_ids,picks:draft.picks,startedAt:stamp,updatedAt:draft.updated_at,pickSeconds:60,pickStartedAt:draft.pick_started_at,pickDeadlineAt:draft.pick_deadline_at,recoveryEnabled:true}});
const onClock=()=>{const round=Math.floor(draft.pick_index/6),slot=draft.pick_index%6;return draft.order_member_ids[round%2===0?slot:5-slot];};
const calls=[],contexts=[],pages=[],errors=[],pendingClaims=[];
let players=[],server,browser;
const broadcast=async()=>{await Promise.all(pages.map(page=>page.evaluate(()=>window.__BK_QA_TRANSPORT?.event('ball_knower_live_drafts'))));};
const commitPick=(player,source)=>{
 const index=draft.pick_index,now=new Date().toISOString();
 draft={...draft,pick_index:index+1,picks:[...draft.picks,{overall:index+1,round:Math.floor(index/6)+1,memberId:onClock(),playerId:player.id,group:player.group,pickedAt:now,source}],updated_at:now,pick_started_at:now,pick_deadline_at:new Date(Date.now()+600_000).toISOString()};
};
const tokenFor=user=>[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+7200})).toString('base64url'),'fixture-only'].join('.');

async function newManager(index){
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 contexts.push(context);const page=await context.newPage();pages.push(page);
 page.on('pageerror',error=>errors.push({manager:index,error:error.message}));
 const user=users[index],session={user,access_token:tokenFor(user),refresh_token:'isolated-fixture',token_type:'bearer',expires_in:7200,expires_at:Math.floor(Date.now()/1000)+7200};
 await context.addInitScript(({session,league})=>{
  localStorage.setItem('sb-gpnboygoosrmeydwjpvk-auth-token',JSON.stringify(session));
  localStorage.setItem('ballknower_user_v1',JSON.stringify({id:session.user.id,name:session.user.user_metadata.name,email:session.user.email,createdAt:session.user.created_at}));
  localStorage.setItem('ballknower_leagues_v1',JSON.stringify([league]));localStorage.setItem('ballknower_active_league_id_v1',league.id);
 },{session,league:appLeague()});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url()),method=route.request().method(),path=url.pathname;
  if(url.origin===base)return route.continue();
  if(!url.hostname.endsWith('.supabase.co'))return route.fulfill({status:200,contentType:route.request().resourceType()==='image'?'image/svg+xml':'text/plain',body:route.request().resourceType()==='image'?'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>':''});
  const send=(body,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'},body:JSON.stringify(body)});
  if(method==='OPTIONS')return send({});
  if(path.startsWith('/auth/'))return send(path==='/auth/v1/user'?user:session);
  if(path.endsWith('/rpc/make_ball_knower_live_draft_pick')){
   const body=route.request().postDataJSON(),player=players.find(candidate=>candidate.id===body.p_player_id);
   const failure=body.p_league_id!==leagueId?'Unknown fixture league.':!player||body.p_group!==player.group?'Invalid fixture player.':draft.picks.some(pick=>pick.playerId===player.id)?'That player was already drafted.':members.find(member=>member.auth_user_id===user.id)?.id!==onClock()?'Another manager is on the clock.':null;
   calls.push({actor:index,action:'manual',playerId:body.p_player_id,accepted:!failure});
   if(failure)return send({message:failure},409);
   commitPick(player,'manual');await new Promise(resolve=>setTimeout(resolve,120));await send(draft);await broadcast();return;
  }
  if(path.endsWith('/rpc/claim_ball_knower_expired_draft_pick')){
   const body=route.request().postDataJSON();pendingClaims.push({send,body,index});
   // Release both claimants together so a fixture success cannot hide a race.
   if(pendingClaims.length<2)return;
   for(const claim of pendingClaims.splice(0)){
    const advanced=claim.body.p_league_id===leagueId&&claim.body.p_expected_pick_index===draft.pick_index&&Date.parse(draft.pick_deadline_at)<=Date.now();
    calls.push({actor:claim.index,action:'timeout',expected:claim.body.p_expected_pick_index,advanced});
    if(advanced)commitPick(players.find(player=>!draft.picks.some(pick=>pick.playerId===player.id)),'autopick');
    await claim.send(draft);
   }
   await broadcast();return;
  }
  if(method!=='GET'){calls.push({actor:index,action:'unexpected-write',path});return send({message:'Unexpected fixture mutation.'},403);}
  if(path.endsWith('/ball_knower_leagues'))return send(url.searchParams.get('id')?.startsWith('eq.')?league:[league]);
  if(path.endsWith('/ball_knower_league_members'))return send(url.searchParams.has('auth_user_id')?[{league_id:leagueId}]:members);
  if(path.endsWith('/ball_knower_live_drafts'))return send([draft]);
  if(path.endsWith('/ball_knower_user_profiles')||path.endsWith('/ball_knower_draft_preferences'))return send(null);
  return send([]);
 });
 await page.goto(`${base}/${html}`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.querySelector('#qa-draft-state')?.textContent?.includes('"pickIndex":0'));
 return page;
}

try{
 await mkdir(artifacts,{recursive:true});
 await writeFile(html,`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/${entry}"></script></body></html>`);
 await writeFile(entry,`
import React from 'react';import {createRoot} from 'react-dom/client';
import {BallKnowerProvider,useBallKnower} from './BallKnowerContext';import {LeagueLiveDraftRoom} from './LeagueLiveDraftRoom';
import {PLAYERS_DATABASE} from './players';import {getLiveFantasyDraftGroup} from './liveFantasyRules';import './index.css';
const w=window as any;w.__BK_QA_PLAYERS=PLAYERS_DATABASE.flatMap(player=>{const group=getLiveFantasyDraftGroup(player);return group?[{id:player.id,name:player.name,group}]:[]});
function Observe(){const state=useBallKnower();w.__BK_QA_CONTEXT=state;return <><output id="qa-draft-state" hidden>{JSON.stringify({userId:state.currentUser?.id,pickIndex:state.activeLeague?.liveDraft?.pickIndex,picks:state.activeLeague?.liveDraft?.picks})}</output><p role="status">{state.cloudSyncError||state.toastMessage}</p><LeagueLiveDraftRoom onBackToLobby={()=>{}}/></>};
createRoot(document.getElementById('root')!).render(<BallKnowerProvider><Observe/></BallKnowerProvider>);`);
 server=await createServer({configFile:'vite.config.ts',server:{host:'127.0.0.1',port:4189,strictPort:true},plugins:[{
  name:'isolated-realtime-transport',enforce:'pre',
  resolveId(source){if(source==='./supabase')return '\0bk-qa-supabase-transport';},
  load(id){if(id==='\0bk-qa-supabase-transport')return `
import * as actual from '/supabase.ts?fixture-original';export * from '/supabase.ts?fixture-original';
const channels=[];let connected=true;const w=window;
w.__BK_QA_TRANSPORT={disconnect(){connected=false;channels.forEach(c=>c.status?.('CHANNEL_ERROR'));},rejoin(){connected=true;channels.forEach(c=>c.status?.('SUBSCRIBED'));},event(table){if(connected)channels.forEach(c=>c.bindings.filter(b=>b.filter.table===table).forEach(b=>b.callback({})));}};
export const supabase=actual.supabase?new Proxy(actual.supabase,{get(target,key){if(key==='channel')return()=>{const c={bindings:[],on(event,filter,callback){c.bindings.push({filter,callback});return c;},subscribe(callback){c.status=callback;channels.push(c);queueMicrotask(()=>callback?.('SUBSCRIBED'));return c;}};return c;};if(key==='removeChannel')return c=>{const i=channels.indexOf(c);if(i>=0)channels.splice(i,1);return Promise.resolve('ok');};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}}):null;`;
  },
 }]});await server.listen();browser=await chromium.launch({headless:true});
 const a=await newManager(0),b=await newManager(1);players=await a.evaluate(()=>window.__BK_QA_PLAYERS);
 const state=page=>page.locator('#qa-draft-state').textContent().then(value=>JSON.parse(value));
 const waitIndex=(page,index)=>page.waitForFunction(expected=>JSON.parse(document.querySelector('#qa-draft-state').textContent).pickIndex===expected,index);
 assert.equal((await state(a)).userId,users[0].id);assert.equal((await state(b)).userId,users[1].id);
 assert.notEqual(await a.evaluate(()=>localStorage.getItem('sb-gpnboygoosrmeydwjpvk-auth-token')),await b.evaluate(()=>localStorage.getItem('sb-gpnboygoosrmeydwjpvk-auth-token')),'contexts must have isolated identities/storage');
 await b.evaluate(()=>window.__BK_QA_TRANSPORT.disconnect());
 const pickButton=a.getByRole('button').filter({hasText:/DRAFT$/}).first();await pickButton.waitFor();
 await pickButton.evaluate(button=>{button.click();button.click();});await waitIndex(a,1);
 assert.equal(calls.filter(call=>call.action==='manual').length,1,'actual UI must suppress a rapid duplicate submission');assert.equal((await state(b)).pickIndex,0,'disconnected manager intentionally misses the row event');
 await b.evaluate(()=>window.__BK_QA_TRANSPORT.rejoin());await waitIndex(b,1);
 assert.equal((await state(b)).picks[0].playerId,draft.picks[0].playerId,'rejoin must load the missed authoritative pick without a later event');
 const draftedName=players.find(player=>player.id===draft.picks[0].playerId).name;
 await b.getByPlaceholder('Search players…').fill(draftedName);assert.equal(await b.getByRole('button').filter({hasText:/DRAFT$/}).count(),0,'reconnected list cannot offer the already drafted player');
 await b.getByPlaceholder('Search players…').fill('');await b.getByRole('button').filter({hasText:/DRAFT$/}).first().click();await waitIndex(b,2);await waitIndex(a,2);
 const staleId=draft.picks[0].playerId;
 const staleAccepted=await a.evaluate(({leagueId,playerId})=>window.__BK_QA_CONTEXT.makeLiveFantasyDraftPick(leagueId,{id:playerId,position:window.__BK_QA_PLAYERS.find(p=>p.id===playerId).group}),{leagueId,playerId:staleId});
 assert.equal(staleAccepted,false,'server rejection must be surfaced by the actual context/adapter');assert.equal(draft.pick_index,2);assert.equal(new Set(draft.picks.map(pick=>pick.playerId)).size,2);
 await b.reload({waitUntil:'networkidle'});await waitIndex(b,2);assert.deepEqual((await state(b)).picks,draft.picks,'refresh must preserve the same shared ledger');
 draft={...draft,pick_deadline_at:new Date(Date.now()-1000).toISOString()};await broadcast();await waitIndex(a,3);await waitIndex(b,3);
 const claims=calls.filter(call=>call.action==='timeout');assert.equal(claims.length,2);assert.ok(claims.every(claim=>claim.expected===2));assert.equal(claims.filter(claim=>claim.advanced).length,1,'simultaneous expected-index claims advance once');
 assert.equal(draft.picks.length,3);assert.equal(new Set(draft.picks.map(pick=>pick.playerId)).size,3);assert.deepEqual(errors,[]);assert.equal(calls.filter(call=>call.action==='unexpected-write').length,0);
 for(const [index,page]of pages.entries()){assert.equal(await page.locator('html').evaluate(node=>node.scrollWidth<=innerWidth+1),true);await page.screenshot({path:`${artifacts}/manager-${index}-reconciled.png`,fullPage:true});}
 await writeFile(`${artifacts}/results.json`,JSON.stringify({source:'Isolated synthetic users, shared fixture authority, actual UI/context/Supabase HTTP adapters, controlled realtime status transport',realAccounts:false,productionRequests:0,productionWrites:0,physicalIphone:false,reconnectWithoutNewEvent:true,duplicateClickSuppressed:true,stalePickRejected:true,refreshPreservesLedger:true,simultaneousTimeoutAdvancesOnce:true,calls,picks:draft.picks},null,2));
 console.log('Two-context fixture draft reconnect checks passed; no real accounts or production traffic.');
}catch(error){
 await mkdir(artifacts,{recursive:true});await writeFile(`${artifacts}/failure.json`,JSON.stringify({error:String(error),errors,calls,draft,pendingClaims:pendingClaims.length},null,2));
 for(const [index,page]of pages.entries())await page.screenshot({path:`${artifacts}/manager-${index}-failure.png`,fullPage:true}).catch(()=>{});
 throw error;
}finally{for(const context of contexts)await context.close();await browser?.close();await server?.close();await rm(html,{force:true});await rm(entry,{force:true});}
