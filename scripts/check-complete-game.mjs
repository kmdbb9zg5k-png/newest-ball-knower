import assert from 'node:assert/strict';
import {fullInitialDrive,fullSession,fullOffenseEnd,fullConversion,fullKickoffResult,fullContinue,fullCpuPlay,fullCpuResult,fullKick,fullExpired} from '../public/play-moment-3d/five-minute.js';
import {miniGameFromSearch} from '../public/play-moment-3d/mini-games.js';
import {nearestDefender,defensiveTackleChance,DEFENSE_PLAYS,DEFENSE_FORMATIONS} from '../public/play-moment-3d/defense-playbook.js';
const config=miniGameFromSearch('?mode=two-minute&difficulty=pro&team=JCY&opponent=OKC');
let s=fullSession('two-minute',true),d=fullInitialDrive('two-minute');d.clock=49;d.score+=6;fullOffenseEnd(s,d,'TOUCHDOWN');assert.equal(s.result,null);assert.equal(s.conversion,'home');assert.equal(d.score,29);fullConversion(s,d,'extra-point',true);assert.equal(d.score,30);assert.equal(s.kickoff,'home');fullKickoffResult(s,d,{ball:27,seconds:6});assert.equal(d.clock,43);assert.equal(s.possession,'away');assert.equal(s.cpu.ball,27);
fullCpuResult(s,d,config,{gain:73,seconds:40,pass:true});assert.equal(s.awayScore,34);assert.equal(d.clock,3);assert.equal(s.kickoff,'away');fullKickoffResult(s,d,{ball:25,seconds:0});assert(!s.result);d.clock=0;fullExpired(s,d);assert(s.result&&!s.result.won);
s=fullSession('two-minute',true);d=fullInitialDrive('two-minute');d.clock=0;d.score+=6;fullOffenseEnd(s,d,'TOUCHDOWN');assert(!s.result);fullConversion(s,d,'two-point',true);assert(s.result?.won);assert.equal(d.score,31);
s=fullSession('five-minute',true);d=fullInitialDrive();d.clock=0;fullExpired(s,d);assert.equal(s.overtime,1);fullContinue(s,d);d.score=6;fullOffenseEnd(s,d,'TOUCHDOWN');fullConversion(s,d,'extra-point',true);assert(!s.result);assert.equal(s.pending,'away');assert.equal(s.kickoff,null);fullContinue(s,d);s.cpu={ball:99,down:4,toGo:1};fullCpuResult(s,d,config,{gain:1,interception:true});assert(s.result?.won);assert.equal(s.awayScore,0,'End-zone interception cannot award CPU a touchdown');
const actors=Array.from({length:22},(_,index)=>({index,x:index,z:0,fallen:false}));assert.equal(nearestDefender(actors,{x:15.1,z:0}),15);actors[15].fallen=true;assert.equal(nearestDefender(actors,{x:15.1,z:0}),16);
assert(defensiveTackleChance({ratings:{tackle:95}},{ratings:{breakTackle:60}})>defensiveTackleChance({ratings:{tackle:60}},{ratings:{breakTackle:95}}));assert(defensiveTackleChance({}, {},true)<defensiveTackleChance({},{}));for(const f of DEFENSE_FORMATIONS)assert(DEFENSE_PLAYS.filter(p=>p.formation===f).length>=3);
for(const mode of ['two-minute','five-minute'])for(let seed=1;seed<=30;seed++){
 let n=seed;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296};s=fullSession(mode,true);d=fullInitialDrive(mode);let turns=0;
 while(!s.result&&turns++<500){
  if(s.conversion){fullConversion(s,d,'extra-point',random()<.94);continue;}
  if(s.kickoff){fullKickoffResult(s,d,{ball:20+Math.floor(random()*20),seconds:4+random()*6});continue;}
  if(s.pending){fullContinue(s,d);continue;}
  if(s.possession==='away'){fullCpuPlay(s,d,{...config,mode},random);continue;}
  if(random()<.35){d.score+=6;if(!s.overtime)d.clock=Math.max(0,d.clock-18);fullOffenseEnd(s,d,'TOUCHDOWN');}
  else if(s.overtime){d.ball=80;fullKick(s,d,'home','field-goal',config.matchup.home,random);}
  else fullKick(s,d,'home','punt',config.matchup.home,random);
 }
 assert(s.result,`${mode} seed ${seed} must finish`);assert(d.clock>=0);assert(!s.conversion);assert(s.stats.away.plays>0);
}
console.log('PASS continuing score/clock, timed returns, final conversions, paired OT, end-zone INT, defense selection/ratings and 60 complete interactive-rules games.');
