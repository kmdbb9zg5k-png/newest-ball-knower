import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BALL_KNOWER_API_ORIGIN, nativeApiUrl } from '../nativeRuntime';
import { kickoffIso } from '../server/nflPredictionFeed.js';

const requested=process.argv[2]||'all';
const run=(name:string,fn:()=>void)=>{if(requested==='all'||requested===name)fn()};

run('bridge',()=>{
  const origin=BALL_KNOWER_API_ORIGIN;
  assert.equal(nativeApiUrl('/api/nfl-sportsbook'),`${origin}/api/nfl-sportsbook`);
  assert.equal(nativeApiUrl('api/nfl-sportsbook?week=1'),`${origin}/api/nfl-sportsbook?week=1`);
  assert.equal(nativeApiUrl('capacitor://localhost/api/nfl-sportsbook?gameIds=a%2Cb'),`${origin}/api/nfl-sportsbook?gameIds=a%2Cb`);
  assert.equal(nativeApiUrl('ionic://localhost/api/nfl-news'),`${origin}/api/nfl-news`);
  assert.equal(nativeApiUrl('http://localhost/api/media'),`${origin}/api/media`);
  assert.equal(nativeApiUrl('https://127.0.0.1/api/fantasy-transactions'),`${origin}/api/fantasy-transactions`);
  assert.equal(nativeApiUrl('https://example.com/api/nfl-sportsbook'),'https://example.com/api/nfl-sportsbook');
  assert.equal(nativeApiUrl('not a valid url'),'not a valid url');
});

run('kickoff',()=>{
  const september=kickoffIso('2026-09-10','8:20 PM');
  assert.equal(september,'2026-09-10T20:20:00-04:00');
  assert.ok(Number.isFinite(Date.parse(september!)),'September kickoff must parse as a valid iOS-safe ISO timestamp');
  const december=kickoffIso('2026-12-10','8:15 PM');
  assert.equal(december,'2026-12-10T20:15:00-05:00');
  assert.ok(Number.isFinite(Date.parse(december!)),'December kickoff must parse as a valid iOS-safe ISO timestamp');
  assert.equal(kickoffIso('not-a-date','8:20 PM'),null);
  assert.equal(kickoffIso('2026-09-10','25:99'),null);
});

run('ui',()=>{
  const sportsbook=fs.readFileSync('SportsbookHub.tsx','utf8');
  assert.match(sportsbook,/NFL lines are temporarily unavailable\. Use Refresh to try again\./);
  assert.match(sportsbook,/data\?\.available===false/);
  assert.match(sportsbook,/setGames\(\[\]\)/,'failed refresh must clear a previously valid board');
  assert.doesNotMatch(sportsbook,/setError\([^\n]*err\?\.message/,'raw native/provider errors must not be rendered');
  assert.match(sportsbook,/does not accept or facilitate wagers/);
  const endpoint=fs.readFileSync('api/nfl-sportsbook.ts','utf8');
  assert.match(endpoint,/available:false/);
  assert.match(endpoint,/s-maxage=60/);
  assert.doesNotMatch(endpoint,/stale-while-revalidate/,'Picks must not silently keep a stale board current during outage');
});

run('feed',()=>{
  const feed=fs.readFileSync('server/nflPredictionFeed.js','utf8');
  assert.match(feed,/TANK01_API_KEY\|\|process\.env\.RAPIDAPI_KEY/,'Tank01 fallback must reuse the existing server-only integration key');
  assert.match(feed,/JAC:'JAX'/,'Jacksonville provider alias must normalize correctly');
  assert.match(feed,/fetchTank01FallbackGames/);
});

console.log(`Build 7 native regression gate passed: ${requested}.`);
