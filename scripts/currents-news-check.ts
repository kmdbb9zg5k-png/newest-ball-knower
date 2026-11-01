import assert from 'node:assert/strict';
import { createNewsHandler, createNewsService, normalizeNews } from '../server/bk/currents-news.js';

const clock = Date.parse('2026-11-01T12:00:00Z');
const story = { title: 'NFL test fixture headline', url: 'https://publisher.example/nfl/story', published: '2026-11-01T11:00:00Z' };
const payload = (news: unknown[] = [story]) => ({ status: 'ok', news });
const response = (data: unknown = payload()) => new Response(JSON.stringify(data), { headers: { 'content-type': 'application/json' } });
const makeRes = () => ({ headers: {} as Record<string, string>, code: 0, body: null as any,
  setHeader(k: string, v: string) { this.headers[k] = v; }, status(code: number) { this.code = code; return this; },
  json(body: unknown) { this.body = body; return this; } });
const run = async (handler: ReturnType<typeof createNewsHandler>, req: any = { method: 'GET' }) => {
  const res = makeRes(); await handler(req, res); return res;
};
const quiet = () => {};

// Synthetic metadata examples: no publisher feed or article bodies are archived.
const relevanceCases: [string, string, boolean][] = [
  ['NFL weekly injury update', '/sport/story', true],
  ['A quarterback returns to practice', '/nfl/story', true],
  ['Fantasy football: Buccaneers defensive outlook', '/sport/story', true],
  ['Workers rally as Ravens arrive', '/local/story', true],
  ['Giants running back receives a fine', '/sport/story', true],
  ['NFL player discusses university research on concussions', '/sport/story', true],
  ['NFL rookie reflects on college football career', '/sport/story', true],
  ['Former NFL player discusses high school concussion research', '/sport/story', true],
  ['High school football and hockey players discuss risks', '/local/story', false],
  ['HOCKEY-NHL-AAA-BBB/', '/nfl/photo', false],
  ['Nephew of former NFL player rushes for five TDs in playoff win', '/sport/story', false],
  ['College football playoff preview', '/nfl/story', false],
  ['NCAA Eagles football playoff preview', '/sport/story', false],
  ['Giants win baseball series', '/sport/story', false],
  ['Dolphins spotted near the beach', '/local/story', false],
  ['General entertainment update', '/sport/story?section=nfl', false],
  ['General entertainment update', '/not-nfl/story', false],
];
for (const [title, path, expected] of relevanceCases) {
  const row = { ...story, title, url: `https://publisher.example${path}`, description: 'NFL hidden body mention' };
  const result = normalizeNews(payload([{ ...story, url: 'https://publisher.example/nfl/control' }, row]), clock);
  assert.equal(result.articles.some(item => item.headline === title), expected, `relevance: ${title}`);
}
assert.throws(() => normalizeNews(payload([{ ...story, title: 'Unrelated news', url: 'https://publisher.example/local' }]), clock), /no_valid_links/);

const normalized = normalizeNews(payload([
  { ...story, title: '<b>NFL</b>\u0000 test', description: 'DO NOT DISPLAY', content: 'FULL BODY', image: 'https://image.example/photo' },
  { ...story, url: `${story.url}#fragment` },
  { ...story, url: 'https://user:password@publisher.example/secret' },
  { ...story, url: 'http://publisher.example/plain' },
  { ...story, url: 'javascript:alert(1)' },
  { ...story, url: 'https://127.0.0.1/private' },
  { ...story, url: 'https://publisher.example/old', published: '2026-10-01T12:00:00Z' },
  { ...story, url: 'https://publisher.example/future', published: '2026-11-02T12:00:00Z' },
  { ...story, url: 'https://publisher.example/undated', published: undefined },
  { ...story, url: 'https://publisher.example/invalid-date', published: 'not-a-date' },
  null, [], { title: 'missing link' },
]), clock);
assert.equal(normalized.articles.length, 3);
assert.equal(normalized.articles[0].headline, 'NFL test');
assert.equal(normalized.articles[0].source, 'publisher.example');
assert.equal(normalized.articles[1].published, null);
assert.equal(normalized.articles[2].published, null);
assert.equal(normalized.provider, 'Currents');
assert.equal(normalized.attribution, 'https://currentsapi.services/');
assert.ok(!JSON.stringify(normalized).includes('FULL BODY'));
assert.ok(!JSON.stringify(normalized).includes('DO NOT DISPLAY'));
assert.equal(normalized.articles[0].image, null);
assert.equal(normalizeNews(payload(Array.from({ length: 30 }, (_, i) => ({ ...story, url: `https://publisher.example/${i}` }))), clock).articles.length, 20);
for (const invalid of [null, [], { status: 'error', news: [story] }, { status: 'ok', news: {} }, payload([])]) {
  assert.throws(() => normalizeNews(invalid, clock));
}

let now = clock, calls = 0;
const key = 'TEST-CURRENTS-SECRET';
const logs: unknown[] = [];
const handler = createNewsHandler({ now: () => now, getKey: () => key, log: (code, data) => logs.push({ code, ...data }),
  fetchImpl: async (target, init) => {
    calls++;
    const url = new URL(String(target));
    assert.equal(url.origin + url.pathname, 'https://api.currentsapi.services/v1/search');
    assert.equal(url.searchParams.get('keywords'), 'NFL');
    assert.equal(url.searchParams.get('language'), 'en');
    assert.equal(url.searchParams.get('page_size'), '20');
    assert.equal(url.searchParams.get('page_number'), '1');
    assert.equal(Date.parse(url.searchParams.get('end_date')!) - Date.parse(url.searchParams.get('start_date')!), 7 * 86_400_000);
    assert.ok(!String(target).includes(key));
    assert.equal(new Headers(init?.headers).get('authorization'), `Bearer ${key}`);
    assert.equal(new Headers(init?.headers).get('accept'), 'application/json');
    assert.equal(new Headers(init?.headers).get('x-rapidapi-key'), null);
    assert.equal(init?.redirect, 'manual');
    assert.ok(init?.signal);
    if (calls === 2) return new Response('PRIVATE PROVIDER BODY', { status: 403 });
    return response();
  } });
const [first, concurrent] = await Promise.all([run(handler, { method: 'GET', query: { url: 'https://attacker.example/', keywords: 'other' } }), run(handler)]);
assert.equal(calls, 1);
assert.deepEqual(first.body, concurrent.body);
assert.equal(first.headers['Cache-Control'], 'public, s-maxage=600, max-age=0');
now += 599_999; assert.equal((await run(handler)).headers['Cache-Control'], 'public, s-maxage=0, max-age=0'); assert.equal(calls, 1);
now += 2; const failed = await run(handler); assert.equal(calls, 2);
assert.equal(failed.body.available, false); assert.deepEqual(failed.body.articles, []);
assert.equal(failed.headers['Cache-Control'], 'no-store');
await run(handler); assert.equal(calls, 2);
now += 30_001; assert.equal((await run(handler)).body.available, true); assert.equal(calls, 3);
assert.deepEqual(logs, [{ code: 'http_status', httpStatus: 403 }]);
assert.ok(!JSON.stringify(logs).includes(key));
assert.ok(!JSON.stringify(logs).includes('PRIVATE'));
assert.equal((await run(handler, { method: 'POST' })).code, 405);
assert.equal(calls, 3);

let missingCalls = 0;
const missing = createNewsHandler({ getKey: () => undefined, log: quiet, fetchImpl: async () => { missingCalls++; return response(); } });
assert.equal((await run(missing)).body.available, false); assert.equal(missingCalls, 0);
const v1 = await run(createNewsHandler({ now: () => clock, getKey: () => key, log: quiet, fetchImpl: async () => response() }, 'v1'));
assert.equal(v1.body.kind, 'news'); assert.equal(v1.body.items.length, 1);
assert.equal(v1.body.provider, 'Currents'); assert.equal(v1.body.source, 'Currents');
assert.equal(v1.body.updatedAt, v1.body.fetchedAt); assert.equal(v1.body.sourceUpdatedAt, null);
assert.equal((await run(createNewsHandler({ getKey: () => undefined, log: quiet }, 'v1'))).code, 503);

let rotatedKey: string | undefined = 'first-key', rotationCalls = 0;
const rotating = createNewsService({ now: () => clock, getKey: () => rotatedKey, log: quiet, fetchImpl: async () => {
  rotationCalls++; return response();
} });
await rotating.fetchNews(); rotatedKey = undefined;
await assert.rejects(rotating.fetchNews(), /missing_key/); assert.equal(rotationCalls, 1);
rotatedKey = 'replacement-key'; await rotating.fetchNews(); assert.equal(rotationCalls, 2);
let limitedKey = 'limited-key';
const rotatingLimit = createNewsService({ now: () => clock, getKey: () => limitedKey, log: quiet, fetchImpl: async () =>
  limitedKey === 'limited-key' ? new Response('', { status: 429 }) : response() });
await assert.rejects(rotatingLimit.fetchNews(), /rate_limited/);
limitedKey = 'working-key'; assert.equal((await rotatingLimit.fetchNews()).available, true);

for (const redirect of ['https://attacker.example/collect', '/v1/other', 'http://127.0.0.1/']) {
  let requests = 0;
  const service = createNewsService({ now: () => clock, getKey: () => key, log: quiet, fetchImpl: async () => {
    requests++; return new Response('', { status: 302, headers: { location: redirect } });
  } });
  await assert.rejects(service.fetchNews(), /unsafe_redirect/);
  assert.equal(requests, 1, 'Redirects must never receive an authenticated follow-up');
}
for (const [makeResponse, error] of [
  [() => new Response('not-json'), 'invalid_json'],
  [() => response({ status: 'error', news: [story], message: key }), 'provider_status'],
  [() => response({ status: 'ok' }), 'invalid_json'],
  [() => new Response('too big', { headers: { 'content-length': '1000001' } }), 'response_too_large'],
  [() => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1_000_001)); controller.close(); } })), 'response_too_large'],
] as const) {
  const diagnostics: unknown[] = [];
  const service = createNewsService({ now: () => clock, getKey: () => key, log: (code, data) => diagnostics.push({ code, ...data }), fetchImpl: async () => makeResponse() });
  await assert.rejects(service.fetchNews(), new RegExp(error));
  assert.ok(!JSON.stringify(diagnostics).includes(key));
}

for (const retryAfter of ['120', 'Sun, 01 Nov 2026 12:02:00 GMT', null]) {
  let time = clock, count = 0;
  const retry = createNewsService({ now: () => time, getKey: () => key, log: quiet, fetchImpl: async () => {
    count++;
    return count === 1 ? new Response('quota details', { status: 429, headers: retryAfter ? { 'Retry-After': retryAfter } : {} }) : response();
  } });
  await assert.rejects(retry.fetchNews(), /rate_limited/);
  time += 60_000; await assert.rejects(retry.fetchNews(), /rate_limited/); assert.equal(count, 1);
  time = retryAfter ? clock + 120_001 : Date.parse('2026-11-02T00:00:00Z');
  assert.equal((await retry.fetchNews()).available, true); assert.equal(count, 2);
}

// Exercise the real bounded deadline, including a body which never completes.
let aborted = false, cancelled = false;
const slow = createNewsService({ now: () => clock, getKey: () => key, log: quiet, fetchImpl: async (_target, init) => {
  init?.signal?.addEventListener('abort', () => { aborted = true; });
  return new Response(new ReadableStream({ start() {}, cancel() { cancelled = true; } }));
} });
const began = Date.now(); await assert.rejects(slow.fetchNews(), /timeout/);
assert.ok(Date.now() - began < 10_000); assert.equal(aborted, true); assert.equal(cancelled, true);
console.log('Currents news checks passed: fixed authenticated source, streaming bounds/deadline, redirect confinement, schemas, dates, cache, quota cooldown, both routes.');
