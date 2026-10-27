import assert from 'node:assert/strict';
import {careerFieldAssignment,careerFieldScore,careerFieldSeed} from '../myPlayerField';
import {careerNews} from '../myPlayerNews';
import {createCareerLife,chooseWeek,recordWeekMoment,completeCareerWeek,cleanCareerLife,careerGameBoost} from '../myPlayerCareer';
const profile={name:'Eli Test',position:'WR' as const,overall:72,speed:82,power:80,awareness:72,combineId:'field-check'};
let life=createCareerLife(profile);life={...life,trust:80,camp:{scores:[],complete:true,legacy:true},role:'rotation'};
assert.equal(careerFieldAssignment('EDGE'),undefined);for(const p of ['QB','WR','TE','RB','LB','CB','S'] as const)assert(careerFieldAssignment(p));
assert.equal(careerFieldSeed('a','1'),careerFieldSeed('a','1'));assert.notEqual(careerFieldSeed('a','1'),careerFieldSeed('a','2'));
assert.equal(careerFieldScore('drive',{points:23,plays:3,yards:0,turnovers:0}),25);assert.equal(careerFieldScore('drive',{points:30,plays:3,yards:75,turnovers:0}),86);
assert.equal(careerFieldScore('drive',{points:30,plays:0,yards:75,turnovers:0}),undefined);
assert.equal(careerFieldScore('receiver',{reps:2,score:90}),undefined);assert.equal(careerFieldScore('receiver',{reps:3,score:NaN}),undefined);assert.equal(careerFieldScore('receiver',{reps:3,score:101}),undefined);
assert.equal(careerNews(life,profile.name).length,1);
for(let week=1;week<=3;week++){const key=`2026:regular:${week}`;life=chooseWeek(life,key,'prep','film');life=chooseWeek(life,key,'response','business');const pending=careerNews(life,profile.name);assert.match(pending[0].headline,/agent/);life=recordWeekMoment(life,key,week===3?20:90);const once=recordWeekMoment(life,key,0);assert.deepEqual(once,life);assert.equal(careerGameBoost(life,key)>0,week!==3);life=completeCareerWeek(life,key,week!==2);assert.deepEqual(completeCareerWeek(life,key,true),life);}
const news=careerNews(life,profile.name);assert.equal(new Set(news.map(n=>n.id)).size,news.length);assert(news.some(n=>n.headline.includes('rotation to starter')));assert(news.some(n=>n.headline.includes('team falls short')));assert(news.some(n=>n.headline==='Team wins; your execution remains under review'));assert(news.some(n=>n.headline.includes('stronger tape')));
assert.deepEqual(careerNews(cleanCareerLife(JSON.parse(JSON.stringify(life)),profile)!,profile.name),news);
console.log('PASS field scoring, baseline points, invalid results, deterministic assignments, locked performance, season influence, news facts and reload stability');
