import { CPU_LIVE_FANTASY_POSITION_LIMITS, LIVE_FANTASY_DRAFT_GROUPS, LIVE_FANTASY_ROSTER_REQUIREMENTS, type LiveFantasyDraftGroup } from './liveFantasyRules';
import { SOLO_PLAYERS_DATABASE, SOLO_TEAM_THEMES, soloTeamLogoUrl } from './soloUniverse';
import type { Player } from './types';

export const SOLO_FANTASY_ROUNDS = 15;
export const SOLO_FANTASY_GROUPS = LIVE_FANTASY_DRAFT_GROUPS;

export type SoloFantasyLeagueSetup = {
  leagueName: string;
  teamName: string;
  location: string;
  logoUrl: string;
  leagueSize: 8 | 10 | 12;
};

export type SoloFantasyManager = {
  id: string;
  name: string;
  location: string;
  logoUrl: string;
  isUser: boolean;
};

export type SoloFantasyPick = {
  overall: number;
  round: number;
  managerId: string;
  playerId: string;
  group: LiveFantasyDraftGroup;
  source: 'manual' | 'cpu' | 'autopick';
};

export type SoloFantasyDraftState = {
  version: 2;
  setup: SoloFantasyLeagueSetup;
  managers: SoloFantasyManager[];
  orderManagerIds: string[];
  rounds: number;
  pickIndex: number;
  picks: SoloFantasyPick[];
  seed: number;
  status: 'active' | 'completed';
};

const groupFor = (player: Player): LiveFantasyDraftGroup | null => {
  const position = player.position as string;
  return SOLO_FANTASY_GROUPS.includes(position as LiveFantasyDraftGroup) ? position as LiveFantasyDraftGroup : null;
};

const projectionForPosition: Record<LiveFantasyDraftGroup, [number, number]> = {
  QB: [150, 5.2], RB: [95, 4.5], WR: [90, 4.35], TE: [70, 3.4], K: [70, 2.5], DST: [70, 2.4],
};

export function soloFantasyProjection(player: Player) {
  const group = groupFor(player) ?? 'DST';
  const [base, multiplier] = projectionForPosition[group];
  const nameVariance = [...player.name].reduce((total, character) => total + character.charCodeAt(0), 0) % 17;
  return Math.round((base + Math.max(0, player.ovr - 60) * multiplier + nameVariance / 2) * 10) / 10;
}

const defensePlayers: Player[] = SOLO_TEAM_THEMES.map(team => {
  const defenders = SOLO_PLAYERS_DATABASE.filter(player => player.team === team.abbr && ['EDGE', 'DE', 'DT', 'NT', 'LB', 'CB', 'S', 'FS', 'SS'].includes(player.position));
  const ovr = defenders.length ? Math.round(defenders.reduce((total, player) => total + player.ovr, 0) / defenders.length) : 75;
  return {
    id: `solo-dst-${team.abbr.toLowerCase()}`,
    playerId: `solo-dst-${team.abbr.toLowerCase()}`,
    name: `${team.name} D/ST`,
    team: team.abbr,
    teamId: team.abbr,
    teamAbbreviation: team.abbr,
    teamCity: team.name.split(' ').slice(0, -1).join(' '),
    teamName: team.name,
    position: 'DST',
    positionGroup: 'DST',
    ovr,
    overall: ovr,
    overallRating: ovr,
    salary: 0,
    salaryType: 'estimated',
    active: true,
    ratingStatus: 'EDITORIAL',
    attributes: { athleticism: ovr, footballIQ: ovr, passRush: ovr, runDefense: ovr, coverage: ovr },
  };
});

export const SOLO_FANTASY_PLAYER_POOL: Player[] = [
  ...SOLO_PLAYERS_DATABASE.filter(player => groupFor(player) !== null),
  ...defensePlayers,
].sort((first, second) => soloFantasyProjection(second) - soloFantasyProjection(first) || second.ovr - first.ovr || first.name.localeCompare(second.name));

export const SOLO_FANTASY_PLAYER_BY_ID = new Map(SOLO_FANTASY_PLAYER_POOL.map(player => [player.id, player]));

function seeded(seed: number) {
  let value = seed | 0;
  return () => {
    value = Math.imul(value ^ value >>> 15, 1 | value);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function shuffled<T>(values: T[], random: () => number) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

export function createSoloFantasyDraft(setup: SoloFantasyLeagueSetup, seed = Date.now()): SoloFantasyDraftState {
  const random = seeded(seed);
  const cpuTeams = shuffled(SOLO_TEAM_THEMES, random).slice(0, setup.leagueSize - 1);
  const managers: SoloFantasyManager[] = [
    { id: 'solo-user', name: setup.teamName, location: setup.location, logoUrl: setup.logoUrl, isUser: true },
    ...cpuTeams.map(team => ({ id: `cpu-${team.abbr}`, name: team.name, location: team.name.split(' ').slice(0, -1).join(' '), logoUrl: soloTeamLogoUrl(team.abbr), isUser: false })),
  ];
  return {
    version: 2,
    setup,
    managers,
    orderManagerIds: shuffled(managers.map(manager => manager.id), random),
    rounds: SOLO_FANTASY_ROUNDS,
    pickIndex: 0,
    picks: [],
    seed,
    status: 'active',
  };
}

export function soloFantasyManagerAt(state: SoloFantasyDraftState, pickIndex = state.pickIndex) {
  const size = state.orderManagerIds.length;
  const roundIndex = Math.floor(pickIndex / size);
  const position = pickIndex % size;
  return state.orderManagerIds[roundIndex % 2 === 0 ? position : size - 1 - position];
}

export function soloFantasyUpcoming(state: SoloFantasyDraftState, count = 12) {
  const total = state.rounds * state.orderManagerIds.length;
  return Array.from({ length: Math.min(count, total - state.pickIndex) }, (_, offset) => {
    const pickIndex = state.pickIndex + offset;
    return { pickIndex, overall: pickIndex + 1, round: Math.floor(pickIndex / state.orderManagerIds.length) + 1, managerId: soloFantasyManagerAt(state, pickIndex) };
  });
}

export function soloFantasyCounts(state: SoloFantasyDraftState, managerId: string) {
  return state.picks.reduce<Partial<Record<LiveFantasyDraftGroup, number>>>((counts, pick) => {
    if (pick.managerId === managerId) counts[pick.group] = (counts[pick.group] ?? 0) + 1;
    return counts;
  }, {});
}

export function soloFantasyRoster(state: SoloFantasyDraftState, managerId: string) {
  return state.picks.filter(pick => pick.managerId === managerId).flatMap(pick => {
    const player = SOLO_FANTASY_PLAYER_BY_ID.get(pick.playerId);
    return player ? [player] : [];
  });
}

export function soloFantasyAvailable(state: SoloFantasyDraftState, managerId: string, enforceCpuLimits = false) {
  const drafted = new Set(state.picks.map(pick => pick.playerId));
  const counts = soloFantasyCounts(state, managerId);
  return SOLO_FANTASY_PLAYER_POOL.filter(player => {
    const group = groupFor(player);
    if (!group || drafted.has(player.id)) return false;
    return !enforceCpuLimits || (counts[group] ?? 0) < CPU_LIVE_FANTASY_POSITION_LIMITS[group];
  });
}

function rosterAwareBest(state: SoloFantasyDraftState, managerId: string, candidates: Player[]) {
  const counts = soloFantasyCounts(state, managerId);
  const picked = state.picks.filter(pick => pick.managerId === managerId).length;
  const picksRemaining = state.rounds - picked;
  const missing = SOLO_FANTASY_GROUPS.flatMap(group => Array.from({ length: Math.max(0, LIVE_FANTASY_ROSTER_REQUIREMENTS[group] - (counts[group] ?? 0)) }, () => group));
  const requiredNow = picksRemaining <= missing.length ? new Set(missing) : null;
  return candidates
    .filter(player => {
      const group = groupFor(player);
      return group && (!requiredNow || requiredNow.has(group));
    })
    .sort((first, second) => {
      const firstGroup = groupFor(first)!;
      const secondGroup = groupFor(second)!;
      const score = (player: Player, group: LiveFantasyDraftGroup) => soloFantasyProjection(player)
        - (counts[group] ?? 0) * ({ QB: 65, RB: 18, WR: 14, TE: 45, K: 100, DST: 100 }[group])
        + ((counts[group] ?? 0) < LIVE_FANTASY_ROSTER_REQUIREMENTS[group] ? 115 : 0)
        - ((group === 'K' || group === 'DST') && picked < 11 ? 170 : 0);
      return score(second, secondGroup) - score(first, firstGroup) || first.name.localeCompare(second.name);
    })[0] ?? null;
}

export function soloFantasyCpuSelection(state: SoloFantasyDraftState, managerId: string) {
  return rosterAwareBest(state, managerId, soloFantasyAvailable(state, managerId, true));
}

export function soloFantasyAutopickSelection(state: SoloFantasyDraftState, managerId: string, preferredIds: string[] = []) {
  const available = soloFantasyAvailable(state, managerId);
  const availableIds = new Set(available.map(player => player.id));
  const preferred = preferredIds.find(id => availableIds.has(id));
  return (preferred ? SOLO_FANTASY_PLAYER_BY_ID.get(preferred) : null) ?? rosterAwareBest(state, managerId, available);
}

export function makeSoloFantasyPick(state: SoloFantasyDraftState, playerId: string, source: SoloFantasyPick['source']) {
  if (state.status !== 'active') return state;
  const managerId = soloFantasyManagerAt(state);
  const player = soloFantasyAvailable(state, managerId, !state.managers.find(manager => manager.id === managerId)?.isUser).find(candidate => candidate.id === playerId);
  const group = player ? groupFor(player) : null;
  if (!player || !group) return state;
  const nextIndex = state.pickIndex + 1;
  const complete = nextIndex >= state.rounds * state.orderManagerIds.length;
  return {
    ...state,
    pickIndex: nextIndex,
    status: complete ? 'completed' as const : 'active' as const,
    picks: [...state.picks, { overall: nextIndex, round: Math.floor(state.pickIndex / state.orderManagerIds.length) + 1, managerId, playerId, group, source }],
  };
}

export function isSoloFantasyDraftState(value: unknown): value is SoloFantasyDraftState {
  if (!value || typeof value !== 'object') return false;
  const state = value as SoloFantasyDraftState;
  if (state.version !== 2 || !state.setup || ![8, 10, 12].includes(state.setup.leagueSize) || !Array.isArray(state.managers) || !Array.isArray(state.orderManagerIds) || !Array.isArray(state.picks)) return false;
  if (![state.setup.leagueName, state.setup.teamName, state.setup.location, state.setup.logoUrl].every(field => typeof field === 'string' && field.trim())) return false;
  if (state.rounds !== SOLO_FANTASY_ROUNDS || !Number.isFinite(state.seed) || !['active', 'completed'].includes(state.status)) return false;
  if (state.managers.length !== state.setup.leagueSize || state.orderManagerIds.length !== state.managers.length || state.managers.filter(manager => manager.isUser).length !== 1) return false;
  const managerIds = new Set(state.managers.map(manager => manager.id));
  if (managerIds.size !== state.managers.length || new Set(state.orderManagerIds).size !== state.managers.length || state.orderManagerIds.some(id => !managerIds.has(id))) return false;
  if (state.managers.some(manager => !manager.id || !manager.name.trim() || !manager.location.trim() || !manager.logoUrl.trim())) return false;
  const totalPicks = state.rounds * state.managers.length;
  if (!Number.isInteger(state.pickIndex) || state.pickIndex !== state.picks.length || state.pickIndex > totalPicks || state.status !== (state.pickIndex === totalPicks ? 'completed' : 'active')) return false;
  const draftedIds = new Set<string>();
  return state.picks.every((pick, index) => {
    const player = SOLO_FANTASY_PLAYER_BY_ID.get(pick.playerId);
    if (!player || draftedIds.has(pick.playerId)) return false;
    draftedIds.add(pick.playerId);
    return pick.overall === index + 1
      && pick.round === Math.floor(index / state.managers.length) + 1
      && pick.managerId === soloFantasyManagerAt(state, index)
      && pick.group === groupFor(player)
      && ['manual', 'cpu', 'autopick'].includes(pick.source);
  });
}

export function soloFantasyManagerScore(state: SoloFantasyDraftState, managerId: string) {
  const roster = soloFantasyRoster(state, managerId);
  if (!roster.length) return 0;
  const counts = soloFantasyCounts(state, managerId);
  const minimumsFilled = SOLO_FANTASY_GROUPS.every(group => (counts[group] ?? 0) >= LIVE_FANTASY_ROSTER_REQUIREMENTS[group]);
  return Math.round(roster.reduce((total, player) => total + soloFantasyProjection(player), 0) / roster.length + (minimumsFilled ? 15 : 0));
}
