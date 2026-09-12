-- Supabase anonymous sessions use the authenticated Postgres role. Require an
-- upgraded auth identity explicitly on every BK Arena realtime/read policy.
create function ball_knower_private.is_permanent_community_user()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users u where u.id=(select auth.uid()) and not coalesce(u.is_anonymous,false))
$$;
revoke all on function ball_knower_private.is_permanent_community_user() from public,anon,authenticated;

drop policy if exists bk_friendships_participant_read on public.ball_knower_friendships;
create policy bk_friendships_participant_read on public.ball_knower_friendships for select to authenticated
  using(ball_knower_private.is_permanent_community_user() and (select auth.uid()) in(requester_id,recipient_id));

drop policy if exists bk_community_messages_read on public.ball_knower_community_messages;
create policy bk_community_messages_read on public.ball_knower_community_messages for select to authenticated using(
  ball_knower_private.is_permanent_community_user() and removed_at is null and public.ball_knower_can_see_sender(author_id)
  and (kind='global' or (select auth.uid()) in(author_id,recipient_id))
);

drop policy if exists bk_community_reports_owner_read on public.ball_knower_community_reports;
create policy bk_community_reports_owner_read on public.ball_knower_community_reports for select to authenticated
  using(ball_knower_private.is_permanent_community_user() and reporter_id=(select auth.uid()));

drop policy if exists bk_h2h_participant_read on public.ball_knower_h2h_matches;
create policy bk_h2h_participant_read on public.ball_knower_h2h_matches for select to authenticated
  using(ball_knower_private.is_permanent_community_user() and (select auth.uid()) in(challenger_id,opponent_id));
