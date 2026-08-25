-- Generated questions can carry different facts while reading like the same prompt.
-- Treat each generated prompt shape as one repeat family so users rotate through
-- genuinely different question styles instead of seeing the same template back-to-back.

update ball_knower_private.trivia_questions
set repeat_family = case
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
  else repeat_family
end
where question_key like 'gen_%';

-- Keep every active question in a non-null family so the anti-repeat query has a
-- single deterministic key for both hand-written and generated material.
update ball_knower_private.trivia_questions
set repeat_family = question_key
where active and (repeat_family is null or btrim(repeat_family)='');
