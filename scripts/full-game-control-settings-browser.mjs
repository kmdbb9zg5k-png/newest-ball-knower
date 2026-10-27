import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public');await mkdir('artifacts/full-game-controls',{recursive:true});
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+'/'))throw Error('path');res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.glb':'model/gltf-binary'})[extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{for(const mode of ['two-minute','five-minute']){
 const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?qa=1&mode=${mode}&team=MIL&opponent=SLC`);await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics?.().athletes.ready);
 await page.locator('#pause').click();await page.getByText('CUSTOMIZE CONTROLS',{exact:true}).click();
 for(const [name,value] of [['Movement stick','right'],['Control size','large'],['Control height','raised'],['Visual frame rate','30']])await page.getByLabel(new RegExp('^'+name)).selectOption(value);
 assert.equal(await page.locator('html').getAttribute('data-control-hand'),'right');assert.equal(await page.locator('html').getAttribute('data-control-size'),'large');
 await page.locator('#resume').click();await page.locator('#breakHuddle').click();
 const stick=await page.locator('#stick').boundingBox();assert(stick&&stick.x>422&&stick.width>=100,'Actual large joystick moves to right');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`artifacts/full-game-controls/${mode}.png`});
 await page.reload();await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics?.().athletes.ready);await page.locator('#pause').click();await page.getByText('CUSTOMIZE CONTROLS',{exact:true}).click();assert.equal(await page.getByLabel(/^Movement stick/).inputValue(),'right');assert.equal(await page.getByLabel(/^Visual frame rate/).inputValue(),'30');await page.getByText('RESET CONTROLS',{exact:true}).click();assert.equal(await page.getByLabel(/^Movement stick/).inputValue(),'left');assert.equal(await page.getByLabel(/^Control size/).inputValue(),'standard');assert.deepEqual(errors,[]);await page.close();
}console.log('PASS full-game controls in both modes: mobile pause settings, actual joystick layout, persistence, reset. Software browser only.');}finally{await browser.close();server.close()}
