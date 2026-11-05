import assert from 'node:assert/strict';
import { normalizeCareerProfile } from '../careerProfileState';
import { defaultCareer } from '../soloSeasonEngine';

for (const malformed of [null, undefined, false, 5, 'saved', [], ['achievement']]) {
  assert.deepEqual(normalizeCareerProfile(malformed), defaultCareer());
}
assert.deepEqual(normalizeCareerProfile({ achievements: { length: 2 }, championships: -1, regularWins: '8', playoffWins: Infinity, bestRecord: {}, bestScore: NaN }), defaultCareer());
const partial = normalizeCareerProfile({ championships: 2, regularWins: 18, achievements: ['Champion', null, {}, 'Champion', ''], bestRecord: '17-0', bestScore: 103 });
assert.equal(partial.championships, 2);
assert.equal(partial.regularWins, 18);
assert.equal(partial.bestRecord, '17-0');
assert.equal(partial.bestScore, 100);
assert.deepEqual(partial.achievements, ['Champion']);
assert.equal(partial.regularLosses, 0);
console.log('Career profile restoration passed: malformed and partial saves preserve valid progress without crashing.');
