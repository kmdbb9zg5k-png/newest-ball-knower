-- All client lineup writes must pass the existing SECURITY DEFINER save RPC,
-- which enforces kickoff locks. SELECT policies and the RPC grants are preserved.
revoke insert,update,delete on public.ball_knower_weekly_lineups from public,anon,authenticated;

-- Preserve per-player kickoff locks while adding exact slots/bench validation.
-- Browser clients retain this single authenticated lineup write entry point.
create or replace function public.save_my_ball_knower_weekly_lineup(p_league_id text,p_week_number integer,p_starters jsonb,p_bench jsonb default '[]'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_auth uuid:=auth.uid();v_member public.ball_knower_league_members%rowtype;v_existing public.ball_knower_weekly_lineups%rowtype;
 v_player jsonb;v_roster jsonb;v_slot text;v_player_id text;v_old_player_id text;v_position text;v_team text;v_seen text[]:='{}';v_locked jsonb:='[]'::jsonb;v_is_started boolean;v_has_existing boolean;v_season integer;v_season_text text;v_id uuid;
begin
 if v_auth is null then raise exception 'Authentication required';end if;
 if p_week_number is null or p_week_number not between 1 and 22 then raise exception 'Invalid week';end if;
 if jsonb_typeof(p_starters) is distinct from 'object' or jsonb_typeof(p_bench) is distinct from 'array' then raise exception 'Invalid lineup shape';end if;
 if(select array_agg(slot order by slot)from jsonb_object_keys(p_starters)slots(slot))is distinct from array['DST','FLEX','K','QB','RB1','RB2','TE','WR1','WR2']::text[]then raise exception 'Lineup must contain exactly nine required slots';end if;
 select * into v_member from public.ball_knower_league_members where league_id=p_league_id and auth_user_id=v_auth and not coalesce(is_ai,false)limit 1 for update;
 if not found then raise exception 'League membership not found';end if;
 v_roster:=coalesce(v_member.roster,'[]'::jsonb);
 select settings->>'nflSeason'into v_season_text from public.ball_knower_leagues where id=p_league_id;
 v_season:=case when v_season_text~'^[0-9]{4}$'then v_season_text::integer else extract(year from clock_timestamp())::integer end;
 select * into v_existing from public.ball_knower_weekly_lineups where league_id=p_league_id and member_id=v_member.id and week_number=p_week_number for update;
 v_has_existing:=found;
 for v_slot,v_player_id in select key,value#>>'{}'from jsonb_each(p_starters)loop
  if nullif(btrim(v_player_id),'')is null or jsonb_typeof(p_starters->v_slot)<>'string'then raise exception 'Starter requires a player ID';end if;
  if v_player_id=any(v_seen)then raise exception 'A player cannot fill more than one lineup slot';end if;
  v_seen:=array_append(v_seen,v_player_id);
  select e into v_player from jsonb_array_elements(v_roster)e where e->>'id'=v_player_id limit 1;
  if not found then raise exception 'Starter is not on your roster';end if;
  v_position:=upper(v_player->>'position');
  if coalesce(v_position,'')not in('QB','RB','FB','WR','TE','K','DST')or(v_slot='QB'and v_position<>'QB')or(v_slot in('RB1','RB2')and v_position not in('RB','FB'))or(v_slot in('WR1','WR2')and v_position<>'WR')or(v_slot='TE'and v_position<>'TE')or(v_slot='FLEX'and v_position not in('RB','FB','WR','TE'))or(v_slot='K'and v_position<>'K')or(v_slot='DST'and v_position<>'DST')then raise exception 'Starter is not eligible for slot';end if;
 end loop;
 for v_player_id in select value#>>'{}'from jsonb_array_elements(p_bench)loop
  if nullif(btrim(v_player_id),'')is null or v_player_id=any(v_seen)or not exists(select 1 from jsonb_array_elements(v_roster)e where e->>'id'=v_player_id)then raise exception 'Invalid or duplicate bench player';end if;
  v_seen:=array_append(v_seen,v_player_id);
 end loop;
 if exists(select 1 from jsonb_array_elements(p_bench)e where jsonb_typeof(e)<>'string')then raise exception 'Bench IDs must be strings';end if;
 if v_has_existing then
  if v_existing.locked and p_starters is distinct from v_existing.starters then raise exception 'This lineup is locked';end if;
  for v_slot,v_old_player_id in select key,value from jsonb_each_text(v_existing.starters)loop
   select case upper(e->>'team')when 'LA'then 'LAR'when 'WSH'then 'WAS'when 'JAC'then 'JAX'else upper(e->>'team')end into v_team from jsonb_array_elements(v_roster)e where e->>'id'=v_old_player_id limit 1;
   select exists(select 1 from public.ball_knower_nfl_games g where g.season=v_season and g.season_type='reg' and g.week_number=p_week_number and v_team in(g.home_team,g.away_team)and g.kickoff_at<=clock_timestamp())into v_is_started;
   if v_is_started or coalesce(v_existing.locked_player_ids,'[]'::jsonb)?v_old_player_id then
    v_locked:=v_locked||to_jsonb(v_old_player_id);
    if p_starters->>v_slot is distinct from v_old_player_id then raise exception 'Started player is locked in the same lineup slot';end if;
   end if;
  end loop;
 end if;
 for v_slot,v_player_id in select key,value from jsonb_each_text(p_starters)loop
  select case upper(e->>'team')when 'LA'then 'LAR'when 'WSH'then 'WAS'when 'JAC'then 'JAX'else upper(e->>'team')end into v_team from jsonb_array_elements(v_roster)e where e->>'id'=v_player_id limit 1;
  select exists(select 1 from public.ball_knower_nfl_games g where g.season=v_season and g.season_type='reg' and g.week_number=p_week_number and v_team in(g.home_team,g.away_team)and g.kickoff_at<=clock_timestamp())into v_is_started;
  if v_is_started and(not v_has_existing or coalesce(v_existing.starters->>v_slot,'')<>v_player_id)then raise exception 'Player cannot enter a different starter slot after kickoff';end if;
  if v_is_started and not(v_locked?v_player_id)then v_locked:=v_locked||to_jsonb(v_player_id);end if;
 end loop;
 insert into public.ball_knower_weekly_lineups(league_id,member_id,week_number,starters,bench,locked,locked_player_ids,submitted_at,updated_at)
 values(p_league_id,v_member.id,p_week_number,p_starters,p_bench,coalesce(v_existing.locked,false)or jsonb_array_length(v_locked)>=9,v_locked,clock_timestamp(),clock_timestamp())
 on conflict(league_id,member_id,week_number)do update set starters=excluded.starters,bench=excluded.bench,locked=excluded.locked,locked_player_ids=excluded.locked_player_ids,submitted_at=excluded.submitted_at,updated_at=excluded.updated_at returning id into v_id;
 insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata)values(p_league_id,v_member.id,'lineup',v_member.user_name||' submitted Week '||p_week_number||' starters.',jsonb_build_object('week',p_week_number,'lockedPlayerIds',v_locked));
 return jsonb_build_object('id',v_id,'week',p_week_number,'memberId',v_member.id,'lockedPlayerIds',v_locked);
end $$;
revoke all on function public.save_my_ball_knower_weekly_lineup(text,integer,jsonb,jsonb)from public,anon;
grant execute on function public.save_my_ball_knower_weekly_lineup(text,integer,jsonb,jsonb)to authenticated,service_role;
