import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve(process.env.OUT||'artifacts/defense-presnap');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.glb':'model/gltf-binary'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});const report=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));const cdp=await page.context().newCDPSession(page),step=t=>page.evaluate(t=>window.bk3dTest.step(t),t),state=()=>page.evaluate(()=>window.bk3dDiagnostics()),tap=s=>page.locator(s).tap();
 for(const mode of ['two-minute','five-minute']){
 await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?qa=1&mode=${mode}&team=SAC&opponent=OMA`);await page.waitForFunction(()=>window.bk3dDiagnostics?.().athletes.ready);await page.evaluate(()=>{window.bk3dTest.manualFrames();window.bk3dTest.seed(742)});
 await tap('#fullPunt');await tap('#unitKickButton');await step(1);await tap('#unitKickButton');await step(8);assert.equal((await state()).unit.kind,'defense');
 await tap('#unitCallDefense');assert.equal((await state()).unit.stage,'pre');assert(await page.locator('#defenseAudible').isVisible());await step(6);let d=await state();assert.equal(d.unit.stage,'pre');assert(Math.abs(d.unit.preSnapRemaining-4)<.02);
 await tap('#defenseAudible');await step(10);d=await state();assert.equal(d.unit.book,true);assert.equal(d.unit.stage,'pre');assert(Math.abs(d.unit.preSnapRemaining-4)<.02,'Audible selection holds countdown');
 const choices=page.locator('#defenseCalls button');await choices.last().tap();const chosen=await choices.last().getAttribute('data-play');await tap('#unitCallDefense');assert.equal((await state()).unit.stage,'pre');
 for(const [width,height] of [[844,390],[667,320],[1108,444]]){await page.setViewportSize({width,height});await step(0);for(const selector of ['#defenseSnapClock','#defenseAudible','#defenseReady']){const b=await page.locator(selector).boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=height+1,selector+' must fit screen');}const shot=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:80});await writeFile(`${out}/${mode}-${width}.jpg`,Buffer.from(shot.data,'base64'));}
 await page.setViewportSize({width:844,height:390});
 if(mode==='two-minute'){await step(3);assert.equal((await state()).unit.stage,'pre');await step(1.1);}else await tap('#defenseReady');
 d=await state();assert.notEqual(d.unit.stage,'pre');await step(.6);assert(['handoff','pass','run','flight'].includes((await state()).unit.stage));assert.equal(d.glError,0);report.push({mode,chosen,countdownHeld:true,snap:mode==='two-minute'?'automatic':'ready',layouts:3});
 }
 assert.deepEqual(errors,[]);console.log('PASS defensive countdown, audible hold, ready and mobile controls');
}finally{await writeFile(out+'/report.json',JSON.stringify({report,errors},null,2));await browser.close();server.close();}
