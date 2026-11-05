import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createScoringProviderProbe,selectProbeGame,summarizeProviderCoverage,type ProbeChoice} from '../server/bk/scoring-provider-probe';

const now=Date.parse('2026-11-05T23:00:00Z'),stamp=new Date(now).toISOString();
const teams='ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' '),circle=[...teams],schedule:Record<string,string>[]=[];
for(let round=0;round<17;round++){
 for(let pair=0;pair<16;pair++){
  const week=round===16&&pair===0?18:round+1,away=circle[pair],home=circle[31-pair];
  schedule.push({game_id:`2026_${String(week).padStart(2,'0')}_${away}_${home}`,season:'2026',game_type:'REG',week:String(week),gameday:new Date(Date.parse('2026-09-10')+(week-1)*7*86400_000).toISOString().slice(0,10),gametime:'13:00',away_team:away,home_team:home,away_score:'0',home_score:'14',result:'14',total:'14',spread_line:'3',total_line:'42'});
 }
 circle.splice(1,0,circle.pop()!);
}
const completion=[{game_id:schedule[0].game_id}],choice=selectProbeGame(schedule,completion,stamp,stamp,now);
assert.equal(choice.id,schedule[0].game_id);assert.equal(choice.providerGameId,`20260910_${schedule[0].away_team}@${schedule[0].home_team}`);
for(const selected of ['2025_01_ARI_WAS',schedule[1].game_id])assert.throws(()=>selectProbeGame(schedule,completion,stamp,stamp,now,selected),'only completed current-season schedule IDs may select a provider request');
assert.throws(()=>selectProbeGame(schedule,[],stamp,stamp,now));
assert.throws(()=>selectProbeGame(schedule,completion,null,stamp,now));
assert.throws(()=>selectProbeGame(schedule,completion,new Date(now-1000).toISOString(),stamp,now));
assert.throws(()=>selectProbeGame(schedule.slice(1),completion,stamp,stamp,now));
const identities=[{id:'app-qb',providerId:'provider-1',name:'Fixture QB',team:choice.away,position:'QB',active:true}];
const box={gameID:choice.providerGameId,gameStatus:'Final/OT',playerStats:[{playerID:'provider-1',longName:'Fixture QB',teamAbv:choice.away,pos:'QB',Passing:{passYds:0,passTD:'0',int:false},Defense:{fumblesLost:null}},{playerID:'unmapped-1',longName:'PRIVATE RAW NAME',teamAbv:choice.home,pos:'WR',Receiving:{recYds:'NaN'}}],DST:{away:{teamAbv:choice.away,sacks:0},home:{teamAbv:choice.home,sacks:'2.5',ptsAllowed:''}},privateField:'RAW PROVIDER BODY MUST STAY PRIVATE'};
const projection={week:choice.week,season:2026,playerProjections:[{playerID:'provider-1',longName:'Fixture QB',teamAbv:choice.away,pos:'QB',fantasyPointsDefault:{standard:10.5,halfPPR:0,PPR:'12.75'}}],teamDefenseProjections:[{teamAbv:choice.away,fantasyPointsDefault:0}]};
const coverage=summarizeProviderCoverage(box,projection,identities,choice);
assert.equal(coverage.box.reportedFinal,true);assert.equal(coverage.box.gameIdentityMatches,true);
assert.equal(coverage.box.byPosition.QB.fields.passingYards.zero,1);assert.equal(coverage.box.byPosition.QB.fields.interceptionsThrown.invalid,1);assert.equal(coverage.box.byPosition.QB.fields.fumblesLost.missing,1);
assert.equal(coverage.box.defenseFields.sacks.valid,2);assert.equal(coverage.box.defenseFields.pointsAllowed.missing,2,'missing points allowed must never be a true zero');
assert.equal(coverage.box.identities.provisionalProviderIdMatches,1);assert.equal(coverage.box.identities.unmapped,1);assert.equal(coverage.box.identities.providerIdNamespaceVerified,false);
assert.equal(coverage.projections.fields.standard.valid,1);assert.equal(coverage.projections.fields.half_ppr.zero,1);assert.equal(coverage.projections.fields.ppr.valid,1);assert.equal(coverage.projections.defenseNumericPoints,1);
assert.equal(coverage.projections.reportedWeekMatches,true);assert.ok(!JSON.stringify(coverage).includes('PRIVATE RAW NAME'));assert.ok(!JSON.stringify(coverage).includes(box.privateField));
const response=()=>({statusCode:0,headers:{} as Record<string,string>,body:null as any,setHeader(key:string,value:string){this.headers[key]=value;},status(code:number){this.statusCode=code;return this;},json(value:unknown){this.body=value;return this;}});
const run=async(handler:any,request:any={method:'GET',query:{}})=>{const res=response();await handler(request,res);return res;};
let network=0,selections=0;
const fetcher=(async(input:any,options:any)=>{
 network++;const url=new URL(String(input));assert.equal(url.hostname,'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com');assert.equal(options.redirect,'manual');assert.equal(options.headers['x-rapidapi-key'],'fixture-private-key');
 if(url.pathname==='/getNFLBoxScore'){assert.equal(url.searchParams.get('gameID'),choice.providerGameId);assert.equal(url.searchParams.get('playByPlay'),'false');}
 else {assert.equal(url.pathname,'/getNFLProjections');assert.equal(url.searchParams.get('week'),String(choice.week));}
 return new Response(JSON.stringify({body:url.pathname==='/getNFLBoxScore'?box:projection}));
}) as typeof fetch;
const deps={identities,now:()=>now,fetchImpl:fetcher,loadChoice:async(_fetch:typeof fetch,_now:number,selected?:string)=>{selections++;assert.ok(selected===undefined||selected===choice.id);return {choice,sourceTiming:{schedulePublishedAt:stamp,completionPublishedAt:stamp}};}};
for(const VERCEL_ENV of ['production','development',undefined]){
 const result=await run(createScoringProviderProbe({...deps,env:{VERCEL_ENV,TANK01_API_KEY:'fixture-private-key'}}));assert.equal(result.statusCode,404);
}
assert.equal(network,0);assert.equal(selections,0,'non-preview routes must not touch inputs or provider');
const missing=await run(createScoringProviderProbe({...deps,env:{VERCEL_ENV:'preview'}}));assert.equal(missing.statusCode,503);assert.equal(missing.body.providerConfigured,false);assert.equal(network,0);
const handler=createScoringProviderProbe({...deps,env:{VERCEL_ENV:'preview',RAPIDAPI_KEY:'fixture-private-key',TANK01_RAPIDAPI_HOST:'malicious.invalid'}});
for(const request of [{method:'POST',query:{}},{method:'GET',query:{gameId:'2025_01_ARI_WAS'}},{method:'GET',query:{gameId:[choice.id]}},{method:'GET',query:{url:'https://malicious.invalid',_vercel_share:'fixture-transport-secret'}}])assert.ok([400,405].includes((await run(handler,request)).statusCode));
assert.equal(network,0);assert.equal(selections,0);
const result=await run(handler,{method:'GET',query:{gameId:choice.id}});
assert.equal(result.statusCode,200);assert.equal(result.body.providerRequests,2);assert.equal(network,2);assert.equal(selections,1);assert.equal(result.body.writes,0);assert.equal(result.body.activationCertified,false);assert.equal(result.body.scoringAvailable,false);
assert.equal(result.headers['Cache-Control'],'private, no-store');assert.ok(!JSON.stringify(result.body).includes('fixture-private-key'));assert.ok(!JSON.stringify(result.body).includes('PRIVATE RAW NAME'));
const shared=await run(handler,{method:'GET',query:{'x-vercel-protection-bypass':'fixture-transport-secret','x-vercel-set-bypass-cookie':'fixture-cookie-secret',_vercel_share:'fixture-share-secret'}});
assert.equal(shared.statusCode,200);assert.equal(shared.body.providerRequests,2);assert.equal(network,4);assert.equal(selections,2);
for(const token of ['fixture-transport-secret','fixture-cookie-secret','fixture-share-secret'])assert.ok(!JSON.stringify(shared.body).includes(token),'deployment transport values must never be returned');
const denied=await run(createScoringProviderProbe({...deps,env:{VERCEL_ENV:'preview',TANK01_API_KEY:'fixture-private-key'},fetchImpl:(async()=>new Response('SECRET PRIVATE ERROR',{status:401})) as typeof fetch}));
assert.equal(denied.body.boxRequest.reason,'provider_authentication_failed');assert.equal(denied.body.projectionRequest.reason,'provider_authentication_failed');assert.ok(!JSON.stringify(denied.body).includes('SECRET PRIVATE ERROR'));
const route=readFileSync(new URL('../api/scoring-provider-probe.ts',import.meta.url),'utf8');assert.ok(!route.includes('supabase'));assert.ok(!route.includes('createClient'));
// TSX can mask native Node JSON loading failures. Import the unchanged route in
// a plain ESM child process, with only its handler dependency isolated.
const nativeRoot=mkdtempSync(join(tmpdir(),'bk-probe-esm-'));
try{
 for(const directory of ['api','data','server/bk'])mkdirSync(join(nativeRoot,directory),{recursive:true});
 writeFileSync(join(nativeRoot,'package.json'),'{"type":"module"}');
 writeFileSync(join(nativeRoot,'api/scoring-provider-probe.mjs'),route);
 copyFileSync(new URL('../data/independent-football-inputs.json',import.meta.url),join(nativeRoot,'data/independent-football-inputs.json'));
 writeFileSync(join(nativeRoot,'server/bk/scoring-provider-probe.js'),'export const createScoringProviderProbe=()=>()=>{};');
 const native=spawnSync(process.execPath,['--input-type=module','--eval',`const route=await import(${JSON.stringify(pathToFileURL(join(nativeRoot,'api/scoring-provider-probe.mjs')).href)});if(typeof route.default!=='function')process.exit(1);`],{encoding:'utf8'});
 assert.equal(native.status,0,`Native ESM route startup failed: ${native.stderr}`);
}finally{rmSync(nativeRoot,{recursive:true,force:true});}
console.log('Preview scoring probe: production 404, fixed completed-game selection, two bounded fixed-host provider requests, missing/zero/identity coverage, secret/raw-body redaction and zero database access passed.');
