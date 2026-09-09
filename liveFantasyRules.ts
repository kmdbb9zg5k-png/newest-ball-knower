import { Player } from './types';

export const LIVE_FANTASY_DRAFT_GROUPS = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'] as const;

export type LiveFantasyDraftGroup = typeof LIVE_FANTASY_DRAFT_GROUPS[number];

const LIVE_FANTASY_DRAFT_GROUP_SET = new Set<string>(LIVE_FANTASY_DRAFT_GROUPS);

export function isLiveFantasyDraftGroup(value: unknown): value is LiveFantasyDraftGroup {
  return typeof value === 'string' && LIVE_FANTASY_DRAFT_GROUP_SET.has(value);
}

export function filterLiveFantasyPositionRows<T extends { position: unknown }>(rows: T[]): Array<T & { position: LiveFantasyDraftGroup }> {
  return rows.filter((row): row is T & { position: LiveFantasyDraftGroup } => isLiveFantasyDraftGroup(row.position));
}

/** Standard starting-lineup minimums. The remaining roster spots are a flexible bench. */
export const LIVE_FANTASY_ROSTER_REQUIREMENTS = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  K: 1,
  DST: 1,
} as const satisfies Record<LiveFantasyDraftGroup, number>;

/** CPU-only construction targets. Human managers may draft any 15 eligible players. */
export const CPU_LIVE_FANTASY_POSITION_LIMITS = {
  QB: 2,
  RB: 5,
  WR: 7,
  TE: 2,
  K: 2,
  DST: 2,
} as const satisfies Record<LiveFantasyDraftGroup, number>;

export function getLiveFantasyDraftGroup(player: Player): LiveFantasyDraftGroup | null {
  return isLiveFantasyDraftGroup(player.position) ? player.position : null;
}

export function validateLiveFantasyRoster(roster: Player[]): string[] {
  const errors:string[]=[];
  roster.forEach(player => {
    const group=getLiveFantasyDraftGroup(player);
    if(!group){errors.push(`${player.name} is not eligible for this fantasy draft.`);return;}
  });
  return errors;
}
