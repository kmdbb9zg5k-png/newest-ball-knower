-- Final launch-quality trivia hardening. This migration intentionally sorts last.
-- It snapshots served answers per attempt, randomizes answer order at serve time,
-- suppresses equivalent question families, repairs post-seed quality, and keeps
-- generated distractors meaningful after fact refreshes.

alter table ball_knower_private.trivia_attempts
  add column if not exists served_answers jsonb,
  add column if not exists served_correct_index smallint,
  add column if not exists served_explanation text,
  add column if not exists served_tier text;

alter table ball_knower_private.trivia_questions
  add column if not exists repeat_family text;

-- Preserve the exact key shown to any currently open attempt before changing
-- stored answer order or generated distractors below.
update ball_knower_private.trivia_attempts a
set served_answers = q.answers,
    served_correct_index = q.correct_index,
    served_explanation = q.explanation,
    served_tier = q.tier
from ball_knower_private.trivia_questions q
where a.question_id = q.id
  and a.answered_at is null
  and a.created_at >= now() - interval '5 minutes'
  and a.served_answers is null;

-- Corrections must run after every seed/expansion migration on a clean install.
update ball_knower_private.trivia_questions
set question = 'On a basic inside-zone read, which defender is commonly left unblocked for the quarterback to read?',
    answers = '["Backside/read-side edge defender","Free safety","Nose tackle","Boundary corner"]'::jsonb,
    correct_index = 0,
    explanation = 'On a basic inside-zone read, the quarterback commonly reads the backside/read-side edge defender while the line blocks zone away from him.'
where question_key = 'pro_zone_read_edge';

update ball_knower_private.trivia_questions
set active = false
where question_key = 'hof_flipper_336';

-- Rotate the manual bank one final time after all manual seed files have run.
-- Serve-time randomization below is the anti-farming boundary; this rotation also
-- keeps the stored bank balanced for admin/debugging views.
with target as (
  select id,
         (abs(hashtextextended(question_key, 20260825)) % 4)::integer as shift
  from ball_knower_private.trivia_questions
  where question_key not like 'gen\_%' escape '\'
    and active
)
update ball_knower_private.trivia_questions q
set answers = jsonb_build_array(
      q.answers -> target.shift,
      q.answers -> ((target.shift + 1) % 4),
      q.answers -> ((target.shift + 2) % 4),
      q.answers -> ((target.shift + 3) % 4)
    ),
    correct_index = ((q.correct_index - target.shift + 4) % 4)::smallint
from target
where q.id = target.id;

create or replace function ball_knower_private.finalize_generated_trivia_quality()
returns void
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
begin
  -- Rebuild division distractors from the same conference. Otherwise NFC
  -- questions can expose three AFC distractors (and vice versa), making the
  -- correct choice obvious without football knowledge.
  with facts as (
    select f.*,
      row_number() over(order by f.abbr)::int as n,
      array(select x.team_name from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) as mate_teams,
      array(select x.starting_qb from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) as mate_qbs,
      array(select distinct x.division from ball_knower_private.trivia_team_facts x where x.conference=f.conference and x.division<>f.division order by x.division) as other_divisions
    from ball_knower_private.trivia_team_facts f
  )
  update ball_knower_private.trivia_questions q
  set answers = ball_knower_private.trivia_choices4(f.division,f.other_divisions[1],f.other_divisions[2],f.other_divisions[3],f.n),
      correct_index = mod(abs(f.n),4)::smallint
  from facts f
  where q.question_key = 'gen_p_div_'||lower(f.abbr);

  with facts as (
    select f.*,
      row_number() over(order by f.abbr)::int as n,
      array(select x.team_name from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) as mate_teams,
      array(select distinct x.division from ball_knower_private.trivia_team_facts x where x.conference=f.conference and x.division<>f.division order by x.division) as other_divisions
    from ball_knower_private.trivia_team_facts f
  )
  update ball_knower_private.trivia_questions q
  set answers = ball_knower_private.trivia_choices4(f.division,f.other_divisions[1],f.other_divisions[2],f.other_divisions[3],f.n+2),
      correct_index = mod(abs(f.n+2),4)::smallint
  from facts f
  where q.question_key = 'gen_ap_divpair_'||lower(f.abbr);

  with facts as (
    select f.*,
      row_number() over(order by f.abbr)::int as n,
      array(select x.team_name from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) as mate_teams,
      array(select x.starting_qb from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) as mate_qbs,
      array(select distinct x.division from ball_knower_private.trivia_team_facts x where x.conference=f.conference and x.division<>f.division order by x.division) as other_divisions
    from ball_knower_private.trivia_team_facts f
  )
  update ball_knower_private.trivia_questions q
  set answers = ball_knower_private.trivia_choices4(
        f.team_name||' — '||f.division||' — '||f.starting_qb,
        f.mate_teams[1]||' — '||f.division||' — '||f.starting_qb,
        f.team_name||' — '||f.other_divisions[1]||' — '||f.mate_qbs[1],
        f.mate_teams[2]||' — '||f.other_divisions[2]||' — '||f.mate_qbs[2],
        f.n+1
      ),
      correct_index = mod(abs(f.n+1),4)::smallint
  from facts f
  where q.question_key = 'gen_h_match_'||lower(f.abbr);

  -- These are strictly easier than their Rookie abbreviation counterparts
  -- despite being labeled Hall of Fame. Retire them without deleting history.
  update ball_knower_private.trivia_questions
  set active = false
  where question_key like 'gen\_h\_reverse\_%' escape '\';

  -- Equivalent inverse phrasings share one suppression family. A user therefore
  -- cannot receive the same underlying team/QB or division fact under another ID
  -- immediately after answering it.
  update ball_knower_private.trivia_questions
  set repeat_family = case
    when question_key ~ '^gen_(r_qbteam|p_starter|p_qbclub|ap_clue|ap_qbdiv|ap_confdiv|h_match)_' then
      'qb-team:'||regexp_replace(question_key,'^.*_','')
    when question_key ~ '^gen_(r_abbr|r_teamabbr)_' then
      'team-id:'||regexp_replace(question_key,'^.*_','')
    when question_key ~ '^gen_(r_divmember|p_div|p_divrival|ap_divpair|h_complete|h_elim)_' then
      'division-team:'||regexp_replace(question_key,'^.*_','')
    else coalesce(repeat_family,question_key)
  end
  where question_key like 'gen\_%' escape '\';

  update ball_knower_private.trivia_questions
  set repeat_family = question_key
  where repeat_family is null or btrim(repeat_family)='';
end;
$$;
revoke all on function ball_knower_private.finalize_generated_trivia_quality() from public, anon, authenticated;

-- Keep the final quality normalization coupled to every private fact refresh.
create or replace function ball_knower_private.trivia_team_facts_refresh_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
begin
  perform ball_knower_private.refresh_generated_trivia();
  perform ball_knower_private.finalize_generated_trivia_quality();
  return null;
end;
$$;
revoke all on function ball_knower_private.trivia_team_facts_refresh_trigger() from public, anon, authenticated;

select ball_knower_private.finalize_generated_trivia_quality();

create index if not exists trivia_attempts_user_question_idx
  on ball_knower_private.trivia_attempts(user_id,question_id,created_at desc);

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
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_tier not in ('ROOKIE','PRO','ALL-PRO','HALL OF FAME') then raise exception 'Invalid trivia tier'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));

  -- Keep the no-repeat window tier-local, so activity in one difficulty cannot
  -- push recent questions from another tier out of history. Also suppress the
  -- same underlying fact family across tiers.
  select q.* into v_question
  from ball_knower_private.trivia_questions q
  where q.active
    and q.tier = p_tier
    and not exists (
      select 1
      from (
        select a.question_id
        from ball_knower_private.trivia_attempts a
        join ball_knower_private.trivia_questions seen on seen.id=a.question_id
        where a.user_id=v_user and seen.tier=p_tier
        order by a.created_at desc,a.id desc
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
        order by a.created_at desc,a.id desc
        limit 50
      ) recent_family
      where recent_family.family=coalesce(q.repeat_family,q.question_key)
    )
  order by random()
  limit 1;

  -- Once the fresh family-safe pool is exhausted, keep the exact immediate
  -- question out while allowing older material to cycle.
  if v_question.id is null then
    select q.* into v_question
    from ball_knower_private.trivia_questions q
    where q.active and q.tier=p_tier
      and q.id is distinct from (
        select a.question_id
        from ball_knower_private.trivia_attempts a
        join ball_knower_private.trivia_questions seen on seen.id=a.question_id
        where a.user_id=v_user and seen.tier=p_tier
        order by a.created_at desc,a.id desc
        limit 1
      )
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

  -- Shuffle choices independently for every served attempt. Stored answer order
  -- and generated team ordering are therefore not a usable progression shortcut.
  select array_agg(original_index order by sort_key),
         jsonb_agg(answer_value order by sort_key)
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

  question_id := v_question.id;
  tier := v_question.tier;
  question := v_question.question;
  answers := v_served_answers;
  return next;
end;
$$;
revoke all on function public.get_ball_knower_trivia_question(text) from public, anon;
grant execute on function public.get_ball_knower_trivia_question(text) to authenticated;

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
  v_correct_index integer;
  v_explanation text;
  v_tier text;
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
  if v_attempt.created_at < now()-interval '5 minutes' then raise exception 'Trivia attempt expired'; end if;

  select * into v_question
  from ball_knower_private.trivia_questions
  where id=v_attempt.question_id;
  if v_question.id is null then raise exception 'Trivia question unavailable'; end if;

  v_correct_index := coalesce(v_attempt.served_correct_index,v_question.correct_index);
  v_explanation := coalesce(v_attempt.served_explanation,v_question.explanation);
  v_tier := coalesce(v_attempt.served_tier,v_question.tier);
  v_correct := p_selected_index=v_correct_index;
  v_xp := case v_tier when 'ROOKIE' then 15 when 'PRO' then 25 when 'ALL-PRO' then 40 else 60 end;
  if not v_correct then v_xp := 2; end if;
  v_event_type := case when v_correct and v_tier='HALL OF FAME' then 'trivia_hof_correct' when v_correct then 'trivia_correct' else 'trivia_wrong' end;

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
    jsonb_build_object('tier',v_tier,'question_key',v_question.question_key,'question_id',v_question.id)
  );

  is_correct := v_correct;
  correct_index := v_correct_index;
  explanation := v_explanation;
  xp_awarded := case when v_recorded then v_xp else 0 end;
  progression_recorded := v_recorded;
  return next;
end;
$$;
revoke all on function public.submit_ball_knower_trivia_answer(bigint,integer) from public, anon;
grant execute on function public.submit_ball_knower_trivia_answer(bigint,integer) to authenticated;
