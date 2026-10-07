/** Normal-control regressions. No injected positions, completions or outcomes. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve(process.env.OUT||'artifacts/presentation-clock');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+'/'))throw Error('path');let data=await readFile(file);if(file.endsWith('/game.js'))data=Buffer.from(data.toString().replace('window.bk3dTest={', `window.bkClockReview=()=>{const frames=[];for(let i=0;i<36;i++){if(i%2===0)simulate(1/60);present(1/120,i%2===0?0:.5);frames.push({time:meshy.poseStates.get(6)?.time,phase,simTime});}return frames;};window.bk3dTest={`));res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.glb':'model/gltf-binary'})[extname(file)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});

const errors=[],report=[];
try{
 for(const mode of ['two-minute','five-minute']){
 const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?qa=1&mode=${mode}&team=MIL&opponent=SLC`);await page.waitForFunction(()=>window.bk3dDiagnostics?.().athletes.ready);await page.evaluate(()=>{window.bk3dTest.manualFrames();window.bk3dTest.seed(742)});
 for(const selector of ['#filterPass','#call-pass-11','#breakHuddle','#snap'])await page.locator(selector).click();
 await page.evaluate(()=>window.bk3dTest.step(1.5));await page.locator('#target-6').click();await page.evaluate(()=>window.bk3dTest.step(.3));
 const frames=await page.evaluate(()=>window.bkClockReview());assert(frames.every(f=>f.phase==='flight'),'Exercise slowed catch flight');
 for(let i=1;i<frames.length;i++)assert(frames[i].time>=frames[i-1].time-1e-8,`Pose time rewound at high refresh: ${JSON.stringify(frames.slice(i-1,i+1))}`);
 assert(frames.at(-1).simTime-frames[0].simTime<.3,'The test must cover scaled simulation time');report.push({mode,frames:frames.length,rewinds:0,simulationAdvance:frames.at(-1).simTime-frames[0].simTime});await page.close();
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({status:'PASS',report,errors},null,2));console.log('PASS 120 Hz presentation during slowed catches in both modes; no pose-time rewinds');
}finally{await browser.close();server.close()}
