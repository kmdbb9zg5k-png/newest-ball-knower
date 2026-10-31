import assert from 'node:assert/strict';
import {fullInitialDrive,fullSession,fullOffenseEnd,fullConversion,fullKick,fullPuntResult,fullRecord} from '../public/play-moment-3d/five-minute.js';
import {miniGameFromSearch} from '../public/play-moment-3d/mini-games.js';
const config=miniGameFromSearch('?mode=arena&difficulty=rookie&drive=2&team=MIL&opponent=MIL');
assert.equal(config.level.id,'pro');assert.equal(config.matchup.home.abbr,'MIL');assert.equal(config.matchup.away.abbr,'MIL');assert.equal(config.driveNumber,2);
const fresh=()=>[fullSession('arena',true),fullInitialDrive('arena')];
for(const reason of ['INTERCEPTED','TURNOVER ON DOWNS','SAFETY','TIME EXPIRED']){const[s,d]=fresh();if(reason==='TIME EXPIRED')d.clock=0;fullOffenseEnd(s,d,reason);assert.ok(s.result,reason);assert.equal(d.score,0);assert.equal(s.kickoff,null);assert.equal(s.overtime,0);assert.equal(s.possession,'home');}
for(const kind of ['extra-point','two-point'])for(const good of [false,true]){const[s,d]=fresh();d.score=6;d.clock=0;fullRecord(s,'home',{gain:75,touchdown:true});fullOffenseEnd(s,d,'TOUCHDOWN');assert.equal(s.result,null);assert.equal(s.conversion,'home');fullConversion(s,d,kind,good);assert.ok(s.result);assert.equal(d.score,6+(good?(kind==='extra-point'?1:2):0));assert.equal(s.kickoff,null);}
for(const good of [false,true]){const[s,d]=fresh();d.ball=80;assert.ok(fullKick(s,d,'home','field-goal',config.matchup.home,()=>.5,good));assert.ok(s.result);assert.equal(d.score,good?3:0);assert.equal(s.kickoff,null);}
{const[s,d]=fresh();fullPuntResult(s,d,{kicking:'home',ball:40,touchdown:true});assert.ok(s.result);assert.equal(d.score,0);assert.equal(s.conversion,null);}
// Full games retain possession changes, kickoffs, and overtime.
{const s=fullSession('five-minute',true),d=fullInitialDrive();fullOffenseEnd(s,d,'TURNOVER ON DOWNS');assert.equal(s.result,null);assert.equal(s.pending,'away');}
{const s=fullSession('two-minute',true),d=fullInitialDrive('two-minute');d.score=27;d.clock=0;fullOffenseEnd(s,d,'TIME EXPIRED');assert.equal(s.overtime,1);assert.equal(s.result,null);}
console.log('PASS: Arena scoring, conversions at zero, no CPU offense/kickoffs/OT, mirror teams, Pro rules; full-game possession and OT preserved.');
