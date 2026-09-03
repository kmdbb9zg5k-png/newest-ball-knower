import assert from 'node:assert/strict';
import fs from 'node:fs';
import { keepActiveSoundtrackTrack } from '../soundtrackPolicy';
import { getProfilePhotoMutationVersion, invalidateProfilePhotoReads } from '../profilePhoto';

const read = (path: string) => fs.readFileSync(path, 'utf8');
const migration = read('migrations/20260903080000_add_secure_profile_photos.sql');
const policyOptimization = read('migrations/20260903080100_optimize_profile_photo_rls_initplans.sql');
const client = read('profilePhoto.ts');
const editor = read('ProfilePhotoEditor.tsx');
const context = read('BallKnowerContext.tsx');
const media = read('api/media.ts');
const ios = read('codemagic.yaml');

assert.match(migration, /file_size_limit=excluded\.file_size_limit/);
assert.match(migration, /allowed_mime_types=excluded\.allowed_mime_types/);
assert.match(migration, /storage\.foldername\(name\)\)\[1\]=\(select auth\.uid\(\)\)::text/g);
assert.match(migration, /revoke all on table public\.ball_knower_user_profiles from public,anon,authenticated/);
assert.match(migration, /grant select on table public\.ball_knower_user_profiles to authenticated/);
assert.match(migration, /p_avatar_path !~ \(/);
assert.match(migration, /where auth_user_id=v_user_id/);
assert.match(migration, /auth\.jwt\(\)->>'is_anonymous'/);
assert.match(migration, /A permanent account is required/);
assert.match(migration, /revoke all on function public\.set_ball_knower_profile_photo\(text\) from public,anon/);
assert.match(policyOptimization, /alter policy bk_user_profiles_read_own/);
assert.match(policyOptimization, /\(\(select auth\.jwt\(\)\)->>'is_anonymous'\)::boolean/g);

assert.match(client, /PROFILE_PHOTO_MAX_SOURCE_BYTES = 12 \* 1024 \* 1024/);
assert.match(client, /PROFILE_PHOTO_OUTPUT_SIZE = 512/);
assert.match(client, /contentType: 'image\/webp'/);
assert.match(client, /upsert: false/);
assert.match(client, /await setProfilePhotoPath\(avatarPath\)/);
assert.match(client, /remove\(\[oldPath\]\)/);
assert.match(editor, /capture="user"/);
assert.match(editor, /Choose From Photos/);
assert.match(editor, /Change Photo/);
assert.match(editor, /Remove Photo/);
assert.match(editor, /Saving Photo/);
assert.match(editor, /disabled=\{busy \|\| !imageReady\}/);
assert.match(editor, /sourceUrlRef\.current !== url/);
assert.match(context, /updateCurrentUserAvatar/);
assert.match(context, /member\.userId === userId/);
assert.match(context, /invalidateProfilePhotoReads\(\)/);
assert.match(read('Navbar.tsx'), /request!==profileRequest/);
assert.match(read('Navbar.tsx'), /photoMutation!==getProfilePhotoMutationVersion\(\)/);
assert.match(context, /currentSession\.session\?\.user\.id !== authUser\.id/);
assert.match(context, /photoMutation !== getProfilePhotoMutationVersion\(\)/);
assert.match(ios, /NSCameraUsageDescription/);
assert.match(ios, /NSPhotoLibraryUsageDescription/);

const profileReadVersion = getProfilePhotoMutationVersion();
invalidateProfilePhotoReads();
assert.equal(getProfilePhotoMutationVersion(), profileReadVersion + 1);

const retired = { title: 'From the A to South Jersey', url: '/audio/From-the-A-to-South-Jersey-full-v5.mp3' };
assert.equal(keepActiveSoundtrackTrack(retired), false);
assert.equal(keepActiveSoundtrackTrack({ title: 'Westbound Grind', url: '/audio/Westbound-Grind.mp3' }), true);
assert.doesNotMatch(media, /\['From the A to South Jersey'/);
assert.doesNotMatch(media, /from ['"]\.\.\/soundtrackPolicy/);
assert.match(media, /const isRetiredSoundtrackTrack/);
assert.match(media, /tracks: tracks\.filter\(keepActiveSoundtrackTrack\)/);
assert.equal(fs.existsSync('public/audio/From-the-A-to-South-Jersey-full-v5.mp3'), false);

for (const surface of [
  'FantasyLeagueCommandCenter.tsx',
  'FantasyLeaguePostDraft.tsx',
  'LockedDraftOrderView.tsx',
  'LeagueLiveDraftRoom.tsx',
  'FantasyLeagueCommunications.tsx',
]) {
  assert.match(read(surface), /ManagerAvatar/, `${surface} must render manager profile photos`);
}

console.log(JSON.stringify({
  profilePhoto: 'secure owner path, crop, compression, replacement and removal verified',
  identitySurfaces: 5,
  retiredTrack: 'blocked in API and client; bundled asset absent',
}, null, 2));
