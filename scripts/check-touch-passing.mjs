import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve(process.env.OUT||'artifacts/touch-passing');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.glb':'model/gltf-binary'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors=[],report=[];
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));const cdp=await page.context().newCDPSession(page);
 const step=t=>page.evaluate(t=>window.bk3dTest.step(t),t),state=()=>page.evaluate(()=>window.bk3dDiagnostics());
 for(const mode of ['two-minute','five-minute']){
 await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?qa=1&mode=${mode}&team=SAC&opponent=OMA`);await page.waitForFunction(()=>window.bk3dDiagnostics?.().athletes.ready);await page.evaluate(()=>{window.bk3dTest.manualFrames();window.bk3dTest.seed(742)});
 for(const hold of [40,300,600]){
 if(hold!==40){await page.locator('#pause').tap();await page.locator('#restart').tap();}
 for(const s of ['#filterPass','#call-pass-11','#breakHuddle','#snap'])await page.locator(s).tap();await step(1);
 const rect=await page.locator('#target-6').boundingBox(),stick=await page.locator('#stick').boundingBox();assert(rect);
 const p1={x:stick.x+stick.width*.6,y:stick.y+stick.height*.5,id:1},p2={x:rect.x+rect.width/2,y:rect.y+rect.height/2,id:2};
 await page.evaluate(()=>{window.touchLog=[];for(const name of ['pointerdown','pointerup','pointercancel','lostpointercapture'])document.addEventListener(name,e=>window.touchLog.push({event:name,target:e.target.id,id:e.pointerId}),true)});
 if(hold===40){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p2]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});assert.equal((await state()).throwing,null,'Cancelled touch must not throw');}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1]});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1,p2]});await page.waitForTimeout(hold);await step(.15);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[p1]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const selected=await state();await step(.3);const after=await state();const log=await page.evaluate(()=>window.touchLog);report.push({mode,hold,selected:selected.throwing,phase:after.phase,kind:after.throwKind,log});assert(selected.throwing,'Touch release must start throw: '+JSON.stringify(report.at(-1)));assert.equal(after.phase,'flight');assert.equal(after.glError,0);assert.equal(after.throwKind,hold===40?'bullet':hold===300?'touch':'lob');
 }
 // A tap on a receiver's body must work without hitting the small moving badge.
 await page.locator('#pause').tap();await page.locator('#restart').tap();
 for(const selector of ['#filterPass','#call-pass-11','#breakHuddle','#snap'])await page.locator(selector).tap();await step(1);
 const d=await state();
 const hit=await page.evaluate(players=>players.filter(p=>p.team===0&&['WR','TE','RB'].includes(p.role)).map(p=>({role:p.role,x:(p.head.x+p.foot.x)/2,y:p.head.y*.4+p.foot.y*.6,visible:p.head.visible&&p.foot.visible})).find(p=>p.visible&&document.elementFromPoint(p.x,p.y)?.id==='game'),d.players);
 assert(hit,'A receiver body must be reachable on the field');report.push({mode,scenario:'body-hit-test',...hit});await page.touchscreen.tap(hit.x,hit.y);assert((await state()).throwing,'Receiver body tap must submit a pass');await step(.3);assert.equal((await state()).phase,'flight');report.push({mode,scenario:'receiver-body',phase:'flight'});
 // Browser/accessibility click fallback: no duplicate throw after a normal pointer release.
 await page.locator('#pause').tap();await page.locator('#restart').tap();
 for(const selector of ['#filterPass','#call-pass-11','#breakHuddle','#snap'])await page.locator(selector).tap();await step(1);
 await page.locator('#target-6').dispatchEvent('click',{detail:1});assert((await state()).throwing,'Click-only activation must not be discarded');report.push({mode,scenario:'click-fallback'});
 }
 assert.deepEqual(errors,[]);console.log('PASS real CDP multitouch throws');
}finally{await writeFile(out+'/report.json',JSON.stringify({report,errors},null,2));await browser.close();server.close();}
