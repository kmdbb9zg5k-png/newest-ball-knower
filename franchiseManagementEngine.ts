import { PLAYERS_DATABASE } from './players';
import { getDraftPositionGroup } from './rosterRules';
import { buildRealTeamRoster } from './soloFranchiseEngine';
import { TEAM_THEMES } from './teamTheme';
import { DEFAULT_SALARY_CAP, Player } from './types';

export type FranchiseTransaction = {
  id: string;
  type: 'SIGNING' | 'RELEASE' | 'TRADE';
  text: string;
  createdAt: number;
};

export type FranchiseManagementState = {
  version: 1;
  teamAbbr: string;
  rosterIds: string[];
  cpuRosters: Record<string, string[]>;
  transactions: FranchiseTransaction[];
};

const PLAYER_BY_ID = new Map(PLAYERS_DATABASE.map(player => [player.id, player]));

export const FRANCHISE_MAX_ROSTER = 24;
export const FRANCHISE_MIN_ROSTER = 20;

export function playerById(id: string) {
  return PLAYER_BY_ID.get(id) ?? null;
}

export function playersFromIds(ids: string[]) {
  return ids.map(playerById).filter((player): player is Player => Boolean(player));
}

export function createFranchiseManagement(teamAbbr: string): FranchiseManagementState {
  const cpuRosters = Object.fromEntries(
    TEAM_THEMES.map(team => [team.abbr, buildRealTeamRoster(team.abbr).map(player => player.id)]),
  ) as Record<string, string[]>;
  return {
    version: 1,
    teamAbbr,
    rosterIds: [...(cpuRosters[teamAbbr] ?? [])],
    cpuRosters,
    transactions: [],
  };
}

export function isValidFranchiseManagement(value: unknown, expectedTeam?: string): value is FranchiseManagementState {
  if (!value || typeof value !== 'object') return false;
  const state = value as FranchiseManagementState;
  if (state.version !== 1 || !TEAM_THEMES.some(team => team.abbr === state.teamAbbr)) return false;
  if (expectedTeam && state.teamAbbr !== expectedTeam) return false;
  if (!Array.isArray(state.rosterIds) || state.rosterIds.some(id => !PLAYER_BY_ID.has(id)) || new Set(state.rosterIds).size !== state.rosterIds.length) return false;
  if (!state.cpuRosters || typeof state.cpuRosters !== 'object') return false;
  for (const team of TEAM_THEMES) {
    const ids = state.cpuRosters[team.abbr];
    if (!Array.isArray(ids) || ids.some(id => !PLAYER_BY_ID.has(id)) || new Set(ids).size !== ids.length) return false;
  }
  return Array.isArray(state.transactions);
}

export function franchiseRoster(state: FranchiseManagementState) {
  return playersFromIds(state.rosterIds);
}

export function franchiseCapUsed(state: FranchiseManagementState) {
  return franchiseRoster(state).reduce((total, player) => total + Math.max(0, Number(player.salary) || 0), 0);
}

export function franchiseCapLeft(state: FranchiseManagementState) {
  return Math.max(0, DEFAULT_SALARY_CAP - franchiseCapUsed(state));
}

export function franchiseFreeAgents(state: FranchiseManagementState) {
  const rostered = new Set<string>();
  Object.values(state.cpuRosters).forEach(ids => ids.forEach(id => rostered.add(id)));
  state.rosterIds.forEach(id => rostered.add(id));
  return PLAYERS_DATABASE
    .filter(player => !rostered.has(player.id))
    .slice()
    .sort((first, second) => second.ovr - first.ovr || (first.salary || 0) - (second.salary || 0) || first.name.localeCompare(second.name));
}

function addTransaction(state: FranchiseManagementState, type: FranchiseTransaction['type'], text: string) {
  return {
    ...state,
    transactions: [
      { id: `${Date.now()}-${state.transactions.length}`, type, text, createdAt: Date.now() },
      ...state.transactions,
    ].slice(0, 80),
  };
}

export function signFreeAgent(state: FranchiseManagementState, playerId: string) {
  const player = PLAYER_BY_ID.get(playerId);
  if (!player) return { state, ok: false, message: 'That free agent is no longer available.' };
  if (state.rosterIds.includes(playerId)) return { state, ok: false, message: `${player.name} is already on your roster.` };
  if (state.rosterIds.length >= FRANCHISE_MAX_ROSTER) return { state, ok: false, message: `Roster limit reached. Release a player before signing ${player.name}.` };
  if ((Number(player.salary) || 0) > franchiseCapLeft(state)) return { state, ok: false, message: `Not enough cap space to sign ${player.name}.` };
  const freeIds = new Set(franchiseFreeAgents(state).map(candidate => candidate.id));
  if (!freeIds.has(playerId)) return { state, ok: false, message: `${player.name} is under contract with another team.` };
  const next = addTransaction({ ...state, rosterIds: [...state.rosterIds, playerId] }, 'SIGNING', `Signed ${player.name} (${player.position}, ${player.ovr} OVR) for $${player.salary.toFixed(2)}M.`);
  return { state: next, ok: true, message: `${player.name} signed.` };
}

export function releasePlayer(state: FranchiseManagementState, playerId: string) {
  const player = PLAYER_BY_ID.get(playerId);
  if (!player || !state.rosterIds.includes(playerId)) return { state, ok: false, message: 'Player is not on your roster.' };
  if (state.rosterIds.length <= FRANCHISE_MIN_ROSTER) return { state, ok: false, message: `Keep at least ${FRANCHISE_MIN_ROSTER} players. Sign a replacement before releasing someone.` };
  const next = addTransaction({ ...state, rosterIds: state.rosterIds.filter(id => id !== playerId) }, 'RELEASE', `Released ${player.name} (${player.position}, ${player.ovr} OVR).`);
  return { state: next, ok: true, message: `${player.name} released.` };
}

export function depthGroups(state: FranchiseManagementState) {
  const groups = new Map<string, Player[]>();
  for (const player of franchiseRoster(state)) {
    const group = getDraftPositionGroup(player);
    const list = groups.get(group) ?? [];
    list.push(player);
    groups.set(group, list);
  }
  return [...groups.entries()].map(([group, players]) => ({ group, players }));
}

export function moveDepthPlayer(state: FranchiseManagementState, playerId: string, direction: -1 | 1) {
  const player = PLAYER_BY_ID.get(playerId);
  if (!player) return state;
  const group = getDraftPositionGroup(player);
  const groupIds = state.rosterIds.filter(id => {
    const candidate = PLAYER_BY_ID.get(id);
    return candidate && getDraftPositionGroup(candidate) === group;
  });
  const index = groupIds.indexOf(playerId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= groupIds.length) return state;
  [groupIds[index], groupIds[nextIndex]] = [groupIds[nextIndex], groupIds[index]];
  let groupCursor = 0;
  return {
    ...state,
    rosterIds: state.rosterIds.map(id => {
      const candidate = PLAYER_BY_ID.get(id);
      if (!candidate || getDraftPositionGroup(candidate) !== group) return id;
      const replacement = groupIds[groupCursor];
      groupCursor += 1;
      return replacement;
    }),
  };
}

function tradeValue(player: Player) {
  const agePenalty = Math.max(0, (player.age ?? 26) - 28) * 0.65;
  const contractPenalty = Math.max(0, (player.salary || 0) - 10) * 0.2;
  return player.ovr * 1.45 - agePenalty - contractPenalty;
}

export type TradeDecision = 'accepted' | 'counter' | 'rejected';

export function proposeTrade(state: FranchiseManagementState, outgoingId: string, targetTeamAbbr: string, incomingId: string) {
  const outgoing = PLAYER_BY_ID.get(outgoingId);
  const incoming = PLAYER_BY_ID.get(incomingId);
  const targetRoster = state.cpuRosters[targetTeamAbbr] ?? [];
  if (!outgoing || !incoming || !state.rosterIds.includes(outgoingId) || !targetRoster.includes(incomingId) || targetTeamAbbr === state.teamAbbr) {
    return { state, decision: 'rejected' as TradeDecision, message: 'That trade package is no longer valid.' };
  }

  const outgoingValue = tradeValue(outgoing);
  const incomingValue = tradeValue(incoming);
  const projectedCap = franchiseCapUsed(state) - (outgoing.salary || 0) + (incoming.salary || 0);
  const gap = incomingValue - outgoingValue;
  let decision: TradeDecision = gap <= 4.5 ? 'accepted' : gap <= 11 ? 'counter' : 'rejected';
  if (projectedCap > DEFAULT_SALARY_CAP) decision = 'rejected';

  if (decision !== 'accepted') {
    return {
      state,
      decision,
      message: decision === 'counter'
        ? `${targetTeamAbbr} wants a stronger return for ${incoming.name}. Try a higher-rated player.`
        : projectedCap > DEFAULT_SALARY_CAP
          ? 'That trade would put you over the salary cap.'
          : `${targetTeamAbbr} rejected the offer.` ,
    };
  }

  const nextCpu = {
    ...state.cpuRosters,
    [targetTeamAbbr]: targetRoster.map(id => id === incomingId ? outgoingId : id),
  };
  const nextRosterIds = state.rosterIds.map(id => id === outgoingId ? incomingId : id);
  const next = addTransaction({ ...state, rosterIds: nextRosterIds, cpuRosters: nextCpu }, 'TRADE', `Traded ${outgoing.name} to ${targetTeamAbbr} for ${incoming.name}.`);
  return { state: next, decision, message: `Trade accepted: ${incoming.name} joins your team.` };
}

export function cpuRosterPlayers(state: FranchiseManagementState) {
  return Object.fromEntries(
    TEAM_THEMES.map(team => [team.abbr, playersFromIds(state.cpuRosters[team.abbr] ?? [])]),
  ) as Record<string, Player[]>;
}
