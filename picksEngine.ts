export type PickResult = 'win' | 'loss' | 'push';
export type PicksGame = {
  id: string;
  date?: string | null;
  status?: string | null;
  away: string;
  home: string;
  spread?: number | null;
  homeSpread?: number | null;
  awaySpread?: number | null;
  overUnder?: number | null;
  awayScore?: number | null;
  homeScore?: number | null;
};

export type SavedPick = {
  id: string;
  gameId: string;
  label: string;
  market: 'spread' | 'total';
  selection: string;
  lockedLine: number;
  lockedAt: string;
  result?: PickResult;
  gradedAt?: string;
  finalAwayScore?: number;
  finalHomeScore?: number;
};

export function normalizeSpread(raw: number | null | undefined) {
  if (!Number.isFinite(raw)) return { home: null, away: null };
  const value = Number(raw);
  if (value === 0) return { home: 0, away: 0 };
  return value > 0 ? { home: -value, away: value } : { home: Math.abs(value), away: -Math.abs(value) };
}

export function spreadLabel(team: string, line: number) {
  return `${team} ${line === 0 ? 'PK' : `${line > 0 ? '+' : ''}${line}`}`;
}

export function isPicksGameLocked(game: PicksGame, now = Date.now()) {
  if (/final/i.test(game.status || '')) return true;
  const date = game.date || '';
  if (!/T\d{2}:\d{2}/.test(date)) return false;
  const kickoff = Date.parse(date);
  return Number.isFinite(kickoff) && kickoff <= now;
}

export function gradePick(pick: SavedPick, game: PicksGame, gradedAt = new Date().toISOString()): SavedPick {
  if (pick.result) return pick;
  if (!/final/i.test(game.status || '') || !Number.isFinite(game.awayScore) || !Number.isFinite(game.homeScore)) return pick;
  const away = Number(game.awayScore);
  const home = Number(game.homeScore);
  let margin: number;
  if (pick.market === 'total') {
    margin = pick.selection === 'over' ? away + home - pick.lockedLine : pick.lockedLine - (away + home);
  } else {
    const selectedHome = pick.selection === game.home;
    const selectedScore = selectedHome ? home : away;
    const opponentScore = selectedHome ? away : home;
    margin = selectedScore + pick.lockedLine - opponentScore;
  }
  return {
    ...pick,
    result: margin > 0 ? 'win' : margin < 0 ? 'loss' : 'push',
    gradedAt,
    finalAwayScore: away,
    finalHomeScore: home,
  };
}

export function normalizeSavedPick(value: any): SavedPick | null {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || typeof value.gameId !== 'string'
    || typeof value.label !== 'string' || !['spread', 'total'].includes(value.market)
    || typeof value.selection !== 'string' || !Number.isFinite(value.lockedLine)) return null;
  return {
    ...value,
    lockedLine: Number(value.lockedLine),
    lockedAt: typeof value.lockedAt === 'string' ? value.lockedAt : new Date(0).toISOString(),
    result: ['win', 'loss', 'push'].includes(value.result) ? value.result : undefined,
  };
}
