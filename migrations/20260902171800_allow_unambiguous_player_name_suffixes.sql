-- Tank01 sometimes includes generational suffixes that the canonical Ball
-- Knower catalog omits. Accept that spelling difference only when the
-- suffix-free name and team identify exactly one active catalog player.

create or replace function ball_knower_private.normalized_player_identity_name(
  p_value text
)
returns text
language sql
immutable
set search_path = ''
as $function$
  select regexp_replace(
    regexp_replace(
      lower(coalesce(p_value, '')),
      '(^|[^a-z0-9])(jr|sr|ii|iii|iv)([^a-z0-9]|$)',
      '\1\3',
      'g'
    ),
    '[^a-z0-9]',
    '',
    'g'
  )
$function$;

revoke all on function ball_knower_private.normalized_player_identity_name(text)
  from public, anon, authenticated;
grant execute on function ball_knower_private.normalized_player_identity_name(text)
  to service_role;

create or replace function ball_knower_private.assign_player_provider_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  mapped ball_knower_private.player_provider_identities%rowtype;
  catalog record;
  catalog_found boolean := false;
  catalog_match_count integer := 0;
  normalized_row_name text :=
    ball_knower_private.normalized_player_identity_name(new.player_name);
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
    catalog_found := found;

    select count(*)
    into catalog_match_count
    from ball_knower_private.draft_order_game_players player
    where player.active
      and ball_knower_private.normalized_player_identity_name(
        player.player_json ->> 'name'
      ) = normalized_row_name
      and (case upper(coalesce(player.player_json ->> 'team', ''))
             when 'LA' then 'LAR'
             when 'WSH' then 'WAS'
             when 'JAC' then 'JAX'
             else upper(coalesce(player.player_json ->> 'team', ''))
           end) = normalized_row_team;

    if not catalog_found
       or ball_knower_private.normalized_player_identity_name(
            catalog.player_name
          ) <> normalized_row_name
       or (case upper(coalesce(catalog.team, ''))
             when 'LA' then 'LAR'
             when 'WSH' then 'WAS'
             when 'JAC' then 'JAX'
             else upper(coalesce(catalog.team, ''))
           end) <> normalized_row_team
       or catalog_match_count <> 1 then
      raise exception 'Unverified or ambiguous provider identity for Ball Knower player %', new.ball_knower_player_id;
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
