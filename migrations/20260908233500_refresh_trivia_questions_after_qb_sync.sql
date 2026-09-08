-- Repair every materialized current-roster question after Atlanta's starter
-- correction. This is explicit instead of depending on the optional fact-refresh
-- trigger so environments with older trigger state cannot retain stale prompts.

do $$
declare
  v_stale integer;
  v_bad integer;
begin
  if not exists (
    select 1
    from ball_knower_private.trivia_team_facts
    where abbr = 'ATL'
      and starting_qb = 'Tua Tagovailoa'
  ) then
    raise exception 'Atlanta must be synced to Tua Tagovailoa before refreshing generated Trivia';
  end if;

  update ball_knower_private.trivia_questions q
  set question = replace(q.question, 'Michael Penix Jr.', 'Tua Tagovailoa'),
      answers = (
        select jsonb_agg(
          to_jsonb(replace(choice.value #>> '{}', 'Michael Penix Jr.', 'Tua Tagovailoa'))
          order by choice.ordinality
        )
        from jsonb_array_elements(q.answers) with ordinality as choice(value, ordinality)
      ),
      explanation = replace(q.explanation, 'Michael Penix Jr.', 'Tua Tagovailoa')
  where (q.question_key like 'gen\_%' escape '\' or q.question_key like 'deep\_%' escape '\')
    and (
      q.question ilike '%Michael Penix Jr.%'
      or q.answers::text ilike '%Michael Penix Jr.%'
      or q.explanation ilike '%Michael Penix Jr.%'
    );

  select count(*) into v_stale
  from ball_knower_private.trivia_questions q
  where (q.question_key like 'gen\_%' escape '\' or q.question_key like 'deep\_%' escape '\')
    and (
      q.question ilike '%Michael Penix Jr.%'
      or q.answers::text ilike '%Michael Penix Jr.%'
      or q.explanation ilike '%Michael Penix Jr.%'
    );

  if v_stale <> 0 then
    raise exception 'Generated Trivia still contains % stale Michael Penix Jr. references', v_stale;
  end if;

  if not exists (
    select 1
    from ball_knower_private.trivia_questions
    where question_key = 'gen_p_starter_atl'
      and answers ->> correct_index = 'Tua Tagovailoa'
      and explanation ilike '%Tua Tagovailoa%'
  ) then
    raise exception 'Atlanta starter question did not retain the corrected answer key';
  end if;

  select count(*) into v_bad
  from ball_knower_private.trivia_questions q
  where q.active
    and (
      jsonb_typeof(q.answers) <> 'array'
      or jsonb_array_length(q.answers) <> 4
      or q.correct_index not between 0 and 3
      or (select count(distinct answer.value #>> '{}') from jsonb_array_elements(q.answers) answer) <> 4
    );

  if v_bad <> 0 then
    raise exception 'Trivia QB refresh produced % malformed active questions', v_bad;
  end if;
end;
$$;
