import { attribution, readOnly } from '../../../server/bk/nflverse-csv.js';
import { getNflverseGames } from '../../../server/bk/nflverse-schedule.js';
export { NFLVERSE_SCHEDULE_URL, normalizeNflverseSchedule, getNflverseGames, easternKickoff } from '../../../server/bk/nflverse-schedule.js';

export default async function handler(req: any, res: any) {
  if (!readOnly(req, res)) return;
  try {
    const data = await getNflverseGames();
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return res.status(200).json({ available: true, kind: 'games', ...attribution,
      updatedAt: data.updatedAt, fetchedAt: data.updatedAt, sourceUpdatedAt: data.sourceUpdatedAt,
      freshness: 'periodic', items: data.items });
  } catch { return res.status(503).json({ available: false, kind: 'games', items: [], error: 'schedule_unavailable' }); }
}
