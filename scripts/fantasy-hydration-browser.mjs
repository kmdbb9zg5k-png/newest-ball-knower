import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {build} from 'esbuild';
import {chromium} from 'playwright';

// Execute the real components' hydration hooks and edit handlers in a small
// React fixture. Deferred reads reproduce edits made while the cloud is slow.
const hub=await readFile('FantasyHub.tsx','utf8'),draft=await readFile('LeagueLiveDraftRoom.tsx','utf8');
const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
const effectAt=(s,needle)=>s.lastIndexOf('useEffect(',s.indexOf(needle));
const watchEffectStart=effectAt(hub,'void loadUserState<string[]>');
const watchEffect=hub.slice(watchEffectStart,hub.indexOf('}, []);',watchEffectStart)+7);
const draftEffectStart=effectAt(draft,'void loadMyCloudDraftPreferences');
const draftEffects=draft.slice(draftEffectStart,draft.indexOf('  useEffect(()=>{\n    const timer=window.setInterval',draftEffectStart));
const source=`import React,{useState,useRef,useEffect}from'react';import{createRoot}from'react-dom/client';
const w=window as any;w.reads=[];w.saves=[];
const loadUserState=(key:string)=>new Promise((resolve,reject)=>w.reads.push({key,resolve,reject}));
const saveUserState=async(key:string,value:any)=>{w.saves.push({key,value});};
const loadMyCloudDraftPreferences=(league:string,member:string)=>new Promise((resolve,reject)=>w.reads.push({key:league,resolve,reject}));
const saveMyCloudDraftPreferences=async(league:string,member:string,value:any)=>{w.saves.push({key:league,value});};
type DraftPreferences={queue:string[],favorites:string[],doNotDraft:string[],preRankings:string[]};
const EMPTY_PREFERENCES:DraftPreferences={queue:[],favorites:[],doNotDraft:[],preRankings:[]};
function Watch(){
${section(hub,'  const [watchlist, setWatchlist]','  const fantasyPositions')}
${watchEffect}
${section(hub,'  const toggleWatch =','  const enterPublicLeague')}
return <><button onClick={()=>toggleWatch('local')}>Toggle local watch</button><output id="watch">{JSON.stringify(watchlist)}</output></>;
}
function Draft({scope}:{scope:string}){const activeLeague={id:scope},myMember={id:'manager'};
${section(draft,'  const [preferences,setPreferences]','  const [now,setNow]')}
${draftEffects}
${section(draft,'  const editPreferences=','  if(!activeLeague||!draft)')}
return <><button onClick={()=>toggleQueue('local')}>Toggle local queue</button><button onClick={()=>togglePreference('favorites','fav')}>Favorite</button><output id="prefs">{JSON.stringify(preferences)}</output></>;
}
function App(){const[scope,setScope]=useState('A');return <><Watch/><Draft scope={scope}/><button onClick={()=>setScope('B')}>Other league</button></>};createRoot(document.getElementById('root')!).render(<App/>);`;
const bundle=await build({stdin:{contents:source,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
const server=createServer((req,res)=>{if(req.url==='/fixture.js'){res.setHeader('content-type','application/javascript');res.end(bundle.outputFiles[0].text);}else res.end('<html><meta name="viewport" content="width=device-width"><div id="root"></div><script src="/fixture.js"></script></html>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH,headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.reads.length===2);
 await page.getByText('Toggle local watch',{exact:true}).click();await page.getByText('Toggle local queue',{exact:true}).click();await page.getByText('Favorite',{exact:true}).click();
 await page.evaluate(()=>{window.reads.find(r=>r.key==='fantasy_watchlist').resolve(['remote']);window.reads.find(r=>r.key==='A').resolve({queue:['remote'],favorites:['remote-fav'],doNotDraft:[],preRankings:[]});});
 await page.waitForTimeout(500);
 assert.deepEqual(JSON.parse(await page.locator('#watch').textContent()),['remote','local'],'Late watchlist read must preserve a local toggle and remote entries');
 assert.deepEqual(JSON.parse(await page.locator('#prefs').textContent()),{queue:['remote','local'],favorites:['remote-fav','fav'],doNotDraft:[],preRankings:[]},'Late draft preferences must replay local queue/favorite edits');
 const saves=await page.evaluate(()=>window.saves);assert.deepEqual(saves.filter(s=>s.key==='fantasy_watchlist').at(-1).value,['remote','local']);assert.deepEqual(saves.filter(s=>s.key==='A').at(-1).value.queue,['remote','local']);
 await page.getByText('Other league',{exact:true}).click();await page.waitForFunction(()=>window.reads.some(r=>r.key==='B'));
 await page.waitForFunction(()=>JSON.parse(document.querySelector('#prefs').textContent).queue.length===0);
 assert.deepEqual(JSON.parse(await page.locator('#prefs').textContent()),{queue:[],favorites:[],doNotDraft:[],preRankings:[]},'Switching leagues clears previous league preferences');
 await page.evaluate(()=>window.reads.find(r=>r.key==='B').reject(new Error('fixture unavailable')));await page.waitForTimeout(500);assert.equal((await page.evaluate(()=>window.saves)).filter(s=>s.key==='B').length,0,'Failed untouched restore must not overwrite server preferences');
 assert.deepEqual(errors,[]);
 await page.close();
 const second=await browser.newPage();await second.goto(`http://127.0.0.1:${server.address().port}`);await second.waitForFunction(()=>window.reads.length===2);
 await second.getByText('Toggle local watch',{exact:true}).click();await second.getByText('Toggle local watch',{exact:true}).click();
 await second.getByText('Toggle local queue',{exact:true}).click();await second.getByText('Toggle local queue',{exact:true}).click();
 await second.evaluate(()=>{window.reads.find(r=>r.key==='fantasy_watchlist').resolve(['remote','local']);window.reads.find(r=>r.key==='A').resolve({queue:['remote','local'],favorites:[],doNotDraft:[],preRankings:[]});});
 await second.waitForTimeout(500);assert.deepEqual(JSON.parse(await second.locator('#watch').textContent()),['remote'],'User removal must beat late cloud inclusion');assert.deepEqual(JSON.parse(await second.locator('#prefs').textContent()).queue,['remote'],'Queue edit replay must enforce selected state, not toggle a remote item');await second.close();
 const third=await browser.newPage();await third.goto(`http://127.0.0.1:${server.address().port}`);await third.waitForFunction(()=>window.reads.length===2);
 await third.getByText('Toggle local queue',{exact:true}).click();await third.getByText('Other league',{exact:true}).click();await third.waitForFunction(()=>window.reads.some(r=>r.key==='B'));
 await third.evaluate(()=>{window.reads.find(r=>r.key==='A').resolve({queue:['old-league'],favorites:[],doNotDraft:[],preRankings:[]});window.reads.find(r=>r.key==='B').resolve({queue:['new-league'],favorites:[],doNotDraft:[],preRankings:[]});});
 await third.waitForTimeout(500);assert.deepEqual(JSON.parse(await third.locator('#prefs').textContent()).queue,['new-league']);assert.equal((await third.evaluate(()=>window.saves)).length,0,'Late old-league read must not write into new league');await third.close();
 console.log('PASS delayed watchlist/draft hydration preserves local intent and remote entries; double toggles retain removals; league switch ignores stale results; failed untouched read performs no save.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
