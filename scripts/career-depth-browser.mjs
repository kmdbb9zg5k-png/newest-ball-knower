// Run in browser CI after npm run build. No live auth, account or database writes.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {prepareCareerDepthFixture,out} from './career-depth-fixture.mjs';
const html=await prepareCareerDepthFixture();
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://local').pathname;if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}const file=resolve(path.startsWith('/artifacts/')||path.startsWith('/dist/')?'.':'public','.'+path);try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(4198,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox']});
try{
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:844},hasTouch:width<500});const page=await context.newPage();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',r=>r.fulfill({json:{available:false}}));await page.route('**/*.supabase.co/**',r=>r.fulfill({status:403,json:{}}));
  const read=key=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
  await page.goto('http://127.0.0.1:4198/?mode=gm');await page.getByRole('button',{name:'START SEASON',exact:true}).click();
  for(let week=1;week<=2;week++){
   for(let i=0;i<30;i++){const dialog=page.getByRole('dialog');if(await dialog.count()){await dialog.locator('.bk-gm-event-choices button').last().click();await page.waitForTimeout(100);continue;}const button=page.getByRole('button',{name:`SIMULATE WEEK ${week}`,exact:true});if(await button.isEnabled().catch(()=>false)){await button.click();break;}await page.waitForTimeout(100);}
   await page.waitForFunction(w=>JSON.parse(localStorage.getItem('ballknower_solo_franchise_v2:season')).weeks.length===w,week);
  }
  const counter=page.getByRole('button',{name:/^Counter for/}).first();await counter.waitFor();const before=await read('ballknower_solo_franchise_v2');const original=before.tradeInbox.pending;
  await page.screenshot({path:`${out}/gm-trade-${width}.png`});await counter.click();
  await page.getByRole('button',{name:/^Accept trade/}).waitFor();const revised=await read('ballknower_solo_franchise_v2');assert.equal(revised.tradeInbox.pending.counterOf,original.id);assert.notEqual(revised.tradeInbox.pending.incomingId,original.incomingId);assert.deepEqual(revised.roster,before.roster,'A counter alone cannot change a roster');
  const revisedId=revised.tradeInbox.pending.id;await page.getByRole('button',{name:'Close GM alert'}).click();await page.getByRole('button',{name:/^Review .*revises the offer/}).click();await page.getByRole('button',{name:/^Accept trade/}).click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('ballknower_solo_franchise_v2')).tradeInbox.decisions.some(d=>d.id===id&&d.status==='accepted'),revisedId);
  for(let i=0;i<10&&await page.getByRole('dialog').count();i++)await page.getByRole('dialog').locator('.bk-gm-event-choices button').last().click();
  await page.getByText('Weekly briefing',{exact:true}).click();await page.getByRole('heading',{name:'Relationship watch',exact:true}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/gm-briefing-${width}.png`});
  await page.goto('http://127.0.0.1:4198/?mode=owner');await page.getByRole('button',{name:'franchise',exact:true}).click();await page.getByRole('region',{name:'Owner finances'}).waitFor();await page.getByRole('button',{name:/^INVEST \$25M/}).click();const owner=await read('ballknower_owner_career_v3');assert.equal(owner.cashM,325);const entry=owner.financeHistory[0];assert.equal(entry.openingCashM+entry.decisionCashM+entry.revenueM-entry.staffExpenseM,entry.closingCashM);await page.getByText(/Cash movement ledger/).click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${out}/owner-finances-${width}.png`});await page.reload();assert.equal((await read('ballknower_owner_career_v3')).cashM,325);
  await page.goto('http://127.0.0.1:4198/?mode=agent');await page.getByRole('button',{name:'ENTER NEGOTIATION ROOM',exact:true}).click();const negotiation=page.getByRole('dialog');await negotiation.getByRole('heading',{name:'YOUR REQUEST · CONTRACT IMPACT',exact:true}).waitFor();await page.screenshot({path:`${out}/agent-negotiation-${width}.png`});await negotiation.getByRole('button',{name:/^ACCEPT CLUB OFFER/}).click();const agency=await read('ballknower_player_agent_v4');const client=agency.clients[0];assert.equal(client.playerId,await page.evaluate(()=>window.qaDepthPlayer));assert.equal(client.futureDeal.signingYear,2029);assert.equal(client.futureDeal.startYear,2030);assert.equal(client.currentTeam,await page.evaluate(()=>window.qaDepthDestination));await page.reload();assert.equal((await read('ballknower_player_agent_v4')).clients[0].currentTeam,client.currentTeam);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await context.close();console.log('PASS career depth fixtures: counter review/accept, trust briefing, reconciled owner cash, final-year agent renewal and traded-team restore',width);
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
