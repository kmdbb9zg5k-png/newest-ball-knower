import { Player } from './types';

export type FantasyPlayerAvailability = {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  status: 'questionable' | 'out';
  label: 'Q' | 'OUT';
  injury: string;
  updatedAt: string;
};

type AvailabilityResponse = {
  available: boolean;
  stale: boolean;
  fetchedAt: string;
  players: FantasyPlayerAvailability[];
};

const normalizeName = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');
const normalizeTeam = (value: string) => ({ JAC: 'JAX', LA: 'LAR', WSH: 'WAS' }[value.toUpperCase()] || value.toUpperCase());
export const playerAvailabilityKey = (name: string, team: string) => `${normalizeName(name)}|${normalizeTeam(team)}`;

let cached: { expiresAt: number; response: AvailabilityResponse } | null = null;
let pending: Promise<AvailabilityResponse> | null = null;

export async function loadFantasyPlayerAvailability(): Promise<AvailabilityResponse> {
  if (cached && cached.expiresAt > Date.now()) return cached.response;
  if (pending) return pending;
  pending = fetch('/api/nfl-player-availability', { headers: { accept: 'application/json' } })
    .then(async response => {
      if (!response.ok) throw new Error('Player availability could not be loaded.');
      const payload = await response.json() as AvailabilityResponse;
      const safe: AvailabilityResponse = {
        available: Boolean(payload?.available),
        stale: Boolean(payload?.stale),
        fetchedAt: String(payload?.fetchedAt || ''),
        players: Array.isArray(payload?.players)
          ? payload.players.filter(player => player?.status === 'questionable' || player?.status === 'out')
          : [],
      };
      cached = { expiresAt: Date.now() + 4 * 60_000, response: safe };
      return safe;
    })
    .finally(() => { pending = null; });
  return pending;
}

export function availabilityForPlayer(player: Pick<Player, 'name' | 'team'> | undefined, byKey: ReadonlyMap<string, FantasyPlayerAvailability>) {
  return player ? byKey.get(playerAvailabilityKey(player.name, player.team)) : undefined;
}
