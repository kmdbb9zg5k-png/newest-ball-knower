const decodeEntities = (value: string) => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const tag = (xml: string, name: string) => {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return match ? decodeEntities(match[1].trim()) : '';
};

const sendUnavailable = (res: any, reason: string) => {
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
  res.status(200).json({ articles: [], available: false, warning: reason });
};

export default async function handler(_req: any, res: any) {
  try {
    const signal = AbortSignal.timeout(8000);
    const upstream = await fetch(
      'https://news.google.com/rss/search?q=NFL%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BallKnower/1.0; +https://vercel.app)' }, signal },
    );

    if (!upstream.ok) {
      console.warn('nfl-news-upstream-unavailable', upstream.status);
      return sendUnavailable(res, `NFL news feed temporarily unavailable (${upstream.status})`);
    }

    const xml = await upstream.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
    const articles = items.slice(0, 20).map((item: string, i: number) => {
      const headline = tag(item, 'title').replace(/\s+-\s+[^-]+$/, '').trim() || 'NFL Update';
      const source = tag(item, 'source');
      return {
        id: tag(item, 'guid') || String(i),
        headline,
        description: source ? `Source: ${source}` : '',
        published: tag(item, 'pubDate') || null,
        image: null,
        url: tag(item, 'link') || null,
      };
    });

    if (!articles.length) return sendUnavailable(res, 'NFL news feed returned no current articles');

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    res.status(200).json({ articles, available: true });
  } catch (error: any) {
    const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    console.warn('nfl-news-feed-degraded', timeout ? 'timeout' : String(error?.message || error));
    return sendUnavailable(res, timeout ? 'NFL news feed timed out' : 'NFL news feed temporarily unavailable');
  }
}
