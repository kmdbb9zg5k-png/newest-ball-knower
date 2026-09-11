import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { normalizeTank01PlayerStats, normalizeTank01DefenseStats, scoreFantasyPlayer } from '../fantasyLiveScoring';
import { canonicalGameLogStats, gameLogColumns, GAME_LOG_STAT_KEYS } from '../fantasyGameLogStats';

const read=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const api=read('api/fantasy-live-scoring.ts');
const detail=read('FantasyPlayerDetail.tsx');
const cloud=read('fantasyPlayerDetailsCloud.ts');
// Execute the exact self-contained API normalizer, rather than merely checking
// that its source mentions the expected column names.
const apiScope:any={exports:{}};
const apiCore=api.slice(0,api.indexOf('export const config'))+'\nexports.player=normalizeTank01PlayerStats;exports.defense=normalizeTank01DefenseStats;';
vm.runInNewContext(ts.transpileModule(apiCore,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,apiScope);
const plain=(value:unknown)=>JSON.parse(JSON.stringify(value));
const fixtures=[
  {Passing:{passAttempts:39,passCompletions:26,passYds:301,passTD:3,int:1},Rushing:{rushAttempts:5,rushYds:31}},
  {Rushing:{carries:17,rushYds:88,rushTD:1},Receiving:{targets:6,receptions:4,recYds:35}},
  {Receiving:{targets:11,receptions:7,recYds:102,recTD:1}},
  {Kicking:{fgMade:3,fgMissed:1,xpMade:2,xpMissed:0}},
  {Kicking:{fgMade:3}}, {Kicking:{fgMissed:1}}, {Passing:{passAttempts:'N/A',att:'31',cmp:'20'}},
  {passingAttempts:0,passingCompletions:0,rushingAttempts:0,targets:0},
  {fieldGoalsAttempted:6,fieldGoalsMade:3,extraPointsAttempted:4}, {},
];
for(const fixture of fixtures) assert.deepEqual(plain(apiScope.exports.player(fixture)),normalizeTank01PlayerStats(fixture),'server and shared stat normalization must remain behaviorally identical');
const qb=normalizeTank01PlayerStats(fixtures[0]);
assert.equal(qb.passingAttempts,39);assert.equal(qb.passingCompletions,26);assert.equal(qb.rushingAttempts,5);
assert.equal(normalizeTank01PlayerStats(fixtures[1]).targets,6);
assert.equal(normalizeTank01PlayerStats(fixtures[3]).fieldGoalsAttempted,4);
assert.equal(normalizeTank01PlayerStats(fixtures[4]).fieldGoalsAttempted,undefined,'made alone cannot prove total attempts');
assert.equal(normalizeTank01PlayerStats(fixtures[5]).fieldGoalsAttempted,undefined,'missed alone cannot prove total attempts');
assert.equal(normalizeTank01PlayerStats(fixtures[6]).passingAttempts,31,'invalid aliases must not mask a later valid field');
assert.equal(normalizeTank01PlayerStats(fixtures[7]).passingAttempts,0,'actual zero attempts must remain a known value');
assert.equal(normalizeTank01PlayerStats(fixtures[8]).fieldGoalsAttempted,6,'explicit known attempts must win');
assert.equal(normalizeTank01PlayerStats({Passing:{passAttempts:'N/A'}}).passingAttempts,undefined);
assert.equal(normalizeTank01PlayerStats({Passing:{passAttempts:' '}}).passingAttempts,undefined);
assert.equal(normalizeTank01PlayerStats({Passing:{passAttempts:false}}).passingAttempts,undefined);
const oldScore=normalizeTank01PlayerStats({Passing:{passYds:250,passTD:2,int:1},Rushing:{rushYds:25,rushTD:1},Receiving:{receptions:3,recYds:30}});
assert.equal(scoreFantasyPlayer(oldScore,'ppr').total,30.5,'additional usage stats must not change scoring');
const dstRaw={sacks:4,fumblesRecovered:2,ptsAllowed:13};
assert.deepEqual(plain(apiScope.exports.defense(dstRaw)),normalizeTank01DefenseStats(dstRaw));
assert.equal(normalizeTank01DefenseStats(dstRaw).pointsAllowed,13);

const canonical=canonicalGameLogStats({passYards:10,passingYards:0,passTD:2,interceptions:1,rushAttempts:0},'QB');
assert.equal(canonical.passingYards,0,'an explicit canonical zero must beat an alias');
assert.equal(canonical.passingTouchdowns,2);assert.equal(canonical.interceptionsThrown,1);
assert.equal(canonical.rushingAttempts,0);assert.equal(canonical.passYards,undefined);
assert.equal(canonicalGameLogStats({interceptions:2,ptsAllowed:0},'DST').interceptions,2,'D/ST interceptions must not become thrown interceptions');
assert.equal(canonicalGameLogStats({interceptions:2,ptsAllowed:0},'DST').pointsAllowed,0);
for(const position of ['QB','RB','WR','TE','K','DST']){
  const columns=gameLogColumns(position,[{}]);
  assert.deepEqual(columns,GAME_LOG_STAT_KEYS[position]);
  assert.equal(new Set(columns).size,columns.length);
}
assert.ok(gameLogColumns('QB',[{passingAttempts:0}]).includes('passingAttempts'));
assert.ok(gameLogColumns('WR',[{targets:0,customUsage:0}]).includes('customUsage'));
assert.ok(!gameLogColumns('QB',[{fieldGoalsMade:0,fieldGoalsMissed:0}]).includes('fieldGoalsMade'),'irrelevant zero-valued kicking defaults must not crowd a QB game log');
assert.deepEqual(canonicalGameLogStats({},'QB'),{},'future schedule-only rows must not gain fabricated stats');
assert.ok(detail.includes('gameLogColumns')&&!detail.includes('.slice(0, 6)'));
assert.ok(detail.includes('overflow-x-auto')&&detail.includes('FantasyAvailabilityBadge')&&detail.includes('PlayerPhotoCredit')&&detail.includes('playerPortraitFallbackUrl'));
assert.ok(detail.includes('primaryAction.onAction')&&detail.includes('setInterval(() => void refresh(), 30_000)'));

// Exercise the current schedule selector with complete, duplicate, conflicting
// and incomplete data. No provider calls or production writes are made.
const scheduleScope:any={exports:{}};
const scheduleCode=cloud.slice(cloud.indexOf('const TEAM_ALIASES'),cloud.indexOf('const readCachedTeamSchedule'))+'\nexports.select=selectCompleteTeamSchedule;';
vm.runInNewContext(ts.transpileModule(scheduleCode,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,scheduleScope);
const schedule=Array.from({length:18},(_,index)=>index+1).filter(week=>week!==8).map(week=>({provider_game_id:`espn-${week}`,season:2026,week_number:week,away_team:'LAR',home_team:'SF',kickoff_at:new Date(Date.UTC(2026,8,6+(week-1)*7)).toISOString(),game_status:'Scheduled',is_final:false}));
assert.equal(scheduleScope.exports.select(schedule,'LAR').length,17);
assert.equal(18-scheduleScope.exports.select(schedule,'LAR').length,1);
assert.equal(scheduleScope.exports.select(schedule.slice(0,16),'LAR').length,0);
assert.equal(scheduleScope.exports.select([...schedule,{...schedule[0],provider_game_id:'tank-1'}],'LAR').length,17);
assert.equal(scheduleScope.exports.select([...schedule,{...schedule[0],home_team:'SEA'}],'LAR').length,0);
assert.equal(scheduleScope.exports.select(schedule.map(row=>({...row,away_team:'LA'})),'LAR').length,17);
assert.ok(api.includes('games.length!==272')&&api.includes('count!==17'));
assert.ok(cloud.includes('for (let week = 1; week <= 18; week += 1)')&&cloud.includes('isBye: true'));
assert.ok(api.includes('stats:normalizeTank01PlayerStats(playerRaw)')&&api.includes('stats:normalizeTank01DefenseStats(defenseRaw)'));
assert.ok(cloud.includes('row.pregame_projection_captured_at ? (row.pregame_projected_points || {}) : {}'),'stored pregame provenance must remain authoritative');
assert.doesNotMatch(detail,/stats[^\n]{0,120}\.ovr|\.ovr[^\n]{0,120}stats/i);
console.log('Player completeness passed: exact server/shared parity, honest missing usage and kicking attempts, canonical aliases/zeros, complete position columns, 17-game/bye schedule safety, identity/provenance preservation, and retained photos/actions.');
