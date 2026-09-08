-- Keep scored 2026 Trivia facts aligned with the app's canonical starter registry.
-- The existing statement trigger rebuilds every generated team/QB question after
-- this update; the explicit finalizer makes the intended regeneration clear and
-- keeps this migration safe if an older environment is missing that trigger.

update ball_knower_private.trivia_team_facts
set starting_qb = 'Tua Tagovailoa'
where abbr = 'ATL'
  and starting_qb is distinct from 'Tua Tagovailoa';

do $$
begin
  if not exists (
    select 1
    from ball_knower_private.trivia_team_facts
    where abbr = 'ATL'
      and starting_qb = 'Tua Tagovailoa'
  ) then
    raise exception 'Atlanta Trivia quarterback fact did not match the canonical 2026 starter registry';
  end if;

  perform ball_knower_private.validate_trivia_team_fact_registry();
  perform ball_knower_private.finalize_generated_trivia_quality();
end;
$$;
