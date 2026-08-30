import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAYERS_DATABASE} from '../players';
import {validateLiveFantasyRoster,CPU_LIVE_FANTASY_POSITION_LIMITS} from '../liveFantasyRules';
import {buildFantasyWeekPairings,isCompleteFantasySchedule,seedFantasyStandings} from '../simulation';
import type {Player} from '../types';

const section=(source:string,start:string,end:string)=>{const from=source.indexOf(start);assert.ok(from>=0,`missing section start: ${start}`);const to=source.indexOf(end,from+start.length);assert.ok(to>from,`missing section end: ${end}`);return source.slice(from,to);};

const eligible=PLAYERS_DATABASE.filter(player=>['QB','RB','WR','TE','K','DST'].includes(player.position));
const take=(position:string,count:number,used=new Set<string>())=>eligible.filter(player=>player.position===position&&!used.has(player.id)).slice(0,count);
const ugly=[...take('QB',3),...take('TE',4),...take('RB',3),...take('WR',3),...take('K',1),...take('DST',1)] as Player[];
assert.equal(ugly.length,15,'fixture needs a complete 15-player roster');
assert.equal(validateLiveFantasyRoster(ugly).length,0,'human managers may finish an ugly but eligible 15-player roster');
assert.ok(ugly.filter(player=>player.position==='QB').length>CPU_LIVE_FANTASY_POSITION_LIMITS.QB,'fixture must exceed the CPU QB heuristic');
assert.ok(ugly.filter(player=>player.position==='TE').length>CPU_LIVE_FANTASY_POSITION_LIMITS.TE,'fixture must exceed the CPU TE heuristic');

const weeklyRules=readFileSync(new URL('../fantasyLeagueParityCloud.ts',import.meta.url),'utf8');
for(const slot of ["id:'QB'","id:'RB1'","id:'RB2'","id:'WR1'","id:'WR2'","id:'TE'","id:'FLEX'","id:'K'","id:'DST'"])assert.ok(weeklyRules.includes(slot),`weekly lineup is missing ${slot}`);

const migration=readFileSync(new URL('../migrations/20260830_yahoo_fantasy_parity_upgrade.sql',import.meta.url),'utf8');
for(const required of [
  'coalesce(v_member.is_ai,false)',
  'ball_knower_dm_threads','bk_dm_messages_private_read','send_ball_knower_trade_message',
  'ball_knower_trading_block','ball_knower_watched_players','fantasy_notification_fanout',
  'enforce_fantasy_acquisition_limit','enforce_fantasy_trade_deadline','vote_on_ball_knower_trade',
  'commissioner_set_ball_knower_waiver_priority','commissioner_edit_ball_knower_matchup',
  'commissioner_import_ball_knower_offline_draft','process_due_ball_knower_matchup_notifications',
  'build_fantasy_regular_schedule',
  "then 15 else 60 end",'Autopick recovery patch did not match','eligible=0','drop policy if exists bk_trade_votes_league_read',
])assert.ok(migration.includes(required),`migration is missing ${required}`);
assert.ok(!migration.includes("then 1 else 60 end"),'autopick clock must satisfy the existing 15-second minimum');
assert.match(migration,/participant_a,participant_b[\s\S]*auth\.uid\(\)/,'DM policy must be permanent-auth owner scoped');
assert.match(migration,/Trade participants cannot vote|Trade participants cannot vote on their own deal/,'trade voting must exclude deal participants');
assert.match(migration,/rounds between 15 and 20/,'custom bench depth must remain bounded to 15–20 players');
assert.ok(migration.includes('Offline draft results are locked after season activity begins'),'offline draft re-imports must lock before live season state can be invalidated');
assert.ok(migration.includes("if grp is null or grp not in('QB','RB','WR','TE','K','DST')"),'offline results must reject unknown player IDs before persisting picks');
assert.ok(migration.includes("player->>'id'=player_id")&&migration.includes('remove_stale_trading_block_entries'),'Trading Block writes must prove roster ownership and stale entries must be removed');
assert.ok(migration.includes('Regular-season length is locked after the schedule is created'),'the database must reject schedule-length drift after schedule creation');
const matchupEditRpc=section(migration,'create or replace function public.commissioner_edit_ball_knower_matchup','revoke all on function public.commissioner_set_ball_knower_waiver_priority');
assert.ok(matchupEditRpc.includes('week_number=p_week and kickoff_at<=now()'),'commissioner matchup edits must lock at NFL kickoff even before fantasy points are scored');
assert.ok(migration.includes('not is_ai and auth_user_id is not null'),'league-vote quorum must count only authenticated neutral voters');
assert.ok(migration.includes('p is null or r is null or(me is distinct from p and me is distinct from r)'),'trade-thread writes must require two resolved human participants');
assert.match(migration,/if tg_op='INSERT' then null;[\s\S]*elsif tg_op='UPDATE' then if old\.pick_index/,'draft INSERT notifications must not dereference OLD');
const deadlineGuard=section(migration,'create or replace function ball_knower_private.enforce_fantasy_trade_deadline','revoke all on function ball_knower_private.enforce_fantasy_trade_deadline');
assert.ok(deadlineGuard.includes("new.status in('accepted_pending_review','accepted')")&&migration.includes('before insert or update of status on public.ball_knower_trades'),'trade deadlines must be rechecked when a deal is accepted or executed');
const seasonResetRpc=section(migration,'create or replace function public.reset_ball_knower_league_for_next_season','revoke all on function public.reset_ball_knower_league_for_next_season');
assert.ok(seasonResetRpc.includes('delete from ball_knower_private.fantasy_acquisition_counters'),'season resets must clear acquisition-limit counters');
assert.ok(seasonResetRpc.includes('delete from ball_knower_private.matchup_notification_receipts'),'season resets must clear matchup reminder receipts');
assert.ok(seasonResetRpc.includes("-'fantasySeasonStarted'-'fantasySeasonComplete'-'currentWeek'-'nflSeason'"),'season resets must clear lifecycle state before the next draft');
assert.ok(seasonResetRpc.includes("jsonb_build_object('fantasySeasonResetAt',clock_timestamp())"),'season resets must mark the boundary for retained historical activity');
const settingsValidator=section(migration,'create or replace function ball_knower_private.validate_fantasy_league_settings','revoke all on function ball_knower_private.validate_fantasy_league_settings');
assert.ok(settingsValidator.includes('Scoring settings are locked after scoring begins')&&settingsValidator.includes('Playoff field and seeding are locked after postseason scoring begins')&&settingsValidator.includes("old.settings->'playoffSeeding'")&&settingsValidator.includes("old.settings->'divisionsEnabled'"),'database validation must prevent mixed scoring eras and bracket rewrites');
assert.ok(settingsValidator.includes("nullif(old.settings->>'seasonGames','')")&&settingsValidator.includes("nullif(s->>'seasonGames','')"),'schedule locks must compare the effective legacy season length');
assert.ok(settingsValidator.includes('Regular season and playoffs must finish by NFL Week 18'),'the authoritative settings validator must reject unscorable playoff calendars');
assert.ok(migration.indexOf('Normalize legacy fantasy calendars')<migration.indexOf('create trigger validate_fantasy_league_settings'),'legacy 17-week calendars must be normalized before the schedule lock is installed');
assert.ok(migration.includes("'{draftOrderGameGames}'")&&migration.includes("jsonb_array_length(coalesce(l.season_result->'games','[]'::jsonb))<>ready.weeks*ready.member_count/2"),'legacy Draft Order Game receipts must be preserved while their fantasy schedule is normalized');
assert.ok(migration.includes("not coalesce((settings->>'fantasySeasonStarted')::boolean,false)")&&migration.includes('w.locked or jsonb_array_length')&&migration.includes("coalesce(l.season_result->>'orderMethod','game')='game'"),'calendar migration must exclude active leagues and preserve untagged Draft Order Game receipts');
const scheduledFormatPatch=section(migration,'do $scheduled_format_patch$','end;$scheduled_format_patch$;');
assert.ok(scheduledFormatPatch.includes('Scheduled special-format guard before reminders'),'special draft formats must be excluded before scheduled reminder branches');
const autopickRecoveryPatch=section(migration,'do $autopick_recovery_patch$','end;$autopick_recovery_patch$;');
assert.ok(autopickRecoveryPatch.includes("l.id=d.league_id),''live_snake'')=''autopick'' or exists"),'autopick-only rooms must enter the outer recovery selection before their clock expires');

const create=readFileSync(new URL('../CreateLeagueModal.tsx',import.meta.url),'utf8');
const createAdvanced=section(create,'<details className="mb-5','</details>');
assert.ok(createAdvanced.includes('<summary')&&!createAdvanced.includes('<details open'),'normal creation must keep advanced settings collapsed');
for(const format of ['live_snake','autopick','offline','mock'])assert.ok(createAdvanced.includes(`["${format}"`),`creation is missing selectable ${format}`);
assert.ok(create.includes("regularSeasonWeeks:15")&&createAdvanced.includes("Number(value)+(advanced.playoffTeams===4?2:3)<=18"),'new league defaults and controls must keep playoffs inside NFL Week 18');
const contextSource=readFileSync(new URL('../BallKnowerContext.tsx',import.meta.url),'utf8');
assert.ok(contextSource.includes('draftOrderGameGames:fullResults.games')&&contextSource.includes('games:fantasySchedule'),'Draft Order Game results must retain scored receipts separately from the canonical fantasy schedule');
assert.ok(contextSource.includes('normalizeRestoredLocalLeague')&&contextSource.includes('regularSeasonWeeks:fantasyWeeks'),'restored and newly finalized local leagues must persist a calendar-safe fantasy season length');
const localOfflineImport=section(contextSource,'const importOfflineFantasyDraftResults','const resetLeagueSimulation');
assert.ok(localOfflineImport.includes('applyLiveDraftRosterAssignments')&&localOfflineImport.includes('importCloudOfflineFantasyDraft'),'Offline Results must finalize both local and cloud league rosters');
assert.ok(localOfflineImport.includes("league.liveDraft?.status==='completed'")&&localOfflineImport.includes('fantasySeasonStarted'),'local Offline Results must reject re-import after finalization or season activity');
const offlineImportRpc=section(migration,'create or replace function public.commissioner_import_ball_knower_offline_draft','revoke all on function public.commissioner_import_ball_knower_offline_draft');
assert.ok(offlineImportRpc.includes("league_settings->>'fantasySeasonResetAt'")&&offlineImportRpc.includes('created_at>=activity_cutoff'),'offline-import activity locks must ignore retained history from archived seasons');

const scoringApi=readFileSync(new URL('../api/fantasy-live-scoring.ts',import.meta.url),'utf8');
assert.ok(scoringApi.includes('scoreWithLeagueOverrides'),'custom league scoring must feed live totals');
assert.ok(scoringApi.includes('raw.passingYards')&&scoringApi.includes('raw.fieldGoalsMade'),'custom scoring must accept persisted normalized stat lines');
assert.match(scoringApi,/providerProjection\?liveProjectedPoints\(actual,scoreWithLeagueOverrides\(providerProjection,format,customScoring\)/,'custom scoring must also drive compatible matchup projections');
const defenseOverrideFunction=section(scoringApi,'function scoreDefenseWithLeagueOverrides','function hasDefenseProjectionStats');
const leagueScoringLoop=section(scoringApi,'for(const league of activeLeagues)','if(lineupWrites.length)');
assert.ok(defenseOverrideFunction.includes("weight('dstTurnover',2)")&&leagueScoringLoop.includes('usesCustomDefenseScoring?scoreDefenseWithLeagueOverrides')&&leagueScoringLoop.includes('hasDefenseProjectionStats(providerDefenseProjection)?liveProjectedPoints'),'custom D/ST scoring must drive actual totals and compatible projections');
assert.ok(leagueScoringLoop.includes('hasDefenseProjectionStats(providerDefenseProjection)?liveProjectedPoints')&&leagueScoringLoop.match(/game\?\.game_period\):actual/g)?.length===2,'custom projections must preserve actual points when compatible projection inputs are unavailable');
assert.ok(!create.includes("['autopick','offline'].includes"),'local Offline Results creation must remain available');
const postDraft=readFileSync(new URL('../FantasyLeaguePostDraft.tsx',import.meta.url),'utf8');
assert.ok(postDraft.includes('fantasyRosterSize'),'post-draft moves and trades must use the fantasy roster size');
assert.ok(!postDraft.includes('TOTAL_ROSTER_SIZE'),'20-player Draft Order Game constants must not leak into standard fantasy moves');
assert.ok(postDraft.includes('regularSeasonSchedule'),'commissioner schedule edits must feed live scoring and standings');
assert.ok(postDraft.includes('Math.min(maxSelectableWeek')&&postDraft.includes('[maxSelectableWeek,settings.currentWeek]'),'the active week selector must preserve playoff weeks instead of clamping to the regular-season endpoint');
assert.ok(postDraft.includes('effectiveSeeding'),'division-winner seeding must be disabled when divisions are off');
const advancedSettings=readFileSync(new URL('../FantasyAdvancedLeagueSettings.tsx',import.meta.url),'utf8');
assert.ok(advancedSettings.includes('disabled={disabled||scheduleLocked}'),'regular-season length must lock once a persisted schedule exists');
assert.ok(advancedSettings.includes('settings.regularSeasonWeeks??settings.seasonGames'),'legacy season length must display the same effective value used by gameplay');
assert.ok(advancedSettings.includes('disabled={disabled||scoringLocked}')&&advancedSettings.includes('disabled={disabled||postseasonLocked}'),'scoring and playoff-field controls must lock after their respective competition starts');
assert.ok(postDraft.includes('disabled={!isCommissioner||scoringLocked}'),'the duplicate post-draft scoring control must share the scoring lock');
const simulationView=readFileSync(new URL('../SimulationView.tsx',import.meta.url),'utf8');
assert.match(simulationView,/!specialDraftFormat\s*&&\s*<button\s+id="sim-open-draft-btn"/,'special formats must not expose the live snake draft action');
assert.ok(simulationView.includes("specialDraftFormat?'':'min-[390px]:grid-cols-2'"),'special formats must retain the Share Order action');
const essentials=readFileSync(new URL('../FantasyLeagueEssentials.tsx',import.meta.url),'utf8');
assert.ok(essentials.includes('fantasyRosterSize'),'legacy fantasy views must use configured roster size');
assert.ok(essentials.includes('<FantasyLeagueCommunications league={league} trades={trades}/>')&&!essentials.includes('TradingBlockAddRow'),'legacy fantasy views must reuse the owner-scoped communication surface');
assert.ok(essentials.includes('disabled={!isCommissioner || scoringLocked}'),'the legacy league-rules scoring control must share the scoring lock');
assert.ok(essentials.includes('current[tradeId]===sentBody'),'an in-flight trade send must preserve a newer message draft');
const essentialsRefresh=essentials.slice(essentials.indexOf('const refresh = async'),essentials.indexOf('useEffect(() =>',essentials.indexOf('const refresh = async')));
const coreRefreshPromise=essentialsRefresh.match(/const \[parity, ops\] = await Promise\.all\(\[([\s\S]*?)\]\);/)?.[1]||'';
assert.ok(/void fetchFantasyCommunications\(requestedLeagueId\)\.then/.test(essentialsRefresh)&&!/await\s+fetchFantasyCommunications/.test(essentialsRefresh)&&!coreRefreshPromise.includes('fetchFantasyCommunications'),'communication failures must not block core league refresh state');
assert.ok(essentialsRefresh.includes('communicationRequestRef.current!==communicationRequestId'),'only the newest communication request may update the legacy trade-thread state');
assert.ok(essentials.includes('communicationUserIdRef.current!==requestedUserId')&&essentials.includes('tradeMessagesScope===communicationScope?tradeMessages:[]'),'legacy private trade messages must reset and render-gate across identity changes');
const communications=readFileSync(new URL('../FantasyLeagueCommunications.tsx',import.meta.url),'utf8');
assert.ok(communications.includes('requestRef.current!==requestId')&&communications.includes('requestRef.current+=1'),'the primary communication surface must ignore stale same-league and cross-league refreshes');
assert.ok(communications.includes('userIdRef.current!==requestedUserId')&&communications.includes('[league.id,currentUser?.id]'),'private communication state and in-flight responses must reset across identity changes without a remount');
assert.ok(communications.includes('dataScope===communicationScope?data:EMPTY_COMMUNICATION_STATE'),'identity-switched renders must never expose the previous account communication state before effects run');
assert.ok(communications.includes('pendingRef.current')&&communications.includes('pending||!tradeBody.trim()')&&communications.includes('tradeIdRef.current===sentTradeId'),'communication sends must be single-flight and clear drafts only in the original full scope');
assert.ok(communications.includes('isCloudConfigured?<CloudFantasyLeagueCommunications'),'cloud-only DMs, trade threads, and Trading Block must not render in local leagues');
assert.ok(advancedSettings.includes('isCloudConfigured&&<CommissionerWaiverEditor')&&advancedSettings.includes('isCloudConfigured&&<CommissionerScheduleEditor'),'RPC-only commissioner editors must be hidden in local leagues');
const draftFormats=readFileSync(new URL('../FantasyDraftFormatWorkspace.tsx',import.meta.url),'utf8');
assert.ok(draftFormats.includes("await updateLeagueSettings(league.id,{draftFormat:'live_snake'})"),'mock commissioners need an awaited authoritative path into a production draft');
assert.ok(draftFormats.includes('{picks.map(')&&!draftFormats.includes('picks.slice(0'),'mock results must render every round');
const parityCloud=readFileSync(new URL('../fantasyLeagueParityCloud.ts',import.meta.url),'utf8');
assert.ok(parityCloud.includes("!Number.isFinite(priority)||priority<1"),'blank or invalid waiver priorities must be rejected rather than promoted to first');

const tiedRows=[
  {memberId:'a',rank:1,wins:2,losses:1,ties:0,winPercentage:2/3,pointsFor:330,pointsAgainst:0,pointDifferential:30},
  {memberId:'b',rank:2,wins:2,losses:1,ties:0,winPercentage:2/3,pointsFor:320,pointsAgainst:0,pointDifferential:20},
  {memberId:'c',rank:3,wins:2,losses:1,ties:0,winPercentage:2/3,pointsFor:310,pointsAgainst:0,pointDifferential:10},
] as any[];
const cyclicGames=[
  {id:'ab',week:1,homeMemberId:'a',awayMemberId:'b',winnerId:'a'},
  {id:'bc',week:2,homeMemberId:'b',awayMemberId:'c',winnerId:'b'},
  {id:'ca',week:3,homeMemberId:'c',awayMemberId:'a',winnerId:'c'},
] as any[];
const seeded=seedFantasyStandings(tiedRows,cyclicGames,'record_head_to_head').map(row=>row.memberId);
const reversed=seedFantasyStandings([...tiedRows].reverse(),cyclicGames,'record_head_to_head').map(row=>row.memberId);
assert.deepEqual(seeded,['a','b','c'],'cyclic head-to-head ties must use the deterministic base fallback');
assert.deepEqual(reversed,seeded,'head-to-head seeding must not depend on input order');
const scheduleMembers=[{id:'a'},{id:'b'},{id:'c'},{id:'d'}] as any[];
const validSchedule=[...buildFantasyWeekPairings(scheduleMembers,1),...buildFantasyWeekPairings(scheduleMembers,2),...buildFantasyWeekPairings(scheduleMembers,3)];
assert.equal(isCompleteFantasySchedule(scheduleMembers,3,validSchedule),true,'complete schedules should be accepted');
const duplicateMemberSchedule=validSchedule.map(game=>({...game}));duplicateMemberSchedule[1]={...duplicateMemberSchedule[1],homeMemberId:duplicateMemberSchedule[0].homeMemberId};
assert.equal(isCompleteFantasySchedule(scheduleMembers,3,duplicateMemberSchedule),false,'a member repeated within a week must invalidate persisted schedule edits');

console.log('Yahoo fantasy parity checks passed: ugly human roster, strict weekly lineup, private communications, commissioner rules, event notifications, and safe draft formats.');
