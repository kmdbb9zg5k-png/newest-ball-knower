import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  compactGauntletProgressForCloud,
  mergeGauntletProgress,
  mergeGauntletProgressEvents,
  recordGauntletAnswer,
  recordGauntletRun,
  type GauntletProgress,
} from '../gauntletEngine';

const empty: GauntletProgress = {
  xp: 0, level: 1, currentStreak: 0, longestStreak: 0,
  totalCorrect: 0, totalAnswered: 0, highScores: {}, daily: {},
};

// Device A and Device B represent different localStorage environments, but the
// same permanent Supabase UUID. Device B must rebuild the exact aggregate from
// the compact account snapshot plus the account's immutable event rows.
const permanentIdentity = 'same-permanent-user';
let deviceA = recordGauntletAnswer(empty, true, 25, {
  id: `${permanentIdentity}:answer:1`, occurredAt: 100,
});
deviceA = recordGauntletAnswer(deviceA, true, 25, {
  id: `${permanentIdentity}:answer:2`, occurredAt: 200,
});
deviceA = recordGauntletAnswer(deviceA, false, 25, {
  id: `${permanentIdentity}:answer:3`, occurredAt: 300,
});
deviceA = recordGauntletAnswer(deviceA, true, 40, {
  id: `${permanentIdentity}:answer:4`, occurredAt: 400,
});
deviceA = recordGauntletRun(deviceA, 'FILM ROOM:ALL-PRO', 10, 10, '2026-08-29', {
  id: `${permanentIdentity}:run:1`, occurredAt: 500,
});

const accountSnapshot = compactGauntletProgressForCloud(deviceA);
const accountEvents = Object.values(deviceA.sync?.events || {});
let deviceB = mergeGauntletProgress(empty, accountSnapshot);
deviceB = mergeGauntletProgressEvents(deviceB, accountEvents);

for (const field of ['xp', 'level', 'currentStreak', 'longestStreak', 'totalCorrect', 'totalAnswered'] as const) {
  assert.equal(deviceB[field], deviceA[field], `Device B must restore identical ${field}.`);
}
assert.deepEqual(deviceB.highScores, deviceA.highScores, 'Device B must restore identical high scores.');
assert.deepEqual(deviceB.daily, deviceA.daily, 'Device B must restore identical Daily completion.');
const repeatedDeviceB = mergeGauntletProgressEvents(deviceB, accountEvents);
assert.equal(repeatedDeviceB.xp, deviceA.xp, 'Repeated account sync cannot duplicate XP.');
assert.equal(repeatedDeviceB.totalAnswered, deviceA.totalAnswered, 'Repeated account sync cannot duplicate answers.');

const migration = readFileSync(new URL('../migrations/20260829_permanent_identity_guest_merge.sql', import.meta.url), 'utf8');
assert(migration.includes('prepare_ball_knower_guest_merge'), 'Guest sign-in must prepare a one-time claim.');
assert(migration.includes('claim_ball_knower_guest_merge'), 'Permanent sign-in must claim guest-owned rows.');
assert(migration.includes("on conflict(user_id,event_id) do nothing"), 'Gauntlet event migration must be idempotent.');
assert(migration.includes("on conflict(user_id,event_key) do nothing"), 'Verified progression migration must be idempotent.');
assert(migration.includes('commissioner_auth_id=v_target'), 'Guest commissioner ownership must transfer.');
assert(migration.includes('is_anonymous'), 'Claims must enforce guest-to-permanent identity boundaries.');

const identityClient = readFileSync(new URL('../accountIdentity.ts', import.meta.url), 'utf8');
assert(identityClient.includes("saveUserState('gauntlet_progress_v2'"), 'Latest guest snapshot must flush before sign-in.');
assert(identityClient.includes('mergeGauntletProgressEvents'), 'Permanent account hydration must use canonical events.');
assert(identityClient.includes('signInWithOAuth'), 'Google and Apple must use real Supabase OAuth.');

const cloudProvider = readFileSync(new URL('../CloudSyncProvider.tsx', import.meta.url), 'utf8');
assert(cloudProvider.includes('claimPendingGuestAccountMerge'), 'Cloud bootstrap must claim guest progress before clearing local state.');

console.log('Account identity check passed: guest claim is one-time/idempotent and Device B restores Device A progression exactly.');
