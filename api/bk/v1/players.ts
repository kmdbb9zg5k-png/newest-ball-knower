import { attribution, cleanField, nflverseCsv, normalizeTeam, readOnly, requireColumns } from '../../../server/bk/nflverse-csv';
export const NFLVERSE_ROSTER_URL = 'https://github.com/nflverse/nflverse-data/releases/download/rosters/roster_2026.csv';
export function normalizeRosters(rows: Record<string, string>[], season = 2026) {
  requireColumns(rows, ['gsis_id', 'full_name', 'team', 'position', 'season']);
  const seen = new Map<string, string>();
  return rows.flatMap(row => {
    if (Number(row.season) !== season) return [];
    const id = cleanField(row.gsis_id, 100), name = cleanField(row.full_name), team = normalizeTeam(row.team);
    if (!id || !name || !team) return [];
    const identity = JSON.stringify([name, team, row.position, row.status, row.jersey_number]);
    if (seen.has(id)) {
      if (seen.get(id) !== identity) throw new Error('conflicting_player_identity');
      return [];
    }
    seen.set(id, identity);
    return [{ id, name, team, position: cleanField(row.position, 20) || null,
      jerseyNumber: /^\d{1,2}$/.test(row.jersey_number ?? '') ? row.jersey_number : null,
      season, rosterStatus: cleanField(row.status, 30) || null }];
  });
}
export async function getNflversePlayers(fetchImpl: typeof fetch = fetch, now: () => number = Date.now) {
  return nflverseCsv(NFLVERSE_ROSTER_URL, rows => {
    const items = normalizeRosters(rows);
    if (items.length < 1000 || items.length > 10_000 || new Set(items.map(p => p.team)).size !== 32) throw new Error('incomplete_roster');
    return items;
  }, 3_600_000, fetchImpl, now);
}
export default async function handler(req: any, res: any) {
  if (!readOnly(req, res)) return;
  try {
    const data = await getNflversePlayers();
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ available: true, kind: 'players', ...attribution,
      updatedAt: data.updatedAt, fetchedAt: data.updatedAt, sourceUpdatedAt: data.sourceUpdatedAt,
      freshness: 'periodic', scope: 'season-roster', items: data.items });
  } catch { return res.status(503).json({ available: false, kind: 'players', items: [], error: 'roster_unavailable' }); }
}
