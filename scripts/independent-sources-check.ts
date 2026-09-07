import {restoreSoloPlayer} from '../legacySoloRestore';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import legacy from '../data/legacy-player-identities.json';
import {PLAYERS_DATABASE,KNOWN_PLAYERS_DATABASE,RATINGS_VALIDATION_REPORT} from '../players';
import {INDEPENDENT_FOOTBALL_INPUTS} from '../currentSeasonRoster';
import {independentRating,independentProjection,type FootballInput} from '../independentPlayerRatings';
import {normalizeNews,default as newsHandler} from '../api/nfl-news';
import {nativeApiUrl} from '../nativeRuntime';

const ids=new Set(KNOWN_PLAYERS_DATABASE.map(p=>p.id));
assert.equal(ids.size,KNOWN_PLAYERS_DATABASE.length);
for(const p of legacy){assert.ok(ids.has(p.id),`Lost legacy ID ${p.id}`);assert.deepEqual(Object.keys(p).sort(),['id','name','position','team']);}
assert.ok(PLAYERS_DATABASE.every(p=>p.active));
assert.ok(RATINGS_VALIDATION_REPORT.isValid);
assert.equal(new Set(PLAYERS_DATABASE.map(p=>p.team)).size,32);
for(const input of INDEPENDENT_FOOTBALL_INPUTS){
  assert.ok(input.name&&input.id);
  if(!input.gsisId)assert.deepEqual(input.stats,{},'Missing source ID must not acquire aggregate/other-player stats');
  const model=independentRating(input);
  assert.ok(Number.isFinite(model.overall)&&model.overall>=0&&model.overall<=99);
  const poisoned={...input,overallRating:99,ovr:99,attributes:{passing:99}} as FootballInput;
  assert.deepEqual(independentRating(poisoned),model,'Imported OVR fields must never affect independent ratings');
}
for(const [name,ovr] of Object.entries({'Jalen Hurts':90,'Patrick Mahomes':96,'Josh Allen':98,'Lamar Jackson':97,'Joe Burrow':93})){
  assert.equal(PLAYERS_DATABASE.find(p=>p.name===name&&p.position==='QB')?.ovr,ovr);
}
const noData={id:'test',name:'Fictional Test',sourceName:'Fictional Test',team:'PHI',position:'WR',active:true,depth:3,experience:0,draftPick:null,gsisId:null,providerId:null,rosterStatus:'ACT',stats:{}};
assert.equal(independentProjection(noData)?.actualPoints,null,'Missing actuals remain unavailable');
const line={...noData,stats:{games:10,receptions:20,receiving_yards:200}};
assert.equal(independentProjection(line,'ppr')!.actualPoints!-independentProjection(line,'standard')!.actualPoints!,20);
assert.equal(independentRating({...noData,position:'LT'}).confidence,'low');
assert.equal(nativeApiUrl('/api/health'),'https://ballknowerofficial.com/api/health');
assert.throws(()=>nativeApiUrl('https://ballknower.com/api/account-delete'),/obsolete/);
const bytes=readFileSync('data/published-independent-football.json');
const sha=createHash('sha256').update(bytes).digest('hex');
const migration=readFileSync('migrations/20260907020000_independent_football_sources.sql','utf8');
assert.ok(migration.includes(sha),'Migration must bind the exact tested snapshot');
assert.match(migration,/unfinished Draft Order Game/);
assert.doesNotMatch(migration,/sleeper\.app|gamedai|draftai\.live|thesharpbook/i);
assert.doesNotMatch(migration,/delete from public\.ball_knower_(?:league_members|player_week_scores|live_drafts)/);
for(const filename of ['maddenRatings.ts','madden27CurrentRoster.ts'])assert.equal(existsSync(filename),false);
const articles=normalizeNews({body:[{title:'Example headline',link:'https://publisher.example/a'},
  {title:'Same link',link:'https://publisher.example/a'},{title:'Bad link',link:'javascript:alert(1)'}]}).articles;
assert.equal(articles.length,1);assert.equal(articles[0].image,null);assert.equal(articles[0].description,'');assert.equal(articles[0].published,null);
const canonical=PLAYERS_DATABASE.find(p=>p.position==='QB')!;
const legacySaved={...canonical,name:'Do not restore saved identity',salary:1.1,ovr:99};
const restored=restoreSoloPlayer(legacySaved,canonical,true)!;
assert.equal(restored.salary,1.1,'Existing offline run budgets must survive source replacement');
assert.equal(restored.name,canonical.name);assert.equal(restored.ovr,canonical.ovr);
assert.equal(restoreSoloPlayer(restored,canonical,false)!.salary,1.1,'Budget compatibility must survive a second reload');
assert.equal(restoreSoloPlayer(legacySaved,canonical,false)!.salary,canonical.salary,'New runs use independent pricing');
assert.equal(restoreSoloPlayer(legacySaved,undefined,true),undefined,'Unknown identities must not be invented');
const originalFetch=globalThis.fetch;const originalKey=process.env.TANK01_API_KEY;
try{
  process.env.TANK01_API_KEY='test-key-not-real';let calls=0;
  globalThis.fetch=(async (url:any)=>{calls++;assert.match(String(url),/getNFLNews/);return new Response(JSON.stringify({body:[{title:'A',link:'https://publisher.example/b'}]}),{headers:{'content-type':'application/json'}})}) as typeof fetch;
  const makeRes=()=>({headers:{},code:0,body:null as any,setHeader(k:string,v:string){this.headers[k]=v},status(n:number){this.code=n;return this},json(body:any){this.body=body;return this}});
  const a=makeRes(),b=makeRes();await Promise.all([newsHandler({method:'GET'},a),newsHandler({method:'GET'},b)]);
  assert.equal(calls,1,'Concurrent news requests must share one upstream request');assert.equal(a.body.available,true);
  const post=makeRes();await newsHandler({method:'POST'},post);assert.equal(post.code,405);
}finally{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.TANK01_API_KEY;else process.env.TANK01_API_KEY=originalKey}
console.log(`Independent sources passed: ${legacy.length} saved IDs preserved, ${PLAYERS_DATABASE.length} active records, bounded model estimates, news and native origin guards.`);
