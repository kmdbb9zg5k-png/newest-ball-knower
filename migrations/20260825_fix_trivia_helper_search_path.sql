-- The helper is private and immutable; pin its lookup path so SECURITY DEFINER
-- callers cannot be influenced by role-level search_path changes.
alter function ball_knower_private.trivia_choices4(text,text,text,text,integer)
  set search_path = 'pg_catalog';
