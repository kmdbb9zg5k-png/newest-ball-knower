import assert from 'node:assert/strict';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

// Temporary fixture mounts the actual production components, not copied renderer logic.
// It is created only during the test and is never a production route.
const html = '.solo-player-photos-check.html', fixture = '.solo-player-photos-check.tsx';
const out = 'artifacts/solo-player-photos', base = 'http://127.0.0.1:4191';
await writeFile(html, '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="photo-root"></div><script type="module" src="/'+fixture+'"></script></body></html>');
await writeFile(fixture, `
import React,{useLayoutEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {SoloPortrait,SoloCharacter,useAppearance} from './solo/SoloPresentation';
import {appearanceKey,defaultAppearance,saveAppearance} from './solo/appearance';
import './solo/soloPresentation.css';
const players=[{id:'photo-check-a',name:'Photo Alpha',team:'JCY',position:'WR',jerseyNumber:11},{id:'photo-check-b',name:'Photo Beta',team:'BRK',position:'WR',jerseyNumber:21},{id:'bk-001-eli-rodriguez',name:'Eli Rodriguez',team:'JCY',position:'WR',jerseyNumber:11}];
for(const [index,player] of players.entries())if(!localStorage.getItem(appearanceKey(player.id)))saveAppearance(player,{...defaultAppearance(player),face:index===0?1:index===1?7:5});
window.__photoFrames=[];
function Fixture(){
 const [selected,setSelected]=useState(0),[trade,setTrade]=useState(false),[body,setBody]=useState(false);
 const player={...players[selected],team:trade?'SFO':players[selected].team};
 const look=useAppearance(player);
 useLayoutEffect(()=>{window.__photoFrames.push({id:player.id,face:document.querySelector('#portrait .bk-solo-portrait')?.getAttribute('data-face')});},[player.id]);
 return <main>
  <h1>Solo photo checks</h1><div className="controls">
   <button onClick={()=>setSelected(0)}>Player A</button><button onClick={()=>setSelected(1)}>Player B</button><button onClick={()=>setSelected(2)}>Eli</button>
   <button onClick={()=>setTrade(value=>!value)}>Trade</button><button onClick={()=>saveAppearance(player,{...look,face:5})}>Save face</button>
   <button onClick={()=>setBody(true)}>Show preview</button>
  </div><p>{player.name} / {player.team}</p><div id="portrait"><SoloPortrait player={player}/></div>
  {body&&<div id="model" style={{marginTop:1400,width:230,maxWidth:'100%',marginInline:'auto'}}><SoloCharacter player={player} look={look}/></div>}
 </main>;
}
const style=document.createElement('style');style.textContent='body{margin:0;background:#090f18;color:#eee;font-family:Arial}main{padding:16px;box-sizing:border-box;width:100%}.controls{display:flex;flex-wrap:wrap;gap:8px}button{min-height:44px;padding:8px;border:1px solid #777;border-radius:6px;background:#171e29;color:#fff}h1{font-size:20px}';document.head.append(style);
createRoot(document.getElementById('photo-root')).render(<React.StrictMode><Fixture/></React.StrictMode>);
`);
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4191', '--strictPort'], { stdio: 'ignore' });
let browser;
const results = [];
try {
  let ready = false;
  for (let i=0;i<120;i++) { try { if ((await fetch(base+'/'+html)).ok) { ready=true;break; } } catch {} await new Promise(resolve=>setTimeout(resolve,200)); }
  assert(ready,'Fixture server must start');
  await mkdir(out,{recursive:true});
  browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
  for (const width of [320,390,1280]) {
    const context = await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1,isMobile:width<768,hasTouch:width<768,reducedMotion:'reduce'});
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('request',request=>requests.push(request.url()));
    try {
      await page.goto(base+'/'+html,{waitUntil:'networkidle'});
      for(let i=0;i<6;i++) { await page.getByRole('button',{name:'Player B',exact:true}).click(); await page.getByRole('button',{name:'Player A',exact:true}).click(); }
      const frames=await page.evaluate(()=>window.__photoFrames);
      assert(frames.length>=12);
      assert(frames.every(frame=>frame.face===(frame.id==='photo-check-a'?'1':'7')),'Reused rows must never commit another player\'s face, even before passive effects');
      await page.getByRole('button',{name:'Save face',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#portrait .bk-solo-portrait')?.getAttribute('data-face')==='5');
      await page.getByRole('button',{name:'Trade',exact:true}).click();
      assert.equal(await page.locator('#portrait .bk-solo-portrait').getAttribute('data-face'),'5');
      await page.reload({waitUntil:'networkidle'});
      assert.equal(await page.locator('#portrait .bk-solo-portrait').getAttribute('data-face'),'5','Saved face survives reload');
      await page.getByRole('button',{name:'Eli',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#portrait img')?.naturalWidth>0);
      const ratio=await page.locator('#portrait .bk-solo-portrait').evaluate(parent=>{const p=parent.getBoundingClientRect(),i=parent.querySelector('img').getBoundingClientRect();return {width:i.width/p.width,height:i.height/p.height};});
      assert(Math.abs(ratio.width-1)<.01&&Math.abs(ratio.height-1)<.01,'Eli is a single photo, not a 300% atlas crop');
      await page.screenshot({path:out+'/creator-portrait-'+width+'.png'});
      assert.equal(requests.filter(url=>/\/(body|regions)\.webp/.test(url)).length,0,'Portrait rows must not load full-body art');
      const atlasBefore=requests.filter(url=>url.endsWith('/faces.webp')).length;
      await page.getByRole('button',{name:'Show preview',exact:true}).click();
      await page.waitForTimeout(150);
      assert.equal(await page.locator('#model [data-render-state]').getAttribute('data-render-state'),'waiting');
      assert.equal(requests.filter(url=>/\/(body|regions)\.webp/.test(url)).length,0,'Offscreen model waits before fetching body assets');
      await page.locator('#model').scrollIntoViewIfNeeded();
      await page.locator('#model [data-render-state="ready"]').waitFor();
      assert.equal(requests.filter(url=>url.endsWith('/faces.webp')).length,atlasBefore,'Creator renderer does not load the generic face atlas');
      await page.locator('#model').screenshot({path:out+'/creator-body-'+width+'.png'});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
      assert.deepEqual(errors,[]);
      results.push({width,prePaintIdentity:true,saveTradeReload:true,singlePortraitRatio:ratio,lazyBodyRequests:true});
    } catch(error) { await page.screenshot({path:out+'/failure-'+width+'.png'}).catch(()=>{});throw error; }
    finally { await context.close(); }
  }
  // Separate browser context resets module caches so failures exercise real network requests.
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try {
    const page=await context.newPage();
    await page.route('**/solo-characters/v1/body.webp',route=>route.abort());
    await page.goto(base+'/'+html,{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'Show preview',exact:true}).click();
    await page.locator('#model').scrollIntoViewIfNeeded();
    await page.locator('#model [data-render-state="error"]').waitFor();
    assert.equal(await page.locator('.bk-solo-character-fallback .bk-solo-portrait').getAttribute('data-face'),'1','Body failure retains the SAME player headshot');
    await page.locator('#model').screenshot({path:out+'/same-player-fallback-390.png'});
    await page.unroute('**/solo-characters/v1/body.webp');
    await page.getByRole('button',{name:'Retry preview',exact:true}).click();
    await page.locator('#model [data-render-state="ready"]').waitFor();
    await page.locator('#model').screenshot({path:out+'/recovered-preview-390.png'});
    results.push({bodyFailureFallback:true,retryRecovered:true});
  } finally { await context.close(); }
  const missing=await browser.newContext({viewport:{width:390,height:844}});
  try {
    const page=await missing.newPage();
    await page.route('**/solo-characters/v1/creator/eli-face.webp',route=>route.abort());
    await page.goto(base+'/'+html,{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'Eli',exact:true}).click();
    await page.getByRole('button',{name:'Show preview',exact:true}).click();
    await page.locator('#model').scrollIntoViewIfNeeded();
    await page.locator('#model [data-render-state="error"]').waitFor();
    assert.equal(await page.locator('.bk-solo-character-fallback .bk-solo-art-fallback').textContent(),'ER');
    assert.equal(await page.locator('.bk-solo-character-fallback img').count(),0,'A missing creator photo cannot silently become someone else');
    results.push({missingCreatorNeverSubstitutesFace:true});
  } finally { await missing.close(); }
  await writeFile(out+'/results.json',JSON.stringify({results,coverage:'Production shared components in a temporary browser fixture; existing six-mode browser audit runs separately.',newArtworkGenerated:false,visualFidelityApproved:false,physicalIphoneVerified:false},null,2));
  console.log('PASS: photo identity before paint; save/trade/reload; creator crop geometry; deferred body assets; same-player fallback; retry; missing creator handling. No visual-fidelity signoff.');
} finally {
  await browser?.close();server.kill();
  await Promise.all([rm(html,{force:true}),rm(fixture,{force:true})]);
}
