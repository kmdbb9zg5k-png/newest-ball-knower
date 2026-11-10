import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const origin = process.env.STORE_TEST_ORIGIN || 'http://127.0.0.1:4188';
const server = process.env.STORE_TEST_ORIGIN ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4188'], {stdio:'ignore'});
let browser;
let stage = 'starting';
const checkpoint = value => { stage = value; console.log(value); };
const watchdog = setTimeout(() => { console.error('Store browser check stalled at: ' + stage); server?.kill('SIGKILL'); process.exit(1); }, 240000);
watchdog.unref();
try {
  for(let i=0;i<60;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
  await mkdir('artifacts/store-characters',{recursive:true});
  browser = await chromium.launch({executablePath:process.env.BROWSER_PATH || '/usr/bin/chromium', args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
  for(const width of [320,390,1280]){
    checkpoint(`Viewport ${width}: opening context`);
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<768,hasTouch:width<768,serviceWorkers:'block'});
    const page=await context.newPage();page.setDefaultTimeout(60000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*.supabase.co/**',r=>r.abort());
    await page.route('**/api/**',r=>r.fulfill({json:{available:false,tracks:[]}}));
    await page.addInitScript(()=>{
      localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','2');
      localStorage.setItem('ballknower_solo_my_player_v2',JSON.stringify({version:1,stage:'combine',name:'Preserve Me',position:'WR',number:21,combineId:'recovery-test',overall:68}));
    });
    await page.goto(origin);
    await page.getByRole('navigation',{name:width<768?'Primary navigation':'Desktop primary navigation',exact:true}).getByRole('button',{name:'Store',exact:true}).click();
    const store=page.getByRole('region',{name:'Store',exact:true});await store.waitFor();
    await store.getByRole('heading',{name:'The Locker',exact:true}).waitFor();
    const departments=store.getByRole('group',{name:'Shop departments'});
    for (const img of await store.locator('.bk-store-product img').all()) {
      await img.scrollIntoViewIfNeeded(); await img.evaluate(i=>i.decode());
    }
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:`artifacts/store-characters/locker-${width}.png`});
    const headingBox=await store.getByRole('heading',{name:'The Locker',exact:true}).boundingBox();
    assert.ok(headingBox.y >= (width<768?58:110),'Locker title clears fixed navigation');
    for (const [name, expected, absent] of [['Characters','bkf-lowrider','tunnel-fit'],['Clothing','tunnel-fit','bkf-lowrider'],['Accessories','chrome-grip','bkf-lowrider']]) {
      await departments.getByRole('button',{name,exact:true}).click();
      assert.equal(await store.locator(`[data-store-product="${expected}"]`).count(),1);
      assert.equal(await store.locator(`[data-store-product="${absent}"]`).count(),0);
    }
    await departments.getByRole('button',{name:'All Items',exact:true}).click();
    await store.getByRole('button',{name:'Celebrations',exact:true}).click();
    assert.equal(await store.locator('[data-store-product="end-zone-backflip"]').count(),1);
    await departments.getByRole('button',{name:'Featured',exact:true}).click();
    const before=await page.evaluate(()=>localStorage.getItem('ballknower_solo_my_player_v2'));
    for(const id of (process.env.STORE_TEST_CHARACTERS?.split(',') || ['bkf-outlaw','bkf-kickflip','bkf-lowrider','bkf-iron-wolf'])){
      checkpoint(`${width}px ${id}: opening product`);
      const card=store.locator(`[data-store-product="${id}"]`);await card.scrollIntoViewIfNeeded();await card.locator('img').evaluate(i=>i.decode());await card.click();
      const dialog=page.locator(`[data-bkf-collection="${id}"]`);await dialog.waitFor();
      const tabs=dialog.getByRole('group',{name:'Product view'});assert.equal(await tabs.getByRole('button').count(),3);
      await dialog.locator('.bkf-drop-hero img').evaluate(i=>i.decode());
      assert.equal(await dialog.locator('.bkf-drop-hero img').evaluate(i=>getComputedStyle(i).objectFit),'contain');
      await dialog.screenshot({path:`artifacts/store-characters/${id}-${width}-poster.png`});
      await tabs.getByRole('button',{name:'Realistic view'}).click();await dialog.locator('.bkf-drop-hero img').evaluate(i=>i.decode());
      assert.ok((await dialog.locator('.bkf-drop-hero img').getAttribute('src')).includes(id+'-look'));
      checkpoint(`${width}px ${id}: loading 3D`);
      await tabs.getByRole('button',{name:'3D preview'}).click();
      const preview=dialog.locator('[data-character-model]');await preview.locator('canvas').waitFor();
      await page.waitForFunction(id=>document.querySelector(`[data-bkf-collection="${id}"] [data-render-state]`)?.getAttribute('data-render-state')!=='loading',id);
      assert.equal(await preview.getAttribute('data-render-state'),'ready');
      checkpoint(`${width}px ${id}: rendering front and rotation`);
      await preview.screenshot({path:`artifacts/store-characters/${id}-${width}-front.png`});
      const canvas=preview.locator('canvas');const front=await canvas.screenshot();
      for(let i=0;i<6;i++)await preview.getByRole('button',{name:'Rotate right',exact:true}).click();
      assert.notDeepEqual(await canvas.screenshot(),front,'360 controls change rendered view');
      await preview.screenshot({path:`artifacts/store-characters/${id}-${width}-back.png`});
      await preview.getByRole('button',{name:'Reset rotation'}).click();
      assert.ok(await dialog.evaluate(d=>d.scrollWidth<=d.clientWidth+1),'No horizontal dialog overflow');
      if(width===390){
        checkpoint(`${width}px ${id}: context-loss recovery`);
        await canvas.evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
        await preview.getByRole('button',{name:'Retry 3D'}).click();
        await page.waitForFunction(id=>document.querySelector(`[data-bkf-collection="${id}"] [data-render-state]`)?.getAttribute('data-render-state')==='ready',id);
      }
      checkpoint(`${width}px ${id}: leaving 3D`);
      await tabs.getByRole('button',{name:'Full poster'}).click();assert.equal(await preview.count(),0,'3D unmounts on tab exit');
      await dialog.getByRole('button',{name:'Close product',exact:true}).click();
    }
    assert.equal(await page.evaluate(()=>localStorage.getItem('ballknower_solo_my_player_v2')),before,'Saved athlete preserved');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    assert.deepEqual(errors,[]);console.log(`PASS ${width}px: all character posters, photos, 3D rotation, disposal, saved athlete isolation`);
    checkpoint(`${width}px: closing context`);
    await context.close();
  }
} catch (error) {
  console.error('Failed at: ' + stage, error); throw error;
} finally {
  checkpoint('Closing browser');
  await browser?.close(); server?.kill(); clearTimeout(watchdog);
}
