import { list } from '@vercel/blob';

function cleanTitle(pathname: string) {
  return pathname
    .split('/').pop()!
    .replace(/\.(mp3|m4a|wav|aac|ogg)$/i, '')
    .replace(/[-_]?\(?remaster(?:ed)?[^)]*\)?/ig, '')
    .replace(/\(\d+\)$/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

export default async function handler(_req: any, res: any) {
  try {
    const { blobs } = await list({ limit: 1000 });
    const video = blobs.find(b => /\.(mp4|mov|webm)$/i.test(b.pathname));
    const audio = blobs.filter(b => /\.(mp3|m4a|wav|aac|ogg)$/i.test(b.pathname));

    // Deduplicate by cleaned title. Prefer a remastered upload when both exist.
    const byTitle = new Map<string, any>();
    for (const blob of audio) {
      const title = cleanTitle(blob.pathname);
      const prev = byTitle.get(title);
      const isRemaster = /remaster/i.test(blob.pathname);
      const prevIsRemaster = prev ? /remaster/i.test(prev.pathname) : false;
      if (!prev || (isRemaster && !prevIsRemaster)) byTitle.set(title, blob);
    }

    const tracks = Array.from(byTitle.entries()).map(([title, blob], index) => ({
      id: `blob-${index + 1}`,
      title,
      subtitle: 'Ball Knower Original Soundtrack',
      tempoBpm: 0,
      mood: 'Ball Knower',
      durationSec: 0,
      url: blob.url,
      pathname: blob.pathname,
    }));

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.status(200).json({
      introUrl: video?.url || null,
      introPathname: video?.pathname || null,
      tracks,
    });
  } catch (error: any) {
    console.error('media-library-error', error);
    res.status(500).json({ introUrl: null, tracks: [], error: 'Unable to load media library' });
  }
}
