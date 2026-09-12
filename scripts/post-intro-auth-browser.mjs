import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.BK_BROWSER_URL||'http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true});

try{
  await mkdir('artifacts/post-intro-auth',{recursive:true});
  for(const viewport of [{width:390,height:844},{width:430,height:932}]){
    const context=await browser.newContext({viewport,isMobile:true,hasTouch:true});
    const page=await context.newPage();
    const crashes=[];
    page.on('pageerror',error=>crashes.push(error.message));
    await page.route('**/api/**',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({tracks:[],introUrl:null})}));
    await page.route('**/auth/v1/settings',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({external:{google:true,apple:true}})}));
    await page.addInitScript(()=>{
      localStorage.removeItem('ball-knower-intro-completed-v1');
      localStorage.removeItem('ball-knower-team-setup-v2');
      localStorage.setItem('ball-knower-intro-sound-v1','off');
    });
    await page.goto(base,{waitUntil:'domcontentloaded'});
    const launch=page.locator('[data-auth-presentation="launch"]');
    await launch.waitFor();
    await page.getByRole('button',{name:'Continue with Google'}).waitFor();
    assert.equal(await page.locator('#close-auth-modal-btn').count(),0,'first-launch auth must use the intentional guest button instead of a floating close icon');
    assert.ok(await page.getByRole('button',{name:'Continue with Apple'}).isVisible());
    assert.ok(await page.getByRole('button',{name:'Continue with Email'}).isVisible());
    const guest=page.getByRole('button',{name:'Keep Playing As Guest'});
    assert.ok(await guest.isVisible());
    const touchBox=await guest.boundingBox();
    assert.ok(touchBox&&touchBox.height>=44,'guest option must remain a practical mobile touch target');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<=1,`Auth screen overflows horizontally by ${overflow}px`);
    assert.equal(await page.locator('.vite-error-overlay').count(),0);
    await page.screenshot({path:`artifacts/post-intro-auth/auth-${viewport.width}.png`,fullPage:true});
    await guest.click();
    await page.getByTestId('favorite-team-notice').waitFor();
    assert.equal(await launch.count(),0,'guest choice must advance into favorite-team setup');
    assert.deepEqual(crashes,[]);
    await context.close();
  }
  console.log('Post-intro auth browser check passed at 390/430px: automatic handoff, provider choices, guest continuation, favorite-team sequencing, touch size, overflow, and runtime stability.');
}finally{await browser.close()}
