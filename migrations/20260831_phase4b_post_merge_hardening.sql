-- Phase 4B post-merge hardening.
-- Keep Owner snapshots monotonic across tabs/devices and preserve the most
-- advanced verified Owner run when guest progress is claimed.

create or replace function ball_knower_private.owner_state_updated_at(p_value jsonb)
returns bigint
language plpgsql
immutable
set search_path=pg_catalog,pg_temp
as $$
declare
  v_updated text;
begin
  if p_value is null or jsonb_typeof(p_value)<>'object' then return 0; end if;
  v_updated:=p_value->>'updatedAt';
  if v_updated is null or v_updated!~'^[0-9]{1,16} then return 0; end if;
  return v_updated::bigint;
exception when others then
  return 0;
end;
$$;
revoke all on function ball_knower_private.owner_state_updated_at(jsonb) from public,anon,authenticated;

create or replace function public.save_ball_knower_timestamped_user_state(
  p_state_key text,
  p_value jsonb
)
returns table(state_key text,value jsonb,updated_at timestamptz)
language plpgsql
security definer
set search_path=public,ball_knower_private,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_incoming_updated bigint;
  v_row public.ball_knower_user_state%rowtype;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if p_state_key<>'owner_business_career_v1' then raise exception 'Unsupported timestamped state'; end if;
  v_incoming_updated:=ball_knower_private.owner_state_updated_at(p_value);
  if v_incoming_updated<=0 then raise exception 'Valid updatedAt required'; end if;

  insert into public.ball_knower_user_state as current_state(user_id,state_key,value,updated_at)
  values(v_user,p_state_key,p_value,now())
  on conflict(user_id,state_key) do update
  set value=excluded.value,updated_at=now()
  where ball_knower_private.owner_state_updated_at(current_state.value)<=v_incoming_updated
  returning current_state.* into v_row;

  if not found then
    select * into v_row
    from public.ball_knower_user_state s
    where s.user_id=v_user and s.state_key=p_state_key;
  end if;

  return query select v_row.state_key,v_row.value,v_row.updated_at;
end;
$$;
revoke all on function public.save_ball_knower_timestamped_user_state(text,jsonb) from public,anon;
grant execute on function public.save_ball_knower_timestamped_user_state(text,jsonb) to authenticated;

create or replace function ball_knower_private.transfer_verified_mode_state_on_guest_claim()
returns trigger
language plpgsql
security definer
set search_path=public,ball_knower_private,pg_temp
as $$
begin
  if new.claimed_at is null or new.claimed_by is null
     or old.claimed_at is not null or new.guest_user_id=new.claimed_by then
    return new;
  end if;

  insert into ball_knower_private.verified_mode_milestones(
    user_id,mode,milestone_type,source_key,payload,verified_at,verified_by,claimed_at
  )
  select new.claimed_by,mode,milestone_type,source_key,payload,verified_at,verified_by,claimed_at
  from ball_knower_private.verified_mode_milestones where user_id=new.guest_user_id
  on conflict(user_id,mode,source_key) do nothing;
  delete from ball_knower_private.verified_mode_milestones where user_id=new.guest_user_id;

  insert into ball_knower_private.verified_prediction_picks(
    user_id,game_id,pick_id,market,selection,locked_line,label,kickoff_at,away_team,home_team,locked_at,result,graded_at
  )
  select new.claimed_by,game_id,pick_id,market,selection,locked_line,label,kickoff_at,away_team,home_team,locked_at,result,graded_at
  from ball_knower_private.verified_prediction_picks where user_id=new.guest_user_id
  on conflict(user_id,game_id) do nothing;
  delete from ball_knower_private.verified_prediction_picks where user_id=new.guest_user_id;

  insert into ball_knower_private.verified_owner_runs(
    user_id,abbr,season,week,stage,wins,losses,playoff_seed,version,updated_at
  )
  select new.claimed_by,abbr,season,week,stage,wins,losses,playoff_seed,version,updated_at
  from ball_knower_private.verified_owner_runs where user_id=new.guest_user_id
  on conflict(user_id) do update set
    abbr=excluded.abbr,
    season=excluded.season,
    week=excluded.week,
    stage=excluded.stage,
    wins=excluded.wins,
    losses=excluded.losses,
    playoff_seed=excluded.playoff_seed,
    version=greatest(ball_knower_private.verified_owner_runs.version,excluded.version)+1,
    updated_at=greatest(ball_knower_private.verified_owner_runs.updated_at,excluded.updated_at)
  where (
    excluded.season,
    case excluded.stage
      when 'preseason' then 0 when 'regular' then 1 when 'wild-card' then 2
      when 'divisional' then 3 when 'conference' then 4 when 'super-bowl' then 5 else -1 end,
    excluded.week,
    excluded.wins,
    -excluded.losses
  ) > (
    ball_knower_private.verified_owner_runs.season,
    case ball_knower_private.verified_owner_runs.stage
      when 'preseason' then 0 when 'regular' then 1 when 'wild-card' then 2
      when 'divisional' then 3 when 'conference' then 4 when 'super-bowl' then 5 else -1 end,
    ball_knower_private.verified_owner_runs.week,
    ball_knower_private.verified_owner_runs.wins,
    -ball_knower_private.verified_owner_runs.losses
  );
  delete from ball_knower_private.verified_owner_runs where user_id=new.guest_user_id;

  insert into ball_knower_private.verified_agent_clients(
    user_id,player_id,legacy_baseline,signed_at,last_contract_season,last_trade_season,fulfilled_promises
  )
  select new.claimed_by,player_id,legacy_baseline,signed_at,last_contract_season,last_trade_season,fulfilled_promises
  from ball_knower_private.verified_agent_clients where user_id=new.guest_user_id
  on conflict(user_id,player_id) do nothing;
  delete from ball_knower_private.verified_agent_clients where user_id=new.guest_user_id;

  return new;
end;
$$;
revoke all on function ball_knower_private.transfer_verified_mode_state_on_guest_claim() from public,anon,authenticated;
 then return 0; end if;
  return v_updated::bigint;
exception when others then
  return 0;
end;
$$;
revoke all on function ball_knower_private.owner_state_updated_at(jsonb) from public,anon,authenticated;

create or replace function public.save_ball_knower_timestamped_user_state(
  p_state_key text,
  p_value jsonb
)
returns table(state_key text,value jsonb,updated_at timestamptz)
language plpgsql
security definer
set search_path=public,ball_knower_private,pg_temp
as $$
declare
  v_user uuid:=auth.uid();
  v_incoming_updated bigint;
  v_row public.ball_knower_user_state%rowtype;
begin
  if v_user is null then raise exception 'Sign in required'; end if;
  if p_state_key<>'owner_business_career_v1' then raise exception 'Unsupported timestamped state'; end if;
  v_incoming_updated:=ball_knower_private.owner_state_updated_at(p_value);
  if v_incoming_updated<=0 then raise exception 'Valid updatedAt required'; end if;

  insert into public.ball_knower_user_state as current_state(user_id,state_key,value,updated_at)
  values(v_user,p_state_key,p_value,now())
  on conflict(user_id,state_key) do update
  set value=excluded.value,updated_at=now()
  where ball_knower_private.owner_state_updated_at(current_state.value)<=v_incoming_updated
  returning current_state.* into v_row;

  if not found then
    select * into v_row
    from public.ball_knower_user_state s
    where s.user_id=v_user and s.state_key=p_state_key;
  end if;

  return query select v_row.state_key,v_row.value,v_row.updated_at;
end;
$$;
revoke all on function public.save_ball_knower_timestamped_user_state(text,jsonb) from public,anon;
grant execute on function public.save_ball_knower_timestamped_user_state(text,jsonb) to authenticated;

create or replace function ball_knower_private.transfer_verified_mode_state_on_guest_claim()
returns trigger
language plpgsql
security definer
set search_path=public,ball_knower_private,pg_temp
as $$
begin
  if new.claimed_at is null or new.claimed_by is null
     or old.claimed_at is not null or new.guest_user_id=new.claimed_by then
    return new;
  end if;

  insert into ball_knower_private.verified_mode_milestones(
    user_id,mode,milestone_type,source_key,payload,verified_at,verified_by,claimed_at
  )
  select new.claimed_by,mode,milestone_type,source_key,payload,verified_at,verified_by,claimed_at
  from ball_knower_private.verified_mode_milestones where user_id=new.guest_user_id
  on conflict(user_id,mode,source_key) do nothing;
  delete from ball_knower_private.verified_mode_milestones where user_id=new.guest_user_id;

  insert into ball_knower_private.verified_prediction_picks(
    user_id,game_id,pick_id,market,selection,locked_line,label,kickoff_at,away_team,home_team,locked_at,result,graded_at
  )
  select new.claimed_by,game_id,pick_id,market,selection,locked_line,label,kickoff_at,away_team,home_team,locked_at,result,graded_at
  from ball_knower_private.verified_prediction_picks where user_id=new.guest_user_id
  on conflict(user_id,game_id) do nothing;
  delete from ball_knower_private.verified_prediction_picks where user_id=new.guest_user_id;

  insert into ball_knower_private.verified_owner_runs(
    user_id,abbr,season,week,stage,wins,losses,playoff_seed,version,updated_at
  )
  select new.claimed_by,abbr,season,week,stage,wins,losses,playoff_seed,version,updated_at
  from ball_knower_private.verified_owner_runs where user_id=new.guest_user_id
  on conflict(user_id) do update set
    abbr=excluded.abbr,
    season=excluded.season,
    week=excluded.week,
    stage=excluded.stage,
    wins=excluded.wins,
    losses=excluded.losses,
    playoff_seed=excluded.playoff_seed,
    version=greatest(ball_knower_private.verified_owner_runs.version,excluded.version)+1,
    updated_at=greatest(ball_knower_private.verified_owner_runs.updated_at,excluded.updated_at)
  where (
    excluded.season,
    case excluded.stage
      when 'preseason' then 0 when 'regular' then 1 when 'wild-card' then 2
      when 'divisional' then 3 when 'conference' then 4 when 'super-bowl' then 5 else -1 end,
    excluded.week,
    excluded.wins,
    -excluded.losses
  ) > (
    ball_knower_private.verified_owner_runs.season,
    case ball_knower_private.verified_owner_runs.stage
      when 'preseason' then 0 when 'regular' then 1 when 'wild-card' then 2
      when 'divisional' then 3 when 'conference' then 4 when 'super-bowl' then 5 else -1 end,
    ball_knower_private.verified_owner_runs.week,
    ball_knower_private.verified_owner_runs.wins,
    -ball_knower_private.verified_owner_runs.losses
  );
  delete from ball_knower_private.verified_owner_runs where user_id=new.guest_user_id;

  insert into ball_knower_private.verified_agent_clients(
    user_id,player_id,legacy_baseline,signed_at,last_contract_season,last_trade_season,fulfilled_promises
  )
  select new.claimed_by,player_id,legacy_baseline,signed_at,last_contract_season,last_trade_season,fulfilled_promises
  from ball_knower_private.verified_agent_clients where user_id=new.guest_user_id
  on conflict(user_id,player_id) do nothing;
  delete from ball_knower_private.verified_agent_clients where user_id=new.guest_user_id;

  return new;
end;
$$;
revoke all on function ball_knower_private.transfer_verified_mode_state_on_guest_claim() from public,anon,authenticated;
