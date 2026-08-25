-- Final launch hardening for Trivia.
-- 1) Keep the generated-question fact registry structurally complete so a bad
--    delete/division edit cannot leave active questions with NULL answers.
-- 2) Allow an already-issued, still-valid attempt to be scored if moderation
--    deactivates its question after it was served.

create or replace function ball_knower_private.refresh_generated_trivia()
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

-- Existing attempts are authoritative receipts. A question becoming inactive only
-- prevents future selection; it must not invalidate a question already served.
create or replace function public.submit_ball_knower_trivia_answer(p_attempt_id bigint, p_selected_index integer)
returns table(is_correct boolean, correct_index integer, explanation text, xp_awarded integer, progression_recorded boolean)
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_attempt ball_knower_private.trivia_attempts%rowtype;
  v_question ball_knower_private.trivia_questions%rowtype;
  v_correct boolean;
  v_xp integer;
  v_event_type text;
  v_recorded boolean;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_selected_index not between 0 and 3 then raise exception 'Invalid answer index'; end if;

  select * into v_attempt
  from ball_knower_private.trivia_attempts
  where id=p_attempt_id and user_id=v_user
  for update;

  if v_attempt.id is null then raise exception 'Trivia attempt not found'; end if;
  if v_attempt.answered_at is not null then raise exception 'Trivia attempt already answered'; end if;
  if v_attempt.created_at < now() - interval '5 minutes' then raise exception 'Trivia attempt expired'; end if;

  select * into v_question
  from ball_knower_private.trivia_questions
  where id=v_attempt.question_id;

  if v_question.id is null then raise exception 'Trivia question unavailable'; end if;

  v_correct := p_selected_index=v_question.correct_index;
  v_xp := case v_question.tier when 'ROOKIE' then 15 when 'PRO' then 25 when 'ALL-PRO' then 40 else 60 end;
  if not v_correct then v_xp := 2; end if;
  v_event_type := case when v_correct and v_question.tier='HALL OF FAME' then 'trivia_hof_correct' when v_correct then 'trivia_correct' else 'trivia_wrong' end;

  update ball_knower_private.trivia_attempts
  set answered_at=now(),selected_index=p_selected_index,is_correct=v_correct
  where id=v_attempt.id;

  v_recorded := ball_knower_private.apply_progress_event(
    v_user,
    'trivia_attempt:'||v_attempt.id,
    v_event_type,
    'trivia',
    v_xp,
    case when v_correct then 1 else 0 end,
    jsonb_build_object('tier',v_question.tier,'question_key',v_question.question_key,'question_id',v_question.id)
  );

  is_correct := v_correct;
  correct_index := v_question.correct_index;
  explanation := v_question.explanation;
  xp_awarded := case when v_recorded then v_xp else 0 end;
  progression_recorded := v_recorded;
  return next;
end;
$$;

revoke all on function public.submit_ball_knower_trivia_answer(bigint,integer) from public, anon;
grant execute on function public.submit_ball_knower_trivia_answer(bigint,integer) to authenticated;

-- Verify the current fact registry before completing this migration.
select ball_knower_private.refresh_generated_trivia();
