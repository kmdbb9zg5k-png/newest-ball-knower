// Exercise emitted Node ESM, where tsx/bundler extension resolution cannot hide bad imports.
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';
const temp = await mkdtemp(join(tmpdir(), 'bk-esm-'));
try {
  await writeFile(join(temp, 'package.json'), JSON.stringify({ type: 'module' }));
  for (const folder of ['api/bk/v1', 'server/bk']) {
    await mkdir(join(temp, folder), { recursive: true });
    for (const file of await readdir(folder)) {
      if (!file.endsWith('.ts')) continue;
      const source = await readFile(join(folder, file), 'utf8');
      const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
      await writeFile(join(temp, folder, file.replace(/\.ts$/, '.js')), compiled.outputText);
    }
  }
  await writeFile(join(temp, 'server/nflPredictionFeed.js'), await readFile('server/nflPredictionFeed.js', 'utf8'));
  const legacy = await readFile('api/nfl-news.ts', 'utf8');
  await writeFile(join(temp, 'api/nfl-news.js'), ts.transpileModule(legacy, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
  const check = `
    import assert from 'node:assert/strict';
    globalThis.fetch = async () => { throw new Error('unexpected upstream call'); };
    for (const path of ['games','players','injuries','news'].map(kind=>'./api/bk/v1/'+kind+'.js').concat('./api/nfl-news.js')) {
      const {default:handler} = await import(path);
      let status, body; const headers = {};
      const res = {setHeader(k,v){headers[k.toLowerCase()]=v;},status(s){status=s;return this;},json(b){body=b;}};
      await handler({method:'POST'},res);
      assert.equal(status,405); assert.equal(headers.allow,'GET'); assert.equal(body.error,'method_not_allowed');
    }
    const picks = await import('./server/nflPredictionFeed.js');
    assert.equal(typeof picks.fetchCanonicalPredictionGames, 'function');
    assert.throws(() => picks.normalizeNflversePredictionRows([]), /invalid_source_schema/);
    console.log('Compiled Node ESM: all five read-only API handlers and the Picks provider load.');
  `;
  await writeFile(join(temp, 'check.mjs'), check);
  const result = spawnSync(process.execPath, ['check.mjs'], { cwd: temp, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr || String(result.error));
  process.stdout.write(result.stdout);
} finally { await rm(temp, { recursive: true, force: true }); }
