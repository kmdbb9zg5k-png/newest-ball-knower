create table if not exists public.ball_knower_fantasy_rankings (
  player_key text not null,
  season integer not null default 2026 check (season between 2020 and 2100),
  scoring_format text not null default 'ppr' check (scoring_format in ('ppr', 'half_ppr', 'standard')),
  player_name text not null,
  team text not null,
  position text not null check (position in ('QB', 'RB', 'WR', 'TE', 'K')),
  overall_rank integer not null check (overall_rank > 0),
  position_rank integer not null check (position_rank > 0),
  actual_points_2025 numeric(6,1) not null check (actual_points_2025 >= 0),
  projected_points_2026 numeric(6,1) not null check (projected_points_2026 >= 0),
  point_change numeric(6,1) generated always as (projected_points_2026 - actual_points_2025) stored,
  projection_reason text not null check (char_length(projection_reason) between 20 and 600),
  actual_source_name text not null,
  actual_source_url text not null,
  projection_source_name text not null,
  projection_source_url text,
  projection_model text not null,
  updated_at timestamptz not null default now(),
  primary key (player_key, season, scoring_format),
  unique (season, scoring_format, overall_rank)
);

create index if not exists ball_knower_fantasy_rankings_position_idx
  on public.ball_knower_fantasy_rankings (season, scoring_format, position, position_rank);

alter table public.ball_knower_fantasy_rankings enable row level security;
revoke all on table public.ball_knower_fantasy_rankings from anon, authenticated;
grant select on table public.ball_knower_fantasy_rankings to anon, authenticated;
grant all on table public.ball_knower_fantasy_rankings to service_role;

drop policy if exists "fantasy rankings are publicly readable" on public.ball_knower_fantasy_rankings;
create policy "fantasy rankings are publicly readable"
  on public.ball_knower_fantasy_rankings for select
  to anon, authenticated
  using (true);

comment on table public.ball_knower_fantasy_rankings is
  'Versioned fantasy cheat-sheet snapshots. 2025 PPR actuals credited per row; 2026 projections are editorial Ball Knower estimates informed by linked public projection boards.';

insert into public.ball_knower_fantasy_rankings
  (player_key, player_name, team, position, overall_rank, position_rank, actual_points_2025, projected_points_2026, projection_reason, actual_source_name, actual_source_url, projection_source_name, projection_source_url, projection_model)
values
('jahmyr-gibbs','Jahmyr Gibbs','DET','RB',1,1,366.9,313.7,'Elite receiving usage and explosive efficiency keep Gibbs at RB1, but touchdown and efficiency regression make a repeat of his huge 2025 total unlikely.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','DraftAI 2026 PPR model','https://draftai.live/rankings','Ball Knower preseason snapshot v1'),
('bijan-robinson','Bijan Robinson','ATL','RB',2,2,370.8,348.7,'A true three-down role and premium receiving volume preserve the overall RB1 ceiling. The projection still trims last year’s total because another near-371-point season is an aggressive baseline.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','DraftAI 2026 PPR model','https://draftai.live/rankings','Ball Knower preseason snapshot v1'),
('puka-nacua','Puka Nacua','LAR','WR',3,1,375.0,302.3,'Target dominance and yards-after-catch ability keep Nacua in the first tier. The lower total prices in ordinary touchdown and efficiency regression after an exceptional 2025.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','DraftAI 2026 PPR model','https://draftai.live/rankings','Ball Knower preseason snapshot v1'),
('jamar-chase','Ja''Marr Chase','CIN','WR',4,2,313.6,309.0,'Chase retains an elite target share and touchdown ceiling in a high-volume passing offense. His projection is essentially flat because the role remains stable while weekly scoring is naturally volatile.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','DraftAI 2026 PPR model','https://draftai.live/rankings','Ball Knower preseason snapshot v1'),
('christian-mccaffrey','Christian McCaffrey','SF','RB',5,3,416.6,295.5,'McCaffrey remains a premium dual-threat back, but age, workload management and regression from the 2025 overall-PPR lead create the widest downside gap among the first-round backs.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','DraftAI 2026 PPR model','https://draftai.live/rankings','Ball Knower preseason snapshot v1'),
('jaxon-smith-njigba','Jaxon Smith-Njigba','SEA','WR',6,3,359.9,289.5,'The target-earning profile is real and supports another WR1 season. The model lowers the total because his 2025 yardage and weekly efficiency were already near the top of the realistic range.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','DraftAI 2026 PPR model','https://draftai.live/rankings','Ball Knower preseason snapshot v1'),
('amon-ra-st-brown','Amon-Ra St. Brown','DET','WR',7,4,324.0,296.0,'A stable slot-heavy role and one of the league’s safest target floors keep St. Brown near the top. Detroit has several elite mouths to feed, slightly reducing the projected ceiling.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','Ball Knower editorial projection',null,'Ball Knower preseason snapshot v1'),
('jonathan-taylor','Jonathan Taylor','IND','RB',8,4,362.3,276.2,'Taylor’s rushing volume and goal-line role remain first-round assets. The projection expects touchdown regression and a more ordinary efficiency season after his massive 2025 finish.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','DraftAI 2026 PPR model','https://draftai.live/rankings','Ball Knower preseason snapshot v1'),
('james-cook','James Cook','BUF','RB',9,5,302.2,261.6,'Cook owns an efficient role in an elite offense, but Josh Allen’s rushing near the goal line caps touchdown certainty and pulls the projection below last season.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','DraftAI 2026 PPR model','https://draftai.live/rankings','Ball Knower preseason snapshot v1'),
('drake-london','Drake London','ATL','WR',10,5,201.9,278.0,'London scored at a WR1 pace when active in 2025. A healthier games-played assumption and continued alpha target share drive one of the board’s clearest positive projections.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','Ball Knower editorial projection',null,'Ball Knower preseason snapshot v1'),
('omarion-hampton','Omarion Hampton','LAC','RB',11,6,96.1,247.0,'A larger second-year workload and three-down opportunity create the breakout case. The increase is mostly role growth rather than assuming an unsustainable efficiency spike.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','Ball Knower editorial projection',null,'Ball Knower preseason snapshot v1'),
('justin-jefferson','Justin Jefferson','MIN','WR',12,6,201.5,274.0,'Jefferson’s 2025 was suppressed by quarterback instability and only two touchdowns. Even a partial return toward his career target efficiency produces a strong rebound projection.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','Ball Knower editorial projection',null,'Ball Knower preseason snapshot v1'),
('ceedee-lamb','CeeDee Lamb','DAL','WR',13,7,200.9,270.0,'Lamb missed four games yet still scored 15.5 PPR points per game. Better health and his established target share support a rebound without requiring a career-best season.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','Ball Knower editorial projection',null,'Ball Knower preseason snapshot v1'),
('saquon-barkley','Saquon Barkley','PHI','RB',14,7,232.3,302.0,'Barkley’s 2025 total fell well below expectations, but the lead role behind a strong line remains valuable. The rebound assumes better touchdown conversion, balanced against age and workload risk.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','TheSharpBook 2026 projection','https://thesharpbook.com/en/players/nfl','Ball Knower preseason snapshot v1'),
('ashton-jeanty','Ashton Jeanty','LV','RB',15,8,245.1,262.0,'Jeanty already handled a major rookie workload. Normal second-year growth in receiving and touchdown opportunity nudges him up while team scoring volatility keeps the estimate conservative.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','TheSharpBook 2026 projection','https://thesharpbook.com/en/players/nfl','Ball Knower preseason snapshot v1'),
('chase-brown','Chase Brown','CIN','RB',16,9,282.6,282.0,'Brown’s passing-game involvement supports a reliable PPR floor. The projection is nearly unchanged because the workload is strong but last year already captured much of the upside.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','TheSharpBook 2026 projection','https://thesharpbook.com/en/players/nfl','Ball Knower preseason snapshot v1'),
('devon-achane','De''Von Achane','MIA','RB',17,10,322.8,256.0,'Achane remains one of football’s most explosive receiving backs, but durability, touch concentration and efficiency regression lower the season-long expectation.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','DraftAI 2026 PPR model','https://draftai.live/rankings','Ball Knower preseason snapshot v1'),
('kenneth-walker','Kenneth Walker III','KC','RB',18,11,191.9,238.0,'A new offensive environment offers stronger scoring potential and Walker still owns high-end rushing talent. The increase assumes a lead role but discounts receiving-volume uncertainty.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','Ball Knower editorial projection',null,'Ball Knower preseason snapshot v1'),
('trey-mcbride','Trey McBride','ARI','TE',19,1,315.9,264.0,'McBride’s target dominance creates a positional advantage no other tight end can easily match. His projection falls because 315.9 points was an extreme TE season, not because the role weakened.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','TheSharpBook 2026 projection','https://thesharpbook.com/en/players/nfl','Ball Knower preseason snapshot v1'),
('josh-allen','Josh Allen','BUF','QB',20,1,364.6,379.3,'Allen’s rushing touchdowns and stable elite passing role keep him QB1. A full 17-game assumption lifts the projection modestly from a 16-game 2025.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','DraftAI 2026 PPR model','https://draftai.live/rankings','Ball Knower preseason snapshot v1'),
('malik-nabers','Malik Nabers','NYG','WR',21,8,91.4,235.0,'The projection assumes Nabers returns near Week 1 and regains his alpha target share, while allowing for an early-season ramp-up after the knee injury.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','Fantasy On SI update','https://www.si.com/onsi/fantasy/rankings/2026-updated-fantasy-football-projections-every-position-ppr-standard-malik-nabers','Ball Knower preseason snapshot v1'),
('brock-bowers','Brock Bowers','LV','TE',22,2,176.2,238.0,'Bowers averaged 14.7 PPR points in the 12 games he played. Better health over a full season creates the increase, with quarterback volatility still limiting the ceiling.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','Ball Knower editorial projection',null,'Ball Knower preseason snapshot v1'),
('josh-jacobs','Josh Jacobs','GB','RB',23,12,237.1,230.0,'Jacobs remains the preferred early-down and goal-line back, but age and the possibility of a slightly lighter workload keep the projection just below 2025.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','Ball Knower editorial projection',null,'Ball Knower preseason snapshot v1'),
('nico-collins','Nico Collins','HOU','WR',24,9,226.2,252.0,'Collins maintained elite per-game efficiency while missing two games. A healthier season and stable downfield role support the increase, though target competition remains.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','Ball Knower editorial projection',null,'Ball Knower preseason snapshot v1'),
('lamar-jackson','Lamar Jackson','BAL','QB',25,2,214.9,379.5,'Jackson played only 13 games in 2025. The rebound is driven by a healthier games-played assumption and his unmatched rushing ceiling, not by treating last season’s absence as lost ability.','gamedai 2025 final PPR rankings','https://gamedai.app/tools/rankings','CBS Sports 2026 PPR projections','https://new.cbssports.com/fantasy/football/stats/QB/2025/6/projections/ppr/','Ball Knower preseason snapshot v1')
on conflict (player_key, season, scoring_format) do update set
  player_name=excluded.player_name, team=excluded.team, position=excluded.position,
  overall_rank=excluded.overall_rank, position_rank=excluded.position_rank,
  actual_points_2025=excluded.actual_points_2025, projected_points_2026=excluded.projected_points_2026,
  projection_reason=excluded.projection_reason, actual_source_name=excluded.actual_source_name,
  actual_source_url=excluded.actual_source_url, projection_source_name=excluded.projection_source_name,
  projection_source_url=excluded.projection_source_url, projection_model=excluded.projection_model,
  updated_at=now();
