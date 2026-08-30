export type FranchiseDraftPick = {
  year: number;
  round: number;
  originalTeam: string;
  ownerTeam: string;
};

export const franchiseDraftPickKey = (pick: FranchiseDraftPick) => `${pick.year}:${pick.originalTeam}:${pick.round}`;

export const franchiseDraftRounds = [1, 2, 3, 4, 5, 6, 7] as const;

export function createFranchiseDraftPicks(year: number, teams: string[]): FranchiseDraftPick[] {
  return teams.flatMap(team => franchiseDraftRounds.map(round => ({ year, round, originalTeam: team, ownerTeam: team })));
}

export function normalizeFranchiseDraftPicks(value: unknown, userTeam: string, firstYear = 2027): FranchiseDraftPick[] {
  if (Array.isArray(value)) {
    const valid = value.filter((pick): pick is FranchiseDraftPick => Boolean(
      pick && typeof pick === 'object'
      && Number.isInteger(Number((pick as FranchiseDraftPick).year))
      && Number((pick as FranchiseDraftPick).year) >= firstYear
      && franchiseDraftRounds.includes(Number((pick as FranchiseDraftPick).round) as typeof franchiseDraftRounds[number])
      && typeof (pick as FranchiseDraftPick).originalTeam === 'string'
      && typeof (pick as FranchiseDraftPick).ownerTeam === 'string'
    )).map(pick => ({ ...pick, year: Number(pick.year), round: Number(pick.round) }));
    if (valid.length) return valid;
  }
  return createFranchiseDraftPicks(firstYear, [userTeam]);
}

export function ensureFranchiseDraftYear(picks: FranchiseDraftPick[], year: number, teams: string[]) {
  const existing = new Set(picks.filter(pick => pick.year === year).map(pick => `${pick.originalTeam}:${pick.round}`));
  return [...picks, ...createFranchiseDraftPicks(year, teams).filter(pick => !existing.has(`${pick.originalTeam}:${pick.round}`))];
}

export function transferFranchiseDraftPicks(
  picks: FranchiseDraftPick[],
  ownerTeam: string,
  newOwnerTeam: string,
  year: number,
  pickKeys: string[],
) {
  const selected = new Set(pickKeys);
  return picks.map(pick => pick.year === year && pick.ownerTeam === ownerTeam && selected.has(franchiseDraftPickKey(pick))
    ? { ...pick, ownerTeam: newOwnerTeam }
    : pick);
}

export const ownedFranchiseDraftRounds = (picks: FranchiseDraftPick[], team: string, year: number) =>
  picks.filter(pick => pick.year === year && pick.ownerTeam === team).map(pick => pick.round).sort((a, b) => a - b);

export const ownedFranchiseDraftPicks = (picks: FranchiseDraftPick[], team: string, year: number) =>
  picks.filter(pick => pick.year === year && pick.ownerTeam === team)
    .sort((a, b) => a.round - b.round || a.originalTeam.localeCompare(b.originalTeam));
