-- Final concurrency/lifecycle guardrails for generated trivia facts.
-- Fact abbreviations are part of stable generated question keys, so changing one
-- would strand old active rows. Keep abbreviations immutable and serialize all
-- generated-bank refreshes before the refresh function reads the fact registry.

alter function ball_knower_private.refresh_generated_trivia() rename to refresh_generated_trivia_unlocked;

create or replace function ball_knower_private.refresh_generated_trivia()
returns void
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('ball_knower:trivia-fact-refresh', 0));
  perform ball_knower_private.refresh_generated_trivia_unlocked();
end;
$$;

revoke all on function ball_knower_private.refresh_generated_trivia() from public, anon, authenticated;
revoke all on function ball_knower_private.refresh_generated_trivia_unlocked() from public, anon, authenticated;

create or replace function ball_knower_private.prevent_trivia_fact_abbr_change()
returns trigger
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
begin
  if new.abbr is distinct from old.abbr then
    raise exception 'Trivia team abbreviation is immutable; update the existing fact fields instead';
  end if;
  return new;
end;
$$;

revoke all on function ball_knower_private.prevent_trivia_fact_abbr_change() from public, anon, authenticated;

drop trigger if exists trivia_team_facts_abbr_immutable on ball_knower_private.trivia_team_facts;
create trigger trivia_team_facts_abbr_immutable
before update of abbr on ball_knower_private.trivia_team_facts
for each row execute function ball_knower_private.prevent_trivia_fact_abbr_change();

-- Exercise the serialized wrapper once during migration so an invalid registry
-- fails here rather than later during a production fact update.
select ball_knower_private.refresh_generated_trivia();
