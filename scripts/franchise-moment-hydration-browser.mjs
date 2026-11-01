import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {mkdir,readFile} from 'node:fs/promises';
const appStyles=[...(await readFile('dist/index.html','utf8')).matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(\/assets\/[^"]+\.css)"/g)].map(match=>'<link rel="stylesheet" href="/dist'+match[1]+'">').join('');
assert(appStyles,'Build must expose its application stylesheets');
const fixture=`import React from'react';import{createRoot}from'react-dom/client';import{FranchiseSeason}from'./FranchiseSeason.tsx';import{SoloMode}from'./SoloMode.tsx';import{buildSoloTeamRoster}from'./soloFranchiseEngine.ts';import{SOLO_TEAM_THEMES}from'./soloUniverse.ts';import'./solo/soloPresentation.css';createRoot(document.getElementById('root')).render(location.search.includes('cap')?React.createElement(SoloMode,{initialExperience:'cap'}):React.createElement(FranchiseSeason,{title:'Season QA',userTeam:SOLO_TEAM_THEMES[0],roster:buildSoloTeamRoster(SOLO_TEAM_THEMES[0].abbr),saveKey:'ballknower_solo_franchise_v2',onBack:()=>{},difficulty:'rookie'}));`;
const out='artifacts/franchise-moment-hydration';await mkdir(out,{recursive:true});
await build({plugins:[{name:'cap-context',setup(b){b.onResolve({filter:/^\.\/BallKnowerContext$/},a=>a.importer.endsWith('/SoloMode.tsx')?{path:'cap-context',namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useBallKnower=()=>({currentUser:null});',loader:'js'}));}},{name:'exact-case-typescript',setup(b){b.onResolve({filter:/^\./},args=>{for(const ext of ['.ts','.tsx']){const path=resolve(args.resolveDir,args.path+ext);if(existsSync(path))return{path};}})}}],stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,external:['/solo-mode-scenes/*','/mini-team-selection/*'],format:'esm',outfile:out+'/fixture.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},loader:{'.png':'dataurl','.webp':'dataurl','.jpg':'dataurl','.svg':'dataurl'},logLevel:'error'});
const html='<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+appStyles+'<link rel="stylesheet" href="/'+out+'/fixture.css"></head><body><div data-tab="solo"><div id="root"></div></div><script type="module" src="/'+out+'/fixture.js"></script><script src="/franchise-play-moment-bridge.js"></script></body></html>';
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://local').pathname;if(path==='/season-qa.html'){res.setHeader('Content-Type','text/html');res.end(html);return;}const file=resolve(path.startsWith('/artifacts/')||path.startsWith('/dist/')?'.':'public','.'+path);try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(3077,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});let nav=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('framenavigated',f=>{if(f===page.mainFrame())nav++});
 await page.route('**/franchise-play-moment-v3.html?**',r=>r.fulfill({contentType:'text/html',body:'Moment result fixture'}));
 await page.goto('http://127.0.0.1:3077/season-qa.html');
 await page.getByRole('region',{name:'Franchise interactions'}).locator('article button').first().click();
 await page.locator('[data-bk-play-moment]').click();await page.locator('iframe').waitFor();
 const frame=page.frames().find(f=>f!==page.mainFrame());await frame.evaluate(()=>parent.postMessage({type:'bk-play-moment-result',week:1,won:true,score:31},location.origin));
 await page.getByText('PLAY MOMENT WIN — 1-0',{exact:true}).waitFor();
 assert.equal(nav,1);await page.waitForTimeout(600);
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ballknower_solo_franchise_v2:season')));
 assert.equal(saved.weeks.length,1);assert.equal(saved.weeks[0].won,true);assert.equal(saved.message,'PLAY MOMENT WIN — 1-0');assert.equal(saved.year,2026);assert.equal(typeof saved.teamAbbr,'string');assert(saved.interactions.notifications.some(n=>n.title==='Clutch moment won'));assert.deepEqual(errors,[]);
 console.log('PASS actual FranchiseSeason mounted hydration, persisted week/notice/record, no navigation; actual simulation with fixture moment result');
 await page.goto('http://127.0.0.1:3077/season-qa.html?cap');
 await page.getByRole('button',{name:/AUTO-DRAFT/}).click();await page.getByRole('button',{name:'START SEASON',exact:true}).click();
 await page.getByRole('region',{name:'Franchise interactions'}).locator('article button').first().click();
 await page.locator('[data-bk-play-moment]').click();await page.locator('iframe').waitFor();
 const capFrame=page.frames().find(f=>f!==page.mainFrame());await capFrame.evaluate(()=>parent.postMessage({type:'bk-play-moment-result',week:1,won:true,score:35},location.origin));
 await page.getByText('PLAY MOMENT WIN — 1-0',{exact:true}).waitFor();await page.waitForTimeout(600);assert.equal(nav,2);
 const cap=await page.evaluate(()=>JSON.parse(localStorage.getItem('ballknower_solo_run_v2')));assert.equal(cap.weeks.length,1);assert.equal(cap.weeks[0].game.winnerId,'solo-user');assert.equal(cap.roster.length,20);assert(cap.interactions.notifications.some(n=>n.title==='Clutch moment won'));assert.deepEqual(errors,[]);
 console.log('PASS actual CapChallenge autodraft/start/week/hydration, own save and roster, no navigation; terminal moment fixture');

}finally{await browser.close();await new Promise(r=>server.close(r));}
