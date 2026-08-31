import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

const migration=read('migrations/20260831_final_verified_mode_progression.sql');
const phase4bFollowup=read('migrations/20260831_phase4b_post_merge_hardening.sql');
const modeApi=read('api/mode-progression.ts');
const predictionApi=read('api/prediction-picks.ts');
const predictionFeed=read('server/nflPredictionFeed.js');
const ownerRuntime=read('server/ownerSeasonRuntime.js');
const publicPicksApi=read('api/nfl-sportsbook.ts');
const cloud=read('modeProgressionCloud.ts');
const bridge=read('modeProgressionBridge.ts');
const picks=read('SportsbookHub.tsx');
const owner=read('OwnerBusinessMode.tsx');
const agent=read('PlayerAgentMode.tsx');
const userState=read('userStateCloud.ts');
const main=read('main.tsx');
const navbar=read('Navbar.tsx');
const html=read('index.html');
const cloudSync=read('CloudSyncProvider.tsx');
const transactions=read('api/fantasy-transactions.ts');

assert.ok(migration.includes('ball_knower_private.verified_mode_milestones'),'verified milestones must be private');
assert.ok(migration.includes('revoke all on table ball_knower_private.verified_mode_milestones from public,anon,authenticated'),'clients must not write milestones');
assert.ok(migration.includes("'mode_milestone:'||v_milestone.id"),'progression idempotency must use immutable milestone ids');
assert.ok(migration.includes('list_ball_knower_unclaimed_mode_milestones'),'unclaimed milestones must replay across devices');
assert.ok(migration.includes('transfer_verified_mode_state_on_guest_claim'),'guest-account claims must transfer private Phase 4B state');
assert.ok(migration.includes('verified_owner_runs'),'Owner progression must have a private server-owned run');
assert.ok(migration.includes('commit_ball_knower_verified_owner_step'),'Owner transitions must be committed behind service role');
assert.ok(migration.includes("'owner_server_run_v1'"),'Owner milestones must identify the server-run verifier');
assert.ok(modeApi.includes("import{randomInt}from'node:crypto'"),'Owner game outcomes must be rolled on the server');
assert.ok(modeApi.includes("from'../server/ownerSeasonRuntime.js'"),'Owner serverless runtime import must be explicit ESM .js');
assert.ok(ownerRuntime.includes('export const advanceOwnerSeason'),'Owner runtime helper must ship as JavaScript for Vercel');
assert.ok(modeApi.includes('commit_ball_knower_verified_owner_step'),'Owner API must commit the versioned server run');
assert.ok(owner.includes('advanceVerifiedOwnerStep'),'Owner UI must consume the server-owned outcome');
assert.ok(owner.includes('result.verified&&typeof result.won'),'Owner UI must use server outcomes only when verified');
assert.ok(!modeApi.includes('record_ball_knower_verified_mode_snapshot'),'counter-snapshot progression must stay removed');
assert.ok(!cloud.includes('syncVerifiedModeSnapshot'),'clients must not submit mode counters for rewards');
assert.ok(!bridge.includes('localStorage')&&!bridge.includes('signedClients')&&!bridge.includes('championships'),'global bridge must only claim server-created milestones');

assert.ok(migration.includes('verify_ball_knower_agent_progression'),'Agent progression must be derived by a database transition trigger');
assert.ok(migration.includes("new.state_key<>'player_agent_career'"),'Agent verifier must scope itself to authenticated Agent cloud state');
assert.ok(migration.includes("v_new_signed=v_old_signed+1")&&migration.includes("v_new_actions=v_old_actions+1"),'Agent signings require a real one-action detailed transition');
assert.ok(migration.includes("v_old_client#>>'{tradeRequest,status}'='open'")&&migration.includes("v_new_client#>>'{tradeRequest,status}'='resolved'"),'Agent trade rewards require an actual request resolution');
assert.ok(migration.includes("v_new_client->'futureDeal'=v_deal"),'Agent contract rewards require a concrete deal transition');
assert.ok(migration.includes("career,fulfilledPromises"),'Agent promise rewards require a newly fulfilled named promise');
assert.ok(cloudSync.includes("ballknower_player_agent_v4")&&cloudSync.includes("ballknower_owner_career_v3"),'Owner and Agent careers must remain cross-device synced');
const agentWeekGuard=agent.indexOf('if (verifyingAgentSigning) return;');
const agentSigningSession=agent.indexOf('signingUserId = (await ensureOnlineSession()).id;');
const agentAccountSnapshot=agent.indexOf('JSON.stringify({ userId: signingUserId, state } satisfies PendingAgentSigning)');
const agentSigningPersist=agent.indexOf('persist(next);',agentSigningSession);
const agentSigningVerify=agent.indexOf('retryAgentSigningVerification(next, signingUserId)',agentSigningPersist);
const agentCloudSave=agent.indexOf('await saveUserState("player_agent_career"');
const agentPendingClear=agent.indexOf('localStorage.removeItem(PENDING_SIGNING_KEY)',agentCloudSave);
const agentMilestoneClaim=agent.indexOf('await claimPendingVerifiedModeMilestones()',agentPendingClear);
assert.ok(
  agentWeekGuard>=0&&agent.includes('if (!verifyingAgentSigning) onBack();')&&
  agentSigningSession>=0&&agentSigningSession<agentSigningPersist&&
  agentSigningPersist<agentSigningVerify&&
  agentAccountSnapshot>=0&&agentAccountSnapshot<agentCloudSave&&
  agent.includes('pending.userId !== user.id')&&
  agent.includes('if (!signingUserId) throw new Error("Signing account is required.");')&&
  agent.includes('retryAgentSigningVerification(next, signingUserId)')&&
  agent.includes('localStorage.getItem(PENDING_SIGNING_KEY) !== raw')&&
  agent.includes('while (true)')&&
  agentCloudSave<agentPendingClear&&agentPendingClear<agentMilestoneClaim&&
  agent.includes('if (verifyingAgentSigning) {\n    return (')&&
  agent.includes('Career actions are paused until this signing is safely stored')&&
  agent.includes('window.addEventListener("storage", handlePendingSigningStorage)')&&
  agent.includes('RETRY CLOUD VERIFICATION'),
  'Agent signing verification must be account-scoped, serialized, cross-tab durable, and freeze every career mutation until saved',
);
assert.equal(
  (phase4bFollowup.match(/create or replace function /g)??[]).length,
  3,
  'Phase 4B hardening migration must contain exactly its three complete functions',
);
assert.equal(
  (phase4bFollowup.match(/\n\$\$;/g)??[]).length,
  3,
  'Phase 4B hardening migration must close each function body exactly once',
);
assert.ok(
  phase4bFollowup.includes("v_updated is null or v_updated!~'^[0-9]{1,16}$' then return 0; end if;")&&
  !phase4bFollowup.includes('\n then return 0;'),
  'Owner timestamp validation SQL must remain syntactically intact',
);
assert.ok(phase4bFollowup.includes('save_ball_knower_timestamped_user_state'),'Owner saves must use a monotonic database write');
assert.ok(phase4bFollowup.includes('owner_state_updated_at(current_state.value)<=v_incoming_updated'),'older Owner snapshots must never overwrite newer cross-device state');
assert.ok(userState.includes("stateKey === OWNER_STATE_KEY")&&userState.includes("save_ball_knower_timestamped_user_state"),'all direct and batched Owner saves must use the monotonic RPC');
assert.ok(phase4bFollowup.includes('on conflict(user_id) do update set')&&phase4bFollowup.includes('excluded.season'),'guest claims must compare and preserve the more advanced Owner run');
assert.ok(phase4bFollowup.indexOf('on conflict(user_id) do update set')<phase4bFollowup.indexOf('delete from ball_knower_private.verified_owner_runs'),'guest Owner state must be preserved before the guest row is deleted');
assert.ok(bridge.includes('IDLE_CLAIM_INTERVAL_MS=60_000')&&!bridge.includes('setInterval(()=>void claimVerifiedMilestones(),4000)'),'idle milestone replay must avoid four-second polling');

assert.ok(migration.includes('verified_prediction_picks'),'verified Picks must have private pregame storage');
assert.ok(predictionApi.includes('Date.now()>=kickoffMs'),'server must reject Picks at/after kickoff');
assert.ok(predictionApi.includes('That line moved'),'server must verify the exact posted line');
assert.ok(predictionApi.includes('gradeCanonicalPrediction'),'server must grade from canonical finals');
assert.ok(predictionApi.includes("from'../server/nflPredictionFeed.js'"),'Prediction serverless runtime import must be explicit ESM .js');
assert.ok(publicPicksApi.includes("from'../server/nflPredictionFeed.js'"),'Public Picks serverless runtime import must be explicit ESM .js');
assert.ok(predictionFeed.includes("const stableId=String(g?.game_id||g?.id||'').trim()"),'Prediction rows must require stable provider IDs');
assert.ok(predictionFeed.includes('providerFinal=/final|complete|closed/i.test(status)'),'Prediction grading must require terminal provider status');
assert.ok(predictionFeed.includes('final:hasScores&&providerFinal'),'live scores alone must never settle a Pick');
assert.ok(!predictionFeed.includes('conservativeFinal'),'time-after-kickoff must never masquerade as a final status');
assert.ok(publicPicksApi.includes('fetchCanonicalPredictionGames'),'Picks UI and grading must share one canonical feed');
assert.ok(picks.includes('saveVerifiedPredictionPick'),'Picks UI must save through the verifier');
assert.ok(picks.includes('gradeVerifiedPredictionPicks'),'Picks UI must request authoritative grading');
assert.ok(cloud.includes('predictionMutationChain')&&cloud.includes('queuePredictionMutation'),'Picks save/delete/grade mutations must be serialized');
assert.ok(cloud.includes('claim_ball_knower_verified_mode_milestone'),'browser claims only opaque milestone ids');

assert.ok(main.includes('startModeProgressionBridge()'),'milestone replay/Prediction grading bridge must start globally');
assert.ok(html.includes('viewport-fit=cover'),'iOS layout must opt into safe-area insets');
assert.ok(navbar.includes('env(safe-area-inset-top)'),'top navigation must respect iOS safe area');
assert.ok(navbar.includes('pt-[env(safe-area-inset-top)]'),'header content must be padded below the status area');
assert.ok(transactions.includes('RPC_TIMEOUT_MS')&&transactions.includes('AbortController'),'transaction worker fail-fast hotfix must remain present');

console.log('Final release hardening contract checks passed. Physical-device-only delivery/audio/camera/touch checks remain manual by definition.');
