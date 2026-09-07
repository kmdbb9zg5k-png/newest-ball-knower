import assert from 'node:assert/strict';
import fs from 'node:fs';
const origin='https://ballknowerofficial.com';
for(const file of ['nativeRuntime.ts','LockedDraftOrderView.tsx','FantasyLeagueCommandCenter.tsx','LaunchCenter.tsx','index.html']){
  const text=fs.readFileSync(file,'utf8');
  assert.ok(text.includes(origin),`${file} must use our verified application origin`);
  assert.ok(!text.includes('https://ballknower.com'),`${file} must not send API traffic or invitees to the unrelated domain`);
}
if(process.argv.includes('--live')){
  // No credentials. HTTP 200 alone can be an unrelated SPA fallback.
  const response=await fetch(`${origin}/api/health`,{redirect:'error',signal:AbortSignal.timeout(10000)});
  assert.equal(response.status,200);
  assert.match(response.headers.get('content-type')||'',/application\/json/i);
  const body=await response.json();
  assert.equal(body.service,'ball-knower');assert.equal(body.ok,true);
}
console.log('Production API and invite origins verified.');
