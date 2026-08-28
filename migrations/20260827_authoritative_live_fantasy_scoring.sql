-- Authoritative live fantasy scoring foundation.
-- Tank01 is ingested by the server-only cron route; browser clients remain read-only.

alter table public.ball_knower_weekly_lineups
  add column if not exists locked_player_ids jsonb not null default '[]'::jsonb,
  add column if not exists finalized_at timestamptz;

alter table public.ball_knower_weekly_scores
  add column if not exists score_revision integer not null default 1,
  add column if not exists score_details jsonb not null default '{}'::jsonb,
  add column if not exists finalized_at timestamptz,
  add column if not exists last_correction_at timestamptz;

create table if not exists public.ball_knower_nfl_games (
  provider_game_id text primary key,
  season integer not null,
  season_type text not null default 'reg',
  week_number integer not null check (week_number between 1 and 22),
  away_team text not null,
  home_team text not null,
  kickoff_at timestamptz not null,
  game_status text not null default 'Scheduled',
  game_status_code text,
  game_period text,
  game_clock text,
  is_live boolean not null default false,
  is_final boolean not null default false,
  final_at timestamptz,
  last_polled_at timestamptz,
  provider_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists ball_knower_nfl_games_season_week_idx
  on public.ball_knower_nfl_games(season, season_type, week_number);
create index if not exists ball_knower_nfl_games_poll_idx
  on public.ball_knower_nfl_games(is_final, kickoff_at, last_polled_at);

create table if not exists public.ball_knower_player_week_scores (
  id uuid primary key default gen_random_uuid(),
  provider_game_id text not null references public.ball_knower_nfl_games(provider_game_id) on delete cascade,
  provider_player_id text not null,
  ball_knower_player_id text,
  season integer not null,
  season_type text not null default 'reg',
  week_number integer not null check (week_number between 1 and 22),
  player_name text not null,
  team text not null,
  position text,
  kickoff_at timestamptz not null,
  game_status text not null default 'Scheduled',
  is_final boolean not null default false,
  stats jsonb not null default '{}'::jsonb,
  fantasy_points jsonb not null default '{}'::jsonb,
  projected_points jsonb not null default '{}'::jsonb,
  score_revision integer not null default 1,
  provider_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(provider_game_id, provider_player_id)
);

create index if not exists ball_knower_player_week_scores_player_idx
  on public.ball_knower_player_week_scores(ball_knower_player_id, season, week_number);
create index if not exists ball_knower_player_week_scores_team_idx
  on public.ball_knower_player_week_scores(team, season, week_number);

create table if not exists public.ball_knower_stat_corrections (
  id uuid primary key default gen_random_uuid(),
  provider_game_id text not null references public.ball_knower_nfl_games(provider_game_id) on delete cascade,
  provider_player_id text not null,
  ball_knower_player_id text,
  season integer not null,
  week_number integer not null check (week_number between 1 and 22),
  player_name text not null,
  previous_stats jsonb not null default '{}'::jsonb,
  corrected_stats jsonb not null default '{}'::jsonb,
  previous_points jsonb not null default '{}'::jsonb,
  corrected_points jsonb not null default '{}'::jsonb,
  detected_at timestamptz not null default now()
);

create index if not exists ball_knower_stat_corrections_week_idx
  on public.ball_knower_stat_corrections(season, week_number, detected_at desc);
create index if not exists ball_knower_stat_corrections_game_idx
  on public.ball_knower_stat_corrections(provider_game_id);

alter table public.ball_knower_nfl_games enable row level security;
alter table public.ball_knower_player_week_scores enable row level security;
alter table public.ball_knower_stat_corrections enable row level security;

drop policy if exists "authenticated read nfl games" on public.ball_knower_nfl_games;
create policy "authenticated read nfl games" on public.ball_knower_nfl_games
for select to authenticated using (true);

drop policy if exists "authenticated read player week scores" on public.ball_knower_player_week_scores;
create policy "authenticated read player week scores" on public.ball_knower_player_week_scores
for select to authenticated using (true);

drop policy if exists "authenticated read stat corrections" on public.ball_knower_stat_corrections;
create policy "authenticated read stat corrections" on public.ball_knower_stat_corrections
for select to authenticated using (true);

revoke all on public.ball_knower_nfl_games from anon, authenticated;
revoke all on public.ball_knower_player_week_scores from anon, authenticated;
revoke all on public.ball_knower_stat_corrections from anon, authenticated;
grant select on public.ball_knower_nfl_games to authenticated;
grant select on public.ball_knower_player_week_scores to authenticated;
grant select on public.ball_knower_stat_corrections to authenticated;

-- A started player remains in the exact lineup slot they occupied at kickoff.
-- Unstarted players can still be changed, matching normal fantasy-football behavior.
create or replace function public.save_my_ball_knower_weekly_lineup(
  p_league_id text,
  p_week_number integer,
  p_starters jsonb,
  p_bench jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth uuid := auth.uid();
  v_member public.ball_knower_league_members%rowtype;
  v_existing public.ball_knower_weekly_lineups%rowtype;
  v_roster jsonb;
  v_player jsonb;
  v_player_id text;
  v_old_player_id text;
  v_slot text;
  v_position text;
  v_team text;
  v_seen text[] := '{}';
  v_locked jsonb := '[]'::jsonb;
  v_is_started boolean;
  v_has_existing boolean := false;
  v_required_slots text[] := array['QB','RB1','RB2','WR1','WR2','TE','FLEX','K','DST'];
  v_id uuid;
  v_season integer;
begin
  if v_auth is null then raise exception 'Authentication required'; end if;
  if p_week_number < 1 or p_week_number > 22 then raise exception 'Invalid week'; end if;
  if jsonb_typeof(p_starters) <> 'object' then raise exception 'Starters must be an object'; end if;
  if jsonb_typeof(coalesce(p_bench,'[]'::jsonb)) <> 'array' then raise exception 'Bench must be an array'; end if;

  select * into v_member
  from public.ball_knower_league_members
  where league_id = p_league_id and auth_user_id = v_auth
  limit 1;
  if not found then raise exception 'League membership not found'; end if;
  v_roster := coalesce(v_member.roster,'[]'::jsonb);

  select coalesce(nullif(settings->>'nflSeason','')::integer, extract(year from now())::integer)
  into v_season
  from public.ball_knower_leagues
  where id = p_league_id;

  select * into v_existing
  from public.ball_knower_weekly_lineups
  where league_id = p_league_id and member_id = v_member.id and week_number = p_week_number
  for update;
  v_has_existing := found;

  foreach v_slot in array v_required_slots loop
    v_player_id := p_starters->>v_slot;
    if v_player_id is null or v_player_id = '' then raise exception '% is empty', v_slot; end if;
    if v_player_id = any(v_seen) then raise exception 'A player cannot fill more than one lineup slot'; end if;
    v_seen := array_append(v_seen,v_player_id);

    select e into v_player from jsonb_array_elements(v_roster) e where e->>'id' = v_player_id limit 1;
    if v_player is null then raise exception '% starter is not on your roster', v_slot; end if;
    v_position := v_player->>'position';
    if (v_slot='QB' and v_position<>'QB')
      or (v_slot in('RB1','RB2') and v_position not in('RB','FB'))
      or (v_slot in('WR1','WR2') and v_position<>'WR')
      or (v_slot='TE' and v_position<>'TE')
      or (v_slot='FLEX' and v_position not in('RB','FB','WR','TE'))
      or (v_slot='K' and v_position<>'K')
      or (v_slot='DST' and v_position<>'DST')
    then raise exception '% is not eligible for %', coalesce(v_player->>'name',v_player_id), v_slot; end if;
  end loop;

  if v_has_existing then
    for v_slot, v_old_player_id in select key, value from jsonb_each_text(v_existing.starters) loop
      select e->>'team' into v_team from jsonb_array_elements(v_roster) e where e->>'id'=v_old_player_id limit 1;
      select exists(
        select 1 from public.ball_knower_nfl_games g
        where g.season=v_season and g.week_number=p_week_number
          and (g.home_team=v_team or g.away_team=v_team) and g.kickoff_at<=now()
      ) into v_is_started;
      if v_is_started or exists(select 1 from jsonb_array_elements_text(coalesce(v_existing.locked_player_ids,'[]'::jsonb)) x where x=v_old_player_id) then
        v_locked := v_locked || to_jsonb(v_old_player_id);
        if p_starters->>v_slot is distinct from v_old_player_id then
          raise exception '% is locked in the % slot because his game has started', coalesce((select e->>'name' from jsonb_array_elements(v_roster)e where e->>'id'=v_old_player_id limit 1),v_old_player_id), v_slot;
        end if;
      end if;
    end loop;
  end if;

  for v_slot, v_player_id in select key, value from jsonb_each_text(p_starters) loop
    select e->>'team' into v_team from jsonb_array_elements(v_roster)e where e->>'id'=v_player_id limit 1;
    select exists(
      select 1 from public.ball_knower_nfl_games g
      where g.season=v_season and g.week_number=p_week_number
        and (g.home_team=v_team or g.away_team=v_team) and g.kickoff_at<=now()
    ) into v_is_started;
    if v_is_started and (not v_has_existing or coalesce(v_existing.starters->>v_slot,'')<>v_player_id) then
      raise exception '% cannot be moved into the lineup after kickoff', coalesce((select e->>'name' from jsonb_array_elements(v_roster)e where e->>'id'=v_player_id limit 1),v_player_id);
    end if;
    if v_is_started and not exists(select 1 from jsonb_array_elements_text(v_locked)x where x=v_player_id) then
      v_locked := v_locked || to_jsonb(v_player_id);
    end if;
  end loop;

  insert into public.ball_knower_weekly_lineups(
    league_id,member_id,week_number,starters,bench,locked,locked_player_ids,submitted_at,updated_at
  ) values(
    p_league_id,v_member.id,p_week_number,p_starters,coalesce(p_bench,'[]'::jsonb),
    jsonb_array_length(v_locked)>=array_length(v_required_slots,1),v_locked,now(),now()
  )
  on conflict(league_id,member_id,week_number) do update set
    starters=excluded.starters,
    bench=excluded.bench,
    locked=excluded.locked,
    locked_player_ids=excluded.locked_player_ids,
    submitted_at=now(),
    updated_at=now()
  returning id into v_id;

  insert into public.ball_knower_transactions(league_id,member_id,transaction_type,summary,metadata)
  values(p_league_id,v_member.id,'lineup',v_member.user_name||' submitted Week '||p_week_number||' starters.',jsonb_build_object('week',p_week_number,'lockedPlayerIds',v_locked));
  return jsonb_build_object('id',v_id,'week',p_week_number,'memberId',v_member.id,'lockedPlayerIds',v_locked);
end;
$$;

revoke all on function public.save_my_ball_knower_weekly_lineup(text,integer,jsonb,jsonb) from public, anon;
grant execute on function public.save_my_ball_knower_weekly_lineup(text,integer,jsonb,jsonb) to authenticated, service_role;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ball_knower_weekly_scores') then
    alter publication supabase_realtime add table public.ball_knower_weekly_scores;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ball_knower_player_week_scores') then
    alter publication supabase_realtime add table public.ball_knower_player_week_scores;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ball_knower_nfl_games') then
    alter publication supabase_realtime add table public.ball_knower_nfl_games;
  end if;
end $$;
