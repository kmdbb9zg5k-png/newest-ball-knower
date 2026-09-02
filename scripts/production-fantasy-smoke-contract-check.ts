import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sql=readFileSync(new URL('./supabase-production-fantasy-smoke.sql',import.meta.url),'utf8');

for(const operation of [
  'start_ball_knower_live_draft',
  'resume_ball_knower_live_draft_recovery',
  'process_due_ball_knower_draft_picks',
  'save_my_ball_knower_weekly_lineup',
  'generate_ball_knower_weekly_injuries',
  'propose_ball_knower_trade_v2',
  'resolve_ball_knower_trade_v2',
  'save_my_ball_knower_notification_preference',
  'mark_ball_knower_notification_read',
  'notify_ball_knower_league_members',
  'mark_all_ball_knower_notifications_read',
  'commissioner_set_ball_knower_waiver_priority',
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
assert.match(sql,/draft\.recovery_enabled\s*=\s*true/,'Production smoke must assert safe draft recovery');
assert.ok(sql.includes('jsonb_array_length(v_regular_games) <> 75'),'Production smoke must assert all 75 regular-season matchups');
assert.ok(sql.includes('v_final_notifications <> 1'),'Production smoke must detect duplicate final notifications');
assert.ok(sql.includes("event.event_type='commissioner_waiver_priority_changed'"),'Production smoke must assert commissioner waiver audit history');
assert.ok(sql.includes("event.event_type='commissioner_trade_approved'"),'Production smoke must assert commissioner trade-review audit history');
assert.ok(sql.includes("has_table_privilege('anon'"),'Production smoke must verify anonymous league-data grants stay revoked');
assert.ok(sql.includes("notification.category = 'transactions'")&&sql.includes("notification.category = 'league'")&&sql.includes('not notification.in_app_visible')&&sql.includes('notification.push_eligible'),'Production smoke must prove category mapping and independent delivery flags');
assert.ok(sql.includes('Notification preference writes were not isolated to the authenticated owner'),'Production smoke must verify notification preference owner isolation');
assert.ok(sql.includes('Owner-scoped single notification receipt failed'),'Production smoke must verify one-row owner read receipts');

console.log('Production fantasy smoke contract covers draft, schedule, lineup, injuries, trade, waivers, notifications, scoring, playoffs, archive, reset, and rollback.');
