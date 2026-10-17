import assert from 'node:assert/strict';import {createServer} from 'vite';import {chromium} from 'playwright';import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('artifacts/db-drill',{recursive:true});const remote=process.env.DB_URL,realtime=!!process.env.DB_REALTIME;
const server=remote?null:await createServer({server:{host:'127.0.0.1',port:3091}});await server?.listen();const base=remote||'http://127.0.0.1:3091';
const browser=await chromium.launch({executablePath:'/tmp/bk-browser/chromium',...(remote&&process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY}}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:390,height:680},deviceScaleFactor:.6,isMobile:true,hasTouch:true,ignoreHTTPSErrors:!!remote});p.setDefaultTimeout(90000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 if(!realtime){await p.clock.install();await p.addInitScript(()=>{window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),100);window.cancelAnimationFrame=clearTimeout;});}
 await p.goto(base+'/combine.html?drill=db');await p.waitForFunction(()=>document.querySelector('.skill-hud')&&!document.querySelector('.skill-hud').inert);
 const advance=ms=>realtime?p.waitForTimeout(ms):p.clock.runFor(ms);if(!realtime)await p.clock.pauseAt(await p.evaluate(()=>Date.now()+100));
 for(const size of [{width:320,height:568},{width:844,height:390},{width:390,height:680}]){await p.setViewportSize(size);await advance(500);for(const sel of ['.skill-top','.route-title','.route-bottom']){const b=await p.locator(sel).boundingBox();assert(b.x>=0&&b.y>=0&&b.x+b.width<=size.width+1&&b.y+b.height<=size.height+1,sel+' clipped');}await p.screenshot({path:`artifacts/db-drill/idle-${size.width}.png`});}
 const original=await p.locator('.route-athlete span').innerText();await p.getByLabel('Next athlete').click();assert.notEqual(await p.locator('.route-athlete span').innerText(),original);
 await p.getByRole('button',{name:'START COVERAGE →'}).dispatchEvent('click');assert.equal(await p.getByLabel('Swat pass').count(),0);assert.equal(await p.getByLabel('Intercept pass').count(),0);
 await advance(3000);assert.equal(await p.locator('main').getAttribute('data-phase'),'preview');assert.equal(await p.locator('main').getAttribute('data-x'),'0');await p.screenshot({path:'artifacts/db-drill/preview.png'});
 // A genuine OS touch cancellation pauses the rep rather than silently losing movement.
 await p.getByLabel('Movement joystick').evaluate(el=>{const r=el.getBoundingClientRect(),t=new Touch({identifier:909,target:el,clientX:r.x+r.width/2,clientY:r.y+10});el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[t],changedTouches:[t]}));el.dispatchEvent(new TouchEvent('touchcancel',{bubbles:true,changedTouches:[t],touches:[]}));});
 assert.equal(await p.getByRole('heading',{name:'PAUSED',exact:true}).count(),1);await advance(500);assert.equal(await p.locator('main').getAttribute('data-phase'),'preview');await p.getByRole('button',{name:'RESUME',exact:true}).dispatchEvent('click');
 await p.getByLabel('Hold to pause').dispatchEvent('click',{detail:0});await advance(500);await p.getByRole('button',{name:'RESUME',exact:true}).dispatchEvent('click');
 const cdp=await p.context().newCDPSession(p),outcomes=[];const reps=realtime?1:5;
 for(let rep=0;rep<reps;rep++){
  if(realtime)await p.waitForFunction(()=>document.querySelector('main').dataset.phase==='running');else await advance(rep?5100:2200);
  const joy=await p.getByLabel('Movement joystick').boundingBox();let thumb={x:joy.x+joy.width/2,y:joy.y+joy.height/2,id:11};await p.getByLabel('Movement joystick').evaluate(el=>el.addEventListener('pointerdown',e=>el.dataset.testPointer=String(e.pointerId),{once:true}));await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[thumb]});let tapped=false,prior=null,target=null,sawResult=false,settleFrames=0,settleStart=null,flightStart=null;
  for(let frame=0;frame<(realtime?900:140);frame++){
   const s=await p.locator('main').evaluate(el=>({phase:el.dataset.phase,x:+el.dataset.x,z:+el.dataset.z,rx:+el.dataset.receiverX,rz:+el.dataset.receiverZ,bx:+el.dataset.ballX,bz:+el.dataset.ballZ}));if(s.phase==='result'){sawResult=true;if(realtime&&flightStart)assert(Math.hypot(s.x-flightStart.x,s.z-flightStart.z)>3,'Real-time control stopped after the throw');if(settleStart&&!realtime)assert(Math.hypot(s.x-settleStart.x,s.z-settleStart.z)>5,'Held DB movement did not continue through follow-through');break;}
   if(s.phase==='running')assert.equal(await p.getByLabel('Swat pass').count(),0);
   if(s.phase==='flight'&&!tapped){flightStart=s;
    const action=rep%2?'Intercept pass':'Swat pass',b=await p.getByLabel(action).boundingBox(),finger={x:b.x+b.width/2,y:b.y+b.height/2,id:12};assert(b.height>=44);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[thumb,finger]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[thumb]});assert.equal(await p.getByLabel(action).getAttribute('aria-pressed'),'true');tapped=true;await p.screenshot({path:`artifacts/db-drill/rep-${rep+1}-flight.png`});
   }
   target=s.phase==='flight'?[s.bx,s.bz-.5]:s.phase==='settle'?[s.x,s.z+8]:[s.rx,s.rz+.45];const dx=target[0]-s.x,dz=target[1]-s.z,n=Math.max(.7,Math.hypot(dx,dz));thumb={...thumb,x:joy.x+joy.width/2-dx/n*45,y:joy.y+joy.height/2-dz/n*45};await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[thumb]});
   settleFrames=s.phase==='settle'?settleFrames+1:0;if(s.phase==='settle'&&!settleStart)settleStart=s;
   if(!realtime&&settleFrames>=3&&prior?.phase==='settle')assert(Math.hypot(s.x-prior.x,s.z-prior.z)>.005,'DB stopped during held follow-through: '+JSON.stringify({s,prior,thumb}));
   if(frame===2){
    const before=await p.locator('.route-stick i').getAttribute('style');
    await p.getByLabel('Movement joystick').evaluate(el=>{for(const type of ['pointercancel','lostpointercapture'])el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerType:'touch',pointerId:+el.dataset.testPointer}));});
    assert.equal(await p.locator('.route-stick i').getAttribute('style'),before,'Pointer lifecycle interruption cleared a held finger');
    const pos=await p.locator('main').evaluate(el=>[+el.dataset.x,+el.dataset.z]);await advance(300);
    const after=await p.locator('main').evaluate(el=>[+el.dataset.x,+el.dataset.z]);assert(Math.hypot(after[0]-pos[0],after[1]-pos[1])>.2,'DB stopped with finger still held');
   }
   if(frame%10===0)await p.screenshot({path:`artifacts/db-drill/rep-${rep+1}-frame-${String(frame).padStart(3,'0')}.png`});prior=s;await advance(100);
  }
  assert(tapped,'QB never threw');assert(sawResult,'Rep did not finish');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[thumb]});assert.match(await p.locator('.route-stick i').getAttribute('style'),/translate\(0px, 0px\)/,'Lift did not clear stick');const result=await p.locator('.skill-dialog').innerText();outcomes.push(result);console.log('REP',rep+1,result.replaceAll('\n',' | '));await p.screenshot({path:`artifacts/db-drill/rep-${rep+1}-result.png`});if(rep<reps-1)await p.getByRole('button',{name:'NEXT REP',exact:true}).dispatchEvent('click');
 }
 if(!realtime){assert.match(outcomes.at(-1),/SESSION COMPLETE/);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('bk-db-drill-v1')).length),1);await p.getByRole('button',{name:'NEW SESSION',exact:true}).dispatchEvent('click');assert.equal(await p.locator('main').getAttribute('data-phase'),'idle');}
 assert.deepEqual(errors,[]);await writeFile('artifacts/db-drill/playthrough.json',JSON.stringify(outcomes,null,2));console.log('PASS DB touch controls, swat/pick gating, athlete selection, mobile layouts, preview/pause and completed reps',JSON.stringify({base,realtime,reps}));
}finally{await browser.close();await server?.close();}
