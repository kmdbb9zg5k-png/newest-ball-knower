-- Give historical Tank01 rows a permanent, one-to-one Ball Knower identity.
-- Historical box scores did not include positions, so automated matching is
-- deliberately limited to unique provider identities corroborated by the
-- current catalog (name + team) or by the fantasy projection catalog (unique
-- name + exact fantasy position). Same-name collisions fail closed.

create table if not exists ball_knower_private.player_provider_identities (
  provider_player_id text primary key,
  ball_knower_player_id text not null unique,
  canonical_name text not null,
  position text not null check (btrim(position) <> ''),
  match_method text not null check (
    match_method in (
      'existing_verified',
      'exact_name_team',
      'exact_name_fantasy_position',
      'live_catalog_identity'
    )
  ),
  verified_at timestamptz not null default clock_timestamp(),
  unique (provider_player_id, ball_knower_player_id)
);

comment on table ball_knower_private.player_provider_identities is
  'One-to-one Tank01 provider identity crosswalk. All attached player history must reference this registry.';

alter table ball_knower_private.player_provider_identities enable row level security;
revoke all on ball_knower_private.player_provider_identities from public, anon, authenticated;
grant all on ball_knower_private.player_provider_identities to service_role;

-- Preserve every identity that was already attached consistently. This also
-- registers all 32 D/ST identities before the foreign key is validated.
with provider_rows as (
  select
    provider_player_id,
    min(ball_knower_player_id) as ball_knower_player_id,
    min(player_name) as canonical_name,
    min(position) as position,
    count(distinct ball_knower_player_id) as player_id_count,
    count(distinct regexp_replace(lower(player_name), '[^a-z0-9]', '', 'g')) as name_count,
    count(distinct nullif(btrim(position), '')) as position_count
  from public.ball_knower_player_week_scores
  where ball_knower_player_id is not null
  group by provider_player_id
), player_rows as (
  select ball_knower_player_id, count(*) as provider_count
  from provider_rows
  where player_id_count = 1 and name_count = 1 and position_count = 1
  group by ball_knower_player_id
)
insert into ball_knower_private.player_provider_identities(
  provider_player_id,
  ball_knower_player_id,
  canonical_name,
  position,
  match_method
)
select
  provider.provider_player_id,
  provider.ball_knower_player_id,
  provider.canonical_name,
  provider.position,
  'existing_verified'
from provider_rows provider
join player_rows player using (ball_knower_player_id)
where provider.player_id_count = 1
  and provider.name_count = 1
  and provider.position_count = 1
  and player.provider_count = 1
on conflict do nothing;

with provider_identity as (
  select
    provider_player_id,
    min(regexp_replace(lower(player_name), '[^a-z0-9]', '', 'g')) as normalized_name,
    min(player_name) as canonical_name,
    count(distinct regexp_replace(lower(player_name), '[^a-z0-9]', '', 'g')) as name_count,
    array_agg(distinct case upper(team)
      when 'LA' then 'LAR'
      when 'WSH' then 'WAS'
      when 'JAC' then 'JAX'
      else upper(team)
    end) as teams
  from public.ball_knower_player_week_scores
  where ball_knower_player_id is null
    and nullif(btrim(provider_player_id), '') is not null
  group by provider_player_id
), providers as (
  select
    provider.*,
    count(*) over (partition by normalized_name) as same_name_provider_count
  from provider_identity provider
), catalog_identity as (
  select
    regexp_replace(lower(player_json ->> 'name'), '[^a-z0-9]', '', 'g') as normalized_name,
    count(distinct player_id) as player_id_count,
    min(player_id) as ball_knower_player_id,
    min(player_json ->> 'name') as canonical_name,
    min(player_json ->> 'position') as position,
    array_agg(distinct case upper(player_json ->> 'team')
      when 'LA' then 'LAR'
      when 'WSH' then 'WAS'
      when 'JAC' then 'JAX'
      else upper(player_json ->> 'team')
    end) as teams
  from ball_knower_private.draft_order_game_players
  where active
    and nullif(btrim(player_json ->> 'name'), '') is not null
  group by regexp_replace(lower(player_json ->> 'name'), '[^a-z0-9]', '', 'g')
), ranking_identity as (
  select
    regexp_replace(lower(player_name), '[^a-z0-9]', '', 'g') as normalized_name,
    count(distinct player_key) as ranking_count,
    count(distinct position) as position_count,
    min(position) as position
  from public.ball_knower_fantasy_rankings
  where season = 2026 and scoring_format = 'ppr'
  group by regexp_replace(lower(player_name), '[^a-z0-9]', '', 'g')
), candidates as (
  select
    provider.provider_player_id,
    catalog.ball_knower_player_id,
    catalog.canonical_name,
    catalog.position,
    case
      when provider.teams && catalog.teams then 'exact_name_team'
      else 'exact_name_fantasy_position'
    end as match_method
  from providers provider
  join catalog_identity catalog using (normalized_name)
  left join ranking_identity ranking using (normalized_name)
  where provider.name_count = 1
    and catalog.player_id_count = 1
    and nullif(btrim(catalog.position), '') is not null
    and (
      provider.teams && catalog.teams
      or (
        provider.same_name_provider_count = 1
        and catalog.position in ('QB', 'RB', 'WR', 'TE', 'K')
        and ranking.ranking_count = 1
        and ranking.position_count = 1
        and ranking.position = catalog.position
      )
    )
), verified_candidates as (
  select candidate.*
  from candidates candidate
  where 1 = (
    select count(*)
    from candidates other
    where other.ball_knower_player_id = candidate.ball_knower_player_id
  )
)
insert into ball_knower_private.player_provider_identities(
  provider_player_id,
  ball_knower_player_id,
  canonical_name,
  position,
  match_method
)
select
  provider_player_id,
  ball_knower_player_id,
  canonical_name,
  position,
  match_method
from verified_candidates
on conflict do nothing;

update public.ball_knower_player_week_scores score
set ball_knower_player_id = identity.ball_knower_player_id,
    position = identity.position,
    updated_at = clock_timestamp()
from ball_knower_private.player_provider_identities identity
where score.provider_player_id = identity.provider_player_id
  and (
    score.ball_knower_player_id is distinct from identity.ball_knower_player_id
    or nullif(btrim(score.position), '') is null
  );

create or replace function ball_knower_private.assign_player_provider_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  mapped ball_knower_private.player_provider_identities%rowtype;
  catalog record;
  normalized_row_name text := regexp_replace(lower(coalesce(new.player_name, '')), '[^a-z0-9]', '', 'g');
  normalized_row_team text := case upper(coalesce(new.team, ''))
    when 'LA' then 'LAR'
    when 'WSH' then 'WAS'
    when 'JAC' then 'JAX'
    else upper(coalesce(new.team, ''))
  end;
begin
  select * into mapped
  from ball_knower_private.player_provider_identities identity
  where identity.provider_player_id = new.provider_player_id;

  if found then
    if new.ball_knower_player_id is not null
       and new.ball_knower_player_id <> mapped.ball_knower_player_id then
      raise exception 'Provider player % is already bound to a different Ball Knower player', new.provider_player_id;
    end if;
    new.ball_knower_player_id := mapped.ball_knower_player_id;
    new.position := mapped.position;
    return new;
  end if;

  if new.ball_knower_player_id is null then
    return new;
  end if;

  if new.provider_player_id like 'DST:%' then
    if new.ball_knower_player_id <> 'dst-' || lower(split_part(new.provider_player_id, ':', 2))
       or normalized_row_team <> upper(split_part(new.provider_player_id, ':', 2)) then
      raise exception 'D/ST provider identity does not match its Ball Knower team identity';
    end if;
    new.position := 'DST';
  else
    select
      player.player_json ->> 'name' as player_name,
      player.player_json ->> 'team' as team,
      player.player_json ->> 'position' as position
    into catalog
    from ball_knower_private.draft_order_game_players player
    where player.player_id = new.ball_knower_player_id
      and player.active
    limit 1;

    if not found
       or regexp_replace(lower(coalesce(catalog.player_name, '')), '[^a-z0-9]', '', 'g') <> normalized_row_name
       or (case upper(coalesce(catalog.team, ''))
             when 'LA' then 'LAR'
             when 'WSH' then 'WAS'
             when 'JAC' then 'JAX'
             else upper(coalesce(catalog.team, ''))
           end) <> normalized_row_team then
      raise exception 'Unverified provider identity for Ball Knower player %', new.ball_knower_player_id;
    end if;
    new.position := catalog.position;
  end if;

  insert into ball_knower_private.player_provider_identities(
    provider_player_id,
    ball_knower_player_id,
    canonical_name,
    position,
    match_method
  ) values (
    new.provider_player_id,
    new.ball_knower_player_id,
    new.player_name,
    new.position,
    'live_catalog_identity'
  );

  return new;
end;
$function$;

revoke all on function ball_knower_private.assign_player_provider_identity()
  from public, anon, authenticated;
grant execute on function ball_knower_private.assign_player_provider_identity()
  to service_role;

drop trigger if exists assign_player_provider_identity
  on public.ball_knower_player_week_scores;
create trigger assign_player_provider_identity
before insert or update of provider_player_id, ball_knower_player_id, player_name, team, position
on public.ball_knower_player_week_scores
for each row execute function ball_knower_private.assign_player_provider_identity();

alter table public.ball_knower_player_week_scores
  drop constraint if exists ball_knower_player_week_scores_verified_identity_fkey;
alter table public.ball_knower_player_week_scores
  add constraint ball_knower_player_week_scores_verified_identity_fkey
  foreign key (provider_player_id, ball_knower_player_id)
  references ball_knower_private.player_provider_identities(
    provider_player_id,
    ball_knower_player_id
  )
  not valid;
alter table public.ball_knower_player_week_scores
  validate constraint ball_knower_player_week_scores_verified_identity_fkey;

do $validation$
begin
  if exists (
    select 1
    from public.ball_knower_player_week_scores score
    where score.ball_knower_player_id is not null
      and not exists (
        select 1
        from ball_knower_private.player_provider_identities identity
        where identity.provider_player_id = score.provider_player_id
          and identity.ball_knower_player_id = score.ball_knower_player_id
          and identity.position = score.position
      )
  ) then
    raise exception 'Player history contains an attachment outside the verified provider registry';
  end if;

  if exists (
    select 1
    from ball_knower_private.player_provider_identities identity
    join ball_knower_private.draft_order_game_players player
      on player.player_id = identity.ball_knower_player_id
    where identity.match_method <> 'existing_verified'
      and regexp_replace(lower(player.player_json ->> 'name'), '[^a-z0-9]', '', 'g')
          <> regexp_replace(lower(identity.canonical_name), '[^a-z0-9]', '', 'g')
  ) then
    raise exception 'Verified provider identity does not match its catalog player';
  end if;
end;
$validation$;
