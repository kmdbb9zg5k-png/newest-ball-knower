import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const url=process.env.TARGET_URL||'http://127.0.0.1:3000/combine.html?drill=broad-jump';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/tmp/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'],proxy:url.startsWith('https:')&&process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},ignoreHTTPSErrors:true});page.setDefaultTimeout(60000);
 await page.goto(url);await page.waitForFunction(()=>document.querySelector('.jump-power')&&!document.querySelector('.combine-hud').inert);
 for(const viewport of [{width:320,height:568},{width:844,height:390},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  const boxes=await page.locator('.jump-buttons button').evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  assert(boxes[0].right<boxes[1].x);for(const b of boxes){assert(b.x>=0&&b.y>=0&&b.right<=viewport.width&&b.bottom<=viewport.height);}
 }
 await page.evaluate(()=>{const buttons=document.querySelectorAll('.jump-power');buttons.forEach((b,i)=>b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,isPrimary:i===0,pointerId:i+1})));});
 await page.waitForFunction(()=>Number(document.querySelector('.jump-track').getAttribute('aria-valuenow'))===8);
 await page.evaluate(()=>{for(const id of [1,2])window.dispatchEvent(new PointerEvent('pointerup',{pointerId:id}));});

 const result=await page.evaluate(()=>new Promise((resolve,reject)=>{
  let last=0,aimSeen=false,flightSeen=false,heldTest=false,locked=null;
  const end=performance.now()+90000;
  const down=b=>b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,isPrimary:true}));
  const up=()=>window.dispatchEvent(new PointerEvent('pointerup'));
  const tap=b=>{down(b);up();};
  function frame(now){try{
   if(now>end)throw Error('Attempt timed out');
   const phase=document.querySelector('.combine-game').dataset.phase,power=document.querySelector('.jump-power'),timing=document.querySelector('.jump-timing'),meter=Number(document.querySelector('.jump-track').getAttribute('aria-valuenow'));
   if(phase==='finished'){resolve({aimSeen,flightSeen,heldTest});return;}
   if(phase==='power'&&now-last>65){const buttons=document.querySelectorAll('.jump-power');if(buttons.length!==2||timing)throw Error('Expected two power buttons only');tap(buttons[0]);tap(buttons[1]);last=now;}
   if(phase==='aim'){
    aimSeen=true;if(power||!timing)throw Error('Power buttons must disappear');const box=timing.getBoundingClientRect();if(Math.abs(box.x+box.width/2-innerWidth/2)>2)throw Error('Timing button not centered');
    if(!timing.disabled){up();down(timing);heldTest=true;}
   }
   if(phase==='flight'){
    flightSeen=true;
    if(!document.querySelector('.jump-ring'))throw Error('Missing landing ring');
    if(!timing.disabled&&meter<70){down(timing);if(timing.textContent==='PERFECT')throw Error('Held press consumed landing');}
    if(meter>=78&&meter<=98&&!timing.disabled){up();tap(timing);}
    if(timing.textContent==='PERFECT'){if(timing.dataset.landing!=='perfect')throw Error('Expected perfect landing');if(locked===null)locked=meter;if(locked!==meter)throw Error('Meter moved after lock');tap(timing);}
   }
   requestAnimationFrame(frame);
  }catch(e){reject(e);}}
  requestAnimationFrame(frame);
 }));
 assert(result.aimSeen&&result.flightSeen&&result.heldTest,JSON.stringify(result));await page.getByRole('dialog',{name:'Broad jump results'}).waitFor();assert.match(await page.locator('.combine-result').innerText(),/Perfect landing/);
 console.log('PASS two power buttons, centered replacement, held-input rejection, landing ring, green landing and permanent lock');
 await page.getByRole('button',{name:'NEXT ATTEMPT'}).click();await page.getByRole('button',{name:'Left power',exact:true}).click();await page.getByRole('button',{name:'NEW SESSION'}).waitFor();assert.equal(await page.locator('.jump-attempts>div').count(),2);assert.match(await page.locator('.combine-result').innerText(),/3-second launch timer expired/);console.log('PASS launch expiry and two attempts');
}finally{await browser.close();}
