/** Render the recorded regressions through the real controller and athlete rig. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve(process.env.BK_CONTACT_OUT||'/tmp/bk-contact-possession');await mkdir(out,{recursive:true});
const fixture=`window.bkContactReview={rig:meshy,actors:()=>actors,glance(){const d=actors[19];for(const p of actors)if(p.team&&p!==d){p.x=22;p.z=carrier.z-20}d.x=carrier.x+.65;d.z=carrier.z-.1;d.heading=carrier.heading;beginGlancingContact(carrier,d,simTime,'broken');jukeUntil=simTime+1;return d.index},pick(){if(!flight)return false;const d=actors[19];flight.to=[d.x,1.6,d.z];flight.t=.995;numSeed=634785765;return true}};window.bk3dTest={`;
const server=createServer(async(req,res)=>{try{const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error('path');let data=await readFile(name);if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('window.bk3dTest={',fixture));res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.webp':'image/webp','.glb':'model/gltf-binary'})[extname(name)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1108,height:430},deviceScaleFactor:1,hasTouch:true,isMobile:true});page.setDefaultTimeout(90000);const errors=[],report={playbook:[],glance:[],pick:[]};page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?qa=1`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready,{timeout:45000});
 for(const [width,height]of[[1108,430],[844,390],[667,320]]){
  await page.setViewportSize({width,height});
  await page.locator('#playbookGrid').evaluate(el=>{el.style.scrollSnapType='none';el.scrollTop=el.clientHeight*.46});
  const layout=await page.locator('#playbookGrid').evaluate(el=>{const grid=el.getBoundingClientRect(),card=el.querySelector('.play-card'),heading=card.querySelector('.play-card-heading').getBoundingClientRect();return{scroll:el.scrollTop,gridTop:grid.top,headingTop:heading.top,headingBottom:heading.bottom,cardBottom:card.getBoundingClientRect().bottom,overflow:document.documentElement.scrollWidth>innerWidth}});
  assert.ok(layout.scroll>0);assert.ok(layout.headingTop>=layout.gridTop-1&&layout.headingBottom<layout.cardBottom,'Title detached from its partially scrolled diagram');assert.equal(layout.overflow,false);report.playbook.push({width,height,...layout});await page.screenshot({path:`${out}/playbook-${width}.png`});
  await page.locator('#playbookGrid').evaluate(el=>{el.scrollTop=0;el.style.scrollSnapType=''});
 }
 await page.setViewportSize({width:1108,height:430});await page.locator('#breakHuddle').dispatchEvent('click');await page.keyboard.down('ArrowUp');await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:1});await page.evaluate(()=>window.bk3dTest.step(1.6));assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().phase),'run');
 await page.evaluate(()=>window.bkContactReview.glance());
 for(let i=0;i<9;i++){
  await page.evaluate(()=>window.bk3dTest.step(.1));const d=await page.evaluate(()=>window.bk3dDiagnostics());report.glance.push({time:d.simTime,runner:d.players[6],defender:d.players[19]});assert.equal(d.players[19].fallen,false);assert.equal(d.glError,0);if([0,2,5,8].includes(i))await page.screenshot({path:`${out}/broken-${i}.png`});
 }
 assert.equal(report.glance[0].defender.contactWith,6);assert.equal(report.glance[5].defender.contactWith,null);await page.keyboard.up('ArrowUp');
 // Restart, throw, and resolve the real interception branch with deterministic coverage/roll.
 await page.locator('#restart').dispatchEvent('click');await page.locator('#filterPass').dispatchEvent('click');await page.locator('#call-pass-1').dispatchEvent('click');await page.locator('#breakHuddle').dispatchEvent('click');await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:2});await page.evaluate(()=>{window.bk3dTest.step(.8);window.bk3dTest.throwTo(8,'bullet')});
 assert.equal(await page.locator('#catchChoices').isVisible(),true);await page.locator('[data-catch="secure"]').dispatchEvent('click');assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().catchStyle),'secure');await page.screenshot({path:`${out}/windup-catch-choice.png`});await page.evaluate(()=>window.bk3dTest.step(.23));assert.equal(await page.evaluate(()=>window.bkContactReview.pick()),true);
 for(let i=0;i<13;i++){
  await page.evaluate(()=>window.bk3dTest.step(.1));const d=await page.evaluate(()=>window.bk3dDiagnostics());const owner=d.players.find(p=>p.hasBall);assert.equal(d.phase,'dead');assert.equal(owner.team,1);assert.equal(d.players.filter(p=>p.hasBall).length,1);assert.equal(d.glError,0);report.pick.push({time:d.simTime,owner,states:d.athletes.states});if([0,2,5,9,12].includes(i))await page.screenshot({path:`${out}/pick-${i}.png`});
 }
 assert.equal(report.pick[2].owner.action,'interception');assert.ok(report.pick[2].states.includes('interception'));assert.equal(report.pick.at(-1).owner.action,null);assert.equal(report.pick.at(-1).owner.ballTarget,null);assert.deepEqual(errors,[]);
 await writeFile(out+'/report.json',JSON.stringify({report,errors},null,2));console.log(JSON.stringify({status:'PASS',playbook:report.playbook,output:out}));
}finally{await browser.close();await new Promise(r=>server.close(r))}
