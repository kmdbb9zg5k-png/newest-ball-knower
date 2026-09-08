import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildHqPracticeDraft, fantasyHqSummary, fantasyHqScheduleFacts, hqPublishedProjection } from '../fantasyHqData';
import type { League } from '../types';
import type { FantasyRanking } from '../fantasyRankingsCloud';
import { buildFantasyWeekPairings, isCompleteFantasySchedule } from '../simulation';
import type { WeeklyScore } from '../fantasyLeagueParityCloud';
const players: FantasyRanking[] = ['QB','RB','WR','TE','K','DST'].flatMap((p,g)=>Array.from({length:100},(_,i)=>({player_key:`${p}-${i}`,player_name:`Fixture ${p} ${i}`,position:p,overall_rank:i*6+g+1} as FantasyRanking)));
function league(size:number):League{return {id:'test',name:'Test league',code:'TEST',commissionerId:'u0',commissionerName:'GM',maxMembers:size,salaryCap:200,status:'drafting',createdAt:'2026-09-08T00:00:00Z',settings:{rosterSize:15},members:Array.from({length:size},(_,i)=>({id:`m${i}`,userId:`u${i}`,userName:`GM ${i}`,isCommissioner:i===0,status:'building'}))};}
for(const size of [6,8,10,12,14,16]){
 const l=league(size),before=JSON.stringify(l); const picks=buildHqPracticeDraft(l,players,19);
 assert.equal(JSON.stringify(l),before,'Practice must never mutate the live league');
 assert.equal(picks.length,size*15);assert.equal(new Set(picks.map(p=>p.player.player_key)).size,picks.length);
 assert.deepEqual(picks,buildHqPracticeDraft(l,players,19));
 assert.equal(picks[size].memberId,`m${size-1}`,'Round 2 reverses the snake');
 for(const m of l.members){const roster=picks.filter(p=>p.memberId===m.id);assert.equal(roster.length,15);
 for(const [p,n] of Object.entries({QB:1,RB:2,WR:2,TE:1,K:1,DST:1}))assert.ok(roster.filter(x=>x.player.position===p).length>=n);
 assert.ok(roster.filter(x=>['RB','WR','TE'].includes(x.player.position)).length>=6,'Keep a FLEX candidate');}
}
const l=league(10);assert.equal(fantasyHqSummary(l,'u0').pick,null);assert.equal(fantasyHqSummary(l,'missing').players,null);
l.status='completed';assert.equal(fantasyHqSummary(l,'u0').phase,'Draft order set','Draft Order Game completion is not a fantasy championship');
l.liveDraft={leagueId:l.id,status:'active',orderMemberIds:['m1','m2','m0'],rounds:15,pickIndex:2,picks:[{overall:1,round:1,memberId:'m1',playerId:'a',group:'QB',source:'manual',pickedAt:''},{overall:2,round:1,memberId:'m0',playerId:'b',group:'RB',source:'manual',pickedAt:''}],startedAt:'',updatedAt:'',pickSeconds:60};
assert.equal(fantasyHqSummary(l,'u0').players,1,'Show my picks, not the league-wide pick count');assert.equal(fantasyHqSummary(l,'u0').pick,3);assert.equal(fantasyHqSummary(l,'u0').phase,'Live draft');
assert.equal(buildHqPracticeDraft(league(10),[],1).length,0);
assert.equal(hqPublishedProjection(undefined),null);
assert.equal(hqPublishedProjection({projectedPoints:0,hasProjectedTotal:true} as WeeklyScore),0);
assert.equal(hqPublishedProjection({projectedPoints:100,hasProjectedTotal:false} as WeeklyScore),null);
assert.equal(hqPublishedProjection({projectedPoints:NaN,hasProjectedTotal:true} as WeeklyScore),null);
const read=(name:string)=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const source=read('FantasyHub.tsx');
for(const token of ['onOpenCreateLeague','onOpenJoinLeague','enterPublicLeague()','onSelectLeague','displayLeagues.map','FantasyHqActivity','setWorkspace(\'draft\')','setWorkspace(\'matchup\')','Player Cheat Sheet'])assert.ok(source.includes(token),token);
const art=readFileSync(new URL('../public/fantasy/hq-decorations.webp',import.meta.url));assert.ok(art.length<25000);assert.equal(art.toString('ascii',8,12),'WEBP');
assert.ok(read('FantasyHqTools.tsx').includes("item.kind==='announcement'||item.kind==='receipt'"));
assert.doesNotMatch(read('FantasyHqTools.tsx'),/\.rpc\(|saveMyWeeklyLineup|updateLeagueSettings|importOfflineFantasyDraftResults/,'HQ practice/analysis must be read-only');
console.log('Fantasy HQ gold checks passed: truthful phases/counts, 6–16-team private practice, snake order, complete roster construction, missing projections and preserved destinations.');

// Persisted commissioner edits remain authoritative even after playoffs are appended.
const historic=league(10);
historic.settings={...historic.settings,regularSeasonWeeks:14};
const edited=Array.from({length:16},(_,i)=>buildFantasyWeekPairings(historic.members,i+1)).flat();
[edited[0].awayMemberId,edited[1].awayMemberId]=[edited[1].awayMemberId,edited[0].awayMemberId];
historic.seasonResult={games:[...edited,{id:'playoff-1',week:17,homeMemberId:'m0',awayMemberId:'m1',playoffRound:'semifinal'}]} as League['seasonResult'];
const facts=fantasyHqScheduleFacts(historic);
assert.equal(facts.weeks,16,'Persisted regular-season length takes precedence');
assert.equal(facts.persisted.length,80,'Do not validate appended playoff games as regular-season games');
assert.ok(isCompleteFantasySchedule(historic.members,facts.weeks,facts.persisted));
assert.deepEqual(facts.persisted[0],edited[0],'Keep custom opponents, not rebuilt default pairings');
assert.equal(fantasyHqScheduleFacts(league(10)).weeks,15,'Default calendar matches the existing post-draft view');
const legacy=league(10);legacy.settings={seasonGames:16,playoffTeams:4};
assert.equal(fantasyHqScheduleFacts(legacy).weeks,16,'Retain valid legacy seasonGames settings');
console.log('HQ schedule regressions passed: persisted length, commissioner edits, playoff filtering and legacy/default calendar.');
