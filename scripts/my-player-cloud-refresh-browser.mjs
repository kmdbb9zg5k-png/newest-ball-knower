import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname} from 'node:path';
import {createCareerLife,chooseCamp,campScore} from '../myPlayerCareer.ts';
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
// Full built-app regression: background sync must not unmount an active RB audition.
// Only the 30-second cloud polling interval is accelerated; game timing stays real.
try {
for(const width of [320,390]){
 const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true});
await context.route('**/api/**',r=>r.fulfill({json:{available:false}}));
 const page=await context.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
const rows=new Map();let pulls=0,failPull=false;const user={id:'00000000-0000-4000-8000-000000000401',is_anonymous:true,aud:'authenticated',role:'authenticated',user_metadata:{},app_metadata:{},created_at:new Date().toISOString()};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+86400,role:'authenticated'})).toString('base64url')+'.qa';
await page.route('**/*.supabase.co/**',async r=>{const u=new URL(r.request().url());const reply=data=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});const body=r.request().postDataJSON();
if(u.pathname.includes('/auth/v1/'))return reply(u.pathname.endsWith('/user')?user:{access_token:token,refresh_token:'qa-refresh',token_type:'bearer',expires_in:86400,user});
if(u.pathname.endsWith('/rpc/save_ball_knower_revisioned_user_state')){const value={...body.p_value,cloudRevision:(body.p_value.cloudRevision||0)+1};const row={state_key:body.p_state_key,value,updated_at:new Date().toISOString()};rows.set(row.state_key,row);return reply([row]);}
if(u.pathname.endsWith('/ball_knower_user_state')){if(r.request().method()==='POST'){const data=(Array.isArray(body)?body:[body]).map(x=>({...x,updated_at:new Date().toISOString()}));data.forEach(x=>rows.set(x.state_key,x));return reply(data)}pulls++;if(failPull)return r.fulfill({status:503,json:{message:'fixture cloud temporarily unavailable'}});const key=u.searchParams.get('state_key');if(key?.startsWith('eq.'))return reply(rows.get(key.slice(3))||null);return reply([...rows.values()]);}
return reply([]);});

 const profile={version:1,stage:'camp',name:'Touch Prospect',position:'RB',speed:82,power:80,awareness:72,overall:72,number:17,heightInches:72,weightLbs:210,teamAbbr:'JCY',rookieRole:'rotation',combineId:'touch-audit',upgradePoints:2};
 let life=chooseCamp(createCareerLife(profile),'prep','film');life=campScore(life,0,85);life=chooseCamp(life,'response','team');profile.careerLife=life;
 await page.addInitScript(({key,profile})=>{
 const original=setInterval;window.setInterval=((callback,delay,...args)=>original(callback,delay===30000?1000:delay,...args));
 if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(profile));
 localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','1');localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off');
 },{key,profile});
 const nextPull=async()=>{const before=pulls;for(let i=0;i<100&&pulls===before;i++)await page.waitForTimeout(100);assert(pulls>before,'Cloud pull should occur');await page.waitForTimeout(150);};
 await page.goto(base);
 await page.getByRole('button',{name:'Play Solo Mode',exact:true}).click();
 await page.locator('.bk-mode-card').filter({hasText:/My Player/i}).click();
 const continueButton=page.getByRole('button',{name:'CONTINUE',exact:true});
 await continueButton.or(page.getByRole('main',{name:'Training camp career',exact:true})).first().waitFor();
 if(await continueButton.isVisible())await continueButton.click();
 await page.getByRole('main',{name:'Training camp career',exact:true}).waitFor();
 await page.getByRole('button',{name:'PLAY FIRST-TEAM AUDITION',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Playable career moment',exact:true});
 await dialog.waitFor();
 for(let rep=0;rep<5;rep++){
  await page.getByRole('button',{name:`START REP ${rep+1}`,exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector('progress[aria-label="Play timing"]').value)>=.65);
  const target=await page.locator('.life-field').getAttribute('data-target'),lane=rep<2?(Number(target)+1)%3:Number(target);
  await page.getByRole('button',{name:['LEFT','MIDDLE','RIGHT'][lane],exact:true}).click();
  await page.waitForFunction(()=>Number(document.querySelector('progress[aria-label="Play timing"]').value)>=.72);
  await page.getByRole('button',{name:'CUT',exact:true}).click();
  await page.locator('.life-moment[data-phase="result"]').waitFor();
  console.log('RB rep',rep+1,await dialog.getByRole('heading').textContent());
  assert(await dialog.isVisible());
  if(rep===2){
   await page.screenshot({path:`artifacts/my-player-career/rb-third-rep-${width}.png`});
   const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
   const reordered=Object.fromEntries(Object.entries(saved).reverse());
   rows.set('solo_my_player_v2',{state_key:'solo_my_player_v2',value:{raw:JSON.stringify({...reordered,faceImage:'',renderImage:'',athletePortrait:''})},updated_at:new Date(Date.now()+1000).toISOString()});
   await nextPull();
   assert(await dialog.isVisible(),'Equal-content refresh must preserve third rep');
   assert.equal(await page.locator('aside[aria-label="Cloud save available"]').count(),0,'No-op reordered/private-image echo must not offer a restore');
   console.log('PASS',width,'no-op cloud echo preserves third-rep result');
   rows.set('favorite_team',{state_key:'favorite_team',value:{raw:'Dallas Cowboys'},updated_at:new Date(Date.now()+1000).toISOString()});
   await nextPull();
   assert(await dialog.isVisible(),'A different remote save must wait until the user loads it');
   assert.equal(await page.evaluate(()=>localStorage.getItem('ball-knower-favorite-team')),'Philadelphia Eagles');
   assert.equal(await page.locator('aside[aria-label="Cloud save available"]').count(),1);
   const remoteCareer={...saved,careerLife:{...saved.careerLife,camp:{...saved.careerLife.camp,scores:[saved.careerLife.camp.scores[0],25]}}};
   rows.set('solo_my_player_v2',{state_key:'solo_my_player_v2',value:{raw:JSON.stringify(remoteCareer)},updated_at:new Date(Date.now()+1000).toISOString()});
   await nextPull();
   assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).careerLife.camp.scores.length,key),1,'Remote completion must not replace the in-flight local evaluation');
   assert(await dialog.isVisible());
   failPull=true;await nextPull();assert(await dialog.isVisible(),'Cloud request failure must not leave the moment');failPull=false;
   console.log('PASS',width,'changed remote state staged; failed request leaves moment playable');
  }
  await page.getByRole('button',{name:rep===4?'SAVE MY PERFORMANCE':'NEXT REP',exact:true}).click();
 }
 await dialog.waitFor({state:'hidden'});
 await page.getByRole('button',{name:'PLAY PRESEASON SPOTLIGHT',exact:true}).waitFor();
 assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).careerLife.camp.scores.length,key),2);
 await page.getByRole('button',{name:'Load cloud save',exact:true}).click();
 await page.getByRole('button',{name:'Play Solo Mode',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('ball-knower-favorite-team')),'Dallas Cowboys');
 assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).careerLife.camp.scores.length,key),2,'Explicit restore flushes the just-completed local camp score');
 assert.equal(JSON.parse(rows.get('solo_my_player_v2').value.raw).careerLife.camp.scores.length,2);
 assert.notEqual(JSON.parse(rows.get('solo_my_player_v2').value.raw).careerLife.camp.scores[1],25,'Newly completed local evaluation wins over staged older remote completion');
 assert.deepEqual(errors,[]);console.log('PASS',width,'five RB reps saved; explicit cloud load alone returns Home and preserves fresh camp score');
 await context.close();
}
}finally{await browser.close();if(server)await new Promise(resolve=>server.close(resolve));}
