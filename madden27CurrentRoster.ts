import { Player, Position } from './types';
import { MADDEN_27_ROSTER_CHUNK_1 } from './madden27RosterChunk1';
import { MADDEN_27_ROSTER_CHUNK_2 } from './madden27RosterChunk2';
import { MADDEN_27_ROSTER_CHUNK_3 } from './madden27RosterChunk3';
import { MADDEN_27_ROSTER_CHUNK_4 } from './madden27RosterChunk4';
import { MADDEN_27_ROSTER_CHUNK_5 } from './madden27RosterChunk5';
import { MADDEN_27_ROSTER_CHUNK_6 } from './madden27RosterChunk6';
import { MADDEN_27_ROSTER_CHUNK_7 } from './madden27RosterChunk7';
import { MADDEN_27_ROSTER_CHUNK_8 } from './madden27RosterChunk8';

export interface Madden27RosterEntry { eaId: number; name: string; team: string; overallRating: number; position: Position; avatarUrl: string }

// Generated from all 24 pages of EA SPORTS Madden NFL 27 launch ratings on 2026-08-19.
export const MADDEN_27_CURRENT_PLAYERS: Madden27RosterEntry[] = [
  ...MADDEN_27_ROSTER_CHUNK_1,
  ...MADDEN_27_ROSTER_CHUNK_2,
  ...MADDEN_27_ROSTER_CHUNK_3,
  ...MADDEN_27_ROSTER_CHUNK_4,
  ...MADDEN_27_ROSTER_CHUNK_5,
  ...MADDEN_27_ROSTER_CHUNK_6,
  ...MADDEN_27_ROSTER_CHUNK_7,
  ...MADDEN_27_ROSTER_CHUNK_8,
];

const BY_EA_ID = new Map(MADDEN_27_CURRENT_PLAYERS.map(player => [player.eaId, player]));
const BY_NAME = new Map<string, Madden27RosterEntry[]>();
for (const player of MADDEN_27_CURRENT_PLAYERS) {
  const key = normalizeMaddenRosterName(player.name);
  BY_NAME.set(key, [...(BY_NAME.get(key) || []), player]);
}

export function normalizeMaddenRosterName(name: string): string {
  return name.toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/[^a-z0-9]/g, '');
}

export function getMadden27RosterEntry(player: Pick<Player, 'id' | 'name' | 'position'>): Madden27RosterEntry | undefined {
  const eaId = player.id.startsWith('ea-') ? Number(player.id.slice(3)) : NaN;
  if (Number.isFinite(eaId) && BY_EA_ID.has(eaId)) return BY_EA_ID.get(eaId);
  const matches = BY_NAME.get(normalizeMaddenRosterName(player.name)) || [];
  return matches.find(match => match.position === player.position) || matches[0];
}
