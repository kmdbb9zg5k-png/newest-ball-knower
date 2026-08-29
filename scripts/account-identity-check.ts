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
import {
  flushAllCloudStateBeforeIdentityChange,
  registerFullCloudStateFlush,
} from '../cloudSyncCoordinator';
import { recoverTerminalGuestMerge } from '../guestMergeRecovery';

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

for (const [message, expected] of [
  ['Guest merge token expired', 'expired'],
  ['Guest merge token is invalid', 'invalid'],
  ['Guest progress was already claimed by another account', 'already_claimed'],
] as const) {
  let clears = 0;
  assert.equal(
    recoverTerminalGuestMerge({ code: 'P0001', message }, () => { clears += 1; }),
    expected,
    `${expected} claims must be terminal.`,
  );
  assert.equal(clears, 1, `${expected} claims must clear the pending token exactly once.`);
}
let retryableClears = 0;
assert.equal(
  recoverTerminalGuestMerge({ message: 'Failed to fetch' }, () => { retryableClears += 1; }),
  null,
  'Network failures must remain retryable.',
);
assert.equal(retryableClears, 0, 'Retryable failures must preserve the pending token.');

const newestGuestModes = {
  solo_career: { season: 4, wins: 11 },
  solo_real_team: { week: 9 },
  owner_business_career_v1: { reputation: 58 },
  player_agent_career: { clients: 3 },
};
const guestCloudModes = {
  solo_career: { season: 3, wins: 7 },
  solo_real_team: { week: 8 },
  owner_business_career_v1: { reputation: 45 },
  player_agent_career: { clients: 2 },
};
const unregisterFlush = registerFullCloudStateFlush(async () => {
  await Promise.resolve();
  Object.assign(guestCloudModes, newestGuestModes);
});
await flushAllCloudStateBeforeIdentityChange();
unregisterFlush();
assert.deepEqual(
  guestCloudModes,
  newestGuestModes,
  'An immediate sign-in must await the newest Franchise/Solo/Owner/Agent cloud state.',
);

const migration = readFileSync(new URL('../migrations/20260829_permanent_identity_guest_merge.sql', import.meta.url), 'utf8');
assert(migration.includes('prepare_ball_knower_guest_merge'), 'Guest sign-in must prepare a one-time claim.');
assert(migration.includes('claim_ball_knower_guest_merge'), 'Permanent sign-in must claim guest-owned rows.');
assert(migration.includes("on conflict(user_id,event_id) do nothing"), 'Gauntlet event migration must be idempotent.');
assert(migration.includes("on conflict(user_id,event_key) do nothing"), 'Verified progression migration must be idempotent.');
assert(migration.includes('commissioner_auth_id=v_target'), 'Guest commissioner ownership must transfer.');
assert(migration.includes('is_anonymous'), 'Claims must enforce guest-to-permanent identity boundaries.');

const hardeningMigration = readFileSync(new URL('../migrations/20260829_harden_permanent_account_guest_merge.sql', import.meta.url), 'utf8');
for (const table of ['ball_knower_leaderboard', 'ball_knower_owner_profiles']) {
  assert(hardeningMigration.includes(`insert into public.${table}`), `${table} must merge into the permanent identity.`);
  assert(hardeningMigration.includes(`delete from public.${table}`), `${table} must not leave a stale guest row.`);
}
assert(hardeningMigration.includes('merge_guest_account_aggregates_on_claim'), 'Aggregate merging must be atomic with the claim transaction.');
const backfillMigration = readFileSync(new URL('../migrations/20260829_backfill_permanent_account_claim_aggregates.sql', import.meta.url), 'utf8');
assert(backfillMigration.includes('set claimed_at=claimed_at'), 'Already-completed claims must receive a one-time aggregate backfill.');

const identityClient = readFileSync(new URL('../accountIdentity.ts', import.meta.url), 'utf8');
assert(identityClient.includes("saveUserState('gauntlet_progress_v2'"), 'Latest guest snapshot must flush before sign-in.');
assert(identityClient.includes('mergeGauntletProgressEvents'), 'Permanent account hydration must use canonical events.');
assert(identityClient.includes('signInWithOAuth'), 'Google and Apple must use real Supabase OAuth.');
assert(
  identityClient.indexOf('await flushAllCloudStateBeforeIdentityChange()')
    < identityClient.indexOf("supabase.rpc('prepare_ball_knower_guest_merge')"),
  'The full guest-state flush must finish before claim-token creation.',
);
assert(identityClient.includes('recoverTerminalGuestMerge'), 'Terminal claim failures must clear their pending token.');
assert(identityClient.includes('flushPendingUserStateWrites'), 'In-flight direct mode saves must finish before sign-in.');

const cloudProvider = readFileSync(new URL('../CloudSyncProvider.tsx', import.meta.url), 'utf8');
assert(cloudProvider.includes('claimPendingGuestAccountMerge'), 'Cloud bootstrap must claim guest progress before clearing local state.');
assert(cloudProvider.includes('const flushAllLocalState = async () => {\n      captureLocalChanges();'), 'Identity flush must capture all immediate local changes.');
assert(cloudProvider.includes('if (hasPendingGuestAccountMerge()) throw error'), 'Retryable claim failures must still block identity switching.');
assert(cloudProvider.includes("localKey: 'ballknower_owner_career_v3'"), 'Owner state must participate in the full identity flush.');
assert(cloudProvider.includes('directJsonUpdatedAt(entry, localRaw)'), 'Owner bootstrap must compare its intrinsic local timestamp.');
assert(cloudProvider.includes('directJsonUpdatedAt(entry, row.value)'), 'Owner bootstrap must compare its intrinsic cloud timestamp.');

console.log('Account identity check passed: terminal recovery, full-mode flush, aggregate transfer, and exact Device B restore are covered.');
