import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import sharp from 'sharp';
const fixture=`import React from'react';import{createRoot}from'react-dom/client';import Locker from'/PlayerClothingLocker.tsx';import'/index.css';createRoot(document.getElementById('root')).render(React.createElement(Locker,{onCreatePlayer(){}}));`;
const server=await createServer({server:{host:'127.0.0.1',port:0,watch:null,hmr:false},plugins:[{name:'gear-fixture',configureServer(s){s.middlewares.use(async(req,res,next)=>{const path=req.url.split('?')[0];if(path==='/gear-test.html'){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(path,'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#081018"><div id="root"></div><script type="module" src="/gear-test.js"></script></body></html>'));}else if(path==='/play-moment-3d/game-gear-preview.js'){res.setHeader('Content-Type','text/javascript');res.end((await readFile('public'+path,'utf8')).replace('let angle=.35', 'window.__gearPreview={renderer,model,player};let angle=.35'));}else if(path==='/play-moment-3d/reference-athlete.js'){res.setHeader('Content-Type','text/javascript');res.end((await readFile('public'+path,'utf8')).replace('this.frameBones=null;gl.bindVertexArray(null);return true;', 'window.__gearActors=actors.map(p=>({id:p.playerId,gear:p.gameGear,team:p.teamAbbr}));this.frameBones=null;gl.bindVertexArray(null);return true;'));}else next();});},resolveId(id){if(id==='/gear-test.js')return'\0gear-test';},load(id){if(id==='\0gear-test')return fixture;}}]});
await server.listen();const origin=server.resolvedUrls.local[0].replace(/\/$/,'');await mkdir('artifacts/game-gear',{recursive:true});
try{
for(const width of [320,390,844]){
 const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width,height:844},isMobile:width<500,hasTouch:true}),errors=[];page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.origin!==origin)return r.abort();if(u.pathname.startsWith('/api/'))return r.fulfill({json:{available:false}});return r.continue();});
 await page.addInitScript(()=>{if(!localStorage.getItem('gear-fixture')){localStorage.setItem('gear-fixture','yes');localStorage.setItem('ballknower_solo_my_player_v2',JSON.stringify({version:1,stage:'season',combineId:'gear-player',position:'QB',name:'Gear Athlete',number:12,teamAbbr:'JCY',overall:77,speed:82,careerLife:{games:2},tattooArms:'both'}));}});
 await page.goto(origin+'/gear-test.html');await page.getByRole('button',{name:'Game Gear',exact:true}).click();
 assert(await page.locator('.clothing-modes button').evaluateAll(bs=>bs.every(b=>b.scrollWidth<=b.clientWidth+1)),'All Locker tab labels fit their touch targets');
 let frame=page.frameLocator('iframe[title="Game gear 3D preview"]');await frame.locator('#status').waitFor({state:'hidden'});
 const shot=()=>page.locator('iframe[title="Game gear 3D preview"]').screenshot();
 const base=await shot();
 for(const [label,color] of [['Left arm sleeve','White'],['Right arm sleeve','Black'],['Left wrist tape','Black'],['Right wrist tape','White'],['Gloves','White'],['Cleats','White'],['Facemask','White']]){
  const before=await shot();await page.getByRole('group',{name:label,exact:true}).getByRole('button',{name:color,exact:true}).click();await frame.locator('canvas').evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const after=await shot();
  const a=await sharp(before).raw().toBuffer(),b=await sharp(after).raw().toBuffer();let diff=0;for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>8)diff++;assert(diff>20,`${label} must visibly change actual reference mesh: ${diff}`);
 }
 assert.notDeepEqual(await shot(),base);await page.getByRole('button',{name:'Equip game gear',exact:true}).click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('ballknower_solo_my_player_v2')));assert.equal(saved.speed,82);assert.equal(saved.tattooArms,'both');assert.deepEqual(saved.careerLife,{games:2});assert.equal(saved.gameGear.leftSleeve,'white');assert.equal(saved.gameGear.rightSleeve,'black');
 await page.reload();await page.getByRole('button',{name:'Game Gear',exact:true}).click();await frame.locator('#status').waitFor({state:'hidden'});assert.equal(await page.getByRole('group',{name:'Left arm sleeve',exact:true}).getByRole('button',{name:'White',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('group',{name:'Gloves',exact:true}).getByRole('button',{name:'Black',exact:true}).click();await page.getByRole('button',{name:'Cancel changes',exact:true}).click();assert.equal(await page.getByRole('group',{name:'Gloves',exact:true}).getByRole('button',{name:'White',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`artifacts/game-gear/locker-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:/My Wardrobe/}).click();assert(await page.getByRole('button',{name:'Shop',exact:true}).isVisible());
 if(width===390){
  for(const mode of ['two-minute','five-minute']){
   await page.goto(`${origin}/play-moment-3d-preview.html?mode=${mode}&team=JCY&opponent=BRK&qa=1`);await page.waitForFunction(()=>window.bk3dTest);await page.evaluate(()=>window.bk3dTest.manualFrames());await page.waitForFunction(()=>window.bk3dDiagnostics().athletes.ready);await page.evaluate(()=>window.bk3dTest.step(.1));
   const actors=await page.evaluate(()=>window.__gearActors),own=actors.filter(p=>p.gear);assert.equal(own.length,1);assert.equal(own[0].team,'JCY');assert.equal(own[0].gear.leftSleeve,'white');
   await page.locator('#breakHuddle').dispatchEvent('click');await page.locator('#snap').dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch'});await page.evaluate(()=>window.bk3dTest.step(3));const now=await page.evaluate(()=>window.__gearActors.filter(p=>p.gear));assert.deepEqual(now,own,'Gear stays attached to the same roster identity through the snap');assert.equal(await page.evaluate(()=>window.bk3dDiagnostics().glError),0);
  }
 }
 assert.deepEqual(errors,[]);console.log(`PASS game gear ${width}px: rendered equipment, independent arms, save/reload, cancel, wardrobe navigation, no overflow/errors${width===390?', both full games and player isolation':''}`);
 }finally{await browser.close();}
}
}finally{await server.close();}
