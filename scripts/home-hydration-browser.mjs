import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
const root=process.cwd();
const nullModules={HomeStadiumHero:'HomeStadiumHero',HomeMatchups:'HomeMatchups',HomeSoloFeature:'HomeSoloFeature',PartnerCard:'PartnerCard',FantasySettingsHub:'FantasySettingsHub',LeagueManagementModal:'LeagueManagementModal'};
const entry=`import React from 'react';import{createRoot}from'react-dom/client';import{HomeDashboard}from'./HomeDashboard';const root=createRoot(document.getElementById('root'));const noop=()=>{};window.hydrate=user=>{window.__user=user;root.render(<HomeDashboard onOpenCreateLeague={noop} onOpenJoinLeague={noop} onSelectLeague={noop} onNavigate={noop} onOpenCheatSheet={noop} onViewMemberLocker={noop} teamTheme={{name:'Ball Knower',primary:'#000',secondary:'#fff'}}/>)};window.hydrate({id:'user-default-1',isAnonymous:true,name:'Guest'});`;
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
try{
 for(const baseline of process.env.REPRO_BASELINE ? [true,false] : [false]){
 const result=await build({stdin:{contents:entry,resolveDir:root,loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'isolated-home',setup(b){
 b.onResolve({filter:/\.css$/},a=>({path:a.path,namespace:'empty'}));b.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:''}));
 b.onResolve({filter:/^\.\/(BallKnowerContext|progressionCloud|fantasySeasonCloud|partners|HomeStadiumHero|HomeMatchups|HomeSoloFeature|PartnerCard|FantasySettingsHub|LeagueManagementModal)$/},a=>({path:a.path.slice(2),namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},({path})=>({loader:'js',contents:path==='BallKnowerContext'?`export const useBallKnower=()=>({currentUser:window.__user,leagues:[],activeLeague:null,setActiveLeagueId:()=>{}});`:path==='progressionCloud'?`export const fetchProgressionProfile=async()=>({profile:null});`:path==='fantasySeasonCloud'?`export const fetchSeasonOperations=async()=>({});`:path==='partners'?`export const homePartners=[],activePartners=[];`:`export const ${nullModules[path]}=()=>null;`}));
 if(baseline)b.onLoad({filter:/HomeDashboard\.tsx$/},()=>({loader:'tsx',resolveDir:root,contents:execFileSync('git',['show','HEAD:HomeDashboard.tsx'],{encoding:'utf8'})}));
 }}]});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await page.route('http://fixture.test/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'}));
 await page.goto('http://fixture.test');await page.addScriptTag({content:result.outputFiles[0].text});
 const open=()=>page.getByRole('button',{name:'Explore Mini Games',exact:true}).click();
 await open();assert.equal(await page.locator('dialog[open]').count(),1);
 await page.evaluate(()=>window.hydrate({id:'anon-a',isAnonymous:true,name:'Guest A'}));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 assert.equal(await page.locator('dialog[open]').count(),baseline?0:1,'initial guest hydration should preserve the actual game-mode dialog');
 if(baseline)await open();
 await page.evaluate(()=>window.hydrate({id:'anon-b',isAnonymous:true,name:'Guest B'}));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.locator('dialog[open]').count(),0,'real guest identity switch resets private Home scope');
 await open();await page.evaluate(()=>window.hydrate({id:'anon-b',isAnonymous:false,name:'Member B'}));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.locator('dialog[open]').count(),baseline?1:0,'same-ID account upgrade resets privilege scope');
 await page.close();console.log(baseline?'REPRODUCED: initial hydration closes actual Home game-mode dialog.':'PASS: actual Home game-mode dialog survives initial guest hydration; real identity/privilege changes reset it.');
 }
}finally{await browser.close()}
