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
const agentSigningSession=agent.indexOf('signingUserId = (await ensureAgentSigningSession()).id;');
const agentSigningStage=agent.indexOf('stagePendingAgentSigning(signingUserId, signingBeforeState, next);',agentSigningSession);
const agentSigningPersist=agent.indexOf('persist(next);',agentSigningStage);
const agentSigningVerify=agent.indexOf('retryAgentSigningVerification();',agentSigningPersist);
const agentCloudSave=agent.indexOf('await commitAgentSigningForExpectedUser(');
const agentPendingClear=agent.indexOf('localStorage.removeItem(PENDING_SIGNING_KEY)',agentCloudSave);
const agentMilestoneClaim=agent.indexOf('await claimPendingVerifiedModeMilestones()',agentPendingClear);
assert.ok(
  agentWeekGuard>=0&&agent.includes('const handleBack = () => {\n    onBack();')&&
  agentSigningSession>=0&&agentSigningSession<agentSigningStage&&
  agentSigningStage<agentSigningPersist&&agentSigningPersist<agentSigningVerify&&
  agentCloudSave>=0&&agentCloudSave<agentPendingClear&&
  agent.includes('pending.userId !== user.id')&&
  agent.includes('Signing account and pre-signing state are required.')&&
  agent.includes('commitAgentSigningForExpectedUser(')&&
  agent.includes('pending.beforeState')&&
  agent.includes('beforeState,')&&
  agent.includes('setAgency(actionAgency);')&&
  agent.includes('persistRecruitAction(actionAgency);')&&
  agent.includes('playerId: p.id,\n      beforeState: agency,')&&
  agent.includes('persist(agency);\n                      setRecruit(null);')&&
  agent.includes('stagePendingAgentSigning(signingUserId, signingBeforeState, next)')&&
  agent.includes('retryAgentSigningVerification()')&&
  agent.includes('localStorage.getItem(PENDING_SIGNING_KEY) !== raw')&&
  agent.includes('while (true)')&&
  agentCloudSave<agentPendingClear&&agentPendingClear<agentMilestoneClaim&&
  agent.includes('if (verifyingAgentSigning) {\n    return (')&&
  agent.includes('Career actions are paused until this signing is safely stored')&&
  agent.includes('window.addEventListener("storage", handlePendingSigningStorage)')&&
  agent.includes('const activeWrite = pendingAgentSigningWrite;')&&
  agent.includes('pendingAgentSigningWrite !== null || readPendingAgentSigning() !== null')&&
  agent.includes('setAgency(restore());')&&
  agent.includes('setVerifyingAgentSigning(stillPending);')&&
  agent.includes('if (signingInFlightRef.current || verifyingAgentSigning) return;')&&
  agent.includes('signingInFlightRef.current = true;')&&
  agent.includes('disabled={signingInFlight}')&&
  agent.includes('AGENT_SIGNING_LOCK_NAME')&&
  agent.includes('await withAgentSigningTabLock(async () => {')&&
  agent.includes('JSON.stringify(sharedAgency) !== JSON.stringify(signingBeforeState)')&&
  agent.includes('Another Agent tab changed this career first')&&
  agent.includes('class AgentSigningConflictError extends Error')&&
  agent.includes('message.includes("Agent career changed before signing")')&&
  agent.includes('throw new AgentSigningConflictError(')&&
  agent.includes('setAgentSigningError(error.message)')&&
  agent.includes('loadAuthoritativeAgentCareer()')&&
  agent.includes('await recoverAgentSigningConflict(error)')&&
  agent.includes('AGENT_SESSION_TIMEOUT_MS = 12_000')&&
  agent.includes('await ensureAgentSigningSession()')&&
  agent.includes('JSON.stringify(restore(false)) !== JSON.stringify(signingBeforeState)')&&
  agent.includes('BACK TO SOLO · KEEP RETRYING')&&
  agent.includes('RETRY CLOUD VERIFICATION'),
  'Agent signing verification must be account-scoped, serialized, cross-tab durable, and freeze every career mutation until saved',
);
assert.equal(
  (phase4bFollowup.match(/create or replace function /g)??[]).length,
  6,
  'Phase 4B hardening migration must contain exactly its six complete functions',
);
assert.equal(
  (phase4bFollowup.match(/\n\$\$;/g)??[]).length,
  5,
  'Phase 4B hardening migration must close each function body exactly once',
);
assert.equal(
  (phase4bFollowup.match(/\n\$function\$;/g)??[]).length,
  1,
  'the redefined guest-claim function must have one complete body',
);
assert.ok(
  phase4bFollowup.includes("v_revision!~'^[0-9]{1,16}$' then return 0; end if;")&&
  phase4bFollowup.includes("jsonb_build_object('cloudRevision',v_stored_revision+1)"),
  'Owner revision validation and server-side increment SQL must remain syntactically intact',
);
assert.ok(
  phase4bFollowup.includes("set value=value||jsonb_build_object('cloudRevision',1)")&&
  phase4bFollowup.includes("not (value ? 'cloudRevision')")&&
  phase4bFollowup.includes("or value->>'cloudRevision' is null")&&
  phase4bFollowup.includes("or (value->>'cloudRevision')!~'^[0-9]{1,16}$'"),
  'legacy Owner cloud snapshots must be revisioned before rollout so stale local state cannot overwrite them',
);
assert.ok(phase4bFollowup.includes('save_ball_knower_revisioned_user_state'),'Owner saves must use a server-revisioned database write');
assert.ok(phase4bFollowup.includes('v_incoming_revision=v_stored_revision'),'stale Owner snapshots must never overwrite a newer server revision');
assert.ok(
  phase4bFollowup.includes("state_key not in ('gauntlet_progress_v1','gauntlet_progress_v2','owner_business_career_v1')")&&
  phase4bFollowup.includes('Phase 4B redefinition: leave Owner snapshots for the revision-aware claim trigger.'),
  'guest-account claims must leave Owner state out of the generic copier',
);
assert.ok(
  phase4bFollowup.includes("v_claim.claimed_at is null and v_claim.expires_at<clock_timestamp()")&&
  phase4bFollowup.indexOf("v_claim.claimed_at is null and v_claim.expires_at<clock_timestamp()")<phase4bFollowup.indexOf("if v_claim.claimed_at is null then"),
  'completed guest claims must remain idempotently replayable after token expiry',
);
assert.ok(
  phase4bFollowup.includes('guard_ball_knower_owner_state_write')&&
  phase4bFollowup.includes("current_setting('ball_knower.owner_revision_write',true)")&&
  phase4bFollowup.includes("perform set_config('ball_knower.owner_revision_write','on',true);")&&
  phase4bFollowup.includes('before insert or update on public.ball_knower_user_state'),
  'legacy and generic clients must be blocked from bypassing the Owner revision RPC',
);
assert.ok(userState.includes("stateKey === OWNER_STATE_KEY")&&userState.includes("save_ball_knower_revisioned_user_state"),'all direct and batched Owner saves must use the revisioned RPC');
assert.ok(owner.includes('cloudRevision:number')&&owner.includes('cloud.cloudRevision>local.cloudRevision'),'Owner careers must carry and prefer server-issued revisions');
assert.ok(cloudSync.includes('function directJsonRevision')&&!cloudSync.includes('directJsonUpdatedAt'),'Owner conflict ordering must not depend on client wall clocks');
assert.ok(cloudSync.includes('restoredServerWinner')&&cloudSync.includes('remoteRevision > localRevision'),'cloud sync must apply the server winner on stale Owner saves');
const ownerMutationSave=owner.indexOf('save(p,false);');
const ownerDurableFlush=owner.indexOf('await flushAllCloudState()',ownerMutationSave);
const ownerMilestoneClaim=owner.indexOf('await claimPendingVerifiedModeMilestones()',ownerDurableFlush);
assert.ok(
  ownerMutationSave>=0&&ownerMutationSave<ownerDurableFlush&&ownerDurableFlush<ownerMilestoneClaim&&
  owner.includes('const save=(p:Partial<State>,trackCash=true)=>{')&&owner.includes('setState(n);persist(n);')&&
  cloudSync.includes("{ localKey: 'ballknower_owner_career_v3', cloudKey: 'owner_business_career_v1', directJson: true }"),
  'Owner mutations must persist locally, flush through the registered revisioned cloud coordinator, and only then claim milestones',
);
assert.ok(
  cloudSync.includes('savedRevision === submittedRevision + 1')&&
  cloudSync.includes('if (current !== snapshot && current)')&&
  cloudSync.includes('if (!accepted) {')&&
  cloudSync.includes('localStorage.setItem(`${entry.localKey}:conflict-backup`, current)')&&
  cloudSync.includes('window.dispatchEvent(new CustomEvent(OWNER_CLOUD_CONFLICT_EVENT))')&&
  cloudSync.includes('cloudRevision: savedRevision')&&
  owner.includes('Another device saved newer Owner progress first'),
  'accepted Owner actions may rebase, but stale conflicts must restore the server winner and surface a local backup',
);
assert.ok(
  cloudSync.includes("export const OWNER_CLOUD_SYNC_EVENT = 'ballknower:owner-cloud-saved'")&&
  cloudSync.includes('if (accepted) {')&&
  cloudSync.includes('new CustomEvent(OWNER_CLOUD_SYNC_EVENT, { detail: savedRow.value })')&&
  owner.includes('window.addEventListener(OWNER_CLOUD_SYNC_EVENT,handleOwnerCloudSaved)')&&
  owner.includes('if(synced.cloudRevision<local.cloudRevision)return local;'),
  'accepted Owner revision bumps must hydrate the mounted mode in place instead of remounting the entire app',
);
assert.ok(
  owner.includes('onClick={()=>setCloudConflict(false)}')&&owner.includes('min-h-11'),
  'the Owner conflict notice must be dismissible with a practical touch target',
);
assert.ok(phase4bFollowup.includes('on conflict(user_id) do update set')&&phase4bFollowup.includes('excluded.season'),'guest claims must compare and preserve the more advanced Owner run');
assert.ok(phase4bFollowup.indexOf('on conflict(user_id) do update set')<phase4bFollowup.indexOf('delete from ball_knower_private.verified_owner_runs'),'guest Owner state must be preserved before the guest row is deleted');
const transferFunctionStart=phase4bFollowup.indexOf('create or replace function ball_knower_private.transfer_verified_mode_state_on_guest_claim()');
const transferFunctionSql=phase4bFollowup.slice(transferFunctionStart);
assert.ok(
  transferFunctionStart>=0&&
  transferFunctionSql.includes('v_guest_owner_wins boolean:=false')&&
  transferFunctionSql.includes("state_key='owner_business_career_v1'")&&
  transferFunctionSql.includes("public_state.value->>'abbr'=guest.abbr")&&
  transferFunctionSql.includes("public_state.value->>'abbr'=target.abbr")&&
  transferFunctionSql.includes('guest.abbr\n    ) > (')&&
  transferFunctionSql.includes('where v_guest_owner_wins;')&&
  transferFunctionSql.includes("ball_knower_private.owner_state_revision(excluded.value)\n        )+1")&&
  transferFunctionSql.includes("guest_state.state_key='owner_business_career_v1'")&&
  transferFunctionSql.includes('guest_run.user_id=new.guest_user_id')&&
  transferFunctionSql.includes('target_run.user_id=new.claimed_by')&&
  transferFunctionSql.indexOf('if v_guest_owner_wins or (')<transferFunctionSql.indexOf('delete from ball_knower_private.verified_owner_runs'),
  'advanced and pre-run claimed Owner snapshots must transfer without overriding an authoritative verified run',
);
assert.ok(
  agent.includes('const signingVerified = await retryAgentSigningVerification')&&
  agent.includes('if (signingVerified && after > before)')&&
  agent.includes('await recoverAgentSigningConflict(error);\n        return false;'),
  'rejected Agent signings must not trigger post-signing level-up effects',
);
const agentStagePending=agent.indexOf('stagePendingAgentSigning(signingUserId, signingBeforeState, next);');
const agentPersistFinal=agent.indexOf('persist(next);',agentStagePending);
const agentVerifyFinal=agent.indexOf('await retryAgentSigningVerification();',agentPersistFinal);
assert.ok(
  userState.includes("export const AGENT_PENDING_SIGNING_KEY = 'ballknower_player_agent_signing_pending_v1'")&&
  cloudSync.includes('!isCloudUploadBlocked(entry)')&&
  cloudSync.includes('if (isCloudUploadBlocked(entry)) continue;')&&
  cloudSync.includes('while (hasFlushableDirty())')&&
  agent.includes('await flushPendingUserStateWrites();')&&
  agentStagePending>=0&&agentStagePending<agentPersistFinal&&agentPersistFinal<agentVerifyFinal,
  'pending Agent signings must block generic cloud writes before the watched local snapshot changes',
);
assert.ok(
  agent.includes('PENDING_RECRUIT_ACTION_KEY')&&
  agent.includes('includePendingRecruitAction && localStorage.getItem(PENDING_RECRUIT_ACTION_KEY)')&&
  agent.includes('persistRecruitAction(actionAgency);')&&
  agent.includes('const sharedAgency = restore(false);')&&
  agent.includes('JSON.stringify(restore(false)) !== JSON.stringify(signingBeforeState)')&&
  agent.includes('localStorage.removeItem(PENDING_RECRUIT_ACTION_KEY);'),
  'a consumed recruiting action must survive reloads without changing the signing verifier baseline',
);
const agentAuthoritativeLoad=agent.indexOf('const latest = await loadAuthoritativeAgentCareer();');
const agentConflictHoldRelease=agent.indexOf('localStorage.removeItem(PENDING_SIGNING_KEY);',agentAuthoritativeLoad);
const agentConflictCatch=agent.indexOf('setVerifyingAgentSigning(true);',agentConflictHoldRelease);
assert.ok(
  agent.includes('Keep the hold until the authoritative server winner is loaded.')&&
  agentAuthoritativeLoad>=0&&agentAuthoritativeLoad<agentConflictHoldRelease&&agentConflictHoldRelease<agentConflictCatch,
  'Agent conflict recovery must stay locked until authoritative cloud state is loaded',
);
const signingRpcStart=phase4bFollowup.indexOf('create or replace function public.commit_ball_knower_expected_agent_signing(');
const signingRpcSql=phase4bFollowup.slice(signingRpcStart,transferFunctionStart);
const signingClientStart=userState.indexOf('export function commitAgentSigningForExpectedUser(');
const signingClientEnd=userState.indexOf('export async function loadGauntletProgressEvents',signingClientStart);
const signingClient=userState.slice(signingClientStart,signingClientEnd);
assert.ok(
  signingRpcStart>=0&&transferFunctionStart>signingRpcStart&&
  signingRpcSql.includes('auth.uid()<>p_expected_user_id')&&
  signingRpcSql.includes("state_key='player_agent_career'\n  for update")&&
  signingRpcSql.includes('if v_existing=p_after_value then return; end if;')&&
  signingRpcSql.includes('if v_existing is distinct from p_before_value then')&&
  signingClientStart>=0&&signingClientEnd>signingClientStart&&
  signingClient.includes('ACCOUNT_BOUND_WRITE_TIMEOUT_MS')&&
  signingClient.includes(".rpc('commit_ball_knower_expected_agent_signing'")&&
  signingClient.includes('p_expected_user_id: expectedUserId')&&
  signingClient.includes('p_before_value: beforeValue')&&
  signingClient.includes('p_after_value: afterValue')&&
  signingClient.includes('.abortSignal(controller.signal)'),
  'Agent signings must use a bounded, account-bound, server-serialized before-after transaction',
);
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
