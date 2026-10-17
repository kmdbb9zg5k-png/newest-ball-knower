import assert from 'node:assert/strict';
import {createServer} from 'vite';import {chromium} from 'playwright';import {mkdir,writeFile} from 'node:fs/promises';
import {ROUTES} from '../combine/routes.js';
await mkdir('artifacts/man-coverage',{recursive:true});
const server=process.env.MAN_URL?null:await createServer({server:{host:'127.0.0.1',port:3088}});await server?.listen();
const base=process.env.MAN_URL||'http://127.0.0.1:3088';
const browser=await chromium.launch({executablePath:'/tmp/bk-browser/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const p=await browser.newPage({viewport:{width:390,height:680},deviceScaleFactor:.75,isMobile:true,hasTouch:true});p.setDefaultTimeout(90000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.clock.install();await p.addInitScript(()=>{window.requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),100);window.cancelAnimationFrame=clearTimeout;});
 await p.goto(base+'/combine.html?drill=one-on-one');await p.waitForFunction(()=>document.querySelector('.skill-hud')&&!document.querySelector('.skill-hud').inert);await p.clock.pauseAt(await p.evaluate(()=>Date.now()+100));
 for(const size of [{width:320,height:568},{width:844,height:390},{width:390,height:680}]){await p.setViewportSize(size);await p.clock.runFor(500);for(const sel of ['.skill-top','.route-title','.route-bottom']){const b=await p.locator(sel).boundingBox();assert(b.x>=0&&b.y>=0&&b.x+b.width<=size.width+1&&b.y+b.height<=size.height+1,sel+' clipped');}await p.screenshot({path:`artifacts/man-coverage/idle-${size.width}.png`});}
 assert.equal(await p.getByLabel('Catch ball').count(),0);await p.getByRole('button',{name:'START ROUTE →'}).dispatchEvent('click');await p.clock.runFor(4000);assert.equal(await p.locator('main').getAttribute('data-phase'),'preview');assert.equal(await p.locator('main').getAttribute('data-z'),'0');await p.screenshot({path:'artifacts/man-coverage/preview.png'});
 await p.getByLabel('Hold to pause').dispatchEvent('click',{detail:0});await p.clock.runFor(1000);await p.getByRole('button',{name:'RESUME',exact:true}).dispatchEvent('click');await p.clock.runFor(1100);
 const cdp=await p.context().newCDPSession(p),outcomes=[];
 for(let rep=0;rep<5;rep++){
  if(rep)await p.clock.runFor(5100);
  const name=await p.locator('h1').innerText(),route=ROUTES.find(r=>r.name===name).points;let point=1,tapped=false,dx=0,dz=1,prior=null;
  const j=await p.getByLabel('Movement joystick').boundingBox();let thumb={x:j.x+j.width/2,y:j.y+j.height/2-45,id:11};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[thumb]});
  for(let frame=0;frame<140;frame++){
   const s=await p.locator('main').evaluate(el=>({phase:el.dataset.phase,x:+el.dataset.x,z:+el.dataset.z,dbx:+el.dataset.defenderX,dbz:+el.dataset.defenderZ}));if(s.phase==='result')break;
   if(s.phase==='running'){
    assert.equal(await p.getByLabel('Catch ball').count(),0);let target=route[point];if(point<route.length-1&&Math.hypot(s.x-target[0],s.z-target[1])<.4)target=route[++point];dx=target[0]-s.x;dz=target[1]-s.z;
    if(point===route.length-1){dx=route.at(-1)[0]-route.at(-2)[0];dz=route.at(-1)[1]-route.at(-2)[1];}
   }
   if(s.phase==='flight'&&!tapped){const c=await p.getByLabel('Catch ball').boundingBox(),finger={x:c.x+c.width/2,y:c.y+c.height/2,id:12};await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[thumb,finger]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[finger]});assert.equal(await p.getByLabel('Catch ball').getAttribute('aria-pressed'),'true');tapped=true;await p.screenshot({path:`artifacts/man-coverage/rep-${rep+1}-release.png`});}
   if(prior&&['flight','settle'].includes(prior.phase)&&s.phase!=='result')assert(Math.hypot(s.x-prior.x,s.z-prior.z)>.25,'WR stopped with held thumb');
   const n=Math.max(.01,Math.hypot(dx,dz));thumb={...thumb,x:j.x+j.width/2-dx/n*45,y:j.y+j.height/2-dz/n*45};await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[thumb]});
   if(frame%5===0)await p.screenshot({path:`artifacts/man-coverage/rep-${rep+1}-frame-${String(frame).padStart(3,'0')}.png`});
   prior=s;await p.clock.runFor(100);
  }
  assert(tapped,'QB never threw');await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[thumb]});await p.getByRole('dialog',{name:'Route result'}).waitFor();const result=await p.locator('.skill-dialog').innerText();outcomes.push({name,result});console.log('REP',rep+1,result.replaceAll('\n',' | '));await p.screenshot({path:`artifacts/man-coverage/rep-${rep+1}-result.png`});if(rep<4)await p.getByRole('button',{name:'NEXT ROUTE',exact:true}).dispatchEvent('click');
 }
 assert.match(await p.locator('.skill-dialog').innerText(),/SESSION COMPLETE/);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('bk-man-coverage-v1')).length),1);await p.getByRole('button',{name:'NEW SESSION',exact:true}).dispatchEvent('click');assert.equal(await p.locator('main').getAttribute('data-phase'),'idle');assert.deepEqual(errors,[]);await writeFile('artifacts/man-coverage/playthrough.json',JSON.stringify(outcomes,null,2));console.log('PASS five-rep real touch session, preview/pause, mobile layouts, catches, movement, save/reset and no browser errors');
}finally{await browser.close();await server?.close();}
