import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { createClient } from '@supabase/supabase-js';
import { makeManifest, ownsUser, readStackConfig, QA_OWNER } from './real-service-config.mjs';
import { localSql } from './bootstrap-real-services.ts';
import { verifyRealPushSessions } from './push-real-services.ts';
import { sha256 } from './schema-contract.mjs';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const safeCode = error => error?.qaCode || (/^[A-Z0-9_]{4,12}$/.test(error?.code || '') ? `database_${error.code}` : 'real_service_step_failed');
const requireOk = response => { if (response.error) throw response.error; return response.data; };
const uuid = value => { if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value)) throw new Error('invalid_fixture_uuid'); return value; };
const sqlLiteral = value => `'${String(value).replaceAll("'", "''")}'`;

async function until(predicate, code, timeout = 20_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await predicate()) return; await wait(50); }
  throw Object.assign(new Error(code), { qaCode: code });
}
async function rejects(action) { let rejected = false; try { await action(); } catch { rejected = true; } assert.ok(rejected, 'server must reject the invalid operation'); }

async function appAdapter(config, directory, slot) {
  const outfile = resolve(directory, `manager-${slot}.mjs`);
  await build({
    stdin: { contents: `export {supabase} from './supabase';
      export {createCloudLeague,joinCloudLeague,fetchCloudLeague,updateCloudLeague,startCloudLiveFantasyDraft,makeCloudLiveFantasyDraftPick,subscribeToCloudLeague,saveMyNotificationPreference} from './leagueCloud';
      export {saveMyWeeklyLineup,submitFaabClaim} from './fantasyLeagueParityCloud';
      export {sendFriendRequest,respondFriendRequest,miniChallengeAction} from './communityCloud';
      export {footballArenaAction} from './footballArena';
      export {PLAYERS_DATABASE} from './players';
      export {getLiveFantasyDraftGroup} from './liveFantasyRules';`, resolveDir: process.cwd(), loader: 'ts' },
    outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external', logLevel: 'silent',
    define: { 'import.meta.env': JSON.stringify({ VITE_SUPABASE_URL: config.url, VITE_SUPABASE_PUBLISHABLE_KEY: config.publicKey }) },
  });
  return import(pathToFileURL(outfile).href);
}

export async function runRealServices(statusPath, outputDirectory, cleanupPath) {
  // There is deliberately no hosted-project override. Every HTTP request and
  // privileged SQL connection is checked independently for loopback isolation.
  const config = readStackConfig(JSON.parse(readFileSync(statusPath, 'utf8')));
  mkdirSync(outputDirectory, { recursive: true });
  const manifest = cleanupPath ? JSON.parse(readFileSync(cleanupPath, 'utf8')) : makeManifest(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim());
  if (manifest.version !== 1 || manifest.owner !== QA_OWNER || manifest.target !== 'isolated_self_hosted_supabase' || manifest.users.length !== 2) throw new Error('invalid_cleanup_manifest');
  uuid(manifest.runId); manifest.users.forEach(user => uuid(user.id));
  const manifestPath = resolve(outputDirectory, 'run-manifest.json');
  const saveManifest = () => { writeFileSync(manifestPath + '.tmp', JSON.stringify(manifest, null, 2), { mode: 0o600 }); renameSync(manifestPath + '.tmp', manifestPath); };
  saveManifest();
  const receipt = {
    version: 1, runId: manifest.runId, sourceCommit: manifest.sourceCommit,
    startedAt: new Date().toISOString(), mode: 'isolated_real_supabase_services',
    realAuthAccounts: false, separateAuthSessions: false, mockedHttp: false,
    humanOpponents: false, physicalDeviceVerified: false, productionWrites: 0,
    realNflScoringVerified: false, gameplayReplayVerified: false,
    schemaParityFile: 'schema-parity.json', checks: [], cleanup: { status: 'pending' },
  };
  const overlays = cleanupPath ? manifest.featureOverlays || [] : JSON.parse(readFileSync(resolve(outputDirectory, 'feature-overlays.json'), 'utf8')).appliedOverlays || [];
  manifest.featureOverlays = overlays; saveManifest();
  const secureLineupOverlay = overlays.some(overlay => /\/(?:20261106021753_atomic_validated_fantasy_scoring|20261106023523_secure_fantasy_lineup_writes)\.sql$/.test(overlay.filename));
  const pushOverlay = overlays.some(overlay => /\/20261106021520_fantasy_push_delivery\.sql$/.test(overlay.filename));
  const scoringOverlay = overlays.some(overlay => /\/20261106021753_atomic_validated_fantasy_scoring\.sql$/.test(overlay.filename));
  receipt.featureOverlays = overlays;
  const originalFetch = globalThis.fetch;
  const inFlight = new Set();
  let stopped = false;
  globalThis.fetch = (input, init) => {
    const target = new URL(input instanceof Request ? input.url : String(input));
    if (target.origin !== config.url || !/^\/(?:auth|rest|storage)\/v1(?:\/|$)/.test(target.pathname)) throw new Error('non_isolated_http_request_refused');
    if (stopped) throw new Error('qa_run_is_quiescent');
    // Observe the actual create payload before forwarding it. No response is
    // mocked or substituted. This closes the lost-create-response cleanup gap.
    if (target.pathname === '/rest/v1/ball_knower_leagues' && init?.method === 'POST') {
      const payload = JSON.parse(String(init.body));
      assert.equal(payload.settings?.launchQa?.runId, manifest.runId);
      assert.equal(payload.commissioner_auth_id, manifest.users[0].id);
      assert.match(payload.id, /^[a-f0-9-]{36}$/);
      manifest.leagueId = payload.id; saveManifest();
    }
    const pending = originalFetch(input, init).then(async response => {
      const bytes = await response.arrayBuffer();
      return new Response(response.status === 204 || response.status === 205 || init?.method === 'HEAD' ? null : bytes, { status: response.status, statusText: response.statusText, headers: response.headers });
    });
    inFlight.add(pending);
    void pending.finally(() => inFlight.delete(pending)).catch(() => {});
    return pending;
  };
  const admin = createClient(config.url, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const fixture = [];
  const unsubscribers = [];
  let currentStep = 'initialization';
  async function check(name, action) {
    currentStep = name; manifest.phase = name; saveManifest();
    const detail = await action();
    receipt.checks.push({ name, status: 'passed', ...(detail || {}) });
  }
  try {
    if (cleanupPath) { receipt.ok = true; return receipt; }
    await check('auth.two_distinct_admin_created_password_sessions', async () => {
      for (const item of manifest.users) {
        const password = randomBytes(32).toString('base64url') + 'aA9!';
        const email = `bk-launch-qa-${manifest.runId}-${item.slot}@example.invalid`;
        const app = await appAdapter(config, resolve(outputDirectory, 'private-adapters'), item.slot);
        const label = `QA ${manifest.runId.slice(0, 8)} ${item.slot.toUpperCase()}`;
        const created = requireOk(await admin.auth.admin.createUser({ id: item.id, email, password, email_confirm: true, app_metadata: { bk_launch_qa: { owner: QA_OWNER, runId: manifest.runId, slot: item.slot, expiresAt: manifest.expiresAt } }, user_metadata: { name: label } }));
        assert.ok(ownsUser(created.user, manifest, item));
        item.created = true; saveManifest();
        const session = requireOk(await app.supabase.auth.signInWithPassword({ email, password })).session;
        assert.equal(session.user.id, item.id); assert.equal(session.user.is_anonymous, false);
        assert.equal(requireOk(await app.supabase.auth.getUser()).user.id, item.id);
        fixture.push({ item, app, email, password, label, tokens: [session.access_token] });
      }
      assert.notEqual(fixture[0].tokens[0], fixture[1].tokens[0]);
      assert.notEqual(fixture[0].item.id, fixture[1].item.id);
      receipt.realAuthAccounts = true; receipt.separateAuthSessions = true;
      return { accounts: 2, confirmationEmailsRequested: 0, adminUsedForScenarioMutations: false };
    });
    const [a, b] = fixture;
    let league, draft, members;
    const marker = { owner: QA_OWNER, runId: manifest.runId, expiresAt: manifest.expiresAt };
    await check('fantasy.private_create_join_and_membership_rls', async () => {
      league = await a.app.createCloudLeague(`QA ${manifest.runId}`, 4, 301.2, { id: a.item.id, name: a.label }, { draftScheduledAt: new Date(Date.now() - 60_000).toISOString(), draftTimezone: 'UTC' }, { leagueType: 'private', launchQa: marker, playoffTeams: 4, regularSeasonWeeks: 15, currentWeek: 18, freeAgentMode: 'instant' });
      assert.equal(league.id, manifest.leagueId);
      assert.equal(await b.app.fetchCloudLeague(league.id), null);
      const joined = await b.app.joinCloudLeague(league.code, { id: b.item.id, name: b.label });
      assert.equal(joined.id, league.id); assert.equal(joined.members.length, 2);
      await b.app.joinCloudLeague(league.code, { id: b.item.id, name: b.label });
      league = await a.app.fetchCloudLeague(league.id);
      assert.equal(league.members.length, 2);
      members = fixture.map(person => league.members.find(member => member.userId === person.item.id));
      await rejects(() => b.app.updateCloudLeague(league.id, { salaryCap: 1 }));
      assert.equal((await a.app.fetchCloudLeague(league.id)).salaryCap, 301.2);
      return { privateMembers: 2, duplicateJoinDidNotDuplicateMembership: true, draftOrderGame: 'fixture_order_seeded_by_commissioner' };
    });
    await check('fantasy.real_realtime_disconnect_and_authoritative_rejoin', async () => {
      await a.app.updateCloudLeague(league.id, { status: 'completed', seasonResult: { draftOrder: members.map((member, index) => ({ memberId: member.id, memberName: member.userName, pickNumber: index + 1 })), games: [] } });
      draft = await a.app.startCloudLiveFantasyDraft(league.id);
      assert.equal(draft.pickIndex, 0);
      let aCallbacks = 0, bCallbacks = 0, reloadedIndex = -1;
      unsubscribers.push(a.app.subscribeToCloudLeague(league.id, () => { aCallbacks++; }));
      unsubscribers.push(b.app.subscribeToCloudLeague(league.id, () => { bCallbacks++; void b.app.fetchCloudLeague(league.id).then(value => { reloadedIndex = value?.liveDraft?.pickIndex ?? -1; }).catch(() => {}); }));
      await until(() => aCallbacks > 0 && bCallbacks > 0, 'realtime_initial_subscription_failed');
      b.app.supabase.realtime.disconnect();
      const missedAt = bCallbacks;
      const firstQb = requireOk(await admin.from('ball_knower_fantasy_player_groups').select('player_id').eq('draft_group', 'QB').order('player_id').limit(1))[0];
      const player = a.app.PLAYERS_DATABASE.find(player => player.id === firstQb.player_id);
      draft = await a.app.makeCloudLiveFantasyDraftPick(league.id, player.id, 'QB');
      assert.equal(draft.pickIndex, 1);
      await until(() => aCallbacks > 1, 'real_postgres_change_not_delivered');
      b.app.supabase.realtime.connect();
      await until(() => bCallbacks > missedAt && reloadedIndex === 1, 'realtime_rejoin_did_not_reload_ledger');
      await rejects(() => a.app.makeCloudLiveFantasyDraftPick(league.id, player.id, 'QB'));
      assert.equal((await b.app.fetchCloudLeague(league.id)).liveDraft.picks.length, 1);
      return { actualWebSocketDisconnect: true, postgresChangeObserved: true, missedPickRecoveredWithoutLaterPick: true, duplicatePickRejected: true };
    });
    await check('fantasy.fresh_auth_session_preserves_saved_draft', async () => {
      requireOk(await b.app.supabase.auth.signOut({ scope: 'local' }));
      const session = requireOk(await b.app.supabase.auth.signInWithPassword({ email: b.email, password: b.password })).session;
      assert.notEqual(session.access_token, b.tokens[0]); b.tokens.push(session.access_token);
      assert.equal((await b.app.fetchCloudLeague(league.id)).liveDraft.pickIndex, 1);
      return { freshSessionRead: true };
    });
    await check('fantasy.complete_authoritative_30_pick_draft', async () => {
      const plan = ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'RB', 'K', 'DST', 'QB', 'RB', 'WR', 'WR', 'TE', 'DST'];
      const seededIds = new Set(requireOk(await admin.from('ball_knower_fantasy_player_groups').select('player_id')).map(row => row.player_id));
      while (draft.status !== 'completed') {
        const round = Math.floor(draft.pickIndex / 2), slot = draft.pickIndex % 2;
        const owner = round % 2 === 0 ? slot : 1 - slot;
        const member = members[owner];
        const mine = draft.picks.filter(pick => pick.memberId === member.id);
        const group = plan[mine.length];
        const picked = new Set(draft.picks.map(pick => pick.playerId));
        const player = fixture[owner].app.PLAYERS_DATABASE.find(player => seededIds.has(player.id) && !picked.has(player.id) && fixture[owner].app.getLiveFantasyDraftGroup(player) === group);
        assert.ok(player, 'seeded legal draft candidate must exist');
        draft = await fixture[owner].app.makeCloudLiveFantasyDraftPick(league.id, player.id, group);
      }
      assert.equal(draft.pickIndex, 30); assert.equal(new Set(draft.picks.map(pick => pick.playerId)).size, 30);
      league = await b.app.fetchCloudLeague(league.id);
      assert.ok(league.members.every(member => member.roster.length === 15));
      assert.equal(new Set(league.members.flatMap(member => member.roster.map(player => player.id))).size, 30);
      members = fixture.map(person => league.members.find(member => member.userId === person.item.id));
      return { serverLedgerPicks: 30, canonicalSavedRosters: 2, uniqueOwnership: true };
    });
    const lineups = [];
    await check('fantasy.owner_lineups_reject_other_manager_players', async () => {
      for (let index = 0; index < 2; index++) {
        const roster = members[index].roster, used = new Set();
        const starters = {};
        for (const slot of ['QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE', 'FLEX', 'K', 'DST']) {
          const eligible = slot === 'FLEX' ? ['RB', 'FB', 'WR', 'TE'] : [slot.replace(/[12]$/, '')];
          const player = roster.find(player => !used.has(player.id) && eligible.includes(player.position));
          assert.ok(player); used.add(player.id); starters[slot] = player.id;
        }
        const bench = roster.filter(player => !used.has(player.id)).map(player => player.id);
        await fixture[index].app.saveMyWeeklyLineup(league.id, 18, starters, bench);
        lineups.push({ starters, bench });
      }
      await rejects(() => a.app.saveMyWeeklyLineup(league.id, 18, lineups[1].starters, lineups[1].bench));
      const rows = requireOk(await b.app.supabase.from('ball_knower_weekly_lineups').select('member_id,starters').eq('league_id', league.id).eq('week_number', 18));
      assert.equal(rows.length, 2);
      for (let index = 0; index < 2; index++) assert.deepEqual(rows.find(row => row.member_id === members[index].id).starters, lineups[index].starters);
      return { savedWeek: 18, schedule: 'synthetic_pregame_fixture', otherManagerLineupUnchanged: true, kickoffLockLifecycleVerified: false };
    });
    if (scoringOverlay) await check('fantasy.real_schema_atomic_scoring_overlay', async () => {
      const filename = 'scripts/qa/fantasy-scoring-overlay.sql';
      const sql = readFileSync(resolve(filename), 'utf8');
      assert.match(sql, /\bbegin\s*;/i); assert.match(sql, /\brollback\s*;/i);
      assert.doesNotMatch(sql, /(?:insert\s+into|update|delete\s+from)\s+auth\.|(?:drop|create)\s+table\s+(?:public|auth)\.|net\.http_|cron\.schedule|vault\./i);
      const stateSql = `select coalesce(jsonb_agg(to_jsonb(l) order by member_id),'[]'::jsonb) from public.ball_knower_weekly_lineups l where league_id=${sqlLiteral(league.id)};`;
      const before = localSql(config.databaseUrl, stateSql);
      const context = { league: league.id, user_a: a.item.id, user_b: b.item.id, member_a: members[0].id, member_b: members[1].id };
      const settings = Object.entries(context).map(([key, value]) => `select set_config('bk.launch_qa_${key}',${sqlLiteral(value)},false);`).join('\n');
      const result = localSql(config.databaseUrl, settings + '\n' + sql, 'scoring_overlay');
      assert.match(result, /real-schema scoring overlay passed/);
      assert.equal(localSql(config.databaseUrl, stateSql), before, 'transactional scoring fixture must preserve submitted lineups');
      return { fixture: filename, sha256: sha256(sql), actualProductionSchemaLegacyTriggerAndForeignKeys: true, managers: 2, syntheticApprovedContractOnly: true, noProviderCalls: true, fixtureTransactionRolledBack: true, currentProviderContractVerified: false };
    });
    if (secureLineupOverlay) await check('fantasy.real_auth_direct_lineup_dml_denied_and_kickoff_rpc_guard', async () => {
      for (let index = 0; index < 2; index++) {
        const client = fixture[index].app.supabase;
        const row = { league_id: league.id, member_id: members[index].id, week_number: 17, starters: lineups[index].starters, bench: lineups[index].bench };
        const attempts = [
          () => client.from('ball_knower_weekly_lineups').insert(row),
          () => client.from('ball_knower_weekly_lineups').update({ locked_player_ids: [] }).eq('league_id', league.id).eq('member_id', members[index].id),
          () => client.from('ball_knower_weekly_lineups').upsert(row, { onConflict: 'league_id,member_id,week_number' }),
          () => client.from('ball_knower_weekly_lineups').delete().eq('league_id', league.id).eq('member_id', members[index].id),
        ];
        for (const attempt of attempts) assert.equal((await attempt()).error?.code, '42501');
        await fixture[index].app.saveMyWeeklyLineup(league.id, 18, lineups[index].starters, lineups[index].bench);
      }
      const qb = members[0].roster.find(player => player.id === lineups[0].starters.QB);
      const benchQb = members[0].roster.find(player => player.position === 'QB' && lineups[0].bench.includes(player.id));
      assert.ok(qb && benchQb);
      const game = JSON.parse(localSql(config.databaseUrl, `select coalesce(json_agg(json_build_object('id',provider_game_id,'home',home_team,'away',away_team)),'[]'::json) from public.ball_knower_nfl_games where provider_game_id like 'qa-synthetic-week18-%' and season=2026 and week_number=18 and ${sqlLiteral(qb.team)} in(home_team,away_team);`));
      assert.equal(game.length, 1);
      localSql(config.databaseUrl, `update public.ball_knower_nfl_games set kickoff_at=now()-interval '1 minute' where provider_game_id=${sqlLiteral(game[0].id)};`);
      try {
        const starters = { ...lineups[0].starters, QB: benchQb.id };
        const bench = lineups[0].bench.map(id => id === benchQb.id ? qb.id : id);
        let locked = false;
        try { await a.app.saveMyWeeklyLineup(league.id, 18, starters, bench); }
        catch (error) { assert.match(String(error.message), /kickoff|locked|started/i); locked = true; }
        assert.equal(locked, true);
        const saved = requireOk(await a.app.supabase.from('ball_knower_weekly_lineups').select('starters').eq('league_id', league.id).eq('member_id', members[0].id).eq('week_number', 18).single());
        assert.deepEqual(saved.starters, lineups[0].starters);
        const startedTeams = new Set([game[0].home, game[0].away]);
        const wrSlot = ['WR1', 'WR2'].find(slot => !startedTeams.has(members[0].roster.find(player => player.id === lineups[0].starters[slot]).team));
        const benchWr = members[0].roster.find(player => player.position === 'WR' && lineups[0].bench.includes(player.id) && !startedTeams.has(player.team));
        assert.ok(wrSlot && benchWr, 'fixture must contain an unstarted starter and bench WR');
        const oldWr = lineups[0].starters[wrSlot];
        const unlockedStarters = { ...lineups[0].starters, [wrSlot]: benchWr.id };
        const unlockedBench = lineups[0].bench.map(id => id === benchWr.id ? oldWr : id);
        const benchGame = JSON.parse(localSql(config.databaseUrl, `select coalesce(json_agg(json_build_object('id',provider_game_id)),'[]'::json) from public.ball_knower_nfl_games where provider_game_id like 'qa-synthetic-week18-%' and season=2026 and season_type='reg' and week_number=18 and ${sqlLiteral(benchWr.team)} in(home_team,away_team);`));
        assert.equal(benchGame.length, 1);
        localSql(config.databaseUrl, `update public.ball_knower_nfl_games set kickoff_at=now()-interval '1 minute' where provider_game_id=${sqlLiteral(benchGame[0].id)};`);
        try {
          await rejects(() => a.app.saveMyWeeklyLineup(league.id, 18, unlockedStarters, unlockedBench));
        } finally { localSql(config.databaseUrl, `update public.ball_knower_nfl_games set kickoff_at=now()+interval '7 days' where provider_game_id=${sqlLiteral(benchGame[0].id)};`); }
        await a.app.saveMyWeeklyLineup(league.id, 18, unlockedStarters, unlockedBench);
        const changed = requireOk(await a.app.supabase.from('ball_knower_weekly_lineups').select('starters').eq('league_id', league.id).eq('member_id', members[0].id).eq('week_number', 18).single());
        assert.equal(changed.starters.QB, qb.id); assert.equal(changed.starters[wrSlot], benchWr.id);
        lineups[0] = { starters: unlockedStarters, bench: unlockedBench };
        localSql(config.databaseUrl, `update public.ball_knower_weekly_lineups set locked=true where league_id=${sqlLiteral(league.id)} and member_id=${sqlLiteral(members[0].id)} and week_number=18;`);
        try {
          await a.app.saveMyWeeklyLineup(league.id, 18, unlockedStarters, unlockedBench);
          const same = requireOk(await a.app.supabase.from('ball_knower_weekly_lineups').select('locked').eq('league_id', league.id).eq('member_id', members[0].id).eq('week_number', 18).single());
          assert.equal(same.locked, true, 'an identical RPC save must preserve an explicit full lock');
          await rejects(() => a.app.saveMyWeeklyLineup(league.id, 18, { ...unlockedStarters, [wrSlot]: oldWr }, lineups[0].bench.map(id => id === oldWr ? benchWr.id : id)));
        } finally { localSql(config.databaseUrl, `update public.ball_knower_weekly_lineups set locked=false where league_id=${sqlLiteral(league.id)} and member_id=${sqlLiteral(members[0].id)} and week_number=18;`); }
      } finally { localSql(config.databaseUrl, `update public.ball_knower_nfl_games set kickoff_at=now()+interval '7 days' where provider_game_id=${sqlLiteral(game[0].id)};`); }
      return { actualAuthenticatedSessions: 2, directDmlDenied: ['INSERT', 'UPDATE', 'UPSERT', 'DELETE'], validPreKickoffRpc: true, postKickoffSwapRejected: true, startedBenchPlayerCannotEnter: true, priorSavedLineupUnchangedAfterRejection: true, unlockedReceiverSwapAfterAnotherGameStarts: true, explicitFullLockPreservedAcrossIdenticalSave: true, schedule: 'isolated_fixture_clock_transition' };
    });
    await check('fantasy.concurrent_acquisition_has_one_winner', async () => {
      const drafted = new Set(draft.picks.map(pick => pick.playerId));
      const seededIds = new Set(requireOk(await admin.from('ball_knower_fantasy_player_groups').select('player_id')).map(row => row.player_id));
      const target = a.app.PLAYERS_DATABASE.find(player => player.position === 'DST' && seededIds.has(player.id) && !drafted.has(player.id));
      assert.ok(target);
      const drops = members.map((member, index) => member.roster.find(player => player.position === 'DST' && lineups[index].bench.includes(player.id)).id);
      const before = members.map(member => member.roster.map(player => player.id).sort());
      const results = await Promise.allSettled(fixture.map((person, index) => person.app.submitFaabClaim(league.id, members[index].id, target.id, 0, drops[index])));
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      const latest = await a.app.fetchCloudLeague(league.id);
      assert.equal(latest.members.flatMap(member => member.roster).filter(player => player.id === target.id).length, 1);
      assert.ok(latest.members.every(member => member.roster.length === 15));
      const loser = results.findIndex(result => result.status === 'rejected');
      assert.deepEqual(latest.members.find(member => member.id === members[loser].id).roster.map(player => player.id).sort(), before[loser]);
      const transactions = requireOk(await a.app.supabase.from('ball_knower_transactions').select('id').eq('league_id', league.id).eq('transaction_type', 'free_agent'));
      assert.equal(transactions.length, 1);
      return { successfulAdds: 1, rejectedAdds: 1, transactionRows: 1, loserRosterUnchanged: true };
    });
    await check('community.private_friend_challenge_immutable_results', async () => {
      const friendship = await a.app.sendFriendRequest(b.item.id);
      await b.app.respondFriendRequest(friendship, true);
      const { id } = await a.app.miniChallengeAction('create', { game: 'bench', opponent: b.item.id });
      manifest.miniChallengeId = id; saveManifest();
      await b.app.miniChallengeAction('accept', { id });
      const attempts = [];
      for (const person of fixture) attempts.push(await person.app.miniChallengeAction('begin', { id }));
      await wait(2200);
      for (let index = 0; index < 2; index++) await fixture[index].app.miniChallengeAction('submit', { id, token: attempts[index].token, stats: { reps: 10 + index * 2 } });
      await a.app.miniChallengeAction('submit', { id, token: attempts[0].token, stats: { reps: 99 } });
      const row = (await b.app.miniChallengeAction('list')).find(row => row.id === id);
      assert.equal(row.status, 'completed'); assert.equal(row.challenger_stats.reps, 10); assert.equal(row.opponent_stats.reps, 12); assert.equal(row.winner_id, b.item.id);
      return { privateInvite: true, immutableStoredResults: true, scoreSource: 'synthetic_device_reported_fixture' };
    });
    await check('football.private_three_drive_server_owned_result_receipt', async () => {
      const { id } = await a.app.footballArenaAction('create', { team: 'BRK', opponent: b.item.id });
      manifest.footballMatchId = id; saveManifest();
      await b.app.footballArenaAction('accept', { id, team: 'JCY' });
      for (let drive = 1; drive <= 3; drive++) {
        const attempts = [];
        for (const person of fixture) attempts.push(await person.app.footballArenaAction('begin', { id, drive, launch: randomUUID() }));
        await wait(2200);
        if (drive === 1) await rejects(() => a.app.footballArenaAction('submit', { id, drive, token: randomUUID(), stats: { points: 7, yards: 40, plays: 6 } }));
        for (let index = 0; index < 2; index++) {
          const points = index === 0 ? [7, 3, 0][drive - 1] : [3, 0, 0][drive - 1];
          const saved = await fixture[index].app.footballArenaAction('submit', { id, drive, token: attempts[index].token, stats: { points, yards: 40, plays: 6, passingYards: 25, rushingYards: 15, passAttempts: 3, completions: 2, touchdowns: points === 7 ? 1 : 0, turnovers: 0 } });
          assert.equal(saved.saved, true); assert.equal(saved.points, points);
        }
        const retry = await a.app.footballArenaAction('submit', { id, drive, token: attempts[0].token, stats: { points: 8, yards: 99, plays: 1 } });
        assert.equal(retry.points, [7, 3, 0][drive - 1]);
      }
      const home = await b.app.footballArenaAction('home');
      const match = home.matches.find(match => match.id === id);
      assert.equal(match.status, 'completed'); assert.equal(match.winner_id, a.item.id); assert.equal(match.drives.length, 6);
      assert.equal(match.drives.filter(drive => drive.user_id === a.item.id).reduce((sum, drive) => sum + drive.points, 0), 10);
      assert.equal(home.standings.find(row => row.user_id === a.item.id).wins, 1);
      assert.equal(home.standings.find(row => row.user_id === b.item.id).losses, 1);
      return { completedDrives: 6, storedScore: [10, 3], winnerComputedByServer: true, immutableRetry: true, scoreSource: 'synthetic_device_reported_fixture', authoritativeGameplay: false };
    });
    if (pushOverlay) await check('push.real_auth_session_revocation_api_and_queue_guards', () => verifyRealPushSessions({ admin, fixture, leagueId: league.id, databaseUrl: config.databaseUrl, runId: manifest.runId }));
    receipt.ok = true;
  } catch (error) {
    receipt.ok = false;
    receipt.checks.push({ name: currentStep, status: 'failed', code: safeCode(error), location: String(error?.stack || '').match(/scripts\/qa\/[a-z0-9.-]+:\d+:\d+/i)?.[0] });
  } finally {
    // Quiesce every transport before deleting fixtures. The worker never emits
    // credentials or resumes scenario work after this barrier.
    for (const unsubscribe of unsubscribers) unsubscribe();
    for (const person of fixture) { await person.app.supabase.removeAllChannels(); person.app.supabase.auth.stopAutoRefresh(); }
    await Promise.allSettled([...inFlight]);
    try {
      currentStep = 'cleanup'; manifest.phase = 'cleanup'; saveManifest();
      const users = [];
      for (const item of manifest.users) {
        const found = await admin.auth.admin.getUserById(item.id);
        if (found.error?.status === 404 || found.error?.code === 'user_not_found') continue;
        if (found.error) throw found.error;
        if (!ownsUser(found.data.user, manifest, item)) throw Object.assign(new Error('cleanup_ownership_mismatch'), { qaCode: 'cleanup_ownership_mismatch' });
        users.push(item);
        const person = fixture.find(person => person.item.id === item.id);
        if (person && !person.sessionsGloballyRevoked) requireOk(await admin.auth.admin.signOut(person.tokens.at(-1), 'global'));
        requireOk(await admin.auth.admin.updateUserById(item.id, { ban_duration: '876000h' }));
      }
      const league = requireOk(await admin.from('ball_knower_leagues').select('id,commissioner_auth_id,settings').eq('id', manifest.leagueId).maybeSingle());
      if (league) {
        assert.equal(league.commissioner_auth_id, manifest.users[0].id);
        assert.deepEqual(league.settings.launchQa, { owner: QA_OWNER, runId: manifest.runId, expiresAt: manifest.expiresAt });
        requireOk(await admin.from('ball_knower_leagues').delete().eq('id', manifest.leagueId).eq('commissioner_auth_id', manifest.users[0].id).eq('settings->launchQa->>runId', manifest.runId));
      }
      for (const item of users) { requireOk(await admin.auth.admin.deleteUser(item.id)); item.deleted = true; saveManifest(); }
      const ids = manifest.users.map(user => `${sqlLiteral(uuid(user.id))}::uuid`).join(',');
      const counts = JSON.parse(localSql(config.databaseUrl, `select json_build_object(
        'auth_users',(select count(*) from auth.users where id in(${ids})),
        'auth_sessions',(select count(*) from auth.sessions where user_id in(${ids})),
        'leagues',(select count(*) from public.ball_knower_leagues where id=${sqlLiteral(manifest.leagueId)}),
        'members',(select count(*) from public.ball_knower_league_members where auth_user_id in(${ids})),
        'friendships',(select count(*) from public.ball_knower_friendships where requester_id in(${ids}) or recipient_id in(${ids})),
        'football_matches',(select count(*) from bk_football_private.matches where challenger_id in(${ids}) or opponent_id in(${ids})),
        'football_drives',(select count(*) from bk_football_private.drives where user_id in(${ids})),
        'mini_challenges',(select count(*) from bk_minigames_private.challenges where challenger_id in(${ids}) or opponent_id in(${ids})),
        'mini_attempts',(select count(*) from bk_minigames_private.attempts where user_id in(${ids})),
        'notifications',(select count(*) from public.ball_knower_notifications where auth_user_id in(${ids}))${pushOverlay ? `,
        'push_settings',(select count(*) from ball_knower_private.push_settings where auth_user_id in(${ids})),
        'push_devices',(select count(*) from ball_knower_private.push_devices where auth_user_id in(${ids})),
        'push_deliveries',(select count(*) from ball_knower_private.push_deliveries where auth_user_id in(${ids}))` : ''});`));
      assert.ok(Object.values(counts).every(count => count === 0));
      receipt.cleanup = { status: 'verified', remainingOwnedRows: counts, quiescedTransports: true, refreshSessionsRevoked: true, accessTokensNeverExported: true, canonicalSeedRemovedByStackTeardown: true };
    } catch (error) {
      receipt.ok = false; receipt.cleanup = { status: 'blocked', code: safeCode(error), cleanupOnlyCommandAvailable: true };
    }
    stopped = true; globalThis.fetch = originalFetch;
    manifest.phase = 'finished'; manifest.cleanup = receipt.cleanup; saveManifest();
    receipt.finishedAt = new Date().toISOString();
    writeFileSync(resolve(outputDirectory, 'result.json'), JSON.stringify(receipt, null, 2));
  }
  return receipt;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    if (!process.env.BK_QA_LOCAL_STATUS) throw new Error('local_stack_status_path_required');
    const receipt = await runRealServices(process.env.BK_QA_LOCAL_STATUS, process.env.BK_QA_OUTPUT || 'artifacts/launch-real-services', process.env.BK_QA_CLEANUP_MANIFEST);
    console.log(JSON.stringify({ ok: receipt.ok, runId: receipt.runId, passed: receipt.checks.filter(check => check.status === 'passed').length, failed: receipt.checks.filter(check => check.status === 'failed'), cleanup: receipt.cleanup.status }));
    if (!receipt.ok) process.exitCode = 1;
  } catch { console.error(JSON.stringify({ ok: false, error: 'real_service_harness_initialization_failed' })); process.exitCode = 1; }
}
