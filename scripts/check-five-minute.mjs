import assert from 'node:assert/strict';
import {fullInitialDrive,fullSession,fullContinue,fullPossessionEnd,fullExpired,fullOffenseEnd,fullCpuPlay,fullKick,fullRecord} from '../public/play-moment-3d/five-minute.js';
import {miniGameFromSearch,miniSnap,miniBetweenPlays,miniSpike} from '../public/play-moment-3d/mini-games.js';
const config=miniGameFromSearch('?mode=five-minute&team=JCY&opponent=OKC&difficulty=pro');
assert.equal(config.mode,'five-minute');
let s=fullSession(),d=fullInitialDrive();assert.equal(d.clock,300);assert.equal(d.score,0);
miniBetweenPlays(s,d,'pre',20);assert.equal(d.clock,300);miniSnap(s);miniBetweenPlays(s,d,'pre',10);assert.equal(d.clock,290);
d.score=6;fullOffenseEnd(s,d,'TOUCHDOWN');assert.equal(d.score,7);assert.equal(s.pending,'away');fullContinue(s,d);assert.equal(s.cpu.ball,25);
// Kicks: field position, scores, range, touchbacks, and idempotency during transitions.
s=fullSession();d=fullInitialDrive();assert(!fullKick(s,d,'home','field-goal',config.matchup.home,()=>0));d.ball=80;assert(fullKick(s,d,'home','field-goal',config.matchup.home,()=>0));assert.equal(d.score,3);assert.equal(s.stats.home.fieldGoals,1);assert(!fullKick(s,d,'home','field-goal',config.matchup.home,()=>0));
s=fullSession();d={...fullInitialDrive(),ball:65};fullKick(s,d,'home','field-goal',config.matchup.home,()=>.999);fullContinue(s,d);assert.equal(s.cpu.ball,42);
s=fullSession();d={...fullInitialDrive(),ball:80};fullKick(s,d,'home','punt',config.matchup.home,()=>.9);fullContinue(s,d);assert.equal(s.cpu.ball,20);
s=fullSession();d=fullInitialDrive();fullOffenseEnd(s,d,'INTERCEPTED',{interceptionSpot:60,quarterback:config.matchup.home.lineup[5]});fullContinue(s,d);assert.equal(s.cpu.ball,40);assert.equal(s.stats.home.turnovers,1);
s=fullSession();d=fullInitialDrive();fullOffenseEnd(s,d,'SAFETY');assert.equal(s.awayScore,2);assert.equal(s.nextBall,35);
// Regulation expiration permits a final live TD then decides final/OT.
s=fullSession();d={...fullInitialDrive(),clock:0,score:6};fullOffenseEnd(s,d,'TOUCHDOWN');assert(s.result.won);assert.equal(d.score,7);
s=fullSession();d={...fullInitialDrive(),clock:0};fullExpired(s,d);assert.equal(s.overtime,1);assert.equal(s.pending,'home');fullContinue(s,d);assert.equal(d.ball,75);miniSnap(s);miniBetweenPlays(s,d,'pre',5);assert.equal(s.pending,null);miniSpike(s,d,'pre');assert.equal(d.clock,0);assert.equal(d.down,2);assert(!fullKick(s,d,'home','punt',config.matchup.home));
d.score=6;fullOffenseEnd(s,d,'TOUCHDOWN');assert(!s.result);assert.equal(s.pending,'away');fullContinue(s,d);s.awayScore=7;fullPossessionEnd(s,d,'away');assert.equal(s.overtime,2);assert.equal(s.pending,'away');fullContinue(s,d);s.awayScore+=3;fullPossessionEnd(s,d,'away');assert(!s.result);fullContinue(s,d);fullPossessionEnd(s,d,'home');assert.equal(s.result.won,false);
// Late CPU field goal, desperation fourth down, a deterministic interception.
s=fullSession();d={...fullInitialDrive(),clock:6,score:0};s.possession='away';s.cpu={ball:80,down:2,toGo:6};fullCpuPlay(s,d,config,()=>0);assert.equal(s.awayScore,3);
s=fullSession();d={...fullInitialDrive(),clock:40,score:7};s.possession='away';s.cpu={ball:30,down:4,toGo:8};fullCpuPlay(s,d,config,()=>0);assert(s.log.some(p=>p.reason==='INTERCEPTED'));assert.equal(s.stats.away.turnovers,1);assert.equal(s.pending,'home');
// Completed passes, rushes, sacks, and incomplete passes stay separate.
s=fullSession();fullRecord(s,'home',{gain:12,pass:true,quarterback:config.matchup.home.lineup[5],runner:config.matchup.home.lineup[7]});fullRecord(s,'home',{gain:5,runner:config.matchup.home.lineup[6]});fullRecord(s,'home',{gain:-4,sack:true,quarterback:config.matchup.home.lineup[5]});fullRecord(s,'home',{incomplete:true,pass:true,quarterback:config.matchup.home.lineup[5]});assert.equal(s.stats.home.yards,13);assert.equal(s.stats.home.passYards,8);assert.equal(s.stats.home.attempts,2);assert.equal(s.stats.home.completions,1);assert.equal(s.stats.home.sacks,1);
// Deterministic full CPU games across levels never produce invalid spots/down/clock.
for(const difficulty of ['rookie','pro','all-pro'])for(let seed=1;seed<=30;seed++){
 let n=seed;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296};
 s=fullSession();d=fullInitialDrive();s.possession='away';const c={...config,level:{...config.level,id:difficulty}};
 for(let i=0;i<250&&!s.result;i++){
  if(s.pending)fullContinue(s,d);
  if(s.possession==='home'){d.clock=Math.max(0,d.clock-18);d.ball=80;fullKick(s,d,'home','field-goal',config.matchup.home,random);}
  else fullCpuPlay(s,d,c,random);
  assert(d.clock>=0&&d.clock<=300);assert(s.cpu.ball>=0&&s.cpu.ball<=100);assert(s.cpu.down>=1&&s.cpu.down<=5);
 }
 assert(s.result,'Game must complete');assert.notEqual(d.score,s.awayScore);assert(s.log.length>0);
}
console.log('PASS full-game regulation, scoring, possession spots, FG/punts, timeouts/OT clocks, paired overtime, CPU decisions, player stats and 90 seeded complete games.');
