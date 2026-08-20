-- Make commissioner weekly injury generation transactional and idempotent.
-- A given league/week can be generated at most once, and retries return the
-- already-persisted report instead of creating duplicate injuries.

create table if not exists public.ball_knower_injury_rolls (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.ball_knower_leagues(id) on delete cascade,
  week_number integer not null check (week_number between 1 and 18),
  generated_count integer not null default 0,
  generated_by uuid not null,
  created_at timestamptz not null default now(),
  unique (league_id, week_number)
);

alter table public.ball_knower_injury_rolls enable row level security;

revoke all on public.ball_knower_injury_rolls from anon;
revoke insert, update, delete on public.ball_knower_injury_rolls from authenticated;
grant select on public.ball_knower_injury_rolls to authenticated;

drop policy if exists bk_injury_rolls_league_read on public.ball_knower_injury_rolls;
create policy bk_injury_rolls_league_read
on public.ball_knower_injury_rolls
for select
to authenticated
using (
  exists (
    select 1
    from public.ball_knower_league_members member
    where member.league_id = ball_knower_injury_rolls.league_id
      and member.auth_user_id = (select auth.uid())
  )
);

create or replace function public.generate_ball_knower_weekly_injuries(
  p_league_id uuid,
  p_week_number integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_auth uuid := auth.uid();
  v_existing public.ball_knower_injury_rolls%rowtype;
  v_roll_id uuid;
  v_created integer := 0;
  v_member record;
  v_player jsonb;
  v_severity text;
  v_weeks integer;
begin
  if v_auth is null then
    raise exception 'Authentication required.';
  end if;

  if p_week_number < 1 or p_week_number > 18 then
    raise exception 'Week number must be between 1 and 18.';
  end if;

  if not exists (
    select 1
    from public.ball_knower_leagues league
    where league.id = p_league_id
      and league.commissioner_auth_id = v_auth
  ) then
    raise exception 'Only the league commissioner can generate weekly injuries.';
  end if;

  if exists (
    select 1
    from public.ball_knower_leagues league
    where league.id = p_league_id
      and coalesce((league.settings->>'injuriesEnabled')::boolean, true) = false
  ) then
    raise exception 'Injuries are disabled in league settings.';
  end if;

  select * into v_existing
  from public.ball_knower_injury_rolls
  where league_id = p_league_id
    and week_number = p_week_number;

  if found then
    return jsonb_build_object(
      'week', v_existing.week_number,
      'created', v_existing.generated_count,
      'reused', true
    );
  end if;

  insert into public.ball_knower_injury_rolls (
    league_id, week_number, generated_by
  ) values (
    p_league_id, p_week_number, v_auth
  )
  on conflict (league_id, week_number) do nothing
  returning id into v_roll_id;

  if v_roll_id is null then
    select * into v_existing
    from public.ball_knower_injury_rolls
    where league_id = p_league_id
      and week_number = p_week_number;

    return jsonb_build_object(
      'week', v_existing.week_number,
      'created', v_existing.generated_count,
      'reused', true
    );
  end if;

  for v_member in
    select id, roster
    from public.ball_knower_league_members
    where league_id = p_league_id
      and jsonb_array_length(coalesce(roster, '[]'::jsonb)) > 0
  loop
    if random() > 0.22 then
      continue;
    end if;

    select player into v_player
    from jsonb_array_elements(coalesce(v_member.roster, '[]'::jsonb)) as player
    order by random()
    limit 1;

    if v_player is null or nullif(v_player->>'id', '') is null then
      continue;
    end if;

    if random() > 0.97 then
      v_severity := 'season_ending';
      v_weeks := 17;
    elsif random() > 0.82 then
      v_severity := 'major';
      v_weeks := 4;
    elsif random() > 0.50 then
      v_severity := 'moderate';
      v_weeks := 2;
    else
      v_severity := 'minor';
      v_weeks := 1;
    end if;

    insert into public.ball_knower_injuries (
      league_id,
      member_id,
      player_id,
      player_name,
      injury_type,
      severity,
      weeks_remaining,
      on_ir,
      status
    ) values (
      p_league_id,
      v_member.id,
      v_player->>'id',
      coalesce(nullif(v_player->>'name', ''), 'Unknown Player'),
      case when v_severity = 'season_ending' then 'Season-ending injury' else 'Game injury' end,
      v_severity,
      v_weeks,
      v_severity = 'season_ending',
      case when v_severity = 'season_ending' then 'ir' else 'out' end
    );

    v_created := v_created + 1;
  end loop;

  update public.ball_knower_injury_rolls
  set generated_count = v_created
  where id = v_roll_id;

  return jsonb_build_object(
    'week', p_week_number,
    'created', v_created,
    'reused', false
  );
end;
$function$;

revoke all on function public.generate_ball_knower_weekly_injuries(uuid, integer) from public;
grant execute on function public.generate_ball_knower_weekly_injuries(uuid, integer) to authenticated;
