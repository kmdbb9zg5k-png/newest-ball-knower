/** Normal-control regressions. No injected positions, completions or outcomes. */
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve(process.env.OUT||'artifacts/oct7-playthrough');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+'/'))throw Error('path');const data=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.glb':'model/gltf-binary'})[extname(file)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors=[],report=[];
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page),shot=async({path})=>{const frame=await cdp.send('Page.captureScreenshot',{format:'jpeg',quality:85});await writeFile(path,Buffer.from(frame.data,'base64'));};
 const step=t=>page.evaluate(t=>window.bk3dTest.step(t),t),state=()=>page.evaluate(()=>window.bk3dDiagnostics()),click=s=>page.locator(s).click();
 const load=async mode=>{await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?qa=1&mode=${mode}&team=MIL&opponent=SLC`);await page.waitForFunction(()=>window.bk3dDiagnostics?.().athletes.ready);await page.evaluate(()=>{window.bk3dTest.manualFrames();window.bk3dTest.seed(742)});};
 const pass=async()=>{await click('#filterPass');await click('#call-pass-11');await click('#breakHuddle');await click('#snap');};
 await load('two-minute');await pass();await step(2);const before=await state();assert.equal(before.phase,'pass');await click('#scramble');await step(.1);const after=await state();assert.equal(after.phase,'run');assert(after.protectionAge>before.protectionAge,'Scrambling must not restart protection');assert(after.protectionAge>after.elapsed+1.5);assert.equal(after.players.filter(p=>p.hasBall).length,1);
 await page.keyboard.down('ArrowRight');await step(1.4);await page.keyboard.up('ArrowRight');const escaped=await state();assert.equal(escaped.glError,0);await shot({path:out+'/scramble.jpg'});report.push({scenario:'scramble',before:before.protectionAge,after:after.protectionAge,phase:escaped.phase});
 await load('two-minute');await pass();await step(1.5);await click('#target-6');let flightFrames=0,seenFlight=false,chosen=false;
 for(let i=0;i<40;i++){await step(1/15);const d=await state();assert.equal(d.glError,0);assert(d.players.filter(p=>p.hasBall).length<=1);if(d.phase==='flight'){seenFlight=true;flightFrames++;assert(await page.locator('#catchChoices').isVisible());if(flightFrames===17){await shot({path:out+'/catch-window.jpg'});await click('[data-catch="secure"]');chosen=true;}}else if(seenFlight)break;}
 assert(chosen,'Short pass must still accept SECURE after more than one second of flight');report.push({scenario:'short-pass',flightFrames,chosen});
 await load('five-minute');await click('#formationTabs [data-formation="iform"]');await page.locator('.play-card').last().click();await click('#formationTabs [data-formation="all"]');
 assert(await page.locator('.play-card.selected').evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return a.top>=b.top-1&&a.bottom<=b.bottom+1}),'Selected play must stay visible when switching formation');await shot({path:out+'/selected-play.jpg'});
 await click('#fullPunt');await click('#unitKickButton');await step(1);await click('#unitKickButton');await step(8);const punt=await state();assert.equal(punt.unit?.kind,'defense');assert.equal(punt.unit?.book,true);await click('#unitCallDefense');await step(1.4);const defense=await state();assert.equal(defense.players.length,22);assert.equal(defense.glError,0);await shot({path:out+'/defense.jpg'});report.push({scenario:'punt-to-defense',stage:defense.unit?.stage,ball:punt.unit.ball});
 assert.deepEqual(errors,[]);await writeFile(out+'/report.json',JSON.stringify({status:'PASS',report,errors},null,2));console.log('PASS normal-control scramble, delayed short-pass catch choice, selected play visibility, punt and defense');
}finally{await browser.close();server.close()}
