import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
// Exercise the production validator without initializing browser auth services.
const source=(await readFile(new URL('../footballArena.ts',import.meta.url),'utf8')).replace(/^import .* from '\.\/supabase';\n/,'');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {validFootballStats}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const legacy={points:7,yards:75,plays:5};
const detailed={...legacy,passingYards:60,rushingYards:15,passAttempts:3,completions:2,touchdowns:1,turnovers:0,returnTouchdowns:0};
assert.equal(validFootballStats(legacy),true);
assert.equal(validFootballStats(detailed),true);
assert.equal(validFootballStats({...detailed,points:0,passingYards:-5,rushingYards:0,yards:-5,touchdowns:0}),true);
for(const invalid of [null,[],{...detailed,completions:4},{...detailed,passAttempts:6},{...detailed,turnovers:-1},{...detailed,rushingYards:501},{...detailed,returnTouchdowns:1},{...legacy,passingYards:75},{...legacy,extra:0},{...detailed,completions:null},{...legacy,plays:0},{...legacy,yards:1.5}])assert.equal(validFootballStats(invalid),false,JSON.stringify(invalid));
const returnTD={points:7,yards:0,plays:0,passingYards:0,rushingYards:0,passAttempts:0,completions:0,touchdowns:0,turnovers:0,returnTouchdowns:1};
assert.equal(validFootballStats(returnTD),true);
assert.equal(validFootballStats({...returnTD,returnTouchdowns:0}),false);
assert.equal(validFootballStats({...returnTD,points:3}),false);
console.log('PASS: legacy/detailed offense payloads, bounds, partial rejection and kickoff touchdown without offensive plays.');
