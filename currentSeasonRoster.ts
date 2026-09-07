import type { Player } from './types';
import source from './data/independent-football-inputs.json';
import starters from './data/current-qb-starters.json';
import { playerFromIndependentInput, type FootballInput } from './independentPlayerRatings';
export { estimatePlayerSalary } from './independentPlayerRatings';
export const CURRENT_2026_QB_STARTERS:Record<string,string>=starters;
export const INDEPENDENT_FOOTBALL_INPUTS=source as FootballInput[];
// The argument is retained for old integrations; legacy ratings never enter the model.
export function applyCurrent2026Roster(_legacyPlayers?:Player[]):Player[]{
  return INDEPENDENT_FOOTBALL_INPUTS.filter(player=>player.active).map(playerFromIndependentInput);
}
export function known2026Players():Player[]{
  return INDEPENDENT_FOOTBALL_INPUTS.map(playerFromIndependentInput);
}
