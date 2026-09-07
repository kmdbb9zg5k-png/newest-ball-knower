-- Independently generated data. Existing leagues, scores and saved rosters are not rewritten.
create schema if not exists ball_knower_private;
create table ball_knower_private.independent_fantasy_rankings_snapshot (
  player_key text not null,
  season integer not null,
  scoring_format text not null,
  payload jsonb not null,
  primary key(player_key,season,scoring_format)
);
alter table ball_knower_private.independent_fantasy_rankings_snapshot enable row level security;
revoke all on ball_knower_private.independent_fantasy_rankings_snapshot from public,anon,authenticated;

create or replace function public.refresh_ball_knower_fantasy_rankings()
returns integer language plpgsql security definer set search_path='' as $function$
declare result integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('bk-independent-rankings-2026',0));
  if (select count(*) from ball_knower_private.independent_fantasy_rankings_snapshot where season=2026)<1500 then
    raise exception 'Independent projection snapshot missing; existing rankings preserved';
  end if;
  delete from public.ball_knower_fantasy_rankings where season=2026 and scoring_format in ('ppr','half_ppr','standard');
  insert into public.ball_knower_fantasy_rankings(player_key,season,scoring_format,player_name,team,position,
    overall_rank,position_rank,actual_points_2025,projected_points_2026,projection_reason,
    actual_source_name,actual_source_url,projection_source_name,projection_source_url,projection_model,updated_at,adp)
  select r.player_key,r.season,r.scoring_format,r.player_name,r.team,r.position,r.overall_rank,r.position_rank,
    r.actual_points_2025,r.projected_points_2026,r.projection_reason,r.actual_source_name,r.actual_source_url,
    r.projection_source_name,r.projection_source_url,r.projection_model,r.updated_at,null
  from ball_knower_private.independent_fantasy_rankings_snapshot s
  cross join lateral jsonb_to_record(s.payload) as r(player_key text,season integer,scoring_format text,
    player_name text,team text,position text,overall_rank integer,position_rank integer,actual_points_2025 numeric,
    projected_points_2026 numeric,projection_reason text,actual_source_name text,actual_source_url text,
    projection_source_name text,projection_source_url text,projection_model text,updated_at timestamptz)
  where s.season=2026;
  get diagnostics result=row_count;
  return result;
end;$function$;
revoke all on function public.refresh_ball_knower_fantasy_rankings() from public,anon,authenticated;
grant execute on function public.refresh_ball_knower_fantasy_rankings() to service_role;

create function ball_knower_private.install_independent_snapshot(p_payload jsonb)
returns void language plpgsql security definer set search_path='' as $function$
declare expected integer; actual integer;
begin
  -- Serialize with league creation. Do not change the contest budget mid-game.
  lock table public.ball_knower_leagues in share row exclusive mode;
  if exists(select 1 from public.ball_knower_leagues l where l.settings->>'draftOrderMethod'='game'
    and coalesce(jsonb_array_length(l.season_result->'draftOrder'),0)=0) then
    raise exception 'An unfinished Draft Order Game exists; defer source migration';
  end if;
  if p_payload->>'version' is distinct from '1' or p_payload->>'season' is distinct from '2026'
    or jsonb_typeof(p_payload->'catalog') is distinct from 'array'
    or jsonb_typeof(p_payload->'rankings') is distinct from 'array' then
    raise exception 'Invalid independent snapshot envelope';
  end if;
  expected:=jsonb_array_length(p_payload->'catalog');
  if expected<1500 or expected>5000 then raise exception 'Unexpected catalog count'; end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'catalog') a where coalesce(a->'player_json'->>'name','')=''
    or coalesce(a->'player_json'->>'ratingSource','') not like 'Ball Knower%'
    or a->'player_json'->>'id' is distinct from a->>'player_id') then
    raise exception 'Catalog identity or independent provenance missing';
  end if;
  if (select count(distinct a->'player_json'->>'team') from jsonb_array_elements(p_payload->'catalog') a)<>32 then
    raise exception 'Complete team coverage required';
  end if;
  if (select count(distinct a->>'player_id') from jsonb_array_elements(p_payload->'catalog') a)<>expected then
    raise exception 'Duplicate catalog identities';
  end if;
  insert into ball_knower_private.draft_order_game_players(player_id,position_group,salary,ovr,player_json,active)
  select r.player_id,r.position_group,r.salary,r.ovr,r.player_json,true
    from jsonb_to_recordset(p_payload->'catalog') as r(player_id text,position_group text,salary numeric,ovr integer,player_json jsonb)
  on conflict(player_id) do update set position_group=excluded.position_group,salary=excluded.salary,
    ovr=excluded.ovr,player_json=excluded.player_json,active=true;
  update ball_knower_private.draft_order_game_players p set active=false
    where not exists(select 1 from jsonb_array_elements(p_payload->'catalog') a where a->>'player_id'=p.player_id);
  -- Keep archive rows and all saved roster JSON intact. Only future selection changes.
  if jsonb_array_length(p_payload->'rankings')<1500 or jsonb_array_length(p_payload->'rankings')>15000 then
    raise exception 'Unexpected projection count';
  end if;
  if exists(select 1 from jsonb_array_elements(p_payload->'rankings') r
    where r->>'projection_source_name' is distinct from 'Ball Knower independent projection model v1'
      or r->>'season' is distinct from '2026'
      or coalesce(r->>'scoring_format','') not in ('ppr','half_ppr','standard')) then
    raise exception 'Unexpected projection provenance or scope';
  end if;
  if (select count(distinct r->>'scoring_format') from jsonb_array_elements(p_payload->'rankings') r)<>3 then
    raise exception 'All three scoring formats required';
  end if;
  delete from ball_knower_private.independent_fantasy_rankings_snapshot where season=2026;
  insert into ball_knower_private.independent_fantasy_rankings_snapshot(player_key,season,scoring_format,payload)
    select r->>'player_key',2026,r->>'scoring_format',r from jsonb_array_elements(p_payload->'rankings') r;
  perform public.refresh_ball_knower_fantasy_rankings();
end;$function$;
revoke all on function ball_knower_private.install_independent_snapshot(jsonb) from public,anon,authenticated;
grant execute on function ball_knower_private.install_independent_snapshot(jsonb) to service_role;

-- NETWORK_BOOTSTRAP: the remote bytes are accepted only at this exact SHA-256.
-- Existing HTTP/pgcrypto extensions are used only by this privileged migration.
do $bootstrap$
declare status integer; body text;
begin
  select response.status,response.content into status,body
  from extensions.http_get('https://raw.githubusercontent.com/kmdbb9zg5k-png/newest-ball-knower/release/independent-football-sources/data/published-independent-football.json') response;
  if status<>200 or encode(extensions.digest(body,'sha256'),'hex')<>'125f72e3a81dea6a1960068e20608bc48a63d9cb6cb60b238e5f5eed82f757b1' then
    raise exception 'Independent source snapshot unavailable or checksum mismatch; no changes committed';
  end if;
  perform ball_knower_private.install_independent_snapshot(body::jsonb);
end;$bootstrap$;
