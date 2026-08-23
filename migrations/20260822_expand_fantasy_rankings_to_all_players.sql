-- Expand the 2026 full-PPR cheat sheet from the curated top 25 to the full
-- active fantasy-relevant player pool while preserving the editorial top 25.

create or replace function public.refresh_ball_knower_fantasy_rankings()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  sleeper_status integer;
  sleeper_content text;
  week_no integer;
  weekly_status integer;
  weekly_content text;
  weekly_url text;
  refreshed_count integer;
begin
  create temp table bk_current_fantasy_players (
    sleeper_id text primary key,
    player_key text not null,
    name_norm text not null,
    player_name text not null,
    team text not null,
    position text not null,
    depth_order integer,
    years_exp integer,
    age integer,
    gsis_id text
  ) on commit drop;

  select response.status, response.content
  into sleeper_status, sleeper_content
  from http_get('https://api.sleeper.app/v1/players/nfl') response;

  if sleeper_status <> 200 then
    raise exception 'Could not refresh fantasy rankings: Sleeper returned HTTP %', sleeper_status;
  end if;

  insert into bk_current_fantasy_players
    (sleeper_id, player_key, name_norm, player_name, team, position, depth_order, years_exp, age, gsis_id)
  select
    player_id,
    'sleeper-' || player_id,
    regexp_replace(
      regexp_replace(lower(player_json->>'full_name'), '[[:space:]]+(jr\.?|sr\.?|ii|iii|iv|v)$', '', 'g'),
      '[^a-z0-9]+',
      '',
      'g'
    ),
    player_json->>'full_name',
    upper(player_json->>'team'),
    upper(player_json->>'position'),
    nullif(player_json->>'depth_chart_order', '')::integer,
    nullif(player_json->>'years_exp', '')::integer,
    nullif(player_json->>'age', '')::integer,
    nullif(player_json->>'gsis_id', '')
  from jsonb_each(sleeper_content::jsonb) as sleeper(player_id, player_json)
  where player_json->>'active' = 'true'
    and player_json->>'team' is not null
    and player_json->>'team' <> ''
    and upper(coalesce(player_json->>'position', '')) in ('QB', 'RB', 'WR', 'TE', 'K')
    and coalesce(player_json->>'full_name', '') <> '';

  create temp table bk_2025_weekly_fantasy_stats (
    gsis_id text,
    name_norm text not null,
    player_name text not null,
    position text not null,
    team text,
    week integer not null,
    points numeric not null
  ) on commit drop;

  for week_no in 1..18 loop
    weekly_url :=
      'https://raw.githubusercontent.com/NityaGehlot/nfl-data/main/data/Stats/2025%20Season/2025%20Offense/player_stats_2025_week'
      || lpad(week_no::text, 2, '0')
      || '.json';

    select response.status, response.content
    into weekly_status, weekly_content
    from http_get(weekly_url) response;

    if weekly_status <> 200 then
      raise exception 'Could not refresh fantasy rankings: 2025 week % returned HTTP %', week_no, weekly_status;
    end if;

    insert into bk_2025_weekly_fantasy_stats
      (gsis_id, name_norm, player_name, position, team, week, points)
    select
      nullif(player_row->>'player_id', ''),
      regexp_replace(
        regexp_replace(lower(player_row->>'player_name'), '[[:space:]]+(jr\.?|sr\.?|ii|iii|iv|v)$', '', 'g'),
        '[^a-z0-9]+',
        '',
        'g'
      ),
      player_row->>'player_name',
      upper(player_row->>'position'),
      upper(nullif(player_row->>'team', '')),
      week_no,
      coalesce(nullif(player_row->>'fantasy_points_ppr', '')::numeric, 0)
    from jsonb_each(weekly_content::jsonb) as weekly_bucket(bucket_name, bucket_players)
    cross join lateral jsonb_array_elements(bucket_players) as player(player_row)
    where player_row->>'season' = '2025'
      and upper(coalesce(player_row->>'position', '')) in ('QB', 'RB', 'WR', 'TE', 'K')
      and coalesce(player_row->>'player_name', '') <> '';
  end loop;

  create temp table bk_generated_fantasy_rankings on commit drop as
  with actuals as (
    select
      gsis_id,
      name_norm,
      position,
      greatest(0, sum(points))::numeric as actual_points,
      count(distinct week)::integer as games_played
    from bk_2025_weekly_fantasy_stats
    group by gsis_id, name_norm, position
  ),
  current_with_actuals as (
    select
      current_player.*,
      coalesce(matched_actual.actual_points, 0)::numeric as actual_points,
      coalesce(matched_actual.games_played, 0)::integer as games_played
    from bk_current_fantasy_players current_player
    left join lateral (
      select actual.*
      from actuals actual
      where
        (current_player.gsis_id is not null and actual.gsis_id = current_player.gsis_id)
        or (actual.name_norm = current_player.name_norm and actual.position = current_player.position)
      order by
        case when current_player.gsis_id is not null and actual.gsis_id = current_player.gsis_id then 0 else 1 end
      limit 1
    ) matched_actual on true
  ),
  eligible_players as (
    select current_player.*
    from current_with_actuals current_player
    where (
      coalesce(current_player.depth_order, 999) <= 4
      or current_player.actual_points > 0
      or (coalesce(current_player.years_exp, 0) <= 1 and coalesce(current_player.depth_order, 999) <= 6)
    )
    and not exists (
      select 1
      from public.ball_knower_fantasy_rankings editorial
      where editorial.season = 2026
        and editorial.scoring_format = 'ppr'
        and editorial.overall_rank <= 25
        and editorial.position = current_player.position
        and regexp_replace(
          regexp_replace(lower(editorial.player_name), '[[:space:]]+(jr\.?|sr\.?|ii|iii|iv|v)$', '', 'g'),
          '[^a-z0-9]+',
          '',
          'g'
        ) = current_player.name_norm
    )
  ),
  role_assignment as (
    select
      eligible.*,
      coalesce(
        eligible.depth_order,
        case eligible.position
          when 'QB' then case when actual_points >= 200 then 1 when actual_points >= 50 then 2 when actual_points > 0 then 3 else 99 end
          when 'RB' then case when actual_points >= 150 then 1 when actual_points >= 60 then 2 when actual_points > 0 then 3 else 99 end
          when 'WR' then case when actual_points >= 150 then 1 when actual_points >= 60 then 2 when actual_points > 0 then 3 else 99 end
          when 'TE' then case when actual_points >= 100 then 1 when actual_points >= 30 then 2 when actual_points > 0 then 3 else 99 end
          when 'K' then case when actual_points >= 100 then 1 when actual_points >= 20 then 2 when actual_points > 0 then 3 else 99 end
        end
      ) as effective_depth
    from eligible_players eligible
  ),
  projection_ingredients as (
    select
      assigned.*,
      case assigned.position
        when 'QB' then case when effective_depth <= 1 then 285 when effective_depth = 2 then 80 when effective_depth = 3 then 28 else 8 end
        when 'RB' then case when effective_depth <= 1 then 210 when effective_depth = 2 then 130 when effective_depth = 3 then 75 when effective_depth = 4 then 42 else 15 end
        when 'WR' then case when effective_depth <= 1 then 220 when effective_depth = 2 then 155 when effective_depth = 3 then 105 when effective_depth = 4 then 70 when effective_depth <= 6 then 35 else 12 end
        when 'TE' then case when effective_depth <= 1 then 165 when effective_depth = 2 then 85 when effective_depth = 3 then 50 when effective_depth = 4 then 30 else 10 end
        when 'K' then case when effective_depth <= 1 then 135 when effective_depth = 2 then 25 else 5 end
      end::numeric as role_baseline,
      case when games_played > 0 then actual_points / games_played * 17 else 0 end::numeric as full_season_pace,
      case
        when games_played >= 15 then 0.72
        when games_played >= 12 then 0.68
        when games_played >= 8 then 0.62
        when games_played >= 4 then 0.52
        when games_played > 0 then 0.42
        else 0
      end::numeric as production_weight,
      case
        when games_played >= 15 then 1.00
        when games_played >= 12 then 0.97
        when games_played >= 8 then 0.91
        when games_played >= 4 then 0.84
        when games_played > 0 then 0.72
        else 1.00
      end::numeric as availability_factor,
      case
        when position = 'RB' and age >= 30 then 0.88
        when position = 'RB' and age >= 28 then 0.93
        when position = 'RB' and age <= 23 then 1.03
        when position = 'WR' and age >= 32 then 0.91
        when position = 'WR' and age >= 30 then 0.95
        when position = 'WR' and age <= 23 then 1.03
        when position = 'TE' and age >= 33 then 0.92
        when position = 'TE' and age >= 31 then 0.96
        when position = 'TE' and age <= 24 then 1.02
        when position = 'QB' and age >= 38 then 0.90
        when position = 'QB' and age >= 35 then 0.96
        when position = 'QB' and age <= 24 then 1.02
        else 1.00
      end::numeric as age_factor,
      case when games_played = 0 and coalesce(years_exp, 0) <= 1 then 1.05 else 1.00 end::numeric as experience_factor,
      case assigned.position
        when 'QB' then case when effective_depth <= 1 then 410 when effective_depth = 2 then 235 when effective_depth = 3 then 120 else 65 end
        when 'RB' then case when effective_depth <= 1 then 340 when effective_depth = 2 then 235 when effective_depth = 3 then 175 when effective_depth = 4 then 125 else 80 end
        when 'WR' then case when effective_depth <= 1 then 330 when effective_depth = 2 then 255 when effective_depth = 3 then 205 when effective_depth = 4 then 160 when effective_depth <= 6 then 110 else 70 end
        when 'TE' then case when effective_depth <= 1 then 275 when effective_depth = 2 then 170 when effective_depth = 3 then 120 when effective_depth = 4 then 90 else 60 end
        when 'K' then case when effective_depth <= 1 then 190 when effective_depth = 2 then 60 else 30 end
      end::numeric as role_cap
    from role_assignment assigned
  ),
  projected_players as (
    select
      ingredients.*,
      round(
        least(
          role_cap,
          greatest(
            0,
            (
              (full_season_pace * production_weight)
              + (role_baseline * (1 - production_weight))
            )
            * availability_factor
            * age_factor
            * experience_factor
          )
        ),
        1
      ) as projected_points
    from projection_ingredients ingredients
  ),
  value_scored as (
    select
      projected.*,
      case projected.position
        when 'QB' then projected_points - 125
        when 'K' then projected_points - 115
        when 'TE' then projected_points + 10
        when 'WR' then projected_points - 5
        else projected_points
      end as draft_value_score
    from projected_players projected
  ),
  ranked_players as (
    select
      scored.*,
      (
        25 + row_number() over (
          order by draft_value_score desc, projected_points desc, player_name, sleeper_id
        )
      )::integer as overall_rank,
      (
        (
          select count(*)
          from public.ball_knower_fantasy_rankings top_player
          where top_player.season = 2026
            and top_player.scoring_format = 'ppr'
            and top_player.overall_rank <= 25
            and top_player.position = scored.position
        )
        + row_number() over (
          partition by position
          order by draft_value_score desc, projected_points desc, player_name, sleeper_id
        )
      )::integer as position_rank
    from value_scored scored
  )
  select
    player_key,
    player_name,
    team,
    position,
    overall_rank,
    position_rank,
    round(actual_points, 1)::numeric(6, 1) as actual_points_2025,
    projected_points::numeric(6, 1) as projected_points_2026,
    case
      when actual_points = 0 then format(
        '%s did not record a credited 2025 full-PPR total in the nflverse-derived weekly results. The 2026 estimate is role-based, using Sleeper''s current %s listing, age/experience and a %s baseline.',
        player_name,
        case when effective_depth <= 1 then 'starter' when effective_depth = 2 then 'second-unit' when effective_depth = 3 then 'third-unit' when effective_depth = 4 then 'fourth-unit' else 'reserve' end,
        position
      )
      when games_played < 12 then format(
        '%s scored %s full-PPR points in %s credited 2025 games. The 2026 estimate regresses that limited-sample pace toward the current %s role and adjusts for age, experience and expected availability.',
        player_name,
        round(actual_points, 1),
        games_played,
        case when effective_depth <= 1 then 'starter' when effective_depth = 2 then 'second-unit' when effective_depth = 3 then 'third-unit' when effective_depth = 4 then 'fourth-unit' else 'reserve' end
      )
      else format(
        '%s scored %s full-PPR points across %s credited games in 2025. The 2026 estimate blends that per-game production with the current %s role, age/experience and normal position regression.',
        player_name,
        round(actual_points, 1),
        games_played,
        case when effective_depth <= 1 then 'starter' when effective_depth = 2 then 'second-unit' when effective_depth = 3 then 'third-unit' when effective_depth = 4 then 'fourth-unit' else 'reserve' end
      )
    end as projection_reason,
    'nflverse-derived 2025 weekly PPR results'::text as actual_source_name,
    'https://github.com/NityaGehlot/nfl-data/tree/main/data/Stats/2025%20Season/2025%20Offense'::text as actual_source_url,
    'Ball Knower role regression model + Sleeper current depth charts'::text as projection_source_name,
    'https://docs.sleeper.com/'::text as projection_source_url,
    'Ball Knower full-player projection v1'::text as projection_model,
    now() as updated_at
  from ranked_players;

  delete from public.ball_knower_fantasy_rankings
  where season = 2026
    and scoring_format = 'ppr'
    and overall_rank > 25;

  insert into public.ball_knower_fantasy_rankings
    (
      player_key,
      season,
      scoring_format,
      player_name,
      team,
      position,
      overall_rank,
      position_rank,
      actual_points_2025,
      projected_points_2026,
      projection_reason,
      actual_source_name,
      actual_source_url,
      projection_source_name,
      projection_source_url,
      projection_model,
      updated_at
    )
  select
    generated.player_key,
    2026,
    'ppr',
    generated.player_name,
    generated.team,
    generated.position,
    generated.overall_rank,
    generated.position_rank,
    generated.actual_points_2025,
    generated.projected_points_2026,
    generated.projection_reason,
    generated.actual_source_name,
    generated.actual_source_url,
    generated.projection_source_name,
    generated.projection_source_url,
    generated.projection_model,
    generated.updated_at
  from bk_generated_fantasy_rankings generated
  order by generated.overall_rank
  on conflict (player_key, season, scoring_format) do update set
    player_name = excluded.player_name,
    team = excluded.team,
    position = excluded.position,
    overall_rank = excluded.overall_rank,
    position_rank = excluded.position_rank,
    actual_points_2025 = excluded.actual_points_2025,
    projected_points_2026 = excluded.projected_points_2026,
    projection_reason = excluded.projection_reason,
    actual_source_name = excluded.actual_source_name,
    actual_source_url = excluded.actual_source_url,
    projection_source_name = excluded.projection_source_name,
    projection_source_url = excluded.projection_source_url,
    projection_model = excluded.projection_model,
    updated_at = excluded.updated_at;

  select count(*)::integer
  into refreshed_count
  from public.ball_knower_fantasy_rankings
  where season = 2026
    and scoring_format = 'ppr';

  return refreshed_count;
end;
$$;

revoke all on function public.refresh_ball_knower_fantasy_rankings() from public, anon, authenticated;
grant execute on function public.refresh_ball_knower_fantasy_rankings() to service_role;

comment on function public.refresh_ball_knower_fantasy_rankings() is
  'Refreshes the 2026 full-PPR cheat sheet. Preserves editorial ranks 1-25, then ranks the active fantasy-relevant player pool using current Sleeper depth charts and nflverse-derived 2025 weekly PPR results.';

select public.refresh_ball_knower_fantasy_rankings();
