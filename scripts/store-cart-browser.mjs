import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4189'],{stdio:'ignore'});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4189')).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 for(const width of [320,390,1280]) {
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<768,hasTouch:width<768,serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*.supabase.co/**',r=>r.abort());
  await page.route('**/api/**',r=>r.fulfill({json:{stripe:false,paypal:false,owned:[],available:false,tracks:[]}}));
  await page.addInitScript(()=>{localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','2');});
  await page.goto('http://127.0.0.1:4189/?store_checkout=cancel');
  const dialog=page.getByRole('dialog',{name:'Your cart'});await dialog.waitFor();
  await dialog.getByText('Your cart is empty.',{exact:false}).waitFor();
  await dialog.getByRole('button',{name:'Continue shopping'}).click();
  await page.locator('[data-store-product="tunnel-fit"]').click();
  await page.getByRole('button',{name:'Add to cart',exact:true}).click();
  await page.getByText('Added to your cart',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Back to shop',exact:true}).click();
  await page.locator('[data-store-product="gold-standard"]').click();
  await page.getByRole('button',{name:'Add to cart',exact:true}).click();
  await page.getByRole('button',{name:'View cart',exact:true}).click();
  await dialog.getByText('$5.98',{exact:true}).waitFor();
  assert.equal(await dialog.locator('.bk-cart-item').count(),2);
  assert.equal(await dialog.getByRole('button',{name:/Checkout · Card/}).isDisabled(),true);
  assert.equal(await dialog.getByRole('button',{name:'Checkout with PayPal'}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.reload();await dialog.waitFor();await dialog.getByText('$5.98',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Remove Tunnel Fit',exact:true}).click();
  await dialog.getByText('$2.99',{exact:true}).first().waitFor();
  assert.equal(await dialog.locator('.bk-cart-item').count(),1);
  await page.screenshot({path:`/tmp/bk-cart-${width}.png`});
  await dialog.getByRole('button',{name:'Remove Gold Standard',exact:true}).click();
  await dialog.getByText('Your cart is empty.',{exact:false}).waitFor();
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}px: add two, total, remove, refresh persistence, return route, disabled payments, no overflow/errors`);
 }
} finally {await browser?.close();server.kill();}
