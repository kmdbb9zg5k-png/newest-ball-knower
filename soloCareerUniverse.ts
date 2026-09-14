import { SOLO_FRANCHISE_SAVE_KEYS } from './soloFranchiseEngine';

export type SoloCareerMode = 'agent' | 'owner' | 'cap' | 'fantasy' | 'real' | 'player';

export type SoloCareerProfile = {
  level: number;
  xp: number;
  reputation: number;
  legacy: number;
  championships: number;
  decisions: number;
  achievements: string[];
};

export type SoloCareerSave = {
  id: string;
  mode: SoloCareerMode;
  title: string;
  subtitle: string;
  season: number;
  week: number;
  stage: string;
  wins: number;
  losses: number;
  championships: number;
  pressure: number;
  morale: number;
  createdAt: number;
  lastPlayedAt: number;
  resolvedEvents: string[];
};

export type SoloCareerHistoryItem = {
  id: string;
  saveId: string;
  mode: SoloCareerMode;
  season: number;
  week: number;
  title: string;
  detail: string;
  createdAt: number;
};

export type SoloUniverseState = {
  version: 1;
  profile: SoloCareerProfile;
  saves: SoloCareerSave[];
  activeSaveId: string | null;
  history: SoloCareerHistoryItem[];
};

export type SoloCareerChoice = {
  id: string;
  label: string;
  detail: string;
  xp: number;
  reputation: number;
  pressure: number;
  morale: number;
};

export type SoloCareerEvent = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  character: string;
  choices: SoloCareerChoice[];
};

type SoloCareerEventTemplate = Omit<SoloCareerEvent, 'id'>;

export const SOLO_UNIVERSE_KEY = 'ballknower_solo_universe_v1';
export const SOLO_CAREER_MODES: SoloCareerMode[] = ['agent', 'owner', 'cap', 'fantasy', 'real', 'player'];

const AGENT_SAVE_KEY = 'ballknower_player_agent_v4';
const OWNER_SAVE_KEY = 'ballknower_owner_career_v3';
const LIVE_EVENT_SUFFIX = '-live-';
const LIVE_EVENT_STEPS = 3;

export const SOLO_MODE_META: Record<SoloCareerMode, { title: string; subtitle: string }> = {
  agent: { title: 'Agent Mode', subtitle: 'Build your agency' },
  owner: { title: 'Owner Office', subtitle: 'Run the entire organization' },
  cap: { title: 'Cap Challenge', subtitle: 'Build under pressure' },
  fantasy: { title: 'Fantasy Draft', subtitle: 'Build a 53-man football world' },
  real: { title: 'Franchise Command', subtitle: 'Run football operations' },
  player: { title: 'My Player', subtitle: 'Build your career and legacy' },
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));
const asNumber = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const asString = (value: unknown, fallback = '') => typeof value === 'string' && value.trim() ? value.trim() : fallback;

function safeParse(storage: Storage, key: string) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function nowId(prefix: string, now: number) {
  return `${prefix}-${now}-${Math.random().toString(36).slice(2, 8)}`;
}

function weeklyBase(save: SoloCareerSave) {
  return `${save.mode}-${save.season}-${save.week || 0}`;
}

function liveEventId(save: SoloCareerSave, step: number) {
  return `${weeklyBase(save)}${LIVE_EVENT_SUFFIX}${step}`;
}

function chosenFor(save: SoloCareerSave, eventId: string) {
  const prefix = `${eventId}:choice:`;
  return save.resolvedEvents.find(item => item.startsWith(prefix))?.slice(prefix.length) ?? '';
}

function hasResolvedStep(save: SoloCareerSave, step: number) {
  const currentId = liveEventId(save, step);
  if (save.resolvedEvents.includes(currentId)) return true;
  // Migration from the original one-decision-per-week system: treat the legacy
  // event as the first live-week step so existing careers never replay a call.
  return step === 1 && save.resolvedEvents.includes(weeklyBase(save));
}

export function createSoloUniverseState(): SoloUniverseState {
  return {
    version: 1,
    profile: {
      level: 1,
      xp: 0,
      reputation: 50,
      legacy: 0,
      championships: 0,
      decisions: 0,
      achievements: [],
    },
    saves: [],
    activeSaveId: null,
    history: [],
  };
}

export function xpForLevel(level: number) {
  return Math.max(500, level * 500);
}

export function normalizeSoloUniverseState(value: unknown): SoloUniverseState {
  const fallback = createSoloUniverseState();
  if (!value || typeof value !== 'object') return fallback;
  const source = value as Partial<SoloUniverseState>;
  const profile = source.profile && typeof source.profile === 'object' ? source.profile : fallback.profile;
  const saves = Array.isArray(source.saves)
    ? source.saves
      .filter((save): save is SoloCareerSave => Boolean(save && SOLO_CAREER_MODES.includes(save.mode) && typeof save.id === 'string'))
      .map(save => ({
        ...save,
        title: asString(save.title, SOLO_MODE_META[save.mode].title),
        subtitle: asString(save.subtitle, SOLO_MODE_META[save.mode].subtitle),
        season: Math.max(1, Math.round(asNumber(save.season, 2026))),
        week: Math.max(0, Math.round(asNumber(save.week, 0))),
        stage: asString(save.stage, 'Preseason'),
        wins: Math.max(0, Math.round(asNumber(save.wins, 0))),
        losses: Math.max(0, Math.round(asNumber(save.losses, 0))),
        championships: Math.max(0, Math.round(asNumber(save.championships, 0))),
        pressure: clamp(asNumber(save.pressure, 35)),
        morale: clamp(asNumber(save.morale, 65)),
        createdAt: Math.max(0, asNumber(save.createdAt, Date.now())),
        lastPlayedAt: Math.max(0, asNumber(save.lastPlayedAt, Date.now())),
        resolvedEvents: Array.isArray(save.resolvedEvents)
          ? save.resolvedEvents.filter(item => typeof item === 'string').slice(-120)
          : [],
      }))
    : [];

  const normalizedProfile: SoloCareerProfile = {
    level: Math.max(1, Math.round(asNumber(profile.level, 1))),
    xp: Math.max(0, Math.round(asNumber(profile.xp, 0))),
    reputation: clamp(asNumber(profile.reputation, 50)),
    legacy: Math.max(0, Math.round(asNumber(profile.legacy, 0))),
    championships: Math.max(0, Math.round(asNumber(profile.championships, 0))),
    decisions: Math.max(0, Math.round(asNumber(profile.decisions, 0))),
    achievements: Array.isArray(profile.achievements)
      ? profile.achievements.filter(item => typeof item === 'string').slice(-100)
      : [],
  };

  return {
    version: 1,
    profile: normalizedProfile,
    saves,
    activeSaveId: typeof source.activeSaveId === 'string' && saves.some(save => save.id === source.activeSaveId)
      ? source.activeSaveId
      : [...saves].sort((first, second) => second.lastPlayedAt - first.lastPlayedAt)[0]?.id ?? null,
    history: Array.isArray(source.history)
      ? source.history
        .filter((item): item is SoloCareerHistoryItem => Boolean(item && typeof item.id === 'string' && typeof item.detail === 'string'))
        .slice(0, 180)
      : [],
  };
}

export function loadSoloUniverse(storage: Storage = window.localStorage) {
  return normalizeSoloUniverseState(safeParse(storage, SOLO_UNIVERSE_KEY));
}

export function persistSoloUniverse(state: SoloUniverseState, storage: Storage = window.localStorage) {
  try {
    storage.setItem(SOLO_UNIVERSE_KEY, JSON.stringify(normalizeSoloUniverseState(state)));
  } catch (error) {
    console.warn('Unable to save Solo universe progression', error);
  }
}

function stageLabel(value: unknown, fallback = 'Preseason') {
  const raw = asString(value, fallback).replaceAll('_', ' ');
  return raw.split(' ').map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join(' ');
}

function nativeSnapshot(mode: SoloCareerMode, storage: Storage) {
  const meta = SOLO_MODE_META[mode];
  let save: any = null;
  let seasonSave: any = null;

  if (mode === 'agent') save = safeParse(storage, AGENT_SAVE_KEY);
  if (mode === 'owner') save = safeParse(storage, OWNER_SAVE_KEY);
  if (mode === 'cap') save = safeParse(storage, SOLO_FRANCHISE_SAVE_KEYS.cap);
  if (mode === 'fantasy') {
    save = safeParse(storage, SOLO_FRANCHISE_SAVE_KEYS.fantasy);
    seasonSave = safeParse(storage, `${SOLO_FRANCHISE_SAVE_KEYS.fantasy}:season`);
  }
  if (mode === 'real') {
    save = safeParse(storage, SOLO_FRANCHISE_SAVE_KEYS.real);
    seasonSave = safeParse(storage, `${SOLO_FRANCHISE_SAVE_KEYS.real}:season`);
  }
  if (mode === 'player') {
    save = safeParse(storage, SOLO_FRANCHISE_SAVE_KEYS.player);
    seasonSave = safeParse(storage, `${SOLO_FRANCHISE_SAVE_KEYS.player}:season`);
  }

  if (!save && !seasonSave) return null;
  const source = seasonSave ?? save ?? {};
  const weeks = Array.isArray(source.weeks) ? source.weeks : Array.isArray(save?.weeks) ? save.weeks : [];
  const winsFromWeeks = weeks.filter((week: any) => week?.won === true).length;
  const lossesFromWeeks = weeks.filter((week: any) => week?.won === false).length;
  const playoffs = Array.isArray(source.playoffs) ? source.playoffs : [];
  const wonTitle = playoffs.some((result: any) => result?.won && String(result?.round || '').toUpperCase().includes('BOWL'));
  const season = Math.max(1, Math.round(asNumber(
    mode === 'agent' ? save?.seasonYear : mode === 'owner' ? save?.season : source?.year,
    2026,
  )));
  const week = Math.max(0, Math.round(asNumber(
    mode === 'agent' ? save?.seasonWeek : mode === 'owner' ? save?.week : weeks.length + 1,
    weeks.length ? Math.min(18, weeks.length + 1) : 0,
  )));
  const wins = Math.max(0, Math.round(asNumber(save?.wins ?? source?.wins, winsFromWeeks)));
  const losses = Math.max(0, Math.round(asNumber(save?.losses ?? source?.losses, lossesFromWeeks)));
  const championships = Math.max(0, Math.round(asNumber(save?.championships, wonTitle ? 1 : 0)));
  const stage = stageLabel(
    mode === 'agent' ? save?.phase : mode === 'owner' ? save?.stage : source?.stage,
    week > 0 ? 'Regular Season' : 'Preseason',
  );

  let subtitle = meta.subtitle;
  if (mode === 'agent') subtitle = asString(save?.profile?.name, 'Your Agency');
  if (mode === 'owner') subtitle = asString(save?.ownerName, 'Owner Career');
  if (mode === 'real') subtitle = asString(save?.teamAbbr, 'Franchise Command');
  if (mode === 'fantasy') subtitle = asString(save?.leagueName ?? save?.teamName ?? save?.teamAbbr, 'Fantasy Franchise');
  if (mode === 'player') subtitle = asString(save?.name ?? save?.playerName, 'My Player Career');

  const morale = mode === 'owner'
    ? asNumber(save?.staffMorale, 65)
    : mode === 'agent'
      ? asNumber(save?.clientCare, 65)
      : asNumber(source?.interactions?.morale ?? save?.morale, 65);
  const pressure = mode === 'owner'
    ? 100 - asNumber(save?.approval, 55)
    : mode === 'agent'
      ? Math.max(15, 70 - asNumber(save?.reputation, 50))
      : losses > wins ? 55 : 35;

  return {
    title: meta.title,
    subtitle,
    season,
    week,
    stage,
    wins,
    losses,
    championships,
    pressure: clamp(pressure),
    morale: clamp(morale),
  };
}

export function nativeSoloModeHasSave(mode: SoloCareerMode, storage: Storage = window.localStorage) {
  return Boolean(nativeSnapshot(mode, storage));
}

export function ensureSoloCareerSave(
  state: SoloUniverseState,
  mode: SoloCareerMode,
  now = Date.now(),
  storage: Storage = window.localStorage,
) {
  const normalized = normalizeSoloUniverseState(state);
  const snapshot = nativeSnapshot(mode, storage);
  const existing = normalized.saves.find(save => save.mode === mode);
  const meta = SOLO_MODE_META[mode];
  const save: SoloCareerSave = existing
    ? {
      ...existing,
      ...(snapshot ?? {}),
      title: snapshot?.title ?? existing.title,
      subtitle: snapshot?.subtitle ?? existing.subtitle,
      lastPlayedAt: now,
    }
    : {
      id: `solo-${mode}`,
      mode,
      title: snapshot?.title ?? meta.title,
      subtitle: snapshot?.subtitle ?? meta.subtitle,
      season: snapshot?.season ?? 2026,
      week: snapshot?.week ?? 0,
      stage: snapshot?.stage ?? 'Preseason',
      wins: snapshot?.wins ?? 0,
      losses: snapshot?.losses ?? 0,
      championships: snapshot?.championships ?? 0,
      pressure: snapshot?.pressure ?? 35,
      morale: snapshot?.morale ?? 65,
      createdAt: now,
      lastPlayedAt: now,
      resolvedEvents: [],
    };

  return {
    ...normalized,
    saves: [save, ...normalized.saves.filter(item => item.id !== save.id)],
    activeSaveId: save.id,
  };
}

export function syncSoloUniverseFromStorage(
  state: SoloUniverseState,
  storage: Storage = window.localStorage,
  now = Date.now(),
) {
  let next = normalizeSoloUniverseState(state);
  for (const mode of SOLO_CAREER_MODES) {
    const snapshot = nativeSnapshot(mode, storage);
    if (!snapshot) continue;
    const existing = next.saves.find(save => save.mode === mode);
    const createdAt = existing?.createdAt ?? now;
    const resolvedEvents = existing?.resolvedEvents ?? [];
    const lastPlayedAt = existing?.lastPlayedAt ?? now;
    const save: SoloCareerSave = {
      id: existing?.id ?? `solo-${mode}`,
      mode,
      ...snapshot,
      createdAt,
      lastPlayedAt,
      resolvedEvents,
    };
    next = {
      ...next,
      saves: [save, ...next.saves.filter(item => item.mode !== mode)],
    };
  }
  if (!next.activeSaveId && next.saves.length) {
    next.activeSaveId = [...next.saves].sort((first, second) => second.lastPlayedAt - first.lastPlayedAt)[0].id;
  }
  return next;
}

export function activeSoloCareer(state: SoloUniverseState) {
  return state.saves.find(save => save.id === state.activeSaveId) ?? null;
}

export function activateSoloCareer(state: SoloUniverseState, saveId: string, now = Date.now()) {
  if (!state.saves.some(save => save.id === saveId)) return state;
  return {
    ...state,
    activeSaveId: saveId,
    saves: state.saves.map(save => save.id === saveId ? { ...save, lastPlayedAt: now } : save),
  };
}

const choice = (
  id: string,
  label: string,
  detail: string,
  xp: number,
  reputation: number,
  pressure: number,
  morale: number,
): SoloCareerChoice => ({ id, label, detail, xp, reputation, pressure, morale });

function liveWeekScript(save: SoloCareerSave): SoloCareerEventTemplate[] {
  const base = weeklyBase(save);
  const firstChoice = chosenFor(save, `${base}${LIVE_EVENT_SUFFIX}1`);
  const secondChoice = chosenFor(save, `${base}${LIVE_EVENT_SUFFIX}2`);
  const pressureHot = save.pressure >= 70;
  const moraleLow = save.morale <= 45;

  if (save.mode === 'agent') {
    return [
      {
        eyebrow: 'LIVE WEEK · 1/3 · CLIENT CALL',
        title: 'Your client wants a bigger role',
        description: 'A frustrated starter says his team is burying his value. He wants you to make noise before another week disappears.',
        character: 'Private client call',
        choices: [
          choice('push', 'Apply public pressure', 'Force the issue now. Trust rises, but front offices remember the headline.', 165, -3, 8, 8),
          choice('private', 'Call the GM privately', 'Work the relationship first and keep the threat in your pocket.', 145, 4, -3, 4),
          choice('challenge', 'Challenge the client', 'Tell him to win the role on film before you spend political capital.', 185, 5, 4, -5),
        ],
      },
      {
        eyebrow: 'LIVE WEEK · 2/3 · MARKET ROOM',
        title: firstChoice === 'push' ? 'The GM calls back furious' : firstChoice === 'challenge' ? 'A rival agency smells weakness' : 'The front office is willing to talk',
        description: firstChoice === 'push'
          ? 'Your public pressure got attention. Now you have leverage and a relationship to repair before the situation becomes a trade demand.'
          : firstChoice === 'challenge'
            ? 'Your client respected the honesty, but another agency is promising instant leverage and a louder brand.'
            : 'The GM gives you ten minutes to present a plan that helps the player without turning the week into a circus.',
        character: 'Agency war room',
        choices: [
          choice('leverage', 'Build trade leverage', 'Quietly call other teams and make the current club feel a market forming.', 185, 4, 6, 3),
          choice('role-plan', 'Negotiate a role plan', 'Ask for concrete snaps, packages and checkpoints instead of headlines.', 160, 5, -4, 7),
          choice('brand', 'Create outside leverage', 'Push endorsements and visibility so the player gains value even before his role changes.', 175, 2, 2, 5),
        ],
      },
      {
        eyebrow: 'LIVE WEEK · 3/3 · REPORTER TEXT',
        title: pressureHot ? 'A reporter says the situation is about to explode' : 'A national reporter asks for your side',
        description: secondChoice === 'leverage'
          ? 'Word of your calls leaked. One sentence can either calm the market or turn this into the biggest player story of the week.'
          : secondChoice === 'brand'
            ? 'The player is suddenly everywhere online. The reporter wants to know whether the team is wasting him.'
            : 'The role plan is still private, but the reporter has enough pieces to know something changed.',
        character: 'Media strategy',
        choices: [
          choice('silent', 'No comment', 'Protect the negotiation and refuse to feed the story.', 125, 2, -5, 1),
          choice('protect', 'Protect the client publicly', 'Praise the player without threatening the team.', 165, 5, 1, 5),
          choice('heat', 'Turn up the heat', 'Make it clear the status quo will not continue.', 215, -2, 10, 6),
        ],
      },
    ];
  }

  if (save.mode === 'owner') {
    return [
      {
        eyebrow: 'LIVE WEEK · 1/3 · EXECUTIVE SUITE',
        title: 'Football wants another $25M',
        description: 'Your GM says the roster needs immediate help. Business says spending now squeezes the quarter and raises expectations overnight.',
        character: 'Ownership meeting',
        choices: [
          choice('spend', 'Fund football', 'Give the GM resources and accept that patience is officially over.', 175, 4, 9, 9),
          choice('hold', 'Hold the line', 'Protect flexibility and make the current roster prove it.', 125, -2, -4, -7),
          choice('conditional', 'Make it performance-based', 'Release money only if the team hits defined checkpoints.', 195, 5, 5, 2),
        ],
      },
      {
        eyebrow: 'LIVE WEEK · 2/3 · FOOTBALL OPS',
        title: firstChoice === 'spend' ? 'The coach and GM disagree on where to spend it' : firstChoice === 'hold' ? 'The locker room heard you said no' : 'Your performance clause split the building',
        description: firstChoice === 'spend'
          ? 'The coach wants a veteran. The GM wants to bet on youth. Both think the wrong choice wastes the money you just approved.'
          : firstChoice === 'hold'
            ? 'Veteran leaders think ownership is asking them to win without enough help. Your coach wants you to address the team.'
            : 'Football likes the extra money. Business likes the protection. Nobody agrees on which milestone should unlock the next check.',
        character: 'Coach / GM meeting',
        choices: [
          choice('coach', 'Back the coach', 'Give the staff the piece it says can help this week.', 160, 3, 4, 6),
          choice('gm', 'Back the GM', 'Protect the long-term roster plan even if the coach hates the timing.', 170, 4, 3, 1),
          choice('joint', 'Force a joint plan', 'Make both departments sign their names to one answer.', 200, 6, 1, 5),
        ],
      },
      {
        eyebrow: 'LIVE WEEK · 3/3 · PRESS CONFERENCE',
        title: pressureHot ? 'Fans want to know who is accountable' : 'The city wants to hear the plan',
        description: moraleLow
          ? 'The building feels your week. Reporters know staff morale is shaky and every answer will be replayed inside the facility.'
          : 'Your football decision is now public. This is the moment where ownership either absorbs the pressure or passes it downhill.',
        character: 'Owner podium',
        choices: [
          choice('promise', 'Promise a turnaround', 'Set a clear standard and accept the pressure if the team misses it.', 205, 5, 10, 3),
          choice('measured', 'Stay measured', 'Defend the process without promising a specific result.', 145, 3, -3, 2),
          choice('own-it', 'Take the blame yourself', 'Protect staff and players by making ownership the target.', 185, 6, 4, 8),
        ],
      },
    ];
  }

  if (save.mode === 'cap') {
    return [
      {
        eyebrow: 'LIVE WEEK · 1/3 · CAP WAR ROOM',
        title: 'A star wants an expensive extension',
        description: 'Paying him protects a strength today. Walking away protects the rest of the roster tomorrow.',
        character: 'Contract desk',
        choices: [
          choice('extend', 'Pay the star', 'Secure the player and raise the pressure to win immediately.', 160, 3, 10, 10),
          choice('walk', 'Protect the cap', 'Keep flexibility and absorb the locker-room reaction.', 150, -2, -4, -8),
          choice('bridge', 'Offer a short bridge', 'Keep the player while pushing the biggest decision into the future.', 180, 3, 2, 3),
        ],
      },
      {
        eyebrow: 'LIVE WEEK · 2/3 · ROSTER ROOM',
        title: firstChoice === 'extend' ? 'The extension squeezes two roster spots' : firstChoice === 'walk' ? 'The locker room wants to know who replaces him' : 'The bridge deal buys time, not answers',
        description: 'Your staff has one veteran, one young player and one flexible roster path. You cannot keep every option.',
        character: 'Roster construction',
        choices: [
          choice('veteran', 'Keep the veteran floor', 'Pay for reliability and reduce weekly volatility.', 145, 2, -2, 5),
          choice('youth', 'Bet on the young player', 'Create upside and accept more risk in the short term.', 195, 5, 5, 2),
          choice('trade', 'Shop the position', 'Use the market to create cap and roster flexibility.', 185, 4, 6, -1),
        ],
      },
      {
        eyebrow: 'LIVE WEEK · 3/3 · DEADLINE PHONE',
        title: pressureHot ? 'A contender is trying to make you blink' : 'The deadline phone will not stop',
        description: secondChoice === 'trade'
          ? 'Your roster calls created a real market. The best offer helps tomorrow more than today.'
          : 'A rival offers immediate help at a price that would make next season uncomfortable.',
        character: 'Trade deadline',
        choices: [
          choice('buy', 'Buy now', 'Spend future flexibility to raise the ceiling of this run.', 210, 5, 11, 6),
          choice('hold-assets', 'Hold your assets', 'Trust the roster you built and protect tomorrow.', 140, 2, -3, 1),
          choice('shuffle', 'Create a cap shuffle', 'Move money and depth around without a blockbuster.', 185, 4, 3, 3),
        ],
      },
    ];
  }

  if (save.mode === 'fantasy') {
    return [
      {
        eyebrow: 'LIVE WEEK · 1/3 · DRAFT BOARD',
        title: 'Your board and the room disagree',
        description: 'The best player available is not at your biggest need. Your scouts are split and your pick is getting close.',
        character: 'Draft night',
        choices: [
          choice('bpa', 'Take the best player', 'Trust talent over need and make the depth chart sort itself out.', 175, 4, 4, 4),
          choice('need', 'Fill the need', 'Build a cleaner roster with less immediate ceiling.', 135, 1, -3, 3),
          choice('trade', 'Move the pick', 'Create value and risk losing both preferred targets.', 210, 5, 8, -2),
        ],
      },
      {
        eyebrow: 'LIVE WEEK · 2/3 · TRADE CALL',
        title: firstChoice === 'trade' ? 'Two teams are bidding for your pick' : 'A rival wants the player next to yours',
        description: firstChoice === 'trade'
          ? 'The market is real now. One offer is safer; the other gives you a bigger future swing.'
          : 'The rival offers extra capital if you slide down, but your current target may not survive the move.',
        character: 'Draft phone',
        choices: [
          choice('accept', 'Take the clean offer', 'Lock in value without trying to squeeze every last point.', 155, 3, -2, 3),
          choice('counter', 'Push for more', 'Risk the deal to extract one more asset.', 205, 5, 7, 1),
          choice('reject', 'Stay on the clock', 'Trust your board and end the negotiation.', 150, 3, 1, 4),
        ],
      },
      {
        eyebrow: 'LIVE WEEK · 3/3 · SCHEME LAB',
        title: 'Now make all those pieces fit',
        description: moraleLow
          ? 'Your room is uneasy after the draft decisions. A clear identity can settle it before the season starts.'
          : 'The roster is taking shape. Your final call is whether to chase ceiling, balance or weekly reliability.',
        character: 'Coaching install',
        choices: [
          choice('ceiling', 'Chase explosive upside', 'Build around speed and volatility. The highs can be ridiculous.', 210, 5, 8, 3),
          choice('balance', 'Install a balanced plan', 'Reduce weak points and keep every unit useful.', 165, 4, -2, 5),
          choice('floor', 'Trust reliable veterans', 'Lower volatility and protect the weekly floor.', 140, 2, -5, 4),
        ],
      },
    ];
  }

  if (save.mode === 'real') {
    return [
      {
        eyebrow: 'LIVE WEEK · 1/3 · GAME PLAN',
        title: 'Your coaches bring you two different ways to win',
        description: 'One plan attacks the opponent aggressively. The other protects your weakest matchup and tries to win late.',
        character: 'Coach meeting',
        choices: [
          choice('attack', 'Attack their weakness', 'Lean into your best matchup and accept the risk of being predictable.', 190, 5, 6, 4),
          choice('protect', 'Protect your weakness', 'Lower variance and make the game ugly if necessary.', 155, 3, -4, 3),
          choice('staff', 'Let the staff decide', 'Give coordinators ownership and judge them on the result.', 145, 2, -1, 6),
        ],
      },
      {
        eyebrow: 'LIVE WEEK · 2/3 · PRACTICE FIELD',
        title: firstChoice === 'attack' ? 'The aggressive plan unlocked a young receiver' : firstChoice === 'protect' ? 'A veteran hates the conservative install' : 'Practice turns into a depth-chart argument',
        description: firstChoice === 'attack'
          ? 'The young player is destroying the look team and wants starter snaps. A veteran will lose targets if you commit.'
          : firstChoice === 'protect'
            ? 'Your veteran captain says the plan sends the wrong message. The younger players think he is protecting his role.'
            : 'Two players are close enough that the staff wants you to settle the role before Friday.',
        character: 'Practice / depth chart',
        choices: [
          choice('young', 'Start the younger player', 'Reward practice performance and accept locker-room pressure.', 205, 5, 8, 4),
          choice('rotation', 'Create a rotation', 'Keep both involved and make production decide the next week.', 165, 3, 1, 7),
          choice('veteran', 'Back the veteran', 'Protect hierarchy and demand the young player keep earning it.', 140, 1, -3, -2),
        ],
      },
      {
        eyebrow: 'LIVE WEEK · 3/3 · FRIDAY MEDICAL',
        title: pressureHot ? 'Your best player is limited and everybody knows it' : 'A key starter is cleared, but not fully right',
        description: secondChoice === 'young'
          ? 'You already shook up the depth chart. Now another risk decision lands on your desk before kickoff.'
          : 'The medical staff says he can play. The position coach says the backup can survive one week. The player wants no restrictions.',
        character: 'Medical / coach room',
        choices: [
          choice('play', 'Play him normally', 'Trust the clearance and keep the full game plan.', 205, 4, 10, 5),
          choice('limit', 'Use a snap limit', 'Keep him available while protecting the season.', 170, 5, 1, 4),
          choice('sit', 'Sit him', 'Take the short-term hit and protect the player.', 155, 4, -5, 2),
        ],
      },
    ];
  }

  return [
    {
      eyebrow: 'LIVE WEEK · 1/3 · POSITION ROOM',
      title: 'Coach offers you a bigger role',
      description: 'The opportunity comes with a harder weekly objective and more scrutiny if you disappear when the lights come on.',
      character: 'Coach meeting',
      choices: [
        choice('accept', 'Take the challenge', 'Ask for the responsibility and accept that the standard just changed.', 225, 5, 10, 6),
        choice('steady', 'Keep your current role', 'Stay consistent, keep stacking good tape and protect your floor.', 130, 1, -5, 3),
        choice('demand', 'Demand an even bigger role', 'Bet on yourself loudly. Teammates and coaches will remember it.', 250, -3, 12, -6),
      ],
    },
    {
      eyebrow: 'LIVE WEEK · 2/3 · TRAINING PLAN',
      title: firstChoice === 'accept' ? 'Your new workload changes the whole week' : firstChoice === 'demand' ? 'Now you have to back up the talk' : 'Coach wants to see how serious you are',
      description: firstChoice === 'demand'
        ? 'Extra reps can make the statement real, but your body is already carrying a full professional workload.'
        : 'You have one open block. The choice between reps, film and recovery affects how ready you feel on Sunday.',
      character: 'Player development',
      choices: [
        choice('reps', 'Take extra reps', 'Sharpen timing and skill at the cost of extra physical stress.', 215, 4, 7, 4),
        choice('film', 'Live in the film room', 'Raise preparation and confidence without adding contact.', 175, 5, -3, 4),
        choice('recover', 'Prioritize recovery', 'Protect your body and arrive fresher, even if the coaches notice fewer extras.', 145, 1, -7, 5),
      ],
    },
    {
      eyebrow: 'LIVE WEEK · 3/3 · LOCKER ROOM MEDIA',
      title: pressureHot ? 'Every microphone is pointed at you' : 'A reporter asks whether you are ready for the moment',
      description: secondChoice === 'reps'
        ? 'Teammates saw the extra work. Now your answer can make it about the team or about the role you want.'
        : secondChoice === 'recover'
          ? 'The media noticed you left the field early. You can explain the plan or let people invent one.'
          : 'Your film work impressed the coaches. The reporter wants to know whether you expect the ball more this week.',
      character: 'Player podium',
      choices: [
        choice('team', 'Make it about the team', 'Build trust and keep expectations under control.', 155, 5, -4, 7),
        choice('ready', 'Say you are ready', 'Own the opportunity without guaranteeing a result.', 185, 5, 2, 4),
        choice('guarantee', 'Guarantee a big game', 'Create a headline and put the whole week on your shoulders.', 245, -2, 12, 1),
      ],
    },
  ];
}

export function soloCareerEvent(save: SoloCareerSave): SoloCareerEvent {
  const script = liveWeekScript(save);
  let step = 1;
  while (step <= LIVE_EVENT_STEPS && hasResolvedStep(save, step)) step += 1;
  const activeStep = Math.min(step, LIVE_EVENT_STEPS);
  return {
    ...script[activeStep - 1],
    id: liveEventId(save, activeStep),
  };
}

export function isSoloCareerEventResolved(save: SoloCareerSave, event: SoloCareerEvent) {
  return save.resolvedEvents.includes(event.id);
}

function levelProfile(profile: SoloCareerProfile, addedXp: number) {
  let level = profile.level;
  let xp = profile.xp + Math.max(0, addedXp);
  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
  }
  return { level, xp };
}

export function applySoloCareerDecision(
  state: SoloUniverseState,
  saveId: string,
  event: SoloCareerEvent,
  choiceId: string,
  now = Date.now(),
) {
  const save = state.saves.find(item => item.id === saveId);
  const selected = event.choices.find(item => item.id === choiceId);
  if (!save || !selected || save.resolvedEvents.includes(event.id)) return state;

  const completedWeek = event.id.endsWith(`${LIVE_EVENT_SUFFIX}${LIVE_EVENT_STEPS}`);
  const bonusXp = completedWeek ? 100 : 0;
  const leveled = levelProfile(state.profile, selected.xp + bonusXp);
  const achievements = new Set(state.profile.achievements);
  achievements.add('Made the Call');
  if (completedWeek) achievements.add('Full Week');
  if (state.profile.decisions + 1 >= 10) achievements.add('Decision Maker');
  if (state.profile.decisions + 1 >= 25) achievements.add('Hands On');
  if (state.profile.decisions + 1 >= 50) achievements.add('Football Lifer');
  if (leveled.level >= 5) achievements.add('Rising Ball Knower');

  const historyItem: SoloCareerHistoryItem = {
    id: nowId('solo-history', now),
    saveId,
    mode: save.mode,
    season: save.season,
    week: save.week,
    title: event.title,
    detail: `${selected.label}: ${selected.detail}${completedWeek ? ' Live Week complete: +100 bonus XP.' : ''}`,
    createdAt: now,
  };

  const choiceMarker = `${event.id}:choice:${selected.id}`;
  return {
    ...state,
    profile: {
      ...state.profile,
      ...leveled,
      reputation: clamp(state.profile.reputation + selected.reputation),
      legacy: state.profile.legacy + Math.max(1, Math.round(selected.xp / 50)) + (completedWeek ? 3 : 0),
      decisions: state.profile.decisions + 1,
      achievements: [...achievements],
    },
    saves: state.saves.map(item => item.id === saveId ? {
      ...item,
      pressure: clamp(item.pressure + selected.pressure),
      morale: clamp(item.morale + selected.morale),
      lastPlayedAt: now,
      resolvedEvents: [...item.resolvedEvents, event.id, choiceMarker].slice(-120),
    } : item),
    history: [historyItem, ...state.history].slice(0, 180),
  };
}

export function awardSoloChampionships(state: SoloUniverseState) {
  const total = state.saves.reduce((sum, save) => sum + save.championships, 0);
  if (total <= state.profile.championships) return state;
  const difference = total - state.profile.championships;
  const leveled = levelProfile(state.profile, difference * 600);
  const achievements = new Set(state.profile.achievements);
  achievements.add('Champion');
  if (total >= 3) achievements.add('Dynasty Builder');
  return {
    ...state,
    profile: {
      ...state.profile,
      ...leveled,
      championships: total,
      legacy: state.profile.legacy + difference * 25,
      reputation: clamp(state.profile.reputation + difference * 5),
      achievements: [...achievements],
    },
  };
}
