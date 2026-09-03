import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  dedupeProviderPlayerRows,
  weeklyLineupWritePayload,
} from '../api/fantasy-live-scoring';
import {
  isFinalGameStatus,
  isLiveGameStatus,
  kickoffIsoFromTank01Game,
  liveProjectedPoints,
  normalizeTank01DefenseStats,
  normalizeTank01PlayerStats,
  scoreFantasyDefense,
  scoreFantasyPlayer,
} from '../fantasyLiveScoring';

const existingLineup = {
  id: '7d0d7700-74dd-4d43-8f74-2a90d3f9283e',
  league_id: 'league-1',
  member_id: 'member-1',
  week_number: 1,
  starters: { QB: 'qb-1' },
  bench: [],
  locked: false,
  locked_player_ids: [],
  submitted_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
};
const newLineup = {
  league_id: 'league-1',
  member_id: 'member-2',
  week_number: 1,
  starters: { QB: 'qb-2' },
  bench: [],
  locked: false,
  locked_player_ids: [],
  submitted_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
};
const lineupWrites = [existingLineup, newLineup].map(lineup => weeklyLineupWritePayload(lineup, {
  locked_player_ids: [],
  updated_at: '2026-09-02T00:00:00.000Z',
}));
assert.ok(lineupWrites.every(row => !Object.hasOwn(row, 'id')), 'bulk lineup upserts must omit generated ids for both existing and new rows');
assert.deepEqual(Object.keys(lineupWrites[0]).sort(), Object.keys(lineupWrites[1]).sort(), 'bulk lineup rows must use one PostgREST column shape');

const duplicateProviderRows = dedupeProviderPlayerRows([
  { playerID: 'tank-1', passYds: 100 },
  { playerID: 'tank-2', passYds: 75 },
  { playerID: 'tank-1', passYds: 125 },
  { playerName: 'missing permanent id' },
]);
assert.equal(duplicateProviderRows.length, 2, 'duplicate or unidentified provider records must not create duplicate score writes');
assert.equal(duplicateProviderRows.find(row => row.playerID === 'tank-1')?.passYds, 125, 'the latest provider snapshot must win deterministically');

const playerStats = normalizeTank01PlayerStats({
  Passing: { passAttempts: 34, passCompletions: 22, passYds: 250, passTD: 2, int: 1 },
  Rushing: { rushAttempts: 6, rushYds: 25, rushTD: 1 },
  Receiving: { targets: 5, receptions: 3, recYds: 30 },
});
assert.equal(playerStats.passingAttempts,34,'QB passing attempts must survive provider normalization');
assert.equal(playerStats.passingCompletions,22,'QB completions must survive provider normalization');
assert.equal(playerStats.rushingAttempts,6,'carries/rushing attempts must survive provider normalization');
assert.equal(playerStats.targets,5,'targets must survive provider normalization');
assert.equal(scoreFantasyPlayer(playerStats, 'standard').total, 27.5);
assert.equal(scoreFantasyPlayer(playerStats, 'half_ppr').total, 29);
assert.equal(scoreFantasyPlayer(playerStats, 'ppr').total, 30.5);

const aliases=normalizeTank01PlayerStats({
  passing:{att:31,cmp:20,passingYards:240,passingTDs:1},
  rushing:{carries:4,rushingYards:20},
  receiving:{targets:7,receptions:4,receivingYards:55},
  kicking:{fgMade:2,fgMissed:1,xpMade:3,xpMissed:0},
});
assert.equal(aliases.passingAttempts,31,'category-scoped Tank01 att alias must normalize to passingAttempts');
assert.equal(aliases.passingCompletions,20,'category-scoped cmp alias must normalize to passingCompletions');
assert.equal(aliases.rushingAttempts,4,'category-scoped carries alias must normalize to rushingAttempts');
assert.equal(aliases.targets,7);
assert.equal(aliases.fieldGoalsAttempted,3,'known FG made/missed parts may derive attempts');
assert.equal(aliases.extraPointsAttempted,3,'known XP made/missed parts may derive attempts');
const unavailableUsage=normalizeTank01PlayerStats({Passing:{passYds:100}});
assert.equal(Object.hasOwn(unavailableUsage,'passingAttempts'),false,'missing provider passing attempts must remain unavailable, not fabricated as zero');
assert.equal(Object.hasOwn(unavailableUsage,'targets'),false,'missing provider targets must remain unavailable, not fabricated as zero');
assert.equal(Object.hasOwn(unavailableUsage,'fieldGoalsAttempted'),false,'kicking attempts must not be invented when made/missed source fields are absent');

const defenseStats = normalizeTank01DefenseStats({
  sacks: 3,
  defensiveInterceptions: 2,
  fumblesRecovered: 1,
  defTD: 1,
  safeties: 1,
  blockKick: 1,
  ptsAllowed: 10,
});
assert.equal(defenseStats.fumbleRecoveries,1,'D/ST fumble recoveries must use the canonical stat key');
assert.equal(defenseStats.pointsAllowed,10,'D/ST points allowed must remain available to both scoring and the game log');
assert.equal(scoreFantasyDefense(defenseStats), 23);

assert.equal(isFinalGameStatus('Final'), true);
assert.equal(isFinalGameStatus('Completed'), true);
assert.equal(isLiveGameStatus('Q4'), true);
assert.equal(isLiveGameStatus('Halftime'), true);
assert.equal(isLiveGameStatus('Delayed'), false);
assert.equal(isLiveGameStatus('Postponed'), false);
assert.equal(liveProjectedPoints(18.4, 15, 'Final', 4), 18.4, 'actual points must replace projections only when final');
assert.equal(liveProjectedPoints(6, 16, 'Delayed', 1), 16, 'delayed games must retain the pregame projection');
assert.equal(kickoffIsoFromTank01Game({ gameTime_epoch: 1788751800 }), '2026-09-07T03:30:00.000Z', 'kickoff timestamps must remain UTC-stable across midnight boundaries');

const apiSource=readFileSync(new URL('../api/fantasy-live-scoring.ts',import.meta.url),'utf8');
for(const key of ['passingAttempts','passingCompletions','rushingAttempts','targets','fieldGoalsAttempted','extraPointsAttempted']){
  assert.ok(apiSource.includes(key),`self-contained Vercel scorer must mirror canonical ${key} normalization`);
}
for(const key of ['fumbleRecoveries','pointsAllowed'])assert.ok(apiSource.includes(key),`D/ST ${key} must remain canonical in the Vercel scorer`);
assert.ok(apiSource.includes('stats:normalizeTank01PlayerStats(playerRaw)'),'historical backfill must persist the same canonical player stat object used by live scoring');

console.log('Fantasy live-scoring reliability checks passed: PostgREST lineup shape, provider dedupe, canonical usage stats, scoring, D/ST, statuses, projections, and UTC kickoff handling.');
