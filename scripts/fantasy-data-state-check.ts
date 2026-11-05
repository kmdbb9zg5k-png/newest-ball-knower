import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapScore} from '../fantasyLeagueParityCloud';
import {lockedWeeklyLineupPlayers,movePlayerIntoLineupSlot,reconcileWeeklyLineupDraft,resolveWeeklyProjection} from '../fantasyLineup';
import {isFinalGameStatus,isLiveGameStatus,liveProjectedPoints} from '../fantasyLiveScoring';
import {acceptsFantasyScoreSnapshot} from '../api/fantasy-live-scoring';
import {picksFeedIsStale,PICKS_RETRIEVAL_MAX_AGE_MS} from '../picksBoard';
import type {Player} from '../types';
import {buildScoredFantasyGames,buildScoredFantasyPlayoffs} from '../simulation';

const player=(id:string,position:Player['position'],team='PHI')=>({id,name:id,position,team,teamCity:'Fixture',salary:1,ovr:80,attributes:{athleticism:80,footballIQ:80}} as Player);
const roster=[player('qb','QB'),player('rb1','RB'),player('rb2','RB'),player('bench','RB'),player('wr','WR')];
const saved={QB:'qb',RB1:'rb1',RB2:'rb2'};
const edited={...saved,RB1:'bench'};
assert.deepEqual(reconcileWeeklyLineupDraft(roster,edited,saved,saved),edited,'a realtime refresh must preserve unsaved lineup edits');
const remote={...saved,WR1:'wr'};
assert.deepEqual(reconcileWeeklyLineupDraft(roster,edited,saved,remote),{...edited,WR1:'wr'},'untouched slots must receive authoritative changes from another session');
assert.deepEqual(reconcileWeeklyLineupDraft(roster,edited,saved,saved,['rb1']),saved,'a newly locked server starter must displace an unsaved local change');
assert.deepEqual(reconcileWeeklyLineupDraft(roster,edited,saved,saved,['bench']),saved,'a bench player cannot become a starter after kickoff');
assert.deepEqual(reconcileWeeklyLineupDraft(roster.filter(p=>p.id!=='bench'),edited,saved,saved),saved,'removed players must not survive as phantom starters');
const duplicate=reconcileWeeklyLineupDraft(roster,{...saved,RB1:'rb2'},saved,saved);
assert.equal(duplicate.RB1,'rb2');assert.equal(duplicate.RB2,undefined,'server refresh must never duplicate a locally moved starter');
assert.equal(movePlayerIntoLineupSlot(roster,saved,'RB1','bench',['bench']).changed,false,'locked bench-to-starter movement is rejected');
const now=Date.parse('2026-11-05T18:00:00Z');
const game={homeTeam:'PHI',awayTeam:'DAL',kickoffAt:new Date(now).toISOString(),isLive:false,isFinal:false};
assert.equal(lockedWeeklyLineupPlayers(roster,[game],[],now-1).size,0);
assert.equal(lockedWeeklyLineupPlayers(roster,[game],[],now).size,roster.length,'kickoff locks all roster players without waiting for a worker');
assert.equal(lockedWeeklyLineupPlayers([player('alias','RB','JAC')],[{...game,homeTeam:'JAX'}],[],now).has('alias'),true);
assert.equal(lockedWeeklyLineupPlayers(roster,[],['qb'],now).has('qb'),true,'server locks remain authoritative during schedule outages');

for(const missing of [null,undefined,'',' ',false,NaN]){
  const projections=[{playerId:'qb',projectedPoints:{ppr:missing}}] as any;
  assert.equal(resolveWeeklyProjection('qb',projections,'ppr',false),null,`missing projection ${String(missing)} cannot become zero`);
}
assert.equal(resolveWeeklyProjection('qb',[{playerId:'qb',projectedPoints:{ppr:0}}],'ppr',false),0,'explicit zero is valid');
const base={league_id:'league',member_id:'manager',week_number:1,source:'saved_fixture',is_final:true,updated_at:'2026-09-11T00:00:00Z',live_points:0,projected_points:0};
const zero=mapScore({...base,score_details:{hasProjectedTotal:true,players:[{points:0,projectedPoints:0,projectionAvailable:true,isFinal:true}]}});
assert.equal(zero.hasActualTotal,true);assert.equal(zero.players[0].pointsAvailable,true);assert.equal(zero.hasProjectedTotal,true,'explicit zero projections remain available');
for(const missing of [null,undefined,'',' ',false,NaN]){
  const mapped=mapScore({...base,score_details:{hasProjectedTotal:true,players:[{points:missing,projectedPoints:missing,projectionAvailable:true,isFinal:true}]}});
  assert.equal(mapped.hasActualTotal,false);assert.equal(mapped.players[0].pointsAvailable,false);assert.equal(mapped.hasProjectedTotal,false);assert.equal(mapped.players[0].projectionAvailable,false);
}
assert.equal(mapScore({...base,score_details:{hasActualTotal:false,players:[{points:0,pointsAvailable:false}]}}).hasActualTotal,false);
assert.equal(mapScore({...base,score_details:{players:[]}}).hasActualTotal,true,'a stored authoritative total remains usable if legacy player details are absent');
assert.equal(mapScore({...base,live_points:null,score_details:{players:[]}}).hasActualTotal,false,'an absent aggregate must not become an official zero');
assert.equal(zero.updatedAt,base.updated_at,'reading stored scores never renews their freshness');
const members=Array.from({length:4},(_,index)=>({id:`manager-${index}`,userId:`user-${index}`,userName:`Manager ${index}`,status:'ready',roster:[],isAi:false,isCommissioner:index===0})) as any;
const finalScores=members.map((member:any)=>({memberId:member.id,week:1,livePoints:0,isFinal:true,hasActualTotal:true}));
assert.equal(buildScoredFantasyGames(members,1,finalScores).length,2,'known scoreless finals remain valid results');
const unavailable=finalScores.map((score:any,index:number)=>index?score:{...score,hasActualTotal:false});
assert.equal(buildScoredFantasyGames(members,1,unavailable).length,1,'an unavailable final total cannot become a zero-score result');
assert.equal(buildScoredFantasyGames(members,1,finalScores.map((score:any)=>({...score,livePoints:NaN}))).length,0);
const standings=members.map((member:any,index:number)=>({memberId:member.id,memberName:member.userName,wins:4-index,losses:index,ties:0,pointsFor:100,pointsAgainst:100}));
const playoffScores=members.map((member:any)=>({memberId:member.id,week:2,livePoints:100,isFinal:true,hasActualTotal:true}));
assert.equal(buildScoredFantasyPlayoffs(standings as any,playoffScores,4,1).games.length,2,'known semifinal totals must advance the bracket');
const playoff=buildScoredFantasyPlayoffs(standings as any,playoffScores.map(score=>({...score,hasActualTotal:false})),4,1);
assert.equal(playoff.games.length,0,'an unavailable playoff total cannot advance a team');
for(const status of ['Final','Final/OT','Final 2OT','Final - overtime','Completed','Closed','Game Over']){
  assert.equal(isFinalGameStatus(status),true,status);assert.equal(isLiveGameStatus(status),false,status);
  assert.equal(liveProjectedPoints(17,30,status,5),17,status);
  assert.equal(acceptsFantasyScoreSnapshot(true,status),true,'explicit final corrections remain ingestible');
}
for(const status of ['Q4','Live','Scheduled','Delayed','Postponed','not final',undefined])assert.equal(acceptsFantasyScoreSnapshot(true,status),false,'non-final responses must not overwrite final statistics');
assert.equal(acceptsFantasyScoreSnapshot(false,'Q4'),true);
assert.equal(picksFeedIsStale(new Date(now-PICKS_RETRIEVAL_MAX_AGE_MS),now),false);
assert.equal(picksFeedIsStale(new Date(now-PICKS_RETRIEVAL_MAX_AGE_MS-1),now),true);
assert.equal(picksFeedIsStale(new Date(now+60_001),now),true,'future retrieval clocks are not fresh evidence');
assert.equal(picksFeedIsStale(null,now),false,'missing retrieval metadata remains unknown, not an invented timestamp');
const screen=readFileSync(new URL('../FantasyLeaguePostDraft.tsx',import.meta.url),'utf8');
assert.match(screen,/reconcileWeeklyLineupDraft\(roster, starters, previous\.starters, latest, lockedPlayerIds\)/);
assert.match(screen,/lineupLocksAt\(\)/,'mutation guards must evaluate the actual click time');
assert.match(screen,/hasActualTotal !== false/);assert.match(screen,/player\.pointsAvailable !== false/);
console.log('Fantasy data state: unsaved edits, authoritative locks, bench kickoff, missing versus zero, saved freshness, final corrections and Picks staleness passed.');
