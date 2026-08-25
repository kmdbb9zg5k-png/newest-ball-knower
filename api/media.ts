import { list } from '@vercel/blob';

const HIDDEN_TRACK_TITLES = new Set([
  'After Party',
  'On The South',
]);

const BUNDLED_TRACKS = [
  ['From the A to South Jersey', '/audio/From-the-A-to-South-Jersey-full-v4.mp3'],
  ['Westbound Grind', '/audio/Westbound-Grind.mp3'],
  ['Bloody Love', '/audio/Bloody-Love.mp3'],
  ['G-O-A-T', '/audio/G-O-A-T.mp3'],
  ['In My Blood', '/audio/In-My-Blood.mp3'],
  ['Faded Pulse', '/audio/Faded-Pulse.mp3'],
  ['Corner To Cleats', '/audio/Corner-To-Cleats.mp3'],
  ['Low Tide Calling', '/audio/Low-Tide-Calling.mp3'],
  ['Sahara Pulse', '/audio/Sahara-Pulse.mp3'],
  ['Sunset on the Cut', '/audio/Sunset-on-the-Cut.mp3'],
] as const;

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
    // Some tracks can stay safely archived in Blob while being hidden from the app playlist.
    const byTitle = new Map<string, any>();
    for (const blob of audio) {
      const title = cleanTitle(blob.pathname);
      if (HIDDEN_TRACK_TITLES.has(title)) continue;

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

    for (const [title, url] of BUNDLED_TRACKS) {
      const existing = tracks.findIndex(track => track.title.toLowerCase() === title.toLowerCase());
      const bundled = {
        id: `bundled-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title,
        subtitle: 'Ball Knower Original Soundtrack',
        tempoBpm: 0,
        mood: 'Ball Knower',
        durationSec: 0,
        url,
        pathname: url,
      };
      if (existing >= 0) tracks[existing] = bundled;
      else tracks.push(bundled);
    }

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
