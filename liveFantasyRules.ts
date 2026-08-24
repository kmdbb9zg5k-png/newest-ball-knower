import { Player } from './types';

/** Standard starting-lineup minimums. The remaining roster spots are a flexible bench. */
export const LIVE_FANTASY_ROSTER_REQUIREMENTS = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  K: 1,
  DST: 1,
} as const;

/** Guardrails prevent unusable rosters without forcing a position-by-position final shape. */
export const LIVE_FANTASY_POSITION_LIMITS = {
  QB: 3,
  RB: 8,
  WR: 8,
  TE: 4,
  K: 2,
  DST: 2,
} as const;

export type LiveFantasyDraftGroup = keyof typeof LIVE_FANTASY_ROSTER_REQUIREMENTS;

export function getLiveFantasyDraftGroup(player: Player): LiveFantasyDraftGroup | null {
  if (player.position === 'QB' || player.position === 'RB' || player.position === 'WR' || player.position === 'TE' || player.position === 'K' || player.position === 'DST') return player.position;
  return null;
}

export function validateLiveFantasyRoster(roster: Player[]): string[] {
  const counts: Partial<Record<LiveFantasyDraftGroup, number>> = {};
  roster.forEach(player => { const group=getLiveFantasyDraftGroup(player); if(group)counts[group]=(counts[group]||0)+1; });
  return (Object.entries(LIVE_FANTASY_ROSTER_REQUIREMENTS) as [LiveFantasyDraftGroup,number][])
    .flatMap(([group,required])=>(counts[group]||0)>=required?[]:[`Needs ${required-(counts[group]||0)} more ${group}.`]);
}
