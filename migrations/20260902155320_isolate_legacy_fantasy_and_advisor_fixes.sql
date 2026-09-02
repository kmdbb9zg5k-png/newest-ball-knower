-- The application is authoritative on ball_knower_* tables. Preserve the
-- three legacy fantasy fixtures for forensic/rollback use, but make the old
-- engine service-only so new clients cannot accidentally revive it.

do $legacy_tables$
declare
  table_name text;
  policy_name text;
begin
  foreach table_name in array array[
    'fantasy_activity',
    'fantasy_draft_picks',
    'fantasy_drafts',
    'fantasy_feed_posts',
    'fantasy_leagues',
    'fantasy_lineups',
    'fantasy_matchups',
    'fantasy_members',
    'fantasy_notifications',
    'fantasy_receipts',
    'fantasy_rosters',
    'fantasy_scoring_rules',
    'fantasy_season_history',
    'fantasy_transactions',
    'fantasy_weekly_reports'
  ] loop
    if to_regclass('public.' || table_name) is null then
      continue;
    end if;

    execute format(
      'revoke all on table public.%I from public, anon, authenticated',
      table_name
    );
    execute format(
      'grant all on table public.%I to service_role',
      table_name
    );
    execute format(
      'comment on table public.%I is %L',
      table_name,
      'LEGACY FANTASY ENGINE: retained data is service-only. New product code must use public.ball_knower_*.'
    );

    for policy_name in
      select policy.polname
      from pg_catalog.pg_policy policy
      where policy.polrelid = to_regclass('public.' || table_name)
    loop
      execute format('drop policy %I on public.%I', policy_name, table_name);
    end loop;
  end loop;
end;
$legacy_tables$;

revoke all on function public.join_fantasy_league_by_code(text, text)
  from public, anon, authenticated;
revoke all on function public.can_access_fantasy_league(uuid)
  from public, anon, authenticated;
revoke all on function public.is_fantasy_commissioner(uuid)
  from public, anon, authenticated;

comment on function public.join_fantasy_league_by_code(text, text) is
  'LEGACY FANTASY ENGINE: disabled for clients; use join_ball_knower_league.';

-- Resolve the only current auth-initplan advisor warning without changing
-- waiver visibility semantics.
drop policy if exists bk_waivers_owner_read
  on public.ball_knower_waiver_claims;
create policy bk_waivers_owner_read
on public.ball_knower_waiver_claims
for select
to authenticated
using (
  exists (
    select 1
    from public.ball_knower_league_members member
    where member.id = ball_knower_waiver_claims.member_id
      and member.auth_user_id = (select auth.uid())
  )
  or public.is_ball_knower_commissioner(league_id)
);

-- Cover active foreign-key access paths reported by the production advisor.
create index if not exists fantasy_acquisition_counters_member_idx
  on ball_knower_private.fantasy_acquisition_counters(member_id);
create index if not exists ball_knower_dm_messages_sender_idx
  on public.ball_knower_dm_messages(sender_auth_id);
create index if not exists ball_knower_draft_preferences_member_idx
  on public.ball_knower_draft_preferences(member_id);
create index if not exists ball_knower_player_waivers_dropped_by_idx
  on public.ball_knower_player_waivers(dropped_by_member_id);
create index if not exists ball_knower_trade_messages_sender_idx
  on public.ball_knower_trade_messages(sender_auth_id);
create index if not exists ball_knower_trade_thread_reads_auth_idx
  on public.ball_knower_trade_thread_reads(auth_user_id);
create index if not exists ball_knower_trading_block_member_idx
  on public.ball_knower_trading_block(member_id);
create index if not exists ball_knower_watched_players_auth_idx
  on public.ball_knower_watched_players(auth_user_id);
