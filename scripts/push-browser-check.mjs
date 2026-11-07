import assert from 'node:assert/strict';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import webPush from 'web-push';

// Remote CI only. Render the actual settings sheet and App/providers against
// isolated HTTP fixtures. These are UI/routing proofs, not real delivery receipts.
const base='http://127.0.0.1:4193',artifacts='artifacts/push-notifications';
const stem=`__bk_push_${process.pid}`,html=`${stem}.html`,entry=`${stem}.tsx`;
const stamp=new Date().toISOString(),owner='00000000-0000-4000-8000-000000000101',notificationId='00000000-0000-4000-8000-000000000102';
const user={id:owner,email:'push-fixture@example.invalid',aud:'authenticated',role:'authenticated',is_anonymous:false,user_metadata:{name:'Push Fixture Manager',full_name:'Push Fixture Manager'},app_metadata:{provider:'email',providers:['email']},created_at:stamp};
const memberRows=Array.from({length:6},(_,index)=>({id:`push-member-${index}`,league_id:'push-fixture-league',auth_user_id:index===0?owner:`00000000-0000-4000-8000-${String(index+200).padStart(12,'0')}`,user_name:index===0?'Push Fixture Manager':`Fixture Opponent ${index}`,is_commissioner:index===0,is_ai:false,status:'ready',roster:[]}));
const draftRow={league_id:'push-fixture-league',status:'active',rounds:15,pick_index:0,order_member_ids:memberRows.map(member=>member.id),picks:[],started_at:stamp,updated_at:stamp,pick_seconds:60,pick_started_at:stamp,pick_deadline_at:new Date(Date.now()+600_000).toISOString(),recovery_enabled:true};
const draftOrder=memberRows.map((member,index)=>({memberId:member.id,pickNumber:index+1,wins:0,losses:0,totalPoints:0}));
const leagueRow={id:'push-fixture-league',name:'Push routing fixture',code:'PUSH-QA',max_members:6,salary_cap:200,commissioner_auth_id:owner,commissioner_name:user.user_metadata.name,status:'completed',created_at:stamp,settings:{rosterSize:15,scoringFormat:'ppr',nflSeason:2026,draftFormat:'live_snake',regularSeasonWeeks:15,playoffTeams:6,draftScheduledAt:stamp},season_result:{draftOrder,orderMethod:'random',games:[],standings:[],playoffGames:[]}};
const appLeague={...leagueRow,maxMembers:6,salaryCap:200,commissionerId:owner,commissionerName:user.user_metadata.name,createdAt:stamp,seasonResult:leagueRow.season_result,members:memberRows.map(member=>({id:member.id,userId:member.auth_user_id,userName:member.user_name,isCommissioner:member.is_commissioner,isAi:false,status:'ready',roster:[]})),liveDraft:{leagueId:leagueRow.id,status:'active',rounds:15,pickIndex:0,orderMemberIds:draftRow.order_member_ids,picks:[],startedAt:stamp,updatedAt:stamp,pickSeconds:60,pickStartedAt:stamp,pickDeadlineAt:draftRow.pick_deadline_at,recoveryEnabled:true}};
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const token=`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:owner,session_id:'00000000-0000-4000-8000-000000000103',role:'authenticated',exp:Math.floor(Date.now()/1000)+7200})}.fixture-only`;
const keys=webPush.generateVAPIDKeys();
let server,browser;
const results=[];
await mkdir(artifacts,{recursive:true});
await writeFile(html,`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body><div id="root"></div><script type="module" src="/${entry}"></script></body></html>`);
await writeFile(entry,`
import React from 'react';import {createRoot} from 'react-dom/client';
import App from './App';import {BallKnowerProvider} from './BallKnowerContext';import {FantasySettingsHub} from './FantasySettingsHub';import './index.css';
const settings=new URLSearchParams(location.search).get('view')==='settings';
createRoot(document.getElementById('root')!).render(settings?<BallKnowerProvider><FantasySettingsHub isOpen onClose={()=>{}} onOpenLeague={()=>{}} onManageLeague={()=>{}}/></BallKnowerProvider>:<App/>);
`);
async function newPage(viewport,{permission='default',configured=true,anonymous=false,foreign=false}={}){
 const context=await browser.newContext({viewport,isMobile:viewport.width<600,hasTouch:viewport.width<600,reducedMotion:'reduce'}),page=await context.newPage();
 const crashes=[],writes=[];let settings={quietEnabled:false,timeZone:'UTC',startMinute:1320,endMinute:420};
 page.on('pageerror',error=>crashes.push(error.message));
 const fixtureUser={...user,is_anonymous:anonymous};
 await context.addInitScript(({token,user,league,permission})=>{
   localStorage.setItem('sb-gpnboygoosrmeydwjpvk-auth-token',JSON.stringify({access_token:token,refresh_token:'synthetic-refresh',token_type:'bearer',expires_in:7200,expires_at:Math.floor(Date.now()/1000)+7200,user}));
   localStorage.setItem('ballknower_user_v1',JSON.stringify({id:user.id,name:user.user_metadata.name,email:user.email,isAnonymous:user.is_anonymous,createdAt:user.created_at}));
   localStorage.setItem('ballknower_leagues_v1',JSON.stringify([league]));localStorage.setItem('ballknower_active_league_id_v1',league.id);
   localStorage.setItem('ball-knower-intro-completed-v1','2');localStorage.setItem('ball-knower-team-setup-v2','1');localStorage.setItem('ball-knower-intro-sound-v1','off');
   window.__pushPermissionRequests=0;window.__pushNavigationMarker='same-page';
   if('Notification' in window){Object.defineProperty(Notification,'permission',{get:()=>permission,configurable:true});Notification.requestPermission=async()=>{window.__pushPermissionRequests++;return 'denied';};}
 },{token,user:fixtureUser,league:appLeague,permission});
 await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'},body:JSON.stringify(data)});
   if(url.origin===base&&path==='/api/push'){
     if(method==='GET'){
       if(url.searchParams.get('resource')==='config')return json({web:{ready:configured,publicKey:keys.publicKey},apns:{ready:false},android:{ready:false}});
       if(url.searchParams.get('resource')==='settings')return json(settings);
       if(url.searchParams.get('resource')==='devices')return json([]);
       if(url.searchParams.get('resource')==='notification')return foreign?json({error:'This notification is no longer available in your leagues.'},404):json({notificationId,leagueId:leagueRow.id,destination:'draft'});
     }
     const body=request.postDataJSON();writes.push(body);
     if(body.action==='installation')return json({epoch:null,revision:0});
     if(body.action==='settings')settings={quietEnabled:body.quietEnabled,timeZone:body.timeZone,startMinute:body.startMinute,endMinute:body.endMinute};
     return json(body.action==='settings'?settings:{ok:true,epoch:'00000000-0000-4000-8000-000000000104'});
   }
   if(url.origin===base&&path.startsWith('/api/'))return json({tracks:[],introUrl:null,articles:[],data:[]});
   if(url.origin===base)return route.continue();
   if(!url.hostname.endsWith('.supabase.co'))return route.fulfill({status:200,contentType:request.resourceType()==='image'?'image/svg+xml':'text/plain',body:request.resourceType()==='image'?'<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>':''});
   if(method==='OPTIONS')return json({});
   if(path.startsWith('/auth/'))return json(path==='/auth/v1/user'?fixtureUser:path.endsWith('/settings')?{external:{google:true,apple:true}}:{user:fixtureUser,access_token:token,refresh_token:'synthetic-refresh',expires_in:7200});
   if(path.endsWith('/rpc/get_my_ball_knower_notification_preferences'))return json(['draft','roster','transactions','league'].map(category=>({category,in_app_enabled:true,push_enabled:true})));
   if(path.endsWith('/rpc/save_my_ball_knower_notification_preference')){writes.push(request.postDataJSON());return json(null);}
   const single=(request.headers().accept||'').includes('vnd.pgrst.object');
   if(path.endsWith('/ball_knower_leagues'))return json(single?leagueRow:[leagueRow]);
   if(path.endsWith('/ball_knower_league_members'))return json(url.searchParams.has('auth_user_id')?[{league_id:leagueRow.id}]:memberRows);
   if(path.endsWith('/ball_knower_live_drafts'))return json(single?draftRow:[draftRow]);
   if(path.endsWith('/ball_knower_user_profiles')||path.endsWith('/ball_knower_draft_preferences'))return json(null);
   return json(single?null:[]);
 });
 return {context,page,crashes,writes,getSettings:()=>settings};
}
try{
 server=await createServer({configFile:'vite.config.ts',server:{host:'127.0.0.1',port:4193,strictPort:true}});await server.listen();
 browser=await chromium.launch({headless:true});
 for(const width of [320,390,1280]){
   const test=await newPage({width,height:900}),{page}=test;
   try{
     await page.goto(`${base}/${html}?view=settings`,{waitUntil:'domcontentloaded'});
     await page.getByRole('button',{name:'Alerts',exact:true}).click();
     const save=page.getByRole('button',{name:'Save quiet hours',exact:true});await save.waitFor();
     await page.waitForFunction(()=>!document.querySelector('button[type="submit"]')?.disabled);
     assert.equal(await page.evaluate(()=>window.__pushPermissionRequests),0,'loading settings cannot prompt');
     const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert.ok(overflow<=1,`settings ${width}: horizontal overflow ${overflow}`);
     for(const label of ['Quiet hours start','Quiet hours end','Quiet hours timezone']){
       const control=page.getByLabel(label),box=await control.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width+1&&box.height>=44,`${label} must fit a practical touch target at ${width}`);
     }
     await page.getByRole('checkbox',{name:'Quiet hours',exact:true}).check();
     await page.getByLabel('Quiet hours timezone').selectOption('America/New_York');
     await save.click();await page.getByText('Quiet hours saved.',{exact:true}).waitFor();
     assert.equal(test.getSettings().timeZone,'America/New_York');assert.equal(test.getSettings().quietEnabled,true);
     await page.screenshot({path:`${artifacts}/settings-${width}.png`,fullPage:true});
     await page.getByRole('button',{name:'Enable on this device',exact:true}).click();
     await page.getByText('Notifications are not allowed. You can change this in browser settings.',{exact:true}).waitFor();
     assert.equal(await page.evaluate(()=>window.__pushPermissionRequests),1,'only explicit enable requests permission');
     assert.equal(test.writes.filter(write=>write.action==='subscribe').length,0,'denied permission cannot register');
     assert.equal(await page.evaluate(()=>window.__pushNavigationMarker),'same-page','push settings cannot reload a running app');
     assert.deepEqual(test.crashes,[]);results.push({test:'settings',width,quietPersistence:true,permissionRequests:1,crashes:[]});
   }finally{await test.context.close();}
 }
 for(const scenario of [{permission:'denied',configured:true,label:'denied'},{permission:'default',configured:false,label:'unconfigured'},{permission:'default',configured:true,anonymous:true,label:'guest'}]){
   const test=await newPage({width:390,height:844},scenario),{page}=test;
   try{
     await page.goto(`${base}/${html}?view=settings`,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Alerts',exact:true}).click();
     if(scenario.anonymous)await page.getByText('Sign in to a permanent account to manage push notifications.',{exact:true}).waitFor();
     else{const enable=page.getByRole('button',{name:'Enable on this device',exact:true});await enable.waitFor();assert.equal(await enable.isDisabled(),true);}
     assert.equal(await page.evaluate(()=>window.__pushPermissionRequests),0);await page.screenshot({path:`${artifacts}/settings-${scenario.label}.png`,fullPage:true});assert.deepEqual(test.crashes,[]);
     results.push({test:scenario.label,permissionRequests:0});
   }finally{await test.context.close();}
 }
 // Actual App + context + locked draft-order league, cold URL and warm worker event.
 for(const cold of [true,false]){
   const test=await newPage({width:390,height:844}),{page}=test;
   try{
     await page.goto(`${base}/${html}?view=app${cold?`&pushNotification=${notificationId}`:''}`,{waitUntil:'domcontentloaded'});
     if(!cold){await page.locator('.bk-app-shell').waitFor();await page.waitForFunction(()=>document.querySelector('.bk-app-shell')?.getAttribute('data-tab')==='home');await page.waitForTimeout(1000);await page.evaluate(id=>window.dispatchEvent(new CustomEvent('ballknower:push-open',{detail:{notificationId:id}})),notificationId);}
     await page.waitForFunction(()=>document.querySelector('.bk-app-shell')?.getAttribute('data-tab')==='draft');
     await page.getByTestId('live-draft-order-strip').waitFor();
     assert.equal(await page.locator('.bk-app-shell').getAttribute('data-tab'),'draft');
     assert.equal(await page.evaluate(()=>sessionStorage.getItem('ballknower_push_destination_v1')),null,'direct draft route cannot leave a deferred HQ redirect');
     assert.equal(await page.evaluate(()=>window.__pushPermissionRequests),0,'push tap never prompts');
     await page.screenshot({path:`${artifacts}/draft-${cold?'cold':'warm'}.png`,fullPage:true});assert.deepEqual(test.crashes,[]);results.push({test:cold?'cold-active-draft':'warm-active-draft',tab:'draft',lockedOrderBypassed:true});
   }finally{await test.context.close();}
 }
 const denied=await newPage({width:390,height:844},{foreign:true});
 try{
   await denied.page.goto(`${base}/${html}?view=app&pushNotification=${notificationId}`,{waitUntil:'domcontentloaded'});
   await denied.page.getByText('This notification is no longer available in your leagues.',{exact:true}).waitFor();
   assert.equal(await denied.page.locator('.bk-app-shell').getAttribute('data-tab'),'home','foreign/ended-membership target cannot navigate');results.push({test:'foreign-target',tab:'home'});
 }finally{await denied.context.close();}
 await writeFile(`${artifacts}/results.json`,JSON.stringify({fixtureOnly:true,results},null,2));
 console.log('Push browser checks passed: actual settings at 320/390/1280px; quiet persistence; denied/unconfigured/guest and deliberate permission; actual App cold/warm active-draft taps and unauthorized-target rejection. Isolated HTTP fixtures, no real pushes.');
}catch(error){await writeFile(`${artifacts}/failure.txt`,String(error?.stack||error));throw error;}
finally{await browser?.close();await server?.close();await rm(html,{force:true});await rm(entry,{force:true});}
