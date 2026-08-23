import { Player } from './types';

export const LIVE_FANTASY_ROSTER_REQUIREMENTS = {
  QB: 2,
  RB: 5,
  WR: 6,
  TE: 3,
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
    .flatMap(([group,required])=>(counts[group]||0)===required?[]:[`Needs exactly ${required} ${group} (${counts[group]||0}/${required}).`]);
}
