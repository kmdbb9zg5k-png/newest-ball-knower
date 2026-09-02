-- Give authenticated league members a safe, auditable recovery path for an
-- active draft whose automatic recovery was quarantined by an older migration.
-- The RPC validates the persisted pick ledger before re-enabling the clock, so
-- a genuinely corrupted room is never advanced blindly.

create or replace function public.resume_ball_knower_live_draft_recovery(
  p_league_id text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_auth uuid := (select auth.uid());
  v_actor_name text;
  v_draft public.ball_knower_live_drafts%rowtype;
  v_team_count integer;
  v_total_picks integer;
  v_now timestamptz := clock_timestamp();
begin
  if v_auth is null then
    raise exception 'Authentication required';
  end if;

  select member.user_name
  into v_actor_name
  from public.ball_knower_league_members member
  where member.league_id=p_league_id
    and member.auth_user_id=v_auth
  limit 1;
  if not found then
    raise exception 'League membership required';
  end if;

  -- Draft mutations lock this row first. Match that ordering so a reconnect,
  -- manual pick, and timeout pick cannot race one another.
  select *
  into v_draft
  from public.ball_knower_live_drafts draft
  where draft.league_id=p_league_id
  for update;
  if not found then
    raise exception 'Fantasy draft has not started';
  end if;
  if v_draft.status='completed' then
    return to_jsonb(v_draft);
  end if;
  if v_draft.status<>'active' then
    raise exception 'Fantasy draft is not active';
  end if;
  if v_draft.recovery_enabled then
    return to_jsonb(v_draft);
  end if;

  if jsonb_typeof(v_draft.order_member_ids)<>'array'
     or jsonb_typeof(v_draft.picks)<>'array'
  then
    raise exception 'Draft recovery stopped: the persisted draft ledger is malformed';
  end if;
  v_team_count:=jsonb_array_length(v_draft.order_member_ids);
  v_total_picks:=v_team_count*v_draft.rounds;
  if v_team_count not between 6 and 16
     or v_draft.rounds not between 15 and 20
     or v_draft.pick_index<0
     or v_draft.pick_index>v_total_picks
     or jsonb_array_length(v_draft.picks)<>v_draft.pick_index
  then
    raise exception 'Draft recovery stopped: pick totals do not match the saved room';
  end if;
  if (
    select count(distinct member_id)
    from jsonb_array_elements_text(v_draft.order_member_ids) member_id
  )<>v_team_count
     or (
       select count(*)
       from public.ball_knower_league_members member
       where member.league_id=p_league_id
         and member.id in(
           select member_id
           from jsonb_array_elements_text(v_draft.order_member_ids) member_id
         )
     )<>v_team_count
  then
    raise exception 'Draft recovery stopped: the saved draft order no longer matches league membership';
  end if;
  if (
    select count(distinct pick->>'playerId')
    from jsonb_array_elements(v_draft.picks) pick
  )<>v_draft.pick_index
  then
    raise exception 'Draft recovery stopped: the saved room contains duplicate players';
  end if;
  if exists(
    select 1
    from jsonb_array_elements(v_draft.picks) with ordinality saved(pick,ordinality)
    where coalesce(saved.pick->>'playerId','')=''
       or not exists(
         select 1
         from public.ball_knower_fantasy_player_groups player
         where player.player_id=saved.pick->>'playerId'
       )
       or saved.pick->>'memberId' is distinct from (
         v_draft.order_member_ids->>((
           case
             when ((saved.ordinality-1)/v_team_count)%2=0
               then (saved.ordinality-1)%v_team_count
             else v_team_count-1-((saved.ordinality-1)%v_team_count)
           end
         )::integer)
       )
  ) then
    raise exception 'Draft recovery stopped: the saved pick ledger failed ownership validation';
  end if;

  if v_draft.pick_index=v_total_picks then
    update public.ball_knower_live_drafts
    set status='completed',
        completed_at=coalesce(completed_at,v_now),
        recovery_enabled=true,
        updated_at=v_now
    where league_id=p_league_id
    returning * into v_draft;
    perform ball_knower_private.finalize_completed_live_draft(p_league_id);
  else
    update public.ball_knower_live_drafts
    set recovery_enabled=true,
        pick_started_at=v_now,
        pick_deadline_at=v_now+make_interval(secs=>pick_seconds),
        updated_at=v_now
    where league_id=p_league_id
    returning * into v_draft;
  end if;

  insert into public.ball_knower_league_events(
    league_id,actor_auth_id,actor_name,event_type,message,metadata
  ) values (
    p_league_id,v_auth,coalesce(v_actor_name,'League member'),
    'draft_recovery_resumed',
    coalesce(v_actor_name,'A league member')||' safely resumed the fantasy draft clock.',
    jsonb_build_object('pickIndex',v_draft.pick_index,'status',v_draft.status)
  );

  return to_jsonb(v_draft);
end;
$function$;

revoke all on function public.resume_ball_knower_live_draft_recovery(text)
from public,anon;
grant execute on function public.resume_ball_knower_live_draft_recovery(text)
to authenticated,service_role;

comment on function public.resume_ball_knower_live_draft_recovery(text) is
  'Validates and resumes a quarantined active fantasy draft. Idempotent once recovery is enabled.';
