// Complete an Agent year through normal UI; isolated network fixture, no real account writes.
import {spawn} from 'node:child_process';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4193','--strictPort'],{stdio:'ignore'});
await new Promise(r=>setTimeout(r,1500));
import {chromium} from 'playwright';import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.setDefaultTimeout(30000);
await page.route('**/*.supabase.co/**',r=>r.fulfill({status:403,contentType:'application/json',body:'{}'}));await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(new URL(r.request().url()).pathname==='/api/media'?{tracks:[],introUrl:null}:{available:false,ok:true,games:[]})}));
await page.addInitScript(()=>{localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','1');localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off')});
await page.goto('http://127.0.0.1:4193',{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Play Solo Mode',exact:true}).click();await page.locator('.bk-mode-card').filter({hasText:'Agent Mode'}).click();
await page.getByRole('button',{name:'CONTINUE',exact:true}).click();await page.getByRole('button',{name:'CREATE YOUR AGENT',exact:true}).click();await page.getByLabel('Agent name',{exact:true}).fill('Career QA');await page.getByLabel('Home city',{exact:true}).fill('Allentown');await page.getByRole('button',{name:'BEGIN MY CAREER',exact:true}).click();
const read=key=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
for(let i=0;i<28;i++){await page.getByRole('button',{name:/^(ADVANCE ONE WEEK|BEGIN NEXT SEASON)$/}).click();console.log('Agent turn',i+1,(await read('ballknower_player_agent_v4')).phase)}
let agent=await read('ballknower_player_agent_v4');assert.equal(agent.seasonYear,2027);assert.equal(agent.simulatedDate,'2027-09-03');await page.reload({waitUntil:"domcontentloaded"});await page.getByRole('button',{name:'Play Solo Mode',exact:true}).click();await page.locator('.bk-mode-card').filter({hasText:'Agent Mode'}).click();await page.getByRole('button',{name:/^(ADVANCE ONE WEEK|BEGIN NEXT SEASON)$/}).waitFor();assert.equal((await read('ballknower_player_agent_v4')).seasonYear,2027);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));console.log('PASS Agent full season and reload');
}finally{await browser.close();server.kill()}
