/** Currents app-only headline/link previews: short operational cache, no article archive.
 * https://currentsapi.services/en/news-aggregator-api and /en/faq document this workflow.
 */
import { createHash } from 'node:crypto';
import { fetchBoundedText, publicHttpsUrl } from './bounded-fetch.js';

const ENDPOINT = 'https://api.currentsapi.services/v1/search';
const MAX_AGE = 600_000;
const FAILURE_COOLDOWN = 30_000;
const RECENT_WINDOW = 7 * 86_400_000;
const ATTRIBUTION = 'https://currentsapi.services/';
type FailureCode = 'missing_key' | 'http_status' | 'provider_status' | 'invalid_json' |
  'response_too_large' | 'no_valid_links' | 'timeout' | 'network_error' | 'rate_limited' | 'unsafe_redirect';
type Diagnostic = { httpStatus?: number };
type Dependencies = {
  fetchImpl?: typeof fetch;
  now?: () => number;
  getKey?: () => string | undefined;
  log?: (code: FailureCode, diagnostic: Diagnostic) => void;
};
class NewsFailure extends Error {
  constructor(readonly code: FailureCode, readonly diagnostic: Diagnostic = {}) { super(code); }
}
const plain = (value: unknown, limit: number) => typeof value === 'string'
  ? value.replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit) : '';
const publicationTime = (value: unknown) => {
  const time = typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time > 0 ? time : null;
};
export function normalizeNews(payload: unknown, nowMs = Date.now()) {
  const data = payload as { status?: unknown; news?: unknown } | null;
  if (!data || data.status !== 'ok') throw new NewsFailure('provider_status');
  if (!Array.isArray(data.news)) throw new NewsFailure('invalid_json');
  const seen = new Set<string>();
  const articles = data.news.slice(0, 100).flatMap((row: unknown) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
    const item = row as Record<string, unknown>;
    const headline = plain(item.title, 240), url = publicHttpsUrl(item.url);
    if (!headline || !url || seen.has(url)) return [];
    const time = publicationTime(item.published);
    // Retrieval time must not make old articles look newly published.
    if (time !== null && (time < nowMs - RECENT_WINDOW || time > nowMs + 300_000)) return [];
    seen.add(url);
    return [{ id: url, headline, source: new URL(url).hostname.replace(/^www\./, ''),
      published: time === null ? null : new Date(time).toISOString(), description: '', image: null, url }];
  }).sort((a, b) => (Date.parse(b.published ?? '') || 0) - (Date.parse(a.published ?? '') || 0)).slice(0, 20);
  if (!articles.length) throw new NewsFailure('no_valid_links');
  return { articles, available: true as const, provider: 'Currents' as const,
    fetchedAt: new Date(nowMs).toISOString(), attribution: ATTRIBUTION };
}
type NewsPayload = ReturnType<typeof normalizeNews>;
function rateLimitDeadline(header: string | null, nowMs: number) {
  if (header) {
    const seconds = /^\d+$/.test(header.trim()) ? Number(header) : NaN;
    const date = Number.isFinite(seconds) ? nowMs + seconds * 1000 : Date.parse(header);
    if (Number.isFinite(date) && date > nowMs) return Math.max(nowMs + FAILURE_COOLDOWN, date);
  }
  return Math.max(nowMs + FAILURE_COOLDOWN, (Math.floor(nowMs / 86_400_000) + 1) * 86_400_000);
}
export function createNewsService(deps: Dependencies = {}) {
  type State = { fingerprint: string; cached: { expires: number; payload: NewsPayload } | null; pending: Promise<NewsPayload> | null; retryAt: number };
  let state: State = { fingerprint: '', cached: null, pending: null, retryAt: 0 };
  const now = deps.now ?? Date.now;
  const request = deps.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const getKey = deps.getKey ?? (() => process.env.CURRENTS_API_KEY);
  // Never log upstream exceptions, bodies, URLs or credentials.
  const log = deps.log ?? ((code: FailureCode, diagnostic: Diagnostic) =>
    console.warn('currents-news-unavailable', JSON.stringify({ code, ...diagnostic })));
  async function fetchNews(): Promise<NewsPayload> {
    const key = getKey()?.trim();
    const fingerprint = createHash('sha256').update(key ?? '').digest('hex');
    if (state.fingerprint !== fingerprint) state = { fingerprint, cached: null, pending: null, retryAt: 0 };
    const active = state;
    if (active.cached && active.cached.expires > now()) return active.cached.payload;
    if (active.pending) return active.pending;
    if (active.retryAt > now()) throw new NewsFailure('rate_limited');
    active.pending = (async () => {
      try {
        if (!key) throw new NewsFailure('missing_key');
        const startedAt = now();
        const url = new URL(ENDPOINT);
        url.search = new URLSearchParams({ keywords: 'NFL', language: 'en', page_size: '20', page_number: '1',
          start_date: new Date(startedAt - RECENT_WINDOW).toISOString(), end_date: new Date(startedAt).toISOString() }).toString();
        const response = await fetchBoundedText(url.href, {
          maxBytes: 1_000_000, timeoutMs: 8000,
          fetchImpl: async (target, init) => {
            // Inject auth only for this exact fixed destination; the helper rejects all redirects.
            if (String(target) !== url.href || init?.redirect !== 'manual') throw new NewsFailure('unsafe_redirect');
            const headers = new Headers(init.headers);
            headers.set('Authorization', `Bearer ${key}`);
            const result = await request(target, { ...init, headers });
            if (result.status === 429) {
              active.retryAt = rateLimitDeadline(result.headers.get('retry-after'), now());
              void result.body?.cancel().catch(() => {});
              throw new NewsFailure('rate_limited', { httpStatus: 429 });
            }
            if (!result.ok && !(result.status >= 300 && result.status < 400)) {
              void result.body?.cancel().catch(() => {});
              throw new NewsFailure('http_status', { httpStatus: result.status });
            }
            return result;
          },
        });
        let parsed: unknown;
        try { parsed = JSON.parse(response.text); } catch { throw new NewsFailure('invalid_json'); }
        const payload = normalizeNews(parsed, now());
        active.cached = { expires: now() + MAX_AGE, payload };
        active.retryAt = 0;
        return payload;
      } catch (error) {
        active.cached = null;
        active.retryAt = Math.max(active.retryAt, now() + FAILURE_COOLDOWN);
        let code: FailureCode = 'network_error';
        if (error instanceof NewsFailure) code = error.code;
        else if (error instanceof Error) {
          if (error.message === 'source_timeout' || ['TimeoutError', 'AbortError'].includes(error.name)) code = 'timeout';
          else if (error.message === 'response_too_large') code = 'response_too_large';
          else if (error.message === 'unsafe_source_redirect') code = 'unsafe_redirect';
        }
        log(code, error instanceof NewsFailure ? error.diagnostic : {});
        throw new NewsFailure(code);
      }
    })();
    try { return await active.pending; } finally { active.pending = null; }
  }
  return { fetchNews, now };
}
type Format = 'legacy' | 'v1';
function handler(service: ReturnType<typeof createNewsService>, format: Format) {
  return async (req: any, res: any) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method && req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    try {
      const payload = await service.fetchNews();
      const remaining = Math.max(0, Math.floor((Date.parse(payload.fetchedAt) + MAX_AGE - service.now()) / 1000));
      res.setHeader('Cache-Control', `public, s-maxage=${remaining}, max-age=0`);
      if (format === 'legacy') return res.status(200).json(payload);
      const { articles, ...metadata } = payload;
      return res.status(200).json({ ...metadata, kind: 'news', items: articles, source: 'Currents',
        updatedAt: payload.fetchedAt, sourceUpdatedAt: null });
    } catch {
      return format === 'legacy'
        ? res.status(200).json({ articles: [], available: false, warning: 'NFL news is temporarily unavailable.' })
        : res.status(503).json({ items: [], available: false, kind: 'news', error: 'feed_unavailable' });
    }
  };
}
export function createNewsHandler(deps: Dependencies = {}, format: Format = 'legacy') {
  return handler(createNewsService(deps), format);
}
const shared = createNewsService();
export const currentsNewsHandler = handler(shared, 'legacy');
export const currentsNewsV1Handler = handler(shared, 'v1');
