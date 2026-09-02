import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const migration=readFileSync(new URL('../migrations/20260902232500_add_fantasy_notification_preferences.sql',import.meta.url),'utf8');
const receiptMigration=readFileSync(new URL('../migrations/20260902234000_harden_fantasy_notification_receipts.sql',import.meta.url),'utf8');
const cloud=readFileSync(new URL('../leagueCloud.ts',import.meta.url),'utf8');
const controls=readFileSync(new URL('../FantasyNotificationPreferences.tsx',import.meta.url),'utf8');
const commandCenter=readFileSync(new URL('../FantasyLeagueCommandCenter.tsx',import.meta.url),'utf8');
const postDraft=readFileSync(new URL('../FantasyLeaguePostDraft.tsx',import.meta.url),'utf8');

assert.ok(migration.includes('create table if not exists public.ball_knower_notification_preferences'),'notification preferences need a durable owner-scoped table');
assert.ok(migration.includes("category in ('draft','roster','transactions','league')"),'notification categories must stay constrained');
assert.ok(migration.includes('alter table public.ball_knower_notification_preferences enable row level security'),'notification preferences must enable RLS');
assert.ok(migration.includes('revoke all on table public.ball_knower_notification_preferences from public, anon, authenticated')&&migration.includes('grant select on table public.ball_knower_notification_preferences to authenticated'),'clients may read preferences but must mutate through the authenticated RPC');
assert.ok(migration.includes('auth_user_id = (select auth.uid())'),'preference reads must be owner-scoped');

for(const mapping of ["like 'draft_%'","like 'trade_%'","like 'waiver_%'","'player_status'","else 'league'"]){
  assert.ok(migration.includes(mapping),`notification category mapping is missing ${mapping}`);
}
assert.ok(migration.includes("new.category := ball_knower_private.fantasy_notification_category(new.kind)"),'notification rows must receive their server-derived category');
assert.match(migration,/new\.in_app_visible := ball_knower_private\.fantasy_notification_preference_enabled\([\s\S]*?'in_app'/,'in-app visibility must be decided independently at persistence time');
assert.match(migration,/new\.push_eligible := ball_knower_private\.fantasy_notification_preference_enabled\([\s\S]*?'push'/,'push eligibility must be decided independently at persistence time');
assert.ok(!migration.includes('return null;'),'an in-app opt-out must not destroy the owner event needed for an enabled push channel');
assert.ok(migration.includes('before insert on public.ball_knower_notifications'),'preferences must cover trigger, scheduled-worker and commissioner notification inserts');

const saveRpc=migration.slice(migration.indexOf('create or replace function public.save_my_ball_knower_notification_preference'),migration.indexOf('create or replace function public.mark_all_ball_knower_notifications_read'));
assert.ok(saveRpc.includes('v_auth uuid := (select auth.uid())')&&!saveRpc.includes('p_auth'),'preference writes must derive identity from the authenticated session');
assert.ok(saveRpc.includes('on conflict (auth_user_id, category) do update'),'preference writes must be idempotent');
const markAllRpc=migration.slice(migration.indexOf('create or replace function public.mark_all_ball_knower_notifications_read'),migration.indexOf('revoke all on function public.get_my_ball_knower_notification_preferences'));
assert.ok(markAllRpc.includes('notification.auth_user_id = v_auth'),'mark-all-read must never update another owner');
assert.ok(markAllRpc.includes('public.can_access_ball_knower_league(p_league_id)'),'league-scoped mark-all-read must revalidate membership');
assert.ok(migration.includes('revoke all on function public.save_my_ball_knower_notification_preference(text,boolean,boolean)\n  from public, anon'),'anonymous preference writes must be revoked');
assert.ok(receiptMigration.includes('notification.auth_user_id = v_auth')&&receiptMigration.includes('notification.in_app_visible'),'single read receipts must be limited to the authenticated owner and visible channel');
assert.ok(receiptMigration.includes('revoke update on table public.ball_knower_notifications from authenticated'),'clients must not be able to rewrite notification content or delivery flags');
assert.ok(receiptMigration.includes('grant execute on function public.mark_ball_knower_notification_read(uuid)\n  to authenticated'),'authenticated owners need the narrow read-receipt RPC');

for(const category of ['draft','roster','transactions','league'])assert.ok(controls.includes(`${category}: {label:`),`settings UI is missing ${category}`);
assert.ok(controls.includes('role="switch"')&&controls.includes('aria-checked={checked}'),'category toggles must expose accessible switch state');
assert.ok(controls.includes('disabled={Boolean(busy)||!ready}')&&controls.includes('Loading alert preferences'),'preference controls must not overwrite saved choices before loading completes');
assert.ok(controls.includes('userIdRef.current!==requestedUserId'),'identity changes must discard stale preference mutations');
assert.ok(controls.includes('if(!isCloudConfigured||!userId)return null'),'cloud-only preference controls must not pretend to persist in local leagues');
assert.ok(controls.includes('supported Ball Knower mobile app'),'push controls must not claim native delivery without a registered device');
assert.ok(cloud.includes("supabase.rpc('get_my_ball_knower_notification_preferences')")&&cloud.includes("supabase.rpc('save_my_ball_knower_notification_preference'"),'the client must use authenticated preference RPCs');
assert.ok(cloud.includes(".eq('in_app_visible',true)"),'in-app history must filter out events disabled for that channel');
assert.ok(cloud.includes("supabase.rpc('mark_ball_knower_notification_read'"),'single notification acknowledgements must use the narrow owner-derived RPC');
assert.ok(!cloud.includes("from('ball_knower_notifications').update"),'the browser must never directly update notification rows');
const context=readFileSync(new URL('../BallKnowerContext.tsx',import.meta.url),'utf8');
assert.ok(context.includes('notification.in_app_visible===false'),'realtime toasts must honor the persisted in-app delivery decision');
assert.ok(commandCenter.includes('<FantasyNotificationPreferences userId={currentUser?.id}/>'),'pre-draft League HQ must expose notification preferences');
assert.ok(postDraft.includes('<FantasyNotificationPreferences userId={currentUser?.id} />'),'post-draft League HQ must expose notification preferences');
assert.ok(commandCenter.includes('markAllNotificationsRead(league.id)'),'League HQ must provide a scoped mark-all-read action');

console.log('Fantasy notification preference checks passed: owner scope, category enforcement, accessible controls, and honest push readiness.');
