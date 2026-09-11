import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapProgressProfile } from '../progressionCloud';

const migration = readFileSync(new URL('../migrations/20260911033000_start_bk_ratings_at_zero.sql', import.meta.url), 'utf8');
const zeroProfile = mapProgressProfile({
  user_id: 'fixture-user',
  display_name: 'New GM',
  bk_rating: 0,
  xp: 0,
  level: 1,
  football_iq: 0,
  gm_rating: 0,
  prediction_rating: 0,
  trivia_rating: 0,
  agent_rating: 0,
  owner_rating: 0,
  championships: 0,
  current_streak: 0,
  longest_streak: 0,
  updated_at: '2026-09-11T00:00:00Z',
});

assert.equal(zeroProfile.bkRating, 0, 'A real server zero must never be replaced by a truthy fallback');
assert.deepEqual(
  [zeroProfile.footballIq, zeroProfile.gmRating, zeroProfile.predictionRating, zeroProfile.triviaRating, zeroProfile.agentRating, zeroProfile.ownerRating],
  [0, 0, 0, 0, 0, 0],
  'Every earned rating category must start at zero',
);
assert.equal(mapProgressProfile({ user_id: 'missing', display_name: 'Missing', level: 1 }).bkRating, 0, 'Missing ratings must fail closed to zero');
assert.match(migration, /alter column bk_rating set default 0/i);
for (const column of ['football_iq', 'gm_rating', 'prediction_rating', 'trivia_rating', 'agent_rating', 'owner_rating']) {
  assert.match(migration, new RegExp(`alter column ${column} set default 0`, 'i'));
}
assert.match(migration, /v_football_iq integer := 0/);
assert.match(migration, /perform ball_knower_private\.rebuild_progress_profile\(v_user_id\)/);
for (const key of ['bk_rating', 'football_iq', 'gm_rating', 'prediction_rating', 'trivia_rating', 'agent_rating', 'owner_rating']) {
  assert.doesNotMatch(migration, new RegExp(`'${key}',\\s*50`), `${key} must not retain a public-profile fallback of 50`);
}

console.log('Profile rating checks passed: all seven ratings start at zero, client zeros survive mapping, and existing profiles rebuild from verified events.');
