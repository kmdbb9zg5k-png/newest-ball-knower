-- Preserve two independent anti-repeat dimensions for generated trivia:
-- 1) repeat_family suppresses the same underlying football fact across tiers.
-- 2) template_family suppresses visually repetitive prompt shapes within/across sessions.
-- This migration intentionally sorts after ordered sessions and template rotation.

alter table ball_knower_private.trivia_questions
  add column if not exists template_family text;

-- Restore the fact-level family that launch hardening assigned before the later
-- template-rotation migration reused repeat_family for prompt shape.
update ball_knower_private.trivia_questions
set repeat_family = case
  when question_key ~ '^gen_(r_qbteam|p_starter|p_qbclub|ap_clue|ap_qbdiv|ap_confdiv|h_match)_' then
    'qb-team:'||regexp_replace(question_key,'^.*_','')
  when question_key ~ '^gen_(r_abbr|r_teamabbr)_' then
    'team-id:'||regexp_replace(question_key,'^.*_','')
  when question_key ~ '^gen_(r_divmember|p_div|p_divrival|ap_divpair|h_complete|h_elim)_' then
    'division-team:'||regexp_replace(question_key,'^.*_','')
  else coalesce(nullif(repeat_family,''),question_key)
end
where question_key like 'gen\_%' escape '\';

update ball_knower_private.trivia_questions
set template_family = case
  when question_key like 'gen_r_abbr_%' then 'template:rookie:abbr-to-team'
  when question_key like 'gen_r_teamabbr_%' then 'template:rookie:team-to-abbr'
  when question_key like 'gen_r_qbteam_%' then 'template:rookie:qb-to-team'
  when question_key like 'gen_r_divmember_%' then 'template:rookie:division-member'
  when question_key like 'gen_p_div_%' then 'template:pro:team-division'
  when question_key like 'gen_p_divrival_%' then 'template:pro:division-rival'
  when question_key like 'gen_p_qbclub_%' then 'template:pro:qb-club'
  when question_key like 'gen_p_starter_%' then 'template:pro:team-starter'
  when question_key like 'gen_ap_clue_%' then 'template:allpro:multi-clue'
  when question_key like 'gen_ap_confdiv_%' then 'template:allpro:conference-division'
  when question_key like 'gen_ap_divpair_%' then 'template:allpro:division-pair'
  when question_key like 'gen_ap_qbdiv_%' then 'template:allpro:qb-division'
  when question_key like 'gen_h_complete_%' then 'template:hof:complete-division'
  when question_key like 'gen_h_elim_%' then 'template:hof:elimination'
  when question_key like 'gen_h_match_%' then 'template:hof:matching-combination'
  else null
end
where question_key like 'gen\_%' escape '\';

update ball_knower_private.trivia_questions
set repeat_family = question_key
where repeat_family is null or btrim(repeat_family)='';

create index if not exists trivia_questions_repeat_family_idx
  on ball_knower_private.trivia_questions(repeat_family)
  where active;
create index if not exists trivia_questions_template_family_idx
  on ball_knower_private.trivia_questions(template_family)
  where active and template_family is not null;

create or replace function public.get_ball_knower_trivia_question(
  p_tier text,
  p_session_token text
)
returns table(attempt_id bigint, question_id bigint, tier text, question text, answers jsonb)
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_current_token text;
  v_question ball_knower_private.trivia_questions%rowtype;
  v_open ball_knower_private.trivia_attempts%rowtype;
  v_answer_order integer[];
  v_served_answers jsonb;
  v_served_correct smallint;
  v_last_family text;
  v_last_template text;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_tier not in ('ROOKIE','PRO','ALL-PRO','HALL OF FAME') then raise exception 'Invalid trivia tier'; end if;
  if p_session_token is null or length(p_session_token) < 8 or length(p_session_token) > 128 then
    raise exception 'Invalid trivia session token';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));

  select s.session_token into v_current_token
  from ball_knower_private.trivia_session_state s
  where s.user_id=v_user;

  if v_current_token is null or v_current_token<>p_session_token then
    raise exception 'Stale trivia session';
  end if;

  update ball_knower_private.trivia_attempts
  set answered_at=clock_timestamp()
  where user_id=v_user
    and answered_at is null
    and created_at < clock_timestamp()-interval '5 minutes';

  select a.* into v_open
  from ball_knower_private.trivia_attempts a
  where a.user_id=v_user and a.answered_at is null
  order by a.id desc
  limit 1;

  if v_open.id is not null then
    select q.* into v_question
    from ball_knower_private.trivia_questions q
    where q.id=v_open.question_id;

    if v_open.session_token=p_session_token
       and coalesce(v_open.served_tier,v_question.tier)=p_tier
       and v_question.id is not null
       and v_open.served_answers is not null
       and jsonb_typeof(v_open.served_answers)='array'
       and jsonb_array_length(v_open.served_answers)=4
       and v_open.served_correct_index between 0 and 3 then
      attempt_id:=v_open.id;
      question_id:=v_open.question_id;
      tier:=coalesce(v_open.served_tier,v_question.tier);
      question:=v_question.question;
      answers:=v_open.served_answers;
      return next;
      return;
    end if;

    if v_open.session_token=p_session_token then
      raise exception 'Start a new trivia session to change difficulty';
    end if;

    update ball_knower_private.trivia_attempts
    set answered_at=clock_timestamp()
    where id=v_open.id and user_id=v_user and answered_at is null;
  end if;

  select coalesce(seen.repeat_family,seen.question_key),seen.template_family
  into v_last_family,v_last_template
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
    and (
      q.template_family is null
      or not exists (
        select 1
        from (
          select seen.template_family as template_family
          from ball_knower_private.trivia_attempts a
          join ball_knower_private.trivia_questions seen on seen.id=a.question_id
          where a.user_id=v_user and seen.template_family is not null
          order by a.id desc
          limit 8
        ) recent_template
        where recent_template.template_family=q.template_family
      )
    )
  order by random()
  limit 1;

  -- On exhaustion, still avoid the immediately previous exact question, fact family,
  -- and prompt template whenever another active question can satisfy all three.
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
      and (q.template_family is null or q.template_family is distinct from v_last_template)
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
    user_id,question_id,served_answers,served_correct_index,served_explanation,served_tier,session_token
  ) values (
    v_user,v_question.id,v_served_answers,v_served_correct,v_question.explanation,v_question.tier,p_session_token
  ) returning id into attempt_id;

  question_id:=v_question.id;
  tier:=v_question.tier;
  question:=v_question.question;
  answers:=v_served_answers;
  return next;
end;
$$;
revoke all on function public.get_ball_knower_trivia_question(text,text) from public, anon;
grant execute on function public.get_ball_knower_trivia_question(text,text) to authenticated;
