/** Canonical display keys; the scoring engine continues to own scoring rules. */
export const GAME_LOG_STAT_KEYS: Record<string, string[]> = {
  QB: ['passingAttempts', 'passingCompletions', 'passingYards', 'passingTouchdowns', 'interceptionsThrown', 'rushingAttempts', 'rushingYards', 'rushingTouchdowns', 'fumblesLost'],
  RB: ['rushingAttempts', 'rushingYards', 'rushingTouchdowns', 'targets', 'receptions', 'receivingYards', 'receivingTouchdowns', 'fumblesLost'],
  WR: ['targets', 'receptions', 'receivingYards', 'receivingTouchdowns', 'rushingAttempts', 'rushingYards', 'rushingTouchdowns', 'fumblesLost'],
  TE: ['targets', 'receptions', 'receivingYards', 'receivingTouchdowns', 'rushingAttempts', 'rushingYards', 'fumblesLost'],
  K: ['fieldGoalsAttempted', 'fieldGoalsMade', 'fieldGoalsMissed', 'extraPointsAttempted', 'extraPointsMade', 'extraPointsMissed'],
  DST: ['sacks', 'interceptions', 'fumbleRecoveries', 'defensiveTouchdowns', 'returnTouchdowns', 'safeties', 'blockedKicks', 'pointsAllowed'],
};
export const GAME_LOG_STAT_LABELS: Record<string, string> = {
  passingAttempts: 'Pass Att', passingCompletions: 'Cmp', passingYards: 'Pass Yds', passingTouchdowns: 'Pass TD', interceptionsThrown: 'INT',
  rushingAttempts: 'Rush Att', rushingYards: 'Rush Yds', rushingTouchdowns: 'Rush TD', targets: 'Targets', receptions: 'Rec', receivingYards: 'Rec Yds', receivingTouchdowns: 'Rec TD', fumblesLost: 'FL',
  fieldGoalsAttempted: 'FG Att', fieldGoalsMade: 'FG', fieldGoalsMissed: 'FG Miss', extraPointsAttempted: 'XP Att', extraPointsMade: 'XP', extraPointsMissed: 'XP Miss',
  sacks: 'Sacks', interceptions: 'INT', fumbleRecoveries: 'FR', defensiveTouchdowns: 'DEF TD', returnTouchdowns: 'Return TD', safeties: 'Safeties', blockedKicks: 'Blk', pointsAllowed: 'Pts Allowed',
};
const ALIASES: Record<string, string[]> = {
  passingAttempts: ['passAttempts'], passingCompletions: ['passCompletions', 'completions'],
  passingYards: ['passYards', 'passYds'], passingTouchdowns: ['passTd', 'passTD', 'passingTd', 'passingTD', 'passingTDs'],
  interceptionsThrown: ['passingInterceptions'], rushingAttempts: ['rushAttempts', 'carries'], rushingYards: ['rushYards', 'rushYds'], rushingTouchdowns: ['rushTd', 'rushTD', 'rushingTd', 'rushingTD', 'rushingTDs'],
  receivingYards: ['recYards', 'recYds'], receivingTouchdowns: ['recTd', 'recTD', 'receivingTd', 'receivingTD', 'receivingTDs'],
  fieldGoalsAttempted: ['fgAttempts', 'fgAtt'], fieldGoalsMade: ['fgMade'], fieldGoalsMissed: ['fgMissed'], extraPointsAttempted: ['xpAttempts', 'xpAtt'], extraPointsMade: ['xpMade'], extraPointsMissed: ['xpMissed'],
  fumbleRecoveries: ['fumblesRecovered'], defensiveTouchdowns: ['defTD'], returnTouchdowns: ['returnTD'], pointsAllowed: ['ptsAllowed'], blockedKicks: ['blockKick'],
};
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const normalizePosition = (position: string) => position === 'FB' ? 'RB' : ['D/ST', 'DEF'].includes(position) ? 'DST' : position;

export function canonicalGameLogStats(stats: Record<string, unknown>, position: string): Record<string, unknown> {
  const result = { ...stats };
  const aliases = { ...ALIASES };
  // An interception thrown by a QB is not an interception made by a defense.
  if (normalizePosition(position) !== 'DST') aliases.interceptionsThrown = [...ALIASES.interceptionsThrown, 'interceptions', 'int'];
  else aliases.interceptions = ['defensiveInterceptions'];
  for (const [canonical, names] of Object.entries(aliases)) {
    const known = [canonical, ...names].find(key => finite(stats[key]));
    if (known) result[canonical] = stats[known];
    for (const alias of names) delete result[alias];
  }
  return result;
}

export function gameLogColumns(position: string, statRows: Record<string, unknown>[]): string[] {
  const defaults = GAME_LOG_STAT_KEYS[normalizePosition(position)] || [];
  const extra = new Set<string>();
  const positionSpecific = new Set(Object.values(GAME_LOG_STAT_KEYS).flat());
  for (const row of statRows) {
    for (const [key, value] of Object.entries(canonicalGameLogStats(row, position))) {
      if (finite(value) && !defaults.includes(key) && (!positionSpecific.has(key) || value !== 0)) extra.add(key);
    }
  }
  // Keep position metrics first and retain additional real stats, including
  // actual zeros. Never cap the table at six arbitrary nonzero fields.
  return [...defaults, ...[...extra].sort()];
}
