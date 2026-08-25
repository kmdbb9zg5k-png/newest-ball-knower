-- Targeted production hardening for active Ball Knower tables.
-- Keep authorization semantics unchanged while avoiding per-row auth.uid() work
-- and overlapping SELECT policies, and add covering indexes for hot foreign keys.

-- Owner profile: evaluate auth.uid() once per statement plan.
drop policy if exists bk_profiles_update_own on public.ball_knower_owner_profiles;
create policy bk_profiles_update_own on public.ball_knower_owner_profiles
for update to public
using ((select auth.uid()) = auth_user_id)
with check ((select auth.uid()) = auth_user_id);

-- Commissioner rollups: same authorization, init-plan friendly auth lookup.
drop policy if exists bk_rollups_commish_read on public.ball_knower_owner_rollups;
create policy bk_rollups_commish_read on public.ball_knower_owner_rollups
for select to public
using (exists (
  select 1 from public.ball_knower_leagues l
  where l.id = ball_knower_owner_rollups.league_id
    and l.commissioner_auth_id = (select auth.uid())
));

-- Weekly lineups: one read policy for league members, owner-only write policies.
drop policy if exists "league members read lineups" on public.ball_knower_weekly_lineups;
drop policy if exists "owners manage own lineups" on public.ball_knower_weekly_lineups;
create policy "league members read lineups" on public.ball_knower_weekly_lineups
for select to authenticated
using (exists (
  select 1 from public.ball_knower_league_members m
  where m.league_id = ball_knower_weekly_lineups.league_id
    and m.auth_user_id = (select auth.uid())
));
create policy "owners insert own lineups" on public.ball_knower_weekly_lineups
for insert to authenticated
with check (exists (
  select 1 from public.ball_knower_league_members m
  where m.league_id = ball_knower_weekly_lineups.league_id
    and m.id = ball_knower_weekly_lineups.member_id
    and m.auth_user_id = (select auth.uid())
));
create policy "owners update own lineups" on public.ball_knower_weekly_lineups
for update to authenticated
using (exists (
  select 1 from public.ball_knower_league_members m
  where m.league_id = ball_knower_weekly_lineups.league_id
    and m.id = ball_knower_weekly_lineups.member_id
    and m.auth_user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.ball_knower_league_members m
  where m.league_id = ball_knower_weekly_lineups.league_id
    and m.id = ball_knower_weekly_lineups.member_id
    and m.auth_user_id = (select auth.uid())
));
create policy "owners delete own lineups" on public.ball_knower_weekly_lineups
for delete to authenticated
using (exists (
  select 1 from public.ball_knower_league_members m
  where m.league_id = ball_knower_weekly_lineups.league_id
    and m.id = ball_knower_weekly_lineups.member_id
    and m.auth_user_id = (select auth.uid())
));

-- Weekly scores: evaluate auth identity once.
drop policy if exists "league members read weekly scores" on public.ball_knower_weekly_scores;
create policy "league members read weekly scores" on public.ball_knower_weekly_scores
for select to authenticated
using (exists (
  select 1 from public.ball_knower_league_members m
  where m.league_id = ball_knower_weekly_scores.league_id
    and m.auth_user_id = (select auth.uid())
));

-- Injuries: commissioner writes should not also create a second permissive SELECT policy.
drop policy if exists bk_injuries_commish_write on public.ball_knower_injuries;
create policy bk_injuries_commish_insert on public.ball_knower_injuries
for insert to authenticated
with check (public.is_ball_knower_commissioner(league_id));
create policy bk_injuries_commish_update on public.ball_knower_injuries
for update to authenticated
using (public.is_ball_knower_commissioner(league_id))
with check (public.is_ball_knower_commissioner(league_id));
create policy bk_injuries_commish_delete on public.ball_knower_injuries
for delete to authenticated
using (public.is_ball_knower_commissioner(league_id));

-- Cover active foreign keys used by deletes/joins and the new anti-repeat trivia path.
create index if not exists trivia_attempts_question_idx
  on ball_knower_private.trivia_attempts(question_id);
create index if not exists ball_knower_entitlements_sku_idx
  on public.ball_knower_entitlements(sku);
create index if not exists ball_knower_league_messages_reply_to_idx
  on public.ball_knower_league_messages(reply_to);
create index if not exists ball_knower_notifications_league_idx
  on public.ball_knower_notifications(league_id);
create index if not exists ball_knower_roster_revisions_member_idx
  on public.ball_knower_roster_revisions(member_id);
create index if not exists ball_knower_trades_parent_idx
  on public.ball_knower_trades(parent_trade_id);
create index if not exists ball_knower_user_achievements_key_idx
  on public.ball_knower_user_achievements(achievement_key);
create index if not exists ball_knower_weekly_lineups_member_idx
  on public.ball_knower_weekly_lineups(member_id);
create index if not exists ball_knower_weekly_scores_member_idx
  on public.ball_knower_weekly_scores(member_id);
