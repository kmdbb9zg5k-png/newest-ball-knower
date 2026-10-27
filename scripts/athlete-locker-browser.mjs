import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const key='ballknower_solo_my_player_v2';
const profile={version:1,name:'Elijah Test',position:'WR',stage:'season',number:10,overall:82,teamAbbr:'JCY',presetFaceId:'malik',gamesPlayed:20,draftRound:1,draftPick:10,combineId:'qa-persistent-athlete',combinePerformance:{version:1,results:{dash:{best:4.5,last:4.6,attempts:2}}},careerArc:{own:{firstStart:1,awards:2},seasons:[{year:2026,champion:true},{year:2026,champion:true}]}};
const fixture=`import React from 'react';import{createRoot}from'react-dom/client';import AthleteLocker from'/AthleteLocker.tsx';import'/index.css';createRoot(document.getElementById('root')).render(React.createElement(AthleteLocker,{community:true}));`;
const server=await createServer({cacheDir:'/tmp/bk-athlete-locker-cache',server:{host:'127.0.0.1',port:3073,strictPort:true,watch:null,hmr:false},plugins:[{name:'athlete-locker-fixture',configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url?.startsWith('/athlete-locker-qa.html')){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,'<html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0;background:#07131c;color:white"><div id="root"></div><script type="module" src="/athlete-locker-qa.js"></script></body></html>'));}else next();});},resolveId(id){if(id==='/athlete-locker-qa.js')return'\0athlete-locker-qa';},load(id){if(id==='\0athlete-locker-qa')return fixture;}}]});
await server.listen();await mkdir('artifacts/athlete-locker',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox']});
try{
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<768,isMobile:width<768,acceptDownloads:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*.supabase.co/**',r=>r.abort());
  await page.addInitScript(({key,profile})=>{localStorage.setItem(key,JSON.stringify(profile));},{key,profile});
  await page.goto('http://127.0.0.1:3073/athlete-locker-qa.html');
  await page.getByRole('region',{name:'Athlete locker'}).waitFor();
  await page.getByText('Elijah Test',{exact:true}).first().waitFor();
  await page.getByText('Trophy room',{exact:false}).first().click();
  await page.getByText('Legacy Bowl champion',{exact:true}).waitFor();assert.equal(await page.getByText('Legacy Bowl champion',{exact:true}).count(),1,'Duplicate save entries do not duplicate trophies');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`No athlete locker overflow at ${width}`);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download athlete card',exact:true}).click();
  assert.match((await download).suggestedFilename(),/\.png$/);
  assert.equal(JSON.parse(await page.evaluate(key=>localStorage.getItem(key),key)).overall,82,'Sharing does not mutate athlete ratings');
  await page.screenshot({path:`artifacts/athlete-locker/locker-${width}.png`,fullPage:true});
  await page.evaluate(key=>{localStorage.removeItem(key);window.dispatchEvent(new StorageEvent('storage',{key}));},key);await page.getByRole('heading',{name:'Your story starts in Solo.'}).waitFor();assert.equal(await page.getByRole('button',{name:'Download athlete card',exact:true}).count(),0);assert.deepEqual(errors,[]);await context.close();
 }
 const page=await browser.newPage();await page.goto('http://127.0.0.1:3073/athlete-locker-qa.html');await page.getByRole('region',{name:'Athlete locker'}).waitFor();assert.equal(await page.getByRole('button',{name:'Download athlete card',exact:true}).count(),0,'No invented athlete/card when career does not exist');await page.close();
 console.log('PASS athlete locker: actual career identity, earned championship trophy, PNG card, 320/390/1280 layouts, immutable ratings and empty-career state.');
}finally{await browser.close();await server.close();}
