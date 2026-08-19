const ESPN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; BallKnower/1.0; +https://ballknower.app)',
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.espn.com/',
};

export default async function handler(_req: any, res: any) {
  try {
    const upstream = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=50', {
      headers: ESPN_HEADERS,
    });
    if (!upstream.ok) throw new Error(`NFL scoreboard upstream ${upstream.status}`);
    const data: any = await upstream.json();
    const games = (Array.isArray(data?.events) ? data.events : []).map((event: any, i: number) => {
      const comp = event?.competitions?.[0] || {};
      const competitors = Array.isArray(comp?.competitors) ? comp.competitors : [];
      const home = competitors.find((c: any) => c?.homeAway === 'home') || competitors[0] || {};
      const away = competitors.find((c: any) => c?.homeAway === 'away') || competitors[1] || {};
      const odds = Array.isArray(comp?.odds) ? comp.odds[0] : null;
      return {
        id: String(event?.id || i),
        date: event?.date || comp?.date || null,
        status: event?.status?.type?.shortDetail || event?.status?.type?.description || 'Scheduled',
        away: away?.team?.displayName || away?.team?.shortDisplayName || 'Away',
        home: home?.team?.displayName || home?.team?.shortDisplayName || 'Home',
        awayAbbr: away?.team?.abbreviation || null,
        homeAbbr: home?.team?.abbreviation || null,
        details: odds?.details || null,
        spread: typeof odds?.spread === 'number' ? odds.spread : null,
        overUnder: typeof odds?.overUnder === 'number' ? odds.overUnder : null,
      };
    });
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    res.status(200).json({ games });
  } catch (error: any) {
    console.error('nfl-sportsbook-error', error);
    res.status(502).json({ games: [], error: 'Unable to load NFL odds' });
  }
}
