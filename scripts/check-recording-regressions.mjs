/** Reproduce the 07:54 phone recording through the real game/controller/rig. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve(process.env.OUT||'/tmp/bk-recording-review');await mkdir(out,{recursive:true});
const fixture=`window.recordingReview={
 reset(){liveUnit?.stop();conversionDrive=null;mini=fullSession(miniConfig.mode,true);drive={...initialDrive};paused=false;ended=false;miniUI.reset();mode='run';selected=0;setup(false);rand=()=>.5;camera(1);present(1/60,1);},
 frame(n=1){for(let i=0;i<n;i++){simulate(1/60);camera(1/60);}present(1/60,1);return this.sample();},
 sample(){const u=liveUnit?.state,b=actors[u?.carrier??carrier.index];return{stage:u?.stage||phase,kind:u?.kind,conversion:mini.conversion,kickoff:mini.kickoff,score:mini.awayScore,log:mini.log.map(p=>p.reason),controlled:u?.controlled,carrier:b.index,ball:exchange?.ball,contact:u?.contact||activeContact,eye:[...r.eye],target:[...r.target],players:actors.map(p=>({index:p.index,x:p.x,z:p.z,vx:p.vx,vz:p.vz,engaged:p.engaged,action:p.action,t:p.actionT,hasBall:p.hasBall})),bodies:presentationActors.filter(p=>p.contactRole||[2,5,6].includes(p.index)).map(p=>{const h=meshy.handTransforms.get(p.index),m=meshy.modelFor(p);return{index:p.index,fall:contactFallProgress(p),chest:h?.chest?Array.from(mul(m,h.chest)).slice(12,15):null,hands:h?[h.left,h.right].map(a=>Array.from(mul(m,a)).slice(12,15)):null,target:p.ballTarget};})};},
 run(id,keep=false){this.reset();selected=RUNS.findIndex(p=>p.id===id);setup(false);optionChoice=keep?'keep':'give';input.z=1;input.x=.08;snapDirection={x:.08,z:1};rand=()=>.99;snap();},
 unit(kind='defense'){this.reset();mini.possession='away';if(kind==='kickoff')mini.kickoff='home';startUnit(kind);const u=liveUnit.state;u.book=false;u.stage='run';u.carrier=6;u.controlled=16;u.time=2;u.manualMovement=false;u.lastManualAt=-10;u.snapTime=2;u.flight=null;for(const p of actors)Object.assign(p,{x:20+(p.index%3),z:95+p.index,vx:0,vz:0,engaged:false,fallen:false,hasBall:false});Object.assign(actors[6],{x:0,z:50,vz:6,heading:0,hasBall:true});Object.assign(actors[16],{x:.8,z:49.7,heading:-.8});liveUnit.refresh();return u;},
 contact(kind='defense',hit=false){const u=this.unit(kind);liveUnit.reviewTackle(actors[16],actors[6],hit,{reason:'TACKLED',gain:3,ball:40});camera(1);return this.frame();},
 control(){const u=this.unit();u.stage='flight';u.carrier=5;u.target=7;u.windup=1;u.releaseAt=1.5;u.flight={from:[0,2,40],to:[0,1.5,50],arc:1,t:0,duration:2,target:7};Object.assign(actors[7],{x:0,z:50,vz:4});Object.assign(actors[16],{x:0,z:58,vz:0});input.x=input.z=0;liveUnit.refresh();return this.frame(18);},
 steerRelease(){const u=this.unit();Object.assign(actors[16],{x:-5,z:40});input.x=1;input.z=0;this.frame(10);input.x=input.z=0;const before=actors[16].z;this.frame(45);return{before,after:actors[16].z,manual:u.manualMovement};},
 score(){this.reset();mini.possession='away';mini.cpu={ball:99,down:1,toGo:1};fullCpuResult(mini,drive,miniConfig,{gain:1,pass:true,live:true,seconds:1},()=>.5);showFullState();return this.frame();},
 block(){this.reset();mode='pass';selected=0;setup(false);snap();return this.frame(84);},
 allocations(){this.reset();this.frame(2);const saved=previousPresentation,poses=saved.map(p=>p.motion);this.frame();return{snapshots:saved===previousPresentation,motions:poses.every((p,i)=>p===previousPresentation[i].motion)};},
 benchmark(){const samples=[];for(let n=0;n<35;n++){const t=performance.now();meshy.queueShadows(presentationActors,athletePhase(),simTime+n/60);r.shadowCasters=[];samples.push(performance.now()-t);}return samples.slice(10).sort((a,b)=>a-b)[12];}
};`;
const server=createServer(async(req,res)=>{try{const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error();let bytes=await readFile(name);if(name.endsWith('/game.js'))bytes=Buffer.from(bytes.toString().replace('const rand=()=>','let rand=()=>').replace('random:rand,','random:()=>rand(),').replace('window.bk3dTest={',fixture+'window.bk3dTest={'));if(name.endsWith('/live-units.js'))bytes=Buffer.from(bytes.toString().replace('return {start,tick,stop,view,','return {reviewTackle:beginTackle,start,tick,stop,view,'));res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.glb':'model/gltf-binary'})[extname(name)]||'application/octet-stream');res.end(bytes)}catch{res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const report=[],errors=[];
try{for(const mode of process.env.MODE?[process.env.MODE]:['two-minute','five-minute']){
 const page=await browser.newPage({viewport:{width:1108,height:444},deviceScaleFactor:1,hasTouch:true,isMobile:true});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/play-moment-3d-preview.html?mode='+mode+'&team=JCY&opponent=BRK&qa=1');await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready);
 const shot=async name=>page.screenshot({path:out+'/'+mode+'-'+name+'.jpg',type:'jpeg',quality:86});
 for(const [id,keep]of [['zone',false],['single-zone',false],['i-dive',false],['pistol-read',true]]){
  await page.evaluate(([id,keep])=>window.recordingReview.run(id,keep),[id,keep]);let samples=[];
  for(let n=0;n<14;n++){const s=await page.evaluate(()=>window.recordingReview.frame(6));samples.push(s);if(s.stage==='handoff'&&n===6)await shot(id+'-exchange');if(s.stage==='run')break;}
  const live=samples.at(-1);assert.equal(live.stage,'run',id+' exits the exchange');assert.equal(live.carrier,keep?5:6);assert(Math.hypot(live.players[live.carrier].vx,live.players[live.carrier].vz)>2.5);assert(samples.every(s=>s.players.filter(p=>p.hasBall).length<=1));report.push({mode,case:'exchange-'+id,seconds:samples.length/10});
 }
 let s=await page.evaluate(()=>window.recordingReview.control());assert(s.players[16].z<57,'Auto-selected defender must close on the landing point, not run past the receiver');report.push({mode,case:'catch-control',z:s.players[16].z});
 const release=await page.evaluate(()=>window.recordingReview.steerRelease());assert(release.after>release.before+1,'Releasing the stick resumes pursuit');assert.equal(release.manual,false);report.push({mode,case:'neutral-pursuit',...release});
 for(const kind of ['defense','kickoff'])for(const hit of [false,true]){
  s=await page.evaluate(([kind,hit])=>window.recordingReview.contact(kind,hit),[kind,hit]);const initial=s,contact=[];
  for(let n=0;n<6;n++){s=await page.evaluate(()=>window.recordingReview.frame(7));contact.push(s);if([1,4].includes(n))await shot(kind+'-'+(hit?'hit':'wrap')+'-'+n);assert.equal(s.stage,'contact','Do not open the next playbook during the tackle');const boom=s.eye.map((v,i)=>v-s.target[i]);assert(Math.abs(boom[0])<.01,'Contact camera must not orbit sideways');}
  const landing=await page.evaluate(()=>window.recordingReview.frame(8));if(landing.stage==='contact'){const body=landing.bodies.find(p=>p.index===6);assert(body.chest[1]<.75,'Runner must land before the next play');}
  report.push({mode,case:kind+'-'+(hit?'hit':'wrap'),samples:contact.map(s=>({stage:s.stage,chests:s.bodies.filter(p=>p.index===6||p.index===16).map(p=>p.chest)}))});
 }
 s=await page.evaluate(()=>window.recordingReview.score());assert.equal(s.kind,'extra-point');assert.equal(s.conversion,'away');assert.equal(s.score,(mode==='two-minute'?27:0)+6);await shot('cpu-extra-point');const stages=[];
 for(let n=0;n<30;n++){s=await page.evaluate(()=>window.recordingReview.frame(8));stages.push(s.stage);if(s.kind==='kickoff')break;}
 assert(stages.includes('kick-snap')&&stages.includes('kick-flight'),'CPU try must have a snap and visible ball flight');assert.equal(s.kind,'kickoff');assert.equal(s.conversion,null);assert(s.log.some(x=>x.startsWith('EXTRA POINT ')));assert.equal(s.score,(mode==='two-minute'?27:0)+7);report.push({mode,case:'cpu-conversion',stages,score:s.score});
 const allocations=await page.evaluate(()=>window.recordingReview.allocations());assert(allocations.snapshots&&allocations.motions,'Physics snapshots must be reused');report.push({mode,case:'snapshot-reuse',...allocations});
 s=await page.evaluate(()=>window.recordingReview.block());assert(s.players.some(p=>p.engaged));await shot('blocking');
 assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().glError),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.close();console.log('PASS',mode);
}assert.deepEqual(errors,[]);await writeFile(out+'/results.json',JSON.stringify({status:'PASS',report,errors},null,2));console.log(JSON.stringify({status:'PASS',cases:report.length,out}));}finally{await browser.close();server.close()}
