import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('./supabase-production-fantasy-smoke.sql',import.meta.url),'utf8');

for(const operation of [
  'start_ball_knower_live_draft',
  'process_due_ball_knower_draft_picks',
  'save_my_ball_knower_weekly_lineup',
  'generate_ball_knower_weekly_injuries',
  'propose_ball_knower_trade_v2',
  'resolve_ball_knower_trade_v2',
  'submit_ball_knower_player_move',
  'process_due_ball_knower_waivers',
  'finalize_ball_knower_fantasy_season',
  'ball_knower_season_archive',
  'reset_ball_knower_league_for_next_season',
]) assert.ok(sql.includes(operation),`Production smoke must exercise ${operation}`);

assert.match(sql,/\bbegin\s*;/i,'Production smoke must open a transaction');
assert.match(sql,/\brollback\s*;/i,'Production smoke must always roll fixtures back');
assert.ok(sql.includes("draft.pick_index = 150"),'Production smoke must complete a 150-pick draft');
assert.ok(sql.includes("pick->>'source' = 'autopick'"),'Production smoke must assert human autopicks');
assert.ok(sql.includes("pick->>'source' = 'cpu'"),'Production smoke must assert CPU picks');
assert.ok(sql.includes('jsonb_array_length(v_regular_games) <> 75'),'Production smoke must assert all 75 regular-season matchups');
assert.ok(sql.includes('v_final_notifications <> 1'),'Production smoke must detect duplicate final notifications');

console.log('Production fantasy smoke contract covers draft, schedule, lineup, injuries, trade, waivers, scoring, playoffs, archive, reset, and rollback.');
