export type FantasyScoringFormat = 'standard' | 'half_ppr' | 'ppr';

export type FantasyStatLine = {
  passingAttempts?: number;
  passingCompletions?: number;
  passingYards: number;
  passingTouchdowns: number;
  interceptionsThrown: number;
  rushingAttempts?: number;
  rushingYards: number;
  rushingTouchdowns: number;
  targets?: number;
  receivingYards: number;
  receivingTouchdowns: number;
  receptions: number;
  twoPointConversions: number;
  fumblesLost: number;
  returnTouchdowns: number;
  fieldGoalsMade: number;
  fieldGoalsMissed: number;
  fieldGoalsAttempted?: number;
  extraPointsMade: number;
  extraPointsMissed: number;
  extraPointsAttempted?: number;
};

export type DefenseStatLine = {
  sacks: number;
  interceptions: number;
  fumbleRecoveries: number;
  defensiveTouchdowns: number;
  returnTouchdowns: number;
  safeties: number;
  blockedKicks: number;
  pointsAllowed: number;
};

export type ScoringBreakdown = {
  format: FantasyScoringFormat;
  total: number;
  categories: Record<string, number>;
};

const numeric = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '0'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const rounded = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

const firstNumber = (...values: unknown[]): number => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return numeric(value);
  }
  return 0;
};

const optionalFirstNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return numeric(value);
  }
  return undefined;
};

const attemptedFromKnownParts=(made:unknown,missed:unknown):number|undefined=>{
  const madeValue=optionalFirstNumber(made);
  const missedValue=optionalFirstNumber(missed);
  return madeValue===undefined&&missedValue===undefined?undefined:(madeValue||0)+(missedValue||0);
};

export function normalizeScoringFormat(value: unknown): FantasyScoringFormat {
  const normalized = String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  if (normalized === 'standard') return 'standard';
  if (normalized === 'halfppr') return 'half_ppr';
  return 'ppr';
}

export function normalizeTank01PlayerStats(rawValue: unknown): FantasyStatLine {
  const raw = object(rawValue);
  const passing = object(raw.Passing ?? raw.passing);
  const rushing = object(raw.Rushing ?? raw.rushing);
  const receiving = object(raw.Receiving ?? raw.receiving);
  const defense = object(raw.Defense ?? raw.defense);
  const kicking = object(raw.Kicking ?? raw.kicking);

  const categorizedTwoPointConversions = [
    passing.passingTwoPointConversion,
    rushing.rushingTwoPointConversion,
    receiving.receivingTwoPointConversion,
  ].reduce<number>((sum,value)=>sum+numeric(value),0);
  const passingAttempts=optionalFirstNumber(passing.passAttempts,passing.passingAttempts,passing.att,raw.passAttempts,raw.passingAttempts);
  const passingCompletions=optionalFirstNumber(passing.passCompletions,passing.completions,passing.cmp,raw.passCompletions,raw.completions);
  const rushingAttempts=optionalFirstNumber(rushing.rushAttempts,rushing.rushingAttempts,rushing.carries,rushing.att,raw.rushAttempts,raw.rushingAttempts,raw.carries);
  const targets=optionalFirstNumber(receiving.targets,raw.targets);
  const fgMadeSource=kicking.fgMade??kicking.fieldGoalsMade??raw.fgMade??raw.fieldGoalsMade;
  const fgMissedSource=kicking.fgMissed??kicking.fieldGoalsMissed??raw.fgMissed??raw.fieldGoalsMissed;
  const xpMadeSource=kicking.xpMade??kicking.extraPointsMade??raw.xpMade??raw.extraPointsMade;
  const xpMissedSource=kicking.xpMissed??kicking.extraPointsMissed??raw.xpMissed??raw.extraPointsMissed;

  return {
    ...(passingAttempts===undefined?{}:{passingAttempts}),
    ...(passingCompletions===undefined?{}:{passingCompletions}),
    passingYards: firstNumber(passing.passYds, passing.passingYards, raw.passYds,raw.passingYards),
    passingTouchdowns: firstNumber(passing.passTD, passing.passingTDs, raw.passTD,raw.passingTouchdowns),
    interceptionsThrown: firstNumber(passing.int, passing.interceptions, raw.int,raw.interceptionsThrown),
    ...(rushingAttempts===undefined?{}:{rushingAttempts}),
    rushingYards: firstNumber(rushing.rushYds, rushing.rushingYards, raw.rushYds,raw.rushingYards),
    rushingTouchdowns: firstNumber(rushing.rushTD, rushing.rushingTDs, raw.rushTD,raw.rushingTouchdowns),
    ...(targets===undefined?{}:{targets}),
    receivingYards: firstNumber(receiving.recYds, receiving.receivingYards, raw.recYds,raw.receivingYards),
    receivingTouchdowns: firstNumber(receiving.recTD, receiving.receivingTDs, raw.recTD,raw.receivingTouchdowns),
    receptions: firstNumber(receiving.receptions, raw.receptions),
    twoPointConversions: categorizedTwoPointConversions || firstNumber(raw.twoPointConversion,raw.twoPointConversions),
    fumblesLost: firstNumber(defense.fumblesLost, raw.fumblesLost),
    returnTouchdowns: firstNumber(raw.returnTD, raw.returnTouchdowns, raw.specialTeamsTD),
    fieldGoalsMade: firstNumber(fgMadeSource),
    fieldGoalsMissed: firstNumber(fgMissedSource),
    ...(attemptedFromKnownParts(fgMadeSource,fgMissedSource)===undefined?{}:{fieldGoalsAttempted:attemptedFromKnownParts(fgMadeSource,fgMissedSource)}),
    extraPointsMade: firstNumber(xpMadeSource),
    extraPointsMissed: firstNumber(xpMissedSource),
    ...(attemptedFromKnownParts(xpMadeSource,xpMissedSource)===undefined?{}:{extraPointsAttempted:attemptedFromKnownParts(xpMadeSource,xpMissedSource)}),
  };
}

export function normalizeTank01DefenseStats(rawValue: unknown): DefenseStatLine {
  const raw = object(rawValue);
  return {
    sacks: firstNumber(raw.sacks),
    interceptions: firstNumber(raw.defensiveInterceptions, raw.interceptions),
    fumbleRecoveries: firstNumber(raw.fumblesRecovered, raw.fumbleRecoveries),
    defensiveTouchdowns: firstNumber(raw.defTD, raw.defensiveTouchdowns),
    returnTouchdowns: firstNumber(raw.returnTD, raw.returnTouchdowns),
    safeties: firstNumber(raw.safeties),
    blockedKicks: firstNumber(raw.blockKick, raw.blockedKicks),
    pointsAllowed: firstNumber(raw.ptsAllowed, raw.pointsAllowed),
  };
}

export function scoreFantasyPlayer(stats: FantasyStatLine, format: FantasyScoringFormat): ScoringBreakdown {
  const receptionValue = format === 'ppr' ? 1 : format === 'half_ppr' ? 0.5 : 0;
  const categories = {
    passingYards: stats.passingYards / 25,
    passingTouchdowns: stats.passingTouchdowns * 4,
    interceptionsThrown: stats.interceptionsThrown * -2,
    rushingYards: stats.rushingYards / 10,
    rushingTouchdowns: stats.rushingTouchdowns * 6,
    receivingYards: stats.receivingYards / 10,
    receivingTouchdowns: stats.receivingTouchdowns * 6,
    receptions: stats.receptions * receptionValue,
    twoPointConversions: stats.twoPointConversions * 2,
    fumblesLost: stats.fumblesLost * -2,
    returnTouchdowns: stats.returnTouchdowns * 6,
    fieldGoalsMade: stats.fieldGoalsMade * 3,
    fieldGoalsMissed: stats.fieldGoalsMissed * -1,
    extraPointsMade: stats.extraPointsMade,
    extraPointsMissed: stats.extraPointsMissed * -1,
  };
  const total = Object.values(categories).reduce((sum, points) => sum + points, 0);
  return {
    format,
    total: rounded(total),
    categories: Object.fromEntries(Object.entries(categories).map(([key, value]) => [key, rounded(value)])),
  };
}

function defensePointsAllowed(pointsAllowed: number): number {
  if (pointsAllowed <= 0) return 10;
  if (pointsAllowed <= 6) return 7;
  if (pointsAllowed <= 13) return 4;
  if (pointsAllowed <= 20) return 1;
  if (pointsAllowed <= 27) return 0;
  if (pointsAllowed <= 34) return -1;
  return -4;
}

export function scoreFantasyDefense(stats: DefenseStatLine): number {
  return rounded(
    stats.sacks
    + stats.interceptions * 2
    + stats.fumbleRecoveries * 2
    + stats.defensiveTouchdowns * 6
    + stats.returnTouchdowns * 6
    + stats.safeties * 2
    + stats.blockedKicks * 2
    + defensePointsAllowed(stats.pointsAllowed),
  );
}

export function allFormatScores(rawStats: unknown): Record<FantasyScoringFormat, number> {
  const stats = normalizeTank01PlayerStats(rawStats);
  return {
    standard: scoreFantasyPlayer(stats, 'standard').total,
    half_ppr: scoreFantasyPlayer(stats, 'half_ppr').total,
    ppr: scoreFantasyPlayer(stats, 'ppr').total,
  };
}

export function normalizePlayerName(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function isFinalGameStatus(value: unknown): boolean {
  const status = String(value || '').trim().toLowerCase();
  return status === 'final' || status === 'completed' || status.includes('game over');
}

export function isLiveGameStatus(value: unknown): boolean {
  const status = String(value || '').trim().toLowerCase();
  return !isFinalGameStatus(status) && (
    status.includes('progress')
    || status.includes('live')
    || /^q[1-4]$/.test(status)
    || status.includes('halftime')
    || status.includes('overtime')
  );
}

export function kickoffIsoFromTank01Game(gameValue: unknown): string | null {
  const game = object(gameValue);
  const epoch = firstNumber(game.gameTime_epoch, game.gameTimeEpoch, game.kickoffEpoch);
  if (epoch > 0) {
    const milliseconds = epoch > 10_000_000_000 ? epoch : epoch * 1000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

export function liveProjectedPoints(
  actualPoints: number,
  pregameProjection: number,
  gameStatus: unknown,
  periodValue: unknown,
): number {
  if (isFinalGameStatus(gameStatus)) return rounded(actualPoints);
  if (!isLiveGameStatus(gameStatus)) return rounded(pregameProjection);
  const periodText = String(periodValue || '').toLowerCase();
  const period = periodText.includes('half') ? 2 : Math.max(1, Math.min(5, numeric(periodText.replace(/[^0-9]/g, '')) || 1));
  const remaining = period >= 5 ? 0.08 : Math.max(0.08, 1 - period / 4);
  return rounded(actualPoints + Math.max(0, pregameProjection * remaining));
}

export function scoreForFormat(
  scores: Partial<Record<FantasyScoringFormat, unknown>> | null | undefined,
  format: FantasyScoringFormat,
): number {
  return numeric(scores?.[format]);
}
