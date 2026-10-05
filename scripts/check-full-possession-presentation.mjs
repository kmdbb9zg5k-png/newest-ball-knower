/** Full-play visual review. Scenario setup is injected only by this local server. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve('artifacts/full-possession-reviewed');await mkdir(out,{recursive:true});
const injection=`window.possessionReview={
 reset(kind,seed=175){liveUnit?.stop();conversionDrive=null;mini=fullSession(miniConfig.mode,true);drive={...initialDrive};paused=false;ended=false;miniUI.reset();$('paused').hidden=true;mode=kind==='run'?'run':'pass';selected=kind==='run'?0:PASSES.findIndex(p=>p.id==='verts');numSeed=seed;assist=false;setup(false);camera(1);present(1/30,1);},
 startUnit(kind,kicking='away'){liveUnit?.stop();mini=fullSession(miniConfig.mode,true);Object.assign(mini,{possession:kind==='defense'?'away':'home',kickoff:kind==='kickoff'?kicking:null,conversion:null});drive={...initialDrive};paused=false;ended=false;miniUI.reset();$('paused').hidden=true;startUnit(kind);present(1/30,1);},
 frame(){for(let i=0;i<6;i++){if(!paused||activeContact)simulate(1/60);if(i<5)camera(1/60);}present(1/60,1);},
 steer(x,z){assist=false;input.x=x;input.z=z;input.sprint=true;},
 scramble,
 bestTarget(){return receiverIndices.reduce((best,i)=>{const p=actors[i],gap=Math.min(...actors.filter(p=>p.team===1).map(d=>Math.hypot(d.x-p.x,d.z-p.z)));return !best||gap>best.gap?{id:i,gap}:best},null).id;},
 sample(){const u=liveUnit?.state,focus=actors[u?u.controlled:carrier?.index??5],transform=(m,p)=>[m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12],m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13],m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14]],m=meshy.modelFor(focus),h=meshy.handTransforms.get(focus.index),head=transform(mul(m,h.head),[0,.16,0]),chest=transform(m,[h.chest[12],h.chest[13],h.chest[14]]),q=r.project(head),foot=r.project([focus.x,0,focus.z]);return{phase:u?.stage||phase,kind:u?.kind||mode,focus:focus.index,action:focus.action,fallen:focus.fallen,actionT:focus.actionT,height:foot.y-q.y,head:q,foot,chest,eye:[...r.eye],target:[...r.target],fov:r.fov,down:drive.down,book:playbookOpen||u?.book,markers:[...$('targetLayer').children].filter(b=>!b.hidden).map(b=>({id:b.id,edge:b.dataset.edge,rect:b.getBoundingClientRect().toJSON()}))};}
};`;
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!p.startsWith(root+'/'))throw Error();let b=await readFile(p);if(p.endsWith('/game.js'))b=Buffer.from(b.toString().replace('window.bk3dTest={',injection+'window.bk3dTest={'));res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.glb':'model/gltf-binary','.css':'text/css'})[extname(p)]||'application/octet-stream');res.end(b)}catch{res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||'/tmp/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors=[],results=[];
try{
 for(const mode of (process.env.MODE?[process.env.MODE]:['two-minute','five-minute'])){
 const width=mode==='two-minute'?844:1108,height=mode==='two-minute'?390:512;
 const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?mode=${mode}&team=SAC&opponent=OMA&qa=1`);await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready);
 for(const kind of (process.env.KIND?process.env.KIND.split(','):['run','scramble','pass','defense','return','coverage','field-goal'])){
  await page.evaluate(k=>{if(['run','scramble','pass'].includes(k))window.possessionReview.reset(k);else window.possessionReview.startUnit(k==='return'||k==='coverage'?'kickoff':k,k==='coverage'?'home':'away');},kind);
  const dir=out+'/'+mode+'-'+kind;await mkdir(dir,{recursive:true});let frames=[],phaseShots=new Set(),targetSelected=false,contactAt=null;
  await page.screenshot({path:dir+'/before.jpg',type:'jpeg',quality:88});
  if(['run','scramble','pass'].includes(kind)){
   const pre=await page.evaluate(()=>window.possessionReview.sample());assert(pre.height>65,'Quarterback must be readable before snap');
   await page.locator('#snap').dispatchEvent('pointerdown',{pointerType:'touch',pointerId:1});
  }else if(kind==='defense')await page.locator('#unitCallDefense').click();
  else if(kind==='coverage'||kind==='field-goal'){
   // Kicking power is chosen through the actual meter and touch button.
   await page.locator('#unitKickButton').click();for(let i=0;i<9;i++)await page.evaluate(()=>window.possessionReview.frame());await page.locator('#unitKickButton').click();
  }
  for(let frame=0;frame<150;frame++){
   const t=frame/10;
   if(kind==='run'&&frame===5)await page.evaluate(()=>window.possessionReview.steer(.25,1));
   if(kind==='scramble'&&frame===12)await page.evaluate(()=>{window.possessionReview.scramble();window.possessionReview.steer(.35,1)});
   if(kind==='return'&&frame===40)await page.evaluate(()=>window.possessionReview.steer(.25,1));
   await page.evaluate(()=>window.possessionReview.frame());const s=await page.evaluate(()=>window.possessionReview.sample());frames.push(s);
   if(kind==='pass'&&s.phase==='pass'&&t>1.15&&!targetSelected){const id=await page.evaluate(()=>window.possessionReview.bestTarget());await page.locator('#target-'+id).dispatchEvent('click',{detail:0});targetSelected=true;}
   if(kind==='pass'&&s.phase==='flight'&&await page.locator('#catchChoices').isVisible())await page.locator('[data-catch="rac"]').dispatchEvent('pointerdown',{pointerType:'touch',pointerId:2});
   if((s.phase==='dead'||s.phase==='contact')&&contactAt===null)contactAt=t;
   const key=contactAt!==null?`${s.phase}-${Math.floor((t-contactAt)*4)}`:s.phase;
   if(!phaseShots.has(key)&&(!s.book||frame<10)){phaseShots.add(key);await page.screenshot({path:dir+'/'+String(frame).padStart(3,'0')+'-'+key+'.jpg',type:'jpeg',quality:88});}
   // Preserve a low-frame-rate full sequence, independent of headless wall time.
   if(process.env.FILM&&frame%2===0)await page.screenshot({path:dir+'/film-'+String(frame/2).padStart(3,'0')+'.jpg',type:'jpeg',quality:82});
   if(frame>12&&s.book)break;
   if(frame>20&&['defense','return','coverage','field-goal'].includes(kind)&&s.kind!==(['return','coverage'].includes(kind)?'kickoff':kind))break;
  }
  let selectionFrame=-100;frames.forEach((s,i)=>{if(i&&s.focus!==frames[i-1].focus)selectionFrame=i;s.selectionSettled=i-selectionFrame>=3;});
  const live=frames.filter((s,i)=>s.selectionSettled&&i>9&&!s.book&&['run','pass','handoff'].includes(s.phase)&&!s.fallen),minHeight=live.length?Math.min(...live.map(s=>s.height)):null;
  const visible=live.filter(s=>s.head.visible&&s.head.x>0&&s.head.x<width&&s.head.y>60&&s.foot.y<height).length;
  const phases=[...new Set(frames.map(s=>s.phase))];
  await writeFile(dir+'/frames.json',JSON.stringify(frames));
  if(['run','scramble','defense','return','coverage'].includes(kind)){assert(live.length>0);assert(minHeight>55,`${kind} scale collapsed: ${minHeight}`);assert(visible/live.length>.95,`${kind} player left usable view`);}
  for(const s of frames)for(const m of s.markers){assert(m.rect.width>=44&&m.rect.height>=44);assert(m.rect.y>60&&m.rect.y+m.rect.height<height-90,'Receiver overlaps controls');}
  assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().glError),0);
  const result={mode,kind,frames:frames.length,phases,minHeight,visibleRatio:live.length?visible/live.length:null};results.push(result);await writeFile(dir+'/frames.json',JSON.stringify(frames));await writeFile(dir+'/result.json',JSON.stringify(result));console.log(JSON.stringify(result));
 }
 await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/results.json',JSON.stringify({status:'PASS',results,errors},null,2));
}finally{await browser.close();server.close()}
