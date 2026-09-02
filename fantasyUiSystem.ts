export type FantasyOwnership = "mine" | "opponent" | "free_agent" | "waiver";

export type FantasyPlayerAction = {
  kind: "manage" | "trade" | "add" | "claim";
  label: string;
};

export const fantasyPlayerAction = (
  ownership: FantasyOwnership,
  playerName = "PLAYER",
): FantasyPlayerAction => {
  if (ownership === "mine") return { kind: "manage", label: "MANAGE LINEUP" };
  if (ownership === "opponent") {
    return { kind: "trade", label: `TRADE FOR ${playerName.toUpperCase()}` };
  }
  if (ownership === "waiver") return { kind: "claim", label: "CLAIM" };
  return { kind: "add", label: "ADD" };
};

export const fantasyAvailability = (
  freeAgentMode?: string,
): Extract<FantasyOwnership, "free_agent" | "waiver"> =>
  freeAgentMode === "continuous" ? "waiver" : "free_agent";

export const lineupChangeCount = (
  saved: Record<string, string> | undefined,
  current: Record<string, string>,
) => {
  const slots = new Set([...Object.keys(saved || {}), ...Object.keys(current)]);
  let changed = 0;
  slots.forEach((slot) => {
    if ((saved?.[slot] || "") !== (current[slot] || "")) changed += 1;
  });
  return changed;
};

export type FantasyPowerInput = {
  memberId: string;
  memberName: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  rosterProjection: number;
  injuryCount: number;
};

export type FantasyPowerRow = FantasyPowerInput & {
  rank: number;
  score: number;
};

const normalized = (value: number, values: number[], fallback = 50) => {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return fallback;
  const low = Math.min(...finite);
  const high = Math.max(...finite);
  return high === low ? fallback : ((value - low) / (high - low)) * 100;
};

export const buildFantasyPowerRankings = (
  inputs: FantasyPowerInput[],
): FantasyPowerRow[] => {
  const projections = inputs.map((row) => row.rosterProjection);
  const pointsPerGame = inputs.map((row) => {
    const played = row.wins + row.losses + row.ties;
    return played ? row.pointsFor / played : 0;
  });
  const marginsPerGame = inputs.map((row) => {
    const played = row.wins + row.losses + row.ties;
    return played ? (row.pointsFor - row.pointsAgainst) / played : 0;
  });

  return inputs
    .map((row, index) => {
      const played = row.wins + row.losses + row.ties;
      const record = played ? ((row.wins + row.ties * 0.5) / played) * 100 : 50;
      const projection = normalized(row.rosterProjection, projections);
      const scoring = normalized(pointsPerGame[index], pointsPerGame);
      const performance = normalized(marginsPerGame[index], marginsPerGame);
      const availabilityPenalty = Math.min(12, Math.max(0, row.injuryCount) * 2.5);
      const score = Math.max(
        0,
        Math.min(
          100,
          projection * 0.4 + record * 0.28 + scoring * 0.2 + performance * 0.12 - availabilityPenalty,
        ),
      );
      return { ...row, rank: 0, score: Math.round(score * 10) / 10 };
    })
    .sort((a, b) => b.score - a.score || b.pointsFor - a.pointsFor || a.memberName.localeCompare(b.memberName))
    .map((row, index) => ({ ...row, rank: index + 1 }));
};
