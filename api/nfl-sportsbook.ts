const TEAM_NAMES: Record<string, string> = {
  ARI: 'Arizona Cardinals', ATL: 'Atlanta Falcons', BAL: 'Baltimore Ravens', BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers', CHI: 'Chicago Bears', CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns',
  DAL: 'Dallas Cowboys', DEN: 'Denver Broncos', DET: 'Detroit Lions', GB: 'Green Bay Packers',
  HOU: 'Houston Texans', IND: 'Indianapolis Colts', JAX: 'Jacksonville Jaguars', KC: 'Kansas City Chiefs',
  LAR: 'Los Angeles Rams', LAC: 'Los Angeles Chargers', LV: 'Las Vegas Raiders', MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings', NE: 'New England Patriots', NO: 'New Orleans Saints', NYG: 'New York Giants',
  NYJ: 'New York Jets', PHI: 'Philadelphia Eagles', PIT: 'Pittsburgh Steelers', SEA: 'Seattle Seahawks',
  SF: 'San Francisco 49ers', TB: 'Tampa Bay Buccaneers', TEN: 'Tennessee Titans', WAS: 'Washington Commanders',
};

const TEAM_ABBR_ALIASES: Record<string, string> = { LA: 'LAR', WSH: 'WAS' };

const normalizeTeamAbbr = (value: any) => {
  const raw = String(value || '').trim().toUpperCase();
  return TEAM_ABBR_ALIASES[raw] || raw || null;
};

const numberOrNull = (value: any) => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const easternOffsetForDate = (date: string) => {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '-05:00';
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  if (month < 3 || month > 11) return '-05:00';
  if (month > 3 && month < 11) return '-04:00';

  const nthSunday = (monthIndex: number, nth: number) => {
    const first = new Date(Date.UTC(year, monthIndex, 1));
    const firstSunday = 1 + ((7 - first.getUTCDay()) % 7);
    return firstSunday + (nth - 1) * 7;
  };

  const day = parsed.getUTCDate();
  if (month === 3) return day >= nthSunday(2, 2) ? '-04:00' : '-05:00';
  return day < nthSunday(10, 1) ? '-04:00' : '-05:00';
};

const kickoffIso = (date: any, time: any) => {
  if (!date) return null;
  if (!time) return date;
  const cleanTime = String(time).trim();
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(cleanTime)) return `${date}T${cleanTime}`;
  return `${date}T${cleanTime}${easternOffsetForDate(String(date))}`;
};

const sendUnavailable = (res: any, reason: string) => {
  // Never cache an empty degradation response. A transient upstream timeout should
  // not become the next visitor's cached sportsbook result.
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.status(200).json({ games: [], available: false, warning: reason });
};

/** Fetches the verified NFL data source with one bounded retry for transient failures. */
const fetchScoreboardRows = async () => {
  const attempts = [
    { limit: 400, timeoutMs: 9000 },
    { limit: 400, timeoutMs: 9000 },
  ];
  let failureReason = 'NFL scoreboard feed temporarily unavailable';

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    try {
      const upstream = await fetch(`https://api.nfldata.org/v1/games?season=2026&limit=${attempt.limit}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; BallKnower/1.0)' },
        signal: AbortSignal.timeout(attempt.timeoutMs),
      });

      if (!upstream.ok) {
        failureReason = `NFL scoreboard feed temporarily unavailable (${upstream.status})`;
        console.warn('nfl-sportsbook-upstream-unavailable', upstream.status, `attempt-${index + 1}`);
        continue;
      }

      const payload: any = await upstream.json();
      const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
      if (rows.length) return { rows, failureReason: '' };

      failureReason = 'NFL scoreboard feed returned no games';
      console.warn('nfl-sportsbook-upstream-empty', `attempt-${index + 1}`);
    } catch (error: any) {
      const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
      failureReason = timeout ? 'NFL scoreboard feed timed out' : 'NFL scoreboard feed temporarily unavailable';
      console.warn(
        'nfl-sportsbook-feed-degraded',
        timeout ? 'timeout' : String(error?.message || error),
        `attempt-${index + 1}`,
      );
    }
  }

  return { rows: [] as any[], failureReason };
};

export default async function handler(_req: any, res: any) {
  try {
    const { rows, failureReason } = await fetchScoreboardRows();
    if (!rows.length) return sendUnavailable(res, failureReason);

    const now = Date.now();
    const relevant = rows
      .filter((g: any) => {
        const date = g?.gameday || g?.game_date || g?.date || '';
        const when = Date.parse(kickoffIso(date, g?.gametime || g?.game_time) || date);
        return !Number.isFinite(when) || when >= now - 7 * 24 * 60 * 60 * 1000;
      })
      .sort((a: any, b: any) => {
        const aDate = a?.gameday || a?.game_date || a?.date || '';
        const bDate = b?.gameday || b?.game_date || b?.date || '';
        return Date.parse(kickoffIso(aDate, a?.gametime || a?.game_time) || aDate)
          - Date.parse(kickoffIso(bDate, b?.gametime || b?.game_time) || bDate);
      })
      .slice(0, 50);

    const games = relevant.map((g: any, i: number) => {
      const awayAbbr = normalizeTeamAbbr(g?.away_team || g?.away);
      const homeAbbr = normalizeTeamAbbr(g?.home_team || g?.home);
      const date = g?.gameday || g?.game_date || g?.date || null;
      const time = g?.gametime || g?.game_time || null;
      const awayScore = numberOrNull(g?.away_score);
      const homeScore = numberOrNull(g?.home_score);
      const finished = awayScore !== null && homeScore !== null;
      const spread = numberOrNull(g?.spread_line ?? g?.spread);

      return {
        id: String(g?.game_id || g?.id || i),
        date: kickoffIso(date, time),
        status: finished ? 'Final' : 'Scheduled',
        away: awayAbbr ? (TEAM_NAMES[awayAbbr] || awayAbbr) : 'Away',
        home: homeAbbr ? (TEAM_NAMES[homeAbbr] || homeAbbr) : 'Home',
        awayAbbr,
        homeAbbr,
        details: spread !== null ? `${spread > 0 ? homeAbbr : awayAbbr} ${Math.abs(spread)}` : null,
        spread,
        overUnder: numberOrNull(g?.total_line ?? g?.over_under ?? g?.total),
      };
    });

    if (!games.length) return sendUnavailable(res, 'No current NFL games or lines are available');

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    res.status(200).json({ games, available: true });
  } catch (error: any) {
    console.warn('nfl-sportsbook-handler-degraded', String(error?.message || error));
    return sendUnavailable(res, 'NFL scoreboard feed temporarily unavailable');
  }
}
