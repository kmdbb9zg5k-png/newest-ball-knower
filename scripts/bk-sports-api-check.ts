import assert from 'node:assert/strict';
import { handlerFor, fetchFeed, resetFeedCache } from '../server/bk/sports-feed';
const old = process.env.BK_NEWS_JSON_URL;
const originalFetch = globalThis.fetch;
const response = () => ({ statusCode: 0, body: null as any, headers: {} as Record<string, string>, setHeader(k: string, v: string) { this.headers[k] = v; }, status(n: number) { this.statusCode = n; return this; }, json(b: any) { this.body = b; return this; } });
try {
  delete process.env.BK_NEWS_JSON_URL;
  await assert.rejects(fetchFeed('news'), /not_configured/);
  const unavailable = response();
  await handlerFor('news')({ method: 'GET' }, unavailable);
  assert.equal(unavailable.statusCode, 503);
  assert.equal(unavailable.body.available, false);
  assert.equal(unavailable.headers['Cache-Control'], 'no-store');
  const post = response();
  await handlerFor('news')({ method: 'POST' }, post);
  assert.equal(post.statusCode, 405);
  process.env.BK_NEWS_JSON_URL = 'https://licensed.example/feed.json';
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(JSON.stringify({ articles: [
    { title: 'Example headline', link: 'https://publisher.example/story', source: 'Publisher', license: 'CC BY 4.0', attribution: 'https://publisher.example/credits' },
    { title: 'Bad link', link: 'javascript:alert(1)' },
  ] }), { status: 200, headers: { 'last-modified': 'Fri, 30 Oct 2026 00:00:00 GMT' } }); };
  const result = await fetchFeed('news');
  assert.equal(result.items.length, 1);
  assert.equal((result.items[0] as any).headline, 'Example headline');
  assert.equal((result.items[0] as any).url, 'https://publisher.example/story');
  assert.equal((result.items[0] as any).license, 'CC BY 4.0');
  assert.equal((result.items[0] as any).attribution, 'https://publisher.example/credits');
  assert.equal(result.sourceUpdatedAt, '2026-10-30T00:00:00.000Z');
  assert.equal((await fetchFeed('news')).updatedAt, result.updatedAt);
  assert.equal(calls, 1);
  // Cached authorized feed must not survive configuration being removed/changed.
  delete process.env.BK_NEWS_JSON_URL;
  await assert.rejects(fetchFeed('news'), /not_configured/);
  process.env.BK_NEWS_JSON_URL = 'https://different.example/feed.json';
  await fetchFeed('news');
  assert.equal(calls, 2);
  process.env.BK_NEWS_JSON_URL = 'https://127.0.0.1/feed';
  await assert.rejects(fetchFeed('news'), /invalid_feed_config/);
  console.log('Ball Knower Sports API contract checks passed');
} finally {
  resetFeedCache();
  globalThis.fetch = originalFetch;
  if (old === undefined) delete process.env.BK_NEWS_JSON_URL; else process.env.BK_NEWS_JSON_URL = old;
}
