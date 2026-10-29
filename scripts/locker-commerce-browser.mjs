import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const fixture=`import React from'react';import{createRoot}from'react-dom/client';import Locker from'/PlayerClothingLocker.tsx';import Sync from'/LockerAccountSync.tsx';import{readOutfit}from'/playerWardrobe.ts';import{refreshLocker}from'/lockerCommerceClient.ts';import{supabase}from'/supabase.ts';import'/index.css';let uid='buyer-a',callback;supabase.auth.getSession=async()=>({data:{session:uid?{user:{id:uid,is_anonymous:false},access_token:uid}:null}});supabase.auth.onAuthStateChange=fn=>{callback=fn;return{data:{subscription:{unsubscribe(){}}}}};window.switchBuyer=value=>{uid=value;callback('SIGNED_IN',uid?{user:{id:uid,is_anonymous:false}}:null)};window.readOutfit=readOutfit;window.refreshLocker=refreshLocker;createRoot(document.getElementById('root')).render(React.createElement(React.Fragment,null,React.createElement(Sync),React.createElement(Locker,{onCreatePlayer(){}})));`;
const server=await createServer({server:{host:'127.0.0.1',port:3093,strictPort:true,watch:null,hmr:false},plugins:[{name:'commerce-fixture',configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url.startsWith('/commerce.html')){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml('/commerce.html','<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>'));}else next();});},resolveId(id){if(id==='/fixture.js')return'\0fixture';},load(id){if(id==='\0fixture')return fixture;}}]});
await server.listen();
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:320,height:900},serviceWorkers:'block'});page.setDefaultTimeout(60000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));let owned=[],saved=null,checkoutCount=0,restoreCount=0;
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin!=='http://127.0.0.1:3093')return route.abort();
  if(url.pathname==='/api/locker-commerce'){
   const user=req.headers().authorization?.replace('Bearer ','');const body=req.postDataJSON();
   if(body?.action==='checkout'){checkoutCount++;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Test checkout unavailable. Try again.'})});}
   if(body?.action==='restore')restoreCount++;
   if(body?.action==='equip')saved=body.outfit;
   return route.fulfill({contentType:'application/json',body:JSON.stringify({available:true,mode:'test',owned:user==='buyer-a'?owned:[],outfit:user==='buyer-a'?saved:null,prices:{'top-gold':{amount:100,currency:'usd'}}})});
  }
  if(req.method()!=='GET')return route.abort();return route.continue();
 });
 await page.goto('http://127.0.0.1:3093/commerce.html');await page.locator('[data-render-state="ready"]').waitFor();
 await page.getByRole('button',{name:'Shop',exact:true}).click();await page.getByRole('button',{name:'Try on Gold Standard'}).click();
 await page.getByRole('button',{name:'Test purchase · $1.00'}).click();await page.getByRole('alert').filter({hasText:'Test checkout unavailable'}).waitFor();assert.equal(checkoutCount,1);assert.equal(await page.evaluate(()=>window.readOutfit().top),'top-standard');
 owned=['top-gold'];await page.getByRole('button',{name:'Restore purchases'}).click();await page.getByRole('button',{name:'Equip owned item'}).click();
 await page.getByRole('status').filter({hasText:'Gold Standard equipped'}).waitFor();assert.equal(await page.evaluate(()=>window.readOutfit().top),'top-gold');assert.equal(restoreCount,1);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ballknower_player_wardrobe_v1')||'{}').top),undefined);
 await page.getByRole('button',{name:/My Wardrobe/}).click();await page.getByRole('button',{name:'Try on Gold Standard'}).waitFor();
 await page.evaluate(()=>window.switchBuyer('buyer-b'));await page.waitForFunction(()=>window.readOutfit().top==='top-standard');assert.equal(await page.getByRole('button',{name:'Try on Gold Standard'}).count(),0);
 await page.evaluate(()=>window.switchBuyer('buyer-a'));await page.getByRole('button',{name:'Try on Gold Standard'}).waitFor();
 owned=[];await page.evaluate(()=>window.refreshLocker());await page.waitForFunction(()=>window.readOutfit().top==='top-standard');assert.equal(await page.getByRole('button',{name:'Try on Gold Standard'}).count(),0);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS 320px sandbox shop: honest checkout failure, restore, account-owned equip, no local premium grant, account switch/revocation and no overflow.');
}finally{await browser.close();await server.close();}
