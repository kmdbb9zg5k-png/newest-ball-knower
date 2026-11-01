import assert from 'node:assert/strict';
import { nflverseCsv, resetNflverseCache } from '../server/bk/nflverse-csv.ts';
import { sportsSnapshotProviderKey } from '../server/bk/sports-snapshot.ts';

const url = 'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv';
const csv = 'game_id,home_score\nfixture-game,21\n';
const compact = (rows: Record<string, string>[]) => rows.map(row => ({ id: row.game_id }));
const scoring = (rows: Record<string, string>[]) => rows.map(row => ({ gameId: row.game_id, score: Number(row.home_score) }));
const expectedCompact = [{ id: 'fixture-game' }];
const expectedScoring = [{ gameId: 'fixture-game', score: 21 }];
const envNames = ['BK_SPORTS_SNAPSHOT_CACHE', 'SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
const savedEnv = new Map(envNames.map(name => [name, process.env[name]]));
const originalFetch = globalThis.fetch;

try {
  process.env.BK_SPORTS_SNAPSHOT_CACHE = 'false';
  let calls = 0;
  const fetchCsv = (async () => { calls++; return new Response(csv); }) as typeof fetch;
  const now = () => Date.now();

  // Same CSV URL, different normalized output schemas: the second parser must actually run.
  resetNflverseCache();
  assert.deepEqual((await nflverseCsv(url, compact, 60_000, fetchCsv, now)).items, expectedCompact);
  assert.deepEqual((await nflverseCsv(url, scoring, 60_000, fetchCsv, now, 'fantasy-scores-v1')).items, expectedScoring);
  assert.equal(calls, 2);
  await nflverseCsv(url, () => { throw new Error('default memory cache missed'); }, 60_000, fetchCsv, now, 'default');
  await nflverseCsv(url, () => { throw new Error('scoring memory cache missed'); }, 60_000, fetchCsv, now, 'fantasy-scores-v1');
  assert.equal(calls, 2, 'each namespace reuses only its own cached schema');
  await assert.rejects(nflverseCsv(url, compact, 60_000, fetchCsv, now, '../invalid'), /invalid_parser_namespace/);
  assert.equal(calls, 2, 'invalid namespaces fail before fetching');

  // In-flight work coalesces within a namespace, but never across schema namespaces.
  resetNflverseCache();
  calls = 0;
  const releases: (() => void)[] = [];
  const delayed = (async () => {
    calls++;
    await new Promise<void>(resolve => releases.push(resolve));
    return new Response(csv);
  }) as typeof fetch;
  let compactParses = 0, scoringParses = 0;
  const first = nflverseCsv(url, rows => { compactParses++; return compact(rows); }, 60_000, delayed, now);
  const duplicate = nflverseCsv(url, () => { throw new Error('same-namespace pending request was not coalesced'); }, 60_000, delayed, now);
  const other = nflverseCsv(url, rows => { scoringParses++; return scoring(rows); }, 60_000, delayed, now, 'fantasy-scores-v1');
  // Let the cache-miss microtasks reach the mock fetch; do not wait for a second
  // fetch that would never start if this regression returned.
  await new Promise<void>(resolve => setImmediate(resolve));
  releases.forEach(release => release());
  const [one, two, three] = await Promise.all([first, duplicate, other]);
  assert.equal(calls, 2, 'two namespaces start two independent source requests');
  assert.deepEqual(one.items, expectedCompact);
  assert.deepEqual(two.items, expectedCompact);
  assert.deepEqual(three.items, expectedScoring);
  assert.equal(compactParses, 1);
  assert.equal(scoringParses, 1);

  // A provider outage in one namespace cannot suppress a working parser/consumer.
  resetNflverseCache();
  calls = 0;
  let clock = Date.now();
  const failing = (async () => { calls++; return new Response('', { status: 503 }); }) as typeof fetch;
  await assert.rejects(nflverseCsv(url, compact, 60_000, failing, () => clock));
  await assert.rejects(nflverseCsv(url, compact, 60_000, fetchCsv, () => clock), /upstream_backoff/);
  assert.equal(calls, 1, 'same namespace obeys failure backoff');
  assert.deepEqual((await nflverseCsv(url, scoring, 60_000, fetchCsv, () => clock, 'fantasy-scores-v1')).items, expectedScoring);
  assert.equal(calls, 2, 'other namespace is not held in backoff');
  clock += 30_001;
  assert.deepEqual((await nflverseCsv(url, compact, 60_000, fetchCsv, () => clock)).items, expectedCompact);
  assert.equal(calls, 3);

  // Parser/schema failure is isolated too, and must not overwrite the other successful schema.
  resetNflverseCache();
  await assert.rejects(nflverseCsv(url, () => { throw new Error('schema_rejected'); }, 60_000, fetchCsv, now, 'bad-schema'), /schema_rejected/);
  assert.deepEqual((await nflverseCsv(url, compact, 60_000, fetchCsv, now)).items, expectedCompact);
  await assert.rejects(nflverseCsv(url, scoring, 60_000, fetchCsv, now, 'bad-schema'), /upstream_backoff/);

  // Simulated cross-instance persistence: no real credentials, database, or network.
  resetNflverseCache();
  process.env.BK_SPORTS_SNAPSHOT_CACHE = 'true';
  process.env.SUPABASE_URL = 'https://fixture.supabase.co';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_fixture-only';
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stored = new Map<string, unknown>();
  const writes: { kind: string; key: string }[] = [];
  globalThis.fetch = (async (input, options) => {
    const requestUrl = new URL(String(input));
    assert.equal(requestUrl.origin, 'https://fixture.supabase.co');
    if (options?.method === 'POST') {
      assert.equal(requestUrl.pathname, '/rest/v1/rpc/store_bk_sports_api_snapshot');
      const body = JSON.parse(String(options.body));
      stored.set(`${body.p_kind}:${body.p_provider_key}`, body.p_snapshot);
      writes.push({ kind: body.p_kind, key: body.p_provider_key });
      return new Response('true');
    }
    assert.equal(requestUrl.pathname, '/rest/v1/bk_sports_api_snapshots');
    const kind = requestUrl.searchParams.get('kind')?.replace(/^eq\./, '');
    const key = requestUrl.searchParams.get('provider_key')?.replace(/^eq\./, '');
    const snapshot = stored.get(`${kind}:${key}`);
    return new Response(JSON.stringify(snapshot ? [{ snapshot }] : []));
  }) as typeof fetch;
  calls = 0;
  await nflverseCsv(url, compact, 60_000, fetchCsv, now);
  await nflverseCsv(url, scoring, 60_000, fetchCsv, now, 'fantasy-scores-v1');
  assert.equal(calls, 2);
  assert.deepEqual(writes, [
    { kind: 'games', key: sportsSnapshotProviderKey(`nflverse-v2:${url}`) },
    { kind: 'games', key: sportsSnapshotProviderKey(`nflverse-v3:fantasy-scores-v1:${url}`) },
  ], 'default durable keys stay backward-compatible; custom parser schemas use independent v3 keys');
  resetNflverseCache();
  const noFetch = (async () => { throw new Error('unexpected upstream fetch on durable hit'); }) as typeof fetch;
  assert.deepEqual((await nflverseCsv(url, compact, 60_000, noFetch, now)).items, expectedCompact);
  assert.deepEqual((await nflverseCsv(url, scoring, 60_000, noFetch, now, 'fantasy-scores-v1')).items, expectedScoring);
  assert.equal(writes.length, 2, 'durable hits do not rewrite timestamps or snapshots');
  console.log('NFLverse cache namespace isolation: memory, pending coalescing, outage/schema backoff, durable v2 compatibility and v3 separation passed.');
} finally {
  resetNflverseCache();
  globalThis.fetch = originalFetch;
  for (const name of envNames) {
    const value = savedEnv.get(name);
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}
