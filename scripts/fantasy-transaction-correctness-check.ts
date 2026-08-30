import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const migration = readFileSync(new URL('../migrations/20260830_zz_phase1_fantasy_transaction_correctness.sql', import.meta.url), 'utf8');
const required = [
  'ball_knower_started_starter',
  "raise exception 'A started player locked in this week''s lineup cannot be dropped'",
  "raise exception 'A started player locked in this week''s lineup cannot be traded'",
  "'acquisitionWeek',v_week,'acquisitionSeason',v_season",
  "created_at>=v_reset_at",
  "raise exception 'Weekly acquisition limit reached'",
  "raise exception 'Season acquisition limit reached'",
  "raise exception 'The fantasy trade deadline has passed'",
  "raise exception 'The fantasy trade deadline has passed; pending trades cannot complete'",
  "jsonb_array_length(v_new_roster)-jsonb_array_length(v_ir)",
  "where exists(select 1 from jsonb_array_elements(coalesce(m.roster,'[]'::jsonb))p where p->>'id'=ir_id.value)",
  "not exists(select 1 from public.ball_knower_waiver_claims earlier",
  "order by case when v_type='faab' then wc.faab_bid end desc,m.waiver_priority",
  "v_roster_limit:=public.ball_knower_fantasy_roster_size(p_league_id)",
  "v_limit:=public.ball_knower_fantasy_roster_size(p_league_id)",
  "from public,anon,authenticated,service_role",
  "grant execute on function public.apply_ball_knower_player_move(text,text,jsonb,text,numeric,text,uuid) to service_role",
  "dropped as a trade cut",
  "select count(*) into v_lost from public.ball_knower_waiver_claims where processed_at=p_now and status='lost'",
  'when serialization_failure or deadlock_detected or query_canceled or admin_shutdown then raise',
  'patch prerequisites did not match',
  "offered_id",
  "requested_id",
  "candidate.player->>''id''",
  "coalesce(t.recipient_drop_player_ids",
];
for (const marker of required) assert.ok(migration.includes(marker), `Missing Phase 1 transaction guarantee: ${marker}`);
assert.ok(!migration.includes('Move would exceed the salary cap'), 'Normal fantasy moves must not enforce NFL salary values.');
assert.ok(migration.indexOf('not exists(select 1 from public.ball_knower_waiver_claims earlier') < migration.indexOf("order by case when v_type='faab'"), 'Conditional heads must be activated before league-wide FAAB/priority ordering.');

const migrationNames = readdirSync(new URL('../migrations/', import.meta.url)).filter(name => name.endsWith('.sql')).sort();
const parityIndex = migrationNames.indexOf('20260830_yahoo_fantasy_parity_upgrade.sql');
const phase1Index = migrationNames.indexOf('20260830_zz_phase1_fantasy_transaction_correctness.sql');
assert.ok(parityIndex >= 0, 'Yahoo parity migration marker must exist.');
assert.ok(phase1Index >= 0, 'Phase 1 transaction migration marker must exist.');
assert.ok(parityIndex < phase1Index, 'Phase 1 overrides must run after Yahoo parity function patches.');

console.log('Fantasy transaction correctness checks passed: limits, IR capacity/cleanup, deadlines, started-player protection, waiver competition, grants, and migration order.');
