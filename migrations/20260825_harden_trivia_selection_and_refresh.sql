-- Serialize per-user trivia selection so duplicate/concurrent requests cannot receive
-- the same question before either request records its attempt. Also keep generated
-- team/QB questions synchronized whenever the private fact registry changes.

create or replace function ball_knower_private.refresh_generated_trivia()
returns void
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
begin
  with facts as (
    select f.*,
      row_number() over(order by f.abbr)::int as n,
      array(select x.team_name from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) as mate_teams,
      array(select x.starting_qb from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) as mate_qbs,
      array(select distinct x.division from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.division limit 3) as other_divisions
    from ball_knower_private.trivia_team_facts f
  ),
  generated as (
    select 'gen_r_abbr_'||lower(abbr) key,'ROOKIE' tier,
      'Which NFL team uses the abbreviation '||abbr||'?' question,
      ball_knower_private.trivia_choices4(team_name,mate_teams[1],mate_teams[2],mate_teams[3],n) answers,
      mod(abs(n),4)::smallint correct_index,
      abbr||' is the abbreviation for the '||team_name||'.' explanation from facts
    union all
    select 'gen_r_teamabbr_'||lower(abbr),'ROOKIE',
      'What is the standard abbreviation for the '||team_name||'?',
      ball_knower_private.trivia_choices4(abbr,
        (select x.abbr from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr limit 1),
        (select x.abbr from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr offset 1 limit 1),
        (select x.abbr from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr offset 2 limit 1),n+1),
      mod(abs(n+1),4)::smallint,
      'The '||team_name||' use the abbreviation '||abbr||'.' from facts f
    union all
    select 'gen_r_qbteam_'||lower(abbr),'ROOKIE',
      'Which team is listed with '||starting_qb||' as its 2026 starting quarterback?',
      ball_knower_private.trivia_choices4(team_name,mate_teams[1],mate_teams[2],mate_teams[3],n+2),
      mod(abs(n+2),4)::smallint,
      starting_qb||' is listed as the 2026 starter for the '||team_name||'.' from facts
    union all
    select 'gen_r_divmember_'||lower(abbr),'ROOKIE',
      'Which of these teams plays in the '||division||'?',
      ball_knower_private.trivia_choices4(team_name,
        (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 1),
        (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr offset 7 limit 1),
        (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr offset 14 limit 1),n+3),
      mod(abs(n+3),4)::smallint,
      'The '||team_name||' play in the '||division||'.' from facts f

    union all
    select 'gen_p_div_'||lower(abbr),'PRO',
      'Which division do the '||team_name||' play in?',
      ball_knower_private.trivia_choices4(division,other_divisions[1],other_divisions[2],other_divisions[3],n),
      mod(abs(n),4)::smallint,
      'The '||team_name||' are in the '||division||'.' from facts
    union all
    select 'gen_p_starter_'||lower(abbr),'PRO',
      'Who is listed as the '||team_name||''' 2026 starting quarterback?',
      ball_knower_private.trivia_choices4(starting_qb,mate_qbs[1],mate_qbs[2],mate_qbs[3],n+1),
      mod(abs(n+1),4)::smallint,
      starting_qb||' is listed as the 2026 starter for the '||team_name||'.' from facts
    union all
    select 'gen_p_qbclub_'||lower(abbr),'PRO',
      starting_qb||' is listed as the 2026 starting quarterback for which club?',
      ball_knower_private.trivia_choices4(team_name,mate_teams[1],mate_teams[2],mate_teams[3],n+2),
      mod(abs(n+2),4)::smallint,
      starting_qb||' is listed with the '||team_name||'.' from facts
    union all
    select 'gen_p_divrival_'||lower(abbr),'PRO',
      'Which team is a division rival of the '||team_name||'?',
      ball_knower_private.trivia_choices4(mate_teams[1],
        (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 1),
        (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr offset 8 limit 1),
        (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr offset 15 limit 1),n+3),
      mod(abs(n+3),4)::smallint,
      mate_teams[1]||' and the '||team_name||' share the '||division||'.' from facts f

    union all
    select 'gen_ap_clue_'||lower(abbr),'ALL-PRO',
      'Which '||division||' team is listed with '||starting_qb||' as its 2026 starting quarterback?',
      ball_knower_private.trivia_choices4(team_name,mate_teams[1],mate_teams[2],mate_teams[3],n),
      mod(abs(n),4)::smallint,
      'That combination points to the '||team_name||'.' from facts
    union all
    select 'gen_ap_qbdiv_'||lower(abbr),'ALL-PRO',
      'Which quarterback is listed as a 2026 starter in the '||division||' for the '||team_name||'?',
      ball_knower_private.trivia_choices4(starting_qb,mate_qbs[1],mate_qbs[2],mate_qbs[3],n+1),
      mod(abs(n+1),4)::smallint,
      starting_qb||' is the listed starter for the '||team_name||'.' from facts
    union all
    select 'gen_ap_divpair_'||lower(abbr),'ALL-PRO',
      'The '||team_name||' and '||mate_teams[1]||' are both members of which division?',
      ball_knower_private.trivia_choices4(division,other_divisions[1],other_divisions[2],other_divisions[3],n+2),
      mod(abs(n+2),4)::smallint,
      'Both clubs are members of the '||division||'.' from facts
    union all
    select 'gen_ap_confdiv_'||lower(abbr),'ALL-PRO',
      'Which team matches all three clues: '||conference||', '||division||', and starting quarterback '||starting_qb||'?',
      ball_knower_private.trivia_choices4(team_name,mate_teams[1],mate_teams[2],mate_teams[3],n+3),
      mod(abs(n+3),4)::smallint,
      'The clues identify the '||team_name||'.' from facts

    union all
    select 'gen_h_complete_'||lower(abbr),'HALL OF FAME',
      'Which team completes this '||division||' group: '||mate_teams[1]||', '||mate_teams[2]||', '||mate_teams[3]||', and ___?',
      ball_knower_private.trivia_choices4(team_name,
        (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 1),
        (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr offset 9 limit 1),
        (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr offset 17 limit 1),n),
      mod(abs(n),4)::smallint,
      'The fourth member of that '||division||' set is the '||team_name||'.' from facts f
    union all
    select 'gen_h_match_'||lower(abbr),'HALL OF FAME',
      'Which team/division/quarterback combination is correct for 2026?',
      ball_knower_private.trivia_choices4(team_name||' — '||division||' — '||starting_qb,
        mate_teams[1]||' — '||division||' — '||starting_qb,
        team_name||' — '||other_divisions[1]||' — '||mate_qbs[1],
        mate_teams[2]||' — '||other_divisions[2]||' — '||mate_qbs[2],n+1),
      mod(abs(n+1),4)::smallint,
      team_name||' — '||division||' — '||starting_qb||' is the correct match.' from facts
    union all
    select 'gen_h_elim_'||lower(abbr),'HALL OF FAME',
      'Three of these clubs are '||division||' rivals. Which club is the outsider?',
      ball_knower_private.trivia_choices4(
        (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 1),
        team_name,mate_teams[1],mate_teams[2],n+2),
      mod(abs(n+2),4)::smallint,
      'The '||team_name||', '||mate_teams[1]||', and '||mate_teams[2]||' are in the '||division||'; the other club is not.' from facts f
    union all
    select 'gen_h_reverse_'||lower(abbr),'HALL OF FAME',
      'Identify the team from this 2026 profile: abbreviation '||abbr||', division '||division||', starter '||starting_qb||'.',
      ball_knower_private.trivia_choices4(team_name,mate_teams[1],mate_teams[2],mate_teams[3],n+3),
      mod(abs(n+3),4)::smallint,
      'Those three clues identify the '||team_name||'.' from facts
  )
  insert into ball_knower_private.trivia_questions(question_key,tier,question,answers,correct_index,explanation)
  select key,tier,question,answers,correct_index,explanation
  from generated
  on conflict(question_key) do update set
    tier=excluded.tier,
    question=excluded.question,
    answers=excluded.answers,
    correct_index=excluded.correct_index,
    explanation=excluded.explanation;
end;
$$;
revoke all on function ball_knower_private.refresh_generated_trivia() from public, anon, authenticated;

create or replace function ball_knower_private.trivia_team_facts_refresh_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
begin
  perform ball_knower_private.refresh_generated_trivia();
  return null;
end;
$$;
revoke all on function ball_knower_private.trivia_team_facts_refresh_trigger() from public, anon, authenticated;

drop trigger if exists trivia_team_facts_refresh_questions on ball_knower_private.trivia_team_facts;
create trigger trivia_team_facts_refresh_questions
after insert or update or delete on ball_knower_private.trivia_team_facts
for each statement execute function ball_knower_private.trivia_team_facts_refresh_trigger();

-- Bring every currently materialized generated row in sync now, while preserving
-- each question's existing active/inactive moderation state.
select ball_knower_private.refresh_generated_trivia();

create or replace function public.get_ball_knower_trivia_question(p_tier text)
returns table(attempt_id bigint, question_id bigint, tier text, question text, answers jsonb)
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_question ball_knower_private.trivia_questions%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_tier not in ('ROOKIE','PRO','ALL-PRO','HALL OF FAME') then raise exception 'Invalid trivia tier'; end if;

  -- Prevent two simultaneous RPCs for one user from selecting from the same
  -- pre-insert history snapshot. The lock is released automatically at commit.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  select q.* into v_question
  from ball_knower_private.trivia_questions q
  where q.active
    and q.tier = p_tier
    and not exists (
      select 1
      from (
        select a.question_id
        from ball_knower_private.trivia_attempts a
        where a.user_id = v_user
        order by a.created_at desc
        limit 50
      ) recent
      where recent.question_id = q.id
    )
  order by random()
  limit 1;

  if v_question.id is null then
    select q.* into v_question
    from ball_knower_private.trivia_questions q
    where q.active and q.tier = p_tier
      and q.id is distinct from (
        select a.question_id
        from ball_knower_private.trivia_attempts a
        where a.user_id = v_user
        order by a.created_at desc
        limit 1
      )
    order by random()
    limit 1;
  end if;

  if v_question.id is null then
    select q.* into v_question
    from ball_knower_private.trivia_questions q
    where q.active and q.tier = p_tier
    order by random()
    limit 1;
  end if;

  if v_question.id is null then raise exception 'No active question available'; end if;
  insert into ball_knower_private.trivia_attempts(user_id,question_id)
    values(v_user,v_question.id) returning id into attempt_id;
  question_id := v_question.id;
  tier := v_question.tier;
  question := v_question.question;
  answers := v_question.answers;
  return next;
end;
$$;
revoke all on function public.get_ball_knower_trivia_question(text) from public, anon;
grant execute on function public.get_ball_knower_trivia_question(text) to authenticated;
