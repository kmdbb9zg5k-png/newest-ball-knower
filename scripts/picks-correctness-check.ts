import assert from 'node:assert/strict';
import { gradePick, isPicksGameLocked, normalizeSpread, SavedPick } from '../picksEngine';

assert.deepEqual(normalizeSpread(3.5), { home: -3.5, away: 3.5 }, 'positive provider line means home favorite');
assert.deepEqual(normalizeSpread(-2.5), { home: 2.5, away: -2.5 }, 'negative provider line means away favorite');
assert.deepEqual(normalizeSpread(0), { home: 0, away: 0 }, 'pick-em must show both teams at PK');

const future = { id: 'future', away: 'Away', home: 'Home', date: '2099-01-01T00:00:00Z', status: 'Scheduled' };
const started = { ...future, id: 'started', date: '2020-01-01T00:00:00Z' };
assert.equal(isPicksGameLocked(future, Date.parse('2026-08-30T00:00:00Z')), false);
assert.equal(isPicksGameLocked(started, Date.parse('2026-08-30T00:00:00Z')), true);
assert.equal(isPicksGameLocked({ ...future, status: 'Final' }, 0), true);

const base: SavedPick = { id: 'p', gameId: 'g', label: 'Home -3', market: 'spread', selection: 'Home', lockedLine: -3, lockedAt: '2026-01-01T00:00:00Z' };
const final = { id: 'g', away: 'Away', home: 'Home', status: 'Final', awayScore: 20, homeScore: 24 };
assert.equal(gradePick(base, final).result, 'win');
assert.equal(gradePick({ ...base, lockedLine: -4 }, final).result, 'push');
assert.equal(gradePick({ ...base, lockedLine: -5 }, final).result, 'loss');
const once = gradePick(base, final, '2026-01-02T00:00:00Z');
assert.deepEqual(gradePick(once, { ...final, awayScore: 0, homeScore: 99 }, '2026-01-03T00:00:00Z'), once, 'repeat jobs/stat changes must not rewrite an already graded pick');
assert.equal(gradePick({ ...base, market: 'total', selection: 'over', lockedLine: 44 }, final).result, 'push');

console.log('Picks correctness checks passed: spread semantics, kickoff locks, W/L/push grading, and idempotent history.');
