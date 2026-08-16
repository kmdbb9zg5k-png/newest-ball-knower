import { LeagueMember, SimulationGame, StandingItem, DraftOrderItem, WinnerAnalysis, SeasonResult } from '../types';
import { calculateTeamRatings, generateTeamReport } from './evaluation';

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return () => {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


export function simulateGame(
  week: number,
  homeMember: LeagueMember,
  awayMember: LeagueMember,
  varianceMultiplier = 1
): SimulationGame {
  const homeRatings = homeMember.teamRatings || calculateTeamRatings(homeMember.roster || []);
  const awayRatings = awayMember.teamRatings || calculateTeamRatings(awayMember.roster || []);

  // Each matchup gets its own deterministic random stream. Re-running the same
  // league/rosters produces stable results instead of a completely different champion.
  const rosterFingerprint = (m: LeagueMember) => (m.roster || []).map(p => `${p.id}:${p.ovr}`).sort().join('|');
  const rand = mulberry32(hashSeed(`${week}:${homeMember.id}:${awayMember.id}:${rosterFingerprint(homeMember)}:${rosterFingerprint(awayMember)}`));

  // Matchup vectors
  // 1. Home Pass Offense vs Away Pass Defense
  // Pass Offense = passing, Pass Def = (passRush * 0.45 + coverage * 0.55)
  const awayPassDef = awayRatings.passRush * 0.45 + awayRatings.coverage * 0.55;
  const homePassEdge = homeRatings.passing - awayPassDef; // e.g. +8 or -5

  // 2. Home Run Offense vs Away Run Defense
  const homeRunEdge = homeRatings.rushing - awayRatings.runDefense;

  // 3. Away Pass Offense vs Home Pass Defense
  const homePassDef = homeRatings.passRush * 0.45 + homeRatings.coverage * 0.55;
  const awayPassEdge = awayRatings.passing - homePassDef;

  // 4. Away Run Offense vs Home Run Defense
  const awayRunEdge = awayRatings.rushing - homeRatings.runDefense;

  // 5. Trenches Clashes
  const homeTrenchPass = homeRatings.passProtection - awayRatings.passRush;
  const awayTrenchPass = awayRatings.passProtection - homeRatings.passRush;

  // Base Expected Points: Avg NFL game has ~22 pts per team
  // Controlled randomness: variance with standard deviation ~7 pts
  const randomVariance = () => {
    // Box-Muller normal distribution approx
    const u = rand() + 0.0001;
    const v = rand() + 0.0001;
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * 6.5 * varianceMultiplier;
  };

  // Home field advantage (+1.5 pts)
  const homeBase = 22.5 + (homeRatings.offense - 82) * 0.45 - (awayRatings.defense - 82) * 0.40 + (homePassEdge * 0.25) + (homeRunEdge * 0.20) + 1.5;
  const awayBase = 21.0 + (awayRatings.offense - 82) * 0.45 - (homeRatings.defense - 82) * 0.40 + (awayPassEdge * 0.25) + (awayRunEdge * 0.20);

  let rawHomeScore = Math.round(homeBase + randomVariance());
  let rawAwayScore = Math.round(awayBase + randomVariance());

  // Prevent unrealistic football scores
  rawHomeScore = Math.max(7, Math.min(52, rawHomeScore));
  rawAwayScore = Math.max(6, Math.min(52, rawAwayScore));

  // If tie, resolve with sudden death / overtime field goal or touchdown
  if (rawHomeScore === rawAwayScore) {
    if (rand() > 0.5) {
      rawHomeScore += rand() > 0.4 ? 3 : 6;
    } else {
      rawAwayScore += rand() > 0.4 ? 3 : 6;
    }
  }

  const isHomeWinner = rawHomeScore > rawAwayScore;
  const winner = isHomeWinner ? homeMember : awayMember;
  const loser = isHomeWinner ? awayMember : homeMember;
  const winnerScore = isHomeWinner ? rawHomeScore : rawAwayScore;
  const loserScore = isHomeWinner ? rawAwayScore : rawHomeScore;

  // Generate dynamic football key matchup factor
  let keyMatchupFactor = '';
  if (isHomeWinner) {
    if (homeTrenchPass > 5) {
      keyMatchupFactor = `${homeMember.userName}'s offensive line held firm, giving zero sacks against ${awayMember.userName}'s front.`;
    } else if (homeRatings.passRush - awayRatings.passProtection > 5) {
      keyMatchupFactor = `${homeMember.userName}'s relentless pass rush overwhelmed ${awayMember.userName}'s offensive line in crucial 3rd downs.`;
    } else if (homeRatings.coverage - awayRatings.passing > 5) {
      keyMatchupFactor = `${homeMember.userName}'s lockdown secondary completely eliminated explosive plays.`;
    } else if (homeRatings.rushing - awayRatings.runDefense > 5) {
      keyMatchupFactor = `${homeMember.userName}'s physical ground attack controlled the clock and wore down ${awayMember.userName}'s defense.`;
    } else if (winnerScore - loserScore <= 4) {
      keyMatchupFactor = `Gritty one-possession battle decided by ${homeMember.userName}'s clutch 4th quarter drive.`;
    } else {
      keyMatchupFactor = `${homeMember.userName}'s overall roster balance executed cleanly in all three phases.`;
    }
  } else {
    if (awayTrenchPass > 5) {
      keyMatchupFactor = `${awayMember.userName}'s offensive line dominated the line of scrimmage on the road.`;
    } else if (awayRatings.passRush - homeRatings.passProtection > 5) {
      keyMatchupFactor = `${awayMember.userName}'s defensive front wreaked havoc, forcing multiple pocket collapses.`;
    } else if (awayRatings.coverage - homeRatings.passing > 5) {
      keyMatchupFactor = `${awayMember.userName}'s ball-hawking secondary snagged key second-half turnovers.`;
    } else if (awayRatings.rushing - homeRatings.runDefense > 5) {
      keyMatchupFactor = `${awayMember.userName}'s offensive line opened gaping rush lanes for steady chunk gains.`;
    } else if (winnerScore - loserScore <= 4) {
      keyMatchupFactor = `${awayMember.userName} pulled off a thrilling late-game comeback drive in hostile territory.`;
    } else {
      keyMatchupFactor = `${awayMember.userName}'s superior depth and execution dictated the tempo.`;
    }
  }

  // Generate quarter scores
  const qScores = (total: number): [number, number, number, number] => {
    const q1 = Math.floor(total * 0.22);
    const q2 = Math.floor(total * 0.32);
    const q3 = Math.floor(total * 0.20);
    const q4 = total - (q1 + q2 + q3);
    return [q1, q2, q3, q4];
  };

  return {
    id: `game-w${week}-${homeMember.id}-vs-${awayMember.id}`,
    week,
    homeMemberId: homeMember.id,
    awayMemberId: awayMember.id,
    homeScore: rawHomeScore,
    awayScore: rawAwayScore,
    winnerId: winner.id,
    loserId: loser.id,
    isTie: false,
    keyMatchupFactor,
    quarterScores: {
      home: qScores(rawHomeScore),
      away: qScores(rawAwayScore),
    },
  };
}

export function simulateFullSeason(members: LeagueMember[], targetGames: 16 | 17 = 16, style: 'realistic'|'balanced'|'chaos' = 'realistic'): SeasonResult {
  if (members.length < 2) {
    throw new Error('At least 2 members required to simulate');
  }

  // Ensure ratings are computed for all
  const preparedMembers = members.map(m => ({
    ...m,
    teamRatings: m.teamRatings || calculateTeamRatings(m.roster || []),
  }));

  const games: SimulationGame[] = [];
  const TARGET_GAMES = targetGames;
  const varianceMultiplier = style === 'chaos' ? 1.55 : style === 'balanced' ? 1.2 : 0.9;
  const numMembers = preparedMembers.length;

  // Fair round-robin scheduler. For normal even-sized leagues every team gets
  // exactly 16 games, with repeat matchups reversed home/away. This replaces
  // the old weekly shuffle that could accidentally create uneven opponent counts.
  if (numMembers % 2 === 0) {
    const rotation = [...preparedMembers];
    const baseRounds: Array<Array<[LeagueMember, LeagueMember]>> = [];
    for (let round = 0; round < numMembers - 1; round++) {
      const pairs: Array<[LeagueMember, LeagueMember]> = [];
      for (let i = 0; i < numMembers / 2; i++) {
        const a = rotation[i];
        const b = rotation[numMembers - 1 - i];
        pairs.push(round % 2 === 0 ? [a, b] : [b, a]);
      }
      baseRounds.push(pairs);
      rotation.splice(1, 0, rotation.pop()!);
    }

    const gameCounts: Record<string, number> = Object.fromEntries(preparedMembers.map(m => [m.id, 0]));
    let week = 1;
    let cycle = 0;
    while (preparedMembers.some(m => gameCounts[m.id] < TARGET_GAMES)) {
      const round = baseRounds[(week - 1) % baseRounds.length];
      for (const [baseHome, baseAway] of round) {
        if (gameCounts[baseHome.id] >= TARGET_GAMES || gameCounts[baseAway.id] >= TARGET_GAMES) continue;
        const reverse = cycle % 2 === 1;
        const home = reverse ? baseAway : baseHome;
        const away = reverse ? baseHome : baseAway;
        games.push(simulateGame(week, home, away, varianceMultiplier));
        gameCounts[home.id]++;
        gameCounts[away.id]++;
      }
      week++;
      if ((week - 1) % baseRounds.length === 0) cycle++;
      if (week > 100) break;
    }
  } else {
    // Odd-sized leagues use a rotating bye. Continue rounds until everyone has
    // exactly 16 played games; no team receives a phantom extra matchup.
    const rotation: Array<LeagueMember | null> = [...preparedMembers, null];
    const gameCounts: Record<string, number> = Object.fromEntries(preparedMembers.map(m => [m.id, 0]));
    let week = 1;
    while (preparedMembers.some(m => gameCounts[m.id] < TARGET_GAMES) && week <= 100) {
      for (let i = 0; i < rotation.length / 2; i++) {
        const a = rotation[i];
        const b = rotation[rotation.length - 1 - i];
        if (!a || !b || gameCounts[a.id] >= TARGET_GAMES || gameCounts[b.id] >= TARGET_GAMES) continue;
        const home = week % 2 === 0 ? a : b;
        const away = week % 2 === 0 ? b : a;
        games.push(simulateGame(week, home, away, varianceMultiplier));
        gameCounts[a.id]++;
        gameCounts[b.id]++;
      }
      rotation.splice(1, 0, rotation.pop()!);
      week++;
    }
  }

  // Compute standings
  const statsMap: Record<string, { wins: number; losses: number; ties: number; pf: number; pa: number; streak: string; lastResults: boolean[] }> = {};

  preparedMembers.forEach(m => {
    statsMap[m.id] = { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, streak: '', lastResults: [] };
  });

  games.forEach(g => {
    const home = statsMap[g.homeMemberId];
    const away = statsMap[g.awayMemberId];

    if (home) {
      home.pf += g.homeScore;
      home.pa += g.awayScore;
      if (g.winnerId === g.homeMemberId) {
        home.wins += 1;
        home.lastResults.push(true);
      } else {
        home.losses += 1;
        home.lastResults.push(false);
      }
    }

    if (away) {
      away.pf += g.awayScore;
      away.pa += g.homeScore;
      if (g.winnerId === g.awayMemberId) {
        away.wins += 1;
        away.lastResults.push(true);
      } else {
        away.losses += 1;
        away.lastResults.push(false);
      }
    }
  });

  // Calculate streaks
  preparedMembers.forEach(m => {
    const s = statsMap[m.id];
    if (s && s.lastResults.length > 0) {
      const last = s.lastResults[s.lastResults.length - 1];
      let count = 0;
      for (let i = s.lastResults.length - 1; i >= 0; i--) {
        if (s.lastResults[i] === last) count++;
        else break;
      }
      s.streak = `${last ? 'W' : 'L'}${count}`;
    }
  });

  // Sort standings:
  // 1. Win Percentage
  // 2. Point Differential
  // 3. Points For
  // 4. Team Rating
  const standings: StandingItem[] = preparedMembers
    .map(m => {
      const s = statsMap[m.id];
      const totalGames = s.wins + s.losses + s.ties;
      const winPct = totalGames > 0 ? (s.wins + 0.5 * s.ties) / totalGames : 0;
      const diff = s.pf - s.pa;
      const teamRatings = m.teamRatings || calculateTeamRatings(m.roster || []);
      const diffPerGame = totalGames > 0 ? diff / totalGames : 0;
      const ballKnowerScore = Math.round(Math.max(0, Math.min(100,
        winPct * 38 +
        teamRatings.overall * 0.24 +
        teamRatings.balanceScore * 0.16 +
        teamRatings.efficiencyRating * 0.12 +
        Math.max(0, Math.min(10, 5 + diffPerGame * 0.65))
      )));
      return {
        rank: 1,
        memberId: m.id,
        memberName: m.userName,
        memberAvatar: m.userAvatar,
        isAi: m.isAi,
        wins: s.wins,
        losses: s.losses,
        ties: s.ties,
        winPercentage: winPct,
        pointsFor: s.pf,
        pointsAgainst: s.pa,
        pointDifferential: diff,
        teamRating: teamRatings.overall,
        ballKnowerScore,
        streak: s.streak || '1W',
      };
    })
    .sort((a, b) => {
      if (b.winPercentage !== a.winPercentage) return b.winPercentage - a.winPercentage;
      if (b.pointDifferential !== a.pointDifferential) return b.pointDifferential - a.pointDifferential;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      return b.teamRating - a.teamRating;
    })
    .map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));

  // Generate Draft Order:
  // #1 Pick goes to #1 in Ball Knower standings (Best Record / Champion)
  const draftOrder: DraftOrderItem[] = standings.map((item, idx) => ({
    pickNumber: idx + 1,
    memberId: item.memberId,
    memberName: item.memberName,
    memberAvatar: item.memberAvatar,
    isAi: item.isAi,
    record: `${item.wins}-${item.losses}${item.ties ? `-${item.ties}` : ''}`,
    pointDiff: item.pointDifferential,
    teamRating: item.teamRating,
    badge: idx === 0 ? '👑 CHAMPION — PICK #1' : idx === 1 ? '🥈 RUNNER-UP — PICK #2' : idx === 2 ? '🥉 3RD PLACE — PICK #3' : `PICK #${idx + 1}`,
  }));

  // Winner Analysis
  const winner = standings[0];
  const winnerMember = preparedMembers.find(m => m.id === winner.memberId);
  const winnerRatings = winnerMember?.teamRatings || {
    passProtection: 90,
    coverage: 90,
    passRush: 90,
    efficiencyRating: 85,
    balanceScore: 90,
  };

  const keyFactors: string[] = [];
  if (winnerRatings.passProtection >= 88) {
    keyFactors.push('Elite pass protection allowed the quarterback to consistently attack downfield without feeling pocket duress.');
  }
  if (winnerRatings.coverage >= 88) {
    keyFactors.push('His roster had no major defensive weakness, locking down opposing WR1s across all 16 matchups.');
  }
  if (winnerRatings.balanceScore >= 80) {
    keyFactors.push('Instead of overspending on one flashy superstar, he built one of the league’s most balanced, disciplined 20-man rosters.');
  }
  if (winnerRatings.passRush >= 88) {
    keyFactors.push('His defensive line consistently created backfield disruption against weaker offensive lines in critical 4th quarter drives.');
  }
  if (keyFactors.length === 0) {
    keyFactors.push('Superior high-efficiency depth and flawless situational execution across one-score contests.');
  }

  const winnerAnalysis: WinnerAnalysis = {
    winnerId: winner.memberId,
    winnerName: winner.memberName,
    summary: `${winner.memberName} won the 16-game Ball Knower season with a ${winner.wins}-${winner.losses} record (+${winner.pointDifferential} point differential) and earned the #1 overall pick in the fantasy football draft!`,
    keyFactors,
  };

  // Generate individual team reports for all participants
  const teamReports: Record<string, ReturnType<typeof generateTeamReport>> = {};
  preparedMembers.forEach(m => {
    teamReports[m.id] = generateTeamReport(m.id, m.userName, m.roster || []);
  });

  return {
    completedAt: new Date().toISOString(),
    standings,
    games,
    draftOrder,
    winnerAnalysis,
    teamReports,
  };
}
