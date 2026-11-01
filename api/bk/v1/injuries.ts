import { attribution, cleanField, nflverseCsv, normalizeTeam, readOnly, requireColumns } from '../../../server/bk/nflverse-csv.js';
export const NFLVERSE_INJURY_URL = 'https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_2026.csv';
export function normalizeInjuries(rows: Record<string, string>[], season = 2026) {
  requireColumns(rows, ['gsis_id', 'full_name', 'team', 'season', 'week', 'report_status']);
  const valid = rows.filter(row => Number(row.season) === season && Number.isInteger(Number(row.week)) && Number(row.week) >= 1 && Number(row.week) <= 22);
  const latestWeek = valid.reduce((week, row) => Math.max(week, Number(row.week)), 0);
  const reports = new Map<string, { id: string; player: string | null; team: string; season: number; week: number; status: string; detail: string | null; updatedAt: string | null }>();
  for (const row of valid) {
    if (Number(row.week) !== latestWeek) continue;
    const id = cleanField(row.gsis_id, 100), status = cleanField(row.report_status || row.practice_status, 100), team = normalizeTeam(row.team);
    if (!id || !status || !team) continue;
    const timestamp = Date.parse(row.date_modified);
    const updatedAt = Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
    const previous = reports.get(id);
    if (previous && (previous.updatedAt ?? '') >= (updatedAt ?? '')) continue;
    reports.set(id, { id, player: cleanField(row.full_name) || null, team, season, week: latestWeek,
      status, detail: cleanField(row.report_primary_injury || row.practice_primary_injury, 180) || null, updatedAt });
  }
  return [...reports.values()];
}
export async function getNflverseInjuries(fetchImpl: typeof fetch = fetch, now: () => number = Date.now) {
  return nflverseCsv(NFLVERSE_INJURY_URL, normalizeInjuries, 300_000, fetchImpl, now);
}
export default async function handler(req: any, res: any) {
  if (!readOnly(req, res)) return;
  try {
    const data = await getNflverseInjuries();
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ available: true, kind: 'injuries', ...attribution,
      updatedAt: data.updatedAt, fetchedAt: data.updatedAt, sourceUpdatedAt: data.sourceUpdatedAt,
      freshness: 'periodic', scope: 'latest-reported-week', reportWeek: data.items[0]?.week ?? null,
      items: data.items });
  } catch { return res.status(503).json({ available: false, kind: 'injuries', items: [], error: 'injury_feed_unavailable' }); }
}
