import { csvRecords, nflverseCsv, normalizeTeam, requireColumns } from './nflverse-csv.js';

/** nflverse schedules/scores are periodically published, not a live scoring feed. */
export const NFLVERSE_SCHEDULE_URL = 'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv';
const TTL = 300_000;
export type NflverseGame = { id: string; season: number; week: number; home: string; away: string; startTime: string | null; status: 'scheduled' | 'final' | 'unknown'; homeScore: number | null; awayScore: number | null };
const score = (value: string) => /^\d{1,3}$/.test(value) ? Number(value) : null;

/** nflverse gametime is US Eastern; never return an ambiguous device-local timestamp. */
export function easternKickoff(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const wall = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 10) !== date) return null;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  let utc = wall;
  for (let i = 0; i < 3; i++) {
    const part = Object.fromEntries(formatter.formatToParts(utc).map(p => [p.type, p.value]));
    const zoned = Date.parse(`${part.year}-${part.month}-${part.day}T${part.hour}:${part.minute}:${part.second}Z`);
    utc += wall - zoned;
  }
  return new Date(utc).toISOString();
}

export function normalizeScheduleRows(rows: Record<string, string>[], season = 2026): NflverseGame[] {
  requireColumns(rows, ['game_id', 'season', 'week', 'gameday', 'gametime', 'away_team', 'home_team', 'away_score', 'home_score']);
  const unique = new Map<string, NflverseGame>();
  for (const row of rows) {
    if (Number(row.season) !== season) continue;
    const home = normalizeTeam(row.home_team), away = normalizeTeam(row.away_team), week = Number(row.week);
    if (!home || !away || home === away || !Number.isInteger(week) || week < 1 || week > 22 || !/^\d{4}_\d{2}_[A-Z]{2,3}_[A-Z]{2,3}$/.test(row.game_id)) continue;
    const homeScore = score(row.home_score), awayScore = score(row.away_score);
    const startTime = easternKickoff(row.gameday, row.gametime);
    const game: NflverseGame = { id: row.game_id, season, week, home, away, startTime,
      status: homeScore !== null && awayScore !== null ? 'final' : startTime && homeScore === null && awayScore === null ? 'scheduled' : 'unknown', homeScore, awayScore };
    // Duplicate/conflicting rows are a provider schema failure, not a reliable schedule.
    if (unique.has(game.id)) throw new Error('duplicate_game');
    unique.set(game.id, game);
  }
  return [...unique.values()].sort((a, b) => a.week - b.week || a.id.localeCompare(b.id));
}
export function normalizeNflverseSchedule(csv: string, season = 2026): NflverseGame[] { return normalizeScheduleRows(csvRecords(csv), season); }
export async function getNflverseGames(fetchImpl: typeof fetch = fetch, now: () => number = Date.now) {
  return nflverseCsv(NFLVERSE_SCHEDULE_URL, rows => {
    const items = normalizeScheduleRows(rows);
    if (items.length < 272 || items.length > 400 || new Set(items.flatMap(g => [g.home, g.away])).size !== 32) throw new Error('nflverse_incomplete_schedule');
    return items;
  }, TTL, fetchImpl, now);
}
