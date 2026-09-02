import assert from 'node:assert/strict';
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
  Passing: { passYds: 250, passTD: 2, int: 1 },
  Rushing: { rushYds: 25, rushTD: 1 },
  Receiving: { receptions: 3, recYds: 30 },
});
assert.equal(scoreFantasyPlayer(playerStats, 'standard').total, 27.5);
assert.equal(scoreFantasyPlayer(playerStats, 'half_ppr').total, 29);
assert.equal(scoreFantasyPlayer(playerStats, 'ppr').total, 30.5);

const defenseStats = normalizeTank01DefenseStats({
  sacks: 3,
  defensiveInterceptions: 2,
  fumblesRecovered: 1,
  defTD: 1,
  safeties: 1,
  blockKick: 1,
  ptsAllowed: 10,
});
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

console.log('Fantasy live-scoring reliability checks passed: PostgREST lineup shape, provider dedupe, scoring, D/ST, statuses, projections, and UTC kickoff handling.');
