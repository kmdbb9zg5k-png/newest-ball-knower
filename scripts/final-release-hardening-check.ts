import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

const migration=read('migrations/20260831_final_verified_mode_progression.sql');
const modeApi=read('api/mode-progression.ts');
const predictionApi=read('api/prediction-picks.ts');
const predictionFeed=read('server/nflPredictionFeed.ts');
const cloud=read('modeProgressionCloud.ts');
const bridge=read('modeProgressionBridge.ts');
const picks=read('SportsbookHub.tsx');
const main=read('main.tsx');
const navbar=read('Navbar.tsx');
const html=read('index.html');
const cloudSync=read('CloudSyncProvider.tsx');
const transactions=read('api/fantasy-transactions.ts');

assert.ok(migration.includes('ball_knower_private.verified_mode_milestones'),'verified milestones must be private');
assert.ok(migration.includes('revoke all on table ball_knower_private.verified_mode_milestones from public,anon,authenticated'),'clients must not write milestones');
assert.ok(migration.includes('record_ball_knower_verified_mode_snapshot'),'Owner/Agent transitions must be server gated');
assert.ok(migration.includes("auth.role() <> 'service_role'"),'mode producers must require service role');
assert.ok(migration.includes("'mode_milestone:'||v_milestone.id"),'progression idempotency must use immutable milestone ids');
assert.ok(migration.includes('list_ball_knower_unclaimed_mode_milestones'),'unclaimed milestones must replay across devices');
assert.ok(migration.includes('milestone_id:=v_id; return next'),'multi-row milestone producers must use the table output variable');
assert.ok(migration.includes("mode_counter(p_snapshot,'seasonsCompleted'"),'Owner baselines must be validated before storage');
assert.ok(!modeApi.includes('xpAwarded:')&&!modeApi.includes('ratingDelta:'),'mode API must not construct client-chosen rewards');
assert.ok(modeApi.includes("forbidden=['eventType'"),'mode API must explicitly reject reward fields');
assert.ok(bridge.includes("syncVerifiedModeSnapshot('owner'"),'Owner progression must be wired');
assert.ok(bridge.includes("syncVerifiedModeSnapshot('agent'"),'Agent progression must be wired');
assert.ok(main.includes('startModeProgressionBridge()'),'progression bridge must start globally');
assert.ok(cloudSync.includes("ballknower_player_agent_v4")&&cloudSync.includes("ballknower_owner_career_v3"),'Owner and Agent careers must remain cross-device synced');

assert.ok(migration.includes('verified_prediction_picks'),'verified Picks must have private pregame storage');
assert.ok(predictionApi.includes('Date.now()>=kickoffMs'),'server must reject Picks at/after kickoff');
assert.ok(predictionApi.includes('That line moved'),'server must verify the exact posted line');
assert.ok(predictionApi.includes('gradeCanonicalPrediction'),'server must grade from canonical finals');
assert.ok(predictionFeed.includes('awayScore!==null&&homeScore!==null'),'prediction finality must require final scores');
assert.ok(predictionFeed.includes('providerFinal=/final|complete|closed/i.test(status)'),'provider final status must be honored before grading');
assert.ok(predictionFeed.includes('Date.now()-kickoffMs>=6*60*60*1000'),'status-less feeds need a conservative finality fallback');
assert.ok(predictionFeed.includes('final:hasScores&&(providerFinal||conservativeFinal)'),'live scores alone must never settle a Pick');
assert.ok(picks.includes('saveVerifiedPredictionPick'),'Picks UI must save through the verifier');
assert.ok(picks.includes('gradeVerifiedPredictionPicks'),'Picks UI must request authoritative grading');
assert.ok(cloud.includes('claim_ball_knower_verified_mode_milestone'),'browser claims only opaque milestone ids');

assert.ok(html.includes('viewport-fit=cover'),'iOS layout must opt into safe-area insets');
assert.ok(navbar.includes('env(safe-area-inset-top)'),'top navigation must respect iOS safe area');
assert.ok(navbar.includes('pt-[env(safe-area-inset-top)]'),'header content must be padded below the status area');
assert.ok(transactions.includes('JOB_TIMEOUT_MS')&&transactions.includes('Promise.race'),'transaction worker fail-fast hotfix must remain present');

console.log('Final release hardening contract checks passed. Physical-device-only delivery/audio/camera/touch checks remain manual by definition.');
