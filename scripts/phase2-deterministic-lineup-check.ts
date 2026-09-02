import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareLineupPlayers, LINEUP_SLOTS, optimizeWeeklyLineup, resolveWeeklyProjection } from '../fantasyLineup';
import type { Player } from '../types';

const player=(id:string,position:Player['position'],ovr=80):Player=>({
  id,name:`Tied ${position}`,team:'TST',teamCity:'Test',position,ovr,salary:1,
  attributes:{athleticism:80,footballIQ:80},
});
const roster:Player[]=[
  player('qb-b','QB'),player('qb-a','QB'),player('rb-c','RB'),player('rb-a','RB'),player('rb-b','RB'),
  player('wr-c','WR'),player('wr-a','WR'),player('wr-b','WR'),player('te-b','TE'),player('te-a','TE'),
  player('k-b','K'),player('k-a','K'),player('dst-b','DST'),player('dst-a','DST'),
];

const expected=optimizeWeeklyLineup(roster);
assert.deepEqual(optimizeWeeklyLineup([...roster].reverse()),expected,'roster order must not change starters');
assert.deepEqual(optimizeWeeklyLineup([...roster].sort(compareLineupPlayers)),expected,'pre-sorting must not change starters');
assert.equal(new Set(Object.values(expected)).size,Object.values(expected).length,'a player may start only once');
for(const slot of LINEUP_SLOTS){
  const selected=roster.find(item=>item.id===expected[slot.id]);
  assert.ok(selected&&slot.accept(selected),`${slot.id} must contain an eligible player`);
}
const weekOne=[{playerId:'qb-a',projectedPoints:{standard:18,half_ppr:19,ppr:20}}];
const weekTwo=[{playerId:'qb-a',projectedPoints:{standard:24,half_ppr:25,ppr:26}}];
assert.equal(resolveWeeklyProjection('qb-a',weekOne,'ppr',false),20,'selected-week PPR projection must be used');
assert.equal(resolveWeeklyProjection('qb-a',weekTwo,'standard',false),24,'selected-week standard projection must be used');
assert.equal(resolveWeeklyProjection('qb-a',weekOne,'ppr',true),null,'custom scoring must not invent a compatible projection');
assert.equal(resolveWeeklyProjection('missing',weekOne,'ppr',false),null,'missing weekly data must remain unavailable');
assert.equal(resolveWeeklyProjection('missing',weekOne,'ppr',false,340,17,true),20,'a verified 17-game schedule may use season projection pace before weekly projections publish');
assert.equal(resolveWeeklyProjection('missing',weekOne,'ppr',false,340,17,false),0,'a verified bye must project zero points');
assert.equal(resolveWeeklyProjection('missing',weekOne,'ppr',false,340,16,true),null,'an incomplete schedule must not invent a weekly projection');
assert.equal(resolveWeeklyProjection('missing',weekOne,'ppr',false,null,17,true),null,'a missing season projection must not become a false zero');
assert.equal(resolveWeeklyProjection('missing',weekOne,'ppr',true,340,17,true),null,'season pace must not be applied to incompatible custom scoring');

const api=readFileSync(new URL('../api/fantasy-live-scoring.ts',import.meta.url),'utf8');
assert.match(api,/\.sort\(compare\)\.map\(player=>player\.id\)/,'server bench must be deterministic');
const serverLineupStart=api.indexOf('function defaultLineup');
const serverLineupEnd=api.indexOf('async function processHistoricalBackfill');
assert.ok(serverLineupStart>=0&&serverLineupEnd>serverLineupStart,'server lineup function range must be present');
assert.doesNotMatch(api.slice(serverLineupStart,serverLineupEnd),/localeCompare/,'server lineup ordering must not depend on runtime locale');
assert.match(api,/if\(!lineup\)\{[\s\S]*defaultLineup/,'saved authoritative lineups must take precedence');
assert.match(api,/opponent:game\?matchupForTeam/,'server score details must expose the opponent');
const screen=readFileSync(new URL('../FantasyLeaguePostDraft.tsx',import.meta.url),'utf8');
const lineupRules=readFileSync(new URL('../fantasyLineup.ts',import.meta.url),'utf8');
assert.doesNotMatch(lineupRules,/localeCompare/,'shared lineup ordering must not depend on runtime locale');
assert.match(screen,/const authoritative = scores\.find[\s\S]*if \(authoritative\?\.players\.length\) return authoritative/,'authoritative scores must take precedence');
assert.match(screen,/saved\?\.starters[\s\S]*buildFantasyLineup/,'saved lineups must precede deterministic fallback lineups');
assert.match(screen,/resolveWeeklyProjection\([\s\S]*weeklyProjections[\s\S]*Object\.keys\(settings\.customScoring/,'matchup fallback must use the tested weekly projection resolver');
assert.match(screen,/rankingsByPlayerKey\.get\(player\.id\)/,'D\/ST and other permanent player keys must resolve projections without fragile display-name matching');
assert.match(screen,/verifiedTeamGames\.length[\s\S]*verifiedTeamGames\.some/,'season-pace projections must require a complete team schedule and the selected-week matchup');
assert.match(screen,/const homeScore = matchupScoreFor\(home\)[\s\S]*const awayScore = matchupScoreFor\(away\)/,'every matchup card must receive projected totals without waiting for weekly score rows');
assert.match(screen,/player\.opponent[\s\S]*player\.isHome === false \? "@" : "vs"/,'matchup rows must display the verified opponent and home/away designation');
assert.ok(screen.includes('"Opponent unavailable"'),'missing opponent metadata must not be mislabeled as a bye');

console.log('Phase 2 deterministic lineup checks passed.');
