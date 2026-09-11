-- A free agent whose current-week game has kicked off cannot be added
-- immediately. The move becomes a normal waiver claim and competes at the
-- league's next configured processing run.

create or replace function public.submit_ball_knower_player_move(
  p_league_id text,p_player_snapshot jsonb,p_drop_player_id text default null,p_faab_bid numeric default 0,p_claim_order integer default 1,p_claim_group_id uuid default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_auth uuid:=auth.uid();
  v_member public.ball_knower_league_members%rowtype;
  v_settings jsonb;
  v_player_id text;
  v_team text;
  v_week integer;
  v_season integer;
  v_game_locked boolean:=false;
  v_active_waiver boolean;
  v_continuous boolean;
  v_claim_id uuid;
  v_process_at timestamptz;
  v_clears_at timestamptz;
  v_bid numeric:=round(greatest(0,coalesce(p_faab_bid,0)),2);
  v_group uuid:=coalesce(p_claim_group_id,gen_random_uuid());
  v_result jsonb;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  v_player_id:=p_player_snapshot->>'id';
  v_team:=case upper(coalesce(p_player_snapshot->>'team','')) when 'JAC' then 'JAX' when 'LA' then 'LAR' when 'WSH' then 'WAS' else upper(coalesce(p_player_snapshot->>'team','')) end;
  if v_player_id is null or v_player_id='' then raise exception 'Player data is missing'; end if;

  perform pg_advisory_xact_lock(hashtext('bk-acquire-'||p_league_id||'-'||v_player_id));
  select * into v_member from public.ball_knower_league_members where league_id=p_league_id and auth_user_id=v_auth limit 1 for update;
  if not found then raise exception 'League membership not found'; end if;
  select settings into v_settings from public.ball_knower_leagues where id=p_league_id;
  if not found then raise exception 'League not found'; end if;

  if exists(
    select 1 from public.ball_knower_league_members m,
    jsonb_array_elements(coalesce(m.roster,'[]'::jsonb))e
    where m.league_id=p_league_id and e->>'id'=v_player_id
  ) then raise exception 'Player is no longer available'; end if;

  v_week:=greatest(1,coalesce(nullif(v_settings->>'currentWeek','')::integer,1));
  v_season:=coalesce(nullif(v_settings->>'nflSeason','')::integer,extract(year from now())::integer);
  if v_team<>'' then
    select exists(
      select 1
      from public.ball_knower_nfl_games g
      where g.season=v_season
        and g.season_type='reg'
        and g.week_number=v_week
        and (case upper(g.home_team) when 'JAC' then 'JAX' when 'LA' then 'LAR' when 'WSH' then 'WAS' else upper(g.home_team) end=v_team
          or case upper(g.away_team) when 'JAC' then 'JAX' when 'LA' then 'LAR' when 'WSH' then 'WAS' else upper(g.away_team) end=v_team)
        and (g.kickoff_at<=now() or g.is_live or g.is_final)
    ) into v_game_locked;
  end if;

  select w.clears_at into v_clears_at
  from public.ball_knower_player_waivers w
  where w.league_id=p_league_id and w.player_id=v_player_id
  for update;
  v_active_waiver:=found;

  if not v_active_waiver and exists(
    select 1 from public.ball_knower_waiver_claims wc
    where wc.league_id=p_league_id and wc.player_id=v_player_id and wc.status='pending'
  ) then
    v_active_waiver:=true;
  end if;

  -- Kickoff is authoritative even when the browser has stale game state. A
  -- started or final player can be claimed, but never granted immediately.
  v_active_waiver:=v_active_waiver or v_game_locked;
  v_continuous:=coalesce(v_settings->>'freeAgentMode','instant')='continuous';
  if not v_active_waiver and not v_continuous then
    v_result:=public.apply_ball_knower_player_move(p_league_id,v_member.id,p_player_snapshot,p_drop_player_id,0,'free_agent',null);
    return v_result||jsonb_build_object('status','added','message','Free agent added instantly after waivers cleared.');
  end if;

  if coalesce(v_settings->>'waiverType','priority')='faab' and v_bid>v_member.faab_balance then raise exception 'FAAB bid exceeds remaining budget'; end if;
  if exists(
    select 1 from public.ball_knower_waiver_claims
    where league_id=p_league_id and member_id=v_member.id and player_id=v_player_id and status='pending'
  ) then raise exception 'You already have a pending claim for this player'; end if;

  v_process_at:=case
    when v_clears_at is not null then public.next_ball_knower_waiver_run(v_settings,v_clears_at-interval '1 second')
    else public.next_ball_knower_waiver_run(v_settings,now())
  end;

  insert into public.ball_knower_waiver_claims(
    league_id,member_id,player_id,player_snapshot,drop_player_id,priority,faab_bid,claim_group_id,claim_order,process_at
  ) values(
    p_league_id,v_member.id,v_player_id,p_player_snapshot,p_drop_player_id,greatest(1,p_claim_order),v_bid,v_group,greatest(1,p_claim_order),v_process_at
  ) returning id into v_claim_id;

  return jsonb_build_object(
    'status','pending',
    'claimId',v_claim_id,
    'claimGroupId',v_group,
    'processAt',v_process_at,
    'message',case when v_game_locked then 'That player has already played. Waiver claim scheduled.' else 'Waiver claim scheduled.' end
  );
end;$$;

revoke all on function public.submit_ball_knower_player_move(text,jsonb,text,numeric,integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.submit_ball_knower_player_move(text,jsonb,text,numeric,integer,uuid) to authenticated;
