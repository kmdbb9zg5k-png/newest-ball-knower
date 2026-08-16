import { Player, PositionGroup, ROSTER_REQUIREMENTS } from '../types';

export type DraftPositionGroup = keyof typeof ROSTER_REQUIREMENTS;

const GROUP_POSITIONS: Record<DraftPositionGroup, string[]> = {
  QB: ['QB'],
  RB: ['RB', 'FB'],
  WR: ['WR'],
  TE: ['TE'],
  OL: ['OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'C'],
  DL_EDGE: ['EDGE', 'DE', 'DT', 'NT'],
  LB: ['LB'],
  CB: ['CB'],
  S: ['S', 'FS', 'SS'],
  K: ['K'],
  P: ['P'],
};

export function getDraftPositionGroup(player: Player): DraftPositionGroup | null {
  const entry = (Object.entries(GROUP_POSITIONS) as [DraftPositionGroup, string[]][])
    .find(([, positions]) => positions.includes(player.position));
  return entry?.[0] ?? null;
}

export function countRosterGroups(roster: Player[]) {
  const counts: Record<DraftPositionGroup, number> = {
    QB: 0, RB: 0, WR: 0, TE: 0, OL: 0, DL_EDGE: 0, LB: 0, CB: 0, S: 0, K: 0, P: 0,
  };
  roster.forEach(player => {
    const group = getDraftPositionGroup(player);
    if (group) counts[group] += 1;
  });
  return { ...counts, total: roster.length };
}

export function getRosterNeeds(roster: Player[]) {
  const counts = countRosterGroups(roster);
  return (Object.entries(ROSTER_REQUIREMENTS) as [DraftPositionGroup, number][])
    .map(([group, required]) => ({ group, required, current: counts[group], needed: Math.max(0, required - counts[group]) }))
    .filter(item => item.needed > 0);
}

/**
 * Calculates the cheapest legal way to finish the roster from the remaining player pool.
 * This prevents a drafter from spending so much that a valid 20-man roster becomes impossible.
 */
export function minimumCompletionCost(roster: Player[], playerPool: Player[]): number {
  const selectedIds = new Set(roster.map(p => p.id));
  let cost = 0;
  for (const need of getRosterNeeds(roster)) {
    const candidates = playerPool
      .filter(p => !selectedIds.has(p.id) && getDraftPositionGroup(p) === need.group)
      .sort((a, b) => a.salary - b.salary)
      .slice(0, need.needed);
    if (candidates.length < need.needed) return Number.POSITIVE_INFINITY;
    cost += candidates.reduce((sum, p) => sum + p.salary, 0);
  }
  return cost;
}

export function validateRosterShape(roster: Player[]): string[] {
  const counts = countRosterGroups(roster);
  const errors: string[] = [];
  for (const [group, required] of Object.entries(ROSTER_REQUIREMENTS) as [DraftPositionGroup, number][]) {
    if (counts[group] < required) errors.push(`Needs ${required - counts[group]} ${group}.`);
    if (counts[group] > required) errors.push(`Too many ${group} (${counts[group]}/${required}).`);
  }
  return errors;
}
