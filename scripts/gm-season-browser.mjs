import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {prepareGmEventsFixture,out} from './gm-events-fixture.mjs';
const html=await prepareGmEventsFixture();
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://local').pathname;if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}try{const file=resolve(path.startsWith('/artifacts/')||path.startsWith('/dist/')?'.':'public','.'+path);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(4189,'127.0.0.1',r));
const launch=process.env.BK_CHROMIUM_MODULE?await(async()=>{const{default:c}=await import(process.env.BK_CHROMIUM_MODULE);return{executablePath:await c.executablePath(),args:c.args}})():{};
const browser=await chromium.launch({headless:true,...launch});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/api/**',r=>r.fulfill({json:{available:false}}));await page.goto('http://127.0.0.1:4189/?real=1');
 const key='ballknower_solo_franchise_v2:season';const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 const scenes=new Set();
 async function dialogs(){for(let n=0;n<25;n++){const d=page.getByRole('dialog');if(!await d.count())return;const img=d.locator('[data-gm-scene]');scenes.add(await img.getAttribute('data-gm-scene'));await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.decode());assert.ok(await img.evaluate(e=>e.naturalWidth===1280));await d.locator('.bk-gm-event-choices button').first().click();await page.waitForTimeout(80);}throw Error('Unresolved alert loop');}
 await page.getByRole('button',{name:'START SEASON',exact:true}).click();
 for(let week=1;week<=17;week++){await dialogs();await page.getByRole('button',{name:`SIMULATE WEEK ${week}`,exact:true}).click();await page.waitForFunction(({key,week})=>JSON.parse(localStorage.getItem(key))?.weeks.length===week,{key,week});console.log('GM week',week);if(week===8){await dialogs();await page.reload();await page.getByRole('button',{name:/^(START|CONTINUE) SEASON$/}).click();assert.equal((await read()).weeks.length,8);}}
 await dialogs();await page.getByRole('button',{name:/SELECTION SUNDAY/}).click();
 while((await read()).stage==='playoffs'){await dialogs();const count=(await read()).playoffs.length;await page.getByRole('button',{name:/^PLAY (WILD CARD|DIVISIONAL|CONFERENCE|LEGACY)/}).click();await page.waitForFunction(({key,count})=>JSON.parse(localStorage.getItem(key)).playoffs.length>count,{key,count});}
 await dialogs();const completed=await read();assert.equal(completed.weeks.length,17);assert.equal(completed.stage,'finished');const expected=completed.message.includes('WORLD CHAMPION')?'champion':'review';await page.locator(`[data-gm-scene="${expected}"]`).waitFor();
 for(const width of [320,390,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`${out}/gm-season-result-${width}.png`,fullPage:true});}
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'ENTER OFFSEASON DRAFT'}).click();
 let picks=0;while((await read()).stage==='draft'){await page.locator('[data-gm-scene="draft"]').waitFor();const h=page.getByRole('heading',{name:"YOU'RE ON THE CLOCK"});await h.waitFor();await h.locator('..').getByRole('button').first().click();picks++;assert(picks<=7);}
 assert(picks>0);assert.equal((await read()).year,2027);await dialogs();await page.reload();await page.getByRole('button',{name:/^(START|CONTINUE) SEASON$/}).click();assert.equal((await read()).year,2027);assert.equal((await read()).weeks.length,0);await dialogs();assert.deepEqual(errors,[]);
 // Boundary fixture: a qualified save enters the real playoff controls, independently of the 17-game run.
 await page.evaluate(({key,weeks})=>{const save=JSON.parse(localStorage.getItem(key));save.stage='regular';save.weeks=weeks.map((w,i)=>({...w,won:true,record:`${i+1}-0`,game:{...w.game,winnerId:'franchise-user',homeScore:w.game.homeMemberId==='franchise-user'?35:10,awayScore:w.game.homeMemberId==='franchise-user'?10:35}}));save.playoffs=[];save.playoffField=[];save.interactions.pendingScenario=null;localStorage.setItem(key,JSON.stringify(save));},{key,weeks:completed.weeks});
 const reopen=async()=>{await page.reload();await dialogs();await page.getByRole('button',{name:'CONTINUE SEASON',exact:true}).click();await dialogs();};
 await reopen();await page.getByRole('button',{name:/SELECTION SUNDAY/}).click();await page.locator('[data-gm-scene="playoffs"]').waitFor();
 await page.evaluate(key=>{const save=JSON.parse(localStorage.getItem(key));save.playoffField=[null];localStorage.setItem(key,JSON.stringify(save));},key);
 await reopen();await page.getByRole('button',{name:'REBUILD PLAYOFF BRACKET',exact:true}).click();await page.getByRole('button',{name:'PLAY DIVISIONAL',exact:true}).waitFor();
 while((await read()).stage==='playoffs'){await dialogs();const n=(await read()).playoffs.length;await page.getByRole('button',{name:/^PLAY (WILD CARD|DIVISIONAL|CONFERENCE|LEGACY)/}).click();await page.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)).playoffs.length>n,{key,n});}
 const postseason=await read();assert(postseason.playoffs.length>0);
 // Title-game boundary exercises the normal final simulation, followed by both result presentation states.
 await page.evaluate(key=>{const save=JSON.parse(localStorage.getItem(key));save.stage='playoffs';save.playoffs=['DIVISIONAL','CONFERENCE CHAMPIONSHIP'].map(round=>({round,opponent:'Boundary fixture',you:24,them:17,won:true}));localStorage.setItem(key,JSON.stringify(save));},key);
 await reopen();await page.getByRole('button',{name:'PLAY LEGACY BOWL',exact:true}).click();await page.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).stage==='finished',key);assert.equal((await read()).playoffs.at(-1).round,'LEGACY BOWL');
 for(const [message,scene] of [['WORLD CHAMPION','champion'],['Your run ends here.','review']]){await page.evaluate(({key,message})=>{const save=JSON.parse(localStorage.getItem(key));save.message=message;localStorage.setItem(key,JSON.stringify(save));},{key,message});await reopen();const img=page.locator(`[data-gm-scene="${scene}"]`);await img.scrollIntoViewIfNeeded();await img.evaluate(e=>e.decode());await page.screenshot({path:`${out}/gm-${scene}-boundary.png`});}
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:'PASS',weeks:17,wins:completed.weeks.filter(w=>w.won).length,playoffs:completed.playoffs,picks,nextYear:2027,scenes:[...scenes],errors}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
