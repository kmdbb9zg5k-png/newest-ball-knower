import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertLoopbackUrl, assertLoopbackDatabase, makeManifest, ownsUser, QA_OWNER, readStackConfig } from './real-service-config.mjs';
import { compareSchema, renderSchema, validateSnapshot } from './schema-contract.mjs';

for (const url of ['https://gpnboygoosrmeydwjpvk.supabase.co', 'http://127.0.0.1.evil.test:54321', 'http://evil.test@127.0.0.1:54321', 'http://127.0.0.1:54321/api', 'http://127.0.0.1:54321?remote=1']) assert.throws(() => assertLoopbackUrl(url));
for (const url of ['postgresql://user:pass@gpnboygoosrmeydwjpvk.supabase.co/postgres', 'postgresql://user:pass@127.0.0.1/not-postgres']) assert.throws(() => assertLoopbackDatabase(url));
assert.equal(assertLoopbackUrl('http://127.0.0.1:54321/'), 'http://127.0.0.1:54321');
assert.throws(() => readStackConfig({ API_URL: 'http://127.0.0.1:54321', DB_URL: 'postgres://postgres:postgres@127.0.0.1:54322/postgres', ANON_KEY: 'same', SERVICE_ROLE_KEY: 'same' }));
const manifest = makeManifest('a'.repeat(40));
const fixture = manifest.users[0];
const owned = { id: fixture.id, app_metadata: { bk_launch_qa: { owner: QA_OWNER, runId: manifest.runId, slot: fixture.slot, expiresAt: manifest.expiresAt } } };
assert.equal(ownsUser(owned, manifest, fixture), true);
for (const key of ['owner', 'runId', 'slot', 'expiresAt']) {
  const forged = structuredClone(owned); forged.app_metadata.bk_launch_qa[key] = 'someone-else';
  assert.equal(ownsUser(forged, manifest, fixture), false);
}
assert.equal(ownsUser({ ...owned, app_metadata: {}, user_metadata: owned.app_metadata }, manifest, fixture), false, 'user-editable metadata cannot authorize cleanup');
const snapshot = JSON.parse(readFileSync(new URL('./production-schema.snapshot.json', import.meta.url), 'utf8'));
validateSnapshot(snapshot);
const sql = renderSchema(snapshot);
assert.ok(sql.includes('revoke all on function') && sql.includes('enable row level security'));
assert.equal(snapshot.source.userRows, 0);
assert.equal(snapshot.source.authRows, 0);
assert.equal(snapshot.source.providerRows, 0);
assert.equal(compareSchema(snapshot, structuredClone(snapshot)).matched, true);
const widened = structuredClone(snapshot);
widened.tables.find(table => table.name === 'ball_knower_leagues').policies[0].using = 'true';
assert.equal(compareSchema(snapshot, widened).matched, false, 'RLS policy drift must fail parity');
for (const material of ['https://example.test', 'net.http_post', 'cron.schedule', 'vault.decrypted_secrets', 'sb_secret_1234567890123456']) {
  const unsafe = structuredClone(snapshot); unsafe.functions[0].definition += `\n-- ${material}`;
  assert.throws(() => validateSnapshot(unsafe));
}
console.log(JSON.stringify({ ok: true, mode: 'offline_safety_contracts_only', realAuthAccounts: false, productionWrites: 0, schemaTables: snapshot.tables.length, schemaFunctions: snapshot.functions.length, migrationMetadata: snapshot.migrations.length }));
