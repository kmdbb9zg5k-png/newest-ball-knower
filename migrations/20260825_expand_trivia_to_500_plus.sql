-- Expand trivia to hundreds of server-scored questions using Ball Knower's 2026 team/QB facts.
-- This keeps answer keys private and makes the bank maintainable instead of hand-writing fragile one-offs.

create table if not exists ball_knower_private.trivia_team_facts (
  abbr text primary key,
  team_name text not null unique,
  market text not null,
  conference text not null check (conference in ('AFC','NFC')),
  division text not null,
  starting_qb text not null
);
alter table ball_knower_private.trivia_team_facts enable row level security;
revoke all on ball_knower_private.trivia_team_facts from public, anon, authenticated;

insert into ball_knower_private.trivia_team_facts(abbr,team_name,market,conference,division,starting_qb)
values
('BUF','Buffalo Bills','Buffalo','AFC','AFC East','Josh Allen'),
('MIA','Miami Dolphins','Miami','AFC','AFC East','Malik Willis'),
('NE','New England Patriots','New England','AFC','AFC East','Drake Maye'),
('NYJ','New York Jets','New York','AFC','AFC East','Geno Smith'),
('BAL','Baltimore Ravens','Baltimore','AFC','AFC North','Lamar Jackson'),
('CIN','Cincinnati Bengals','Cincinnati','AFC','AFC North','Joe Burrow'),
('CLE','Cleveland Browns','Cleveland','AFC','AFC North','Deshaun Watson'),
('PIT','Pittsburgh Steelers','Pittsburgh','AFC','AFC North','Aaron Rodgers'),
('HOU','Houston Texans','Houston','AFC','AFC South','C.J. Stroud'),
('IND','Indianapolis Colts','Indianapolis','AFC','AFC South','Daniel Jones'),
('JAX','Jacksonville Jaguars','Jacksonville','AFC','AFC South','Trevor Lawrence'),
('TEN','Tennessee Titans','Tennessee','AFC','AFC South','Cam Ward'),
('DEN','Denver Broncos','Denver','AFC','AFC West','Bo Nix'),
('KC','Kansas City Chiefs','Kansas City','AFC','AFC West','Patrick Mahomes'),
('LV','Las Vegas Raiders','Las Vegas','AFC','AFC West','Kirk Cousins'),
('LAC','Los Angeles Chargers','Los Angeles','AFC','AFC West','Justin Herbert'),
('DAL','Dallas Cowboys','Dallas','NFC','NFC East','Dak Prescott'),
('NYG','New York Giants','New York','NFC','NFC East','Jaxson Dart'),
('PHI','Philadelphia Eagles','Philadelphia','NFC','NFC East','Jalen Hurts'),
('WAS','Washington Commanders','Washington','NFC','NFC East','Jayden Daniels'),
('CHI','Chicago Bears','Chicago','NFC','NFC North','Caleb Williams'),
('DET','Detroit Lions','Detroit','NFC','NFC North','Jared Goff'),
('GB','Green Bay Packers','Green Bay','NFC','NFC North','Jordan Love'),
('MIN','Minnesota Vikings','Minnesota','NFC','NFC North','Kyler Murray'),
('ATL','Atlanta Falcons','Atlanta','NFC','NFC South','Michael Penix Jr.'),
('CAR','Carolina Panthers','Carolina','NFC','NFC South','Bryce Young'),
('NO','New Orleans Saints','New Orleans','NFC','NFC South','Tyler Shough'),
('TB','Tampa Bay Buccaneers','Tampa Bay','NFC','NFC South','Baker Mayfield'),
('ARI','Arizona Cardinals','Arizona','NFC','NFC West','Jacoby Brissett'),
('LAR','Los Angeles Rams','Los Angeles','NFC','NFC West','Matthew Stafford'),
('SF','San Francisco 49ers','San Francisco','NFC','NFC West','Brock Purdy'),
('SEA','Seattle Seahawks','Seattle','NFC','NFC West','Sam Darnold')
on conflict(abbr) do update set
 team_name=excluded.team_name,market=excluded.market,conference=excluded.conference,
 division=excluded.division,starting_qb=excluded.starting_qb;

create or replace function ball_knower_private.trivia_choices4(
  p_correct text, p_a text, p_b text, p_c text, p_position integer
) returns jsonb
language sql immutable
as $$
  select case mod(abs(p_position),4)
    when 0 then jsonb_build_array(p_correct,p_a,p_b,p_c)
    when 1 then jsonb_build_array(p_a,p_correct,p_b,p_c)
    when 2 then jsonb_build_array(p_a,p_b,p_correct,p_c)
    else jsonb_build_array(p_a,p_b,p_c,p_correct)
  end;
$$;
revoke all on function ball_knower_private.trivia_choices4(text,text,text,text,integer) from public, anon, authenticated;

with facts as (
  select f.*,
    row_number() over(order by f.abbr)::int as n,
    array(select x.team_name from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) as mate_teams,
    array(select x.starting_qb from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr) as mate_qbs,
    array(select distinct x.division from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.division limit 3) as other_divisions
  from ball_knower_private.trivia_team_facts f
),
generated as (
  select 'gen_r_abbr_'||lower(abbr) key,'ROOKIE' tier,
    'Which NFL team uses the abbreviation '||abbr||'?' question,
    ball_knower_private.trivia_choices4(team_name,mate_teams[1],mate_teams[2],mate_teams[3],n) answers,
    mod(abs(n),4)::smallint correct_index,
    abbr||' is the abbreviation for the '||team_name||'.' explanation from facts
  union all
  select 'gen_r_teamabbr_'||lower(abbr),'ROOKIE',
    'What is the standard abbreviation for the '||team_name||'?',
    ball_knower_private.trivia_choices4(abbr,
      (select x.abbr from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr limit 1),
      (select x.abbr from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr offset 1 limit 1),
      (select x.abbr from ball_knower_private.trivia_team_facts x where x.division=f.division and x.abbr<>f.abbr order by x.abbr offset 2 limit 1),n+1),
    mod(abs(n+1),4)::smallint,
    'The '||team_name||' use the abbreviation '||abbr||'.' from facts f
  union all
  select 'gen_r_qbteam_'||lower(abbr),'ROOKIE',
    'Which team is listed with '||starting_qb||' as its 2026 starting quarterback?',
    ball_knower_private.trivia_choices4(team_name,mate_teams[1],mate_teams[2],mate_teams[3],n+2),
    mod(abs(n+2),4)::smallint,
    starting_qb||' is listed as the 2026 starter for the '||team_name||'.' from facts
  union all
  select 'gen_r_divmember_'||lower(abbr),'ROOKIE',
    'Which of these teams plays in the '||division||'?',
    ball_knower_private.trivia_choices4(team_name,
      (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 1),
      (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr offset 7 limit 1),
      (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr offset 14 limit 1),n+3),
    mod(abs(n+3),4)::smallint,
    'The '||team_name||' play in the '||division||'.' from facts f

  union all
  select 'gen_p_div_'||lower(abbr),'PRO',
    'Which division do the '||team_name||' play in?',
    ball_knower_private.trivia_choices4(division,other_divisions[1],other_divisions[2],other_divisions[3],n),
    mod(abs(n),4)::smallint,
    'The '||team_name||' are in the '||division||'.' from facts
  union all
  select 'gen_p_starter_'||lower(abbr),'PRO',
    'Who is listed as the '||team_name||''' 2026 starting quarterback?',
    ball_knower_private.trivia_choices4(starting_qb,mate_qbs[1],mate_qbs[2],mate_qbs[3],n+1),
    mod(abs(n+1),4)::smallint,
    starting_qb||' is listed as the 2026 starter for the '||team_name||'.' from facts
  union all
  select 'gen_p_qbclub_'||lower(abbr),'PRO',
    starting_qb||' is listed as the 2026 starting quarterback for which club?',
    ball_knower_private.trivia_choices4(team_name,mate_teams[1],mate_teams[2],mate_teams[3],n+2),
    mod(abs(n+2),4)::smallint,
    starting_qb||' is listed with the '||team_name||'.' from facts
  union all
  select 'gen_p_divrival_'||lower(abbr),'PRO',
    'Which team is a division rival of the '||team_name||'?',
    ball_knower_private.trivia_choices4(mate_teams[1],
      (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 1),
      (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr offset 8 limit 1),
      (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr offset 15 limit 1),n+3),
    mod(abs(n+3),4)::smallint,
    mate_teams[1]||' and the '||team_name||' share the '||division||'.' from facts f

  union all
  select 'gen_ap_clue_'||lower(abbr),'ALL-PRO',
    'Which '||division||' team is listed with '||starting_qb||' as its 2026 starting quarterback?',
    ball_knower_private.trivia_choices4(team_name,mate_teams[1],mate_teams[2],mate_teams[3],n),
    mod(abs(n),4)::smallint,
    'That combination points to the '||team_name||'.' from facts
  union all
  select 'gen_ap_qbdiv_'||lower(abbr),'ALL-PRO',
    'Which quarterback is listed as a 2026 starter in the '||division||' for the '||team_name||'?',
    ball_knower_private.trivia_choices4(starting_qb,mate_qbs[1],mate_qbs[2],mate_qbs[3],n+1),
    mod(abs(n+1),4)::smallint,
    starting_qb||' is the listed starter for the '||team_name||'.' from facts
  union all
  select 'gen_ap_divpair_'||lower(abbr),'ALL-PRO',
    'The '||team_name||' and '||mate_teams[1]||' are both members of which division?',
    ball_knower_private.trivia_choices4(division,other_divisions[1],other_divisions[2],other_divisions[3],n+2),
    mod(abs(n+2),4)::smallint,
    'Both clubs are members of the '||division||'.' from facts
  union all
  select 'gen_ap_confdiv_'||lower(abbr),'ALL-PRO',
    'Which team matches all three clues: '||conference||', '||division||', and starting quarterback '||starting_qb||'?',
    ball_knower_private.trivia_choices4(team_name,mate_teams[1],mate_teams[2],mate_teams[3],n+3),
    mod(abs(n+3),4)::smallint,
    'The clues identify the '||team_name||'.' from facts

  union all
  select 'gen_h_complete_'||lower(abbr),'HALL OF FAME',
    'Which team completes this '||division||' group: '||mate_teams[1]||', '||mate_teams[2]||', '||mate_teams[3]||', and ___?',
    ball_knower_private.trivia_choices4(team_name,
      (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 1),
      (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr offset 9 limit 1),
      (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr offset 17 limit 1),n),
    mod(abs(n),4)::smallint,
    'The fourth member of that '||division||' set is the '||team_name||'.' from facts f
  union all
  select 'gen_h_match_'||lower(abbr),'HALL OF FAME',
    'Which team/division/quarterback combination is correct for 2026?',
    ball_knower_private.trivia_choices4(team_name||' — '||division||' — '||starting_qb,
      mate_teams[1]||' — '||division||' — '||starting_qb,
      team_name||' — '||other_divisions[1]||' — '||mate_qbs[1],
      mate_teams[2]||' — '||other_divisions[2]||' — '||mate_qbs[2],n+1),
    mod(abs(n+1),4)::smallint,
    team_name||' — '||division||' — '||starting_qb||' is the correct match.' from facts
  union all
  select 'gen_h_elim_'||lower(abbr),'HALL OF FAME',
    'Three of these clubs are '||division||' rivals. Which club is the outsider?',
    ball_knower_private.trivia_choices4(
      (select x.team_name from ball_knower_private.trivia_team_facts x where x.division<>f.division order by x.abbr limit 1),
      team_name,mate_teams[1],mate_teams[2],n+2),
    mod(abs(n+2),4)::smallint,
    'The '||team_name||', '||mate_teams[1]||', and '||mate_teams[2]||' are in the '||division||'; the other club is not.' from facts f
  union all
  select 'gen_h_reverse_'||lower(abbr),'HALL OF FAME',
    'Identify the team from this 2026 profile: abbreviation '||abbr||', division '||division||', starter '||starting_qb||'.',
    ball_knower_private.trivia_choices4(team_name,mate_teams[1],mate_teams[2],mate_teams[3],n+3),
    mod(abs(n+3),4)::smallint,
    'Those three clues identify the '||team_name||'.' from facts
)
insert into ball_knower_private.trivia_questions(question_key,tier,question,answers,correct_index,explanation)
select key,tier,question,answers,correct_index,explanation
from generated
on conflict(question_key) do update set
 tier=excluded.tier,question=excluded.question,answers=excluded.answers,
 correct_index=excluded.correct_index,explanation=excluded.explanation,active=true;
