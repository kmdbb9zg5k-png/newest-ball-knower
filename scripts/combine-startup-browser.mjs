import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const fixture=`import * as T from 'three';
import {createCombineScene} from '/combine/scene.js';
import {createCreatorScene} from '/combine/creator-scene.ts';
import {newDash} from '/combine/dash.js';
const player={id:'startup-regression',name:'Test runner',position:'WR',speed:85,acceleration:85,seed:10};
const host=document.getElementById('host');
window.runStartup=async()=>{
 try{const scene=await createCombineScene(host,player,()=>{});scene.draw(newDash(player),0);scene.dispose();return{ok:true};}
 catch(error){return{ok:false,stage:error.combineStage,message:error.cause?.message||error.message};}
};
window.runCreator=async()=>{const scene=await createCreatorScene(host,player);scene.dispose();return true;};
window.ready=true;`;
const server=await createServer({server:{host:'127.0.0.1',port:3094,strictPort:true},plugins:[{name:'startup-fixture',configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url==='/startup-qa.html'){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,'<div id="host" style="width:390px;height:680px"></div><script type="module" src="/startup-qa.js"></script>'));}else next();});},resolveId(id){if(id==='/startup-qa.js')return '\0startup-qa';},load(id){if(id==='\0startup-qa')return fixture;}}]});
await server.listen();const browser=await chromium.launch({args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{
  window.contextStats={live:0,created:0,released:0};window.failPreferred=false;
  const original=HTMLCanvasElement.prototype.getContext,seen=new WeakSet();
  HTMLCanvasElement.prototype.getContext=function(type,options){
   if(type==='webgl2'&&window.failPreferred&&options?.antialias)return null;
   const context=original.call(this,type,options);
   if(type==='webgl2'&&context&&!seen.has(context)){
    seen.add(context);window.contextStats.live++;window.contextStats.created++;
    const getExtension=context.getExtension.bind(context);let released=false;
    context.getExtension=name=>{const ext=getExtension(name);if(name!=='WEBGL_lose_context'||!ext)return ext;return {loseContext(){if(!released){released=true;window.contextStats.live--;window.contextStats.released++;}ext.loseContext();},restoreContext:()=>ext.restoreContext()};};
   }
   return context;
  };
 });
 let brokenModel=true,requests=0;
 await page.route('**/combine-native-athlete-v1.glb*',route=>{requests++;return brokenModel?route.fulfill({status:200,contentType:'text/html',body:'<html>temporary failure</html>'}):route.continue();});
 await page.goto('http://127.0.0.1:3094/startup-qa.html');await page.waitForFunction(()=>window.ready);
 const failed=await page.evaluate(()=>window.runStartup());assert.equal(failed.ok,false);assert.equal(failed.stage,'athlete');
 assert.equal(await page.evaluate(()=>window.contextStats.live),0,'Failed asset startup releases its graphics context');
 brokenModel=false;assert.deepEqual(await page.evaluate(()=>window.runStartup()),{ok:true});assert.equal(requests,2,'Retry must refetch invalid HTTP-200 model');
 assert.equal(await page.locator('canvas').count(),0);
 for(let i=0;i<4;i++){
  assert.equal(await page.evaluate(()=>window.runCreator()),true);
  assert.deepEqual(await page.evaluate(()=>window.runStartup()),{ok:true});
  assert.equal(await page.evaluate(()=>window.contextStats.live),0,'Creator/drill cycle leaks graphics context');
 }
 await page.evaluate(()=>window.failPreferred=true);
 assert.deepEqual(await page.evaluate(()=>window.runStartup()),{ok:true},'Non-antialiased fallback must render real scene');
 const stats=await page.evaluate(()=>window.contextStats);assert.equal(stats.created,stats.released);assert.deepEqual(errors,[]);
 console.log('PASS real mobile-size scene, bad download recovery, four creator/drill cycles, explicit context release, fallback graphics',stats);
 // A failed scenery parse must also release the scene and be retried with new bytes.
 await page.reload();await page.waitForFunction(()=>window.ready);let brokenScenery=true;
 await page.route('**/combine-scout-poses-v1.json.gz',route=>brokenScenery?route.fulfill({status:200,body:'invalid scenery'}):route.continue());
 const scenery=await page.evaluate(()=>window.runStartup());assert.equal(scenery.stage,'background');assert.equal(await page.evaluate(()=>window.contextStats.live),0);
 brokenScenery=false;assert.deepEqual(await page.evaluate(()=>window.runStartup()),{ok:true});assert.equal(await page.evaluate(()=>window.contextStats.live),0);
 console.log('PASS scenery failure cleanup and fresh retry');
}finally{await browser.close();await server.close();}
