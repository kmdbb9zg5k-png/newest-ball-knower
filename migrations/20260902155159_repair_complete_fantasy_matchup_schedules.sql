-- All Matchups depends on a complete persisted regular-season calendar. Fill
-- only entirely missing weeks for completed drafts; preserve every existing
-- matchup, score, Draft Order Game receipt, and playoff result.

with league_inputs as materialized (
  select
    league.id,
    least(
      17,
      greatest(
        1,
        coalesce(
          nullif(league.settings ->> 'regularSeasonWeeks', '')::integer,
          nullif(league.settings ->> 'seasonGames', '')::integer,
          17
        )
      )
    ) as weeks,
    count(member.id)::integer as member_count,
    jsonb_agg(to_jsonb(member.id) order by member.created_at, member.id) as member_ids,
    coalesce(league.season_result -> 'games', '[]'::jsonb) as existing_games
  from public.ball_knower_leagues league
  join public.ball_knower_live_drafts draft
    on draft.league_id = league.id
   and draft.status = 'completed'
  join public.ball_knower_league_members member
    on member.league_id = league.id
  group by league.id
), rebuilt as (
  select
    input.id,
    (
      select coalesce(
        jsonb_agg(item order by
          coalesce(nullif(item ->> 'week', '')::integer, 999),
          item ->> 'id'
        ),
        '[]'::jsonb
      )
      from (
        select existing.item
        from jsonb_array_elements(input.existing_games) existing(item)

        union all

        select generated.item
        from jsonb_array_elements(
          ball_knower_private.build_fantasy_regular_schedule(
            input.member_ids,
            input.weeks
          )
        ) generated(item)
        where not exists (
          select 1
          from jsonb_array_elements(input.existing_games) saved(item)
          where nullif(saved.item ->> 'week', '')::integer
                = nullif(generated.item ->> 'week', '')::integer
            and saved.item ? 'homeMemberId'
            and saved.item ? 'awayMemberId'
            and not (saved.item ? 'playoffRound')
        )
      ) merged
    ) as games
  from league_inputs input
  where input.member_count >= 2
    and mod(input.member_count, 2) = 0
    and exists (
      select 1
      from generate_series(1, input.weeks) week_number
      where not exists (
        select 1
        from jsonb_array_elements(input.existing_games) saved(item)
        where nullif(saved.item ->> 'week', '')::integer = week_number
          and saved.item ? 'homeMemberId'
          and saved.item ? 'awayMemberId'
          and not (saved.item ? 'playoffRound')
      )
    )
)
update public.ball_knower_leagues league
set season_result = jsonb_set(
      coalesce(league.season_result, '{}'::jsonb),
      '{games}',
      rebuilt.games,
      true
    ),
    updated_at = clock_timestamp()
from rebuilt
where league.id = rebuilt.id;

do $validation$
declare
  bad_weeks integer;
begin
  with league_inputs as (
    select
      league.id,
      least(
        17,
        greatest(
          1,
          coalesce(
            nullif(league.settings ->> 'regularSeasonWeeks', '')::integer,
            nullif(league.settings ->> 'seasonGames', '')::integer,
            17
          )
        )
      ) as weeks,
      count(member.id)::integer as member_count,
      coalesce(league.season_result -> 'games', '[]'::jsonb) as games
    from public.ball_knower_leagues league
    join public.ball_knower_live_drafts draft
      on draft.league_id = league.id
     and draft.status = 'completed'
    join public.ball_knower_league_members member
      on member.league_id = league.id
    group by league.id
  ), game_rows as (
    select
      input.id,
      input.member_count,
      nullif(game.item ->> 'week', '')::integer as week_number,
      game.item ->> 'id' as game_id,
      game.item ->> 'homeMemberId' as home_member_id,
      game.item ->> 'awayMemberId' as away_member_id
    from league_inputs input
    cross join lateral jsonb_array_elements(input.games) game(item)
    where game.item ? 'homeMemberId'
      and game.item ? 'awayMemberId'
      and not (game.item ? 'playoffRound')
  ), week_checks as (
    select
      input.id,
      generated_week.week_number,
      input.member_count,
      count(distinct game.game_id) as game_count,
      count(distinct side.member_id) as scheduled_members
    from league_inputs input
    cross join lateral generate_series(1, input.weeks) generated_week(week_number)
    left join game_rows game
      on game.id = input.id
     and game.week_number = generated_week.week_number
    left join lateral (
      values (game.home_member_id), (game.away_member_id)
    ) side(member_id) on game.game_id is not null
    group by input.id, generated_week.week_number, input.member_count
  )
  select count(*) into bad_weeks
  from week_checks
  where game_count <> member_count / 2
     or scheduled_members <> member_count;

  if bad_weeks <> 0 then
    raise exception 'Completed fantasy drafts still contain % incomplete matchup weeks', bad_weeks;
  end if;
end;
$validation$;
