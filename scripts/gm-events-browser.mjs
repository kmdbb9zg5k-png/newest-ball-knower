import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,webkit} from 'playwright';
import {prepareGmEventsFixture,out} from './gm-events-fixture.mjs';
const html=await prepareGmEventsFixture();
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://local').pathname;if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return;}const file=resolve(path.startsWith('/artifacts/')||path.startsWith('/dist/')?'.':'public','.'+path);try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(4188,'127.0.0.1',r));
const launchOptions=process.env.BK_CHROMIUM_MODULE?await (async()=>{const {default:c}=await import(process.env.BK_CHROMIUM_MODULE);return{headless:true,executablePath:await c.executablePath(),args:c.args}})():{headless:true};
let browser;
try{
 for(const [name,engine,widths] of [['chromium',chromium,[320,390,1280]],['webkit',webkit,[390]]]){
  if(process.env.BK_QA_ENGINE && process.env.BK_QA_ENGINE!==name)continue;
  browser=await engine.launch(name==='chromium'?launchOptions:{headless:true});
  for(const width of process.env.BK_QA_WIDTHS?process.env.BK_QA_WIDTHS.split(',').map(Number):widths){
   const context=await browser.newContext({viewport:{width,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/**',r=>r.fulfill({json:{available:false}}));
   await page.addInitScript(()=>{window.qaPulses=[];Object.defineProperty(navigator,'vibrate',{configurable:true,value:pattern=>{window.qaPulses.push(pattern);return true}})});
   await page.goto('http://127.0.0.1:4188');let dialog=page.getByRole('dialog');await dialog.waitFor();
   assert.equal(await dialog.getByRole('heading',{name:'Your receiver wants a bigger role'}).count(),1);
   assert.equal(await page.evaluate(()=>window.qaPulses.length),1,'StrictMode must not duplicate vibration');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
   assert.equal(await dialog.evaluate(e=>Math.round(e.getBoundingClientRect().height)),844);
   assert.equal(await page.evaluate(()=>document.body.style.position),'fixed');
   assert.ok(await dialog.getByRole('button',{name:'Close GM alert'}).evaluate(e=>e.getBoundingClientRect().height>=44));
   await page.screenshot({path:`${out}/${name}-${width}.png`});
   await page.keyboard.press('Shift+Tab');assert.ok(await dialog.evaluate(e=>e.contains(document.activeElement)),'Focus must stay in modal');
   await dialog.getByRole('button',{name:'Close GM alert'}).click();await dialog.waitFor({state:'hidden'});
   assert.equal(await page.locator('output').innerText(),'','Closing must not resolve a decision');
   assert.equal(await page.evaluate(()=>document.body.style.position),'');
   await page.getByRole('button',{name:'Review Your receiver wants a bigger role'}).click();await dialog.waitFor();
   assert.equal(await page.evaluate(()=>window.qaPulses.length),1,'Manual review must not repeat haptics');
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   await page.getByRole('button',{name:'Review Your receiver wants a bigger role'}).click();
   await dialog.getByRole('button',{name:/Promise a larger role/}).evaluate(b=>{b.click();b.click()});
   await page.getByRole('heading',{name:'A starter will miss two weeks'}).waitFor();assert.equal(await page.locator('output').innerText(),'meeting');
   await dialog.getByRole('button',{name:'Acknowledge update',exact:false}).click();await page.getByRole('heading',{name:'Save failure recovery'}).waitFor();
   await dialog.getByRole('button',{name:'Save decision',exact:false}).click();await page.getByRole('alert').waitFor();
   await dialog.getByRole('button',{name:'Save decision',exact:false}).click();await dialog.waitFor({state:'hidden'});
   await page.reload();assert.equal(await dialog.count(),0,'Resolved events must not replay after refresh');
   await page.getByRole('button',{name:'Next season'}).click();await dialog.waitFor();assert.equal(await page.evaluate(()=>window.qaPulses.length),1,'Same event in a new season must notify');
   assert.deepEqual(errors,[]);await context.close();console.log('PASS alert queue, close/review/Escape, duplicate taps, persistence, failure recovery, haptics and layout',name,width);
  }
  await browser.close();browser=null;
 }
 browser=await chromium.launch(launchOptions);const page=await browser.newPage({viewport:{width:390,height:844}});await page.route('**/api/**',r=>r.fulfill({json:{available:false}}));
 await page.addInitScript(()=>{Object.defineProperty(navigator,'vibrate',{configurable:true,value:()=>{throw Error('Unsupported haptics')}})});
 await page.goto('http://127.0.0.1:4188/?real=1');await page.getByRole('button',{name:'START SEASON',exact:true}).click();
 for(let week=1;week<=2;week++){
  for(let count=0;count<20;count++){const dialog=page.getByRole('dialog');if(await dialog.count()){await dialog.locator('.bk-gm-event-choices button').first().click();await page.waitForTimeout(100);continue;}const simulate=page.getByRole('button',{name:`SIMULATE WEEK ${week}`,exact:true});if(await simulate.isEnabled().catch(()=>false)){await simulate.click();break;}await page.waitForTimeout(100);}
  await page.waitForFunction(w=>JSON.parse(localStorage.getItem('ballknower_solo_franchise_v2:season')||'null')?.weeks?.length===w,week).catch(async()=>{const data=await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.endsWith(':season')).map(k=>({k,weeks:JSON.parse(localStorage.getItem(k)).weeks?.length})) );throw Error('Season progress key check: '+JSON.stringify(data));});
 }
 for(let count=0;count<20;count++){if(await page.getByRole('button',{name:/Accept trade/}).count())break;const dialog=page.getByRole('dialog');if(await dialog.count())await dialog.locator('.bk-gm-event-choices button').first().click();await page.waitForTimeout(100);}
 await page.getByRole('button',{name:/Accept trade/}).waitFor();const before=await page.evaluate(()=>Object.entries(localStorage).find(([k,v])=>{try{return JSON.parse(v)?.tradeInbox?.pending}catch{return false}}));const save=JSON.parse(before[1]),offer=save.tradeInbox.pending;
 await page.getByRole('button',{name:/Accept trade/}).click();
 await page.waitForFunction(({key,id})=>JSON.parse(localStorage.getItem(key)).tradeInbox.decisions.some(d=>d.id===id&&d.status==='accepted'),{key:before[0],id:offer.id});
 const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),before[0]);assert(after.roster.some(p=>p.id===offer.incomingId));assert(!after.roster.some(p=>p.id===offer.outgoingId));assert(after.opponentRosters[offer.partner].some(p=>p.id===offer.outgoingId));
 await page.reload();assert.equal(await page.getByRole('button',{name:/Accept trade/}).count(),0);console.log('PASS actual Franchise Command two weeks, incoming trade accept, both rosters and reload; throwing haptics safe');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
