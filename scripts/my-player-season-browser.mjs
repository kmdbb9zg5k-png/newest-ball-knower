// Full My Player season through visible controls, starting from an isolated post-camp save.
// No live account writes; individual tactical reps run on the real animation clock.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {preview} from 'vite';
import {chromium} from 'playwright';
import {createCareerLife} from '../myPlayerCareer.ts';
import {createCareerArc} from '../myPlayerArc.ts';
const key='ballknower_solo_my_player_v2';const width=Number(process.env.BK_QA_WIDTH||390);const out='artifacts/my-player-season';await mkdir(out,{recursive:true});
const server=await preview({preview:{host:'127.0.0.1',port:4193,strictPort:true}});
const launch=process.env.BK_CHROMIUM_MODULE?await import(process.env.BK_CHROMIUM_MODULE):null;
const browser=await chromium.launch(launch?{headless:true,executablePath:await launch.default.executablePath(),args:launch.default.args}:{headless:true,executablePath:process.env.BROWSER_PATH||undefined,args:['--no-sandbox']});
let page;
try{
page=await browser.newPage({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});page.setDefaultTimeout(45000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
const shot=async name=>page.screenshot({path:`${out}/${width}-${name}.png`,animations:'disabled'});
const tab=async name=>page.getByRole('tab',{name,exact:true}).click();
const read=()=>page.evaluate(k=>({p:JSON.parse(localStorage.getItem(k)),s:JSON.parse(localStorage.getItem(k+':season'))}),key);
const layout=async()=>{assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');const y=await page.evaluate(()=>scrollY);for(const img of await page.locator('[data-player-scene]:visible img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(i=>i.decode());}await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),y);};
const open=async()=>{if(width>=600){await page.getByRole('button',{name:'Explore Ball Knower',exact:true}).click();await page.getByRole('dialog',{name:'Explore Ball Knower',exact:true}).getByRole('button',{name:/^Solo careers/}).click();}else await page.getByRole('button',{name:'Play Solo Mode',exact:true}).click();await page.getByRole('button',{name:'Choose Career',exact:true}).click();await page.getByRole('region',{name:'Choose your career',exact:true}).getByRole('button',{name:/^My Player/}).click();await page.getByRole('region',{name:'Weekly career story',exact:true}).waitFor();};
const rows=new Map();const user={id:'00000000-0000-4000-8000-000000000401',is_anonymous:true,aud:'authenticated',role:'authenticated',user_metadata:{},app_metadata:{},created_at:new Date().toISOString()};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+86400,role:'authenticated'})).toString('base64url')+'.qa';
await page.route('**/*.supabase.co/**',async r=>{const u=new URL(r.request().url());const reply=data=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});const body=r.request().postDataJSON();
if(u.pathname.includes('/auth/v1/'))return reply(u.pathname.endsWith('/user')?user:{access_token:token,refresh_token:'qa-refresh',token_type:'bearer',expires_in:86400,user});
if(u.pathname.endsWith('/rpc/save_ball_knower_revisioned_user_state')){const value={...body.p_value,cloudRevision:(body.p_value.cloudRevision||0)+1};const row={state_key:body.p_state_key,value,updated_at:new Date().toISOString()};rows.set(row.state_key,row);return reply([row]);}
if(u.pathname.endsWith('/ball_knower_user_state')){if(r.request().method()==='POST'){const data=(Array.isArray(body)?body:[body]).map(x=>({...x,updated_at:new Date().toISOString()}));data.forEach(x=>rows.set(x.state_key,x));return reply(data)}const key=u.searchParams.get('state_key');if(key?.startsWith('eq.'))return reply(rows.get(key.slice(3))||null);return reply([...rows.values()]);}
return reply([]);});
await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(new URL(r.request().url()).pathname==='/api/media'?{tracks:[],introUrl:null}:{available:false,ok:true,games:[]})}));

const profile={version:1,stage:'season',name:'Player Season QA',position:'WR',speed:82,power:80,awareness:72,overall:80,number:17,heightInches:74,weightLbs:215,teamAbbr:'JCY',rookieRole:'starter',combineId:'player-season-artwork',draftRound:2,draftPick:12,upgradePoints:2,xp:0,gamesPlayed:0};
profile.careerLife={...createCareerLife(profile),role:'starter',camp:{plan:'film',response:'team',scores:[85,85,85],complete:true},trust:80};profile.careerArc=createCareerArc(profile);
await page.addInitScript(({key,profile})=>{localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','2');localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off');if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(profile));},{key,profile});
await page.goto('http://127.0.0.1:4193',{waitUntil:'domcontentloaded'});await open();await layout();await shot('entry');
for(const name of ['My Player','Stats','Career','Story']){await tab(name);await layout();await shot(name.toLowerCase().replace(' ','-'));}
const choose=async(label,kind)=>{await page.getByRole('button',{name:new RegExp('^'+label)}).click();await page.getByRole('button',{name:`Lock in ${kind}`,exact:true}).click();};
async function moment(){
 await page.getByRole('button',{name:'PLAY MY MOMENT',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Playable career moment',exact:true});await dialog.waitFor();
 for(let rep=0;rep<5;rep++){
  await dialog.getByRole('button',{name:`START REP ${rep+1}`,exact:true}).click();
  await page.evaluate(()=>new Promise(resolve=>{function tick(){const d=document.querySelector('.life-moment');if(d.dataset.phase==='result'){resolve();return;}const p=Number(d.querySelector('progress').value),f=d.querySelector('.life-field'),lane=Number(f.dataset.target);if(p>=.55&&Number(f.dataset.lane)!==lane)d.querySelectorAll('.life-lanes button')[lane].click();if(p>=.72)d.querySelector('.life-moment-actions .career-primary')?.click();requestAnimationFrame(tick);}requestAnimationFrame(tick);}));
  await dialog.getByRole('button',{name:rep===4?'SAVE MY PERFORMANCE':'NEXT REP',exact:true}).click();
 }
 await dialog.waitFor({state:'hidden'});
}
let games=0;const scenes=new Set();
for(let turn=0;turn<23;turn++){
 let state=await read();if(state.s.stage==='finished')break;
 if(state.s.stage==='regular'&&state.s.weeks.length===17){await tab('Career');await page.getByRole('button',{name:'SELECTION SUNDAY',exact:true}).click();continue;}
 await tab('Story');await choose('Protect your recovery day','preparation');await layout();const art=await page.locator('[data-player-scene]:visible').first().getAttribute('data-player-scene');scenes.add(art);if(turn<4)await shot(`conversation-${art}`);await choose('Put the room first','response');await moment();
 state=await read();assert(state.p.careerLife.turn.score>=0);await tab('Career');const pending=state.s.interactions?.pendingScenario;if(pending)await page.getByText(pending.choices[0].label,{exact:true}).click();
 const before=state.p.careerLife.games;const action=page.getByRole('button',{name:/^(RESOLVE WEEK \d+|PLAY (WILD CARD|DIVISIONAL|CONFERENCE CHAMPIONSHIP|LEGACY BOWL))$/});await action.click();await page.waitForFunction(({key,before})=>JSON.parse(localStorage.getItem(key)).careerLife.games>before,{key,before});games++;await layout();console.log('My Player game',games,(await read()).s.stage);
 if(process.env.BK_QA_LAYOUT_ONLY==='1')break;
 if(games===6){await page.reload({waitUntil:'domcontentloaded'});await open();assert.equal((await read()).p.careerLife.games,6);}
}
if(process.env.BK_QA_LAYOUT_ONLY!=='1'){
 const state=await read();assert.equal(state.s.weeks.length,17);assert.equal(state.s.stage,'finished');await tab('Career');await page.getByRole('region',{name:'Career offseason'}).waitFor();await layout();await shot('offseason');await page.getByRole('button',{name:'RETURN FOR 2027',exact:true}).click();await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).careerArc.year===2027,key);await page.reload({waitUntil:'domcontentloaded'});await open();const next=await read();assert.equal(next.s.year,2027);assert.equal(next.s.weeks.length,0);assert.equal(next.p.gamesPlayed,games);assert.equal(next.p.careerLife.history.length,games);
}
await layout();assert.deepEqual(errors,[]);await writeFile(`${out}/${width}-results.json`,JSON.stringify({width,games,scenes:[...scenes],errors,state:await read()},null,2));console.log('PASS My Player',width,'games',games,'layoutOnly',process.env.BK_QA_LAYOUT_ONLY==='1');
}catch(error){if(page){await page.screenshot({path:`${out}/${width}-failure.png`,timeout:10000}).catch(()=>{});console.error(await page.locator('body').innerText().catch(()=>''));}throw error;}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
