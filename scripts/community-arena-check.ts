import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=(file:string)=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const migration=source('migrations/20260912140000_bk_arena_community.sql');
const permanentRls=source('migrations/20260912141000_bk_arena_permanent_account_rls.sql');
const moderation=source('migrations/20260912142000_bk_arena_moderation_hardening.sql');
const payloadLimits=source('migrations/20260912142500_bk_arena_payload_limits.sql');
const cloud=source('communityCloud.ts');
const hub=source('CommunityHub.tsx');
const app=source('App.tsx');
const nav=source('Navbar.tsx');
const safety=source('CommunitySafety.tsx');
const profile=source('progressionCloud.ts');

for(const table of ['ball_knower_friendships','ball_knower_community_messages','ball_knower_community_reports','ball_knower_h2h_matches']){
  assert.match(migration,new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(migration,new RegExp(`revoke all on public\\.${table} from public,anon,authenticated`));
}
assert.match(migration,/require_permanent_community_user/);
assert.match(migration,/not coalesce\(u\.is_anonymous,false\)/);
assert.match(permanentRls,/is_permanent_community_user/);
assert.equal((permanentRls.match(/is_permanent_community_user\(\)/g)||[]).length,6,'Every Arena read policy must reject anonymous authenticated sessions');
assert.match(migration,/duration_seconds integer not null default 60 check\(duration_seconds=60\)/);
assert.match(migration,/ball_knower_private\.h2h_answers/);
assert.match(migration,/Question already answered/);
assert.match(migration,/created_at>now\(\)-interval '3 seconds'/);
assert.match(migration,/Daily chat limit reached/);
assert.match(migration,/community_censor_text/);
assert.match(migration,/Only accepted friends can message/);
assert.match(migration,/report_ball_knower_community_content/);
assert.match(moderation,/moderate_ball_knower_community_report/);
assert.match(moderation,/grant execute on function public\.moderate_ball_knower_community_report\(uuid,text,text\) to service_role/);
assert.doesNotMatch(moderation,/grant execute on function public\.moderate_ball_knower_community_report\(uuid,text,text\) to authenticated/);
assert.match(payloadLimits,/limit 50/);
assert.match(payloadLimits,/limit 250/);
assert.match(payloadLimits,/limit 25/);
assert.match(migration,/ball_knower_user_blocks/);
const publicMatch=migration.match(/create function public\.get_ball_knower_h2h_match[\s\S]+?revoke all on function public\.get_ball_knower_h2h_match/);
assert.ok(publicMatch);
assert.doesNotMatch(publicMatch[0],/correct_index|explanation/,'H2H payload must not expose answer keys');
assert.match(cloud,/removeChannel\(channel\)/,'Realtime subscriptions must clean up');
assert.match(hub,/maxLength=\{300\}/);
assert.match(hub,/Text only · public · moderated/);
assert.match(hub,/Same questions\. Server scoring/);
assert.match(app,/const CommunityHub=lazy/,'Community must remain out of the initial bundle');
assert.match(nav,/nav-tab-community/);
assert.match(nav,/setCurrentTab\('community'\)[\s\S]+Community/);
assert.match(hub,/Play solo trivia instead|Solo trivia/,'Mobile Community must retain a path to solo trivia');
assert.match(safety,/global_message.*community_dm/);
assert.match(profile,/h2hWins/);
assert.doesNotMatch(hub,/type=["']file["']|accept=["']image/,'Community v1 must stay text-only');

console.log('Community arena checks passed.');
