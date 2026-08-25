-- Final launch boundary for Trivia.
-- This migration intentionally sorts after the earlier z/zz/zzz hardening passes.
-- It keeps one live attempt per user, uses serialized insertion history for repeat
-- suppression, strengthens Hall of Fame generated questions, and validates the
-- private 32-team fact registry before future refreshes can materialize bad data.

-- Clean up abandoned duplicate attempts from older clients while preserving the
-- newest still-valid unanswered attempt for each user.
with open_attempts as (
  select id,
         created_at,
         row_number() over(partition by user_id order by id desc) as rn
  from ball_knower_private.trivia_attempts
  where answered_at is null
)
update ball_knower_private.trivia_attempts a
set answered_at = clock_timestamp()
from open_attempts o
where a.id=o.id
  and (o.rn>1 or o.created_at < clock_timestamp()-interval '5 minutes');

create unique index if not exists trivia_attempts_one_open_per_user_idx
  on ball_knower_private.trivia_attempts(user_id)
  where answered_at is null;

create index if not exists trivia_attempts_user_recent_id_idx
  on ball_knower_private.trivia_attempts(user_id,id desc);

-- Validate structural identities as well as counts. A registry row such as
-- conference=NFC, division=AFC East must never publish a scored question.
create or replace function ball_knower_private.validate_trivia_team_fact_registry()
returns void
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
declare
  v_fact_count integer;
  v_division_count integer;
  v_bad_divisions integer;
  v_bad_identity integer;
begin
  select count(*),count(distinct division)
  into v_fact_count,v_division_count
  from ball_knower_private.trivia_team_facts;

  select count(*) into v_bad_divisions
  from (
    select division
    from ball_knower_private.trivia_team_facts
    group by division
    having count(*)<>4
  ) broken;

  select count(*) into v_bad_identity
  from ball_knower_private.trivia_team_facts
  where division not in (
      'AFC East','AFC North','AFC South','AFC West',
      'NFC East','NFC North','NFC South','NFC West'
    )
    or split_part(division,' ',1)<>conference;

  if v_fact_count<>32 or v_division_count<>8 or v_bad_divisions<>0 or v_bad_identity<>0 then
    raise exception 'Trivia team facts must contain the canonical eight NFL divisions, four teams per division, with matching conferences';
  end if;
end;
$$;
revoke all on function ball_knower_private.validate_trivia_team_fact_registry() from public, anon, authenticated;

create or replace function ball_knower_private.validate_trivia_team_fact_registry_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
begin
  perform ball_knower_private.validate_trivia_team_fact_registry();
  return null;
end;
$$;
revoke all on function ball_knower_private.validate_trivia_team_fact_registry_trigger() from public, anon, authenticated;

drop trigger if exists trivia_team_facts_validate_registry on ball_knower_private.trivia_team_facts;
create trigger trivia_team_facts_validate_registry
after insert or update or delete on ball_knower_private.trivia_team_facts
for each statement execute function ball_knower_private.validate_trivia_team_fact_registry_trigger();

select ball_knower_private.validate_trivia_team_fact_registry();

-- Preserve all previous generated-question cleanup, then upgrade the two Hall of
-- Fame families that were still too close to Rookie/Pro material.
alter function ball_knower_private.finalize_generated_trivia_quality()
  rename to finalize_generated_trivia_quality_base;

create or replace function ball_knower_private.finalize_generated_trivia_quality()
returns void
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
begin
  perform ball_knower_private.finalize_generated_trivia_quality_base();

  -- Hall of Fame completion now requires knowing three divisional starting QBs
  -- and identifying the fourth, rather than merely recognizing four team names.
  with facts as (
    select f.*,
      row_number() over(order by f.abbr)::int as n,
      array(select x.starting_qb from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) as mate_qbs,
      array(select x.starting_qb from ball_knower_private.trivia_team_facts x where x.conference=f.conference and x.division<>f.division order by x.abbr) as other_qbs
    from ball_knower_private.trivia_team_facts f
  )
  update ball_knower_private.trivia_questions q
  set question='Three listed 2026 starting quarterbacks in the '||f.division||' are '||f.mate_qbs[1]||', '||f.mate_qbs[2]||', and '||f.mate_qbs[3]||'. Which quarterback completes the division?',
      answers=ball_knower_private.trivia_choices4(
        f.starting_qb,
        f.other_qbs[1+mod(f.n,12)],
        f.other_qbs[1+mod(f.n+3,12)],
        f.other_qbs[1+mod(f.n+6,12)],
        f.n+7
      ),
      correct_index=mod(abs(f.n+7),4)::smallint,
      explanation=f.starting_qb||' is listed as the 2026 starter for the '||f.team_name||', completing the '||f.division||' starter group.',
      repeat_family='hall-complete:'||lower(replace(f.division,' ','-'))
  from facts f
  where q.question_key='gen_h_complete_'||lower(f.abbr);

  -- Hall of Fame elimination becomes a multi-fact team/QB mismatch test. Three
  -- pairings are canonical; one division rival is deliberately paired with an
  -- outside quarterback. Serve-time answer shuffling keeps the slot unpredictable.
  with facts as (
    select f.*,
      row_number() over(order by f.abbr)::int as n,
      array(select x.team_name from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) as mate_teams,
      array(select x.starting_qb from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) as mate_qbs,
      array(select x.starting_qb from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr) as outside_qbs
    from ball_knower_private.trivia_team_facts f
  )
  update ball_knower_private.trivia_questions q
  set question='Three of these 2026 team-quarterback pairings are correct. Which pairing is mismatched?',
      answers=ball_knower_private.trivia_choices4(
        f.mate_teams[3]||' — '||f.outside_qbs[1+mod(f.n,28)],
        f.team_name||' — '||f.starting_qb,
        f.mate_teams[1]||' — '||f.mate_qbs[1],
        f.mate_teams[2]||' — '||f.mate_qbs[2],
        f.n+11
      ),
      correct_index=mod(abs(f.n+11),4)::smallint,
      explanation=f.mate_teams[3]||' is listed with '||f.mate_qbs[3]||', not the quarterback shown in the mismatched pairing.',
      repeat_family='hall-elimination:'||lower(replace(f.division,' ','-'))
  from facts f
  where q.question_key='gen_h_elim_'||lower(f.abbr);
end;
$$;
revoke all on function ball_knower_private.finalize_generated_trivia_quality() from public, anon, authenticated;
revoke all on function ball_knower_private.finalize_generated_trivia_quality_base() from public, anon, authenticated;

select ball_knower_private.finalize_generated_trivia_quality();

-- Final server-owned question selection. The advisory lock and partial unique
-- index guarantee at most one live attempt. Exact-question history stays
-- tier-local while a shorter global family window prevents an equivalent fact
-- from appearing immediately after a user switches difficulty.
create or replace function public.get_ball_knower_trivia_question(p_tier text)
returns table(attempt_id bigint, question_id bigint, tier text, question text, answers jsonb)
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_question ball_knower_private.trivia_questions%rowtype;
  v_answer_order integer[];
  v_served_answers jsonb;
  v_served_correct smallint;
  v_last_family text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_tier not in ('ROOKIE','PRO','ALL-PRO','HALL OF FAME') then raise exception 'Invalid trivia tier'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));

  -- A new request supersedes any previous unanswered request from this user.
  -- That closes the answer-reveal/farm path created by dozens of parallel live attempts.
  update ball_knower_private.trivia_attempts
  set answered_at=clock_timestamp()
  where user_id=v_user and answered_at is null;

  select coalesce(seen.repeat_family,seen.question_key)
  into v_last_family
  from ball_knower_private.trivia_attempts a
  join ball_knower_private.trivia_questions seen on seen.id=a.question_id
  where a.user_id=v_user
  order by a.id desc
  limit 1;

  select q.* into v_question
  from ball_knower_private.trivia_questions q
  where q.active
    and q.tier=p_tier
    and not exists (
      select 1
      from (
        select a.question_id
        from ball_knower_private.trivia_attempts a
        join ball_knower_private.trivia_questions seen on seen.id=a.question_id
        where a.user_id=v_user
          and coalesce(a.served_tier,seen.tier)=p_tier
        order by a.id desc
        limit 50
      ) recent
      where recent.question_id=q.id
    )
    and not exists (
      select 1
      from (
        select coalesce(seen.repeat_family,seen.question_key) as family
        from ball_knower_private.trivia_attempts a
        join ball_knower_private.trivia_questions seen on seen.id=a.question_id
        where a.user_id=v_user
        order by a.id desc
        limit 20
      ) recent_family
      where recent_family.family=coalesce(q.repeat_family,q.question_key)
    )
  order by random()
  limit 1;

  if v_question.id is null then
    select q.* into v_question
    from ball_knower_private.trivia_questions q
    where q.active and q.tier=p_tier
      and q.id is distinct from (
        select a.question_id
        from ball_knower_private.trivia_attempts a
        join ball_knower_private.trivia_questions seen on seen.id=a.question_id
        where a.user_id=v_user and coalesce(a.served_tier,seen.tier)=p_tier
        order by a.id desc
        limit 1
      )
      and coalesce(q.repeat_family,q.question_key) is distinct from v_last_family
    order by random()
    limit 1;
  end if;

  if v_question.id is null then
    select q.* into v_question
    from ball_knower_private.trivia_questions q
    where q.active and q.tier=p_tier
    order by random()
    limit 1;
  end if;
  if v_question.id is null then raise exception 'No active question available'; end if;

  select array_agg(original_index order by sort_key),jsonb_agg(answer_value order by sort_key)
  into v_answer_order,v_served_answers
  from (
    select (choice.ordinality-1)::integer as original_index,
           choice.value as answer_value,
           random() as sort_key
    from jsonb_array_elements(v_question.answers) with ordinality as choice(value,ordinality)
  ) shuffled;

  select (u.ordinality-1)::smallint into v_served_correct
  from unnest(v_answer_order) with ordinality as u(original_index,ordinality)
  where u.original_index=v_question.correct_index;

  if jsonb_array_length(v_served_answers)<>4 or v_served_correct is null then
    raise exception 'Trivia question answer data is invalid';
  end if;

  insert into ball_knower_private.trivia_attempts(
    user_id,question_id,served_answers,served_correct_index,served_explanation,served_tier
  ) values (
    v_user,v_question.id,v_served_answers,v_served_correct,v_question.explanation,v_question.tier
  ) returning id into attempt_id;

  question_id:=v_question.id;
  tier:=v_question.tier;
  question:=v_question.question;
  answers:=v_served_answers;
  return next;
end;
$$;

revoke all on function public.get_ball_knower_trivia_question(text) from public, anon;
grant execute on function public.get_ball_knower_trivia_question(text) to authenticated;
