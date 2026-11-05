import { list } from '@vercel/blob';

// Keep this predicate inside the serverless entrypoint. Vercel emits API files
// as native ESM, where an extensionless import outside /api fails at runtime.
const isRetiredSoundtrackTrack = (value: string) =>
  /from[-_ ]the[-_ ]a[-_ ]to[-_ ]south[-_ ]jersey/i.test(value);

const keepActiveSoundtrackTrack = (track: { title?: string; url?: string; pathname?: string }) =>
  !isRetiredSoundtrackTrack([track.title, track.url, track.pathname].filter(Boolean).join(' '));

const HIDDEN_TRACK_TITLES = new Set([
  'after party',
  'on the south',
]);

const BUNDLED_TRACKS = [
  ['Westbound Grind', '/audio/Westbound-Grind.mp3', false],
  ['Bloody Love', '/audio/Bloody-Love.mp3', false],
  ['G-O-A-T', '/audio/G-O-A-T.mp3', false],
  ['In My Blood', '/audio/In-My-Blood.mp3', false],
  ['Faded Pulse', '/audio/Faded-Pulse.mp3', false],
  ['Corner To Cleats', '/audio/Corner-To-Cleats.mp3', false],
  ['Low Tide Calling', '/audio/Low-Tide-Calling.mp3', false],
  ['Sahara Pulse', '/audio/Sahara-Pulse.mp3', false],
  ['Sunset on the Cut', '/audio/Sunset-on-the-Cut.mp3', false],
] as const;

function cleanTitle(pathname: string) {
  let title=pathname.split('/').pop()||'';
  try{title=decodeURIComponent(title);}catch{/* Keep a usable title if an upload contains a literal percent sign. */}
  title=title.replace(/\.(mp3|m4a|wav|aac|ogg)$/i,'').trim();
  // Copy markers and mastering/version suffixes can appear in either order.
  for(let pass=0;pass<4;pass++)title=title
    .replace(/\s*\(\d+\)\s*$/,'')
    .replace(/[-_\s]*[([]?(?:remaster(?:ed)?(?:[-_\s]*\d{2,4})?|v(?:ersion)?[-_\s]*\d+(?:\.\d+)*)[)\]]?\s*$/i,'').trim();
  return title
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

const titleKey=(title:string)=>title.toLowerCase().replace(/[^a-z0-9]+/g,'');

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
      if (!title || HIDDEN_TRACK_TITLES.has(title.toLowerCase()) || isRetiredSoundtrackTrack(`${title} ${blob.pathname}`)) continue;

      const key=titleKey(title),prev = byTitle.get(key)?.blob;
      const isRemaster = /remaster/i.test(blob.pathname);
      const prevIsRemaster = prev ? /remaster/i.test(prev.pathname) : false;
      if (!prev || (isRemaster && !prevIsRemaster)) byTitle.set(key, {title,blob});
    }

    const tracks = Array.from(byTitle.values()).map(({title,blob}) => ({
      id: `blob-${titleKey(title)}`,
      title,
      subtitle: 'Ball Knower Original Soundtrack',
      tempoBpm: 0,
      mood: 'Ball Knower',
      durationSec: 0,
      url: blob.url,
      pathname: blob.pathname,
    }));

    for (const [title, url, manualOnly] of BUNDLED_TRACKS) {
      const existing = tracks.findIndex(track => titleKey(track.title) === titleKey(title));
      const bundled = {
        id: `bundled-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        title,
        subtitle: 'Ball Knower Original Soundtrack',
        tempoBpm: 0,
        mood: 'Ball Knower',
        durationSec: 0,
        url,
        pathname: url,
        manualOnly,
      };
      if (existing >= 0) tracks[existing] = bundled;
      else tracks.push(bundled);
    }

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.status(200).json({
      introUrl: video?.url || null,
      introPathname: video?.pathname || null,
      tracks: tracks.filter(keepActiveSoundtrackTrack),
    });
  } catch (error: any) {
    console.error('media-library-error', error);
    res.status(500).json({ introUrl: null, tracks: [], error: 'Unable to load media library' });
  }
}
