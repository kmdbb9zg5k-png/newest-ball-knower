-- Fresh-install ordering guard.
-- Earlier same-day migrations define the materializer more than once. Keep the
-- final public-facing refresh path serialized AND registry-validated regardless
-- of which earlier implementation was most recently replaced lexically.

alter function ball_knower_private.refresh_generated_trivia_unlocked()
  rename to refresh_generated_trivia_materialize;

create or replace function ball_knower_private.refresh_generated_trivia_unlocked()
returns void
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
declare
  v_fact_count integer;
  v_bad_divisions integer;
begin
  select count(*) into v_fact_count
  from ball_knower_private.trivia_team_facts;

  select count(*) into v_bad_divisions
  from (
    select division
    from ball_knower_private.trivia_team_facts
    group by division
    having count(*) <> 4
  ) broken;

  if v_fact_count <> 32 or v_bad_divisions <> 0 then
    raise exception 'Trivia team facts must contain all 32 teams with exactly four teams per division';
  end if;

  perform ball_knower_private.refresh_generated_trivia_materialize();
end;
$$;

revoke all on function ball_knower_private.refresh_generated_trivia_unlocked() from public, anon, authenticated;
revoke all on function ball_knower_private.refresh_generated_trivia_materialize() from public, anon, authenticated;

-- Exercise the exact final serialized path during migration.
select ball_knower_private.refresh_generated_trivia();
