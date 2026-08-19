const TEAM_NAMES: Record<string, string> = {
  ARI: 'Arizona Cardinals', ATL: 'Atlanta Falcons', BAL: 'Baltimore Ravens', BUF: 'Buffalo Bills',
  CAR: 'Carolina Panthers', CHI: 'Chicago Bears', CIN: 'Cincinnati Bengals', CLE: 'Cleveland Browns',
  DAL: 'Dallas Cowboys', DEN: 'Denver Broncos', DET: 'Detroit Lions', GB: 'Green Bay Packers',
  HOU: 'Houston Texans', IND: 'Indianapolis Colts', JAX: 'Jacksonville Jaguars', KC: 'Kansas City Chiefs',
  LA: 'Los Angeles Rams', LAC: 'Los Angeles Chargers', LV: 'Las Vegas Raiders', MIA: 'Miami Dolphins',
  MIN: 'Minnesota Vikings', NE: 'New England Patriots', NO: 'New Orleans Saints', NYG: 'New York Giants',
  NYJ: 'New York Jets', PHI: 'Philadelphia Eagles', PIT: 'Pittsburgh Steelers', SEA: 'Seattle Seahawks',
  SF: 'San Francisco 49ers', TB: 'Tampa Bay Buccaneers', TEN: 'Tennessee Titans', WAS: 'Washington Commanders',
};

const numberOrNull = (value: any) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export default async function handler(_req: any, res: any) {
  try {
    const upstream = await fetch('https://api.nfldata.org/v1/games?season=2026&limit=100', {
      headers: { Accept: 'application/json', 'User-Agent': 'BallKnower/1.0' },
    });
    if (!upstream.ok) throw new Error(`NFL games upstream ${upstream.status}`);

    const payload: any = await upstream.json();
    const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
    const now = Date.now();
    const relevant = rows
      .filter((g: any) => {
        const when = Date.parse(g?.gameday || g?.game_date || g?.date || '');
        return !Number.isFinite(when) || when >= now - 7 * 24 * 60 * 60 * 1000;
      })
      .sort((a: any, b: any) => Date.parse(a?.gameday || a?.game_date || a?.date || '') - Date.parse(b?.gameday || b?.game_date || b?.date || ''))
      .slice(0, 50);

    const games = relevant.map((g: any, i: number) => {
      const awayAbbr = String(g?.away_team || g?.away || '').toUpperCase() || null;
      const homeAbbr = String(g?.home_team || g?.home || '').toUpperCase() || null;
      const date = g?.gameday || g?.game_date || g?.date || null;
      const time = g?.gametime || g?.game_time || null;
      const awayScore = numberOrNull(g?.away_score);
      const homeScore = numberOrNull(g?.home_score);
      const finished = awayScore !== null && homeScore !== null;

      return {
        id: String(g?.game_id || g?.id || i),
        date: date && time ? `${date}T${time}` : date,
        status: finished ? 'Final' : 'Scheduled',
        away: awayAbbr ? (TEAM_NAMES[awayAbbr] || awayAbbr) : 'Away',
        home: homeAbbr ? (TEAM_NAMES[homeAbbr] || homeAbbr) : 'Home',
        awayAbbr,
        homeAbbr,
        details: g?.spread_line != null
          ? `${g?.spread_line > 0 ? homeAbbr : awayAbbr} ${Math.abs(Number(g.spread_line))}`
          : null,
        spread: numberOrNull(g?.spread_line ?? g?.spread),
        overUnder: numberOrNull(g?.total_line ?? g?.over_under ?? g?.total),
      };
    });

    if (!games.length) throw new Error('NFL games upstream returned no games');

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    res.status(200).json({ games });
  } catch (error: any) {
    console.error('nfl-sportsbook-error', error);
    res.status(502).json({ games: [], error: 'Unable to load NFL odds' });
  }
}
