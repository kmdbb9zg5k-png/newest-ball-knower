import assert from'node:assert/strict';
import{readFileSync}from'node:fs';

const migration=readFileSync(new URL('../migrations/20260831_phase4b_verified_mode_milestones.sql',import.meta.url),'utf8');
const cloud=readFileSync(new URL('../progressionCloud.ts',import.meta.url),'utf8');

assert.ok(migration.includes('ball_knower_private.verified_mode_milestones'),'milestones must live outside the client-writable public schema');
assert.ok(migration.includes('revoke all on table ball_knower_private.verified_mode_milestones from public,anon,authenticated'),'clients must not create or edit verified milestones');
for(const mode of ['owner','agent','prediction'])assert.ok(migration.includes("mode='"+mode+"'"),mode+' milestones must be constrained to their category');
for(const event of ['owner_championship','agent_client_signed','prediction_correct'])assert.ok(migration.includes("'"+event+"'"),event+' must have a server-owned reward mapping');
assert.ok(migration.includes('where id=p_milestone_id and user_id=v_user and verified_at is not null'),'claims must bind a verified milestone to the signed-in user');
assert.ok(migration.includes('for update'),'concurrent claims must serialize on the same milestone');
assert.ok(migration.includes("'mode_milestone:'||v_milestone.id"),'idempotency must use the immutable server milestone id');
assert.ok(migration.includes('ball_knower_private.apply_progress_event'),'verified rewards must use the permanent progression ledger');
assert.ok(!migration.includes('p_event_type')&&!migration.includes('p_event_key'),'clients must never choose a reward type or idempotency key');
assert.ok(cloud.includes("claim_ball_knower_verified_mode_milestone"),'the client must claim only by opaque verified milestone id');
assert.ok(cloud.includes('{p_milestone_id:milestoneId}'),'the browser claim payload must not include a reward type or key');
console.log('Phase 4B verified universal progression contract checks passed.');
