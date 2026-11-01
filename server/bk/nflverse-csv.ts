import { fetchBoundedText } from './bounded-fetch.js';
import { readSportsSnapshot, writeSportsSnapshot } from './sports-snapshot.js';

/** Delimited nflverse release reader, server-only; reject malformed or oversized tables. */
export function csvRecords(raw: string): Record<string, string>[] {
  const records: string[][] = [];
  let row: string[] = [], field = '', inside = false;
  const finish = () => {
    row.push(field);
    if (row.some(v => v.trim())) records.push(row);
    if (records.length > 100_001) throw new Error('source_row_limit');
    row = []; field = '';
  };
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (c === '"') {
      if (inside && raw[i + 1] === '"') { field += '"'; i++; }
      else inside = !inside;
    } else if (c === ',' && !inside) { row.push(field); field = ''; }
    else if ((c === '\n' || c === '\r') && !inside) {
      if (c === '\r' && raw[i + 1] === '\n') i++;
      finish();
    } else field += c;
    if (field.length > 16_384 || row.length > 256) throw new Error('source_field_limit');
  }
  if (inside) throw new Error('invalid_csv');
  if (field || row.length) finish();
  const header = (records.shift() ?? []).map(key => key.replace(/^\uFEFF/, '').trim());
  if (!header.length || header.some(key => !key) || new Set(header).size !== header.length) {
    throw new Error('invalid_csv_header');
  }
  return records.map(values => {
    if (values.length !== header.length) throw new Error('invalid_csv_row');
    return Object.fromEntries(header.map((key, i) => [key, values[i]]));
  });
}

export function requireColumns(rows: Record<string, string>[], columns: string[]) {
  if (!rows.length || columns.some(key => !Object.hasOwn(rows[0], key))) throw new Error('invalid_source_schema');
}
export const cleanField = (value: unknown, limit = 120) => typeof value === 'string'
  ? value.replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, limit) : '';
const teams = new Set('ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' '));
export function normalizeTeam(value: string) {
  const team = ({ LA: 'LAR', AZ: 'ARI', JAC: 'JAX', WSH: 'WAS' } as Record<string, string>)[value] ?? value;
  return teams.has(team) ? team : null;
}

type Snapshot<T> = { until: number; items: T[]; updatedAt: string; sourceUpdatedAt: string | null };
const snapshots = new Map<string, Snapshot<unknown>>();
const pending = new Map<string, Promise<Snapshot<unknown>>>();
const failures = new Map<string, number>();
export function resetNflverseCache() { snapshots.clear(); pending.clear(); failures.clear(); }
const nflverseUrl = /^https:\/\/github\.com\/nflverse\/nflverse-data\/releases\/download\/(schedules\/games\.csv|rosters\/roster_\d{4}\.csv|injuries\/injuries_\d{4}\.csv)$/;
export async function nflverseCsv<T>(url: string, parse: (rows: Record<string, string>[]) => T[], maxAge = 86_400_000, fetchImpl: typeof fetch = fetch, now: () => number = Date.now, parserNamespace = 'default'): Promise<Snapshot<T>> {
  const completedManifest = url === 'https://api.github.com/repos/nflverse/nflverse-pbp-internal/contents/released_games.csv?ref=main';
  if (!nflverseUrl.test(url) && !completedManifest) throw new Error('invalid_nflverse_source');
  if (!/^[a-z0-9-]{1,80}$/.test(parserNamespace)) throw new Error('invalid_parser_namespace');
  const cacheKey = `${parserNamespace}:${url}`;
  const cached = snapshots.get(cacheKey);
  if (cached && cached.until > now()) return cached as Snapshot<T>;
  const existing = pending.get(cacheKey);
  if (existing) return existing as Promise<Snapshot<T>>;
  if ((failures.get(cacheKey) ?? 0) > now()) throw new Error('upstream_backoff');
  const kind = url.includes('/rosters/') ? 'players' : url.includes('/injuries/') ? 'injuries' : 'games';
  const providerKey = parserNamespace === 'default' ? `nflverse-v2:${url}` : `nflverse-v3:${parserNamespace}:${url}`;
  const work = (async () => {
    const saved = await readSportsSnapshot(kind, providerKey, maxAge);
    if (saved) {
      const result = { ...saved, items: saved.items as T[], until: Date.parse(saved.updatedAt) + maxAge };
      snapshots.set(cacheKey, result);
      return result;
    }
    const requestStartedAt = now();
    const response = await fetchBoundedText(url, {
      maxBytes: completedManifest ? 500_000 : 8_000_000, timeoutMs: completedManifest ? 6_000 : 12_000, accept: completedManifest ? 'application/vnd.github.raw+json' : 'text/csv', fetchImpl,
      allowedRedirectHosts: completedManifest ? [] : ['github.com', 'release-assets.githubusercontent.com'],
    });
    const items = parse(csvRecords(response.text));
    if (!items.length) throw new Error('empty_source');
    const result = { until: now() + maxAge, items, updatedAt: new Date(now()).toISOString(), sourceUpdatedAt: response.sourceUpdatedAt };
    snapshots.set(cacheKey, result);
    await writeSportsSnapshot(kind, providerKey, result, requestStartedAt);
    return result;
  })();
  pending.set(cacheKey, work);
  try { return await work; }
  catch (error) { failures.set(cacheKey, now() + 30_000); throw error; }
  finally { pending.delete(cacheKey); }
}
export const attribution = {
  provider: 'nflverse', attribution: 'https://github.com/nflverse/nflverse-data',
  license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', live: false,
};
export function readOnly(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET'); res.status(405).json({ error: 'method_not_allowed' }); return false;
  }
  return true;
}
