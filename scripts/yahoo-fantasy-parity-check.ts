import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PLAYERS_DATABASE} from '../players';
import {validateLiveFantasyRoster,CPU_LIVE_FANTASY_POSITION_LIMITS} from '../liveFantasyRules';
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
])assert.ok(migration.includes(required),`migration is missing ${required}`);
assert.match(migration,/participant_a,participant_b[\s\S]*auth\.uid\(\)/,'DM policy must be permanent-auth owner scoped');
assert.match(migration,/Trade participants cannot vote|Trade participants cannot vote on their own deal/,'trade voting must exclude deal participants');
assert.match(migration,/rounds between 15 and 20/,'custom bench depth must remain bounded to 15–20 players');

const create=readFileSync(new URL('../CreateLeagueModal.tsx',import.meta.url),'utf8');
assert.ok(create.includes('Advanced League Settings'),'normal creation must keep advanced settings collapsed');
for(const format of ['live_snake','autopick','offline','mock'])assert.ok(create.includes(format),`creation is missing ${format}`);

const scoringApi=readFileSync(new URL('../api/fantasy-live-scoring.ts',import.meta.url),'utf8');
assert.ok(scoringApi.includes('scoreWithLeagueOverrides'),'custom league scoring must feed live totals');
const postDraft=readFileSync(new URL('../FantasyLeaguePostDraft.tsx',import.meta.url),'utf8');
assert.ok(postDraft.includes('fantasyRosterSize'),'post-draft moves and trades must use the fantasy roster size');
assert.ok(!postDraft.includes('TOTAL_ROSTER_SIZE'),'20-player Draft Order Game constants must not leak into standard fantasy moves');

console.log('Yahoo fantasy parity checks passed: ugly human roster, strict weekly lineup, private communications, commissioner rules, event notifications, and safe draft formats.');
