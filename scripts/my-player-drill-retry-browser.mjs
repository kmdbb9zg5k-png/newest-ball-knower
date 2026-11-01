// Run after npm run build: BROWSER_PATH=/path/to/chromium node --import tsx scripts/my-player-drill-retry-browser.mjs
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname} from 'node:path';
import {createCareerLife,chooseCamp} from '../myPlayerCareer.ts';
const key='ballknower_solo_my_player_v2';
await mkdir('artifacts/my-player-career',{recursive:true});
const root=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.glb':'model/gltf-binary'};
const server=process.env.BK_TEST_URL?null:createServer(async(req,res)=>{
 const path=new URL(req.url,'http://localhost').pathname,file=resolve(root,'.'+(path==='/'?'/index.html':path));
 if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
 try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'}).end(bytes);}catch{res.writeHead(404).end();}
});
if(server)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=process.env.BK_TEST_URL||`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
// Real model/renderer retry in the embedded My Player position workout.
try {
for(const width of [390]){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
await context.route('**/api/**',r=>r.fulfill({json:{available:false}}));
 const page=await context.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
const rows=new Map();const user={id:'00000000-0000-4000-8000-000000000401',is_anonymous:true,aud:'authenticated',role:'authenticated',user_metadata:{},app_metadata:{},created_at:new Date().toISOString()};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+86400,role:'authenticated'})).toString('base64url')+'.qa';
await page.route('**/*.supabase.co/**',async r=>{const u=new URL(r.request().url());const reply=data=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});const body=r.request().postDataJSON();
if(u.pathname.includes('/auth/v1/'))return reply(u.pathname.endsWith('/user')?user:{access_token:token,refresh_token:'qa-refresh',token_type:'bearer',expires_in:86400,user});
if(u.pathname.endsWith('/rpc/save_ball_knower_revisioned_user_state')){const value={...body.p_value,cloudRevision:(body.p_value.cloudRevision||0)+1};const row={state_key:body.p_state_key,value,updated_at:new Date().toISOString()};rows.set(row.state_key,row);return reply([row]);}
if(u.pathname.endsWith('/ball_knower_user_state')){if(r.request().method()==='POST'){const data=(Array.isArray(body)?body:[body]).map(x=>({...x,updated_at:new Date().toISOString()}));data.forEach(x=>rows.set(x.state_key,x));return reply(data)}const key=u.searchParams.get('state_key');if(key?.startsWith('eq.'))return reply(rows.get(key.slice(3))||null);return reply([...rows.values()]);}
return reply([]);});

 const profile={version:1,stage:'camp',name:'Touch Prospect',position:'RB',speed:82,power:80,awareness:72,overall:72,number:17,heightInches:72,weightLbs:210,teamAbbr:'JCY',rookieRole:'rotation',combineId:'touch-audit',upgradePoints:2};
 const life=chooseCamp(createCareerLife(profile),'prep','film');profile.careerLife=life;
 await page.addInitScript(({key,profile})=>{
 const original=setInterval;window.setInterval=((callback,delay,...args)=>original(callback,delay===30000?1000:delay,...args));
 if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(profile));
 localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','1');localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off');
 },{key,profile});
 let blockModels=true;await page.route('**/*.glb*',r=>blockModels?r.abort():r.continue());
 let navigations=0;page.on('framenavigated',f=>{if(f===page.mainFrame())navigations++;});
 await page.goto(base);
 await page.getByRole('button',{name:'Play Solo Mode',exact:true}).click();
 await page.locator('.bk-mode-card').filter({hasText:/My Player/i}).click();
 const continueButton=page.getByRole('button',{name:'CONTINUE',exact:true});
 await continueButton.or(page.getByRole('main',{name:'Training camp career',exact:true})).first().waitFor();
 if(await continueButton.isVisible())await continueButton.click();
 await page.getByRole('main',{name:'Training camp career',exact:true}).waitFor();
 await page.getByRole('button',{name:'PLAY POSITION WORKOUT',exact:true}).click();
 await page.getByRole('button',{name:'RETRY DRILL',exact:true}).waitFor();
 const before=navigations;
 const careerBefore=await page.evaluate(key=>localStorage.getItem(key),key);
 await page.getByRole('button',{name:'RETRY DRILL',exact:true}).click();
 await page.getByRole('button',{name:'RETRY DRILL',exact:true}).waitFor();
 assert.equal(navigations,before,'Failed Retry stays in embedded career');
 blockModels=false;
 await page.getByRole('button',{name:'RETRY DRILL',exact:true}).click();
 await page.getByRole('button',{name:'RESUME',exact:true}).waitFor({timeout:120000});
 await page.getByRole('button',{name:'RESUME',exact:true}).click();
 await page.getByRole('button',{name:'START RUN →',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.rb-game')?.dataset.phase==='running',null,{timeout:120000});
 await page.locator('.combine-scene canvas').dispatchEvent('webglcontextlost',{cancelable:true});
 await page.getByRole('button',{name:'RETRY DRILL',exact:true}).waitFor();
 const phase=await page.locator('.rb-game').getAttribute('data-phase');
 await page.getByRole('button',{name:'RETRY DRILL',exact:true}).click();
 await page.getByRole('button',{name:'RESUME',exact:true}).waitFor({timeout:120000});
 assert.equal(await page.locator('.rb-game').getAttribute('data-phase'),phase);
 assert.equal(await page.locator('.combine-scene canvas').count(),1);
 assert.equal(navigations,before);
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),careerBefore,'Incomplete recovery cannot manufacture a career score');
 await page.screenshot({path:'artifacts/my-player-career/rb-renderer-retry.png'});
 await page.getByRole('button',{name:'RESUME',exact:true}).click();
 await page.getByRole('button',{name:'Back to training camp',exact:true}).click();
 await page.getByRole('button',{name:'PLAY POSITION WORKOUT',exact:true}).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS actual embedded RB: failed model retry stays in career; restored models recover; running rep context interruption retries locally with one canvas, same phase and unchanged saved career');
 await context.close();
}
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
