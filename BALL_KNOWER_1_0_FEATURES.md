# BALL KNOWER 1.0 — Full Game Build

## Solo: Road to the Super Bowl
- Week-by-week 17-game season. No instant season dump.
- GameDay matchup screen before every week.
- Persistent regular-season record, projected playoff seed and playoff odds.
- Player box-score lines for QB/RB/WR/TE/defenders/K/P.
- Team leaders accumulated across the season.
- Optional injuries: Off / Normal / Chaos.
- Injury durations persist week-to-week and lower team strength.
- Two optional FLEX bench spots; matching backups reduce injury penalties.
- Wild Card → Divisional → Conference Championship → Super Bowl LXI.
- Season awards: Team MVP, Offensive Player of the Year, Defensive Player of the Year.
- Achievements: 15-win monster, perfect season, champion, cap wizard, moneyball and more.
- Career history persisted locally: runs, W-L, playoff wins, rings, best record, best BK score.
- Shareable result text using Web Share API / clipboard fallback.
- Difficulty settings: Rookie, Pro, All-Pro, All-Madden.
- In-progress solo runs restore after closing/reopening the app.

## Hall of Fame
- Local trophy case and career summary.
- Cloud leaderboard hooks via Supabase.
- Online rankings prioritize championships and Ball Knower score.
- Completed Solo careers auto-publish when cloud multiplayer is configured.

## Multiplayer / Commissioner
- Real cloud invite codes and invite URLs through Supabase.
- Realtime member/lobby/roster sync.
- Commissioner-selectable 16- or 17-game league season.
- Simulation style: Realistic / Balanced / Chaos; actually changes score variance.
- AI difficulty setting stored with league settings.
- Salary-cap controls.
- AI fill, member removal, roster submission and season results sync to cloud.

## Draft / Team Building
- Official 2026 gameplay cap target: $301.2M.
- 20 required starters: QB1 RB1 WR2 TE1 OL4 DL/EDGE3 LB2 CB2 S2 K1 P1.
- Smart cap-completion guard.
- Smart AI draft valuation and multiple GM philosophies.
- Draft grades and Ball Knower score.
- K/P integrated into roster logic and special-team value.
- Verified-cap-hit metadata supported; legacy estimates remain visibly distinguishable.

## Backend files
- `supabase/ball_knower.sql`
- `.env.example`
- `ONLINE_INVITES_SETUP.md`

Do not put a Supabase service-role key in the client.
