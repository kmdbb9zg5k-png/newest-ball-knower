import assert from 'node:assert/strict';
import { createSportsSnapshotStore, sportsSnapshotProviderKey } from '../server/bk/sports-snapshot.ts';

const now = Date.now();
const snapshot = { items: [{ id: 'test-game', homeScore: 14 }], updatedAt: new Date(now - 1000).toISOString(), sourceUpdatedAt: null, source: 'example.test' };
const env = { BK_SPORTS_SNAPSHOT_CACHE: 'true', SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test-fixture' };
let calls: { url: string; options: RequestInit }[] = [];
let reply: unknown = [{ snapshot }];
let status = 200;
const mockFetch = (async (url, options) => {
  calls.push({ url: String(url), options: options! });
  return new Response(JSON.stringify(reply), { status, headers: { 'Content-Type': 'application/json' } });
}) as typeof fetch;
const store = createSportsSnapshotStore({ env, fetch: mockFetch, now: () => now });
const provider = 'https://provider.example/api?secret=must-not-leak|schema:v2';

assert.deepEqual(await store.read('games', provider, 60_000), snapshot);
assert.equal(calls[0].options.redirect, 'error');
assert.equal((calls[0].options.headers as Record<string, string>).apikey, env.SUPABASE_SECRET_KEY);
assert.equal((calls[0].options.headers as Record<string, string>).Authorization, undefined, 'new secret keys are not JWT bearer tokens');
assert.ok(calls[0].url.includes(sportsSnapshotProviderKey(provider)));
assert.ok(!calls[0].url.includes('must-not-leak'));
assert.equal(await store.read('games', provider, 1000), null, 'TTL boundary is expired');
assert.equal(await store.read('games', provider, NaN), null);

reply = [{ snapshot: { ...snapshot, updatedAt: new Date(now + 1000).toISOString() } }];
assert.equal(await store.read('games', provider, 60_000), null, 'future fetched timestamp is not fresh');
reply = [{ snapshot: { ...snapshot, updatedAt: new Date(now - 86_400_001).toISOString() } }];
assert.equal(await store.read('games', provider, 999_999_999), null, 'no unlimited stale fallback');
reply = [{ snapshot: { ...snapshot, sourceUpdatedAt: 'not a timestamp' } }];
assert.equal(await store.read('games', provider, 60_000), null);
reply = [{ snapshot: { ...snapshot, items: [] } }];
assert.equal(await store.read('games', provider, 60_000), null);

calls = [];
reply = true;
await store.write('games', provider, { ...snapshot, until: 123 } as typeof snapshot, now - 2000);
assert.equal(calls.length, 1);
const body = JSON.parse(String(calls[0].options.body));
assert.equal(body.p_request_started_at, new Date(now - 2000).toISOString());
assert.equal(body.p_snapshot.updatedAt, snapshot.updatedAt, 'preserve fetch timestamp');
assert.equal(body.p_snapshot.sourceUpdatedAt, null, 'do not invent source freshness');
assert.ok(!('until' in body.p_snapshot), 'internal expiry is not persisted');
assert.equal(body.p_provider_key, sportsSnapshotProviderKey(provider));
assert.ok(!String(calls[0].options.body).includes('must-not-leak'));
await store.write('games', provider, snapshot, now + 1000);
assert.equal(calls.length, 1, 'reject impossible refresh ordering');

status = 503;
assert.equal(await store.read('games', provider, 60_000), null);
const before = calls.length;
await store.write('games', provider, snapshot, now - 2000);
assert.equal(calls.length, before + 1, 'failed writes are not retried');
for (const badEnv of [{ ...env, BK_SPORTS_SNAPSHOT_CACHE: 'false' }, { ...env, SUPABASE_SECRET_KEY: '' }, { ...env, SUPABASE_URL: 'https://evil.test' }, { ...env, SUPABASE_URL: 'https://fixture.supabase.co/other' }]) {
  const disabled = createSportsSnapshotStore({ env: badEnv, fetch: mockFetch, now: () => now });
  const count = calls.length;
  assert.equal(await disabled.read('games', provider, 60_000), null);
  await disabled.write('games', provider, snapshot, now - 2000);
  assert.equal(calls.length, count);
}
let cancelled = false;
const oversized = createSportsSnapshotStore({ env, now: () => now, fetch: (async () => new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(8_000_001)); }, cancel() { cancelled = true; } }))) as typeof fetch });
assert.equal(await oversized.read('players', provider, 60_000), null);
assert.equal(cancelled, true, 'oversized streams are cancelled during reading');
const throwing = createSportsSnapshotStore({ env, fetch: (async () => { throw new Error('private upstream diagnostic'); }) as typeof fetch });
assert.equal(await throwing.read('games', provider, 60_000), null);
await throwing.write('games', provider, snapshot, now - 2000);
const stalledFetch = createSportsSnapshotStore({ env, fetch: (() => new Promise(() => {})) as typeof fetch });
const stalledBody = createSportsSnapshotStore({ env, fetch: (async () => new Response(new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { return new Promise(() => {}); } }))) as typeof fetch });
const start = Date.now();
assert.deepEqual(await Promise.all([stalledFetch.read('games', provider, 60_000), stalledBody.read('games', provider, 60_000)]), [null, null]);
assert.ok(Date.now() - start < 4000, 'fetch/body/cancellation cannot outlive the request budget');
console.log('Sports snapshots: opt-in, strict TTL, credential confinement, response bounds, no retry, metadata preservation passed.');
