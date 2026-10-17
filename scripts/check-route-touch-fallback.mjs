import assert from 'node:assert/strict';
import {createServer} from 'vite';import {chromium} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:3087}});await server.listen();
const browser=await chromium.launch({executablePath:'/tmp/bk-browser/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:390,height:680},isMobile:true,hasTouch:true,deviceScaleFactor:.6});p.setDefaultTimeout(90000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install();await p.addInitScript(()=>{window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),100);window.cancelAnimationFrame=clearTimeout;});await p.goto('http://127.0.0.1:3087/combine.html?drill=routes');await p.waitForFunction(()=>document.querySelector('.skill-hud')&&!document.querySelector('.skill-hud').inert);await p.clock.pauseAt(await p.evaluate(()=>Date.now()+1000));
 await p.getByRole('button',{name:'START ROUTE →'}).dispatchEvent('click');await p.clock.runFor(5000);
 const cdp=await p.context().newCDPSession(p),joy=await p.getByLabel('Movement joystick').boundingBox();const thumb={x:joy.x+joy.width/2-45,y:joy.y+joy.height/2,id:11};
 await p.evaluate(()=>{window.touchLog=[];for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture'])window.addEventListener(type,e=>window.touchLog.push({type,id:e.pointerId,target:e.target.className,x:e.clientX,y:e.clientY}));});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[thumb]});let tapped=false,previousX=0;
 for(let i=0;i<110;i++){
  const state=await p.locator('main').evaluate(el=>({phase:el.dataset.phase,x:Number(el.dataset.x)}));if(state.phase==='result')break;
  if(i>2)assert(state.x>previousX+.3,JSON.stringify({i,state,previousX,thumb,details:await p.evaluate(()=>({events:window.touchLog,stick:document.querySelector('.route-stick i')?.style.transform}))}));previousX=state.x;
  if(state.phase==='flight'&&!tapped){const b=await p.getByLabel('Catch ball').boundingBox();const finger={x:b.x+b.width/2,y:b.y+b.height/2,id:12};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[thumb,finger]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[finger]});assert.equal(await p.getByLabel('Catch ball').getAttribute('aria-pressed'),'true');tapped=true;await p.screenshot({path:'artifacts/receiver-routes/wrong-route-touch-pass.png'});}
  await p.clock.runFor(100);
 }
 assert(tapped,'Missing the entire route must still produce a throw');assert(previousX>25,'Run must cross both old movement bounds');await p.getByRole('dialog',{name:'Route result'}).waitFor();assert.match(await p.locator('.skill-dialog').innerText(),/Caught/);assert.doesNotMatch(await p.locator('.skill-dialog').innerText(),/ROUTE TIMEOUT/);assert.deepEqual(errors,[]);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 console.log('PASS real two-finger touch: wrong-route fallback throw, catch input, uninterrupted movement past 25 m, completed rep and no browser errors');
}finally{await browser.close();await server.close();}
