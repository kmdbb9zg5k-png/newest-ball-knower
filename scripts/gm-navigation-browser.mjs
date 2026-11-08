import assert from 'node:assert/strict';
import {preview} from 'vite';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const width=Number(process.env.BK_QA_WIDTH||390);
const server=await preview({preview:{host:'127.0.0.1',port:4194,strictPort:true}});
const {default:c}=await import(process.env.BK_CHROMIUM_MODULE);
const browser=await chromium.launch({headless:true,executablePath:await c.executablePath(),args:c.args});
try{
const page=await browser.newPage({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});page.setDefaultTimeout(20000);
const rows=new Map();const user={id:'00000000-0000-4000-8000-000000000401',is_anonymous:true,aud:'authenticated',role:'authenticated',user_metadata:{},app_metadata:{},created_at:new Date().toISOString()};
const token='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+86400,role:'authenticated'})).toString('base64url')+'.qa';
await page.route('**/*.supabase.co/**',async r=>{const u=new URL(r.request().url());const reply=data=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});const body=r.request().postDataJSON();
if(u.pathname.includes('/auth/v1/'))return reply(u.pathname.endsWith('/user')?user:{access_token:token,refresh_token:'qa-refresh',token_type:'bearer',expires_in:86400,user});
if(u.pathname.endsWith('/rpc/save_ball_knower_revisioned_user_state')){const value={...body.p_value,cloudRevision:(body.p_value.cloudRevision||0)+1};const row={state_key:body.p_state_key,value,updated_at:new Date().toISOString()};rows.set(row.state_key,row);return reply([row]);}
if(u.pathname.endsWith('/ball_knower_user_state')){if(r.request().method()==='POST'){const data=(Array.isArray(body)?body:[body]).map(x=>({...x,updated_at:new Date().toISOString()}));data.forEach(x=>rows.set(x.state_key,x));return reply(data)}const key=u.searchParams.get('state_key');if(key?.startsWith('eq.'))return reply(rows.get(key.slice(3))||null);return reply([...rows.values()]);}
return reply([]);});
await page.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(new URL(r.request().url()).pathname==='/api/media'?{tracks:[],introUrl:null}:{available:false,ok:true,games:[]})}));

await page.addInitScript(()=>{localStorage.setItem('ball-knower-team-setup-v2','complete');localStorage.setItem('ball-knower-intro-completed-v1','2');localStorage.setItem('ball-knower-favorite-team','Philadelphia Eagles');localStorage.setItem('ball-knower-intro-sound-v1','off');localStorage.setItem('bk-guide-franchise-command-v1','seen');});
await page.goto('http://127.0.0.1:4194');
if(width>=600){await page.getByRole('button',{name:'Explore Ball Knower',exact:true}).click();await page.getByRole('dialog',{name:'Explore Ball Knower',exact:true}).getByRole('button',{name:/^Solo careers/}).click();}else await page.getByRole('button',{name:'Play Solo Mode',exact:true}).click();
await page.getByRole('button',{name:'Choose Career',exact:true}).click();
await page.getByRole('region',{name:'Choose your career',exact:true}).getByRole('button',{name:/^GM/}).click();
await page.locator('[data-gm-scene="office"]').waitFor();
assert.equal(await page.evaluate(()=>scrollY),0,'GM opens at the top');
await mkdir('artifacts/gm-events',{recursive:true});await page.screenshot({path:`artifacts/gm-events/full-app-entry-${width}.png`});
await page.getByRole('button',{name:'START FRANCHISE',exact:true}).click();
await page.locator('[data-gm-scene="gameplan"]').waitFor();
await page.getByRole('button',{name:'ROSTER',exact:true}).click();
await page.evaluate(()=>window.scrollTo(0,1000));
assert(await page.getByRole('button',{name:'THIS WEEK',exact:true}).evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'GM tabs stay reachable below the fixed header');
await page.getByRole('button',{name:'THIS WEEK',exact:true}).click();
await page.getByRole('button',{name:'START SEASON',exact:true}).scrollIntoViewIfNeeded();
assert((await page.evaluate(()=>scrollY))>300,'Test enters from a scrolled front office');
await page.getByRole('button',{name:'START SEASON',exact:true}).click();
await page.getByRole('dialog').waitFor();await page.getByRole('button',{name:'Close GM alert',exact:true}).click();
assert.equal(await page.evaluate(()=>scrollY),0,'Opening the season must reset scroll before an alert locks the page');
await page.screenshot({path:`artifacts/gm-events/full-app-season-${width}.png`});
await page.getByRole('button',{name:'NEW TEAM',exact:true}).click();
await page.getByRole('dialog',{name:'Start a new franchise',exact:true}).waitFor();
await page.getByRole('button',{name:'KEEP MY FRANCHISE',exact:true}).click();
await page.getByRole('button',{name:'Back to Solo Franchise Hub',exact:true}).click();
assert.equal(await page.evaluate(()=>scrollY),0,'Returning to front office opens at the top');
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
console.log('PASS full app GM picker, pinned tabs, season entry after scrolling, alert close and front-office return',width);
}finally{await browser.close();await server.httpServer.close();}
