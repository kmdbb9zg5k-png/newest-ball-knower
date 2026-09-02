import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(
  new URL('../migrations/20260902230000_harden_fantasy_privacy_and_commissioner_audit.sql',import.meta.url),
  'utf8',
);

for(const table of [
  'ball_knower_injuries',
  'ball_knower_league_events',
  'ball_knower_league_messages',
  'ball_knower_notifications',
  'ball_knower_roster_revisions',
  'ball_knower_season_archive',
  'ball_knower_trades',
  'ball_knower_weekly_lineups',
  'ball_knower_weekly_scores',
]) {
  assert.ok(
    migration.includes(`revoke all on table public.${table} from anon;`),
    `${table} must not retain anonymous table privileges`,
  );
}

for(const base of [
  'commissioner_set_ball_knower_waiver_priority_20260830_base',
  'commissioner_edit_ball_knower_matchup_20260830_base',
  'commissioner_import_ball_knower_offline_draft_20260830_base',
]) {
  assert.ok(
    migration.includes(`revoke all on function ball_knower_private.${base}`),
    `${base} must not be client-callable`,
  );
}

for(const eventType of [
  'commissioner_waiver_priority_changed',
  'commissioner_matchup_changed',
  'commissioner_offline_draft_imported',
  'commissioner_trade_approved',
  'commissioner_trade_vetoed',
]) {
  assert.ok(migration.includes(`'${eventType}'`),`${eventType} must leave an audit entry`);
}

assert.ok(
  migration.includes("current_setting('ball_knower.authorized_trade_vote', true)")&&
  migration.includes("= 'approved'"),
  'League-vote trade resolutions must not be mislabeled as commissioner overrides',
);
assert.match(migration,/after update of status on public\.ball_knower_trades/i);
assert.ok(migration.includes("if auth.uid() is null then raise exception 'Authentication required'; end if;"));
assert.ok(migration.includes('Recovery plan:'),'Database hardening must document its recovery plan');

console.log('Fantasy security contract removes anon league-data grants and audits commissioner overrides.');
