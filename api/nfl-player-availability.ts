const INJURIES_URL = 'https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/injuries';
const CACHE_MS = 5 * 60_000;
const MAX_STALE_MS = 30 * 60_000;
const MAX_RESPONSE_BYTES = 12_000_000;

// ESPN's league-wide report is large and can take longer than eight seconds on
// a cold serverless connection. Keep the function bounded, but leave enough
// room to receive and normalize the authoritative report before failing closed.
export const maxDuration = 30;

type AvailabilityStatus = 'questionable' | 'out';
type Json = Record<string, any>;

export type PlayerAvailability = {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  status: AvailabilityStatus;
  label: 'Q' | 'OUT';
  injury: string;
  updatedAt: string;
};

type AvailabilityPayload = {
  available: boolean;
  source: 'ESPN injury report';
  fetchedAt: string;
  stale: boolean;
  players: PlayerAvailability[];
};

const TEAM_ALIASES: Record<string, string> = { JAC: 'JAX', LA: 'LAR', WSH: 'WAS' };
const clean = (value: unknown, max = 120) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const teamCode = (value: unknown) => {
  const code = clean(value, 4).toUpperCase();
  return TEAM_ALIASES[code] || code;
};
const validIso = (value: unknown, fallback: string) => {
  const date = new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? date.toISOString() : fallback;
};

export function normalizeAvailabilityStatus(value: unknown): AvailabilityStatus | null {
  const status = clean(value, 48).toUpperCase().replace(/[._-]+/g, ' ');
  if (status === 'Q' || status.includes('QUESTIONABLE')) return 'questionable';
  if (
    status === 'O' ||
    status === 'OUT' ||
    status === 'IR' ||
    status.includes('INJURED RESERVE') ||
    status === 'PUP' ||
    status.includes('PHYSICALLY UNABLE') ||
    status === 'NFI' ||
    status.includes('NON FOOTBALL INJURY') ||
    status.includes('SUSPEND')
  ) return 'out';
  return null;
}

const availabilityRank = (status: AvailabilityStatus) => status === 'out' ? 2 : 1;

export function normalizeAvailabilityReports(reports: unknown[], fetchedAt = new Date().toISOString()): PlayerAvailability[] {
  const byPlayer = new Map<string, PlayerAvailability>();
  for (const report of reports) {
    const teamReports = Array.isArray((report as Json)?.injuries) ? (report as Json).injuries : [];
    for (const teamReport of teamReports) {
      const injuries = Array.isArray(teamReport?.injuries) ? teamReport.injuries : [];
      for (const row of injuries) {
        const team = teamCode(teamReport?.team?.abbreviation || row?.athlete?.team?.abbreviation);
        const fantasyStatus = row?.details?.fantasyStatus;
        const rawStatus = fantasyStatus?.abbreviation || fantasyStatus?.displayDescription || row?.type?.abbreviation || row?.type?.description || row?.status;
        const status = normalizeAvailabilityStatus(rawStatus);
        const playerName = clean(row?.athlete?.displayName || row?.athlete?.fullName);
        if (!status || !playerName || !team) continue;
        const player: PlayerAvailability = {
          playerId: clean(row?.athlete?.id, 40),
          playerName,
          team,
          position: clean(row?.athlete?.position?.abbreviation, 8).toUpperCase(),
          status,
          label: status === 'out' ? 'OUT' : 'Q',
          injury: clean(row?.details?.type || row?.details?.location, 64).replace(/^Not Specified$/i, ''),
          updatedAt: validIso(row?.date, fetchedAt),
        };
        const key = `${playerName.toLowerCase()}|${team}`;
        const existing = byPlayer.get(key);
        if (!existing || player.updatedAt > existing.updatedAt || (player.updatedAt === existing.updatedAt && availabilityRank(player.status) > availabilityRank(existing.status))) {
          byPlayer.set(key, player);
        }
      }
    }
  }
  return [...byPlayer.values()].sort((a, b) => a.team.localeCompare(b.team) || a.playerName.localeCompare(b.playerName));
}

const fetchJson = async (request: typeof fetch, url: string) => {
  const response = await request(url, {
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      referer: 'https://www.espn.com/',
      'user-agent': 'Mozilla/5.0 (compatible; BallKnower/1.0; +https://ballknowerofficial.com)',
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`availability upstream ${response.status}`);
  const raw = await response.text();
  if (raw.length > MAX_RESPONSE_BYTES) throw new Error('availability upstream response too large');
  return JSON.parse(raw) as Json;
};

export function createAvailabilityHandler(deps: { fetchImpl?: typeof fetch; now?: () => number } = {}) {
  const request = deps.fetchImpl || fetch;
  const now = deps.now || (() => Date.now());
  let cached: { expiresAt: number; payload: AvailabilityPayload } | null = null;
  let pending: Promise<AvailabilityPayload> | null = null;

  return async function handler(req: any, res: any) {
    if (req.method && req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
      if (cached && cached.expiresAt > now()) {
        res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60, stale-while-revalidate=300');
        return res.status(200).json(cached.payload);
      }
      if (!pending) pending = (async () => {
        const report = await fetchJson(request, INJURIES_URL);
        if (!Array.isArray(report?.injuries) || !report.injuries.length) throw new Error('availability reports unavailable');
        const fetchedAt = new Date(now()).toISOString();
        const payload: AvailabilityPayload = {
          available: true,
          source: 'ESPN injury report',
          fetchedAt,
          stale: false,
          players: normalizeAvailabilityReports([report], fetchedAt),
        };
        cached = { expiresAt: now() + CACHE_MS, payload };
        return payload;
      })().finally(() => { pending = null; });
      const payload = await pending;
      res.setHeader('Cache-Control', 'public, s-maxage=300, max-age=60, stale-while-revalidate=300');
      return res.status(200).json(payload);
    } catch (error) {
      console.warn('NFL availability refresh failed', error instanceof Error ? error.message : 'unknown error');
      if (cached && now() - Date.parse(cached.payload.fetchedAt) <= MAX_STALE_MS) {
        return res.status(200).json({ ...cached.payload, stale: true });
      }
      res.setHeader('Cache-Control', 'public, s-maxage=30, max-age=0');
      return res.status(200).json({ available: false, source: 'ESPN injury report', fetchedAt: new Date(now()).toISOString(), stale: false, players: [] });
    }
  };
}

export default createAvailabilityHandler();
