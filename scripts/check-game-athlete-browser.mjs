import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { mockCharacterPurchases } from './character-purchase-fixture.mjs';

const output = 'artifacts/game-athlete-modes';
await mkdir(output,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:4194,strictPort:true}});
const base='http://127.0.0.1:4194';
let browser;
const launchBrowser=()=>chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try {
  browser=await launchBrowser();
  const demo=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,serviceWorkers:'block'});
  await demo.route('**/api/**',route=>route.fulfill({json:{available:false,tracks:[]}}));
  const matchedFrames=new Map();
  for(const comparison of ['reference','prototype']){
    const page=await demo.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.setDefaultTimeout(90000);
    await page.goto(base+'/play-moment-3d-preview.html?qa=1&manualFrames=1&mode=five-minute&team=MIL&opponent=SLC'+(comparison==='reference'?'&referenceRunner=1':''));
    await page.waitForFunction(expectPrototype=>{
      const rig=window.bk3dDiagnostics?.().athletes;
      return rig?.ready&&(!expectPrototype||rig.runnerPrototype.loaded||rig.runnerPrototype.error);
    },comparison==='prototype');
    await page.evaluate(()=>{window.bk3dTest.manualFrames();window.bk3dTest.seed(742)});
    await page.locator('#filterRun').click();
    await page.locator('#call-run-5').click();
    await page.locator('#breakHuddle').click();
    await page.keyboard.down('ArrowUp');
    await page.locator('#snap').dispatchEvent('pointerdown');
    let frame;
    for(const [label,step] of [['handoff',1.6],['carrying',.65]]){
      await page.evaluate(seconds=>window.bk3dTest.step(seconds),step);
      frame=await page.evaluate(()=>window.bk3dDiagnostics());
      assert.equal(frame.glError,0);
      assert.deepEqual(frame.athletes.runnerPrototype,{loaded:comparison==='prototype',draws:comparison==='prototype'?1:0,error:null});
      const play={id:frame.playId,phase:frame.phase,camera:frame.camera,players:frame.players.map(({x,z,hasBall})=>({x,z,hasBall}))};
      if(matchedFrames.has(label))assert.deepEqual(play,matchedFrames.get(label),'compare the same play with the same camera and player positions');
      else matchedFrames.set(label,play);
      await page.screenshot({path:output+'/running-back-'+comparison+'-'+label+'.png'});
    }
    if(comparison==='prototype'){
      await page.evaluate(()=>window.bk3dTest.resumeFrames());
      await page.waitForFunction(before=>window.bk3dDiagnostics().frames>before+2,frame.frames);
      await page.evaluate(()=>window.bk3dTest.manualFrames());
    }
    for(let i=0;i<24;i++){
      const state=await page.evaluate(()=>{window.bk3dTest.step(.32);return window.bk3dDiagnostics()});
      assert.equal(state.glError,0);
      if(state.drive.plays>0)break;
    }
    await page.keyboard.up('ArrowUp');
    assert.ok(await page.evaluate(()=>window.bk3dDiagnostics().drive.plays>0));
    assert.deepEqual(errors,[]);
    await page.close();
  }
  await demo.close();
  console.log('PASS authored running back, matched normal-camera frames, reference rig, and completed plays');
  // Release the comparison's SwiftShader contexts before the larger avatar suite.
  await browser.close();
  browser=await launchBrowser();
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,serviceWorkers:'block'});
  await context.route('**/api/**',route=>route.fulfill({json:{available:false,tracks:[]}}));
  const purchases = [
    { sku: 'bkf-kickflip', source: 'grant', expires_at: null },
    { sku: 'bkf-kickflip', source: 'purchase', expires_at: '2020-01-01T00:00:00Z' },
  ];
  await mockCharacterPurchases(context, purchases, [], {character:'bkf-kickflip',position:'RB',heightInches:75,weightLbs:245});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error'||message.text().includes('Store character unavailable'))console.log(message.text());});
  page.setDefaultTimeout(90000);
  await page.goto(base+'/combine.html?drill=dash&character=bkf-kickflip');
  await page.getByText(/Could not load your equipped character/).waitFor();
  assert.ok(await page.evaluate(() => !JSON.parse(localStorage.getItem('sb-gpnboygoosrmeydwjpvk-auth-token')).user.user_metadata.bk_game_athlete));
  assert.equal(await page.locator('[data-character="store-character"]').count(), 0);
  console.log('PASS expired and unpurchased unlocks cannot equip a character');
  purchases.push({ sku: 'bkf-kickflip', source: 'purchase', expires_at: null });
  for(const mode of ['two-minute','five-minute','arena']){
    await page.goto(base+'/play-moment-3d-preview.html?qa=1&manualFrames=1&mode='+mode);
    await page.waitForFunction(()=>window.bk3dDiagnostics?.().avatar.loaded);
    await page.evaluate(()=>window.bk3dTest.step(1/60));
    let state=await page.evaluate(()=>window.bk3dDiagnostics());
    assert.deepEqual(state.avatar,{character:'bkf-kickflip',slot:6,heightInches:75,weightLbs:245,loaded:true,draws:1});
    assert.equal(state.glError,0);
    if(mode!=='arena'){
      await page.locator('#restart').dispatchEvent('click');
      await page.locator('#filterRun').click();
      await page.locator('#call-run-5').click();
      await page.locator('#breakHuddle').click();
      await page.keyboard.down('ArrowUp');
      await page.locator('#snap').dispatchEvent('pointerdown');
      for(let i=0;i<18;i++){
        await page.evaluate(()=>window.bk3dTest.step(.35));
        state=await page.evaluate(()=>window.bk3dDiagnostics());
        assert.equal(state.glError,0);
        if(state.phase==='dead')break;
      }
      await page.keyboard.up('ArrowUp');
      assert.ok(state.drive.plays>0);
    }else{
      await page.evaluate(()=>window.bk3dTest.step(3));
      assert.equal((await page.evaluate(()=>window.bk3dDiagnostics())).glError,0);
    }
    console.log('PASS',mode,'custom rig, RB slot, dimensions, gameplay frame sequence');
    const capture=await context.newCDPSession(page);
    try{
      const {data}=await capture.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,optimizeForSpeed:true});
      await writeFile(output+'/'+mode+'.png',Buffer.from(data,'base64'));
    }finally{await capture.detach();}
  }
  for(const drill of ['dash','broad-jump','shuttle','bench','routes','one-on-one','rb','db']){
    await page.goto(base+'/combine.html?drill='+drill+'&character=bkf-phantom');
    assert.equal(await page.getByRole('button',{name:/Save & start|Switch character/}).count(),0);
    await page.waitForFunction(()=>document.querySelector('[data-character="store-character"] canvas'));
    await page.getByText(/BKF Kickflip/).first().waitFor();
    console.log('PASS',drill,'custom drill athlete');
  }
  assert.deepEqual(errors,[]);
}finally{
  await browser?.close();
  await new Promise(resolve=>server.httpServer.close(resolve));
}
