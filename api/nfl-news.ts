const ESPN_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; BallKnower/1.0; +https://ballknower.app)',
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://www.espn.com/',
};

export default async function handler(_req: any, res: any) {
  try {
    const upstream = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?limit=20', {
      headers: ESPN_HEADERS,
    });
    if (!upstream.ok) throw new Error(`NFL news upstream ${upstream.status}`);
    const data: any = await upstream.json();
    const articles = (Array.isArray(data?.articles) ? data.articles : []).map((a: any, i: number) => ({
      id: String(a?.id || a?.nowId || i),
      headline: a?.headline || a?.title || 'NFL Update',
      description: a?.description || '',
      published: a?.published || a?.lastModified || null,
      image: a?.images?.[0]?.url || a?.image?.url || null,
      url: a?.links?.web?.href || a?.links?.api?.news?.href || null,
    }));
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    res.status(200).json({ articles });
  } catch (error: any) {
    console.error('nfl-news-error', error);
    res.status(502).json({ articles: [], error: 'Unable to load NFL news' });
  }
}
