import assert from 'node:assert/strict';
import {createCareerArc,chooseRival,completeArcWeek,careerOffers,finishArcSeason,cleanCareerArc} from '../myPlayerArc';
import {createCareerLife,chooseWeek,recordWeekMoment,completeCareerWeek} from '../myPlayerCareer';
import {resolveJourneyDraft} from '../myPlayerJourney';
import {franchiseSchedule} from '../soloFranchiseEngine';
const p={name:'Eli',teamAbbr:'JCY',position:'WR' as const,draftRound:2,draftPick:12,overall:78,speed:82,power:80,awareness:72,combineId:'arc-test'};
let a=createCareerArc(p),life={...createCareerLife(p),camp:{scores:[],complete:true,legacy:true},role:'rotation' as const,trust:75};
assert(franchiseSchedule(p.teamAbbr).some(t=>t.abbr===a.rival.team));assert.notEqual(a.rival.pick,44);assert.deepEqual(createCareerArc(p),a);
for(let year=2026;year<=2030;year++){
 for(let week=1;week<=17;week++){
 const key=`${year}:regular:${week}`,c=chooseRival(a,life,key,week===1?'talk':'train');a=c.arc;life=c.life as typeof life;assert.deepEqual(chooseRival(a,life,key,'respect'),{arc:a,life});
 life=chooseWeek(life,key,'prep','recovery') as typeof life;life=chooseWeek(life,key,'response','team') as typeof life;life=recordWeekMoment(life,key,week===1?20:94) as typeof life;
 assert.deepEqual(chooseRival(a,life,key,'respect'),{arc:a,life});life=completeCareerWeek(life,key,true) as typeof life;const beforeTrust=life.trust;const out=completeArcWeek(a,life,key,true,week===1?a.rival.team:'ABC');a=out.arc;life=out.life as typeof life;if(week===1)assert.equal(life.trust,Math.max(0,beforeTrust-5));assert.deepEqual(completeArcWeek(a,life,key,true,a.rival.team),{arc:a,life});assert(a.rival.overall<=95);
 }
 const offers=careerOffers(a,life,p);assert.equal(new Set(offers.map(o=>o.team)).size,4);assert(offers.find(o=>o.id==='money')!.annual>offers.find(o=>o.id==='reps')!.annual);assert.equal(offers.find(o=>o.id==='reps')!.role,'starter');
 const expired=year>=a.contract.end;if(expired)assert.equal(finishArcSeason(a,life,p,year,12,false,'bad'),undefined);
 const next=finishArcSeason(a,life,p,year,12,year===2026,expired?'reps':undefined)!;assert(next);assert.equal(finishArcSeason(next.arc,next.life,p,year,12,true,'money'),undefined);a=next.arc;life=next.life as typeof life;p.teamAbbr=next.team;assert.equal(a.seasonGames,0);assert.equal(a.year,year+1);assert.equal(a.contract.team,p.teamAbbr);assert.equal(life.fatigue,0);assert.equal(JSON.stringify(cleanCareerArc(JSON.parse(JSON.stringify(a)),p)),JSON.stringify(a));
}
assert(a.events.some(e=>e.id==='draft'));assert(a.events.some(e=>e.id==='first-start'));assert.equal(a.own.games,85);assert.equal(a.rival.games,85);assert.equal(a.duels.lost+a.duels.won+a.duels.tied,5);assert(a.seasons[0].champion);assert(a.earnings>0);assert.deepEqual(chooseRival(a,life,'2026:regular:1','talk'),{arc:a,life});assert.equal(cleanCareerArc({...a,contract:{...a.contract,annual:NaN}},p),undefined);assert.equal(cleanCareerArc({},p),undefined);
console.log('PASS five-season rivalry progression, seeded rival, choice locks, pressure, spotlight rewards, first starts, persistent timeline, class awards, four contract tradeoffs, renewals/transfers, malformed saves and idempotent year advancement');

const drafted={...p,draftJourney:{version:1 as const,seed:91,choices:{},cursor:224,draftBaseGrade:80}};const frozen=createCareerArc(drafted);assert(resolveJourneyDraft(drafted.draftJourney,drafted,80).board.some(b=>b.name===frozen.rival.name&&b.team===frozen.rival.team&&b.overall===frozen.rival.pick));assert.equal(cleanCareerArc(frozen,{...drafted,teamAbbr:'BRK'})!.rival.name,frozen.rival.name);console.log('PASS rival identity is selected from the frozen draft board and survives a team transfer');
