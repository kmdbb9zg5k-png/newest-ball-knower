import assert from 'node:assert/strict';
import {access, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, extname, isAbsolute, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';

// Preserve emitted import specifiers and use ordinary Node ESM resolution.
// Push has its own focused check in scripts/push-emitted-runtime-check.mjs.
// The .source.ts preview controller is authored input for the checked-in,
// self-contained generated api/simulated-player-art-preview-control.ts bundle.
// Verify that relationship and import the generated handler, without treating
// the unbundled authoring file as a production runtime root.
const excluded = new Set(['api/push.ts', 'api/push-delivery.ts', 'api/simulated-player-art-preview-control.source.ts']);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = await mkdtemp(join(tmpdir(), 'bk-api-emitted-'));
const roots = [], emitted = new Set();
async function collect(folder) {
  for (const entry of await readdir(join(root, folder), {withFileTypes: true})) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) await collect(path);
    else if (entry.name.endsWith('.ts') && !excluded.has(path)) roots.push(path);
  }
}
async function sourceFor(importer, specifier) {
  const target = resolve(root, dirname(importer), specifier), path = relative(root, target);
  assert.ok(path && !path.startsWith('..') && !isAbsolute(path), 'Runtime import must stay inside the project.');
  const candidates = /\.js$/.test(target) ? [target.slice(0, -3) + '.ts', target] : extname(target) ? [target] : [target + '.ts', target + '.js'];
  for (const candidate of candidates) { try { await access(candidate); return relative(root, candidate); } catch {} }
  throw new Error(`Missing runtime source: ${importer} -> ${specifier}`);
}
try {
  const generated = await readFile(join(root, 'api/simulated-player-art-preview-control.ts'), 'utf8');
  assert.match(generated, /generated server bundle/);
  assert.match(generated, /\/\/ api\/simulated-player-art-preview-control\.source\.ts/);
  await collect('api'); roots.sort();
  const pending = [...roots];
  await writeFile(join(output, 'package.json'), JSON.stringify({type: 'module'}));
  await symlink(join(root, 'node_modules'), join(output, 'node_modules'), 'dir');
  while (pending.length) {
    const path = pending.shift(); if (emitted.has(path)) continue; emitted.add(path);
    const source = await readFile(join(root, path), 'utf8');
    const target = join(output, path.replace(/\.ts$/, '.js'));
    await mkdir(dirname(target), {recursive: true});
    if (path.endsWith('.json')) { await writeFile(target, source); continue; }
    const result = ts.transpileModule(source, {
      fileName: path, reportDiagnostics: true,
      compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, isolatedModules: true, verbatimModuleSyntax: false},
    });
    assert.equal((result.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `Emission failed: ${path}`);
    await writeFile(target, result.outputText);
    const js = ts.createSourceFile(path, result.outputText, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS), imports = [];
    const visit = node => {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        assert.ok(node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]), 'Dynamic runtime imports must be discoverable.');
        imports.push(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    };
    visit(js);
    for (const specifier of imports) if (specifier.startsWith('.')) pending.push(await sourceFor(path, specifier));
  }
  await writeFile(join(output, 'roots.json'), JSON.stringify(roots.map(path => './' + path.replace(/\.ts$/, '.js'))));
  await writeFile(join(output, 'smoke.mjs'), `
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import http from 'node:http'; import https from 'node:https'; import http2 from 'node:http2';
import net from 'node:net'; import tls from 'node:tls'; import dns from 'node:dns';
import {syncBuiltinESMExports} from 'node:module';
assert.equal(process.execArgv.length, 0, 'Child must run without loaders, tsx or resolver flags.');
assert.equal(process.env.NODE_OPTIONS, undefined);
for (const key of ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'APPLE_PRIVATE_KEY', 'CRON_SECRET']) assert.equal(process.env[key], undefined);
let networkCalls = 0;
const blocked = () => { networkCalls++; throw new Error('Network access is forbidden in the emitted runtime smoke.'); };
globalThis.fetch = blocked;
http.request = blocked; http.get = blocked; https.request = blocked; https.get = blocked; http2.connect = blocked;
net.connect = blocked; net.createConnection = blocked; net.Socket.prototype.connect = blocked; tls.connect = blocked;
dns.lookup = blocked; dns.resolve = blocked; dns.promises.lookup = blocked; dns.promises.resolve = blocked;
syncBuiltinESMExports();
const configured = process.argv[2] === 'configured';
if (configured) {
  // Inert fixture values only: every request exits before authentication,
  // account deletion, visit recording, purchase or webhook writes.
  Object.assign(process.env, {
    SUPABASE_URL: 'https://runtime-check.invalid', SUPABASE_SERVICE_ROLE_KEY: 'runtime-fixture-not-a-real-key',
    LOCKER_COMMERCE_MODE: 'test', STRIPE_SECRET_KEY: 'sk_test_runtime_fixture', STRIPE_WEBHOOK_SECRET: 'whsec_runtime_fixture',
    LOCKER_TEST_BUYERS: '00000000-0000-4000-8000-000000000001',
  });
}
const paths = JSON.parse(await readFile(new URL('./roots.json', import.meta.url), 'utf8')), modules = new Map();
for (const path of paths) { const module = await import(path); assert.equal(typeof module.default, 'function', path); modules.set(path, module); }
async function invoke(path, request) {
  const result = {statusCode: 200, headers: {}, body: null, ended: false};
  const response = {
    setHeader(key, value) { result.headers[key.toLowerCase()] = value; },
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; result.ended = true; return this; },
    end() { result.ended = true; return this; },
  };
  await modules.get('./api/' + path + '.js').default({method: 'GET', headers: {}, query: {}, body: {}, ...request}, response);
  assert.equal(result.ended, true, path + ' must respond.'); return result;
}
for (const path of ['account-delete', 'locker-commerce', 'locker-webhook']) assert.equal((await invoke(path, {method: 'OPTIONS'})).statusCode, 405);
const account = await invoke('account-delete', {method: 'POST'});
assert.equal(account.statusCode, configured ? 401 : 503);
assert.match(account.headers['cache-control'], /private.*no-store/);
const locker = await invoke('locker-commerce', {});
assert.equal(locker.statusCode, configured ? 401 : 200);
if (!configured) assert.deepEqual(locker.body, {available: false});
assert.equal((await invoke('locker-commerce', {method: 'POST'})).statusCode, configured ? 401 : 503);
assert.equal((await invoke('locker-webhook', {method: 'POST', body: '{}'})).statusCode, configured ? 400 : 503);
const visitor = modules.get('./api/track-visitor-location.js').default;
assert.equal((await visitor(new Request('https://runtime-check.invalid/api/track-visitor-location', {method: 'OPTIONS'}))).status, 405);
assert.equal((await visitor(new Request('https://runtime-check.invalid/api/track-visitor-location', {method: 'POST', headers: {'sec-fetch-site': 'cross-site'}}))).status, 403);
assert.equal(networkCalls, 0, 'Initialization and rejected requests must never contact providers or the database.');
console.log(JSON.stringify({ok: true, node: process.versions.node, roots: paths.length, configured, networkCalls}));
`);
  for (const mode of ['unconfigured', 'configured']) {
    // Do not pass any parent environment credentials into the child process.
    const child = spawnSync(process.execPath, [join(output, 'smoke.mjs'), mode], {cwd: output, env: {NODE_ENV: 'test', TZ: 'UTC'}, encoding: 'utf8', timeout: 20_000});
    assert.equal(child.status, 0, `Emitted API runtime failed in ${mode} mode:\n${child.stderr || child.stdout || child.error?.message || ''}`);
    const receipt = JSON.parse(child.stdout.trim()); assert.equal(receipt.ok, true);
    console.log(`Native Node ${receipt.node}: ${receipt.roots} API roots initialized (${emitted.size} local modules), ${mode} guards passed, zero network calls.`);
  }
} finally { await rm(output, {recursive: true, force: true}); }
