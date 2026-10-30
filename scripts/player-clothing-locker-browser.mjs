import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const fixture=`import React from'react';import{createRoot}from'react-dom/client';import Locker from'/PlayerClothingLocker.tsx';import'/index.css';createRoot(document.getElementById('root')).render(React.createElement(Locker,{onCreatePlayer:()=>{document.body.dataset.create='yes'}}));`;
const server=await createServer({server:{host:'127.0.0.1',port:3091,strictPort:true,watch:null,hmr:false},plugins:[{name:'locker-fixture',configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url==='/locker.html'){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,'<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/locker.js"></script></body></html>'));}else next();});},resolveId(id){if(id==='/locker.js')return'\0locker';},load(id){if(id==='\0locker')return fixture;}}]});
await server.listen();await mkdir('artifacts/player-clothing-locker',{recursive:true});
try{for(const width of [320,390,1280]){
 const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 try{const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:3091'?route.continue():route.abort());
 await page.goto('http://127.0.0.1:3091/locker.html');await page.locator('[data-render-state="ready"]').waitFor();
 await page.getByRole('button',{name:'Try on Mint Sprint Top',exact:true}).click();await page.getByRole('button',{name:'Equip free item'}).click();
 assert.match(await page.getByRole('status').innerText(),/Mint Sprint Top equipped/);
 await page.reload();await page.locator('[data-render-state="ready"]').waitFor();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ballknower_player_wardrobe_v1')).top),'top-mint');
 await page.getByRole('button',{name:'Shop',exact:true}).click();await page.getByRole('button',{name:'Try on Gold Standard'}).click();assert.equal(await page.getByRole('button',{name:'Purchases coming soon'}).isDisabled(),true);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('ballknower_player_wardrobe_v1')).top),'top-mint');
 await page.getByRole('button',{name:'Cancel preview'}).click();await page.getByRole('button',{name:'Accessories',exact:true}).click();await page.getByRole('button',{name:'Try on White Wristbands'}).click();await page.getByRole('button',{name:'Equip free item'}).click();
 await page.getByRole('button',{name:'Tops',exact:true}).click();await page.getByRole('button',{name:'Try on Bone Training Top'}).click();await page.getByRole('button',{name:'Equip free item'}).click();
 for(const [category,name,id,slot] of [['Bottoms','Midnight Navy Shorts','shorts-navy','shorts'],['Shoes','Lavender Trainers','shoes-lavender','shoes'],['Accessories','Lagoon Teal Wristbands','wrist-teal','wrist']]){await page.getByRole('button',{name:category,exact:true}).click();await page.getByRole('button',{name:`Try on ${name}`,exact:true}).click();await page.getByRole('button',{name:'Equip free item'}).click();assert.equal(await page.evaluate(slot=>JSON.parse(localStorage.getItem('ballknower_player_wardrobe_v1'))[slot],slot),id);}
 await page.reload();await page.locator('[data-render-state="ready"]').waitFor();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('ballknower_player_wardrobe_v1'))),{top:'top-bone',shorts:'shorts-navy',shoes:'shoes-lavender',wrist:'wrist-teal'});
 await page.getByRole('button',{name:'Create my player'}).click();assert.equal(await page.locator('body').getAttribute('data-create'),'yes');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:`artifacts/player-clothing-locker/locker-${width}.png`,fullPage:true});
 await page.evaluate(()=>localStorage.setItem('ballknower_solo_my_player_v2',JSON.stringify({version:1,name:'Elijah',stage:'combine',position:'WR',number:21,combineId:'locker-test',heightInches:68,weightLbs:185,hairStyle:'braids',skinTone:'olive brown'})));await page.reload();await page.getByText('Elijah',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Create my player'}).count(),0);await page.locator('[data-render-state="ready"]').waitFor();await page.screenshot({path:`artifacts/player-clothing-locker/created-${width}.png`,fullPage:true});
 assert.deepEqual(errors,[]);console.log(`PASS ${width}px: free equip/reload, premium try-on only, categories, created athlete, no overflow/errors`);
 }finally{await browser.close();}
}}finally{await server.close();}
