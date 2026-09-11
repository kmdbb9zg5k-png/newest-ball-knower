import assert from 'node:assert/strict';
import fs from 'node:fs';

const defaults=fs.readFileSync('migrations/20260903_build7_waiver_defaults.sql','utf8');
const hardening=fs.readFileSync('migrations/20260903_build7_waiver_deadline_hardening.sql','utf8');
const phase1=fs.readFileSync('migrations/20260830_zz_phase1_fantasy_transaction_correctness.sql','utf8');
const kickoffLock=fs.readFileSync('migrations/20260911164240_lock_started_free_agents.sql','utf8');

for(const required of [
  "'waiverType','priority'",
  "'freeAgentMode','instant'",
  "'waiverDays',2",
  "'waiverProcessHourUtc',9",
  "'waiverRunDays',jsonb_build_array(0,1,2,3,4,5,6)",
])assert.match(defaults,new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
assert.match(defaults,/\|\|coalesce\(new\.settings/,'custom commissioner settings must override defaults');
assert.match(defaults,/before insert on public\.ball_knower_leagues/,'future leagues must persist defaults');
assert.match(defaults,/update public\.ball_knower_leagues/,'existing fallback-only leagues must be normalized without deleting custom keys');

assert.match(hardening,/normalize_ball_knower_player_waiver_deadline/,'dropped players must be held through the actual processing deadline');
assert.match(hardening,/new\.clears_at:=public\.next_ball_knower_waiver_run/);
assert.match(hardening,/wc\.status='pending'/,'pending claims must block instant adds even after a raw duration timestamp');
assert.match(hardening,/Free agent added instantly after waivers cleared\./);
assert.match(hardening,/clearedUnclaimed/,'unclaimed due waiver players must be released to free agency');
assert.match(hardening,/waiverType','priority/,'priority remains the standard default behavior');
assert.match(hardening,/coalesce\(v_settings->>'waiverType','priority'\)='faab'/,'FAAB bids must be validated against the member budget');
assert.match(hardening,/case when v_type='faab' then wc\.faab_bid end desc/,'FAAB claims must resolve by highest bid');
assert.match(hardening,/case when v_type='faab' then c\.faab_bid else 0 end/,'FAAB winner must be charged the winning bid');
assert.match(hardening,/waiver_priority/,'rolling priority must still move winners to the back');
assert.match(hardening,/failure_reason='Another manager won this player'/,'losing duplicate claims must be resolved explicitly');

assert.match(phase1,/pg_advisory_xact_lock/,'acquisition execution must retain a database transaction lock');
assert.match(phase1,/Player is no longer available/,'acquisition execution must recheck ownership under lock');

assert.match(kickoffLock,/g\.kickoff_at<=now\(\) or g\.is_live or g\.is_final/,'current-week kickoff must close immediate free agency authoritatively');
assert.match(kickoffLock,/v_active_waiver:=v_active_waiver or v_game_locked/,'started free agents must route through waivers');
assert.match(kickoffLock,/That player has already played\. Waiver claim scheduled\./,'the client must receive an honest started-player result');
assert.doesNotMatch(kickoffLock,/grant execute[\s\S]*service_role/,'the user-facing submission RPC must not be granted to service_role');

console.log('Build 7 waiver defaults and transaction regression gate passed.');
