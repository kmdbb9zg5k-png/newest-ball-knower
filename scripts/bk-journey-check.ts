import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (name: string) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const home = read('HomeDashboard.tsx');
const entry = read('HomeJourneyFeature.tsx');
const journey = read('BKJourney.tsx');
const css = read('bkJourney.css');
const migration = read('migrations/20261110201500_bk_journey_coin_rewards.sql');

assert.ok(home.includes('<HomeJourneyFeature onNavigate={onNavigate}/>'), 'The BK Journey home card must be mounted.');
assert.ok(home.indexOf('<HomeJourneyFeature onNavigate={onNavigate}/>') > home.indexOf('<HomeMiniGamesFeature'), 'Daily Challenges must be below Mini Games.');
assert.match(entry, /showModal\(\)/, 'The rewards experience must open as an interactive modal.');
assert.match(entry, /aria-label="Open Daily Challenges and BK Journey rewards"/, 'The card must be accessible.');
for (const label of ['DAILY CHALLENGES', 'BK JOURNEY', 'YOUR REWARDS', 'BK COINS', 'CLAIM']) {
  assert.ok((journey + entry).toUpperCase().includes(label), 'Missing approved journey feature: ' + label);
}
assert.ok(journey.includes("supabase.rpc('bk_journey_state')"), 'Progress must come from the authenticated server.');
assert.ok(journey.includes("supabase.rpc('bk_journey_claim'"), 'Coin claims must use the server-authoritative RPC.');
assert.ok(journey.includes("await refresh()"), 'Claim UI must reload confirmed balances from the server.');
assert.ok(!journey.includes('localStorage.'), 'Client storage must never act as the BK coin ledger.');
assert.ok(!journey.includes('Math.random()'), 'Do not fabricate progress or reward outcomes.');
assert.ok(journey.includes("data.today[m.id]"), 'Daily missions must reflect verified activity.');
assert.ok(journey.includes('disabled={!eligible || claimed || claiming !== null}'), 'The UI must reject unavailable and duplicate claims.');
assert.ok(journey.includes('Equipping these new badges and nameplates from My Locker will be enabled'), 'Unfinished cosmetic equip must not be advertised as live.');
assert.ok(journey.includes('cannot be redeemed for money'), 'Earned coins are not gambling or cashable currency.');
for (const pattern of [/enable row level security/g,/security definer/g,/auth\.uid\(\)/g,/on conflict \(auth_user_id,checkpoint\) do nothing/g,/get diagnostics v_inserted = row_count/g,/revoke all on public\.ball_knower_journey_wallet/g,/revoke all on public\.ball_knower_journey_claims/g,/grant execute on function public\.bk_journey_claim\(integer\) to authenticated/g]) {
  assert.match(migration, pattern, 'Missing economy security contract: ' + pattern);
}
assert.ok(migration.indexOf('if coalesce(v_xp,0)<v_need') < migration.indexOf('insert into public.ball_knower_journey_claims'), 'The server must check verified XP before issuing a reward.');
for (const amount of ['25,100,250,500,1000', '50,100,0,200,100']) assert.ok(migration.includes(amount), 'Milestone reward mismatch.');
assert.match(css, /@media\(max-width:720px\)/, 'The UI needs mobile layout.');
console.log('PASS BK Journey: home placement, verified progression, secured idempotent rewards, accessibility, mobile layout.');
