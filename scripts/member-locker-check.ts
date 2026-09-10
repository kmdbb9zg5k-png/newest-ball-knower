import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('App.tsx');
const home = read('HomeMatchups.tsx');
const league = read('FantasyLeaguePostDraft.tsx');
const locker = read('LockerHub.tsx');
const progression = read('progressionCloud.ts');
const migration = read('migrations/20260910193000_public_member_lockers.sql');

assert.match(app, /viewedLockerMember/);
assert.match(app, /member\.userId===currentUser\?\.id\?null:member/);
assert.match(app, /viewedMember=\{viewedLockerMember\}/);
assert.match(home, /View \$\{name\}'s locker/);
assert.match(league, /onViewMemberLocker=\{onViewMemberLocker\}/);
assert.match(league, /View \$\{displayManagerName\(member\)\}'s locker/);
assert.match(locker, /possessiveLockerTitle/);
assert.match(locker, /<h1>\{possessiveLockerTitle\(name\)\}<\/h1>/);
assert.match(locker, /targetUserId=\{member\.userId\}/);
assert.doesNotMatch(locker.slice(locker.indexOf('const PublicLocker'), locker.indexOf('const LockerSession')), /ProfilePhotoEditor|Account ID|equipLockerItem/);
assert.match(progression, /get_ball_knower_public_locker_profile/);
assert.match(migration, /security definer\s+set search_path = ''/i);
assert.match(migration, /viewer\.auth_user_id = v_viewer_id/);
assert.match(migration, /target\.auth_user_id = p_user_id/);
assert.match(migration, /pick\.result is not null/);
assert.match(migration, /'metadata', '\{\}'::jsonb/);
assert.match(migration, /revoke all on function public\.get_ball_knower_public_locker_profile\(uuid\) from public, anon, authenticated/);
assert.match(migration, /grant execute on function public\.get_ball_knower_public_locker_profile\(uuid\) to authenticated/);

console.log('Member locker checks passed.');
