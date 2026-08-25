-- Preserve tier-local repeat history using the tier actually served on each attempt.
-- Older attempts created before served_tier existed fall back to the question's current tier.

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
        where a.user_id=v_user
          and coalesce(a.served_tier,seen.tier)=p_tier
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

  if v_question.id is null then
    select q.* into v_question
    from ball_knower_private.trivia_questions q
    where q.active and q.tier=p_tier
      and q.id is distinct from (
        select a.question_id
        from ball_knower_private.trivia_attempts a
        join ball_knower_private.trivia_questions seen on seen.id=a.question_id
        where a.user_id=v_user
          and coalesce(a.served_tier,seen.tier)=p_tier
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
