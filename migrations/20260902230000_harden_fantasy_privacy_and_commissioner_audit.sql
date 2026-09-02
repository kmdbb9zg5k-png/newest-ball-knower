-- Phase A anti-cheat hardening.
--
-- Private league data had RLS policies that correctly denied the anon role,
-- but several tables still retained broad legacy table grants. Remove that
-- unnecessary first hop so a future policy mistake cannot expose league data.
-- Public rankings and the privacy-safe aggregate visit endpoint intentionally
-- keep their separate anonymous contracts.

revoke all on table public.ball_knower_injuries from anon;
revoke all on table public.ball_knower_league_events from anon;
revoke all on table public.ball_knower_league_messages from anon;
revoke all on table public.ball_knower_notifications from anon;
revoke all on table public.ball_knower_roster_revisions from anon;
revoke all on table public.ball_knower_season_archive from anon;
revoke all on table public.ball_knower_trades from anon;
revoke all on table public.ball_knower_weekly_lineups from anon;
revoke all on table public.ball_knower_weekly_scores from anon;

-- Preserve the already-reviewed implementations as private, non-callable
-- bases. Public wrappers add a durable league-visible audit entry only after
-- the underlying commissioner action succeeds in the same transaction.

alter function public.commissioner_set_ball_knower_waiver_priority(text,text,integer)
  set schema ball_knower_private;
alter function ball_knower_private.commissioner_set_ball_knower_waiver_priority(text,text,integer)
  rename to commissioner_set_ball_knower_waiver_priority_20260830_base;

revoke all on function ball_knower_private.commissioner_set_ball_knower_waiver_priority_20260830_base(text,text,integer)
  from public, anon, authenticated, service_role;

create function public.commissioner_set_ball_knower_waiver_priority(
  p_league_id text,
  p_member_id text,
  p_priority integer
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_priority integer;
  v_new_priority integer;
  v_member_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_ball_knower_commissioner(p_league_id) then
    raise exception 'Commissioner only';
  end if;

  select member.waiver_priority, member.user_name
    into v_old_priority, v_member_name
    from public.ball_knower_league_members member
   where member.league_id = p_league_id
     and member.id = p_member_id;

  perform ball_knower_private.commissioner_set_ball_knower_waiver_priority_20260830_base(
    p_league_id,
    p_member_id,
    p_priority
  );

  select member.waiver_priority
    into v_new_priority
    from public.ball_knower_league_members member
   where member.league_id = p_league_id
     and member.id = p_member_id;

  insert into public.ball_knower_league_events(
    league_id, actor_auth_id, actor_name, event_type, message, metadata
  )
  select p_league_id,
         auth.uid(),
         league.commissioner_name,
         'commissioner_waiver_priority_changed',
         'Commissioner changed ' || coalesce(v_member_name, 'a team') ||
           '''s waiver priority from ' || coalesce(v_old_priority::text, '?') ||
           ' to ' || coalesce(v_new_priority::text, '?') || '.',
         jsonb_build_object(
           'memberId', p_member_id,
           'oldPriority', v_old_priority,
           'newPriority', v_new_priority
         )
    from public.ball_knower_leagues league
   where league.id = p_league_id;
end;
$function$;

revoke all on function public.commissioner_set_ball_knower_waiver_priority(text,text,integer)
  from public, anon;
grant execute on function public.commissioner_set_ball_knower_waiver_priority(text,text,integer)
  to authenticated;

alter function public.commissioner_edit_ball_knower_matchup(text,integer,text,text,text)
  set schema ball_knower_private;
alter function ball_knower_private.commissioner_edit_ball_knower_matchup(text,integer,text,text,text)
  rename to commissioner_edit_ball_knower_matchup_20260830_base;

revoke all on function ball_knower_private.commissioner_edit_ball_knower_matchup_20260830_base(text,integer,text,text,text)
  from public, anon, authenticated, service_role;

create function public.commissioner_edit_ball_knower_matchup(
  p_league_id text,
  p_week integer,
  p_game_id text,
  p_home_member_id text,
  p_away_member_id text
) returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_old_home text;
  v_old_away text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_ball_knower_commissioner(p_league_id) then
    raise exception 'Commissioner only';
  end if;

  select game ->> 'homeMemberId', game ->> 'awayMemberId'
    into v_old_home, v_old_away
    from public.ball_knower_leagues league
    cross join lateral jsonb_array_elements(
      coalesce(league.season_result -> 'games', '[]'::jsonb)
    ) game
   where league.id = p_league_id
     and game ->> 'id' = p_game_id
     and coalesce((game ->> 'week')::integer, 0) = p_week
     and not (game ? 'playoffRound');

  perform ball_knower_private.commissioner_edit_ball_knower_matchup_20260830_base(
    p_league_id,
    p_week,
    p_game_id,
    p_home_member_id,
    p_away_member_id
  );

  insert into public.ball_knower_league_events(
    league_id, actor_auth_id, actor_name, event_type, message, metadata
  )
  select p_league_id,
         auth.uid(),
         league.commissioner_name,
         'commissioner_matchup_changed',
         'Commissioner changed the Week ' || p_week || ' matchup assignment.',
         jsonb_build_object(
           'week', p_week,
           'gameId', p_game_id,
           'oldHomeMemberId', v_old_home,
           'oldAwayMemberId', v_old_away,
           'newHomeMemberId', p_home_member_id,
           'newAwayMemberId', p_away_member_id
         )
    from public.ball_knower_leagues league
   where league.id = p_league_id;
end;
$function$;

revoke all on function public.commissioner_edit_ball_knower_matchup(text,integer,text,text,text)
  from public, anon;
grant execute on function public.commissioner_edit_ball_knower_matchup(text,integer,text,text,text)
  to authenticated;

alter function public.commissioner_import_ball_knower_offline_draft(text,jsonb)
  set schema ball_knower_private;
alter function ball_knower_private.commissioner_import_ball_knower_offline_draft(text,jsonb)
  rename to commissioner_import_ball_knower_offline_draft_20260830_base;

revoke all on function ball_knower_private.commissioner_import_ball_knower_offline_draft_20260830_base(text,jsonb)
  from public, anon, authenticated, service_role;

create function public.commissioner_import_ball_knower_offline_draft(
  p_league_id text,
  p_picks jsonb
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_result boolean;
  v_pick_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_ball_knower_commissioner(p_league_id) then
    raise exception 'Commissioner only';
  end if;

  v_result := ball_knower_private.commissioner_import_ball_knower_offline_draft_20260830_base(
    p_league_id,
    p_picks
  );
  v_pick_count := jsonb_array_length(p_picks);

  insert into public.ball_knower_league_events(
    league_id, actor_auth_id, actor_name, event_type, message, metadata
  )
  select p_league_id,
         auth.uid(),
         league.commissioner_name,
         'commissioner_offline_draft_imported',
         'Commissioner imported ' || v_pick_count || ' offline draft picks.',
         jsonb_build_object('pickCount', v_pick_count)
    from public.ball_knower_leagues league
   where league.id = p_league_id;

  return v_result;
end;
$function$;

revoke all on function public.commissioner_import_ball_knower_offline_draft(text,jsonb)
  from public, anon;
grant execute on function public.commissioner_import_ball_knower_offline_draft(text,jsonb)
  to authenticated;

-- Trade approvals and vetoes occur inside the atomic resolver. An AFTER trigger
-- records only commissioner review transitions; league-vote resolution is
-- intentionally excluded so it is not mislabeled as a unilateral override.

create or replace function ball_knower_private.audit_commissioner_trade_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_event_type text;
  v_message text;
begin
  if auth.uid() is null
     or coalesce(current_setting('ball_knower.authorized_trade_vote', true), '') = 'approved'
     or not public.is_ball_knower_commissioner(new.league_id)
  then
    return new;
  end if;

  if old.status = 'accepted_pending_review' and new.status = 'accepted' then
    v_event_type := 'commissioner_trade_approved';
    v_message := 'Commissioner approved a pending trade.';
  elsif old.status in ('pending', 'accepted_pending_review') and new.status = 'vetoed' then
    v_event_type := 'commissioner_trade_vetoed';
    v_message := 'Commissioner vetoed a trade.';
  else
    return new;
  end if;

  insert into public.ball_knower_league_events(
    league_id, actor_auth_id, actor_name, event_type, message, metadata
  )
  select new.league_id,
         auth.uid(),
         league.commissioner_name,
         v_event_type,
         v_message,
         jsonb_build_object(
           'tradeId', new.id,
           'previousStatus', old.status,
           'newStatus', new.status
         )
    from public.ball_knower_leagues league
   where league.id = new.league_id;

  return new;
end;
$function$;

revoke all on function ball_knower_private.audit_commissioner_trade_review()
  from public, anon, authenticated, service_role;

drop trigger if exists ball_knower_audit_commissioner_trade_review
  on public.ball_knower_trades;
create trigger ball_knower_audit_commissioner_trade_review
after update of status on public.ball_knower_trades
for each row
execute function ball_knower_private.audit_commissioner_trade_review();

comment on function public.commissioner_set_ball_knower_waiver_priority(text,text,integer) is
  'Commissioner-only waiver priority override with a durable league-visible audit event.';
comment on function public.commissioner_edit_ball_knower_matchup(text,integer,text,text,text) is
  'Commissioner-only pre-kickoff matchup edit with a durable league-visible audit event.';
comment on function public.commissioner_import_ball_knower_offline_draft(text,jsonb) is
  'Commissioner-only offline draft import with a durable league-visible audit event.';

-- Recovery plan: drop the three public wrappers and the trade audit trigger,
-- move each dated private base back to public under its original name, then
-- re-grant only authenticated execution. The anon table revokes are additive
-- hardening and should not be restored unless a deliberately scoped public
-- data contract is introduced.
