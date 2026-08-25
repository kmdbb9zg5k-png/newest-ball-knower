-- Keep fact-level and template-level anti-repeat metadata correct after every
-- generated-question refresh. This migration intentionally sorts after the dual-family pass.

create or replace function ball_knower_private.apply_trivia_repeat_families()
returns void
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
begin
  -- Cross-tier fact families. Hall completion ultimately asks for the missing
  -- starting quarterback, so it belongs with the other team/QB fact variants.
  update ball_knower_private.trivia_questions
  set repeat_family = case
    when question_key ~ '^gen_(r_qbteam|p_starter|p_qbclub|ap_clue|ap_qbdiv|ap_confdiv|h_match|h_complete)_' then
      'qb-team:'||regexp_replace(question_key,'^.*_','')
    when question_key ~ '^gen_(r_abbr|r_teamabbr)_' then
      'team-id:'||regexp_replace(question_key,'^.*_','')
    when question_key ~ '^gen_(r_divmember|p_div|p_divrival|ap_divpair)_' then
      'division-team:'||regexp_replace(question_key,'^.*_','')
    else coalesce(nullif(repeat_family,''),question_key)
  end
  where question_key like 'gen\_%' escape '\';

  -- Hall elimination variants are all tests of the same division-level pairing set;
  -- keep that family division-wide rather than letting four per-team aliases rotate.
  update ball_knower_private.trivia_questions q
  set repeat_family='hall-elimination:'||lower(replace(f.division,' ','-'))
  from ball_knower_private.trivia_team_facts f
  where q.question_key='gen_h_elim_'||lower(f.abbr);

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
    else template_family
  end
  where question_key like 'gen\_%' escape '\';

  update ball_knower_private.trivia_questions
  set repeat_family=question_key
  where repeat_family is null or btrim(repeat_family)='';
end;
$$;
revoke all on function ball_knower_private.apply_trivia_repeat_families() from public, anon, authenticated;

-- Future fact refreshes first rebuild/finalize question content, then restore both
-- anti-repeat dimensions. This prevents a data refresh from silently undoing launch hardening.
create or replace function ball_knower_private.trivia_team_facts_refresh_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, ball_knower_private, pg_temp
as $$
begin
  perform ball_knower_private.refresh_generated_trivia();
  perform ball_knower_private.finalize_generated_trivia_quality();
  perform ball_knower_private.apply_trivia_repeat_families();
  return null;
end;
$$;
revoke all on function ball_knower_private.trivia_team_facts_refresh_trigger() from public, anon, authenticated;

select ball_knower_private.apply_trivia_repeat_families();
