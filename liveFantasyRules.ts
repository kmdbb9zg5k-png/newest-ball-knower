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

/** Every position stays available through the final pick; roster size is the only practical cap. */
export const LIVE_FANTASY_POSITION_LIMITS = {
  QB: 20,
  RB: 20,
  WR: 20,
  TE: 20,
  K: 20,
  DST: 20,
} as const;

export type LiveFantasyDraftGroup = keyof typeof LIVE_FANTASY_ROSTER_REQUIREMENTS;

export function getLiveFantasyDraftGroup(player: Player): LiveFantasyDraftGroup | null {
  if (player.position === 'QB' || player.position === 'RB' || player.position === 'WR' || player.position === 'TE' || player.position === 'K' || player.position === 'DST') return player.position;
  return null;
}

export function validateLiveFantasyRoster(roster: Player[]): string[] {
  const counts: Partial<Record<LiveFantasyDraftGroup, number>> = {};
  const errors:string[]=[];
  roster.forEach(player => {
    const group=getLiveFantasyDraftGroup(player);
    if(!group){errors.push(`${player.name} is not eligible for this fantasy draft.`);return;}
    counts[group]=(counts[group]||0)+1;
  });
  for(const [group,limit] of Object.entries(LIVE_FANTASY_POSITION_LIMITS) as [LiveFantasyDraftGroup,number][]){
    if((counts[group]||0)>limit)errors.push(`Too many ${group} players (${counts[group]}/${limit}).`);
  }
  for(const [group,minimum] of Object.entries(LIVE_FANTASY_ROSTER_REQUIREMENTS) as [LiveFantasyDraftGroup,number][]){
    if((counts[group]||0)<minimum) errors.push(`Need ${minimum} ${group} player${minimum === 1 ? '' : 's'} (${counts[group]||0}/${minimum}).`);
  }
  return errors;
}
