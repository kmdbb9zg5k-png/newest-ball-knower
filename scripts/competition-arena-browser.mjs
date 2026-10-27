import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const fixture=`import React from'react';import{createRoot}from'react-dom/client';import CommunityMiniGames from'/CommunityMiniGames.tsx';import'/index.css';createRoot(document.getElementById('root')).render(React.createElement(CommunityMiniGames,{me:location.search.includes('guest')?'':'me',friends:[],onOpenAuth:()=>document.body.dataset.auth='requested'}));`;
const adapter=`export async function competitionAction(action,args={}){const r=await fetch('/__competition',{method:'POST',body:JSON.stringify({action,args})});const d=await r.json();if(!r.ok)throw Error(d.message);return d;}`;
const mini=`export async function miniChallengeAction(){return []};export function subscribeCommunity(){return()=>{}};`;
const server=await createServer({cacheDir:'/tmp/bk-competition-fixture',server:{host:'127.0.0.1',port:3075,strictPort:true,watch:null,hmr:false},plugins:[{name:'competition-fixture',enforce:'pre',configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url?.startsWith('/competition-qa.html')){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,'<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0;background:#07131c;color:white"><div id="root"></div><script type="module" src="/competition-qa.js"></script></body></html>'));}else next();});},resolveId(id,importer){if(id==='/competition-qa.js')return'\0competition-qa';if(id==='./competitionCloud'&&importer?.endsWith('/CommunityCompetitionArena.tsx'))return'\0competition-adapter';if(id==='./communityCloud'&&importer?.endsWith('/CommunityMiniGames.tsx'))return'\0competition-mini';},load(id){if(id==='\0competition-qa')return fixture;if(id==='\0competition-adapter')return adapter;if(id==='\0competition-mini')return mini;}}]});await server.listen();await mkdir('artifacts/competition-arena',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox']});
try{
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<768,isMobile:width<768});const page=await context.newPage();page.setDefaultTimeout(30000);const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
  let crew=null,joined=false,submitted=false,equipped=false,failSubmit=true;
  const weekly={id:'weekly',title:'Weekly Combine Cup',crew_id:null,games:['dash','bench','broad-jump'],seed:123,starts_at:new Date(Date.now()-3600000).toISOString(),ends_at:new Date(Date.now()+86400000).toISOString(),finalized_at:null};
  const events=[weekly];
  await page.route('**/*.supabase.co/**',route=>route.abort());
  await page.route('**/__competition',async route=>{const{action,args}=route.request().postDataJSON();calls.push({action,args});let result={};
   if(action==='home')result={crew,events,rewards:[{event_id:'last-week',title:'Previous cup',badge:'champion',equipped,awarded_at:new Date().toISOString()}]};
   else if(action==='create_crew'){crew={id:'crew',name:args.name,emblem:args.emblem,color:args.color,captain:'me',join_code:'BKQA123456',members:[{user_id:'me',name:'QA Captain'},{user_id:'friend',name:'QA Teammate'}]};}
   else if(action==='create_night'){events.push({...weekly,id:'night',title:args.title,crew_id:'crew',games:args.games});}
   else if(action==='join_event')joined=true;
   else if(action==='event')result={event:events.find(e=>e.id===args.id),joined,mine:submitted?[{game:'dash',stats:{time:4.5,split10:1.7,split20:2.8},score:90,submitted_at:new Date().toISOString()}]:[],standings:joined?[{user_id:'me',name:'QA Captain',points:submitted?90:0,completed:submitted?1:0,final_rank:null,crew_name:crew?.name||null,badge:equipped?'champion':null}]:[],crew_standings:submitted?[{id:'crew',name:crew.name,points:18,contributors:1}]:[]};
   else if(action==='begin')result={token:'fixture-attempt',seed:123};
   else if(action==='submit'){if(failSubmit){failSubmit=false;await route.fulfill({status:503,json:{message:'Temporary fixture network failure'}});return;}submitted=true;result={stats:args.stats,score:90};}
   else if(action==='equip')equipped=true;
   else throw Error('Unexpected fixture action '+action);
   await route.fulfill({json:result});
  });
  await page.route('**/combine.html?*',async route=>{await route.fulfill({contentType:'text/html',body:`<button id="finish">Finish fixture attempt</button><script>document.getElementById('finish').onclick=()=>{const p=new URLSearchParams(location.search);parent.postMessage({type:'bk-mini-result',challengeId:p.get('bkChallenge'),token:p.get('bkToken'),stats:{time:4.5,split10:1.7,split20:2.8}},location.origin)};</script>`});});
  await page.goto('http://127.0.0.1:3075/competition-qa.html?guest');await page.getByRole('button',{name:'Crews, events & challenge nights',exact:true}).click();await page.getByRole('button',{name:'Sign in for crews & events',exact:true}).click();assert.equal(await page.locator('body').getAttribute('data-auth'),'requested');assert.equal(calls.length,0,'Guests do not call competition API');
  await page.goto('http://127.0.0.1:3075/competition-qa.html');await page.getByRole('button',{name:'Crews, events & challenge nights',exact:true}).click();await page.getByLabel(/^Crew name/).fill('Eagles Test Crew');await page.getByRole('button',{name:'Create crew',exact:true}).click();await page.getByText('BKQA123456',{exact:true}).waitFor();
  await page.getByText('Host a private challenge night',{exact:true}).click();await page.getByLabel(/^Night name/).fill('Friday Crew Battle');await page.getByRole('button',{name:'Host challenge night',exact:true}).click();await page.getByRole('button',{name:/Friday Crew Battle/}).waitFor();
  await page.getByRole('button',{name:/Weekly Combine Cup/}).click();await page.getByRole('button',{name:'Join this event',exact:true}).click();await page.getByRole('button',{name:'Play event drill',exact:true}).first().click();await page.frameLocator('iframe[title="40-Yard Dash event"]').getByRole('button',{name:'Finish fixture attempt'}).click();await page.getByRole('button',{name:'Retry event result',exact:true}).click();await page.getByRole('heading',{name:'Event result locked',exact:true}).waitFor();await page.getByRole('button',{name:'Back to event',exact:true}).click();await page.getByRole('button',{name:'Result locked',exact:true}).waitFor();
  const submissions=calls.filter(c=>c.action==='submit');assert.equal(submissions.length,2);assert.deepEqual(submissions[0].args,submissions[1].args,'Retry preserves immutable transcript/token');
  await page.getByRole('button',{name:'Equip badge',exact:true}).click();await page.getByRole('button',{name:'Badge equipped',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`No competition overflow at ${width}`);await page.screenshot({path:`artifacts/competition-arena/crew-cup-${width}.png`,fullPage:true});assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS integrated Community competition panel: guest gate, crew creation, private night, event join, iframe result source, retry, locked result, standings, badge equipment and 320/390/1280 layouts. Backend/game fixtures; SQL rules tested separately.');
}finally{await browser.close();await server.close();}
