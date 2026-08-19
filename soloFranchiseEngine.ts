import { calculateTeamRatings } from './evaluation';
import { PLAYERS_DATABASE } from './players';
import { getDraftPositionGroup, validateRosterShape } from './rosterRules';
import { TEAM_THEMES, TeamTheme } from './teamTheme';
import { LeagueMember, Player, ROSTER_REQUIREMENTS, TeamRatings } from './types';
import { SoloDifficulty } from './soloSeasonEngine';

export const FANTASY_DRAFT_ROUNDS = 20;
export const SOLO_FRANCHISE_SAVE_KEYS = {
  cap: 'ballknower_solo_run_v1',
  fantasy: 'ballknower_solo_fantasy_v1',
  real: 'ballknower_solo_real_team_v1',
  player: 'ballknower_solo_my_player_v1',
} as const;

const PLAYER_BY_ID = new Map(PLAYERS_DATABASE.map(player => [player.id, player]));
const TEAM_BY_ABBR = new Map(TEAM_THEMES.map(team => [team.abbr, team]));
const REQUIRED_GROUPS = Object.entries(ROSTER_REQUIREMENTS) as Array<[keyof typeof ROSTER_REQUIREMENTS, number]>;
const PLAYERS_BY_GROUP = new Map(REQUIRED_GROUPS.map(([group]) => [
  group,
  PLAYERS_DATABASE
    .filter(player => getDraftPositionGroup(player) === group)
    .sort((first, second) => (second.ovr * 100 - second.salary * 0.01) - (first.ovr * 100 - first.salary * 0.01) || first.name.localeCompare(second.name)),
]));

export type FantasyDraftPick = {
  overall: number;
  round: number;
  teamAbbr: string;
  playerId: string;
};

export type FantasyDraftState = {
  version: 1;
  userTeamAbbr: string;
  teamOrder: string[];
  rosters: Record<string, string[]>;
  draftedIds: string[];
  picks: FantasyDraftPick[];
  pickIndex: number;
  seed: number;
};

function seeded(seed: number) {
  let value = seed | 0;
  return () => {
    value = Math.imul(value ^ value >>> 15, 1 | value);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function safeTeam(abbr: string) {
  return TEAM_BY_ABBR.get(abbr) ?? TEAM_THEMES[0];
}

function rosterCounts(roster: Player[]) {
  const counts: Record<string, number> = {};
  for (const player of roster) {
    const group = getDraftPositionGroup(player);
    counts[group] = (counts[group] ?? 0) + 1;
  }
  return counts;
}

export function buildRealTeamRoster(teamAbbr: string): Player[] {
  const teamPlayers = PLAYERS_DATABASE.filter(player => player.team === teamAbbr);
  const selected: Player[] = [];
  const selectedIds = new Set<string>();

  for (const [group, required] of REQUIRED_GROUPS) {
    const candidates = teamPlayers
      .filter(player => getDraftPositionGroup(player) === group)
      .sort((first, second) => second.ovr - first.ovr || first.name.localeCompare(second.name));
    for (const player of candidates.slice(0, required)) {
      if (selectedIds.has(player.id)) continue;
      selected.push(player);
      selectedIds.add(player.id);
    }
  }

  return selected;
}

export function franchiseSchedule(userTeamAbbr: string): TeamTheme[] {
  const start = Math.max(0, TEAM_THEMES.findIndex(team => team.abbr === userTeamAbbr));
  const rotated = [...TEAM_THEMES.slice(start + 1), ...TEAM_THEMES.slice(0, start + 1)];
  return rotated.filter(team => team.abbr !== userTeamAbbr).slice(0, 17);
}

export function makeFranchiseOpponent(
  team: TeamTheme,
  roster: Player[],
  difficulty: SoloDifficulty,
  idSuffix: string | number,
): LeagueMember {
  const bias = { rookie: -4, pro: 0, all_pro: 2, all_madden: 4 }[difficulty];
  const base = calculateTeamRatings(roster);
  const adjust = (rating: number) => Math.max(65, Math.min(99, rating + bias));
  const ratings = {
    ...base,
    overall: adjust(base.overall),
    offense: adjust(base.offense),
    defense: adjust(base.defense),
    passing: adjust(base.passing),
    rushing: adjust(base.rushing),
    passRush: adjust(base.passRush),
    runDefense: adjust(base.runDefense),
    coverage: adjust(base.coverage),
  } as TeamRatings;

  return {
    id: `franchise-${team.abbr}-${idSuffix}`,
    userId: `franchise-${team.abbr}`,
    userName: team.name,
    isCommissioner: false,
    isAi: true,
    status: 'ready',
    roster,
    teamRatings: ratings,
  };
}

function shuffledTeamOrder(seed: number) {
  const random = seeded(seed);
  const teams = TEAM_THEMES.map(team => team.abbr);
  for (let index = teams.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [teams[index], teams[swapIndex]] = [teams[swapIndex], teams[index]];
  }
  return teams;
}

export function fantasyDraftTeamAt(state: FantasyDraftState, pickIndex = state.pickIndex) {
  if (pickIndex >= state.teamOrder.length * FANTASY_DRAFT_ROUNDS) return null;
  const round = Math.floor(pickIndex / state.teamOrder.length);
  const slot = pickIndex % state.teamOrder.length;
  return round % 2 === 0 ? state.teamOrder[slot] : state.teamOrder[state.teamOrder.length - 1 - slot];
}

export function fantasyRosterPlayers(state: FantasyDraftState, teamAbbr: string) {
  return (state.rosters[teamAbbr] ?? []).map(id => PLAYER_BY_ID.get(id)).filter((player): player is Player => Boolean(player));
}

export function isFantasyPickLegal(state: FantasyDraftState, teamAbbr: string, player: Player) {
  if (state.draftedIds.includes(player.id)) return false;
  const group = getDraftPositionGroup(player) as keyof typeof ROSTER_REQUIREMENTS;
  const required = ROSTER_REQUIREMENTS[group];
  if (!required) return false;
  const counts = rosterCounts(fantasyRosterPlayers(state, teamAbbr));
  return (counts[group] ?? 0) < required;
}

function chooseCpuFantasyPick(state: FantasyDraftState, teamAbbr: string) {
  const roster = fantasyRosterPlayers(state, teamAbbr);
  const counts = rosterCounts(roster);
  const drafted = new Set(state.draftedIds);
  const teamIndex = TEAM_THEMES.findIndex(team => team.abbr === teamAbbr);
  let best: Player | null = null;
  let bestScore = -Infinity;

  for (const [group, required] of REQUIRED_GROUPS) {
    const current = counts[group] ?? 0;
    if (current >= required) continue;
    const player = PLAYERS_BY_GROUP.get(group)?.find(candidate => !drafted.has(candidate.id));
    if (!player) continue;

    const urgency = (required - current) / required;
    const groupFlavor = teamIndex % 4 === 0 && ['QB', 'WR'].includes(group)
      ? 16
      : teamIndex % 4 === 1 && ['DL_EDGE', 'LB', 'CB', 'S'].includes(group)
        ? 14
        : teamIndex % 4 === 2 && ['OL', 'RB'].includes(group)
          ? 12
          : 0;
    const score = player.ovr * 100 + urgency * 24 + groupFlavor - player.salary * 0.01;
    if (score > bestScore || (score === bestScore && player.name.localeCompare(best?.name ?? '') < 0)) {
      best = player;
      bestScore = score;
    }
  }

  return best;
}

function appendPick(state: FantasyDraftState, teamAbbr: string, player: Player): FantasyDraftState {
  const overall = state.pickIndex + 1;
  return {
    ...state,
    rosters: { ...state.rosters, [teamAbbr]: [...(state.rosters[teamAbbr] ?? []), player.id] },
    draftedIds: [...state.draftedIds, player.id],
    picks: [...state.picks, { overall, round: Math.floor(state.pickIndex / 32) + 1, teamAbbr, playerId: player.id }],
    pickIndex: state.pickIndex + 1,
  };
}

export function advanceFantasyCpuPicks(source: FantasyDraftState): FantasyDraftState {
  let state = source;
  const totalPicks = state.teamOrder.length * FANTASY_DRAFT_ROUNDS;
  while (state.pickIndex < totalPicks) {
    const teamAbbr = fantasyDraftTeamAt(state);
    if (!teamAbbr || teamAbbr === state.userTeamAbbr) break;
    const player = chooseCpuFantasyPick(state, teamAbbr);
    if (!player) break;
    state = appendPick(state, teamAbbr, player);
  }
  return state;
}

export function createFantasyDraft(userTeamAbbr: string, seed = Date.now()): FantasyDraftState {
  const teamOrder = shuffledTeamOrder(seed);
  const rosters = Object.fromEntries(TEAM_THEMES.map(team => [team.abbr, []])) as Record<string, string[]>;
  return advanceFantasyCpuPicks({
    version: 1,
    userTeamAbbr: safeTeam(userTeamAbbr).abbr,
    teamOrder,
    rosters,
    draftedIds: [],
    picks: [],
    pickIndex: 0,
    seed,
  });
}

export function makeFantasyUserPick(state: FantasyDraftState, playerId: string): FantasyDraftState {
  const currentTeam = fantasyDraftTeamAt(state);
  const player = PLAYER_BY_ID.get(playerId);
  if (currentTeam !== state.userTeamAbbr || !player || !isFantasyPickLegal(state, currentTeam, player)) return state;
  return advanceFantasyCpuPicks(appendPick(state, currentTeam, player));
}

export function fantasyDraftComplete(state: FantasyDraftState) {
  return state.pickIndex >= state.teamOrder.length * FANTASY_DRAFT_ROUNDS;
}

export function fantasyAvailablePlayers(state: FantasyDraftState) {
  return PLAYERS_DATABASE.filter(player => isFantasyPickLegal(state, state.userTeamAbbr, player))
    .sort((first, second) => second.ovr - first.ovr || first.name.localeCompare(second.name));
}

export function fantasyPickPlayer(pick: FantasyDraftPick) {
  return PLAYER_BY_ID.get(pick.playerId) ?? null;
}

export function fantasyTeam(abbr: string) {
  return safeTeam(abbr);
}

export function isValidFantasyDraftState(value: unknown, requireComplete = false): value is FantasyDraftState {
  if (!value || typeof value !== 'object') return false;
  const state = value as FantasyDraftState;
  const validTeams = new Set(TEAM_THEMES.map(team => team.abbr));
  const totalPicks = TEAM_THEMES.length * FANTASY_DRAFT_ROUNDS;
  if (state.version !== 1 || !validTeams.has(state.userTeamAbbr)) return false;
  if (!Array.isArray(state.teamOrder) || state.teamOrder.length !== TEAM_THEMES.length || new Set(state.teamOrder).size !== TEAM_THEMES.length || state.teamOrder.some(team => !validTeams.has(team))) return false;
  if (!Number.isInteger(state.pickIndex) || state.pickIndex < 0 || state.pickIndex > totalPicks || (requireComplete && state.pickIndex !== totalPicks)) return false;
  if (!Array.isArray(state.draftedIds) || !Array.isArray(state.picks) || state.draftedIds.length !== state.pickIndex || state.picks.length !== state.pickIndex) return false;
  if (new Set(state.draftedIds).size !== state.draftedIds.length || state.draftedIds.some(id => !PLAYER_BY_ID.has(id))) return false;
  if (!state.rosters || typeof state.rosters !== 'object') return false;

  const expectedRosters = Object.fromEntries(TEAM_THEMES.map(team => [team.abbr, [] as string[]])) as Record<string, string[]>;
  for (let index = 0; index < state.picks.length; index += 1) {
    const pick = state.picks[index];
    const expectedTeam = fantasyDraftTeamAt(state, index);
    if (!pick || pick.overall !== index + 1 || pick.round !== Math.floor(index / TEAM_THEMES.length) + 1 || pick.teamAbbr !== expectedTeam || pick.playerId !== state.draftedIds[index] || !PLAYER_BY_ID.has(pick.playerId)) return false;
    expectedRosters[pick.teamAbbr].push(pick.playerId);
  }

  for (const team of TEAM_THEMES) {
    const ids = state.rosters[team.abbr];
    if (!Array.isArray(ids) || ids.some(id => !PLAYER_BY_ID.has(id)) || ids.join('|') !== expectedRosters[team.abbr].join('|')) return false;
    const players = ids.map(id => PLAYER_BY_ID.get(id) as Player);
    const counts = rosterCounts(players);
    if (REQUIRED_GROUPS.some(([group, required]) => (counts[group] ?? 0) > required)) return false;
    if (state.pickIndex === totalPicks && (players.length !== FANTASY_DRAFT_ROUNDS || validateRosterShape(players).length)) return false;
  }
  return true;
}
