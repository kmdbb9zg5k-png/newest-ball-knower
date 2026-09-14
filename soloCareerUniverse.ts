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

export const SOLO_UNIVERSE_KEY = 'ballknower_solo_universe_v1';
export const SOLO_CAREER_MODES: SoloCareerMode[] = ['agent', 'owner', 'cap', 'fantasy', 'real', 'player'];

const AGENT_SAVE_KEY = 'ballknower_player_agent_v4';
const OWNER_SAVE_KEY = 'ballknower_owner_career_v3';

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
    ? source.saves.filter((save): save is SoloCareerSave => Boolean(save && SOLO_CAREER_MODES.includes(save.mode) && typeof save.id === 'string'))
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
        resolvedEvents: Array.isArray(save.resolvedEvents) ? save.resolvedEvents.filter(item => typeof item === 'string').slice(-80) : [],
      }))
    : [];

  const normalizedProfile: SoloCareerProfile = {
    level: Math.max(1, Math.round(asNumber(profile.level, 1))),
    xp: Math.max(0, Math.round(asNumber(profile.xp, 0))),
    reputation: clamp(asNumber(profile.reputation, 50)),
    legacy: Math.max(0, Math.round(asNumber(profile.legacy, 0))),
    championships: Math.max(0, Math.round(asNumber(profile.championships, 0))),
    decisions: Math.max(0, Math.round(asNumber(profile.decisions, 0))),
    achievements: Array.isArray(profile.achievements) ? profile.achievements.filter(item => typeof item === 'string').slice(-100) : [],
  };

  return {
    version: 1,
    profile: normalizedProfile,
    saves,
    activeSaveId: typeof source.activeSaveId === 'string' && saves.some(save => save.id === source.activeSaveId)
      ? source.activeSaveId
      : saves.sort((first, second) => second.lastPlayedAt - first.lastPlayedAt)[0]?.id ?? null,
    history: Array.isArray(source.history)
      ? source.history.filter((item): item is SoloCareerHistoryItem => Boolean(item && typeof item.id === 'string' && typeof item.detail === 'string')).slice(0, 150)
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
  const championships = Math.max(0, Math.round(asNumber(
    save?.championships,
    wonTitle ? 1 : 0,
  )));
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

const EVENT_TEMPLATES: Record<SoloCareerMode, Omit<SoloCareerEvent, 'id'>> = {
  agent: {
    eyebrow: 'CLIENT PRESSURE',
    title: 'Your client wants a bigger role',
    description: 'A frustrated starter wants you to push the front office publicly. The relationship is on the line.',
    character: 'Client meeting',
    choices: [
      { id: 'push', label: 'Apply pressure', detail: 'Gain trust now, but your league reputation takes a hit.', xp: 160, reputation: -4, pressure: 8, morale: 8 },
      { id: 'private', label: 'Handle it privately', detail: 'A steadier path with less immediate upside.', xp: 130, reputation: 3, pressure: -3, morale: 3 },
      { id: 'challenge', label: 'Challenge the client', detail: 'Tell him to earn the role. Risky, but respected if it lands.', xp: 190, reputation: 5, pressure: 5, morale: -6 },
    ],
  },
  owner: {
    eyebrow: 'OWNER DECISION',
    title: 'Football wants another $25M',
    description: 'Your staff says the roster needs help. Business says spending now will squeeze the next quarter.',
    character: 'Executive suite',
    choices: [
      { id: 'spend', label: 'Fund football', detail: 'Raise expectations and morale immediately.', xp: 170, reputation: 4, pressure: 9, morale: 9 },
      { id: 'hold', label: 'Hold the line', detail: 'Protect flexibility, but the building will feel it.', xp: 120, reputation: -2, pressure: -4, morale: -7 },
      { id: 'conditional', label: 'Make it performance-based', detail: 'Tie the money to results and put everyone on notice.', xp: 190, reputation: 5, pressure: 6, morale: 1 },
    ],
  },
  cap: {
    eyebrow: 'CAP WAR ROOM',
    title: 'A star wants an expensive extension',
    description: 'Paying him protects your strength today. Walking away protects tomorrow.',
    character: 'Contract desk',
    choices: [
      { id: 'extend', label: 'Pay the star', detail: 'Morale jumps. The pressure to win now does too.', xp: 155, reputation: 3, pressure: 10, morale: 10 },
      { id: 'walk', label: 'Protect the cap', detail: 'Take the unpopular route and preserve flexibility.', xp: 145, reputation: -3, pressure: -4, morale: -8 },
      { id: 'bridge', label: 'Offer a short bridge', detail: 'Split the difference without making anyone completely happy.', xp: 175, reputation: 2, pressure: 2, morale: 2 },
    ],
  },
  fantasy: {
    eyebrow: 'DRAFT ROOM',
    title: 'Your board and the room disagree',
    description: 'The best player available is not at your biggest need. Your scouts are split.',
    character: 'Draft night',
    choices: [
      { id: 'bpa', label: 'Take the best player', detail: 'Trust talent over need.', xp: 170, reputation: 4, pressure: 4, morale: 4 },
      { id: 'need', label: 'Fill the need', detail: 'Safer roster construction, lower ceiling.', xp: 130, reputation: 1, pressure: -3, morale: 2 },
      { id: 'trade', label: 'Move the pick', detail: 'Create value, but risk missing both targets.', xp: 205, reputation: 5, pressure: 8, morale: -2 },
    ],
  },
  real: {
    eyebrow: 'BREAKOUT OPPORTUNITY',
    title: 'A young receiver is forcing the issue',
    description: 'He has dominated practice and wants starter snaps this week. A veteran will lose touches if you commit.',
    character: 'Coach meeting',
    choices: [
      { id: 'start', label: 'Start the youngster', detail: 'High upside, high locker-room pressure.', xp: 190, reputation: 5, pressure: 8, morale: 3 },
      { id: 'rotate', label: 'Create a rotation', detail: 'Keep both involved and delay the hard choice.', xp: 145, reputation: 2, pressure: 1, morale: 5 },
      { id: 'veteran', label: 'Back the veteran', detail: 'Protect hierarchy, but development slows.', xp: 120, reputation: -2, pressure: -3, morale: -4 },
    ],
  },
  player: {
    eyebrow: 'CAREER MOMENT',
    title: 'Coach offers you a bigger role',
    description: 'The opportunity comes with a harder weekly objective and more scrutiny if you fail.',
    character: 'Position room',
    choices: [
      { id: 'accept', label: 'Take the challenge', detail: 'More XP and more pressure.', xp: 220, reputation: 5, pressure: 10, morale: 6 },
      { id: 'steady', label: 'Keep your current role', detail: 'Stay consistent and protect your floor.', xp: 125, reputation: 1, pressure: -5, morale: 2 },
      { id: 'demand', label: 'Demand an even bigger role', detail: 'Aggressive. The locker room will remember it.', xp: 245, reputation: -4, pressure: 12, morale: -6 },
    ],
  },
};

export function soloCareerEvent(save: SoloCareerSave): SoloCareerEvent {
  const template = EVENT_TEMPLATES[save.mode];
  return {
    ...template,
    id: `${save.mode}-${save.season}-${save.week || 0}`,
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
  const choice = event.choices.find(item => item.id === choiceId);
  if (!save || !choice || save.resolvedEvents.includes(event.id)) return state;
  const leveled = levelProfile(state.profile, choice.xp);
  const achievements = new Set(state.profile.achievements);
  achievements.add('Made the Call');
  if (state.profile.decisions + 1 >= 10) achievements.add('Decision Maker');
  if (leveled.level >= 5) achievements.add('Rising Ball Knower');

  const historyItem: SoloCareerHistoryItem = {
    id: nowId('solo-history', now),
    saveId,
    mode: save.mode,
    season: save.season,
    week: save.week,
    title: event.title,
    detail: `${choice.label}: ${choice.detail}`,
    createdAt: now,
  };

  return {
    ...state,
    profile: {
      ...state.profile,
      ...leveled,
      reputation: clamp(state.profile.reputation + choice.reputation),
      legacy: state.profile.legacy + Math.max(1, Math.round(choice.xp / 50)),
      decisions: state.profile.decisions + 1,
      achievements: [...achievements],
    },
    saves: state.saves.map(item => item.id === saveId ? {
      ...item,
      pressure: clamp(item.pressure + choice.pressure),
      morale: clamp(item.morale + choice.morale),
      lastPlayedAt: now,
      resolvedEvents: [...item.resolvedEvents, event.id].slice(-80),
    } : item),
    history: [historyItem, ...state.history].slice(0, 150),
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
