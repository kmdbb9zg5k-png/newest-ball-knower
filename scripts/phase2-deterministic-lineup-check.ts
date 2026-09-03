import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compareLineupPlayers, LINEUP_SLOTS, movePlayerIntoLineupSlot, optimizeWeeklyLineup, resolveWeeklyProjection } from '../fantasyLineup';
import { validateWeeklyLineup } from '../fantasyLeagueParityCloud';
import type { Player } from '../types';

const player=(id:string,position:Player['position'],ovr=80):Player=>({
  id,name:`Tied ${position}`,team:'TST',teamCity:'Test',position,ovr,salary:1,
  attributes:{athleticism:80,footballIQ:80},
});
const roster:Player[]=[
  player('qb-b','QB',99),player('qb-a','QB',50),player('rb-c','RB'),player('rb-a','RB'),player('rb-b','RB'),
  player('wr-c','WR'),player('wr-a','WR'),player('wr-b','WR'),player('te-b','TE'),player('te-a','TE'),
  player('k-b','K'),player('k-a','K'),player('dst-b','DST'),player('dst-a','DST'),
];

const expected=optimizeWeeklyLineup(roster);
assert.deepEqual(optimizeWeeklyLineup([...roster].reverse()),expected,'roster order must not change starters');
assert.deepEqual(optimizeWeeklyLineup([...roster].sort(compareLineupPlayers)),expected,'pre-sorting must not change starters');
assert.equal(expected.QB,'qb-a','shared fantasy optimization must use the neutral deterministic fallback, not Madden OVR');
assert.equal(compareLineupPlayers(player('same-a','QB',1),player('same-b','QB',99))<0,true,'Madden OVR must not change the neutral fantasy fallback ordering');
assert.equal(new Set(Object.values(expected)).size,Object.values(expected).length,'a player may start only once');
for(const slot of LINEUP_SLOTS){
  const selected=roster.find(item=>item.id===expected[slot.id]);
  assert.ok(selected&&slot.accept(selected),`${slot.id} must contain an eligible player`);
}

const legalStarters:Record<string,string>={QB:'qb-a',RB1:'rb-a',RB2:'rb-b',WR1:'wr-a',WR2:'wr-b',TE:'te-a',FLEX:'rb-c',K:'k-a',DST:'dst-a'};
assert.deepEqual(validateWeeklyLineup(roster,legalStarters),[],'a complete legal FLEX lineup must validate');

const benchWrToFlex=movePlayerIntoLineupSlot(roster,legalStarters,'FLEX','wr-c');
assert.equal(benchWrToFlex.changed,true,'an eligible bench WR must be startable at FLEX');
assert.equal(benchWrToFlex.starters.FLEX,'wr-c');
assert.equal(new Set(Object.values(benchWrToFlex.starters)).size,Object.values(benchWrToFlex.starters).length,'bench-to-FLEX must not duplicate a starter');

const rbStarterSwap=movePlayerIntoLineupSlot(roster,legalStarters,'FLEX','rb-a');
assert.equal(rbStarterSwap.starters.FLEX,'rb-a','RB1 must be able to move directly to FLEX');
assert.equal(rbStarterSwap.starters.RB1,'rb-c','the displaced FLEX RB must atomically move into RB1');
assert.deepEqual(validateWeeklyLineup(roster,rbStarterSwap.starters),[],'RB starter/FLEX exchange must remain legal');

const wrFlexBase={...legalStarters,FLEX:'wr-c'};
const wrStarterSwap=movePlayerIntoLineupSlot(roster,wrFlexBase,'FLEX','wr-a');
assert.equal(wrStarterSwap.starters.FLEX,'wr-a','WR1 must be able to move directly to FLEX');
assert.equal(wrStarterSwap.starters.WR1,'wr-c','the displaced FLEX WR must atomically move into WR1');
assert.deepEqual(validateWeeklyLineup(roster,wrStarterSwap.starters),[],'WR starter/FLEX exchange must remain legal');

const teFlexBase={...legalStarters,FLEX:'te-b'};
const teStarterSwap=movePlayerIntoLineupSlot(roster,teFlexBase,'FLEX','te-a');
assert.equal(teStarterSwap.starters.FLEX,'te-a','TE must be able to move directly to FLEX');
assert.equal(teStarterSwap.starters.TE,'te-b','the displaced FLEX TE must atomically move into TE');
assert.deepEqual(validateWeeklyLineup(roster,teStarterSwap.starters),[],'TE starter/FLEX exchange must remain legal');

const flexToRb=movePlayerIntoLineupSlot(roster,legalStarters,'RB1','rb-c');
assert.equal(flexToRb.starters.RB1,'rb-c','a FLEX RB must be movable into a dedicated RB slot');
assert.equal(flexToRb.starters.FLEX,'rb-a','the displaced RB starter must take FLEX when eligible');
assert.deepEqual(validateWeeklyLineup(roster,flexToRb.starters),[],'FLEX-to-RB exchange must remain legal');

for(const [id,label] of [['qb-a','QB'],['k-a','K'],['dst-a','D/ST']] as const){
  const illegal=movePlayerIntoLineupSlot(roster,legalStarters,'FLEX',id);
  assert.equal(illegal.changed,false,`${label} must be rejected from FLEX`);
  assert.deepEqual(illegal.starters,legalStarters,`${label} rejection must not mutate starters`);
}
const lockedSource=movePlayerIntoLineupSlot(roster,legalStarters,'FLEX','rb-a',['rb-a']);
assert.equal(lockedSource.changed,false,'a locked source starter cannot move');
const lockedTarget=movePlayerIntoLineupSlot(roster,legalStarters,'FLEX','wr-c',['rb-c']);
assert.equal(lockedTarget.changed,false,'a locked target starter cannot be displaced');
for(const result of [benchWrToFlex,rbStarterSwap,wrStarterSwap,teStarterSwap,flexToRb]){
  const ids=Object.values(result.starters).filter(Boolean);
  assert.equal(new Set(ids).size,ids.length,'no FLEX operation may produce duplicate starter IDs');
}
const illegalFlex={...legalStarters,FLEX:'qb-b'};
assert.ok(validateWeeklyLineup(roster,illegalFlex).some(error=>error.includes('not eligible for FLEX')),'client lineup validation must reject an illegal FLEX player');

const projectionComparator=(a:Player,b:Player)=>{
  const values:Record<string,number>={'qb-b':30,'qb-a':10};
  return (values[b.id]||0)-(values[a.id]||0)||compareLineupPlayers(a,b);
};
assert.equal(optimizeWeeklyLineup(roster,projectionComparator).QB,'qb-b','a caller-provided fantasy projection comparator must beat neutral fallback and Madden OVR');

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
assert.doesNotMatch(lineupRules,/\.ovr|\['ovr'\]|\["ovr"\]/,'shared standard-fantasy lineup selection must not depend on Madden OVR');
assert.match(screen,/const authoritative = scores\.find[\s\S]*if \(authoritative\?\.players\.length\) return authoritative/,'authoritative scores must take precedence');
assert.match(screen,/saved\?\.starters[\s\S]*buildFantasyLineup/,'saved lineups must precede deterministic fallback lineups');
assert.match(screen,/resolveWeeklyProjection\([\s\S]*weeklyProjections[\s\S]*Object\.keys\(settings\.customScoring/,'matchup fallback must use the tested weekly projection resolver');
assert.match(screen,/rankingsByPlayerKey\.get\(player\.id\)/,'D\/ST and other permanent player keys must resolve projections without fragile display-name matching');
assert.match(screen,/verifiedTeamGames\.length[\s\S]*verifiedTeamGames\.some/,'season-pace projections must require a complete team schedule and the selected-week matchup');
assert.match(screen,/const homeScore = matchupScoreFor\(home\)[\s\S]*const awayScore = matchupScoreFor\(away\)/,'every matchup card must receive projected totals without waiting for weekly score rows');
assert.match(screen,/player\.opponent[\s\S]*player\.isHome === false \? "@" : "vs"/,'matchup rows must display the verified opponent and home/away designation');
assert.ok(screen.includes('"Opponent unavailable"'),'missing opponent metadata must not be mislabeled as a bye');

const serverSql=readFileSync(new URL('../migrations/20260827_fantasy_playoffs_lineups_and_draft_intelligence.sql',import.meta.url),'utf8');
assert.ok(serverSql.includes("array['DST','FLEX','K','QB','RB1','RB2','TE','WR1','WR2']"),'server RPC must require the exact standard fantasy starter slots');
assert.ok(serverSql.includes("v_slot='FLEX' and v_position not in ('RB','FB','WR','TE')"),'server RPC must keep FLEX limited to RB/FB/WR/TE');
assert.ok(serverSql.includes("v_slot in ('RB1','RB2') and v_position not in ('RB','FB')"),'server RPC must preserve RB/FB eligibility parity with the client');

console.log('Phase 2 deterministic lineup checks passed: FLEX movement, lock safety, projection ordering, and client/server parity.');
