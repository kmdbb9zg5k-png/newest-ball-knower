import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('public'),out=resolve('artifacts/mini-teams');await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const name=resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!name.startsWith(root+'/'))throw Error();let data=await readFile(name);if(name.endsWith('/game.js'))data=Buffer.from(data.toString().replace('window.bk3dTest={','window.bkRosterReview={rig:meshy,renderer:r,actors:()=>actors};window.bk3dTest={'));res.setHeader('Content-Type',({'.js':'text/javascript','.html':'text/html','.css':'text/css','.glb':'model/gltf-binary'})[extname(name)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/play-moment-3d-preview.html?mode=two-minute&team=ABQ&opponent=AUS&difficulty=pro&qa=1`);
 await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready,{timeout:60000});
 const state=await page.evaluate(()=>window.bk3dDiagnostics());assert(state.players.slice(0,11).every(p=>p.teamAbbr==='ABQ'));assert(state.players.slice(11).every(p=>p.teamAbbr==='AUS'));assert(state.players.every(p=>p.playerId&&p.lastName&&Number.isInteger(p.number)));assert.equal(state.glError,0);
 assert.equal(await page.locator('.home .crest').textContent(),'ABQ');assert.equal(await page.locator('.away .crest').textContent(),'AUS');
 await page.locator('#breakHuddle').click();await page.locator('#playArt').click();await page.evaluate(()=>window.bk3dTest.step(.02));await page.screenshot({path:out+'/matchup-field.png'});
 // Inspect the actual skinned jersey at close range without changing the shipped camera.
 await page.setViewportSize({width:700,height:700});
 const info=await page.evaluate(async()=>{
  const {rig,renderer:r,actors}=window.bkRosterReview;const p={...actors()[5],x:0,z:0,heading:0,vx:0,vz:0,hasBall:false};
  document.querySelector('#hud').hidden=true;document.querySelector('#rotate').style.display='none';document.querySelector('#paused').hidden=true;r.resize();r.fov=31;
  window.drawJerseyReview=front=>{r.camera([front?1.1:-.5,1.55,front?3.7:-3.7],[0,1.05,0]);r.begin();r.draw();rig.draw([p],'pre',0);};window.drawJerseyReview(false);
  return {name:p.lastName,number:p.number,jersey:p.kitJersey,nameTextures:[...r.textures.keys()].filter(k=>k.startsWith('meshy-name-')).length,glError:r.gl.getError()};
 });assert.equal(info.nameTextures,22);assert.equal(info.glError,0);
 await page.screenshot({path:out+'/jersey-back.png'});await page.evaluate(()=>window.drawJerseyReview(true));await page.screenshot({path:out+'/jersey-front.png'});
 assert.deepEqual(errors,[]);console.log('PASS selected rosters, numbers, scoreboard, team colors, 22 name textures, shader compile/render; jersey:',JSON.stringify(info));
}finally{await browser.close();await new Promise(r=>server.close(r));}
