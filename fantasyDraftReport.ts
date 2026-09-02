export type FantasyDraftReportPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';

export type FantasyDraftReportPick = {
  overall: number;
  playerName: string;
  position: FantasyDraftReportPosition;
  projectedPoints: number | null;
  overallRank: number | null;
};

export type FantasyDraftReportTeam = {
  memberId: string;
  picks: FantasyDraftReportPick[];
};

export type FantasyDraftReport = {
  memberId: string;
  letter: string;
  score: number;
  projectedWins: number;
  projectedLosses: number;
  projectionRank: number;
  projectionScore: number;
  constructionScore: number;
  valueScore: number;
  projectionCoverage: number;
  explanation: string;
};

type TeamSnapshot = {
  input: FantasyDraftReportTeam;
  strength: number;
  constructionScore: number;
  valueScore: number;
  projectionCoverage: number;
  bestValuePlayer: string | null;
};

const STARTER_REQUIREMENTS: Record<FantasyDraftReportPosition, number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  K: 1,
  DST: 1,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const letterForScore = (score: number) =>
  score >= 97 ? 'A+' :
  score >= 93 ? 'A' :
  score >= 90 ? 'A-' :
  score >= 87 ? 'B+' :
  score >= 83 ? 'B' :
  score >= 80 ? 'B-' :
  score >= 77 ? 'C+' :
  score >= 73 ? 'C' :
  score >= 70 ? 'C-' :
  score >= 60 ? 'D' : 'F';

const projectionFor = (pick: FantasyDraftReportPick) => {
  const value = Number(pick.projectedPoints);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const buildSnapshot = (input: FantasyDraftReportTeam): TeamSnapshot => {
  const byPosition = new Map<FantasyDraftReportPosition, FantasyDraftReportPick[]>();
  (Object.keys(STARTER_REQUIREMENTS) as FantasyDraftReportPosition[]).forEach(position => byPosition.set(position, []));
  input.picks.forEach(pick => byPosition.get(pick.position)?.push(pick));
  byPosition.forEach(picks => picks.sort((a, b) => projectionFor(b) - projectionFor(a) || a.overall - b.overall));

  const starterPicks: FantasyDraftReportPick[] = [];
  const chosen = new Set<FantasyDraftReportPick>();
  (Object.keys(STARTER_REQUIREMENTS) as FantasyDraftReportPosition[]).forEach(position => {
    const required = STARTER_REQUIREMENTS[position];
    const picks = byPosition.get(position) || [];
    for (let index = 0; index < Math.min(required, picks.length); index += 1) {
      starterPicks.push(picks[index]);
      chosen.add(picks[index]);
    }
  });

  const flex = input.picks
    .filter(pick => !chosen.has(pick) && (pick.position === 'RB' || pick.position === 'WR' || pick.position === 'TE'))
    .sort((a, b) => projectionFor(b) - projectionFor(a) || a.overall - b.overall)[0];
  if (flex) {
    starterPicks.push(flex);
    chosen.add(flex);
  }

  const starterProjection = starterPicks.reduce((sum, pick) => sum + projectionFor(pick), 0);
  const depthProjection = input.picks
    .filter(pick => !chosen.has(pick))
    .reduce((sum, pick) => {
      const weight = pick.position === 'RB' || pick.position === 'WR'
        ? 0.12
        : pick.position === 'TE'
          ? 0.08
          : pick.position === 'QB'
            ? 0.04
            : 0.01;
      return sum + projectionFor(pick) * weight;
    }, 0);
  const strength = starterProjection + depthProjection;

  const counts = input.picks.reduce<Partial<Record<FantasyDraftReportPosition, number>>>((result, pick) => {
    result[pick.position] = (result[pick.position] || 0) + 1;
    return result;
  }, {});
  const missingBaseStarters = (Object.keys(STARTER_REQUIREMENTS) as FantasyDraftReportPosition[])
    .reduce((sum, position) => sum + Math.max(0, STARTER_REQUIREMENTS[position] - (counts[position] || 0)), 0);
  const skillCount = (counts.RB || 0) + (counts.WR || 0) + (counts.TE || 0);
  const flexMissing = skillCount >= 6 ? 0 : 1;
  const extraSpecialTeams = Math.max(0, (counts.K || 0) - 1) + Math.max(0, (counts.DST || 0) - 1);
  const extraQuarterbacks = Math.max(0, (counts.QB || 0) - 2);
  const skillDepth = Math.max(0, (counts.RB || 0) - 2) + Math.max(0, (counts.WR || 0) - 2) + Math.max(0, (counts.TE || 0) - 1);
  const depthBonus = Math.min(8, skillDepth * 1.5);
  const constructionScore = clamp(
    Math.round(90 + depthBonus - (missingBaseStarters + flexMissing) * 20 - extraSpecialTeams * 7 - extraQuarterbacks * 4),
    55,
    98,
  );

  const rankedPicks = input.picks.filter(pick => Number.isFinite(Number(pick.overallRank)) && Number(pick.overallRank) > 0);
  const valueDeltas = rankedPicks.map(pick => clamp(pick.overall - Number(pick.overallRank), -30, 30));
  const averageValue = valueDeltas.length
    ? valueDeltas.reduce((sum, value) => sum + value, 0) / valueDeltas.length
    : 0;
  const valueScore = clamp(Math.round(82 + averageValue * 0.45), 55, 98);
  const bestValue = rankedPicks
    .map(pick => ({ pick, value: pick.overall - Number(pick.overallRank) }))
    .sort((a, b) => b.value - a.value || a.pick.overall - b.pick.overall)[0];
  const bestValuePlayer = bestValue && bestValue.value >= 5 ? bestValue.pick.playerName : null;
  const projectionCoverage = input.picks.length
    ? input.picks.filter(pick => projectionFor(pick) > 0).length / input.picks.length
    : 0;

  return {
    input,
    strength,
    constructionScore,
    valueScore,
    projectionCoverage,
    bestValuePlayer,
  };
};

export const buildFantasyDraftReports = (
  teams: FantasyDraftReportTeam[],
  regularSeasonGames: number,
): Map<string, FantasyDraftReport> => {
  const snapshots = teams.map(buildSnapshot);
  const result = new Map<string, FantasyDraftReport>();
  if (!snapshots.length) return result;

  const games = Math.max(1, Math.round(regularSeasonGames));
  const strengths = snapshots.map(snapshot => snapshot.strength);
  const meanStrength = strengths.reduce((sum, value) => sum + value, 0) / strengths.length;
  const variance = strengths.reduce((sum, value) => sum + (value - meanStrength) ** 2, 0) / strengths.length;
  const standardDeviation = Math.sqrt(variance);
  const probabilityScale = Math.max(1, standardDeviation * 1.35);
  const ranked = [...snapshots].sort((a, b) => b.strength - a.strength || a.input.memberId.localeCompare(b.input.memberId));
  const projectionRanks = new Map(ranked.map((snapshot, index) => [snapshot.input.memberId, index + 1]));

  const rawWins = snapshots.map(snapshot => {
    if (snapshots.length === 1) return games / 2;
    const expectedWinRate = snapshots
      .filter(other => other.input.memberId !== snapshot.input.memberId)
      .reduce((sum, other) => {
        const probability = 1 / (1 + Math.exp(-(snapshot.strength - other.strength) / probabilityScale));
        return sum + probability;
      }, 0) / (snapshots.length - 1);
    return games * expectedWinRate;
  });

  const integerWins = rawWins.map(value => Math.floor(value));
  const targetLeagueWins = Math.round((snapshots.length * games) / 2);
  let remainingWins = Math.max(0, targetLeagueWins - integerWins.reduce((sum, value) => sum + value, 0));
  const remainders = rawWins
    .map((value, index) => ({ index, remainder: value - Math.floor(value), memberId: snapshots[index].input.memberId }))
    .sort((a, b) => b.remainder - a.remainder || a.memberId.localeCompare(b.memberId));
  for (const item of remainders) {
    if (remainingWins <= 0) break;
    integerWins[item.index] += 1;
    remainingWins -= 1;
  }

  snapshots.forEach((snapshot, index) => {
    const zScore = standardDeviation > 0.001 ? (snapshot.strength - meanStrength) / standardDeviation : 0;
    const projectionScore = clamp(Math.round(86 + zScore * 6.5), 68, 98);
    const score = clamp(
      Math.round(projectionScore * 0.55 + snapshot.constructionScore * 0.25 + snapshot.valueScore * 0.20),
      55,
      98,
    );
    const projectionRank = projectionRanks.get(snapshot.input.memberId) || snapshots.length;
    const projectedWins = clamp(integerWins[index], 0, games);
    const projectedLosses = games - projectedWins;
    const constructionPhrase = snapshot.constructionScore >= 92
      ? 'balanced starter and bench construction'
      : snapshot.constructionScore >= 84
        ? 'solid roster construction'
        : 'some roster-construction risk';
    const valuePhrase = snapshot.valueScore >= 88
      ? 'strong draft-day value versus 2026 rank'
      : snapshot.valueScore >= 79
        ? 'fair value versus 2026 rank'
        : 'several picks taken ahead of 2026 rank';
    const coverageNote = snapshot.projectionCoverage < 0.8
      ? ' Projection coverage is incomplete, so the preseason record is lower-confidence.'
      : '';
    const bestValueNote = snapshot.bestValuePlayer ? ` Best value: ${snapshot.bestValuePlayer}.` : '';
    const explanation = `#${projectionRank} projected scoring roster in this league, with ${constructionPhrase} and ${valuePhrase}.${bestValueNote}${coverageNote}`;

    result.set(snapshot.input.memberId, {
      memberId: snapshot.input.memberId,
      letter: letterForScore(score),
      score,
      projectedWins,
      projectedLosses,
      projectionRank,
      projectionScore,
      constructionScore: snapshot.constructionScore,
      valueScore: snapshot.valueScore,
      projectionCoverage: snapshot.projectionCoverage,
      explanation,
    });
  });

  return result;
};
