import assert from 'node:assert/strict';
import {MINI_CHALLENGE_GAMES,miniChallengeUrl,miniStatLabel,type MiniChallenge} from '../miniChallenges';
import {newManSession,newManRep} from '../combine/man-coverage.js';
import {newDBSession,newDBRep} from '../combine/db-drill.js';
import {newRBSession,newRBRep} from '../combine/rb-drill.js';
const match={id:'match',game:'dash',seed:12345} as MiniChallenge;
assert.throws(()=>miniChallengeUrl({...match,game:'career'},'token'),/native career session/);
for(const game of MINI_CHALLENGE_GAMES.filter(g=>g.id!=='career')){const url=new URL(miniChallengeUrl({...match,game:game.id},'token'), 'https://example.invalid');assert.equal(url.searchParams.get('bkToken'),'token');assert.equal(url.searchParams.get('bkChallenge'),'match');if(game.id.endsWith('minute')){assert.equal(url.searchParams.get('difficulty'),'pro');assert.equal(url.searchParams.get('team'),'JCY');assert.equal(url.searchParams.get('opponent'),'BRK');}else assert.equal(url.searchParams.get('drill'),game.id);}
assert.equal(miniStatLabel('dash',{time:4.523}),'4.523 s');assert.equal(miniStatLabel('dash',{time:60,dnf:1}),'Did not finish');assert.equal(miniStatLabel('bench',null),'Waiting for result');
assert.equal(miniStatLabel('dash',{}),'Result unavailable');assert.equal(miniStatLabel('dash',{time:NaN}),'Result unavailable');
const athlete={id:'same',speed:85,acceleration:85,position:'WR'};
for(const [session,rep] of [[newManSession,newManRep],[newDBSession,newDBRep],[newRBSession,newRBRep]] as Array<[(seed:number)=>any,(athlete:any,index:number,session:any)=>any]>){assert.deepEqual(session(12345),session(12345));for(let i=0;i<5;i++)assert.deepEqual(rep(athlete,i,session(12345)),rep(athlete,i,session(12345)));}
const sent:any[]=[];const parent={postMessage:(...args:any[])=>sent.push(args)};
(globalThis as any).window={parent,location:{origin:'https://example.invalid'}};(globalThis as any).location={search:'',origin:'https://example.invalid'};
const standalone=await import(new URL('../public/mini-challenge-bridge.js?standalone',import.meta.url).href);standalone.reportMiniChallenge({time:4});assert.equal(sent.length,0);
(globalThis as any).location.search='?bkChallenge=match&bkToken=token&seed=12345';
const bridge=await import(new URL('../public/mini-challenge-bridge.js?challenge',import.meta.url).href);assert.equal(bridge.challengeSeed(),12345);bridge.reportDrillSession([{score:80,caught:true,yards:12},{score:60,caught:false,yards:0}]);bridge.reportMiniChallenge({score:100});assert.equal(sent.length,1,'Only first result is reported');assert.equal(sent[0][1],'https://example.invalid');assert.deepEqual(sent[0][0],{type:'bk-mini-result',challengeId:'match',token:'token',stats:{score:70,reps:2,catches:1,stops:0,picks:0,yards:12,touchdowns:0}});
bridge.exitMiniChallenge();assert.equal(sent[1][0].type,'bk-mini-exit');
console.log('PASS: 10 fixed-settings launch URLs, score precision, deterministic WR/DB/RB sessions, standalone isolation, result aggregation, one-time reporting, scoped message tokens and exit.');
