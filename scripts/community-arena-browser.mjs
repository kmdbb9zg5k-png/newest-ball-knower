import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const base=process.env.BK_BROWSER_URL||'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const errors=[];
try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
    localStorage.setItem('ball-knower-intro-completed-v1','1');
    localStorage.setItem('ball-knower-team-setup-v2','1');
  });
  await page.goto(base,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Community'}).click();
  await page.getByRole('heading',{name:'Know ball together'}).waitFor();
  assert.equal(await page.locator('.vite-error-overlay').count(),0);
  assert.ok(await page.getByRole('button',{name:'Save or sign in'}).isVisible());
  assert.ok(await page.getByRole('button',{name:'Play solo trivia instead'}).isVisible());
  assert.ok(await page.getByRole('button',{name:'Community'}).last().isVisible());
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(overflow<=1,`Mobile Community overflows horizontally by ${overflow}px`);
  await page.screenshot({path:'/tmp/bk-community-mobile.png',fullPage:true});

  await page.setViewportSize({width:1280,height:900});
  await page.reload({waitUntil:'networkidle'});
  await page.getByRole('button',{name:'Community'}).click();
  await page.getByRole('heading',{name:'Know ball together'}).waitFor();
  assert.ok(await page.getByRole('button',{name:'Community'}).isVisible());
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'/tmp/bk-community-desktop.png',fullPage:true});
  console.log('Community browser check passed: mobile + desktop guest entry, nav, safe-area layout and no runtime errors.');
}finally{await browser.close();}
