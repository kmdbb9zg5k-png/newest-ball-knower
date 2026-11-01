import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {existsSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {mkdir,readFile} from 'node:fs/promises';
const appStyles=[...(await readFile('dist/index.html','utf8')).matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(\/assets\/[^"]+\.css)"/g)].map(match=>'<link rel="stylesheet" href="/dist'+match[1]+'">').join('');
assert(appStyles,'Build must expose its application stylesheets');
const fixture=`import React from'react';import{createRoot}from'react-dom/client';import{FranchiseSeason}from'./FranchiseSeason.tsx';import{buildSoloTeamRoster}from'./soloFranchiseEngine.ts';import{SOLO_TEAM_THEMES}from'./soloUniverse.ts';import'./solo/soloPresentation.css';createRoot(document.getElementById('root')).render(React.createElement(FranchiseSeason,{title:'Season QA',userTeam:SOLO_TEAM_THEMES[0],roster:buildSoloTeamRoster(SOLO_TEAM_THEMES[0].abbr),saveKey:'bk-season-qa',onBack:()=>{},difficulty:'rookie'}));`;
const out='artifacts/franchise-full-season';await mkdir(out,{recursive:true});
await build({plugins:[{name:'exact-case-typescript',setup(b){b.onResolve({filter:/^\./},args=>{for(const ext of ['.ts','.tsx']){const path=resolve(args.resolveDir,args.path+ext);if(existsSync(path))return{path};}})}}],stdin:{contents:fixture,resolveDir:process.cwd(),loader:'tsx'},bundle:true,format:'esm',outfile:out+'/fixture.js',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{}'},loader:{'.png':'dataurl','.webp':'dataurl','.jpg':'dataurl','.svg':'dataurl'},logLevel:'error'});
const html='<html><head><meta name="viewport" content="width=device-width,initial-scale=1">'+appStyles+'<link rel="stylesheet" href="/'+out+'/fixture.css"></head><body><div id="root"></div><script type="module" src="/'+out+'/fixture.js"></script></body></html>';
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://local').pathname;if(path==='/season-qa.html'){res.setHeader('Content-Type','text/html');res.end(html);return;}const file=resolve(path.startsWith('/artifacts/')||path.startsWith('/dist/')?'.':'public','.'+path);try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(3072,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE ERROR',e.message)});await page.route('**/api/**',r=>r.fulfill({json:{available:false}}));await page.goto('http://127.0.0.1:3072/season-qa.html');console.log('Loaded season fixture');
 if(process.env.BK_FRANCHISE_VISUAL_ONLY){await page.evaluate(()=>localStorage.setItem('bk-season-qa:season',JSON.stringify({version:2,stage:'finished',year:2027,weeks:[],playoffs:[],injuries:[],message:'LEGACY BOWL: 8-29. Your run ends here.'})));await page.reload();for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});await page.getByRole('button',{name:'ENTER OFFSEASON DRAFT'}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:out+'/styled-finale-'+width+'.png',fullPage:true});}assert.deepEqual(errors,[]);console.log('PASS styled finale320/390/1280, offseason reachable, no horizontal overflow');}else{
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('bk-season-qa:season')));
 for(let week=1;week<=17;week++){
  await page.getByRole('region',{name:'Franchise interactions'}).locator('article button').first().click();
  await page.getByRole('button',{name:/SIMULATE WEEK/}).click();
  await page.waitForFunction(w=>JSON.parse(localStorage.getItem('bk-season-qa:season')).weeks.length===w,week);
  console.log('Completed week',week);if(week===8){await page.reload();await page.getByRole('region',{name:'Franchise interactions'}).waitFor();assert.equal((await read()).weeks.length,8);}
 }
 await page.getByRole('button',{name:/SELECTION SUNDAY/}).click();
 while((await read()).stage==='playoffs'){const count=(await read()).playoffs.length;await page.getByRole('button',{name:/^PLAY (WILD CARD|DIVISIONAL|CONFERENCE|LEGACY)/}).click();await page.waitForFunction(n=>JSON.parse(localStorage.getItem('bk-season-qa:season')).playoffs.length>n,count);}
 const completed=await read();assert.equal(completed.weeks.length,17);assert.equal(completed.stage,'finished');
 await page.screenshot({path:'artifacts/franchise-full-season/season-complete.png',fullPage:true});
 // Corrupt only bracket metadata; the real UI must preserve all completed games.
 await page.evaluate(()=>{const key='bk-season-qa:season',save=JSON.parse(localStorage.getItem(key));save.stage='playoffs';save.playoffField=[null];localStorage.setItem(key,JSON.stringify(save));});
 await page.reload();await page.getByRole('button',{name:'REBUILD PLAYOFF BRACKET'}).click();
 assert.deepEqual((await read()).weeks,completed.weeks);assert.deepEqual((await read()).playoffs,completed.playoffs);
 while((await read()).stage==='playoffs'){const count=(await read()).playoffs.length;await page.getByRole('button',{name:/^PLAY (WILD CARD|DIVISIONAL|CONFERENCE|LEGACY)/}).click();await page.waitForFunction(n=>JSON.parse(localStorage.getItem('bk-season-qa:season')).playoffs.length>n,count);}
 await page.getByRole('button',{name:'ENTER OFFSEASON DRAFT'}).click();
 for(let i=0;i<7;i++){const h=page.getByRole('heading',{name:"YOU'RE ON THE CLOCK"});await h.waitFor();await h.locator('..').getByRole('button').first().click();}
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('bk-season-qa:season')).year===2027);await page.reload();await page.getByRole('region',{name:'Franchise interactions'}).waitFor();const next=await read();assert.equal(next.year,2027);assert.equal(next.weeks.length,0);assert.equal(next.roster.filter(p=>p.id.startsWith('franchise-rookie-2027')).length,7);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 // A separate qualifying-save fixture exercises postseason UI and damaged-bracket recovery.
 await page.evaluate(weeks=>{const key='bk-season-qa:season',save=JSON.parse(localStorage.getItem(key));save.stage='regular';save.weeks=weeks.map((week,index)=>({...week,won:true,record:`${index+1}-0`,game:{...week.game,winnerId:'franchise-user',homeScore:week.game.homeMemberId==='franchise-user'?35:10,awayScore:week.game.homeMemberId==='franchise-user'?10:35}}));save.playoffs=[];save.playoffField=[];save.interactions.pendingScenario=null;localStorage.setItem(key,JSON.stringify(save));},completed.weeks);
 await page.reload();await page.getByRole('button',{name:/SELECTION SUNDAY/}).click();await page.getByRole('button',{name:'PLAY DIVISIONAL',exact:true}).waitFor();
 await page.evaluate(()=>{const key='bk-season-qa:season',save=JSON.parse(localStorage.getItem(key));save.playoffField=[null];localStorage.setItem(key,JSON.stringify(save));});
 await page.reload();await page.getByRole('button',{name:'REBUILD PLAYOFF BRACKET'}).click();await page.getByRole('button',{name:'PLAY DIVISIONAL',exact:true}).waitFor();
 while((await read()).stage==='playoffs'){const count=(await read()).playoffs.length;await page.getByRole('button',{name:/^PLAY (WILD CARD|DIVISIONAL|CONFERENCE|LEGACY)/}).click();await page.waitForFunction(n=>JSON.parse(localStorage.getItem('bk-season-qa:season')).playoffs.length>n,count);}
 const postseason=await read();assert(postseason.playoffs.length>=1);assert.equal(postseason.stage,'finished');assert.deepEqual(errors,[]);console.log('PASS qualifying save, first-round bye, broken-bracket rebuild and normal postseason controls:',JSON.stringify(postseason.playoffs));
 // Seed only the title-game boundary, then resolve the actual final using its normal button.
 await page.evaluate(()=>{const key='bk-season-qa:season',save=JSON.parse(localStorage.getItem(key));save.stage='playoffs';save.playoffs=['DIVISIONAL','CONFERENCE CHAMPIONSHIP'].map(round=>({round,opponent:'Qualifying fixture opponent',you:24,them:17,won:true}));localStorage.setItem(key,JSON.stringify(save));});
 await page.reload();await page.getByRole('button',{name:'PLAY LEGACY BOWL',exact:true}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('bk-season-qa:season')).stage==='finished');const final=await read();assert.equal(final.playoffs.at(-1).round,'LEGACY BOWL');await page.getByRole('button',{name:'ENTER OFFSEASON DRAFT'}).waitFor();await page.screenshot({path:out+'/title-game-result.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS title-game fixture normal final and offseason access:',JSON.stringify(final.playoffs.at(-1)));
 console.log(JSON.stringify({status:'PASS',weeks:17,record:completed.weeks.filter(w=>w.won).length+'-'+completed.weeks.filter(w=>!w.won).length,playoffs:completed.playoffs,nextYear:next.year,rookies:7,errors}));
}
}finally{await browser.close();await new Promise(r=>server.close(r))}
