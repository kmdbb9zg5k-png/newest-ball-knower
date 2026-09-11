import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TEAM_THEMES, teamLogoUrl} from '../teamTheme';
import {PhotoCreditsContent, PlayerPhotoCredit} from '../PhotoCredits';
import {AiPhotoConsent, AI_PHOTO_CONSENT_VERSION} from '../AiPhotoConsent';
import {LICENSED_PLAYER_PORTRAITS, licensedPlayerPortraitUrl} from '../licensedPlayerPortraits';
import handler from '../api/my-player-art';

const source=(file:string)=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const decodeBadge=(abbr:string)=>decodeURIComponent(teamLogoUrl(abbr).split(',')[1]);
assert.equal(TEAM_THEMES.length,32);
assert.equal(new Set(TEAM_THEMES.map(t=>teamLogoUrl(t.abbr))).size,32);
for(const team of TEAM_THEMES){
  assert.ok(teamLogoUrl(team.abbr).startsWith('data:image/svg+xml,'));
  assert.match(decodeBadge(team.abbr),new RegExp(`>${team.abbr}<`));
  assert.doesNotMatch(decodeBadge(team.abbr),/espn|ea\.com|<image|<script|onload=/i);
}
assert.equal(teamLogoUrl('WSH'),teamLogoUrl('WAS'));
assert.equal(teamLogoUrl('jac'),teamLogoUrl('JAX'));
assert.equal(teamLogoUrl('<script onload=alert(1)>'),teamLogoUrl('BK'));
assert.doesNotMatch(source('teamTheme.ts'),/espncdn/);
assert.doesNotMatch(source('partners.ts'),/Official Dallas Cowboys Podcast Partner|Official Sports Data Provider/);
assert.match(source('partners.ts'),/cowboysplaybook365\.vercel\.app/);

const credits=renderToStaticMarkup(React.createElement(PhotoCreditsContent));
for(const [name,photo] of Object.entries(LICENSED_PLAYER_PORTRAITS)){
  const row=renderToStaticMarkup(React.createElement(PlayerPhotoCredit,{name}));
  assert.ok(row.includes(photo.sourceUrl.replace(/&/g,'&amp;').replace(/'/g,'&#x27;')));
  assert.ok(credits.includes(photo.licenseUrl));
  assert.ok(source('public/player-photo-credits.html').includes(photo.sourceUrl));
  assert.ok(licensedPlayerPortraitUrl(photo,NaN).endsWith('width=160'));
}
assert.equal(renderToStaticMarkup(React.createElement(PlayerPhotoCredit,{name:'Unmapped Person'})),'');
assert.match(source('LaunchCenter.tsx'),/panel==='credits'/);
assert.match(source('LaunchCenter.tsx'),/onOpen\('credits'\)/);
assert.match(source('FantasyPlayerDetail.tsx'),/<PlayerPhotoCredit/);
const consent=renderToStaticMarkup(React.createElement(AiPhotoConsent,{checked:false,onChange:()=>{}}));
assert.match(consent,/Google Gemini/);
assert.match(consent,/type="checkbox"/);
assert.doesNotMatch(consent,/checked=""/);
assert.match(source('MyPlayerStory.tsx'),/aiPhotoConsent: AI_PHOTO_CONSENT_VERSION/);
assert.match(source('api/my-player-art.ts'),/store: false/);
assert.match(source('public/privacy.html'),/Google Gemini/);

// Execute the real endpoint with an isolated auth transport. These tests must
// never call an image service, spend quota, or transmit a real photograph.
const envKeys=['GEMINI_API_KEY','MY_PLAYER_AI_PAID_SERVICE_CONFIRMED','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'] as const;
const env=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
const originalFetch=globalThis.fetch;
let authRequests=0,quotaRequests=0;
globalThis.fetch=(async(input:RequestInfo|URL)=>{
  const url=String(input instanceof Request?input.url:input);
  if(url==='https://test.invalid/auth/v1/user'){
    authRequests++;
    return new Response(JSON.stringify({id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(url==='https://test.invalid/rest/v1/rpc/consume_my_player_ai_quota'){
    quotaRequests++;
    return new Response('false',{status:200,headers:{'Content-Type':'application/json'}});
  }
  throw new Error(`Unexpected network request blocked: ${url}`);
}) as typeof fetch;
async function call(method:string,body:unknown={},token=''){
  const result={status:0,body:null as any,headers:{} as Record<string,string>};
  const res={setHeader:(k:string,v:string)=>{result.headers[k]=v;},status:(code:number)=>{result.status=code;return res;},json:(value:any)=>{result.body=value;return res;}};
  await handler({method,body,headers:{authorization:token?`Bearer ${token}`:''},socket:{}},res);
  return result;
}
try{
  process.env.GEMINI_API_KEY='test-only-not-real';
  process.env.SUPABASE_URL='https://test.invalid';
  process.env.SUPABASE_PUBLISHABLE_KEY='test-only-not-real';
  delete process.env.MY_PLAYER_AI_PAID_SERVICE_CONFIRMED;
  assert.equal((await call('GET')).body.available,false);
  process.env.MY_PLAYER_AI_PAID_SERVICE_CONFIRMED='true';
  assert.equal((await call('GET')).body.available,true);
  assert.equal((await call('POST')).status,401);
  assert.equal((await call('DELETE')).status,405);
  assert.equal((await call('POST',{},'test-token')).status,400);
  assert.equal((await call('POST',{aiPhotoConsent:'old-version'},'test-token')).status,400);
  assert.equal(quotaRequests,0,'No consent must not consume image quota');
  assert.equal((await call('POST',{aiPhotoConsent:AI_PHOTO_CONSENT_VERSION,image:'not-an-image'},'test-token')).status,400);
  assert.equal((await call('POST',{aiPhotoConsent:AI_PHOTO_CONSENT_VERSION,image:'data:image/jpeg;base64,AAAA'},'test-token')).status,429);
  assert.equal(quotaRequests,1);
  assert.equal(authRequests,4);
}finally{
  globalThis.fetch=originalFetch;
  for(const k of envKeys){if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];}
}
const migration=source('migrations/20260907010000_community_safety.sql');
assert.match(migration,/as restrictive/g);
assert.match(migration,/pg_advisory_xact_lock/);
assert.match(migration,/p_expected_user_id/);
assert.doesNotMatch(migration,/update public\.ball_knower_league_members|delete from public\.ball_knower_leagues|update public\.ball_knower_weekly_scores/);
assert.match(source('CommunitySafety.tsx'),/p_expected_user_id: expectedUserId/);
for(const file of ['FantasyLeagueCommunications.tsx','FantasyLeagueEssentials.tsx','FantasyLeaguePostDraft.tsx']){
  assert.match(source(file),/<CommunitySafetySettings/);
  assert.match(source(file),/<MessageSafety/);
  assert.match(source(file),/isBlocked/);
}
console.log('App Store remediation checks passed: 32 safe badges, reachable attribution, explicit AI permission, no-quota denial, account-bound safety controls. This does not certify third-party licenses.');
