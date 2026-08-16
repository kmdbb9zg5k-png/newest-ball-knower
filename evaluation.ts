import { Player, TeamRatings, TeamReportAnalysis, PositionGrade } from '../types';

export interface RosterPositionBreakdown {
  qb: Player;
  rb: Player;
  wrs: Player[];
  te: Player;
  ol: Player[];
  dlEdge: Player[];
  lbs: Player[];
  cbs: Player[];
  safeties: Player[];
}

export function getPlayerOvr(p: Player): number {
  return p.overallRating ?? p.ovr ?? 75;
}

export function parseRoster(roster: Player[]): RosterPositionBreakdown | null {
  const qb = roster.find(p => p.position === 'QB');
  const rb = roster.find(p => ['RB', 'FB'].includes(p.position));
  const wrs = roster.filter(p => p.position === 'WR');
  const te = roster.find(p => p.position === 'TE');
  const ol = roster.filter(p => ['OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'C'].includes(p.position));
  const dlEdge = roster.filter(p => ['EDGE', 'DT', 'DE', 'NT'].includes(p.position));
  const lbs = roster.filter(p => p.position === 'LB');
  const cbs = roster.filter(p => p.position === 'CB');
  const safeties = roster.filter(p => ['S', 'FS', 'SS'].includes(p.position));

  if (!qb || !rb || wrs.length < 2 || !te || ol.length < 4 || dlEdge.length < 3 || lbs.length < 2 || cbs.length < 2 || safeties.length < 2) {
    return null;
  }

  return {
    qb,
    rb,
    wrs: wrs.slice(0, 2),
    te,
    ol: ol.slice(0, 4),
    dlEdge: dlEdge.slice(0, 3),
    lbs: lbs.slice(0, 2),
    cbs: cbs.slice(0, 2),
    safeties: safeties.slice(0, 2),
  };
}

export function calculateTeamRatings(roster: Player[]): TeamRatings {
  const parsed = parseRoster(roster);
  const totalSalary = roster.reduce((sum, p) => sum + p.salary, 0);

  if (!parsed) {
    // Fallback if roster incomplete
    const avgOvr = roster.length > 0 ? roster.reduce((sum, p) => sum + getPlayerOvr(p), 0) / roster.length : 70;
    return {
      overall: Math.round(avgOvr),
      offense: Math.round(avgOvr),
      defense: Math.round(avgOvr),
      passing: Math.round(avgOvr),
      rushing: Math.round(avgOvr),
      passProtection: Math.round(avgOvr),
      runBlocking: Math.round(avgOvr),
      passRush: Math.round(avgOvr),
      runDefense: Math.round(avgOvr),
      coverage: Math.round(avgOvr),
      balanceScore: 50,
      efficiencyRating: 50,
      penalties: ['Incomplete roster'],
      strengths: [],
    };
  }

  const { qb, rb, wrs, te, ol, dlEdge, lbs, cbs, safeties } = parsed;

  // --- OFFENSIVE LINE METRICS ---
  const olPassBlockAvg = ol.reduce((sum, p) => sum + (p.attributes?.passBlocking || getPlayerOvr(p)), 0) / Math.max(ol.length, 1);
  const olRunBlockAvg = ol.reduce((sum, p) => sum + (p.attributes?.runBlocking || getPlayerOvr(p)), 0) / Math.max(ol.length, 1);
  const olOverallAvg = ol.reduce((sum, p) => sum + getPlayerOvr(p), 0) / Math.max(ol.length, 1);

  // --- PASSING GAME METRICS ---
  // Synergy: QB passing efficiency is capped or boosted by pass protection and receiver quality
  const wrTeAvgOvr = (getPlayerOvr(wrs[0]) + getPlayerOvr(wrs[1]) + getPlayerOvr(te)) / 3;
  const qbPassingScore = qb.attributes?.passing || getPlayerOvr(qb);

  // If OL is bad (<82), QB takes sacks and pressure
  let passProModifier = 1.0;
  if (olPassBlockAvg < 80) {
    passProModifier = 0.88; // 12% penalty
  } else if (olPassBlockAvg >= 92) {
    passProModifier = 1.06; // 6% boost
  }

  // If QB is poor (<82), elite WRs get diminished returns
  let qbDeliveryModifier = 1.0;
  if (qbPassingScore < 82) {
    qbDeliveryModifier = 0.89; // 11% penalty
  } else if (qbPassingScore >= 93) {
    qbDeliveryModifier = 1.05; // 5% boost
  }

  const rawPassing = (qbPassingScore * 0.45 + olPassBlockAvg * 0.30 + wrTeAvgOvr * 0.25) * passProModifier * qbDeliveryModifier;
  const passing = Math.min(99, Math.max(68, rawPassing));

  // --- RUSHING GAME METRICS ---
  // Synergy: RB production heavily depends on Run Blocking
  const rbRushingScore = rb.attributes?.rushing || getPlayerOvr(rb);
  let runBlockModifier = 1.0;
  if (olRunBlockAvg < 80) {
    runBlockModifier = 0.88;
  } else if (olRunBlockAvg >= 92) {
    runBlockModifier = 1.07;
  }

  const rawRushing = (rbRushingScore * 0.48 + olRunBlockAvg * 0.42 + (te.attributes?.runBlocking || getPlayerOvr(te)) * 0.10) * runBlockModifier;
  const rushing = Math.min(99, Math.max(68, rawRushing));

  // --- DEFENSIVE METRICS ---
  // Pass Rush: DL/EDGE pass rush rating
  const passRushAvg = dlEdge.reduce((sum, p) => sum + (p.attributes?.passRush || getPlayerOvr(p)), 0) / Math.max(dlEdge.length, 1);
  
  // Run Defense: DL/EDGE run defense + LB run defense
  const dlRunDefAvg = dlEdge.reduce((sum, p) => sum + (p.attributes?.runDefense || getPlayerOvr(p)), 0) / Math.max(dlEdge.length, 1);
  const lbRunDefAvg = lbs.reduce((sum, p) => sum + (p.attributes?.runDefense || getPlayerOvr(p)), 0) / Math.max(lbs.length, 1);
  const runDefense = (dlRunDefAvg * 0.55 + lbRunDefAvg * 0.45);

  // Coverage: CB coverage + Safety coverage + LB coverage
  const cbCoverageAvg = ((cbs[0].attributes?.coverage || getPlayerOvr(cbs[0])) + (cbs[1].attributes?.coverage || getPlayerOvr(cbs[1]))) / 2;
  const safetyCoverageAvg = ((safeties[0].attributes?.coverage || getPlayerOvr(safeties[0])) + (safeties[1].attributes?.coverage || getPlayerOvr(safeties[1]))) / 2;
  const lbCoverageAvg = lbs.reduce((sum, p) => sum + (p.attributes?.coverage || getPlayerOvr(p) - 5), 0) / Math.max(lbs.length, 1);

  // Synergy: If Pass Rush is low (<80), secondary coverage breaks down
  let passRushPressureModifier = 1.0;
  if (passRushAvg < 80) {
    passRushPressureModifier = 0.90; // Secondary must cover for 4+ seconds
  } else if (passRushAvg >= 93) {
    passRushPressureModifier = 1.06; // Quick pressure masks minor secondary flaws
  }

  const rawCoverage = (cbCoverageAvg * 0.45 + safetyCoverageAvg * 0.35 + lbCoverageAvg * 0.20) * passRushPressureModifier;
  const coverage = Math.min(99, Math.max(68, rawCoverage));

  // Overall Offense & Defense
  const offense = Math.round(passing * 0.55 + rushing * 0.45);
  const defense = Math.round(passRushAvg * 0.35 + runDefense * 0.30 + coverage * 0.35);

  // --- PENALTIES & SYNERGY DETECTION ---
  const penalties: string[] = [];
  const strengths: string[] = [];

  // 1. Elite QB behind terrible OL
  if (qb.salary >= 35 && olOverallAvg < 82) {
    penalties.push('Sack Magnet: Elite QB ($' + qb.salary + 'M) under constant duress behind weak O-Line.');
  }

  // 2. Elite WRs with mediocre QB
  if ((wrs[0].salary + wrs[1].salary >= 40) && getPlayerOvr(qb) < 84) {
    penalties.push('Wasted Firepower: High-priced receiver room starved by subpar QB accuracy.');
  }

  // 3. Elite RB with no blocking
  if (rb.salary >= 14 && olRunBlockAvg < 82) {
    penalties.push('Stuffed at Line: Expensive RB ($' + rb.salary + 'M) getting contacted behind line of scrimmage.');
  }

  // 4. Elite CBs with no Pass Rush
  if ((getPlayerOvr(cbs[0]) >= 92 && getPlayerOvr(cbs[1]) >= 90) && passRushAvg < 82) {
    penalties.push('Coverage Breakdown: Lockdown corners cannot cover indefinitely without pass rush.');
  }

  // 5. Elite Pass Rush with weak Secondary
  if (passRushAvg >= 92 && (cbCoverageAvg < 82 || safetyCoverageAvg < 82)) {
    penalties.push('Quick-Release Vulnerability: Opposing QBs throw quick slants over weak secondary.');
  }

  // 6. Stars & Scrubs vs Balanced
  const salaries = roster.map(p => p.salary);
  const top3Salary = [...salaries].sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
  if (top3Salary > 95) {
    penalties.push('Stars & Scrubs Fragility: Over ' + top3Salary + 'M concentrated in 3 players creates depth voids.');
  }

  // Strengths
  if (olOverallAvg >= 91) {
    strengths.push('Great Wall Trench Dominance: Elite offensive line controls scrimmage.');
  }
  if (passRushAvg >= 93) {
    strengths.push('Nightmare Pass Rush: Relentless pressure forces hurried throws and sacks.');
  }
  if (coverage >= 92) {
    strengths.push('No-Fly Zone: Clamping secondary erases intermediate and deep passing lanes.');
  }
  if (getPlayerOvr(qb) >= 94 && olPassBlockAvg >= 88) {
    strengths.push('Lethal Pocket Combo: MVP-caliber QB paired with clean pocket protection.');
  }
  if (getPlayerOvr(rb) >= 90 && olRunBlockAvg >= 90) {
    strengths.push('Steamroller Ground Game: Dominant physical rushing attack tires out defenses.');
  }

  // Balance Score (0 - 100)
  const groupScores = [passing, rushing, passRushAvg, runDefense, coverage];
  const avgScore = groupScores.reduce((a, b) => a + b, 0) / groupScores.length;
  const variance = groupScores.reduce((a, b) => a + Math.pow(b - avgScore, 2), 0) / groupScores.length;
  const stdDev = Math.sqrt(variance);
  const balanceScore = Math.max(30, Math.min(99, Math.round(100 - (stdDev * 5) - (penalties.length * 6))));

  // Efficiency Rating: Overall value generated per cap dollar spent
  const totalOvrPoints = roster.reduce((sum, p) => sum + getPlayerOvr(p), 0);
  const pointsPerCap = totalOvrPoints / Math.max(120, totalSalary);
  // typical is ~8.5 - 9.5
  const efficiencyRating = Math.round(Math.min(99, Math.max(40, (pointsPerCap - 7.5) * 35 + 50)));

  // Final Overall Team Rating
  const penaltyDeduction = penalties.length * 1.5;
  const bonusAdd = strengths.length * 1.0;
  const baseOverall = (offense * 0.50 + defense * 0.50);
  const overall = Math.round(Math.min(99, Math.max(70, baseOverall - penaltyDeduction + bonusAdd)));

  return {
    overall,
    offense,
    defense,
    passing: Math.round(passing),
    rushing: Math.round(rushing),
    passProtection: Math.round(olPassBlockAvg),
    runBlocking: Math.round(olRunBlockAvg),
    passRush: Math.round(passRushAvg),
    runDefense: Math.round(runDefense),
    coverage: Math.round(coverage),
    balanceScore,
    efficiencyRating,
    penalties,
    strengths,
  };
}

export function generateTeamReport(memberId: string, memberName: string, roster: Player[]): TeamReportAnalysis {
  const ratings = calculateTeamRatings(roster);
  const parsed = parseRoster(roster);

  const whatYouDidWell: string[] = [];
  const whatCostYou: string[] = [];

  if (ratings.strengths.length > 0) {
    whatYouDidWell.push(...ratings.strengths);
  } else if (ratings.balanceScore >= 80) {
    whatYouDidWell.push('Balanced Cap Allocation: Avoided crippling liabilities across all 20 roster spots.');
  }

  if (ratings.passProtection >= 88) {
    whatYouDidWell.push('Invested heavily in the trenches, giving your offense steady protection.');
  }
  if (ratings.coverage >= 88) {
    whatYouDidWell.push('Built a lockdown secondary that limited explosive pass plays.');
  }
  if (ratings.efficiencyRating >= 75) {
    whatYouDidWell.push('High Cap Efficiency: Extracted massive on-field value from budget and mid-tier contracts.');
  }

  if (ratings.penalties.length > 0) {
    whatCostYou.push(...ratings.penalties);
  }
  if (ratings.passProtection < 82) {
    whatCostYou.push('Cheap Offensive Line: Low-budget OL ranked poorly, allowing relentless quarterback pressures.');
  }
  if (ratings.passRush < 82) {
    whatCostYou.push('Lack of Edge Pressure: Opposing quarterbacks had comfortable time to scan downfield.');
  }
  if (ratings.coverage < 82) {
    whatCostYou.push('Vulnerable Secondary: Allowed high completion percentages and explosive passing conversions.');
  }
  if (whatCostYou.length === 0) {
    whatCostYou.push('Minor variance in one-score games against top-tier league opponents.');
  }

  // Best & Worst Value Picks
  let bestValuePick = {
    player: roster[0],
    reason: 'Solid starter production',
  };
  let worstValuePick = {
    player: roster[0],
    reason: 'Standard price tag',
  };

  let maxRatio = -1;
  let minRatio = 999;

  roster.forEach(p => {
    const pOvr = getPlayerOvr(p);
    // Value ratio: OVR / (salary^0.8)
    const ratio = pOvr / Math.pow(Math.max(2, p.salary), 0.7);
    if (ratio > maxRatio) {
      maxRatio = ratio;
      bestValuePick = {
        player: p,
        reason: `${pOvr} OVR at only $${p.salary}M provided immense surplus cap value (${p.highlightStat || 'starter quality'}).`,
      };
    }
    // High salary with low overall or overpaying
    const costRatio = p.salary / Math.max(1, pOvr - 65);
    if (costRatio > minRatio || (p.salary >= 25 && ratio < minRatio)) {
      minRatio = costRatio;
      worstValuePick = {
        player: p,
        reason: `$${p.salary}M cap hit constrained flexibility across the remaining 19 roster positions.`,
      };
    }
  });

  // Biggest Weakness
  const areas = [
    { name: 'Pass Protection', rating: ratings.passProtection, desc: 'Your offensive line struggled to pick up blitzes and stunt rushes.' },
    { name: 'Pass Rush', rating: ratings.passRush, desc: 'Front four failed to collapse the pocket consistently.' },
    { name: 'Pass Coverage', rating: ratings.coverage, desc: 'Secondary was vulnerable to intermediate crossers and deep post routes.' },
    { name: 'Run Blocking', rating: ratings.runBlocking, desc: 'Inability to create initial surge at the line of scrimmage.' },
    { name: 'Passing Attack', rating: ratings.passing, desc: 'Inconsistent downfield aerial output against stout defenses.' },
  ];
  areas.sort((a, b) => a.rating - b.rating);
  const biggestWeakness = `${areas[0].name} (${areas[0].rating} OVR) — ${areas[0].desc}`;

  // Position Grades
  const positionGrades: PositionGrade[] = [];
  if (parsed) {
    const gradeFromScore = (score: number): { grade: PositionGrade['grade']; score: number } => {
      if (score >= 95) return { grade: 'A+', score };
      if (score >= 91) return { grade: 'A', score };
      if (score >= 88) return { grade: 'A-', score };
      if (score >= 85) return { grade: 'B+', score };
      if (score >= 82) return { grade: 'B', score };
      if (score >= 79) return { grade: 'B-', score };
      if (score >= 75) return { grade: 'C+', score };
      if (score >= 72) return { grade: 'C', score };
      if (score >= 68) return { grade: 'C-', score };
      if (score >= 60) return { grade: 'D', score };
      return { grade: 'F', score };
    };

    // QB
    const qbGrade = gradeFromScore(getPlayerOvr(parsed.qb));
    positionGrades.push({
      position: 'Quarterback (QB)',
      grade: qbGrade.grade,
      score: qbGrade.score,
      comment: `${parsed.qb.name} ($${parsed.qb.salary}M) — ${parsed.qb.highlightStat || 'Field general'}`,
    });

    // RB
    const rbGrade = gradeFromScore(getPlayerOvr(parsed.rb));
    positionGrades.push({
      position: 'Running Back (RB)',
      grade: rbGrade.grade,
      score: rbGrade.score,
      comment: `${parsed.rb.name} ($${parsed.rb.salary}M) — ${parsed.rb.highlightStat || 'Ground weapon'}`,
    });

    // WR
    const wrAvg = (getPlayerOvr(parsed.wrs[0]) + getPlayerOvr(parsed.wrs[1])) / 2;
    const wrGrade = gradeFromScore(wrAvg);
    positionGrades.push({
      position: 'Wide Receivers (WR)',
      grade: wrGrade.grade,
      score: Math.round(wrAvg),
      comment: `${parsed.wrs[0].name} & ${parsed.wrs[1].name} — Average ${Math.round(wrAvg)} OVR`,
    });

    // TE
    const teGrade = gradeFromScore(getPlayerOvr(parsed.te));
    positionGrades.push({
      position: 'Tight End (TE)',
      grade: teGrade.grade,
      score: teGrade.score,
      comment: `${parsed.te.name} ($${parsed.te.salary}M) — ${parsed.te.highlightStat || 'Versatile weapon'}`,
    });

    // OL
    const olAvg = parsed.ol.reduce((sum, p) => sum + getPlayerOvr(p), 0) / Math.max(parsed.ol.length, 1);
    const olGrade = gradeFromScore(olAvg);
    positionGrades.push({
      position: 'Offensive Line (4 OL)',
      grade: olGrade.grade,
      score: Math.round(olAvg),
      comment: `4-man unit average: ${Math.round(olAvg)} OVR (Pass Pro: ${ratings.passProtection}, Run Block: ${ratings.runBlocking})`,
    });

    // DL / EDGE
    const dlAvg = parsed.dlEdge.reduce((sum, p) => sum + getPlayerOvr(p), 0) / Math.max(parsed.dlEdge.length, 1);
    const dlGrade = gradeFromScore(dlAvg);
    positionGrades.push({
      position: 'Defensive Line / EDGE (3)',
      grade: dlGrade.grade,
      score: Math.round(dlAvg),
      comment: `Front average: ${Math.round(dlAvg)} OVR (Pass Rush: ${ratings.passRush})`,
    });

    // LB
    const lbAvg = parsed.lbs.reduce((sum, p) => sum + getPlayerOvr(p), 0) / Math.max(parsed.lbs.length, 1);
    const lbGrade = gradeFromScore(lbAvg);
    positionGrades.push({
      position: 'Linebackers (2 LB)',
      grade: lbGrade.grade,
      score: Math.round(lbAvg),
      comment: `Second-level unit: ${Math.round(lbAvg)} OVR (Run Stop: ${ratings.runDefense})`,
    });

    // Secondary (CB + S)
    const secAvg = (getPlayerOvr(parsed.cbs[0]) + getPlayerOvr(parsed.cbs[1]) + getPlayerOvr(parsed.safeties[0]) + getPlayerOvr(parsed.safeties[1])) / 4;
    const secGrade = gradeFromScore(secAvg);
    positionGrades.push({
      position: 'Secondary (2 CB, 2 S)',
      grade: secGrade.grade,
      score: Math.round(secAvg),
      comment: `Backfield coverage: ${ratings.coverage} OVR rating`,
    });
  }

  return {
    memberId,
    memberName,
    teamRatings: ratings,
    whatYouDidWell,
    whatCostYou,
    bestValuePick,
    worstValuePick,
    biggestWeakness,
    positionGrades,
  };
}
