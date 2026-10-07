/** Recording regressions exercised through the actual two full-game controllers. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {cpuFourthDown,cpuPassProbability} from '../public/play-moment-3d/cpu-offense.js';
import {contactFinishPose} from '../public/play-moment-3d/contact-motion.js';
for(const clock of [120,90,74,65,30]){
 assert.equal(cpuFourthDown({ball:25,down:4,toGo:8,clock,deficit:3}),'go');
 assert(cpuPassProbability({clock,deficit:3,toGo:9})>.9);
}
assert.equal(cpuFourthDown({ball:25,down:4,toGo:8,clock:240,deficit:3}),'punt');
assert.equal(cpuFourthDown({ball:80,down:4,toGo:8,clock:74,deficit:3}),'field-goal');
assert.equal(cpuFourthDown({ball:80,down:4,toGo:8,clock:74,deficit:7}),'go');
const finishes=['wrap','drag-down','low-wrap','shoulder-hit'].map(contactVariant=>contactFinishPose({contactVariant,contactRole:'carrier',actionSide:1}));
assert.equal(new Set(finishes.map(p=>JSON.stringify(p))).size,4);

const out=resolve(process.env.OUT||'artifacts/oct6-gameplay'),root=resolve('public');await mkdir(out,{recursive:true});
const injection=`window.oct6={
 start(pass){liveUnit?.stop();mini=fullSession(miniConfig.mode,true);mini.possession='away';mini.awayScore=27;drive={...initialDrive,score:30,clock:120};paused=false;ended=false;startUnit('defense');rand=()=>pass?.5:.99;},
 tick(n=1,render=false){for(let i=0;i<n;i++){simulate(1/60);camera(1/60);}if(render)present(1/60,1);return this.sample();},
 sample(){const u=liveUnit.state;return{stage:u?.stage,carrier:u?.carrier,time:u?.time,flight:!!u?.flight,windup:u?.windup,button:document.querySelector('#unitPrimary').textContent,players:actors.map(p=>({index:p.index,role:p.role,x:p.x,z:p.z,hasBall:p.hasBall,throwT:p.throwT,ballTarget:p.ballTarget,action:p.action,engaged:p.engaged,head:r.project([p.x,2.1,p.z]),foot:r.project([p.x,0,p.z])})),gl:r.gl.getError()};},
 shortPass(){const u=liveUnit.state;u.stage='pass';u.pass=true;u.book=false;u.snapTime=u.time-1.4;u.windup=u.time-.04;u.target=6;u.quickRelease=true;u.controlled=21;u.manualMovement=true;u.manualSelectionAt=u.time;u.cooldown=u.time+10;rand=()=>.5;
  for(const p of actors){p.hasBall=false;p.engaged=false;p.unitBlock=null;p.unitShedUntil=u.time+10;if(p.index>=11){p.x=23;p.z=u.snapZ+35;}}
  actors[5].hasBall=true;actors[6].startX=1;actors[6].startZ=actors[5].z+1;u.route={routes:Array.from({length:5},()=>[[0,0],[0,0]])};liveUnit.refresh();},
 contact(variant='wrap'){liveUnit?.stop();mini=fullSession(miniConfig.mode,true);mini.possession='away';drive={...initialDrive};startUnit('defense');const u=liveUnit.state;u.book=false;u.stage='run';u.carrier=6;u.controlled=16;for(const p of actors){p.hasBall=false;p.x=(p.index-10)*2;p.z=75;}
  Object.assign(actors[6],{x:0,z:45,vx:0,vz:5,heading:0,hasBall:true});Object.assign(actors[16],{x:.75,z:45,vx:-5,vz:1,heading:-1.5});liveUnit.reviewTackle(actors[16],actors[6],false,{reason:'TACKLED',gain:10});actors[6].contactVariant=actors[16].contactVariant=variant;const v=liveUnit.view();camEye=[...v.eye];camTarget=[...v.target];r.fov=v.fov;present(1/60,1);},
 bones(){return [6,16].map(id=>{const p=presentationActors[id]||actors[id],h=meshy.handTransforms.get(id),m=meshy.modelFor(p);return{id,chest:[...mul(m,h.chest)].slice(12,15),hands:[h.left,h.right].map(v=>[...mul(m,v)].slice(12,15))};});},
 offense(){liveUnit?.stop();mini=fullSession(miniConfig.mode,true);drive={...initialDrive};setup();},
};`;
const server=createServer(async(req,res)=>{try{
 const file=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+'/'))throw Error('path');let data=await readFile(file);
 if(file.endsWith('/game.js'))data=Buffer.from(data.toString().replace('const rand=()=>','let rand=()=>').replace('random:rand,','random:()=>rand(),').replace('window.bk3dTest={',injection+'window.bk3dTest={'));
 if(file.endsWith('/live-units.js'))data=Buffer.from(data.toString().replace('return {start,tick,','return {reviewTackle:beginTackle,start,tick,'));
 res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.glb':'model/gltf-binary'})[extname(file)]||'application/octet-stream');res.end(data);
}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const report=[],errors=[];
try{
 for(const mode of ['two-minute','five-minute']){
  const page=await browser.newPage({viewport:{width:1108,height:512},isMobile:true,hasTouch:true});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/play-moment-3d-preview.html?qa=1&mode='+mode+'&team=SAC&opponent=OMA');await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready);
  await page.evaluate(()=>window.oct6.start(false));await page.locator('#unitConfirm').count().then(async n=>{if(n)await page.locator('#unitConfirm').dispatchEvent('click');else await page.getByRole('button',{name:'CALL DEFENSE',exact:false}).dispatchEvent('click');});
  const run=await page.evaluate(()=>{const frames=[];for(let i=0;i<125;i++)frames.push(window.oct6.tick());return frames;});
  assert(run.some(f=>f.stage==='handoff'));const carrying=run.filter(f=>f.stage==='run');assert(carrying.length>2);assert(carrying.every(f=>f.carrier===6&&f.players.filter(p=>p.hasBall).length===1&&f.players[6].hasBall));
  assert(Math.hypot(carrying.at(-1).players[5].x-carrying[0].players[5].x,carrying.at(-1).players[5].z-carrying[0].players[5].z)<.2,'Released QB must stay out of the tackle scrum');
  await page.evaluate(()=>{window.oct6.start(true);window.oct6.shortPass();});
  const pass=await page.evaluate(()=>{const frames=[];for(let i=0;i<105;i++)frames.push(window.oct6.tick());return frames;});
  const flying=pass.filter(f=>f.stage==='flight');assert(flying.length>4);assert(flying.every(f=>f.players.filter(p=>p.hasBall).length===0&&f.button==='SWAT'));
  const complete=pass.filter(f=>f.stage==='run');assert(complete.length>5,'Short pass must complete');assert(complete.every(f=>f.carrier===6&&f.players[6].hasBall&&f.players.filter(p=>p.hasBall).length===1));assert.equal(complete.at(-1).players[5].throwT,0,'Throw pose must finish after a short completion');assert(complete.every(f=>f.button==='TACKLE'));
  await page.evaluate(()=>window.oct6.tick(1,true));await page.screenshot({path:out+'/'+mode+'-completion.jpg'});
  const contact=[];
  for(const variant of ['wrap','drag-down','low-wrap','shoulder-hit','dive','gang','big-hit']){
   await page.evaluate(v=>window.oct6.contact(v),variant);
   for(const frame of [12,20,35]){const s=await page.evaluate(n=>window.oct6.tick(n,true),frame);assert.equal(s.gl,0);assert.equal(s.stage,'contact');for(const id of [6,16]){const p=s.players[id];assert(p.head.y>50&&p.foot.y<512-55,JSON.stringify({variant,id,head:p.head,foot:p.foot}));}contact.push({variant,time:s.time,bones:await page.evaluate(()=>window.oct6.bones())});if(frame===35){const bones=await page.evaluate(()=>window.oct6.bones());assert(bones[0].chest[1]<.5,'Runner must land on the turf: '+JSON.stringify(bones));}if(frame===35)await page.screenshot({path:out+'/'+mode+'-'+variant+'.jpg'});}
  }
  await page.evaluate(()=>window.oct6.offense());const layouts=[];
  for(const [width,height]of[[1108,512],[1108,444],[844,390],[667,320]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>window.oct6.tick(1,true));
   const layout=await page.evaluate(()=>{const grid=document.querySelector('#playbookGrid');grid.scrollTop=0;const g=grid.getBoundingClientRect(),footer=document.querySelector('.playbook-footer').getBoundingClientRect(),cards=[...grid.children].map(el=>{const r=el.getBoundingClientRect(),svg=el.querySelector('svg').getBoundingClientRect();return{top:r.top,bottom:r.bottom,svg:svg.height};});return{top:g.top,bottom:g.bottom,footer:footer.top,cards,overflow:document.documentElement.scrollWidth>innerWidth};});
   const visible=layout.cards.filter(p=>p.top<layout.bottom-1);assert(visible.length>=3);assert(visible.every(p=>p.bottom<=layout.bottom+1&&p.svg>=25),'Only complete, readable rows may appear above the footer: '+JSON.stringify(layout));assert(layout.bottom<=layout.footer+1);assert.equal(layout.overflow,false);
   await page.locator('#playbookGrid').evaluate(el=>el.scrollTop=el.scrollHeight);assert(await page.locator('.play-card').last().evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return a.bottom<=b.bottom+1&&a.top>=b.top-1;}),'Final row reachable');layouts.push({width,height,visible:visible.length});await page.screenshot({path:out+'/'+mode+'-book-'+width+'x'+height+'.jpg'});
  }
  report.push({mode,runFrames:run.length,passFrames:pass.length,flightFrames:flying.length,contact,layouts});console.log('PASS',mode,'possession, release, controls, contact framing and four mobile layouts');await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({status:'PASS',report,errors},null,2));console.log('PASS October 6 regression suite');
}finally{await browser.close();server.close();}
