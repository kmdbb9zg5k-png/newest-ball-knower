type Json = Record<string, any>;

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const TEAM_ALIASES: Record<string, string> = { LA: 'LAR', WSH: 'WAS', JAC: 'JAX' };
const normalizeTeam = (value: unknown) => {
  const team = String(value || '').trim().toUpperCase();
  return TEAM_ALIASES[team] || team;
};

const fetchScoreboard = async (week?: number) => {
  const query = new URLSearchParams({ dates: '2026', seasontype: '2', limit: '1000' });
  if (week) query.set('week', String(week));
  const response = await fetch(`${ESPN_SCOREBOARD}?${query}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'Ball-Knower/1.0' },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`ESPN schedule returned ${response.status}`);
  return response.json() as Promise<Json>;
};

const parseEvents = (payloads: Json[]) => {
  const games = new Map<string, Json>();
  for (const payload of payloads) {
    for (const event of Array.isArray(payload?.events) ? payload.events : []) {
      const competition = event?.competitions?.[0];
      const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];
      const away = competitors.find((entry: Json) => entry?.homeAway === 'away');
      const home = competitors.find((entry: Json) => entry?.homeAway === 'home');
      const id = String(event?.id || competition?.id || '');
      const week = Number(event?.week?.number || competition?.week?.number);
      const awayTeam = normalizeTeam(away?.team?.abbreviation);
      const homeTeam = normalizeTeam(home?.team?.abbreviation);
      const kickoffAt = String(event?.date || competition?.date || '');
      const status = competition?.status || event?.status || {};
      if (!id || !Number.isInteger(week) || week < 1 || week > 18 || !awayTeam || !homeTeam || !kickoffAt) continue;
      games.set(id, {
        provider_game_id: `espn-${id}`,
        season: 2026,
        week_number: week,
        away_team: awayTeam,
        home_team: homeTeam,
        kickoff_at: kickoffAt,
        game_status: String(status?.type?.description || status?.type?.name || 'Scheduled'),
        is_final: Boolean(status?.type?.completed),
        source: 'espn_schedule',
      });
    }
  }
  return [...games.values()].sort((a, b) => a.week_number - b.week_number || a.kickoff_at.localeCompare(b.kickoff_at));
};

const validateSchedule = (games: Json[]) => {
  if (games.length !== 272) throw new Error(`Incomplete 2026 schedule: received ${games.length} of 272 games`);
  const counts = new Map<string, number>();
  for (const game of games) {
    counts.set(game.away_team, (counts.get(game.away_team) || 0) + 1);
    counts.set(game.home_team, (counts.get(game.home_team) || 0) + 1);
  }
  if (counts.size !== 32 || [...counts.values()].some(count => count !== 17)) {
    throw new Error('Incomplete 2026 schedule: every NFL team must have exactly 17 games');
  }
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  const team = normalizeTeam(req.query?.team);
  if (!/^[A-Z]{2,3}$/.test(team)) return res.status(400).json({ ok: false, error: 'A valid NFL team is required' });

  try {
    let payloads = [await fetchScoreboard()];
    let games = parseEvents(payloads);
    if (games.length !== 272) {
      payloads = await Promise.all(Array.from({ length: 18 }, (_, index) => fetchScoreboard(index + 1)));
      games = parseEvents(payloads);
    }
    validateSchedule(games);
    const teamGames = games.filter(game => game.away_team === team || game.home_team === team);
    if (teamGames.length !== 17) throw new Error(`Incomplete ${team} schedule: received ${teamGames.length} of 17 games`);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({ ok: true, season: 2026, team, games: teamGames });
  } catch (error: any) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ ok: false, error: error?.message || 'The verified 2026 schedule is unavailable' });
  }
}
