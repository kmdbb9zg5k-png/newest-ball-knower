/** Server-only, optional cross-instance cache. No stale data is returned after its TTL. */
import { createHash } from 'node:crypto';

export type SportsSnapshotResult = {
  items: unknown[];
  /** Time this upstream response was fetched, not when the underlying facts changed. */
  updatedAt: string;
  sourceUpdatedAt: string | null;
  source?: string;
};

const MAX_BYTES = 8_000_000;
const MAX_AGE_MS = 86_400_000;
const TIMEOUT_MS = 2_000;
const validKind = (kind: string) => /^[a-z][a-z0-9_-]{0,63}$/.test(kind);
export const sportsSnapshotProviderKey = (provider: string) =>
  createHash('sha256').update(provider).digest('hex');

function cleanResult(value: unknown, now: number): SportsSnapshotResult | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Partial<SportsSnapshotResult>;
  if (!Array.isArray(r.items) || !r.items.length || r.items.length > 50_000) return null;
  if (typeof r.updatedAt !== 'string' || !Number.isFinite(Date.parse(r.updatedAt))) return null;
  if (Date.parse(r.updatedAt) > now + 300_000) return null;
  if (r.sourceUpdatedAt !== null && (typeof r.sourceUpdatedAt !== 'string' || !Number.isFinite(Date.parse(r.sourceUpdatedAt)))) return null;
  if (r.source !== undefined && (typeof r.source !== 'string' || r.source.length > 500)) return null;
  return { items: r.items, updatedAt: r.updatedAt, sourceUpdatedAt: r.sourceUpdatedAt, ...(r.source === undefined ? {} : { source: r.source }) };
}

type Dependencies = { env?: NodeJS.ProcessEnv; fetch?: typeof fetch; now?: () => number };

export function createSportsSnapshotStore(deps: Dependencies = {}) {
  const env = deps.env ?? process.env;
  const fetcher = deps.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const now = deps.now ?? Date.now;
  function config() {
    if (env.BK_SPORTS_SNAPSHOT_CACHE !== 'true') return null;
    const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key || !env.SUPABASE_URL) return null;
    try {
      const url = new URL(env.SUPABASE_URL);
      // Credentials may only go to the configured hosted Supabase project, never to a redirect.
      if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.port || url.username || url.password || url.search || url.hash || url.pathname !== '/') return null;
      return { base: url.origin, key };
    } catch { return null; }
  }

  async function request(path: string, body?: unknown): Promise<unknown> {
    const settings = config();
    if (!settings) return null;
    const controller = new AbortController();
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let timer: ReturnType<typeof setTimeout>;
    const cancel = (body?: ReadableStream<Uint8Array> | null) => { void (reader ? reader.cancel() : body?.cancel())?.catch(() => {}); };
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); cancel(); reject(new Error('snapshot_timeout')); }, TIMEOUT_MS);
    });
    try {
      return await Promise.race([deadline, (async () => {
        const response = await fetcher(`${settings.base}/rest/v1/${path}`, {
          method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: controller.signal,
          headers: { apikey: settings.key, ...(settings.key.startsWith('sb_secret_') ? {} : { Authorization: `Bearer ${settings.key}` }), Accept: 'application/json', 'Content-Type': 'application/json' },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
        if (controller.signal.aborted || !response.ok) { cancel(response.body); return null; }
        const length = Number(response.headers.get('content-length'));
        if (Number.isFinite(length) && length > MAX_BYTES) { cancel(response.body); return null; }
        if (!response.body) return null;
        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let bytes = 0, text = '';
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > MAX_BYTES) { cancel(); return null; }
            text += decoder.decode(chunk.value, { stream: true });
          }
        } finally { reader.releaseLock(); }
        text += decoder.decode();
        return text ? JSON.parse(text) : null;
      })()]);
    } finally { clearTimeout(timer); }
  }

  return {
    async read(kind: string, provider: string, maxAgeMs: number): Promise<SportsSnapshotResult | null> {
      if (!config() || !validKind(kind) || !provider || !Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return null;
      try {
        const query = new URLSearchParams({ kind: `eq.${kind}`, provider_key: `eq.${sportsSnapshotProviderKey(provider)}`, select: 'snapshot', limit: '1' });
        const rows = await request(`bk_sports_api_snapshots?${query}`);
        const snapshot = Array.isArray(rows) && rows.length === 1 ? cleanResult(rows[0]?.snapshot, now()) : null;
        if (!snapshot) return null;
        const age = now() - Date.parse(snapshot.updatedAt);
        return age >= 0 && age < Math.min(maxAgeMs, MAX_AGE_MS) ? snapshot : null;
      } catch { return null; } // Cache failure must never take down an authorized live upstream.
    },
    async write(kind: string, provider: string, value: SportsSnapshotResult, requestStartedAt: number): Promise<void> {
      if (!config() || !validKind(kind) || !provider || !Number.isFinite(requestStartedAt)) return;
      try {
        const snapshot = cleanResult(value, now());
        if (!snapshot || requestStartedAt > Date.parse(snapshot.updatedAt) || requestStartedAt > now() || requestStartedAt < now() - MAX_AGE_MS) return;
        const body = { p_kind: kind, p_provider_key: sportsSnapshotProviderKey(provider), p_snapshot: snapshot, p_request_started_at: new Date(requestStartedAt).toISOString() };
        if (Buffer.byteLength(JSON.stringify(body)) > MAX_BYTES - 1024) return;
        await request('rpc/store_bk_sports_api_snapshot', body);
      } catch { /* Best effort, no automatic retries or secret-bearing error logs. */ }
    },
  };
}

const store = createSportsSnapshotStore();
export const readSportsSnapshot = store.read;
export const writeSportsSnapshot = store.write;
