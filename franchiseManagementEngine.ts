import { PLAYERS_DATABASE } from './players';
import { countRosterGroups, getDraftPositionGroup } from './rosterRules';
import { buildRealTeamRoster } from './soloFranchiseEngine';
import { TEAM_THEMES } from './teamTheme';
import { DEFAULT_SALARY_CAP, Player, ROSTER_REQUIREMENTS } from './types';

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
const CAP_EPSILON = 0.001;

export function playerById(id: string) {
  return PLAYER_BY_ID.get(id) ?? null;
}

export function playersFromIds(ids: string[]) {
  return ids.map(playerById).filter((player): player is Player => Boolean(player));
}

function uniqueKnownIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.filter((id): id is string => typeof id === 'string' && PLAYER_BY_ID.has(id));
  if (ids.length !== value.length || new Set(ids).size !== ids.length) return null;
  return ids;
}

function salvageKnownIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((id): id is string => {
    if (typeof id !== 'string' || !PLAYER_BY_ID.has(id) || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function isValidTransaction(value: unknown): value is FranchiseTransaction {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<FranchiseTransaction>;
  return typeof item.id === 'string'
    && (item.type === 'SIGNING' || item.type === 'RELEASE' || item.type === 'TRADE')
    && typeof item.text === 'string'
    && typeof item.createdAt === 'number'
    && Number.isFinite(item.createdAt);
}

function capUsedByIds(ids: string[]) {
  return playersFromIds(ids).reduce((total, player) => total + Math.max(0, Number(player.salary) || 0), 0);
}

function hasRequiredPositions(ids: string[]) {
  const counts = countRosterGroups(playersFromIds(ids));
  return (Object.entries(ROSTER_REQUIREMENTS) as Array<[keyof typeof ROSTER_REQUIREMENTS, number]>)
    .every(([group, required]) => counts[group] >= required);
}

function rosterIsLegal(ids: string[]) {
  return ids.length >= FRANCHISE_MIN_ROSTER
    && hasRequiredPositions(ids)
    && capUsedByIds(ids) <= DEFAULT_SALARY_CAP + CAP_EPSILON;
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
  if (!uniqueKnownIds(state.rosterIds)) return false;
  if (!state.cpuRosters || typeof state.cpuRosters !== 'object') return false;
  for (const team of TEAM_THEMES) {
    if (!uniqueKnownIds(state.cpuRosters[team.abbr])) return false;
  }
  return Array.isArray(state.transactions) && state.transactions.every(isValidTransaction);
}

/**
 * Restore a saved franchise while preserving valid ownership, depth order and transaction history.
 * Roster refreshes can remove player IDs, so CPU teams are repaired by keeping known saved players
 * first and filling only missing slots from current rosters. Players already owned by the user or
 * another repaired CPU team are never duplicated.
 */
export function restoreFranchiseManagement(value: unknown, expectedTeam?: string): FranchiseManagementState | null {
  if (!value || typeof value !== 'object') return null;
  const state = value as FranchiseManagementState;
  if (state.version !== 1 || !TEAM_THEMES.some(team => team.abbr === state.teamAbbr)) return null;
  if (expectedTeam && state.teamAbbr !== expectedTeam) return null;

  const rosterIds = salvageKnownIds(state.rosterIds);
  if (!rosterIds.length) return null;

  const current = createFranchiseManagement(state.teamAbbr);
  const savedCpu = state.cpuRosters && typeof state.cpuRosters === 'object' ? state.cpuRosters : {};
  const owned = new Set(rosterIds);
  const cpuRosters: Record<string, string[]> = {};

  for (const team of TEAM_THEMES) {
    if (team.abbr === state.teamAbbr) {
      cpuRosters[team.abbr] = [...rosterIds];
      continue;
    }

    const baseline = current.cpuRosters[team.abbr] ?? [];
    const targetSize = baseline.length;
    const repaired: string[] = [];

    for (const id of salvageKnownIds(savedCpu[team.abbr])) {
      if (owned.has(id)) continue;
      repaired.push(id);
      owned.add(id);
    }

    const fillCandidates = [
      ...baseline,
      ...PLAYERS_DATABASE.filter(player => player.team === team.abbr).map(player => player.id),
    ];
    for (const id of fillCandidates) {
      if (repaired.length >= targetSize) break;
      if (!PLAYER_BY_ID.has(id) || owned.has(id)) continue;
      repaired.push(id);
      owned.add(id);
    }

    cpuRosters[team.abbr] = repaired;
  }

  const transactions = Array.isArray(state.transactions)
    ? state.transactions.filter(isValidTransaction).slice(0, 80)
    : [];

  return { ...state, rosterIds, cpuRosters, transactions };
}

export function franchiseRoster(state: FranchiseManagementState) {
  return playersFromIds(state.rosterIds);
}

export function franchiseCapUsed(state: FranchiseManagementState) {
  return capUsedByIds(state.rosterIds);
}

export function franchiseCapLeft(state: FranchiseManagementState) {
  return Math.max(0, DEFAULT_SALARY_CAP - franchiseCapUsed(state));
}

export function franchiseFreeAgents(state: FranchiseManagementState) {
  const rostered = new Set<string>();
  Object.entries(state.cpuRosters).forEach(([teamAbbr, ids]) => {
    if (teamAbbr === state.teamAbbr) return;
    ids.forEach(id => rostered.add(id));
  });
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
      ...state.transactions.filter(isValidTransaction),
    ].slice(0, 80),
  };
}

function affordableRecoverySigningExists(state: FranchiseManagementState) {
  const capLeft = franchiseCapLeft(state);
  return franchiseFreeAgents(state).some(player => {
    const salary = Math.max(0, Number(player.salary) || 0);
    if (salary > capLeft + CAP_EPSILON) return false;
    const candidateIds = [...state.rosterIds, player.id];
    const improvesSize = state.rosterIds.length < FRANCHISE_MIN_ROSTER && candidateIds.length > state.rosterIds.length;
    const improvesRequired = !hasRequiredPositions(state.rosterIds) && hasRequiredPositions(candidateIds);
    return improvesSize || improvesRequired || rosterIsLegal(candidateIds);
  });
}

export function signFreeAgent(state: FranchiseManagementState, playerId: string) {
  const player = PLAYER_BY_ID.get(playerId);
  if (!player) return { state, ok: false, message: 'That free agent is no longer available.' };
  if (state.rosterIds.includes(playerId)) return { state, ok: false, message: `${player.name} is already on your roster.` };
  if (state.rosterIds.length >= FRANCHISE_MAX_ROSTER) return { state, ok: false, message: `Roster limit reached. Release a player before signing ${player.name}.` };
  if ((Number(player.salary) || 0) > franchiseCapLeft(state) + CAP_EPSILON) return { state, ok: false, message: `Not enough cap space to sign ${player.name}.` };
  const freeIds = new Set(franchiseFreeAgents(state).map(candidate => candidate.id));
  if (!freeIds.has(playerId)) return { state, ok: false, message: `${player.name} is under contract with another team.` };
  const salary = Math.max(0, Number(player.salary) || 0);
  const next = addTransaction({ ...state, rosterIds: [...state.rosterIds, playerId] }, 'SIGNING', `Signed ${player.name} (${player.position}, ${player.ovr} OVR) for $${salary.toFixed(2)}M.`);
  return { state: next, ok: true, message: `${player.name} signed.` };
}

export function releasePlayer(state: FranchiseManagementState, playerId: string) {
  const player = PLAYER_BY_ID.get(playerId);
  if (!player || !state.rosterIds.includes(playerId)) return { state, ok: false, message: 'Player is not on your roster.' };

  const nextRosterIds = state.rosterIds.filter(id => id !== playerId);
  const overCap = franchiseCapUsed(state) > DEFAULT_SALARY_CAP + CAP_EPSILON;
  const illegalRoster = !rosterIsLegal(state.rosterIds);
  const recoveryRelease = overCap || (illegalRoster && !affordableRecoverySigningExists(state));

  if (!recoveryRelease && nextRosterIds.length < FRANCHISE_MIN_ROSTER) {
    return { state, ok: false, message: `Keep at least ${FRANCHISE_MIN_ROSTER} players. Sign a replacement before releasing someone.` };
  }
  if (!recoveryRelease && !hasRequiredPositions(nextRosterIds)) {
    return { state, ok: false, message: `${player.name} is your last required ${getDraftPositionGroup(player) ?? player.position}. Add a replacement before releasing him.` };
  }

  const next = addTransaction({ ...state, rosterIds: nextRosterIds }, 'RELEASE', `Released ${player.name} (${player.position}, ${player.ovr} OVR).`);
  return {
    state: next,
    ok: true,
    message: recoveryRelease
      ? `${player.name} released during roster recovery. Build a legal, cap-compliant roster before playing.`
      : `${player.name} released.`,
  };
}

export function depthGroups(state: FranchiseManagementState) {
  const groups = new Map<string, Player[]>();
  for (const player of franchiseRoster(state)) {
    const group = getDraftPositionGroup(player);
    const list = groups.get(group ?? player.position) ?? [];
    list.push(player);
    groups.set(group ?? player.position, list);
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
  const contractPenalty = Math.max(0, (Number(player.salary) || 0) - 10) * 0.2;
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

  const nextRosterIds = state.rosterIds.map(id => id === outgoingId ? incomingId : id);
  const nextTargetRoster = targetRoster.map(id => id === incomingId ? outgoingId : id);
  if (!hasRequiredPositions(nextRosterIds) || !hasRequiredPositions(nextTargetRoster)) {
    return { state, decision: 'rejected' as TradeDecision, message: 'That trade would leave one team without a required starter position.' };
  }

  const currentUserCap = capUsedByIds(state.rosterIds);
  const currentTargetCap = capUsedByIds(targetRoster);
  const projectedUserCap = capUsedByIds(nextRosterIds);
  const projectedTargetCap = capUsedByIds(nextTargetRoster);
  const userCapInvalid = projectedUserCap > DEFAULT_SALARY_CAP + CAP_EPSILON && projectedUserCap >= currentUserCap - CAP_EPSILON;
  const targetCapInvalid = projectedTargetCap > DEFAULT_SALARY_CAP + CAP_EPSILON && projectedTargetCap >= currentTargetCap - CAP_EPSILON;

  if (userCapInvalid || targetCapInvalid) {
    return {
      state,
      decision: 'rejected' as TradeDecision,
      message: userCapInvalid
        ? 'That trade would put you over the salary cap.'
        : `That trade would put ${targetTeamAbbr} over the salary cap.`,
    };
  }

  const outgoingValue = tradeValue(outgoing);
  const incomingValue = tradeValue(incoming);
  const gap = incomingValue - outgoingValue;
  const decision: TradeDecision = gap <= 4.5 ? 'accepted' : gap <= 11 ? 'counter' : 'rejected';

  if (decision !== 'accepted') {
    return {
      state,
      decision,
      message: decision === 'counter'
        ? `${targetTeamAbbr} wants a stronger return for ${incoming.name}. Try a higher-rated player.`
        : `${targetTeamAbbr} rejected the offer.`,
    };
  }

  const nextCpu = {
    ...state.cpuRosters,
    [targetTeamAbbr]: nextTargetRoster,
  };
  const next = addTransaction({ ...state, rosterIds: nextRosterIds, cpuRosters: nextCpu }, 'TRADE', `Traded ${outgoing.name} to ${targetTeamAbbr} for ${incoming.name}.`);
  return { state: next, decision, message: `Trade accepted: ${incoming.name} joins your team.` };
}

export function cpuRosterPlayers(state: FranchiseManagementState) {
  return Object.fromEntries(
    TEAM_THEMES.map(team => [team.abbr, playersFromIds(state.cpuRosters[team.abbr] ?? [])]),
  ) as Record<string, Player[]>;
}
