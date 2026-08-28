import { LeagueMember, SimulationGame, StandingItem, DraftOrderItem, WinnerAnalysis, SeasonResult } from './types';
import { calculateTeamRatings, generateTeamReport } from './evaluation';
import { calculateFantasyTeamRatings, isFantasyRoster } from './fantasyEvaluation';

const ratingsFor = (member: LeagueMember) => {
  const roster=member.roster||[];
  return isFantasyRoster(roster) ? calculateFantasyTeamRatings(roster) : (member.teamRatings || calculateTeamRatings(roster));
};

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
  const fantasyGame=isFantasyRoster(homeMember.roster||[])&&isFantasyRoster(awayMember.roster||[]);
  const homeRatings = ratingsFor(homeMember);
  const awayRatings = ratingsFor(awayMember);

  const rosterFingerprint = (m: LeagueMember) => (m.roster || []).map(p => `${p.id}:${p.ovr}`).sort().join('|');
  const rand = mulberry32(hashSeed(`${week}:${homeMember.id}:${awayMember.id}:${rosterFingerprint(homeMember)}:${rosterFingerprint(awayMember)}`));

  const awayPassDef = awayRatings.passRush * 0.45 + awayRatings.coverage * 0.55;
  const homePassEdge = homeRatings.passing - awayPassDef;
  const homeRunEdge = homeRatings.rushing - awayRatings.runDefense;
  const homePassDef = homeRatings.passRush * 0.45 + homeRatings.coverage * 0.55;
  const awayPassEdge = awayRatings.passing - homePassDef;
  const awayRunEdge = awayRatings.rushing - homeRatings.runDefense;
  const homeTrenchPass = homeRatings.passProtection - awayRatings.passRush;
  const awayTrenchPass = awayRatings.passProtection - homeRatings.passRush;

  const randomVariance = () => {
    const u = rand() + 0.0001;
    const v = rand() + 0.0001;
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v) * 6.5 * varianceMultiplier;
  };

  const homeBase = fantasyGame ? 105+(homeRatings.overall-75)*1.8+(homeRatings.balanceScore-70)*.28+2.2 : 22.5 + (homeRatings.offense - 82) * 0.45 - (awayRatings.defense - 82) * 0.40 + (homePassEdge * 0.25) + (homeRunEdge * 0.20) + 1.5;
  const awayBase = fantasyGame ? 103+(awayRatings.overall-75)*1.8+(awayRatings.balanceScore-70)*.28 : 21.0 + (awayRatings.offense - 82) * 0.45 - (homeRatings.defense - 82) * 0.40 + (awayPassEdge * 0.25) + (awayRunEdge * 0.20);

  let rawHomeScore = Math.round(homeBase + randomVariance());
  let rawAwayScore = Math.round(awayBase + randomVariance());
  rawHomeScore = Math.max(fantasyGame?62:7, Math.min(fantasyGame?190:52, rawHomeScore));
  rawAwayScore = Math.max(fantasyGame?60:6, Math.min(fantasyGame?190:52, rawAwayScore));

  if (rawHomeScore === rawAwayScore) {
    if (rand() > 0.5) rawHomeScore += rand() > 0.4 ? 3 : 6;
    else rawAwayScore += rand() > 0.4 ? 3 : 6;
  }

  const isHomeWinner = rawHomeScore > rawAwayScore;
  const winner = isHomeWinner ? homeMember : awayMember;
  const loser = isHomeWinner ? awayMember : homeMember;
  const winnerScore = isHomeWinner ? rawHomeScore : rawAwayScore;
  const loserScore = isHomeWinner ? rawAwayScore : rawHomeScore;

  let keyMatchupFactor = '';
  if(fantasyGame){
    const winnerRatings=isHomeWinner?homeRatings:awayRatings;
    const edge=winnerRatings.passing>=winnerRatings.rushing?'quarterback and receiving ceiling':'running-back production and flex depth';
    keyMatchupFactor=`${winner.userName}'s ${edge} produced the stronger fantasy lineup.`;
  } else if (isHomeWinner) {
    if (homeTrenchPass > 5) keyMatchupFactor = `${homeMember.userName}'s offensive line held firm, giving zero sacks against ${awayMember.userName}'s front.`;
    else if (homeRatings.passRush - awayRatings.passProtection > 5) keyMatchupFactor = `${homeMember.userName}'s relentless pass rush overwhelmed ${awayMember.userName}'s offensive line in crucial 3rd downs.`;
    else if (homeRatings.coverage - awayRatings.passing > 5) keyMatchupFactor = `${homeMember.userName}'s lockdown secondary completely eliminated explosive plays.`;
    else if (homeRatings.rushing - awayRatings.runDefense > 5) keyMatchupFactor = `${homeMember.userName}'s physical ground attack controlled the clock and wore down ${awayMember.userName}'s defense.`;
    else if (winnerScore - loserScore <= 4) keyMatchupFactor = `Gritty one-possession battle decided by ${homeMember.userName}'s clutch 4th quarter drive.`;
    else keyMatchupFactor = `${homeMember.userName}'s overall roster balance executed cleanly in all three phases.`;
  } else {
    if (awayTrenchPass > 5) keyMatchupFactor = `${awayMember.userName}'s offensive line dominated the line of scrimmage on the road.`;
    else if (awayRatings.passRush - homeRatings.passProtection > 5) keyMatchupFactor = `${awayMember.userName}'s defensive front wreaked havoc, forcing multiple pocket collapses.`;
    else if (awayRatings.coverage - homeRatings.passing > 5) keyMatchupFactor = `${awayMember.userName}'s ball-hawking secondary snagged key second-half turnovers.`;
    else if (awayRatings.rushing - homeRatings.runDefense > 5) keyMatchupFactor = `${awayMember.userName}'s offensive line opened gaping rush lanes for steady chunk gains.`;
    else if (winnerScore - loserScore <= 4) keyMatchupFactor = `${awayMember.userName} pulled off a thrilling late-game comeback drive in hostile territory.`;
    else keyMatchupFactor = `${awayMember.userName}'s superior depth and execution dictated the tempo.`;
  }

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
    quarterScores: { home: qScores(rawHomeScore), away: qScores(rawAwayScore) },
  };
}

export function buildStandings(members: LeagueMember[], games: SimulationGame[]): StandingItem[] {
  const stats = Object.fromEntries(members.map(member => [member.id, { wins:0, losses:0, ties:0, pf:0, pa:0, results:[] as boolean[] }]));
  for (const game of games) {
    const home = stats[game.homeMemberId];
    const away = stats[game.awayMemberId];
    if (!home || !away) continue;
    home.pf += game.homeScore; home.pa += game.awayScore;
    away.pf += game.awayScore; away.pa += game.homeScore;
    if (game.isTie) {
      home.ties++; away.ties++;
    } else {
      const homeWon = game.winnerId === game.homeMemberId;
      home[homeWon ? 'wins' : 'losses']++;
      away[homeWon ? 'losses' : 'wins']++;
      home.results.push(homeWon); away.results.push(!homeWon);
    }
  }
  return members.map(member => {
    const value = stats[member.id];
    const played = value.wins + value.losses + value.ties;
    const winPercentage = played ? (value.wins + value.ties * .5) / played : 0;
    const teamRatings = ratingsFor(member);
    const last = value.results.at(-1);
    let streakCount = 0;
    if (last !== undefined) for (let index=value.results.length-1; index>=0 && value.results[index]===last; index--) streakCount++;
    return {
      rank:1, memberId:member.id, memberName:member.userName, memberAvatar:member.userAvatar, isAi:member.isAi,
      wins:value.wins, losses:value.losses, ties:value.ties, winPercentage,
      pointsFor:value.pf, pointsAgainst:value.pa, pointDifferential:value.pf-value.pa,
      teamRating:teamRatings.overall, streak:last === undefined ? '-' : `${last ? 'W' : 'L'}${streakCount}`,
    };
  }).sort((a,b) => b.winPercentage-a.winPercentage || b.pointDifferential-a.pointDifferential || b.pointsFor-a.pointsFor || b.teamRating-a.teamRating)
    .map((standing,index) => ({...standing,rank:index+1}));
}

export function simulateFantasyPlayoffs(
  members: LeagueMember[],
  standings: StandingItem[],
  playoffTeams: 4|6|8 = 6,
  firstWeek = 18,
  style: 'realistic'|'balanced'|'chaos' = 'realistic',
): { games: SimulationGame[]; championMemberId: string } {
  const count = Math.min(playoffTeams, members.length >= 8 ? 8 : members.length >= 6 ? 6 : 4);
  let field = standings.slice(0,count).map(row => members.find(member => member.id === row.memberId)).filter(Boolean) as LeagueMember[];
  const games: SimulationGame[] = [];
  let week = firstWeek;
  let firstRound = true;
  const variance = style === 'chaos' ? 1.55 : style === 'balanced' ? 1.2 : .9;
  while (field.length > 1) {
    const advancing: LeagueMember[] = [];
    let playing = field;
    if (firstRound && field.length === 6) {
      advancing.push(field[0], field[1]);
      playing = field.slice(2);
    }
    const round = field.length <= 2 ? 'championship' : field.length <= 4 ? 'semifinal' : 'quarterfinal';
    for (let left=0, right=playing.length-1; left<right; left++, right--) {
      const game = {...simulateGame(week, playing[left], playing[right], variance), playoffRound:round} as SimulationGame;
      games.push(game);
      advancing.push(members.find(member => member.id === game.winnerId)!);
    }
    field = advancing.sort((a,b) => standings.findIndex(row => row.memberId===a.id)-standings.findIndex(row => row.memberId===b.id));
    firstRound = false;
    week++;
  }
  return {games, championMemberId:field[0]?.id || standings[0]?.memberId};
}

export function simulateFantasyWeek(
  members: LeagueMember[],
  week: number,
  style: 'realistic'|'balanced'|'chaos' = 'realistic',
): SimulationGame[] {
  const pairings=buildFantasyWeekPairings(members,week);
  const memberById=new Map(members.map(member=>[member.id,member]));
  const variance=style==='chaos'?1.55:style==='balanced'?1.2:.9;
  return pairings.map(pairing=>simulateGame(
    week,
    memberById.get(pairing.homeMemberId)!,
    memberById.get(pairing.awayMemberId)!,
    variance,
  ));
}

export type FantasyWeekPairing = Pick<SimulationGame,'id'|'week'|'homeMemberId'|'awayMemberId'>;

export type FantasyWeeklyScoreRecord = {
  memberId:string;
  week:number;
  livePoints:number;
  isFinal:boolean;
};

export type ScoredFantasyPostseason = {
  seeds: StandingItem[];
  matchups: Array<FantasyWeekPairing & { playoffRound: NonNullable<SimulationGame['playoffRound']> }>;
  games: SimulationGame[];
  championMemberId?: string;
  nextWeek: number;
  complete: boolean;
};

const scoreFor = (scores: FantasyWeeklyScoreRecord[], memberId: string, week: number) =>
  scores.find(score => score.memberId === memberId && score.week === week && score.isFinal);

function scoredPlayoffGame(
  homeMemberId: string,
  awayMemberId: string,
  week: number,
  playoffRound: NonNullable<SimulationGame['playoffRound']>,
  scores: FantasyWeeklyScoreRecord[],
  seedByMember: Map<string, number>,
): SimulationGame | null {
  const home = scoreFor(scores, homeMemberId, week);
  const away = scoreFor(scores, awayMemberId, week);
  if (!home || !away) return null;
  const homeScore = Number(home.livePoints) || 0;
  const awayScore = Number(away.livePoints) || 0;
  // Fantasy playoff ties advance the better regular-season seed. This keeps the
  // bracket deterministic without pretending a tied playoff score was a draw.
  const homeWins = homeScore > awayScore || (
    homeScore === awayScore && (seedByMember.get(homeMemberId) || 999) < (seedByMember.get(awayMemberId) || 999)
  );
  const winnerId = homeWins ? homeMemberId : awayMemberId;
  const loserId = homeWins ? awayMemberId : homeMemberId;
  return {
    id: `fantasy-playoff-w${week}-${homeMemberId}-vs-${awayMemberId}`,
    week,
    homeMemberId,
    awayMemberId,
    homeScore,
    awayScore,
    winnerId,
    loserId,
    isTie: false,
    playoffRound,
    keyMatchupFactor: homeScore === awayScore
      ? 'Tied playoff score — the higher regular-season seed advanced.'
      : 'Official fantasy playoff score.',
  };
}

/**
 * Builds a scored fantasy postseason without inventing results. For a six-team
 * field, seeds 1–2 receive byes, seeds 3–6 play in Week 18, the field reseeds
 * for the semifinals, and the two semifinal winners meet for the title.
 */
export function buildScoredFantasyPlayoffs(
  standings: StandingItem[],
  scores: FantasyWeeklyScoreRecord[],
  playoffTeams: 4|6|8 = 6,
  regularSeasonWeeks = 17,
): ScoredFantasyPostseason {
  const supportedCount = standings.length >= 8 ? 8 : standings.length >= 6 ? 6 : Math.min(4, standings.length);
  const count = Math.min(playoffTeams, supportedCount);
  const seeds = standings.slice(0, count);
  const seedByMember = new Map(seeds.map((standing, index) => [standing.memberId, index + 1]));
  const games: SimulationGame[] = [];
  const matchups: ScoredFantasyPostseason['matchups'] = [];
  let field = seeds.map(seed => seed.memberId);
  let week = regularSeasonWeeks + 1;
  let firstRound = true;

  while (field.length > 1) {
    const advancing: string[] = [];
    let playing = field;
    if (firstRound && field.length === 6) {
      advancing.push(field[0], field[1]);
      playing = field.slice(2);
    }
    const playoffRound: NonNullable<SimulationGame['playoffRound']> = field.length <= 2
      ? 'championship'
      : field.length <= 4
        ? 'semifinal'
        : 'quarterfinal';
    const roundGames: SimulationGame[] = [];
    for (let left = 0, right = playing.length - 1; left < right; left++, right--) {
      matchups.push({
        id: `fantasy-playoff-w${week}-${playing[left]}-vs-${playing[right]}`,
        week,
        homeMemberId: playing[left],
        awayMemberId: playing[right],
        playoffRound,
      });
      const game = scoredPlayoffGame(playing[left], playing[right], week, playoffRound, scores, seedByMember);
      if (game) roundGames.push(game);
    }
    games.push(...roundGames);
    if (roundGames.length !== playing.length / 2) {
      return { seeds, matchups, games, nextWeek: week, complete: false };
    }
    advancing.push(...roundGames.map(game => game.winnerId));
    field = advancing.sort((a, b) => (seedByMember.get(a) || 999) - (seedByMember.get(b) || 999));
    firstRound = false;
    week++;
  }

  return {
    seeds,
    matchups,
    games,
    championMemberId: field[0],
    nextWeek: Math.max(regularSeasonWeeks + 1, week - 1),
    complete: Boolean(field[0]),
  };
}

export function resolveSeasonChampion(result?: Pick<SeasonResult, 'championMemberId'|'winnerAnalysis'|'standings'>): StandingItem | undefined {
  if (!result) return undefined;
  // Never infer a fantasy champion from the regular-season standings. Older
  // saves without a recorded playoff winner should show no champion instead of
  // quietly awarding the title to the #1 seed.
  const championId = result.championMemberId;
  return championId ? result.standings.find(standing => standing.memberId === championId) : undefined;
}

export function buildFantasyWeekPairings(members: LeagueMember[], week: number): FantasyWeekPairing[] {
  if (members.length < 2 || members.length % 2 !== 0) throw new Error('Fantasy weeks require an even number of teams.');
  const rotation=[...members];
  const round=(week-1)%(members.length-1);
  for(let index=0;index<round;index++) rotation.splice(1,0,rotation.pop()!);
  const reverse=Math.floor((week-1)/(members.length-1))%2===1;
  const games:FantasyWeekPairing[]=[];
  for(let index=0;index<members.length/2;index++){
    const first=rotation[index];
    const second=rotation[members.length-1-index];
    const alternate=round%2===0;
    const home=(alternate!==reverse)?first:second;
    const away=home.id===first.id?second:first;
    games.push({id:`game-w${week}-${home.id}-vs-${away.id}`,week,homeMemberId:home.id,awayMemberId:away.id});
  }
  return games;
}

export function buildScoredFantasyGames(
  members: LeagueMember[],
  weeks: number,
  scores: FantasyWeeklyScoreRecord[],
): SimulationGame[] {
  const schedule=Array.from({length:weeks},(_,index)=>buildFantasyWeekPairings(members,index+1)).flat();
  return schedule.flatMap(pairing=>{
    const home=scores.find(score=>score.week===pairing.week&&score.memberId===pairing.homeMemberId);
    const away=scores.find(score=>score.week===pairing.week&&score.memberId===pairing.awayMemberId);
    if(!home?.isFinal||!away?.isFinal)return [];
    const homeScore=Number(home.livePoints)||0;
    const awayScore=Number(away.livePoints)||0;
    const isTie=homeScore===awayScore;
    return [{
      ...pairing,
      homeScore,
      awayScore,
      winnerId:isTie?'':homeScore>awayScore?pairing.homeMemberId:pairing.awayMemberId,
      loserId:isTie?'':homeScore>awayScore?pairing.awayMemberId:pairing.homeMemberId,
      isTie,
      keyMatchupFactor:'Official weekly fantasy score.',
    }];
  });
}

export function simulateFullSeason(members: LeagueMember[], targetGames: 16 | 17 = 17, style: 'realistic'|'balanced'|'chaos' = 'realistic'): SeasonResult {
  if (members.length < 2) throw new Error('At least 2 members required to simulate');

  const preparedMembers = members.map(m => ({
    ...m,
    teamRatings: ratingsFor(m),
  }));

  const games: SimulationGame[] = [];
  const TARGET_GAMES = targetGames;
  const varianceMultiplier = style === 'chaos' ? 1.55 : style === 'balanced' ? 1.2 : 0.9;
  const numMembers = preparedMembers.length;

  // Fair round-robin scheduler. Even-sized leagues repeat rounds as needed so every
  // team gets exactly the configured number of games, reversing home/away by cycle.
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
    // Odd-sized leagues use a rotating bye and continue until every team has
    // exactly the configured number of played games; no phantom extra matchup.
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

  const statsMap: Record<string, { wins: number; losses: number; ties: number; pf: number; pa: number; streak: string; lastResults: boolean[] }> = {};
  preparedMembers.forEach(m => { statsMap[m.id] = { wins: 0, losses: 0, ties: 0, pf: 0, pa: 0, streak: '', lastResults: [] }; });

  games.forEach(g => {
    const home = statsMap[g.homeMemberId];
    const away = statsMap[g.awayMemberId];
    if (home) {
      home.pf += g.homeScore; home.pa += g.awayScore;
      if (g.winnerId === g.homeMemberId) { home.wins += 1; home.lastResults.push(true); }
      else { home.losses += 1; home.lastResults.push(false); }
    }
    if (away) {
      away.pf += g.awayScore; away.pa += g.homeScore;
      if (g.winnerId === g.awayMemberId) { away.wins += 1; away.lastResults.push(true); }
      else { away.losses += 1; away.lastResults.push(false); }
    }
  });

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

  const standings: StandingItem[] = preparedMembers
    .map(m => {
      const s = statsMap[m.id];
      const totalGames = s.wins + s.losses + s.ties;
      const winPct = totalGames > 0 ? (s.wins + 0.5 * s.ties) / totalGames : 0;
      const diff = s.pf - s.pa;
      const teamRatings = ratingsFor(m);
      const diffPerGame = totalGames > 0 ? diff / totalGames : 0;
      const ballKnowerScore = Math.round(Math.max(0, Math.min(100,
        winPct * 38 + teamRatings.overall * 0.24 + teamRatings.balanceScore * 0.16 +
        teamRatings.efficiencyRating * 0.12 + Math.max(0, Math.min(10, 5 + diffPerGame * 0.65))
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
    .map((item, idx) => ({ ...item, rank: idx + 1 }));

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
  if (winnerRatings.passProtection >= 88) keyFactors.push('Elite pass protection allowed the quarterback to consistently attack downfield without feeling pocket duress.');
  if (winnerRatings.coverage >= 88) keyFactors.push(`His roster had no major defensive weakness, locking down opposing WR1s across all ${TARGET_GAMES} matchups.`);
  if (winnerRatings.balanceScore >= 80) keyFactors.push('Instead of overspending on one flashy superstar, he built one of the league’s most balanced, disciplined 20-man rosters.');
  if (winnerRatings.passRush >= 88) keyFactors.push('His defensive line consistently created backfield disruption against weaker offensive lines in critical 4th quarter drives.');
  if (keyFactors.length === 0) keyFactors.push('Superior high-efficiency depth and flawless situational execution across one-score contests.');

  const winnerAnalysis: WinnerAnalysis = {
    winnerId: winner.memberId,
    winnerName: winner.memberName,
    summary: `${winner.memberName} won the ${TARGET_GAMES}-game Ball Knower season with a ${winner.wins}-${winner.losses} record (${winner.pointDifferential >= 0 ? '+' : ''}${winner.pointDifferential} point differential) and earned the #1 overall pick in the fantasy football draft!`,
    keyFactors,
  };

  const teamReports: Record<string, ReturnType<typeof generateTeamReport>> = {};
  preparedMembers.forEach(m => { teamReports[m.id] = generateTeamReport(m.id, m.userName, m.roster || []); });

  return {
    completedAt: new Date().toISOString(),
    standings,
    games,
    draftOrder,
    winnerAnalysis,
    teamReports,
  };
}
