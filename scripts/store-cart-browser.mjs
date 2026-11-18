import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { mockCharacterPurchases } from './character-purchase-fixture.mjs';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4189'],{stdio:'ignore'});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4189')).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.BROWSER_PATH,args:['--no-sandbox']});
 for(const width of [320,390,1280]) {
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<768,hasTouch:width<768,serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if (width === 390) await mockCharacterPurchases(context, [], [{sku:'frostbite'}]);
  else await page.route('**/*.supabase.co/**',r=>r.abort());
  let enableProviders = false;
  const requests = [];
  const prices = { frostbite:100, 'tunnel-fit':299, 'gold-standard':299 };
  await page.route('**/api/**',r=>r.fulfill({json:{available:false,tracks:[]}}));
  await page.route('**/api/store-commerce*',route=>{
   if (route.request().method() === 'POST') {
    const body = route.request().postDataJSON();
    requests.push(body);
    const url = body.provider === 'stripe'
     ? 'https://checkout.stripe.com/bk-test'
     : 'https://www.sandbox.paypal.com/bk-test';
    return route.fulfill({json:{url}});
   }
   return route.fulfill({json:{stripe:enableProviders,paypal:enableProviders,signedIn:enableProviders,
    owned:[],available:enableProviders,wearables:[],catalogPrices:prices}});
  });
  await page.addInitScript(()=>{localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','2');});
  await page.goto('http://127.0.0.1:4189/?store_checkout=cancel');
  const dialog=page.getByRole('dialog',{name:'Your cart'});await dialog.waitFor();
  await dialog.getByText('Your cart is empty.',{exact:false}).waitFor();
  if (width === 320) {
   await dialog.getByRole('textbox',{name:'Character code'}).fill('FIXTURE-CODE');
   await dialog.getByRole('button',{name:'Redeem code'}).click();
   await dialog.locator('.bk-cart-code').getByRole('alert').getByText(/Sign in with the Apple account/).waitFor();
   await dialog.locator('.bk-cart-code').getByRole('button',{name:'Sign in',exact:true}).waitFor();
  }
  await dialog.getByRole('button',{name:'Continue shopping'}).click();
  await page.getByRole('button',{name:/view all tunnel fits/i}).click();
  await page.locator('[data-store-product="tunnel-fit"]').click();
  await page.getByRole('button',{name:'Add to cart',exact:true}).click();
  await page.getByText('Added to your cart',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Back to shop',exact:true}).click();
  await page.locator('[data-store-product="gold-standard"]').click();
  const goldActions = page.locator('dialog[data-bkf-collection="gold-standard"] .bkf-drop-actions');
  const preview = goldActions.getByRole('button',{name:'Preview in 3D',exact:true});
  const add = goldActions.getByRole('button',{name:'Add to cart',exact:true});
  await add.scrollIntoViewIfNeeded();
  const [previewBox,addBox] = await Promise.all([preview.boundingBox(),add.boundingBox()]);
  assert.ok(previewBox && addBox && Math.abs(previewBox.y-addBox.y)<2 && addBox.x>=previewBox.x+previewBox.width && addBox.height>=44);
  await add.click();
  await page.getByRole('button',{name:'View cart',exact:true}).click();
  await dialog.getByText('$5.98',{exact:true}).waitFor();
  assert.equal(await dialog.locator('.bk-cart-item').count(),2);
  assert.equal(await dialog.getByRole('button',{name:/Checkout · Card/}).isDisabled(),true);
  assert.equal(await dialog.getByRole('button',{name:'Checkout with PayPal'}).isDisabled(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.reload();await dialog.waitFor();await dialog.getByText('$5.98',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Remove Gray Standard',exact:true}).click();
  await dialog.getByText('$2.99',{exact:true}).first().waitFor();
  assert.equal(await dialog.locator('.bk-cart-item').count(),1);
  await page.screenshot({path:`/tmp/bk-cart-${width}.png`});
  await dialog.getByRole('button',{name:'Remove Gold Standard',exact:true}).click();
  await dialog.getByText('Your cart is empty.',{exact:false}).waitFor();
  if (width === 390) {
   await dialog.getByRole('button',{name:'Continue shopping'}).click();
   await page.getByRole('button',{name:'Shop Characters',exact:true}).click();
   await page.locator('[data-store-product="bk-femme"]').click();
   const nicki = page.locator('dialog[data-bkf-collection="bk-femme"]');
   await nicki.locator('.bkf-drop-actions').getByRole('button',{name:'Add to cart',exact:true}).click();
   await nicki.getByRole('button',{name:'Close product',exact:true}).click();
   await page.getByRole('button',{name:'Helmets',exact:true}).click();
   const helmet = page.getByRole('button',{name:'Add to cart · Gold Standard',exact:true});
   await helmet.click();
   assert.ok((await page.getByRole('button',{name:'View cart · Gold Standard',exact:true}).boundingBox())?.height >= 44);
   await page.getByRole('button',{name:/Back to Store/i}).filter({visible:true}).first().click();
   await page.getByRole('button',{name:'Shop Characters',exact:true}).click();
   await page.locator('[data-store-product="frostbite"]').click();
   await page.getByRole('button',{name:'Add to cart',exact:true}).click();
   await page.getByRole('button',{name:'View cart',exact:true}).click();
   await dialog.getByText('Frostbite',{exact:true}).waitFor();
   await dialog.getByText('BKF Nicki',{exact:true}).waitFor();
   await dialog.getByText('Gold Standard Helmet',{exact:true}).waitFor();
   assert.equal(await dialog.getByText('Saved for later · Checkout coming soon',{exact:true}).count(),2);
   await dialog.getByText('$1.00',{exact:true}).last().waitFor();
   assert.equal(await dialog.getByText('$1.00',{exact:true}).count(),2);
   enableProviders = true;
   await page.route('https://checkout.stripe.com/bk-test',route=>route.fulfill({body:'Stripe fixture'}));
   await page.route('https://www.sandbox.paypal.com/bk-test',route=>route.fulfill({body:'PayPal fixture'}));
   await dialog.getByRole('button',{name:'Refresh purchases'}).click();
   await dialog.getByText('Have a promo code? Enter it on the card checkout page.').waitFor();
   await dialog.getByRole('button',{name:/Checkout · Card/}).click();
   await page.waitForURL('https://checkout.stripe.com/bk-test');
   await page.goto('http://127.0.0.1:4189/?store_checkout=return');
   await dialog.getByRole('button',{name:'Checkout with PayPal'}).click();
   await page.waitForURL('https://www.sandbox.paypal.com/bk-test');
   assert.deepEqual(requests, [
    { action:'checkout', ids:['frostbite'], provider:'stripe' },
    { action:'checkout', ids:['frostbite'], provider:'paypal' },
   ]);
   enableProviders = false;
   await page.goto('http://127.0.0.1:4189/?store_checkout=return');
   await dialog.getByText('Payments are not open yet.',{exact:false}).waitFor();
   await dialog.getByRole('button',{name:'Remove BKF Nicki',exact:true}).click();
   await dialog.getByRole('button',{name:'Remove Gold Standard Helmet',exact:true}).click();
   await dialog.getByRole('textbox',{name:'Character code'}).fill('WRONG');
   await dialog.getByRole('button',{name:'Redeem code'}).click();
   await dialog.getByText('This character code is unavailable for your account.').waitFor();
   await dialog.getByRole('textbox',{name:'Character code'}).fill('FIXTURE-CODE');
   await dialog.getByRole('button',{name:'Redeem code'}).click();
   await dialog.getByText('Characters unlocked. 1 ready to play.').waitFor();
   await dialog.getByText('Your cart is empty.',{exact:false}).waitFor();
   await dialog.getByRole('button',{name:'Choose character in Profile',exact:true}).click();
   const guide = page.getByRole('dialog',{name:'Make every game count.',exact:true});
   await guide.waitFor();
   await page.keyboard.press('Escape');
   await guide.waitFor({state:'detached'});
   await page.getByRole('button',{name:'Switch character',exact:true}).click();
   const picker = page.getByRole('dialog',{name:'Switch game character',exact:true});
   const characters = picker.getByRole('combobox',{name:'Character',exact:true});
   await characters.locator('option[value="frostbite"]:enabled').waitFor({state:'attached'});
   await characters.selectOption('frostbite');
   assert.equal(await characters.locator('option[value="bkf-phantom"]').evaluate(option => option.disabled),true);
   await picker.getByRole('button',{name:'Save game character',exact:true}).click();
   await page.locator('.bk-profile-game-character').getByText('Frostbite',{exact:true}).waitFor();
   console.log('PASS private character code with payments disabled and unlocked character selectable in Profile');
   console.log('PASS Store character cart and mocked Stripe and PayPal checkout handoff');
  }
  assert.deepEqual(errors,[]);await context.close();console.log(`PASS ${width}px: add two, total, remove, refresh persistence, return route, disabled payments, no overflow/errors`);
 }
} finally {await browser?.close();server.kill();}
