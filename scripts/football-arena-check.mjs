import assert from 'node:assert/strict';
import {fullInitialDrive,fullSession,fullOffenseEnd,fullConversion,fullKick,fullPuntResult,fullRecord,fullKickoffResult} from '../public/play-moment-3d/five-minute.js';
import {miniGameFromSearch} from '../public/play-moment-3d/mini-games.js';
const config=miniGameFromSearch('?mode=arena&difficulty=rookie&drive=2&team=MIL&opponent=MIL');
assert.equal(config.level.id,'pro');assert.equal(config.matchup.home.abbr,'MIL');assert.equal(config.matchup.away.abbr,'MIL');assert.equal(config.driveNumber,2);
const fresh=()=>{const s=fullSession('arena',true),d=fullInitialDrive('arena');assert.equal(s.kickoff,'away');fullKickoffResult(s,d,{ball:25});return[s,d];};
// Every arena drive receives a kickoff; its return sets field position, not offensive yards.
for(const number of [1,2,3]){const config=miniGameFromSearch(`?mode=arena&drive=${number}&team=MIL&opponent=SLC`);assert.equal(config.driveNumber,number);const s=fullSession(config.mode,true),d=fullInitialDrive(config.mode);assert.equal(s.kickoff,'away');assert.ok(fullKickoffResult(s,d,{ball:37,seconds:8}));assert.equal(s.kickoff,null);assert.equal(s.possession,'home');assert.equal(d.ball,37);assert.equal(d.clock,112);assert.equal(d.down,1);assert.equal(d.toGo,10);assert.equal(s.stats.home.yards,0);assert.equal(s.stats.home.plays,0);assert.equal(s.result,null);assert.equal(fullKickoffResult(s,d,{ball:60}),false);}
{const s=fullSession('arena',true),d=fullInitialDrive('arena');fullKickoffResult(s,d,{ball:100,seconds:12,touchdown:true});assert.equal(d.score,6);assert.equal(s.conversion,'home');assert.equal(s.result,null);fullConversion(s,d,'extra-point',true);assert.equal(d.score,7);assert.ok(s.result);assert.equal(s.kickoff,null);assert.equal(s.stats.home.yards,0);assert.equal(s.stats.home.plays,0);assert.equal(s.stats.home.touchdowns,0);assert.equal(s.stats.home.returnTouchdowns,1);}
{const s=fullSession('arena',true),d=fullInitialDrive('arena');fullKickoffResult(s,d,{ball:25,seconds:120});assert.ok(s.result);assert.equal(s.conversion,null);}
{const[s,d]=fresh();fullRecord(s,'home',{gain:12,pass:true});fullRecord(s,'home',{gain:4});fullRecord(s,'home',{gain:-3,sack:true});fullRecord(s,'home',{pass:true,incomplete:true});fullRecord(s,'home',{pass:true,interception:true});assert.equal(s.stats.home.yards,13);assert.equal(s.stats.home.passYards,9);assert.equal(s.stats.home.rushYards,4);assert.equal(s.stats.home.attempts,3);assert.equal(s.stats.home.completions,1);assert.equal(s.stats.home.turnovers,1);assert.equal(s.stats.home.plays,5);}

for(const reason of ['INTERCEPTED','TURNOVER ON DOWNS','SAFETY','TIME EXPIRED']){const[s,d]=fresh();if(reason==='TIME EXPIRED')d.clock=0;fullOffenseEnd(s,d,reason);assert.ok(s.result,reason);assert.equal(d.score,0);assert.equal(s.kickoff,null);assert.equal(s.overtime,0);assert.equal(s.possession,'home');}
for(const kind of ['extra-point','two-point'])for(const good of [false,true]){const[s,d]=fresh();d.score=6;d.clock=0;fullRecord(s,'home',{gain:75,touchdown:true});fullOffenseEnd(s,d,'TOUCHDOWN');assert.equal(s.result,null);assert.equal(s.conversion,'home');fullConversion(s,d,kind,good);assert.ok(s.result);assert.equal(d.score,6+(good?(kind==='extra-point'?1:2):0));assert.equal(s.kickoff,null);}
for(const good of [false,true]){const[s,d]=fresh();d.ball=80;assert.ok(fullKick(s,d,'home','field-goal',config.matchup.home,()=>.5,good));assert.ok(s.result);assert.equal(d.score,good?3:0);assert.equal(s.kickoff,null);}
{const[s,d]=fresh();fullPuntResult(s,d,{kicking:'home',ball:40,touchdown:true});assert.ok(s.result);assert.equal(d.score,0);assert.equal(s.conversion,null);}
// Full games retain possession changes, kickoffs, and overtime.
{const s=fullSession('five-minute',true),d=fullInitialDrive();fullOffenseEnd(s,d,'TURNOVER ON DOWNS');assert.equal(s.result,null);assert.equal(s.pending,'away');}
{const s=fullSession('two-minute',true),d=fullInitialDrive('two-minute');d.score=27;d.clock=0;fullOffenseEnd(s,d,'TIME EXPIRED');assert.equal(s.overtime,1);assert.equal(s.result,null);}
console.log('PASS: Arena scoring, conversions at zero, opening kick returns, no second possession/OT, mirror teams, Pro rules; full-game possession and OT preserved.');

// Regression guards for interrupted H2H frames and reload recovery.
// Gameplay/browser coverage remains in football-arena-browser.mjs.
{
 const {readFileSync}=await import('node:fs');
 const session=readFileSync(new URL('../FootballH2HSession.tsx',import.meta.url),'utf8');
 const bridge=readFileSync(new URL('../public/football-arena-bridge.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../footballH2HSession.css',import.meta.url),'utf8');
 const backend=readFileSync(new URL('../supabase/migrations/20261101055949_football_arena_matchmaking_stats.sql',import.meta.url),'utf8');
 assert.match(session,/sessionStorage\.setItem\(launchStorageKey/,'Store launch before requests so reloads can resume');
 assert.match(session,/sessionStorage\.getItem\(launchStorageKey/,'Resume with the same launch ID');
 assert.match(session,/interrupted\?\.ordinal\|\|complete\+1/,'Resume an unfinished drive, not the next drive');
 assert.match(session,/frameAutoRetried\.current\.add\(active\.token\)/,'Automatically retry a broken frame only once per attempt');
 assert.match(session,/data-frame-failed=\{!!frameFailure\}/,'A failed frame must expose landscape recovery state');
 assert.match(session,/contentWindow\?\.location\.pathname!==['"]\/play-moment-3d-preview\.html['"]/,'Detect iframe navigation to Home');
 assert.match(session,/frameRevision/,'Reload the iframe, not the server drive');
 assert.doesNotMatch(session,/if\(!mounted\.current\|\|run!==generation\.current\)\{if\(!r\.simulated\).*forfeit/,'Unmount must not silently forfeit a drive');
 assert.match(bridge,/event\.preventDefault\(\)/,'Block navigation to Home inside the embedded arena');
 assert.match(css,/data-frame-failed="true"/,'Render recovery over the landscape game');
 assert.match(backend,/d\.launch_id is distinct from \(p_args->>'launch'\)::uuid/,'Server uses original launch to resume same attempt');
}
console.log('PASS: H2H frame failure, retry, reload and server launch contract guards.');
