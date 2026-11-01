// Isolated in-memory PostgreSQL engine. Never connects to a remote database.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const { PGlite } = await import(process.env.BK_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; grant usage on schema public to anon, authenticated, service_role;');
  const directory = new URL('../supabase/migrations/', import.meta.url);
  const migration = (await readdir(directory)).find(name => name.endsWith('_sports_api_snapshots.sql'));
  assert.ok(migration);
  await db.exec(await readFile(new URL(migration, directory), 'utf8'));
  const state = (await db.query(`select relrowsecurity from pg_class where oid = 'public.bk_sports_api_snapshots'::regclass`)).rows[0];
  assert.equal(state.relrowsecurity, true);
  const permissions = (await db.query(`select
    has_table_privilege('anon','public.bk_sports_api_snapshots','select') as anon_read,
    has_table_privilege('authenticated','public.bk_sports_api_snapshots','insert') as user_write,
    has_function_privilege('anon','public.store_bk_sports_api_snapshot(text,text,jsonb,timestamptz)','execute') as anon_rpc,
    has_function_privilege('authenticated','public.store_bk_sports_api_snapshot(text,text,jsonb,timestamptz)','execute') as user_rpc,
    (select prosecdef from pg_proc where oid = 'public.store_bk_sports_api_snapshot(text,text,jsonb,timestamptz)'::regprocedure) as definer`)).rows[0];
  assert.deepEqual(permissions, { anon_read: false, user_write: false, anon_rpc: false, user_rpc: false, definer: false });
  const now = Date.now();
  const key = 'a'.repeat(64);
  const snapshot = { items: [{ id: 'test', homeScore: 7 }], updatedAt: new Date(now).toISOString(), sourceUpdatedAt: null };
  const write = (value, started, provider = key) => db.query('select public.store_bk_sports_api_snapshot($1,$2,$3::jsonb,$4::timestamptz) as stored', ['games', provider, JSON.stringify(value), new Date(started).toISOString()]);
  await db.exec('set role service_role;');
  assert.equal((await write(snapshot, now - 1000)).rows[0].stored, true);
  assert.equal((await write(snapshot, now - 1000)).rows[0].stored, false, 'retry idempotency');
  const olderRequest = { ...snapshot, items: [{ id: 'test', homeScore: 0 }], updatedAt: new Date(now + 2000).toISOString() };
  assert.equal((await write(olderRequest, now - 2000)).rows[0].stored, false, 'earlier request finishing late cannot overwrite');
  assert.equal((await db.query('select snapshot from public.bk_sports_api_snapshots')).rows[0].snapshot.items[0].homeScore, 7);
  const newer = { ...snapshot, items: [{ id: 'test', homeScore: 14 }], updatedAt: new Date(now + 1000).toISOString() };
  assert.equal((await write(newer, now)).rows[0].stored, true);
  assert.equal((await write(snapshot, now - 1000, 'b'.repeat(64))).rows[0].stored, true, 'providers are isolated');
  await assert.rejects(write({ ...snapshot, items: [] }, now + 1));
  await assert.rejects(write({ ...snapshot, items: undefined }, now + 1));
  await assert.rejects(write({ ...snapshot, updatedAt: 'infinity' }, now + 1));
  await assert.rejects(write({ ...snapshot, sourceUpdatedAt: 'not a timestamp' }, now + 1));
  await assert.rejects(write({ ...snapshot, sourceUpdatedAt: undefined }, now + 1));
  await db.exec('reset role; grant select, insert, update on public.bk_sports_api_snapshots to anon, authenticated;');
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role};`);
    assert.equal((await db.query('select * from public.bk_sports_api_snapshots')).rows.length, 0, 'RLS denies reads despite accidental grant');
    await assert.rejects(write(snapshot, now), 'RPC remains inaccessible');
    await assert.rejects(db.query(`insert into public.bk_sports_api_snapshots(kind, provider_key, snapshot, request_started_at, fetched_at) values('games',$1,$2::jsonb,now(),now())`, ['c'.repeat(64), JSON.stringify(snapshot)]), 'RLS denies writes despite accidental grant');
    await db.exec('reset role;');
  }
  console.log('Sports snapshot SQL: migration, service-only access, invoker RPC, RLS, idempotency, request ordering, provider isolation, malformed snapshots passed.');
} finally { await db.close(); }
