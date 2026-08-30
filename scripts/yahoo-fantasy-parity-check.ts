import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAYERS_DATABASE} from '../players';
import {validateLiveFantasyRoster,CPU_LIVE_FANTASY_POSITION_LIMITS} from '../liveFantasyRules';
import {buildFantasyWeekPairings,isCompleteFantasySchedule,seedFantasyStandings} from '../simulation';
import type {Player} from '../types';

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
assert.ok(migration.includes('not is_ai and auth_user_id is not null'),'league-vote quorum must count only authenticated neutral voters');
assert.ok(migration.includes('p is null or r is null or(me is distinct from p and me is distinct from r)'),'trade-thread writes must require two resolved human participants');
assert.match(migration,/if tg_op='INSERT' then null;[\s\S]*elsif tg_op='UPDATE' then if old\.pick_index/,'draft INSERT notifications must not dereference OLD');

const create=readFileSync(new URL('../CreateLeagueModal.tsx',import.meta.url),'utf8');
assert.ok(create.includes('Advanced League Settings'),'normal creation must keep advanced settings collapsed');
for(const format of ['live_snake','autopick','offline','mock'])assert.ok(create.includes(format),`creation is missing ${format}`);

const scoringApi=readFileSync(new URL('../api/fantasy-live-scoring.ts',import.meta.url),'utf8');
assert.ok(scoringApi.includes('scoreWithLeagueOverrides'),'custom league scoring must feed live totals');
assert.ok(scoringApi.includes('raw.passingYards')&&scoringApi.includes('raw.fieldGoalsMade'),'custom scoring must accept persisted normalized stat lines');
assert.match(scoringApi,/providerProjection\?liveProjectedPoints\(actual,scoreWithLeagueOverrides\(providerProjection,format,customScoring\)/,'custom scoring must also drive compatible matchup projections');
assert.ok(!create.includes("['autopick','offline'].includes"),'local Offline Results creation must remain available');
const postDraft=readFileSync(new URL('../FantasyLeaguePostDraft.tsx',import.meta.url),'utf8');
assert.ok(postDraft.includes('fantasyRosterSize'),'post-draft moves and trades must use the fantasy roster size');
assert.ok(!postDraft.includes('TOTAL_ROSTER_SIZE'),'20-player Draft Order Game constants must not leak into standard fantasy moves');
assert.ok(postDraft.includes('regularSeasonSchedule'),'commissioner schedule edits must feed live scoring and standings');
assert.ok(postDraft.includes('effectiveSeeding'),'division-winner seeding must be disabled when divisions are off');
const advancedSettings=readFileSync(new URL('../FantasyAdvancedLeagueSettings.tsx',import.meta.url),'utf8');
assert.ok(advancedSettings.includes('disabled={disabled||scheduleLocked}'),'regular-season length must lock once a persisted schedule exists');
assert.ok(advancedSettings.includes('settings.regularSeasonWeeks??settings.seasonGames'),'legacy season length must display the same effective value used by gameplay');
const simulationView=readFileSync(new URL('../SimulationView.tsx',import.meta.url),'utf8');
assert.match(simulationView,/!specialDraftFormat\s*&&\s*<button\s+id="sim-open-draft-btn"/,'special formats must not expose the live snake draft action');
assert.ok(simulationView.includes("specialDraftFormat?'':'min-[390px]:grid-cols-2'"),'special formats must retain the Share Order action');
const essentials=readFileSync(new URL('../FantasyLeagueEssentials.tsx',import.meta.url),'utf8');
assert.ok(essentials.includes('fantasyRosterSize'),'legacy fantasy views must use configured roster size');
assert.ok(essentials.includes('<FantasyLeagueCommunications league={league} trades={trades}/>')&&!essentials.includes('TradingBlockAddRow'),'legacy fantasy views must reuse the owner-scoped communication surface');
assert.ok(essentials.includes('void fetchFantasyCommunications(requestedLeagueId).then')&&!/Promise\.all\(\[\s*fetchFantasyParityState[\s\S]{0,300}fetchFantasyCommunications/.test(essentials),'communication failures must not block core league refresh state');
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
