// Runs on GitHub Actions. All auth and AI responses below are isolated fixtures.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { chromium, webkit } from 'playwright';
import { prepareSupportingFixture, supportingOut } from './supporting-ui-fixture.mjs';
const html=await prepareSupportingFixture();
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://fixture').pathname;
 if(path==='/'){res.setHeader('Content-Type','text/html');res.end(html);return}
 try{res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css'})[extname(path)]||'application/octet-stream');res.end(await readFile(resolve('.','.'+path)))}catch{res.writeHead(404).end()}
});
await new Promise(resolve=>server.listen(4190,'127.0.0.1',resolve));
let browser;
try{
 for(const [name,engine,widths] of [['chromium',chromium,[320,390,1280]],['webkit',webkit,[390]]]){
  browser=await engine.launch({headless:true});
  for(const width of widths){
   const page=await browser.newPage({viewport:{width,height:844}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
   // Functional fixtures must not wait for unrelated third-party fonts/assets.
   await page.route(/^https?:\/\/(?!127\.0\.0\.1(?::|\/)|localhost(?::|\/))/,route=>route.abort());
   await page.goto('http://127.0.0.1:4190/',{waitUntil:'domcontentloaded'});const help=page.getByRole('button',{name:'How it works',exact:true});await help.click();const dialog=page.getByRole('dialog',{name:'Franchise Command instructions',exact:true});await dialog.waitFor();
   assert.equal(await page.evaluate(()=>document.body.style.position),'fixed');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
   await page.keyboard.press('Shift+Tab');assert(await dialog.evaluate(node=>node.contains(document.activeElement)));
   await page.screenshot({path:`${supportingOut}/help-${name}-${width}.png`});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await help.evaluate(node=>node===document.activeElement));assert.equal(await page.evaluate(()=>document.body.style.position),'');
   await help.click();await dialog.waitFor();await dialog.getByRole('button',{name:'Got it',exact:true}).click();await dialog.waitFor({state:'hidden'});
   let calls=0;let releaseResponse;
   await page.route('**/api/ask-bk',async route=>{const attempt=++calls;if(attempt===1)await new Promise(resolve=>{releaseResponse=resolve});await route.fulfill({json:{answer:attempt===1?'Old response must be discarded':'Current response'}}).catch(()=>{})});
   await page.goto('http://127.0.0.1:4190/?mode=ask');const question=page.getByRole('textbox',{name:'Ask BK question'});await question.fill('Explain PPR scoring.');
   const ask=page.getByRole('button',{name:'Ask BK',exact:true});const sent=page.waitForRequest('**/api/ask-bk');await ask.evaluate(button=>{button.click();button.click()});await sent;await page.getByRole('button',{name:'Stop answer'}).waitFor();assert.equal(calls,1);
   await page.getByRole('button',{name:'Stop answer'}).click();assert.equal(await question.inputValue(),'Explain PPR scoring.');assert.equal(await question.isEnabled(),true);
   await question.fill('Explain a legal football catch.');await ask.click();await page.getByText('Current response',{exact:true}).waitFor();releaseResponse?.();await page.waitForTimeout(100);
   assert.equal(await page.getByText('Old response must be discarded',{exact:true}).count(),0);assert.equal(calls,2);assert.equal(await question.inputValue(),'');
   await page.screenshot({path:`${supportingOut}/ask-${name}-${width}.png`});
   await page.goto('http://127.0.0.1:4190/?mode=ask&slowAuth=1');await question.fill('Explain a blitz.');await ask.click();await page.getByRole('button',{name:'Stop answer'}).click();await page.getByRole('button',{name:'Release authentication'}).click();await page.waitForTimeout(100);assert.equal(calls,2,'Stopping while auth waits must prevent a later AI request');assert.equal(await question.inputValue(),'Explain a blitz.');
   await page.goto('http://127.0.0.1:4190/?mode=ask&slowAuth=1&shortDeadline=1');await question.fill('Explain a punt.');await ask.click();await page.getByRole('alert').filter({hasText:'took too long'}).waitFor();assert.equal(await question.isEnabled(),true);assert.equal(await question.inputValue(),'Explain a punt.');await page.getByRole('button',{name:'Release authentication'}).click();await page.waitForTimeout(100);assert.equal(calls,2,'An expired auth wait must not issue a late request');
   assert.deepEqual(errors,[]);await page.close();console.log('PASS help focus/scroll/Escape and Ask BK duplicate taps, cancellation, stale responses, blocked auth and deadline',name,width);
  }
  await browser.close();browser=null;
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
