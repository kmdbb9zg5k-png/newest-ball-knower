import assert from 'node:assert/strict';
import { fetchBoundedText, publicHttpsUrl } from '../server/bk/bounded-fetch';
import { handlerFor, resetFeedCache } from '../server/bk/sports-feed';
import gamesHandler from '../api/bk/v1/games';
import playersHandler from '../api/bk/v1/players';
import injuriesHandler from '../api/bk/v1/injuries';

const responseCapture = () => ({
  statusCode: 0, body: null as any, headers: {} as Record<string, string>,
  setHeader(name: string, value: string) { this.headers[name.toLowerCase()] = value; },
  status(code: number) { this.statusCode = code; return this; },
  json(body: unknown) { this.body = body; return this; },
});
const originalFetch = globalThis.fetch;
const originalNewsUrl = process.env.BK_NEWS_JSON_URL;
const originalSnapshots = process.env.BK_SPORTS_SNAPSHOT_CACHE;
let checks = 0;
try {
  delete process.env.BK_SPORTS_SNAPSHOT_CACHE;
  // This configuration-only boundary rejects obvious SSRF targets. It is not a DNS pinning test.
  for (const url of [
    'http://public.example/feed', 'https://localhost/feed', 'https://127.0.0.1/feed',
    'https://2130706433/feed', 'https://[::1]/feed', 'https://169.254.169.254/latest/meta-data',
    'https://10.0.0.1/feed', 'https://service.internal/feed', 'https://service.local/feed',
    'https://user:secret@public.example/feed', 'https://public.example:8443/feed', 'file:///etc/passwd',
  ]) {
    assert.equal(publicHttpsUrl(url), '', `unsafe configured URL accepted: ${url}`); checks++;
  }
  assert.equal(publicHttpsUrl('https://public.example/feed'), 'https://public.example/feed'); checks++;

  let redirectedCalls = 0;
  await assert.rejects(fetchBoundedText('https://public.example/feed', {
    maxBytes: 100, timeoutMs: 1000,
    fetchImpl: (async (_url, init) => {
      redirectedCalls++; assert.equal(init?.redirect, 'manual');
      return new Response(null, { status: 302, headers: { Location: 'https://127.0.0.1/secret' } });
    }) as typeof fetch,
  }));
  assert.equal(redirectedCalls, 1, 'redirect target was contacted'); checks++;

  const followed: string[] = [];
  const redirected = await fetchBoundedText('https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv', {
    maxBytes: 100, timeoutMs: 1000, allowedRedirectHosts: ['release-assets.githubusercontent.com'],
    fetchImpl: (async (url, init) => {
      followed.push(String(url)); assert.equal(init?.redirect, 'manual');
      return followed.length === 1
        ? new Response(null, { status: 302, headers: { Location: 'https://release-assets.githubusercontent.com/release.csv' } })
        : new Response('a,b\n1,2\n');
    }) as typeof fetch,
  });
  assert.equal(followed.length, 2); assert.equal(redirected.text, 'a,b\n1,2\n'); checks++;

  let loopCalls = 0;
  await assert.rejects(fetchBoundedText('https://public.example/feed', {
    maxBytes: 100, timeoutMs: 1000, allowedRedirectHosts: ['public.example'],
    fetchImpl: (async () => {
      loopCalls++; return new Response(null, { status: 302, headers: { Location: '/feed' } });
    }) as typeof fetch,
  }));
  assert.equal(loopCalls, 4, 'redirect loop not bounded'); checks++;

  let streamCancelled = false;
  let pulls = 0;
  await assert.rejects(fetchBoundedText('https://public.example/feed', {
    maxBytes: 16, timeoutMs: 1000,
    fetchImpl: (async () => new Response(new ReadableStream({
      pull(controller) { pulls++; controller.enqueue(new Uint8Array(32)); },
      cancel() { streamCancelled = true; },
    }))) as typeof fetch,
  }));
  assert.equal(streamCancelled, true, 'oversized streaming body was not cancelled');
  assert.ok(pulls <= 3, 'oversized body was buffered instead of bounded'); checks++;

  const started = Date.now();
  await assert.rejects(fetchBoundedText('https://public.example/feed', {
    maxBytes: 100, timeoutMs: 35,
    fetchImpl: (async () => new Response(new ReadableStream({ start() { /* never emits body */ } }))) as typeof fetch,
  }));
  assert.ok(Date.now() - started < 1500, 'timeout did not cover stalled body'); checks++;

  let upstreamCalls = 0;
  globalThis.fetch = (async () => { upstreamCalls++; throw new Error('must not fetch on mutation'); }) as typeof fetch;
  for (const handler of [handlerFor('news'), gamesHandler, playersHandler, injuriesHandler]) {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const res = responseCapture(); await handler({ method, query: {} }, res);
      assert.equal(res.statusCode, 405); assert.equal(res.headers.allow, 'GET'); checks++;
    }
  }
  assert.equal(upstreamCalls, 0);

  resetFeedCache();
  delete process.env.BK_NEWS_JSON_URL;
  const unavailable = responseCapture();
  await handlerFor('news')({ method: 'GET', query: { url: 'https://attacker.example/feed' } }, unavailable);
  assert.equal(unavailable.statusCode, 503); assert.equal(unavailable.body.available, false);
  assert.equal(upstreamCalls, 0, 'client supplied upstream query was used');
  assert.ok(/no-store/.test(unavailable.headers['cache-control'] ?? ''), 'failure response cached as successful data'); checks++;

  resetFeedCache();
  process.env.BK_NEWS_JSON_URL = 'https://publisher.example/feed';
  globalThis.fetch = (async (url) => {
    assert.equal(String(url), process.env.BK_NEWS_JSON_URL); upstreamCalls++;
    return new Response(JSON.stringify({ articles: [{
      id: 'story-1', title: 'A football headline', url: 'https://publisher.example/story', source: 'Publisher',
    }] }), { headers: { 'Content-Type': 'application/json', 'Last-Modified': 'Fri, 30 Oct 2026 12:00:00 GMT' } });
  }) as typeof fetch;
  const first = responseCapture(); const second = responseCapture();
  await handlerFor('news')({ method: 'GET', query: { url: 'https://attacker.example/feed' } }, first);
  await handlerFor('news')({ method: 'GET', query: {} }, second);
  assert.equal(first.statusCode, 200); assert.equal(second.statusCode, 200);
  assert.equal(upstreamCalls, 1, 'warm cache fetched upstream again');
  assert.equal(first.body.updatedAt, second.body.updatedAt, 'cache read invented a fresh timestamp');
  assert.equal(first.body.items[0].id, 'story-1'); checks++;

  resetFeedCache();
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  const secret = 'api-token-must-not-escape';
  process.env.BK_NEWS_JSON_URL = `https://publisher.example/feed?key=${secret}`;
  globalThis.fetch = (async () => { throw new Error(`provider rejected key ${secret}`); }) as typeof fetch;
  try {
    console.warn = (...args: unknown[]) => { warnings.push(args); };
    const failed = responseCapture(); await handlerFor('news')({ method: 'GET' }, failed);
    assert.equal(failed.statusCode, 503);
    assert.ok(!JSON.stringify(failed.body).includes(secret));
    assert.ok(!JSON.stringify(warnings).includes(secret)); checks++;
  } finally { console.warn = originalWarn; }
  console.log(`Ball Knower API independent security checks passed (${checks} assertions/groups)`);
} finally {
  globalThis.fetch = originalFetch;
  if (originalNewsUrl === undefined) delete process.env.BK_NEWS_JSON_URL;
  else process.env.BK_NEWS_JSON_URL = originalNewsUrl;
  if (originalSnapshots === undefined) delete process.env.BK_SPORTS_SNAPSHOT_CACHE;
  else process.env.BK_SPORTS_SNAPSHOT_CACHE = originalSnapshots;
  resetFeedCache();
}
