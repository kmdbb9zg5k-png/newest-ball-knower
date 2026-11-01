import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {createServer,enterCombineSetup} from './combine-browser-entry.mjs';
const server=await createServer({server:{host:'127.0.0.1',port:3097}});await server.listen();
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
await mkdir('artifacts/dash-session',{recursive:true});
try{
 const p=await browser.newPage({viewport:{width:390,height:680},isMobile:true,hasTouch:true,deviceScaleFactor:.6});p.setDefaultTimeout(90000);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install();
 await p.addInitScript(()=>{window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),100);window.cancelAnimationFrame=clearTimeout;});
 await p.goto('http://127.0.0.1:3097/combine.html');await enterCombineSetup(p);
 await p.waitForFunction(()=>document.querySelector('.combine-action')&&!document.querySelector('.combine-action').disabled);
 await p.clock.pauseAt(await p.evaluate(()=>Date.now()+100));
 for(const size of [{width:320,height:568},{width:844,height:390},{width:390,height:680}]){
  await p.setViewportSize(size);await p.clock.runFor(100);
  for(const selector of ['.combine-action','.combine-athlete']){const b=await p.locator(selector).boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=size.width+1&&b.y+b.height<=size.height+1,selector+' clipped');}
 }
 for(let attempt=0;attempt<2;attempt++){
  console.log('Starting dash attempt',attempt+1);
  await p.locator('.combine-action').dispatchEvent('click');
  for(let t=0;t<80&&(await p.locator('.combine-game').getAttribute('data-phase'))!=='running';t++)await p.clock.runFor(100);
  assert.equal(await p.locator('.combine-game').getAttribute('data-phase'),'running');
  for(let t=0;t<100&&(await p.locator('.combine-game').getAttribute('data-phase'))==='running';t++){
   await p.locator('.combine-stride[data-next="true"]').dispatchEvent('pointerdown',{bubbles:true,button:0,pointerId:77,pointerType:'touch'});
   await p.clock.runFor(250);
  }
  console.log('Finish reached',await p.locator('.combine-game').getAttribute('data-phase'));
  // Preserve the normal 3.8-second finish celebration before the results open.
  await p.clock.runFor(4200);
  const next=p.getByRole('button',{name:attempt===0?/SECOND ATTEMPT/:/NEW SESSION/});await next.waitFor();
  await p.screenshot({path:`artifacts/dash-session/result-${attempt+1}.png`});
  const records=await p.evaluate(()=>JSON.parse(localStorage.getItem('bk-combine-forty-v1')));
  assert.equal(records.length,attempt+1);assert(records.at(-1).splits[2]>3&&records.at(-1).splits[2]<10);
  await next.dispatchEvent('click');
 }
 assert.equal(await p.locator('.combine-game').getAttribute('data-phase'),'idle');assert.deepEqual(errors,[]);
 console.log('PASS dash saved-athlete entry, three mobile sizes, two control-driven complete runs, saved splits and New Session reset');
}catch(error){for(const p of browser.contexts().flatMap(c=>c.pages())){console.error(await p.locator('body').innerText().catch(()=>'<unavailable>'));await p.screenshot({path:'artifacts/dash-session/failure.png'}).catch(()=>{});}throw error;}finally{await browser.close();await server.close();}
