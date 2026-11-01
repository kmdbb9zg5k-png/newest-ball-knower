import { nflverseCsv, normalizeTeam, requireColumns } from './nflverse-csv.js';
import { NFLVERSE_SCHEDULE_URL, normalizeScheduleRows, type NflverseGame } from './nflverse-schedule.js';

const SEASON = 2026;
const CACHE_AGE = 300_000;
type ScheduleGame = NflverseGame & { scheduleDate: string };
type Snapshot = { items: ScheduleGame[]; updatedAt: string; sourceUpdatedAt: string | null };
type StoredGame = {
  provider_game_id: string; season: number; season_type: string; week_number: number;
  away_team: string; home_team: string; kickoff_at: string;
};
type InsertGame = StoredGame & { game_status: string; is_live: false; is_final: false };
const fail = (code: string): never => { throw new Error(code); };
const matchup = (week: number, away: string, home: string) => `${week}|${away}|${home}`;
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const easternDate = (value: string) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

/** Schedule completeness proves opponents, not completeness of player statistics. */
export function validateFantasySchedule(items: ScheduleGame[], season = SEASON): ScheduleGame[] {
  if (!Array.isArray(items) || items.length !== 272) fail('incomplete_regular_schedule');
  const ids = new Set<string>(), teamWeeks = new Set<string>(), matchups = new Set<string>();
  const weeks = new Set<number>(), counts = new Map<string, number>();
  for (const game of items) {
    if (!game || game.season !== season || !Number.isInteger(game.week) || game.week < 1 || game.week > 18
      || normalizeTeam(game.home) !== game.home || normalizeTeam(game.away) !== game.away || game.home === game.away
      || !validDate(game.scheduleDate) || game.scheduleDate < `${season}-08-01` || game.scheduleDate >= `${season + 1}-03-01`)
      fail('invalid_regular_schedule');
    const sourceId = /^(\d{4})_(\d{2})_([A-Z]{2,3})_([A-Z]{2,3})$/.exec(game.id);
    if (!sourceId || Number(sourceId[1]) !== season || Number(sourceId[2]) !== game.week
      || normalizeTeam(sourceId[3]) !== game.away || normalizeTeam(sourceId[4]) !== game.home)
      fail('invalid_regular_schedule_id');
    if (game.startTime !== null && (typeof game.startTime !== 'string'
      || !/T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(game.startTime)
      || !Number.isFinite(Date.parse(game.startTime)) || easternDate(game.startTime) !== game.scheduleDate))
      fail('invalid_regular_kickoff');
    const key = matchup(game.week, game.away, game.home);
    if (ids.has(game.id) || matchups.has(key)) fail('duplicate_regular_game');
    ids.add(game.id); matchups.add(key); weeks.add(game.week);
    for (const team of [game.home, game.away]) {
      const teamWeek = `${game.week}|${team}`;
      if (teamWeeks.has(teamWeek)) fail('duplicate_team_week');
      teamWeeks.add(teamWeek); counts.set(team, (counts.get(team) ?? 0) + 1);
    }
  }
  if (weeks.size !== 18 || counts.size !== 32 || [...counts.values()].some(count => count !== 17))
    fail('incomplete_regular_schedule');
  return items;
}

export function normalizeFantasySchedule(rows: Record<string, string>[], season = SEASON): ScheduleGame[] {
  requireColumns(rows, ['game_type', 'game_id', 'season', 'week', 'gameday', 'gametime', 'away_team', 'home_team', 'away_score', 'home_score']);
  const regular = rows.filter(row => Number(row.season) === season && row.game_type === 'REG');
  const normalized = normalizeScheduleRows(regular, season);
  if (normalized.length !== regular.length) fail('invalid_regular_schedule');
  const rawById = new Map(regular.map(row => [row.game_id, row]));
  return validateFantasySchedule(normalized.map(game => {
    const row = rawById.get(game.id)!;
    // Week 18 kickoffs may legitimately be unpublished. Never invent a time.
    if (game.startTime === null && !['', 'TBD'].includes(row.gametime)) fail('invalid_regular_kickoff');
    return { ...game, scheduleDate: row.gameday };
  }), season);
}

export async function loadFantasySchedule(fetchImpl: typeof fetch = fetch, now: () => number = Date.now): Promise<Snapshot> {
  const snapshot = await nflverseCsv(NFLVERSE_SCHEDULE_URL, rows => normalizeFantasySchedule(rows),
    CACHE_AGE, fetchImpl, now, 'fantasy-schedule-v1');
  // Saved snapshots are external input too; revalidate them before any game-table write.
  validateFantasySchedule(snapshot.items);
  return snapshot;
}

/** Preserve every established identity and kickoff. Existing rows are never updated. */
export function planFantasySchedule(items: ScheduleGame[], existing: StoredGame[], nowMs: number, season = SEASON) {
  validateFantasySchedule(items, season);
  const byMatchup = new Map(items.map(game => [matchup(game.week, game.away, game.home), game]));
  const storedByMatchup = new Map<string, StoredGame>(), storedIds = new Set<string>();
  for (const row of existing) {
    const away = normalizeTeam(row.away_team), home = normalizeTeam(row.home_team);
    const key = matchup(row.week_number, away ?? '', home ?? '');
    if (!row.provider_game_id || row.season !== season || row.season_type !== 'reg'
      || !byMatchup.has(key) || !Number.isFinite(Date.parse(row.kickoff_at))) fail('existing_schedule_conflict');
    if (storedByMatchup.has(key) || storedIds.has(row.provider_game_id)) fail('existing_schedule_conflict');
    storedByMatchup.set(key, row); storedIds.add(row.provider_game_id);
  }
  const inserts: InsertGame[] = [];
  const canonicalIds: Record<string, string> = {};
  let changedKickoffs = 0, pendingKickoffs = 0;
  for (const game of items) {
    const stored = storedByMatchup.get(matchup(game.week, game.away, game.home));
    if (stored) {
      canonicalIds[game.id] = stored.provider_game_id;
      if (game.startTime && Date.parse(stored.kickoff_at) !== Date.parse(game.startTime)) changedKickoffs++;
      continue;
    }
    if (!game.startTime) { pendingKickoffs++; continue; }
    const providerGameId = `nflverse:${game.id}`;
    if (storedIds.has(providerGameId)) fail('existing_schedule_conflict');
    canonicalIds[game.id] = providerGameId;
    inserts.push({ provider_game_id: providerGameId, season, season_type: 'reg', week_number: game.week,
      away_team: game.away, home_team: game.home, kickoff_at: game.startTime,
      game_status: Date.parse(game.startTime) <= nowMs ? 'Statistics unavailable' : 'Scheduled',
      is_live: false, is_final: false });
  }
  return { inserts, canonicalIds, existingGames: existing.length, changedKickoffs, pendingKickoffs };
}

/** Calendar context only: this never advances a league or certifies a completed week. */
export function fantasyScheduleContext(items: ScheduleGame[], nowMs: number) {
  const starts = Array.from({ length: 18 }, (_, index) => {
    const week = index + 1, games = items.filter(game => game.week === week);
    const dated = games.map(game => Date.parse(`${game.scheduleDate}T00:00:00Z`));
    return { week, date: Math.min(...dated) };
  });
  const started = starts.filter(start => start.date <= nowMs);
  return { week: started.at(-1)?.week ?? 1, season: SEASON, seasonType: 'reg',
    basis: 'schedule_dates', beforeSeason: started.length === 0, scoringWeekAdvanced: false };
}

type Dependencies = {
  getDb: () => any;
  loadSchedule?: () => Promise<Snapshot>;
  now?: () => number;
  getCronSecret?: () => string | undefined;
  canWrite?: () => boolean;
  log?: (code: string) => void;
};
const unavailableScoring = {
  available: false, reason: 'independent_statistics_not_configured', existingScoresPreserved: true,
  projectionsAvailable: false, historyBackfill: 'paused', leagueProgression: 'paused',
};

export function createFantasyScheduleHandler(deps: Dependencies) {
  const now = deps.now ?? Date.now;
  const load = deps.loadSchedule ?? (() => loadFantasySchedule(fetch, now));
  return async (req: any, res: any) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false, error: 'Method not allowed' }); }
    const secret = (deps.getCronSecret ?? (() => process.env.CRON_SECRET))();
    if (!secret || req.headers?.authorization !== `Bearer ${secret}`) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    try {
      const snapshot = await load();
      validateFantasySchedule(snapshot.items);
      const fetchedAt = Date.parse(snapshot.updatedAt);
      if (!Number.isFinite(fetchedAt) || fetchedAt > now() + 60_000 || now() - fetchedAt > CACHE_AGE)
        fail('schedule_unavailable');
      const db = deps.getDb();
      const result = await db.from('ball_knower_nfl_games')
        .select('provider_game_id,season,season_type,week_number,away_team,home_team,kickoff_at')
        .eq('season', SEASON).eq('season_type', 'reg');
      if (result.error || !Array.isArray(result.data)) fail('schedule_read_failed');
      const plan = planFantasySchedule(snapshot.items, result.data, now());
      const dryRun = req.query?.dryRun === '1' || !(deps.canWrite ?? (() => process.env.VERCEL_ENV === 'production'))();
      if (!dryRun && plan.inserts.length) {
        // One atomic insert batch; races on these deterministic IDs never update existing rows.
        const written = await db.from('ball_knower_nfl_games').upsert(plan.inserts,
          { onConflict: 'provider_game_id', ignoreDuplicates: true });
        if (written.error) fail('schedule_insert_failed');
      }
      const schedule = { provider: 'nflverse', freshness: 'periodic', status:
        plan.changedKickoffs ? 'existing_kickoffs_preserved' : plan.pendingKickoffs ? 'awaiting_kickoff_times'
          : plan.inserts.length ? (dryRun ? 'dry_run' : 'insert_attempted') : 'complete',
        games: snapshot.items.length, existingGames: plan.existingGames,
        missingGames: snapshot.items.length - plan.existingGames, insertableGames: plan.inserts.length,
        insertAttempts: dryRun ? 0 : plan.inserts.length, pendingKickoffs: plan.pendingKickoffs,
        changedKickoffsPreserved: plan.changedKickoffs, fetchedAt: snapshot.updatedAt, sourceUpdatedAt: snapshot.sourceUpdatedAt };
      return res.status(200).json({ ok: true, mode: 'schedule_only', dryRun, schedule,
        context: fantasyScheduleContext(snapshot.items, now()), scoring: unavailableScoring,
        gamesPolled: 0, playerRowsWritten: 0, leagueScoresWritten: 0, projectionSnapshotsWritten: 0,
        statCorrections: 0, checkedAt: new Date(now()).toISOString() });
    } catch (error) {
      const allowed = new Set(['incomplete_regular_schedule', 'invalid_regular_schedule', 'invalid_regular_schedule_id',
        'invalid_regular_kickoff', 'duplicate_regular_game', 'duplicate_team_week', 'existing_schedule_conflict',
        'schedule_read_failed', 'schedule_insert_failed']);
      const code = error instanceof Error && allowed.has(error.message) ? error.message : 'schedule_unavailable';
      (deps.log ?? (value => console.warn('fantasy-schedule-unavailable', { code: value })))(code);
      return res.status(503).json({ ok: false, mode: 'schedule_only', code,
        error: 'Schedule refresh is unavailable. Existing fantasy scores and lineups are preserved.', scoring: unavailableScoring });
    }
  };
}
