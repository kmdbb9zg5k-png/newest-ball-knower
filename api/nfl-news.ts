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

export default async function handler(_req: any, res: any) {
  try {
    const upstream = await fetch(
      'https://news.google.com/rss/search?q=NFL%20when%3A1d&hl=en-US&gl=US&ceid=US%3Aen',
      { headers: { 'User-Agent': 'BallKnower/1.0 (+https://vercel.app)' } },
    );
    if (!upstream.ok) throw new Error(`NFL news upstream ${upstream.status}`);

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

    if (!articles.length) throw new Error('NFL news upstream returned no articles');

    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600');
    res.status(200).json({ articles });
  } catch (error: any) {
    console.error('nfl-news-error', error);
    res.status(502).json({ articles: [], error: 'Unable to load NFL news' });
  }
}
