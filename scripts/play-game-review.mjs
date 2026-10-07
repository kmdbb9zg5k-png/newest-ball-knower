// Local interactive QA driver. Controls the shipped UI and saves timed frames.
// No gameplay outcomes or actor positions are injected.
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
import {createInterface} from 'node:readline';
const root=resolve('public'),out=resolve(process.env.OUT||'artifacts/play-review');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,proxy:process.env.REVIEW_URL&&process.env.HTTPS_PROXY?{server:process.env.HTTPS_PROXY}:undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
let page,cdp,errors=[];
const diagnostic=()=>page.evaluate(()=>window.bk3dDiagnostics());
function summary(d){return {phase:d.phase,mode:d.mode,play:d.playId,time:d.simTime,drive:d.drive,unit:d.unit,contact:d.contact,book:d.playbook,owners:d.players.flatMap((p,i)=>p.hasBall?[{i,role:p.role,x:p.x,z:p.z}]:[]),gl:d.glError,errors};}
async function command(c){
 if(c.action==='load'){
  await page?.close();errors=[];page=await browser.newPage({viewport:{width:1108,height:444},isMobile:true,hasTouch:true,ignoreHTTPSErrors:Boolean(process.env.REVIEW_URL&&process.env.HTTPS_PROXY)});page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.REVIEW_URL||'http://127.0.0.1:'+server.address().port+'/play-moment-3d-preview.html'}?qa=1&mode=${c.mode||'two-minute'}&team=MIL&opponent=SLC`);
  await page.waitForFunction(()=>window.bk3dDiagnostics?.().athletes.ready);await page.evaluate(()=>{window.bk3dTest.manualFrames();window.bk3dTest.seed(742)});
  cdp=await page.context().newCDPSession(page);
 } else if(c.action==='click')await page.locator(c.selector).click();
 else if(c.action==='key')await page.keyboard[c.event||'press'](c.key);
 else if(c.action==='realtime'){
  const dir=resolve(out,(c.label||'realtime').replace(/[^a-z0-9_-]/gi,'_'));await mkdir(dir,{recursive:true});const frames=[];
  const onFrame=event=>{frames.push({time:event.metadata.timestamp,data:event.data});void cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId});};
  cdp.on('Page.screencastFrame',onFrame);await cdp.send('Page.startScreencast',{format:'jpeg',quality:75,maxWidth:1108,maxHeight:444,everyNthFrame:1});
  const before=await diagnostic(),started=Date.now();await page.evaluate(()=>window.bk3dTest.resumeFrames());
  await page.waitForTimeout(Math.max(1,Math.min(30,c.seconds||10))*1000);await page.evaluate(()=>window.bk3dTest.manualFrames());await cdp.send('Page.stopScreencast');cdp.off('Page.screencastFrame',onFrame);
  const after=await diagnostic();for(let i=0;i<frames.length;i++)await writeFile(resolve(dir,String(i).padStart(4,'0')+'.jpg'),Buffer.from(frames[i].data,'base64'));
  const report={wallSeconds:(Date.now()-started)/1000,simulationSeconds:after.simTime-before.simTime,renderedFrames:after.frames-before.frames,capturedFrames:frames.length,timestamps:frames.map(f=>f.time),state:summary(after)};await writeFile(resolve(dir,'report.json'),JSON.stringify(report,null,2));return report;
 }
 else if(c.action==='step')await page.evaluate(t=>window.bk3dTest.step(t),c.seconds);
 else if(c.action==='state')return {state:summary(await diagnostic()),buttons:await page.locator('button:visible').evaluateAll(bs=>bs.map(b=>({id:b.id,text:b.innerText,label:b.getAttribute('aria-label')})))};
 else if(c.action==='record'){
  const label=c.label.replace(/[^a-z0-9_-]/gi,'_'),dir=resolve(out,label);await mkdir(dir,{recursive:true});const frames=[],fps=Math.max(1,Math.min(60,Number(c.fps)||15));
  for(let i=0;i<Math.ceil(c.seconds*fps);i++){await page.evaluate(t=>window.bk3dTest.step(t),1/fps);frames.push(await diagnostic());const shot=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:85,captureBeyondViewport:false});await writeFile(resolve(dir,String(i).padStart(4,'0')+'.jpg'),Buffer.from(shot.data,'base64'));if(i>15&&frames.at(-1).playbook.open&&!frames.at(-1).unit)break;}
  await writeFile(resolve(dir,'frames.json'),JSON.stringify({fps,errors,frames}));return {directory:dir,frames:frames.length,state:summary(frames.at(-1))};
 } else if(c.action==='shot') {const file=resolve(out,(c.label||'current').replace(/[^a-z0-9_-]/gi,'_')+'.jpg');const frame=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:85});await writeFile(file,Buffer.from(frame.data,'base64'));return{file,state:summary(await diagnostic())};}
 else throw Error('Unknown action');
 return summary(await diagnostic());
}
const server=createServer(async(req,res)=>{try{
 if(req.method==='POST'&&req.url==='/review'){let body='';for await(const chunk of req)body+=chunk;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await command(JSON.parse(body))));return;}
 const file=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+'/'))throw Error('path');const data=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.glb':'model/gltf-binary'})[extname(file)]||'application/octet-stream');res.end(data);
}catch(e){res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:e.message}));}});
server.listen(Number(process.env.PORT||0),'127.0.0.1',()=>console.log('Gameplay review http://127.0.0.1:'+server.address().port+'/review'));
process.on('SIGINT',async()=>{await browser.close();server.close();process.exit(0)});
for await(const line of createInterface({input:process.stdin})) {try {console.log(JSON.stringify(await command(JSON.parse(line))));}catch(e){console.log(JSON.stringify({error:e.message}));}}

await browser.close();server.close();
