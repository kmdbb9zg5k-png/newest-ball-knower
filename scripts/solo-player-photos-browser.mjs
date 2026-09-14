import assert from 'node:assert/strict';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const html='.solo-player-photos-check.html',fixture='.solo-player-photos-check.tsx';
const out='artifacts/solo-player-photos',base='http://127.0.0.1:4191';
await writeFile(html,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="photo-root"></div><script type="module" src="/'+fixture+'"></script></body></html>');
await writeFile(fixture,[
  "import React,{useState} from 'react';",
  "import {createRoot} from 'react-dom/client';",
  "import {SoloPortrait,SoloCharacter,useAppearance} from './solo/SoloPresentation';",
  "import {appearanceKey,defaultAppearance,saveAppearance} from './solo/appearance';",
  "import './solo/soloPresentation.css';",
  "const players=[{id:'solo-jcy-01',name:'Photo Alpha',team:'JCY',position:'QB',jerseyNumber:8},{id:'solo-brk-01',name:'Photo Beta',team:'BRK',position:'QB',jerseyNumber:12},{id:'bk-001-eli-rodriguez',name:'Eli Rodriguez',team:'JCY',position:'WR',jerseyNumber:11,age:30,heightInches:69,weightLbs:190}];",
  "function Fixture(){const [selected,setSelected]=useState(0),[trade,setTrade]=useState(false),[body,setBody]=useState(false);const player={...players[selected],team:trade?'AUS':players[selected].team};const look=useAppearance(player);return <main><h1>Solo v4 art checks</h1><div className=\"controls\"><button onClick={()=>setSelected(0)}>Player A</button><button onClick={()=>setSelected(1)}>Player B</button><button onClick={()=>setSelected(2)}>Eli</button><button onClick={()=>setTrade(value=>!value)}>Trade</button><button onClick={()=>saveAppearance(player,{...look,number:5})}>Save gear</button><button onClick={()=>setBody(true)}>Show preview</button></div><p>{player.name} / {player.team}</p><div id=\"portrait\"><SoloPortrait player={player}/></div>{body&&<div id=\"model\" style={{marginTop:1400,width:340,maxWidth:'100%',marginInline:'auto'}}><SoloCharacter player={player} look={look}/></div>}</main>}",
  "const style=document.createElement('style');style.textContent='body{margin:0;background:#090f18;color:#eee;font-family:Arial}main{padding:16px;box-sizing:border-box;width:100%}.controls{display:flex;flex-wrap:wrap;gap:8px}button{min-height:44px;padding:8px;border:1px solid #777;border-radius:6px;background:#171e29;color:#fff}h1{font-size:20px}';document.head.append(style);",
  "createRoot(document.getElementById('photo-root')).render(<React.StrictMode><Fixture/></React.StrictMode>);"
].join('\n'));
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4191','--strictPort'],{stdio:'ignore'});
let browser;const results=[];
try{
  let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/'+html)).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,200));}
  assert(ready,'Fixture server must start');await mkdir(out,{recursive:true});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined});
  for(const width of [320,390,1280]){
    const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1,isMobile:width<768,hasTouch:width<768,reducedMotion:'reduce'});
    const page=await context.newPage();const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>requests.push(request.url()));
    await page.route('**/api/simulated-player-art?*',route=>route.fulfill({status:202,contentType:'application/json',body:JSON.stringify({status:'missing',artVersion:4})}));
    try{
      await page.goto(base+'/'+html,{waitUntil:'networkidle'});
      assert.equal(await page.locator('#portrait [data-solo-player-id]').getAttribute('data-solo-player-id'),'solo-jcy-01');
      assert((await page.locator('#portrait').textContent()).includes('PA'));
      await page.getByRole('button',{name:'Player B',exact:true}).click();
      assert.equal(await page.locator('#portrait [data-solo-player-id]').getAttribute('data-solo-player-id'),'solo-brk-01');
      assert((await page.locator('#portrait').textContent()).includes('PB'),'A recycled row must never show the prior identity');
      await page.getByRole('button',{name:'Eli',exact:true}).click();
      await page.locator('#portrait img').waitFor();const ratio=await page.locator('#portrait .bk-solo-portrait').evaluate(parent=>{const p=parent.getBoundingClientRect(),i=parent.querySelector('img').getBoundingClientRect();return{width:i.width/p.width,height:i.height/p.height};});
      assert(Math.abs(ratio.width-1)<.01&&Math.abs(ratio.height-1)<.01);
      await page.screenshot({path:out+'/creator-portrait-'+width+'.png'});
      assert.equal(requests.filter(url=>url.endsWith('/full-body.webp')).length,0,'Roster portrait cannot preload full-body art');
      await page.getByRole('button',{name:'Show preview',exact:true}).click();await page.waitForTimeout(150);
      assert.equal(await page.locator('#model [data-render-state]').getAttribute('data-render-state'),'waiting');
      assert.equal(requests.filter(url=>url.endsWith('/full-body.webp')).length,0,'Offscreen full-body art must remain deferred');
      await page.locator('#model').scrollIntoViewIfNeeded();await page.locator('#model [data-render-state="ready"]').waitFor();
      assert.equal(requests.filter(url=>url.endsWith('/full-body.webp')).length,1);
      await page.locator('#model').screenshot({path:out+'/creator-body-'+width+'.png'});
      await page.getByRole('button',{name:'Trade',exact:true}).click();
      await page.waitForFunction(()=>document.querySelector('#portrait [data-art-state]')?.getAttribute('data-art-state')!=='ready');
      assert((await page.locator('#portrait').textContent()).includes('ER'),'Trade fallback must preserve Eli identity while requesting a new uniform');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
      results.push({width,immediateIdentitySwap:true,portraitOnlyUsesThumbnail:true,fullBodyLazyLoaded:true,tradeKeepsIdentityAndChangesUniformAsset:true});
    }finally{await context.close();}
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try{
    const page=await context.newPage();await page.route('**/api/simulated-player-art?*',route=>route.fulfill({status:202,contentType:'application/json',body:'{"status":"missing","artVersion":4}'}));await page.route('**/solo-characters/v2/eli-rodriguez/full-body.webp',route=>route.abort());
    await page.goto(base+'/'+html,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Eli',exact:true}).click();await page.getByRole('button',{name:'Show preview',exact:true}).click();await page.locator('#model').scrollIntoViewIfNeeded();await page.locator('#model [data-render-state="error"]').waitFor();
    assert.equal(await page.locator('.bk-solo-character-fallback .bk-solo-portrait img').count(),1,'Failed full body must retain the same player portrait');
    await page.locator('#model').screenshot({path:out+'/same-player-offline-fallback-390.png'});results.push({sameIdentityOfflineFallback:true});
  }finally{await context.close();}
  await writeFile(out+'/results.json',JSON.stringify({results,coverage:'Production v4 shared components; thumbnail/full-body separation, lazy loading, stable identity, trade uniform separation, offline same-player fallback.',approvedLocalPlayers:['bk-001-eli-rodriguez'],fullCatalogVisualFidelityApproved:false,physicalIphoneVerified:false},null,2));
  console.log('PASS: v4 identity swap, optimized portrait, lazy full body, trade separation, and same-person offline fallback.');
}finally{await browser?.close();server.kill();await Promise.all([rm(html,{force:true}),rm(fixture,{force:true})]);}
