import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  guestGmName,
  isPlaceholderGmName,
  normalizeGmDisplayName,
  resolveAuthDisplayName,
  validateGmDisplayName,
} from '../profileIdentity';
import { displayLeagueMemberName } from '../leagueMemberDisplay';

assert.equal(normalizeGmDisplayName('  Eli   The GM  '), 'Eli The GM');
assert.equal(validateGmDisplayName(' Eli '), 'Eli');
assert.throws(() => validateGmDisplayName('x'), /at least 2/);
assert.equal(isPlaceholderGmName('Guest GM'), true);
assert.equal(isPlaceholderGmName('Eli'), false);

const guestA = '11111111-1111-4111-8111-111111abc123';
const guestB = '22222222-2222-4222-8222-222222def456';
assert.equal(guestGmName(guestA), 'Guest GM ABC123');
assert.notEqual(guestGmName(guestA), guestGmName(guestB));
assert.equal(resolveAuthDisplayName({ id: guestA, email: undefined, is_anonymous: true, user_metadata: {} }), 'Guest GM ABC123');
assert.equal(resolveAuthDisplayName({ id: guestA, email: undefined, is_anonymous: true, user_metadata: { full_name: 'Eli' } }), 'Eli');
assert.equal(resolveAuthDisplayName({ id: guestA, email: 'elijah@example.com', is_anonymous: false, user_metadata: {} }), 'elijah');

assert.equal(displayLeagueMemberName({
  id: 'member-a', userId: guestA, userName: 'Guest GM', isCommissioner: false, status: 'building',
}, false, null), 'Guest GM ABC123');
assert.equal(displayLeagueMemberName({
  id: 'member-b', userId: guestB, userName: 'Guest GM', isCommissioner: false, status: 'building',
}, false, null), 'Guest GM DEF456');

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const migration = read('migrations/20260909000100_guest_profile_identity.sql');
const authModal = read('AuthModal.tsx');
const profileEditor = read('ProfilePhotoEditor.tsx');
const profilePhoto = read('profilePhoto.ts');
const profileIdentity = read('profileIdentity.ts');
const context = read('BallKnowerContext.tsx');
const standings = read('FantasyLeagueEssentials.tsx');

assert.match(migration, /create policy bk_avatar_insert_own/);
assert.match(migration, /create or replace function public\.set_ball_knower_profile_name/);
assert.match(migration, /where auth_user_id=v_user_id/);
assert.match(migration, /commissioner_auth_id=v_user_id/);
assert.doesNotMatch(migration, /A permanent account is required/);
assert.match(authModal, /Keep Playing As Guest/);
assert.match(authModal, /EMAIL MY CONFIRMATION LINK/);
assert.match(authModal, /saveProfileDisplayName\(name\)/);
assert.match(profileEditor, /Edit Name &amp; Photo/);
assert.match(profileEditor, /Save With Email/);
assert.match(profileEditor, /saveProfileDisplayName\(name\)/);
assert.doesNotMatch(profilePhoto, /if \(auth\.is_anonymous\)/);
assert.match(profileIdentity, /database projection is authoritative/);
assert.match(profileIdentity, /return current/);
assert.match(context, /updateCurrentUserName/);
assert.match(context, /saveProfileDisplayName\(resolvedName\)/);
assert.match(context, /authUser\.is_anonymous \? '' : base\.email/);
assert.match(standings, /displayLeagueMemberName/);
assert.match(standings, /ManagerAvatar/);

console.log('Guest profile identity check passed: optional auth, email confirmation, unique names, guest photos, and league propagation are covered.');
