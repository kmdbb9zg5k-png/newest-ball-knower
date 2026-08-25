-- A legacy one-argument fetch must never replace a session that a current client
-- already registered. Old clients can continue only for users with no registered
-- session state; otherwise they fail closed and their client can use practice mode.

create or replace function public.get_ball_knower_trivia_question(p_tier text)
returns table(attempt_id bigint, question_id bigint, tier text, question text, answers jsonb)
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_open ball_knower_private.trivia_attempts%rowtype;
  v_question ball_knower_private.trivia_questions%rowtype;
  v_state ball_knower_private.trivia_session_state%rowtype;
  v_token text;
  v_order bigint;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_tier not in ('ROOKIE','PRO','ALL-PRO','HALL OF FAME') then raise exception 'Invalid trivia tier'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));

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

  -- A duplicate legacy request may safely receive the exact existing attempt.
  -- It never replaces or closes a current attempt.
  if v_open.id is not null then
    select q.* into v_question
    from ball_knower_private.trivia_questions q
    where q.id=v_open.question_id;

    if coalesce(v_open.served_tier,v_question.tier)<>p_tier then
      raise exception 'Start a new trivia session to change difficulty';
    end if;
    if v_question.id is not null
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
  end if;

  select * into v_state
  from ball_knower_private.trivia_session_state
  where user_id=v_user
  for update;

  -- Most importantly, do not supersede a registered token between a current
  -- client's begin-session call and its first token-bound question fetch.
  if v_state.user_id is not null then
    raise exception 'A verified trivia session is already registered';
  end if;

  v_token:='legacy-'||md5(v_user::text||clock_timestamp()::text||random()::text);
  v_order:=floor(extract(epoch from clock_timestamp())*1000000)::bigint;

  insert into ball_knower_private.trivia_session_state(user_id,session_token,session_order,updated_at)
  values(v_user,v_token,v_order,clock_timestamp());

  return query
    select * from public.get_ball_knower_trivia_question(p_tier,v_token);
end;
$$;
revoke all on function public.get_ball_knower_trivia_question(text) from public, anon;
grant execute on function public.get_ball_knower_trivia_question(text) to authenticated;
