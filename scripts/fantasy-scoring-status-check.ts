import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../FantasyLeaguePostDraft.tsx',import.meta.url),'utf8');
assert.match(source,/data-testid="fantasy-scoring-paused"/);
assert.match(source,/Live scoring paused\. Saved scores are preserved\./);
// Execute the exact team-score presentation helper without loading application contexts.
const helper=source.slice(source.indexOf('const matchupTotal ='),source.indexOf('const TeamMatchupHeader ='));
const scope:any={exports:{}};
vm.runInNewContext(ts.transpileModule(helper+'\nexports.total=matchupTotal;',{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText,scope);
const score={livePoints:5.6,projectedPoints:120,hasProjectedTotal:true};
assert.equal(scope.exports.total(score,'Live').label,'Saved score');
assert.equal(scope.exports.total(score,'Live').value,'5.60','Pause notice must not alter saved points');
assert.equal(scope.exports.total(score,'Live').projection,'120.00');
assert.equal(scope.exports.total(score,'Final').label,'Final','Verified final results must retain final labels');
assert.equal(scope.exports.total(score,'Scheduled').label,'Current');
assert.equal(scope.exports.total(undefined,'Scheduled').value,'—');
assert.match(source,/status === "Live" \? "Saved score" : status/,'Matchup picker must not advertise stale scores as live');
assert.match(source,/: hasLiveScore\s*\? "Saved score"/,'Schedule must identify unfinished stored scores');
assert.match(source,/const gameLabel = player\.isFinal\s*\? "Final"\s*: player\.isLive\s*\? "Saved score"/,'Player rows must preserve final status and label unfinished saved scores');
console.log('Fantasy scoring presentation: visible pause notice, saved-score labels, unchanged points/projections and final distinctions passed.');
