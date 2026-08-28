-- Expand the verified trivia bank past 1,000 active questions while reducing
-- repeated stems. Sixteen new fact views × 32 teams add 512 questions on top
-- of the existing generated and curated banks. Each template has four wording
-- rotations, and team-profile families prevent the same underlying club fact
-- from appearing twice inside a 10-question round.

with facts as (
  select f.*,
    row_number() over(order by f.abbr)::int n,
    array(select x.team_name from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) mate_teams,
    array(select x.abbr from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) mate_abbrs,
    array(select x.starting_qb from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) mate_qbs,
    array(select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 3) other_teams,
    array(select x.abbr from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 3) other_abbrs,
    array(select x.starting_qb from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 3) other_qbs,
    array(select x.team_name from ball_knower_private.trivia_team_facts x where x.conference<>f.conference order by x.abbr limit 3) opposite_teams,
    array(select distinct x.division from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.division limit 3) other_divisions,
    case when f.conference='AFC' then 'NFC' else 'AFC' end other_conference
  from ball_knower_private.trivia_team_facts f
), generated as (
  select 'deep_r_market_team_'||lower(abbr) question_key,'ROOKIE' tier,'deep:rookie:market-team' template_family,
    case mod(n,4) when 0 then 'Which NFL team represents '||market||'?'
      when 1 then market||' is the home market for which team?'
      when 2 then 'Identify the club connected to the '||market||' market.'
      else 'Which team name belongs with '||market||'?' end question,
    ball_knower_private.trivia_choices4(team_name,other_teams[1],other_teams[2],other_teams[3],n) answers,mod(n,4)::smallint correct_index,
    market||' is the listed market for the '||team_name||'.' explanation from facts
  union all select 'deep_r_team_market_'||lower(abbr),'ROOKIE','deep:rookie:team-market',
    case mod(n,4) when 0 then 'What market is associated with the '||team_name||'?'
      when 1 then 'The '||team_name||' represent which market?'
      when 2 then 'Match the '||team_name||' to their home market.'
      else 'Which location belongs with the '||team_name||'?' end,
    ball_knower_private.trivia_choices4(market,(select x.market from facts x where x.abbr=other_abbrs[1]),(select x.market from facts x where x.abbr=other_abbrs[2]),(select x.market from facts x where x.abbr=other_abbrs[3]),n+1),mod(n+1,4)::smallint,
    'The '||team_name||' are associated with '||market||'.' from facts
  union all select 'deep_r_conf_team_'||lower(abbr),'ROOKIE','deep:rookie:conference-team',
    case mod(n,4) when 0 then 'Which of these teams is in the '||conference||'?'
      when 1 then 'Find the '||conference||' club.' when 2 then 'Which team belongs to the '||conference||' rather than the '||other_conference||'?'
      else 'Select the team from the '||conference||'.' end,
    ball_knower_private.trivia_choices4(team_name,opposite_teams[1],opposite_teams[2],opposite_teams[3],n+2),mod(n+2,4)::smallint,
    'The '||team_name||' compete in the '||conference||'.' from facts
  union all select 'deep_r_abbr_conf_'||lower(abbr),'ROOKIE','deep:rookie:abbr-conference',
    case mod(n,4) when 0 then 'The abbreviation '||abbr||' belongs to a team in which conference?'
      when 1 then 'Is '||abbr||' an AFC or NFC club?' when 2 then 'Name the conference for '||abbr||'.'
      else abbr||' is aligned with which NFL conference?' end,
    ball_knower_private.trivia_choices4(conference,other_conference,'Both conferences','Neither conference',n+3),mod(n+3,4)::smallint,
    abbr||' belongs to the '||conference||'.' from facts

  union all select 'deep_p_profile_team_'||lower(abbr),'PRO','deep:pro:market-abbr-profile',
    case mod(n,4) when 0 then 'Which team matches market '||market||' and abbreviation '||abbr||'?'
      when 1 then 'Connect this profile to a club: '||market||' · '||abbr||'.' when 2 then 'Identify the team from the paired clues '||abbr||' and '||market||'.'
      else 'What franchise is described by '||market||' and '||abbr||'?' end,
    ball_knower_private.trivia_choices4(team_name,other_teams[1],other_teams[2],other_teams[3],n),mod(n,4)::smallint,
    'Both clues identify the '||team_name||'.' from facts
  union all select 'deep_p_qb_conf_'||lower(abbr),'PRO','deep:pro:qb-conference',
    case mod(n,4) when 0 then starting_qb||' is listed as a starter in which conference?'
      when 1 then 'Which conference contains '||starting_qb||'''s listed 2026 team?' when 2 then 'Place '||starting_qb||' in the correct conference.'
      else starting_qb||' is connected to an '||conference||' or '||other_conference||' club?' end,
    ball_knower_private.trivia_choices4(conference,other_conference,'Both conferences','Neither conference',n+1),mod(n+1,4)::smallint,
    starting_qb||' is listed with the '||team_name||' of the '||conference||'.' from facts
  union all select 'deep_p_rival_abbr_'||lower(abbr),'PRO','deep:pro:rival-abbreviation',
    case mod(n,4) when 0 then 'Which abbreviation belongs to a division rival of '||abbr||'?'
      when 1 then 'Find another '||division||' abbreviation alongside '||abbr||'.' when 2 then 'Which code shares a division with '||abbr||'?'
      else 'Select the divisional opponent for '||abbr||'.' end,
    ball_knower_private.trivia_choices4(mate_abbrs[1],other_abbrs[1],other_abbrs[2],other_abbrs[3],n+2),mod(n+2,4)::smallint,
    abbr||' and '||mate_abbrs[1]||' are both in the '||division||'.' from facts
  union all select 'deep_p_outsider_conf_'||lower(abbr),'PRO','deep:pro:conference-outsider',
    case mod(n,4) when 0 then 'Three choices are '||conference||' teams. Which club is the '||other_conference||' outsider?'
      when 1 then 'Which team does not share the '||conference||' with the '||team_name||'?'
      when 2 then 'Eliminate the club outside the '||conference||'.' else 'Find the conference outsider in this group.' end,
    ball_knower_private.trivia_choices4(opposite_teams[1],team_name,mate_teams[1],mate_teams[2],n+3),mod(n+3,4)::smallint,
    opposite_teams[1]||' is the only listed club from the '||other_conference||'.' from facts

  union all select 'deep_ap_qb_div_'||lower(abbr),'ALL-PRO','deep:allpro:qb-division',
    case mod(n,4) when 0 then starting_qb||' is tied to which division in the 2026 fact set?'
      when 1 then 'Resolve the division from the quarterback clue: '||starting_qb||'.'
      when 2 then 'Which division contains the team listed with '||starting_qb||'?'
      else 'Place '||starting_qb||' in the correct division.' end,
    ball_knower_private.trivia_choices4(division,other_divisions[1],other_divisions[2],other_divisions[3],n),mod(n,4)::smallint,
    starting_qb||' is listed with the '||team_name||' in the '||division||'.' from facts
  union all select 'deep_ap_pair_conf_'||lower(abbr),'ALL-PRO','deep:allpro:team-pair-conference',
    case mod(n,4) when 0 then 'The '||team_name||' and '||mate_teams[1]||' both belong to which conference?'
      when 1 then 'What conference connects '||team_name||' with '||mate_teams[1]||'?'
      when 2 then 'Classify this team pair: '||team_name||' · '||mate_teams[1]||'.'
      else 'Which conference contains both listed clubs?' end,
    ball_knower_private.trivia_choices4(conference,other_conference,'Different conferences','Neither conference',n+1),mod(n+1,4)::smallint,
    'Both teams play in the '||conference||'.' from facts
  union all select 'deep_ap_market_qb_'||lower(abbr),'ALL-PRO','deep:allpro:market-quarterback',
    case mod(n,4) when 0 then 'Which listed quarterback matches the '||market||' market?'
      when 1 then market||' points to which 2026 starter?' when 2 then 'Connect this market clue to a quarterback: '||market||'.'
      else 'Who is the listed starter for the club representing '||market||'?' end,
    ball_knower_private.trivia_choices4(starting_qb,other_qbs[1],other_qbs[2],other_qbs[3],n+2),mod(n+2,4)::smallint,
    starting_qb||' is listed with the '||team_name||' of '||market||'.' from facts
  union all select 'deep_ap_div_outsider_'||lower(abbr),'ALL-PRO','deep:allpro:division-outsider',
    case mod(n,4) when 0 then 'Which team does not belong with this '||division||' trio?'
      when 1 then 'Remove the outsider from the '||division||' group.' when 2 then 'Three clubs share the '||division||'. Which one does not?'
      else 'Identify the non-'||division||' club.' end,
    ball_knower_private.trivia_choices4(other_teams[1],team_name,mate_teams[1],mate_teams[2],n+3),mod(n+3,4)::smallint,
    other_teams[1]||' is outside the '||division||'.' from facts

  union all select 'deep_h_full_profile_'||lower(abbr),'HALL OF FAME','deep:hof:full-profile',
    case mod(n,4) when 0 then 'Identify the club: '||conference||' · '||division||' · '||market||' · starter '||starting_qb||'.'
      when 1 then 'Which franchise satisfies all four clues: '||abbr||', '||division||', '||market||', '||starting_qb||'?'
      when 2 then 'Resolve this complete 2026 profile: '||market||' / '||conference||' / '||starting_qb||'.'
      else 'What team is encoded by '||abbr||' + '||division||' + '||starting_qb||'?' end,
    ball_knower_private.trivia_choices4(team_name,other_teams[1],other_teams[2],other_teams[3],n),mod(n,4)::smallint,
    'Every clue resolves to the '||team_name||'.' from facts
  union all select 'deep_h_reverse_profile_'||lower(abbr),'HALL OF FAME','deep:hof:reverse-profile',
    case mod(n,4) when 0 then 'Which full profile is internally consistent?'
      when 1 then 'Find the only valid team-market-quarterback chain.' when 2 then 'Which three-part franchise match is correct?'
      else 'Resolve the one profile without a mismatched clue.' end,
    ball_knower_private.trivia_choices4(team_name||' — '||market||' — '||starting_qb,mate_teams[1]||' — '||market||' — '||starting_qb,team_name||' — '||(select x.market from facts x where x.abbr=other_abbrs[1])||' — '||other_qbs[1],other_teams[2]||' — '||market||' — '||mate_qbs[2],n+1),mod(n+1,4)::smallint,
    team_name||' — '||market||' — '||starting_qb||' is the consistent chain.' from facts
  union all select 'deep_h_div_qb_pair_'||lower(abbr),'HALL OF FAME','deep:hof:division-quarterback-pair',
    case mod(n,4) when 0 then starting_qb||' and '||mate_qbs[1]||' are listed in the same division. Which one?'
      when 1 then 'What division connects the listed starters '||starting_qb||' and '||mate_qbs[1]||'?'
      when 2 then 'Resolve the shared division from this quarterback pair: '||starting_qb||' / '||mate_qbs[1]||'.'
      else 'Which divisional set includes both '||starting_qb||' and '||mate_qbs[1]||'?' end,
    ball_knower_private.trivia_choices4(division,other_divisions[1],other_divisions[2],other_divisions[3],n+2),mod(n+2,4)::smallint,
    'Both quarterbacks are listed with '||division||' clubs.' from facts
  union all select 'deep_h_conf_elim_'||lower(abbr),'HALL OF FAME','deep:hof:conference-elimination',
    case mod(n,4) when 0 then 'Which team breaks this '||conference||' chain: '||team_name||', '||mate_teams[1]||', '||mate_teams[2]||', ___?'
      when 1 then 'Complete the elimination: choose the only '||other_conference||' team.'
      when 2 then 'Which answer cannot join the other three in the '||conference||'?'
      else 'Find the conference mismatch after checking every club.' end,
    ball_knower_private.trivia_choices4(opposite_teams[1],team_name,mate_teams[1],mate_teams[2],n+3),mod(n+3,4)::smallint,
    opposite_teams[1]||' is in the '||other_conference||'; the other clubs are in the '||conference||'.' from facts
)
insert into ball_knower_private.trivia_questions(question_key,tier,question,answers,correct_index,explanation,repeat_family,template_family,active)
select question_key,tier,question,answers,correct_index,explanation,
  'team-profile:'||regexp_replace(question_key,'^.*_',''),template_family,true
from generated
on conflict(question_key) do update set tier=excluded.tier,question=excluded.question,answers=excluded.answers,
  correct_index=excluded.correct_index,explanation=excluded.explanation,repeat_family=excluded.repeat_family,
  template_family=excluded.template_family,active=true;

-- Unify the older team/QB variations with the deeper bank so one round cannot
-- ask two differently worded questions about the same underlying team profile.
update ball_knower_private.trivia_questions
set repeat_family='team-profile:'||regexp_replace(question_key,'^.*_','')
where question_key ~ '^gen_(r_abbr|r_teamabbr|r_qbteam|r_divmember|p_div|p_divrival|p_qbclub|p_starter|ap_clue|ap_confdiv|ap_divpair|ap_qbdiv|h_complete|h_match|h_reverse)_';

-- Hall elimination questions are division-level facts, not team-level aliases.
update ball_knower_private.trivia_questions q
set repeat_family='division-profile:'||lower(replace(f.division,' ','-'))
from ball_knower_private.trivia_team_facts f
where q.question_key='gen_h_elim_'||lower(f.abbr);

update ball_knower_private.trivia_questions
set template_family='curated:'||question_key
where active and (template_family is null or btrim(template_family)='');

-- Deployment-time assertions: fail the migration instead of silently shipping a
-- small or malformed bank.
do $$
declare v_count integer;v_bad integer;
begin
  select count(*) into v_count from ball_knower_private.trivia_questions where active;
  if v_count<1000 then raise exception 'Trivia bank expansion produced only % active questions',v_count;end if;
  select count(*) into v_bad from ball_knower_private.trivia_questions
  where active and (jsonb_typeof(answers)<>'array' or jsonb_array_length(answers)<>4 or correct_index not between 0 and 3 or repeat_family is null or template_family is null);
  if v_bad>0 then raise exception 'Trivia bank contains % malformed active questions',v_bad;end if;
end $$;
