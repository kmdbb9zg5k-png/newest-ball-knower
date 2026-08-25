-- Bind verified trivia requests to an explicit user-visible session.
-- The session is registered before question fetching, so delayed requests from an
-- exited/older client session cannot invalidate or replace a newer live attempt.

alter table ball_knower_private.trivia_attempts
  add column if not exists session_token text;

create table if not exists ball_knower_private.trivia_session_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_token text not null,
  session_order bigint not null,
  updated_at timestamptz not null default clock_timestamp()
);
alter table ball_knower_private.trivia_session_state enable row level security;
revoke all on ball_knower_private.trivia_session_state from public, anon, authenticated;

create or replace function public.begin_ball_knower_trivia_session(
  p_session_token text,
  p_session_order bigint
)
returns boolean
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_state ball_knower_private.trivia_session_state%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_session_token is null or length(p_session_token) < 8 or length(p_session_token) > 128 then
    raise exception 'Invalid trivia session token';
  end if;
  if p_session_order is null or p_session_order <= 0 or p_session_order > 9007199254740991 then
    raise exception 'Invalid trivia session order';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));

  select * into v_state
  from ball_knower_private.trivia_session_state
  where user_id=v_user
  for update;

  -- The order is captured when the user starts a level, before any network wait.
  -- A delayed older begin call therefore becomes a no-op rather than reclaiming the user.
  if v_state.user_id is not null then
    if p_session_order < v_state.session_order then
      return false;
    end if;
    if p_session_order = v_state.session_order then
      return v_state.session_token = p_session_token;
    end if;
  end if;

  insert into ball_knower_private.trivia_session_state(user_id,session_token,session_order,updated_at)
  values(v_user,p_session_token,p_session_order,clock_timestamp())
  on conflict(user_id) do update set
    session_token=excluded.session_token,
    session_order=excluded.session_order,
    updated_at=excluded.updated_at;

  -- A deliberate newer session supersedes the prior unanswered question. It is marked
  -- closed so it can never later award XP, while its history remains available for
  -- anti-repeat selection.
  update ball_knower_private.trivia_attempts
  set answered_at=clock_timestamp()
  where user_id=v_user and answered_at is null;

  return true;
end;
$$;
revoke all on function public.begin_ball_knower_trivia_session(text,bigint) from public, anon;
grant execute on function public.begin_ball_knower_trivia_session(text,bigint) to authenticated;

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

    -- A mismatched legacy row is not owned by the current registered session and can
    -- safely be retired before creating this session's first snapshotted attempt.
    update ball_knower_private.trivia_attempts
    set answered_at=clock_timestamp()
    where id=v_open.id and user_id=v_user and answered_at is null;
  end if;

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

-- Backward-compatible one-argument entry point for clients that have not yet picked
-- up explicit sessions. Duplicate same-tier calls return the current live attempt;
-- switching tiers falls back to practice instead of invalidating a newer verified one.
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
  v_token text;
  v_order bigint;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_tier not in ('ROOKIE','PRO','ALL-PRO','HALL OF FAME') then raise exception 'Invalid trivia tier'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text,0));

  update ball_knower_private.trivia_attempts
  set answered_at=clock_timestamp()
  where user_id=v_user and answered_at is null
    and created_at < clock_timestamp()-interval '5 minutes';

  select a.* into v_open
  from ball_knower_private.trivia_attempts a
  where a.user_id=v_user and a.answered_at is null
  order by a.id desc
  limit 1;

  if v_open.id is not null then
    select q.* into v_question from ball_knower_private.trivia_questions q where q.id=v_open.question_id;
    if coalesce(v_open.served_tier,v_question.tier)<>p_tier then
      raise exception 'Start a new trivia session to change difficulty';
    end if;
    if v_question.id is not null
       and v_open.served_answers is not null
       and jsonb_typeof(v_open.served_answers)='array'
       and jsonb_array_length(v_open.served_answers)=4 then
      attempt_id:=v_open.id;
      question_id:=v_open.question_id;
      tier:=coalesce(v_open.served_tier,v_question.tier);
      question:=v_question.question;
      answers:=v_open.served_answers;
      return next;
      return;
    end if;
  end if;

  v_token:='legacy-'||md5(v_user::text||clock_timestamp()::text||random()::text);
  select greatest(
    coalesce((select s.session_order+1 from ball_knower_private.trivia_session_state s where s.user_id=v_user),1),
    floor(extract(epoch from clock_timestamp())*1000000)::bigint
  ) into v_order;

  insert into ball_knower_private.trivia_session_state(user_id,session_token,session_order,updated_at)
  values(v_user,v_token,v_order,clock_timestamp())
  on conflict(user_id) do update set
    session_token=excluded.session_token,
    session_order=excluded.session_order,
    updated_at=excluded.updated_at;

  return query
    select * from public.get_ball_knower_trivia_question(p_tier,v_token);
end;
$$;
revoke all on function public.get_ball_knower_trivia_question(text) from public, anon;
grant execute on function public.get_ball_knower_trivia_question(text) to authenticated;
