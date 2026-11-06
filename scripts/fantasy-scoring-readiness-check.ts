import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createScoringReadinessHandler,READINESS_GAME} from '../server/bk/scoring-readiness';

const now=Date.parse('2026-11-06T04:00:00Z');
const secret='cron-fixture-credential',key='provider-fixture-credential';
const env={VERCEL_ENV:'production',CRON_SECRET:secret,TANK01_API_KEY:key,TANK01_READINESS_ENABLED_UNTIL:new Date(now+30*60_000).toISOString()};
const logs:Record<string,unknown>[]=[],calls:{url:URL;init?:RequestInit}[]=[];
const player={playerID:'fixture-provider-id',longName:'NEVER LOG A PLAYER NAME',teamAbv:'CHI',pos:'QB',Passing:{passYds:0,passTD:'0',int:false},private:'NEVER LOG A PROVIDER BODY'};
const fetcher:typeof fetch=async(input,init)=>{
 const url=new URL(String(input));calls.push({url,init});
 return new Response(JSON.stringify({body:url.pathname==='/getNFLBoxScore'?{gameID:READINESS_GAME.providerGameId,gameStatus:'Final',playerStats:[player],DST:{away:{teamAbv:'CHI',sacks:0},home:{teamAbv:'SEA',ptsAllowed:''}}}:{week:8,season:2026,playerProjections:[]}}),{headers:{'last-modified':'Fri, 06 Nov 2026 03:59:00 GMT'}});
};
const response=()=>({statusCode:0,body:null as any,headers:{} as Record<string,string>,setHeader(name:string,value:string){this.headers[name]=value;},status(value:number){this.statusCode=value;return this;},json(value:unknown){this.body=value;return this;}});
const invoke=async(overrides:{env?:typeof env;method?:string;authorization?:string;query?:Record<string,unknown>;fetcher?:typeof fetch}={})=>{
 const res=response();await createScoringReadinessHandler({identities:[],env:overrides.env??env,now:()=>now,fetchImpl:overrides.fetcher??fetcher,log:value=>logs.push(value)})({method:overrides.method??'GET',headers:{authorization:overrides.authorization??`Bearer ${secret}`},query:overrides.query??{}},res);return res;
};
assert.equal((await invoke({authorization:'Bearer wrong'})).statusCode,401);
assert.equal((await invoke({method:'POST'})).statusCode,405);
assert.equal((await invoke({query:{gameID:'arbitrary'}})).statusCode,400);
for(const overridden of [{VERCEL_ENV:'preview'},{TANK01_READINESS_ENABLED_UNTIL:''},{TANK01_READINESS_ENABLED_UNTIL:new Date(now).toISOString()},{TANK01_READINESS_ENABLED_UNTIL:new Date(now+61*60_000).toISOString()}]){
 const res=await invoke({env:{...env,...overridden}});assert.equal(res.body.enabled,false);assert.equal(res.body.providerRequests,0);
}
assert.equal(calls.length,0,'disabled or unauthorized requests must consume no provider calls');
assert.equal((await invoke({env:{...env,TANK01_API_KEY:''}})).statusCode,503);
const res=await invoke();assert.equal(res.statusCode,200);assert.equal(res.body.writes,0);assert.equal(res.body.providerRequests,2);assert.equal(calls.length,2);assert.equal(logs.length,1);
assert.equal(calls[0].url.searchParams.get('gameID'),READINESS_GAME.providerGameId);assert.equal(calls[1].url.searchParams.get('week'),'8');
for(const call of calls){assert.equal(call.url.hostname,'tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com');assert.equal(call.init?.redirect,'manual');assert.equal(new Headers(call.init?.headers).get('x-rapidapi-key'),key);assert.equal(new Headers(call.init?.headers).get('x-rapidapi-host'),call.url.hostname);}
const output=JSON.stringify({logs,response:res.body});
for(const sensitive of [secret,key,player.playerID,player.longName,player.private])assert.ok(!output.includes(sensitive),'diagnostic output must contain aggregate metadata only');
const event=logs[0] as any;assert.equal(event.coverage.box.byPosition.QB.fields.passingYards.zero,1);assert.equal(event.coverage.box.byPosition.QB.fields.interceptionsThrown.invalid,1);assert.equal(event.coverage.box.defenseFields.pointsAllowed.missing,2);
// Authentication bodies may contain credentials, IDs, links and stat-shaped
// data. Only the fixed classification reaches logs; none reaches coverage.
for(const [status,message,expected]of [
 [403,'You are not subscribed to this API.','not_subscribed'],
 [401,'Invalid API key.','invalid_api_key'],
 [403,'Invalid X-RapidAPI-Key.','invalid_api_key'],
 [403,'Access denied: application restricted.','forbidden_or_restricted'],
 [403,'Unrecognized provider explanation.','unknown'],
 [403,'Not subscribed; invalid API key.','unknown'],
]as const){
 const before=calls.length;
 const errorResponse=await invoke({fetcher:async(input,init)=>{
  calls.push({url:new URL(String(input)),init});
  return new Response(JSON.stringify({message:`${message} NEVER LOG AUTH BODY ${key} ${secret}`,requestId:'NEVER LOG REQUEST ID',body:{playerStats:[player]}}),{status});
 }});
 const entry=logs.at(-1)as any;
 assert.equal(calls.length-before,2);assert.equal(entry.boxRequest.status,status);assert.equal(entry.boxRequest.authenticationFailure,expected);assert.equal(entry.projectionRequest.authenticationFailure,expected);
 assert.equal(entry.coverage.box.playerRows,0);assert.equal(entry.coverage.projections.playerRows,0);assert.deepEqual(entry.coverage.box.topLevelFields,[]);
 const safe=JSON.stringify({entry,response:errorResponse.body});for(const value of [key,secret,'NEVER LOG AUTH BODY','NEVER LOG REQUEST ID',player.playerID])assert.ok(!safe.includes(value),'authentication diagnostic must redact all provider text');
}
await invoke({fetcher:async()=>new Response('<html>forbidden</html>',{status:403})});assert.equal((logs.at(-1)as any).boxRequest.authenticationFailure,'unknown','non-JSON errors cannot establish a reason');
await invoke({fetcher:async()=>new Response('{}',{status:401,headers:{'content-length':'4000001'}})});assert.equal((logs.at(-1)as any).boxRequest.authenticationFailure,'unknown','authentication bodies retain the streaming cap');
const failures:typeof fetch=async()=>{throw Error(`NEVER LOG RAW ERROR ${key}`);};
assert.equal((await invoke({fetcher:failures})).statusCode,200);assert.ok(!JSON.stringify(logs).includes('NEVER LOG RAW ERROR'));
let redirectCalls=0;
await invoke({fetcher:async()=>{redirectCalls++;return new Response(null,{status:302,headers:{location:'https://attacker.invalid/'}});}});assert.equal(redirectCalls,2,'no redirects or retries may expand the two-call budget');
await invoke({fetcher:async()=>new Response('{}',{headers:{'content-length':'4000001'}})});assert.equal(logs.at(-1)?.providerRequests,2);
for(const file of ['../server/bk/scoring-readiness.ts','../server/bk/scoring-provider-coverage.ts','../api/fantasy-scoring-readiness.ts']){
 const source=readFileSync(new URL(file,import.meta.url),'utf8');assert.ok(!/createClient|\.from\(|\.rpc\(/.test(source),'readiness modules must have no database writer');
}
console.log('Fantasy scoring readiness checks passed: authentication, expiry, fixed game, two-call budget, missing versus zero, no redirects/writes, safe authentication classification, and redacted metadata.');
