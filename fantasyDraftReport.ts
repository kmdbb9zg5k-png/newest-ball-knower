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

export type FantasyDraftValueNote = {
  playerName: string;
  overall: number;
  overallRank: number;
  delta: number;
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
  benchScore: number;
  benchQuality: 'Elite' | 'Strong' | 'Average' | 'Thin' | 'Critical';
  projectionCoverage: number;
  confidence: 'High' | 'Medium' | 'Low';
  confidenceNote: string;
  strengths: string[];
  weaknesses: string[];
  bestValue: FantasyDraftValueNote | null;
  biggestReach: FantasyDraftValueNote | null;
  strongestPosition: string | null;
  explanation: string;
};

type Snapshot = {
  input: FantasyDraftReportTeam;
  strength: number;
  benchStrength: number;
  benchComposition: number;
  constructionScore: number;
  valueScore: number;
  coverage: number;
  starterCoverage: number;
  bestValue: FantasyDraftValueNote | null;
  biggestReach: FantasyDraftValueNote | null;
  counts: Partial<Record<FantasyDraftReportPosition, number>>;
  positionStrength: Record<string, number>;
};

const POSITIONS: FantasyDraftReportPosition[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
const STARTERS: Record<FantasyDraftReportPosition, number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  K: 1,
  DST: 1,
};
const MIN_MEANINGFUL_BENCH_SPREAD = 12;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const compareText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const projectedPoints = (pick: FantasyDraftReportPick) => {
  const value = Number(pick.projectedPoints);
  return Number.isFinite(value) && value > 0 ? value : 0;
};
const comparePick = (a: FantasyDraftReportPick, b: FantasyDraftReportPick) =>
  projectedPoints(b) - projectedPoints(a) || a.overall - b.overall || compareText(a.playerName, b.playerName);
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
const valueNote = (pick: FantasyDraftReportPick, delta: number): FantasyDraftValueNote => ({
  playerName: pick.playerName,
  overall: pick.overall,
  overallRank: Number(pick.overallRank),
  delta: Math.round(delta),
});
const metricName = (key: string) => key === 'FLEX_DEPTH' ? 'FLEX/skill depth' : key === 'DST' ? 'D/ST' : key;
const flexSurplus = (counts: Partial<Record<FantasyDraftReportPosition, number>>) =>
  Math.max(0, (counts.RB || 0) - STARTERS.RB)
  + Math.max(0, (counts.WR || 0) - STARTERS.WR)
  + Math.max(0, (counts.TE || 0) - STARTERS.TE);

const snapshotFor = (input: FantasyDraftReportTeam): Snapshot => {
  const byPosition = new Map<FantasyDraftReportPosition, FantasyDraftReportPick[]>();
  POSITIONS.forEach(position => byPosition.set(position, []));
  input.picks.forEach(pick => byPosition.get(pick.position)?.push(pick));
  byPosition.forEach(picks => picks.sort(comparePick));

  const chosen = new Set<FantasyDraftReportPick>();
  const starters: FantasyDraftReportPick[] = [];
  POSITIONS.forEach(position => {
    (byPosition.get(position) || []).slice(0, STARTERS[position]).forEach(pick => {
      chosen.add(pick);
      starters.push(pick);
    });
  });

  const flex = input.picks
    .filter(pick => !chosen.has(pick) && ['RB', 'WR', 'TE'].includes(pick.position))
    .sort(comparePick)[0];
  if (flex) {
    chosen.add(flex);
    starters.push(flex);
  }

  const bench = input.picks.filter(pick => !chosen.has(pick));
  const benchStrength = bench.reduce((sum, pick) => {
    const weight = pick.position === 'RB' || pick.position === 'WR'
      ? 0.28
      : pick.position === 'TE'
        ? 0.18
        : pick.position === 'QB'
          ? 0.10
          : 0.015;
    return sum + projectedPoints(pick) * weight;
  }, 0);
  const strength = starters.reduce((sum, pick) => sum + projectedPoints(pick), 0) + benchStrength;

  const counts = input.picks.reduce<Partial<Record<FantasyDraftReportPosition, number>>>((result, pick) => {
    result[pick.position] = (result[pick.position] || 0) + 1;
    return result;
  }, {});
  const skillDepth = flexSurplus(counts);
  const missingBase = POSITIONS.reduce(
    (sum, position) => sum + Math.max(0, STARTERS[position] - (counts[position] || 0)),
    0,
  );
  const missingFlex = skillDepth > 0 ? 0 : 1;
  const extraSpecialTeams = Math.max(0, (counts.K || 0) - 1) + Math.max(0, (counts.DST || 0) - 1);
  const thinSkillPenalty = ((counts.RB || 0) < 3 ? 4 : 0) + ((counts.WR || 0) < 3 ? 4 : 0);
  const constructionScore = clamp(Math.round(
    90
      + Math.min(8, skillDepth * 1.5)
      - (missingBase + missingFlex) * 20
      - extraSpecialTeams * 7
      - Math.max(0, (counts.QB || 0) - 2) * 4
      - Math.max(0, (counts.TE || 0) - 3) * 3
      - thinSkillPenalty,
  ), 45, 98);

  const projectedRbWrBench = bench.filter(
    pick => (pick.position === 'RB' || pick.position === 'WR') && projectedPoints(pick) > 0,
  ).length;
  const projectedTeBench = bench.filter(pick => pick.position === 'TE' && projectedPoints(pick) > 0).length;
  const activeTightEnds = starters.filter(pick => pick.position === 'TE').length;
  const usefulTeBenchSlots = Math.max(0, 3 - activeTightEnds);
  const usefulBench = projectedRbWrBench + Math.min(projectedTeBench, usefulTeBenchSlots);
  const projectedBackupQb = bench.some(pick => pick.position === 'QB' && projectedPoints(pick) > 0) ? 1 : 0;
  const hoardPenalty = bench.filter(pick => pick.position === 'K' || pick.position === 'DST').length * 8
    + Math.max(0, bench.filter(pick => pick.position === 'QB').length - 1) * 5
    + Math.max(0, (counts.TE || 0) - 3) * 7;
  const benchComposition = clamp(Math.round(
    58 + Math.min(28, usefulBench * 5) + projectedBackupQb * 3 - hoardPenalty,
  ), 35, 98);

  const ranked = input.picks.filter(pick => Number.isFinite(Number(pick.overallRank)) && Number(pick.overallRank) > 0);
  const deltas = ranked.map(pick => clamp(pick.overall - Number(pick.overallRank), -30, 30));
  const averageDelta = deltas.length ? deltas.reduce((sum, value) => sum + value, 0) / deltas.length : 0;
  const valueScore = clamp(Math.round(82 + averageDelta * 0.45), 55, 98);
  const candidates = ranked.map(pick => ({ pick, delta: pick.overall - Number(pick.overallRank) }));
  const best = [...candidates].sort((a, b) => b.delta - a.delta || a.pick.overall - b.pick.overall)[0];
  const worst = [...candidates].sort((a, b) => a.delta - b.delta || a.pick.overall - b.pick.overall)[0];
  const bestValue = best && best.delta >= 5 ? valueNote(best.pick, best.delta) : null;
  const biggestReach = worst && worst.delta <= -5 ? valueNote(worst.pick, worst.delta) : null;

  const positionStrength: Record<string, number> = {};
  POSITIONS.forEach(position => {
    const picks = byPosition.get(position) || [];
    positionStrength[position] = picks.slice(0, STARTERS[position]).reduce((sum, pick) => sum + projectedPoints(pick), 0)
      + picks.slice(STARTERS[position]).reduce((sum, pick) => {
        const weight = position === 'RB' || position === 'WR' ? 0.16 : position === 'TE' ? 0.10 : 0.03;
        return sum + projectedPoints(pick) * weight;
      }, 0);
  });
  positionStrength.FLEX_DEPTH = input.picks
    .filter(pick => ['RB', 'WR', 'TE'].includes(pick.position) && !chosen.has(pick))
    .sort(comparePick)
    .slice(0, 3)
    .reduce((sum, pick, index) => sum + projectedPoints(pick) * (index === 0 ? 1 : 0.25), 0);

  return {
    input,
    strength,
    benchStrength,
    benchComposition,
    constructionScore,
    valueScore,
    coverage: input.picks.length ? input.picks.filter(pick => projectedPoints(pick) > 0).length / input.picks.length : 0,
    starterCoverage: starters.length
      ? starters.filter(pick => projectedPoints(pick) > 0).length / starters.length
      : 0,
    bestValue,
    biggestReach,
    counts,
    positionStrength,
  };
};

const ranksFor = (snapshots: Snapshot[], key: string) => {
  const ordered = [...snapshots].sort((a, b) =>
    (b.positionStrength[key] || 0) - (a.positionStrength[key] || 0)
      || compareText(a.input.memberId, b.input.memberId),
  );
  const ranks = new Map<string, number>();
  let previousValue: number | null = null;
  let previousRank = 1;
  ordered.forEach((snapshot, index) => {
    const value = snapshot.positionStrength[key] || 0;
    const rank = previousValue !== null && Math.abs(value - previousValue) <= 0.001
      ? previousRank
      : index + 1;
    ranks.set(snapshot.input.memberId, rank);
    previousValue = value;
    previousRank = rank;
  });
  return ranks;
};

export const buildFantasyDraftReports = (
  teams: FantasyDraftReportTeam[],
  regularSeasonGames: number,
): Map<string, FantasyDraftReport> => {
  const snapshots = teams.map(snapshotFor);
  const reports = new Map<string, FantasyDraftReport>();
  if (!snapshots.length) return reports;

  const games = Math.max(1, Math.round(regularSeasonGames));
  const values = snapshots.map(snapshot => snapshot.strength);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const deviation = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  const scale = Math.max(1, deviation * 1.35);
  const projectionRanks = new Map(
    [...snapshots]
      .sort((a, b) => b.strength - a.strength || compareText(a.input.memberId, b.input.memberId))
      .map((snapshot, index) => [snapshot.input.memberId, index + 1]),
  );
  const positionRanks = new Map<string, Map<string, number>>();
  [...POSITIONS, 'FLEX_DEPTH'].forEach(key => positionRanks.set(key, ranksFor(snapshots, key)));

  const benchMean = snapshots.reduce((sum, snapshot) => sum + snapshot.benchStrength, 0) / snapshots.length;
  const benchDeviation = Math.sqrt(
    snapshots.reduce((sum, snapshot) => sum + (snapshot.benchStrength - benchMean) ** 2, 0) / snapshots.length,
  );
  const benchScale = Math.max(MIN_MEANINGFUL_BENCH_SPREAD, benchDeviation);
  const leagueCoverage = snapshots.reduce((sum, snapshot) => sum + snapshot.coverage, 0) / snapshots.length;
  const leagueStarterCoverage = snapshots.reduce((sum, snapshot) => sum + snapshot.starterCoverage, 0) / snapshots.length;
  const leagueStarterProjectionsComplete = snapshots.every(snapshot => snapshot.starterCoverage >= 0.999);

  const rawWins = snapshots.map(snapshot => snapshots.length === 1
    ? games / 2
    : games * snapshots
      .filter(other => other.input.memberId !== snapshot.input.memberId)
      .reduce((sum, other) => sum + 1 / (1 + Math.exp(-(snapshot.strength - other.strength) / scale)), 0)
      / (snapshots.length - 1));
  const wins = rawWins.map(Math.floor);
  let remainingWins = Math.max(0, Math.round(snapshots.length * games / 2) - wins.reduce((sum, value) => sum + value, 0));
  for (const item of rawWins
    .map((value, index) => ({ index, remainder: value - Math.floor(value), id: snapshots[index].input.memberId }))
    .sort((a, b) => b.remainder - a.remainder || compareText(a.id, b.id))) {
    if (remainingWins <= 0) break;
    wins[item.index] += 1;
    remainingWins -= 1;
  }

  snapshots.forEach((snapshot, index) => {
    const projectionScore = clamp(Math.round(
      86 + (deviation > 0.001 ? (snapshot.strength - mean) / deviation : 0) * 6.5,
    ), 68, 98);
    const benchProjection = clamp(
      Math.round(78 + ((snapshot.benchStrength - benchMean) / benchScale) * 8),
      50,
      98,
    );
    const benchScore = clamp(Math.round(benchProjection * 0.65 + snapshot.benchComposition * 0.35), 45, 98);
    const benchQuality: FantasyDraftReport['benchQuality'] = benchScore >= 90
      ? 'Elite'
      : benchScore >= 83
        ? 'Strong'
        : benchScore >= 73
          ? 'Average'
          : benchScore >= 62
            ? 'Thin'
            : 'Critical';
    const score = clamp(Math.round(
      projectionScore * 0.5 + snapshot.constructionScore * 0.23 + snapshot.valueScore * 0.17 + benchScore * 0.1,
    ), 55, 98);
    const projectionRank = projectionRanks.get(snapshot.input.memberId) || snapshots.length;

    const metrics = [...POSITIONS, 'FLEX_DEPTH']
      .map(key => ({
        key,
        rank: positionRanks.get(key)?.get(snapshot.input.memberId) || snapshots.length,
        value: snapshot.positionStrength[key] || 0,
      }))
      .filter(row => row.value > 0);
    const topCutoff = Math.max(1, Math.ceil(snapshots.length / 3));
    const bottomCutoff = Math.max(1, Math.floor(snapshots.length * 2 / 3) + 1);
    const strengths = metrics
      .filter(row => row.rank <= topCutoff)
      .sort((a, b) => a.rank - b.rank || b.value - a.value)
      .slice(0, 3)
      .map(row => `${metricName(row.key)} projects #${row.rank} of ${snapshots.length} in the league.`);
    const relativeWeaknesses = metrics
      .filter(row => row.rank >= bottomCutoff)
      .sort((a, b) => b.rank - a.rank || a.value - b.value)
      .slice(0, 3)
      .map(row => `${metricName(row.key)} projects #${row.rank} of ${snapshots.length}; this is a roster risk.`);

    const requiredWeaknesses: string[] = [];
    POSITIONS.forEach(position => {
      const missing = Math.max(0, STARTERS[position] - (snapshot.counts[position] || 0));
      if (missing > 0) {
        requiredWeaknesses.push(`${metricName(position)} is missing ${missing} required starter${missing === 1 ? '' : 's'}.`);
      }
    });
    if (flexSurplus(snapshot.counts) === 0) {
      requiredWeaknesses.push('The roster does not have an extra RB/WR/TE available to fill the required FLEX spot.');
    }

    const constructionWeaknesses: string[] = [];
    if ((snapshot.counts.RB || 0) < 3) constructionWeaknesses.push('RB depth is thin behind the required starters.');
    if ((snapshot.counts.WR || 0) < 3) constructionWeaknesses.push('WR depth is thin behind the required starters.');
    if ((snapshot.counts.QB || 0) > 2) constructionWeaknesses.push('Too many roster spots are invested in backup quarterbacks.');
    if ((snapshot.counts.TE || 0) > 3) constructionWeaknesses.push('Too many roster spots are invested in backup tight ends.');
    if ((snapshot.counts.K || 0) > 1 || (snapshot.counts.DST || 0) > 1) constructionWeaknesses.push('Extra K/D/ST picks reduced higher-upside bench depth.');

    const uniqueStrengths = [...new Set(strengths)].slice(0, 3);
    const uniqueWeaknesses = [...new Set([
      ...requiredWeaknesses,
      ...constructionWeaknesses,
      ...relativeWeaknesses,
    ])].slice(0, 3);
    if (!uniqueStrengths.length) {
      uniqueStrengths.push(
        benchScore >= 83
          ? `${benchQuality} bench depth supports the starting lineup.`
          : 'Roster strength is balanced without one dominant position group.',
      );
    }
    if (!uniqueWeaknesses.length) {
      uniqueWeaknesses.push('No major construction hole stands out; weekly health and matchups become the main risk.');
    }

    const completeStarterProjectionCoverage = snapshot.starterCoverage >= 0.999;
    const leagueComparisonsStrong = leagueCoverage >= 0.85 && leagueStarterProjectionsComplete;
    const leagueComparisonsUsable = leagueCoverage >= 0.65 && leagueStarterCoverage >= 0.75;
    const confidence: FantasyDraftReport['confidence'] = snapshot.coverage >= 0.85 && completeStarterProjectionCoverage && leagueComparisonsStrong
      ? 'High'
      : snapshot.coverage >= 0.65 && snapshot.starterCoverage >= 0.75 && leagueComparisonsUsable
        ? 'Medium'
        : 'Low';
    const coveragePercent = Math.round(snapshot.coverage * 100);
    const starterCoveragePercent = Math.round(snapshot.starterCoverage * 100);
    const leagueCoveragePercent = Math.round(leagueCoverage * 100);
    const leagueStarterCoveragePercent = Math.round(leagueStarterCoverage * 100);
    const confidenceNote = confidence === 'High'
      ? `${coveragePercent}% of this roster and ${leagueCoveragePercent}% of league rosters have published 2026 projection data, with complete projection coverage across occupied starter/FLEX slots in the comparison set.`
      : `${coveragePercent}% roster projection coverage and ${starterCoveragePercent}% occupied starter/FLEX projection coverage for this team; league comparisons are ${leagueCoveragePercent}% overall and ${leagueStarterCoveragePercent}% occupied starter/FLEX projection covered. Missing comparison data lowers confidence in exact league-relative ranks, the grade, and projected record.`;
    const strongest = [...metrics].sort((a, b) => a.rank - b.rank || b.value - a.value)[0];
    const strongestPosition = strongest ? `${metricName(strongest.key)} (#${strongest.rank}/${snapshots.length})` : null;
    const projectedWins = clamp(wins[index], 0, games);
    const explanation = [
      `#${projectionRank} projected scoring roster.`,
      `Bench: ${benchQuality} (${benchScore}/100).`,
      `Strength: ${uniqueStrengths[0]}`,
      `Risk: ${uniqueWeaknesses[0]}`,
    ].join(' ');

    reports.set(snapshot.input.memberId, {
      memberId: snapshot.input.memberId,
      letter: letterForScore(score),
      score,
      projectedWins,
      projectedLosses: games - projectedWins,
      projectionRank,
      projectionScore,
      constructionScore: snapshot.constructionScore,
      valueScore: snapshot.valueScore,
      benchScore,
      benchQuality,
      projectionCoverage: snapshot.coverage,
      confidence,
      confidenceNote,
      strengths: uniqueStrengths,
      weaknesses: uniqueWeaknesses,
      bestValue: snapshot.bestValue,
      biggestReach: snapshot.biggestReach,
      strongestPosition,
      explanation,
    });
  });

  return reports;
};
