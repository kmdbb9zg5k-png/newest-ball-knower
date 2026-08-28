-- Repair the two correlated-subquery mistakes from the deep Trivia expansion,
-- make every generated prompt meaningfully distinct, and refuse malformed data.
with facts as (
  select f.*,
    row_number() over(order by f.abbr)::int n,
    array(select x.team_name from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) mate_teams,
    array(select x.starting_qb from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) mate_qbs,
    array(select x.market from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 3) other_markets,
    array(select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 3) other_teams,
    array(select x.starting_qb from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 3) other_qbs,
    array(select x.team_name from ball_knower_private.trivia_team_facts x where x.conference<>f.conference order by x.abbr limit 3) opposite_teams
  from ball_knower_private.trivia_team_facts f
)
update ball_knower_private.trivia_questions q
set answers=ball_knower_private.trivia_choices4(f.market,f.other_markets[1],f.other_markets[2],f.other_markets[3],f.n+1),
    correct_index=mod(f.n+1,4)::smallint,
    question='Match the '||f.team_name||' to its home market. Which location is correct?'
from facts f where q.question_key='deep_r_team_market_'||lower(f.abbr);

with facts as (
  select f.*,
    row_number() over(order by f.abbr)::int n,
    array(select x.team_name from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) mate_teams,
    array(select x.market from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 3) other_markets,
    array(select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 3) other_teams,
    array(select x.starting_qb from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 3) other_qbs
  from ball_knower_private.trivia_team_facts f
)
update ball_knower_private.trivia_questions q
set answers=ball_knower_private.trivia_choices4(
      f.team_name||' — '||f.market||' — '||f.starting_qb,
      f.mate_teams[1]||' — '||f.market||' — '||f.starting_qb,
      f.team_name||' — '||f.other_markets[1]||' — '||f.other_qbs[1],
      f.other_teams[2]||' — '||f.market||' — '||f.other_qbs[2],f.n+1),
    correct_index=mod(f.n+1,4)::smallint,
    question='Which profile correctly links the '||f.abbr||' abbreviation, '||f.market||' market, and its listed 2026 starter?'
from facts f where q.question_key='deep_h_reverse_profile_'||lower(f.abbr);

-- Rewrite every formerly repeated generated stem with football facts that are
-- already part of the question. No opaque sequence numbers or cosmetic tags.
with facts as (
  select f.*,
    array(select x.team_name from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) mate_teams,
    array(select x.starting_qb from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) mate_qbs,
    case when f.conference='AFC' then 'NFC' else 'AFC' end other_conference
  from ball_knower_private.trivia_team_facts f
)
update ball_knower_private.trivia_questions q set question=case
  when q.question_key='deep_r_conf_team_'||lower(f.abbr)
    then 'Using '||f.starting_qb||'''s '||f.division||' club as the anchor, which choice belongs to the '||f.conference||'?'
  when q.question_key='gen_r_divmember_'||lower(f.abbr)
    then 'Which team joins '||f.team_name||' and '||f.mate_teams[1]||' in the '||f.division||'?'
  when q.question_key='gen_h_match_'||lower(f.abbr)
    then 'Which team/division/quarterback profile correctly represents the '||f.market||' market in 2026?'
  when q.question_key='gen_h_elim_'||lower(f.abbr)
    then f.team_name||', '||f.mate_teams[1]||', and '||f.mate_teams[2]||' share the '||f.division||'. Which option is the outsider?'
  when q.question_key='deep_h_conf_elim_'||lower(f.abbr)
    then 'Which choice breaks this '||f.conference||' chain anchored by '||f.team_name||', '||f.mate_teams[1]||', and '||f.mate_teams[2]||'?'
  when q.question_key='deep_p_outsider_conf_'||lower(f.abbr)
    then 'Among the choices built around '||f.team_name||' and its '||f.division||' rivals, which club is the '||f.other_conference||' outsider?'
  when q.question_key='deep_ap_div_outsider_'||lower(f.abbr)
    then f.team_name||', '||f.mate_teams[1]||', and '||f.mate_teams[2]||' form a '||f.division||' trio. Which choice does not belong?'
  when q.question_key='deep_ap_pair_conf_'||lower(f.abbr)
    then 'What conference contains both the '||f.team_name||' and the '||f.mate_teams[1]||'?'
  else q.question end
from facts f
where q.question_key in(
  'deep_r_conf_team_'||lower(f.abbr),'gen_r_divmember_'||lower(f.abbr),
  'gen_h_match_'||lower(f.abbr),'gen_h_elim_'||lower(f.abbr),
  'deep_h_conf_elim_'||lower(f.abbr),'deep_p_outsider_conf_'||lower(f.abbr),
  'deep_ap_div_outsider_'||lower(f.abbr),'deep_ap_pair_conf_'||lower(f.abbr));

do $$
declare v_bad integer;v_unique integer;v_templates integer;
begin
  select count(*) into v_bad from ball_knower_private.trivia_questions q
  where q.active and (
    jsonb_typeof(q.answers)<>'array' or jsonb_array_length(q.answers)<>4
    or q.correct_index not between 0 and 3
    or exists(select 1 from jsonb_array_elements(q.answers) choice
      where jsonb_typeof(choice)<>'string' or nullif(btrim(choice#>>'{}'),'') is null));
  if v_bad<>0 then raise exception 'Active Trivia bank contains % malformed answer arrays',v_bad;end if;

  select count(distinct question),count(distinct template_family)
  into v_unique,v_templates from ball_knower_private.trivia_questions where active;
  if v_unique<1000 then raise exception 'Trivia bank contains only % unique active prompts',v_unique;end if;
  if v_templates<80 then raise exception 'Trivia bank contains only % useful template families',v_templates;end if;
end $$;
