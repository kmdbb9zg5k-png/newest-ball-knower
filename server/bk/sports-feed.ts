/** Server-configured, authorized JSON sources only. Request inputs never select a URL. */
import { fetchBoundedText, publicHttpsUrl } from './bounded-fetch.js';
import { cleanField } from './nflverse-csv.js';
import { readSportsSnapshot, writeSportsSnapshot } from './sports-snapshot.js';
export type FeedKind = 'news' | 'games' | 'players' | 'injuries';
type Result = { items: unknown[]; updatedAt: string; sourceUpdatedAt: string | null; source: string };
const cache = new Map<string, { until: number; result: Result }>();
const inFlight = new Map<string, Promise<Result>>();
const failures = new Map<string, number>();
const ttl: Record<FeedKind, number> = { news: 300_000, games: 60_000, players: 3_600_000, injuries: 300_000 };
const env: Record<FeedKind, string> = { news: 'BK_NEWS_JSON_URL', games: 'BK_GAMES_JSON_URL', players: 'BK_PLAYERS_JSON_URL', injuries: 'BK_INJURIES_JSON_URL' };
export function resetFeedCache() { cache.clear(); inFlight.clear(); failures.clear(); }
const timestamp = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};
const number = (value: unknown) => (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) &&
  Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 999 ? Number(value) : null;
function normalize(kind: FeedKind, raw: any): unknown[] {
  const rows = Array.isArray(raw) ? raw : raw?.items ?? raw?.data ?? raw?.[({ news: 'articles', games: 'games', players: 'players', injuries: 'injuries' })[kind]];
  if (!Array.isArray(rows)) throw new Error('invalid_source_schema');
  const limit = kind === 'news' ? 100 : kind === 'games' ? 400 : 10_000;
  if (kind !== 'news' && rows.length > limit) throw new Error('source_row_limit');
  const seen = new Set<string>();
  return rows.slice(0, limit).flatMap<unknown>((row: any) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
    if (kind === 'news') {
      const headline = cleanField(row.headline ?? row.title, 240), url = publicHttpsUrl(row.url ?? row.link);
      if (!headline || !url || seen.has(url)) return [];
      seen.add(url);
      const licenseUrl = publicHttpsUrl(row.licenseUrl);
      const license = cleanField(row.license, 120), attribution = publicHttpsUrl(row.attribution ?? row.attributionUrl);
      return [{ id: cleanField(row.id) || url, headline, url,
        source: cleanField(row.source?.name ?? row.source, 120) || new URL(url).hostname,
        published: timestamp(row.publishedAt ?? row.published ?? row.pubDate),
        ...(license ? { license } : {}), ...(licenseUrl ? { licenseUrl } : {}), ...(attribution ? { attribution } : {}) }];
    }
    if (kind === 'games') {
      const id = cleanField(row.id ?? row.gameId ?? row.game_id, 100), home = cleanField(row.home ?? row.homeTeam, 80), away = cleanField(row.away ?? row.awayTeam, 80);
      if (!id || !home || !away || home === away || seen.has(id)) return [];
      seen.add(id);
      return [{ id, home, away, startTime: timestamp(row.startTime ?? row.date), status: cleanField(row.status, 80) || 'unknown', homeScore: number(row.homeScore), awayScore: number(row.awayScore) }];
    }
    const id = cleanField(row.id ?? row.playerId, 100);
    if (!id || seen.has(id)) return [];
    if (kind === 'players') {
      const name = cleanField(row.name ?? row.fullName, 120);
      if (!name) return [];
      seen.add(id);
      return [{ id, name, team: cleanField(row.team, 80) || null, position: cleanField(row.position, 20) || null }];
    }
    const status = cleanField(row.status, 100);
    if (!status) return [];
    seen.add(id);
    return [{ id, player: cleanField(row.player ?? row.name, 120) || null, status, detail: cleanField(row.detail ?? row.injury, 180) || null, updatedAt: timestamp(row.updatedAt) }];
  });
}
export async function fetchFeed(kind: FeedKind): Promise<Result> {
  const value = process.env[env[kind]];
  if (!value) throw new Error('not_configured');
  const url = publicHttpsUrl(value);
  if (!url) throw new Error('invalid_feed_config');
  const key = `${kind}:json-v2:${url}`;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return cached.result;
  const pending = inFlight.get(key);
  if (pending) return pending;
  if ((failures.get(key) ?? 0) > Date.now()) throw new Error('upstream_backoff');
  const task = (async () => {
    const saved = await readSportsSnapshot(kind, key, ttl[kind]);
    if (saved?.source) {
      const result = { ...saved, source: saved.source };
      cache.set(key, { result, until: Date.parse(saved.updatedAt) + ttl[kind] });
      return result;
    }
    const requestStartedAt = Date.now();
    const response = await fetchBoundedText(url, { maxBytes: 1_000_000, timeoutMs: 8000 });
    const raw = JSON.parse(response.text);
    const items = normalize(kind, raw);
    if (!items.length) throw new Error('no_valid_items');
    const result = { items, updatedAt: new Date().toISOString(), sourceUpdatedAt: response.sourceUpdatedAt, source: new URL(url).hostname };
    // One entry per source kind avoids retaining credentials/old configurations indefinitely.
    for (const previous of cache.keys()) if (previous.startsWith(`${kind}:`) && previous !== key) cache.delete(previous);
    cache.set(key, { result, until: Date.now() + ttl[kind] });
    await writeSportsSnapshot(kind, key, result, requestStartedAt);
    return result;
  })();
  inFlight.set(key, task);
  try { return await task; }
  catch (error) { failures.set(key, Date.now() + 30_000); throw error; }
  finally { inFlight.delete(key); }
}
export function handlerFor(kind: FeedKind) {
  return async (req: any, res: any) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method && req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'method_not_allowed' }); }
    try {
      const result = await fetchFeed(kind);
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
      return res.status(200).json({ available: true, kind, ...result, fetchedAt: result.updatedAt });
    } catch {
      // Provider URLs can contain tokens; do not log upstream exceptions or request URLs.
      console.warn('bk-feed-unavailable', kind);
      return res.status(503).json({ available: false, kind, items: [], error: 'feed_unavailable' });
    }
  };
}
