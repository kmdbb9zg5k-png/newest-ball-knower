import type { InjuryEvent, PlayerLine } from './soloSeasonEngine';
import type { Player, TeamRatings } from './types';

export type FranchiseScenarioKind = 'playing_time' | 'breakout' | 'mentor' | 'trust_repair' | 'leadership' | 'media_pressure' | 'recovery';
export type UpgradeFocus = 'physical' | 'awareness' | 'position';
export type FranchiseNoticeKind = 'story' | 'morale' | 'breakout' | 'injury' | 'upgrade';

export type FranchiseGoal = {
  metric: 'passing' | 'rushing' | 'receiving' | 'defense' | 'kicking' | 'punting' | 'impact';
  primary: number;
  secondary?: number;
  description: string;
};

export type FranchiseScenario = {
  id: string;
  week: number;
  kind: FranchiseScenarioKind;
  playerId: string;
  title: string;
  message: string;
  goal?: FranchiseGoal;
  relatedTo?: string;
  choices: Array<{ id: 'commit' | 'honest' | 'dismiss' | 'mentor' | 'team'; label: string; detail: string }>;
};

export type FranchisePromise = {
  id: string;
  playerId: string;
  dueWeek: number;
  kind: 'playing_time' | 'breakout';
  goal: FranchiseGoal;
  rewardOvr: number;
};

export type PlayerDevelopment = { playerId: string; xp: number; upgradePoints: number; morale: number };
export type FranchiseNotification = { id: string; week: number; kind: FranchiseNoticeKind; title: string; body: string; read: boolean };
export type FranchiseDecision = { scenarioId: string; week: number; choiceId: string; playerId?: string; season?: number; outcome?: string };
export type FranchiseRelationship = { playerId: string; trust: number; meetings: number; promisesKept: number; promisesBroken: number; lastOutcome?: string };
export type FranchiseFollowUp = { id: string; playerId: string; dueWeek: number; kind: 'trust_repair' | 'leadership' | 'recovery'; source: string };

export type FranchiseInteractionState = {
  version: 1;
  development: Record<string, PlayerDevelopment>;
  pendingScenario: FranchiseScenario | null;
  promises: FranchisePromise[];
  notifications: FranchiseNotification[];
  decisions: FranchiseDecision[];
  // Optional on v1 saves. syncFranchiseInteractions fills these without resetting progress.
  season?: number;
  relationships?: Record<string, FranchiseRelationship>;
  followUps?: FranchiseFollowUp[];
  resolvedWeeks?: string[];
};

const TRACKED_POSITIONS = new Set(['QB', 'RB', 'FB', 'WR', 'TE', 'EDGE', 'DT', 'DE', 'NT', 'LB', 'CB', 'S', 'FS', 'SS', 'K', 'P']);
const clamp = (value: number, minimum = 0, maximum = 99) => Math.max(minimum, Math.min(maximum, value));
const stableNumber = (value: string) => Array.from(value).reduce((total, character) => Math.imul(total ^ character.charCodeAt(0), 16777619), 2166136261) >>> 0;

function developmentFor(player: Player): PlayerDevelopment {
  return { playerId: player.id, xp: 0, upgradePoints: 0, morale: 70 + stableNumber(player.id) % 19 };
}

export function createFranchiseInteractions(roster: Player[], week = 1, focusPlayerId?: string, generateScenario = true): FranchiseInteractionState {
  const state: FranchiseInteractionState = {
    version: 1,
    development: Object.fromEntries(roster.map(player => [player.id, developmentFor(player)])),
    pendingScenario: null,
    promises: [],
    notifications: [{ id: `welcome-${week}`, week, kind: 'story', title: 'Coach inbox is live', body: 'Player morale, breakout goals, injuries and upgrades now require your attention.', read: false }],
    decisions: [],
    season: 2026,
    relationships: {},
    followUps: [],
    resolvedWeeks: [],
  };
  return generateScenario ? ensureFranchiseWeek(state, roster, week, focusPlayerId) : state;
}

export function isFranchiseInteractionState(value: unknown): value is FranchiseInteractionState {
  if (!value || typeof value !== 'object') return false;
  const state = value as FranchiseInteractionState;
  return state.version === 1
    && state.development && typeof state.development === 'object'
    && Array.isArray(state.promises)
    && Array.isArray(state.notifications)
    && Array.isArray(state.decisions)
    && (state.pendingScenario === null || (typeof state.pendingScenario?.id === 'string' && Number.isInteger(state.pendingScenario.week)));
}

function relationshipFor(player: Player, saved?: FranchiseRelationship): FranchiseRelationship {
  const number = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return { playerId: player.id, trust: clamp(number(saved?.trust, 60 + stableNumber(player.id) % 16), 0, 100), meetings: Math.max(0, number(saved?.meetings, 0)), promisesKept: Math.max(0, number(saved?.promisesKept, 0)), promisesBroken: Math.max(0, number(saved?.promisesBroken, 0)), lastOutcome: typeof saved?.lastOutcome === 'string' ? saved.lastOutcome : undefined };
}

export function syncFranchiseInteractions(state: FranchiseInteractionState, roster: Player[]): FranchiseInteractionState {
  const ids = new Set(roster.map(player => player.id));
  const development = Object.fromEntries(roster.map(player => [player.id, state.development[player.id] ?? developmentFor(player)]));
  return {
    ...state,
    development,
    season: Number.isInteger(state.season) ? state.season : 2026,
    relationships: Object.fromEntries(roster.map(player => [player.id, relationshipFor(player, state.relationships?.[player.id])])),
    followUps: (Array.isArray(state.followUps) ? state.followUps : []).filter(item => ids.has(item.playerId) && Number.isInteger(item.dueWeek) && ['trust_repair', 'leadership', 'recovery'].includes(item.kind)).slice(-20),
    resolvedWeeks: Array.isArray(state.resolvedWeeks) ? state.resolvedWeeks.filter(key => typeof key === 'string').slice(-90) : [],
    promises: state.promises.filter(promise => ids.has(promise.playerId)),
    pendingScenario: state.pendingScenario && ids.has(state.pendingScenario.playerId) ? state.pendingScenario : null,
  };
}

/** Keep trust, development and the ledger when the schedule rolls over. */
export function advanceFranchiseInteractionSeason(state: FranchiseInteractionState, roster: Player[], year: number, focusPlayerId?: string) {
  const next = syncFranchiseInteractions(state, roster);
  return ensureFranchiseWeek({ ...next, season: year, pendingScenario: null, promises: [], decisions: [], followUps: next.followUps?.map(item => ({ ...item, dueWeek: 1 })) }, roster, 1, focusPlayerId);
}

export function franchiseWeeklyBriefing(state: FranchiseInteractionState, roster: Player[]) {
  const synced = syncFranchiseInteractions(state, roster);
  const relationships = Object.values(synced.relationships!).sort((a, b) => a.trust - b.trust || b.promisesBroken - a.promisesBroken);
  const points = Object.values(synced.development).reduce((sum, item) => sum + item.upgradePoints, 0);
  return { relationships, points, promises: synced.promises, followUps: synced.followUps!, morale: roster.length ? Math.round(Object.values(synced.development).reduce((sum, item) => sum + item.morale, 0) / roster.length) : 0 };
}

export function franchiseMoraleModifier(state: FranchiseInteractionState, roster: Player[]) {
  const morale = roster
    .map(player => state.development[player.id]?.morale)
    .filter((value): value is number => Number.isFinite(value));
  if (!morale.length) return 0;
  const average = morale.reduce((total, value) => total + value, 0) / morale.length;
  const lowest = Math.min(...morale);
  if (lowest < 40) return -3;
  if (lowest < 55) return -2;
  if (lowest < 65 || average < 68) return -1;
  if (average >= 88) return 3;
  if (average >= 82) return 2;
  if (average >= 76) return 1;
  return 0;
}

export function ratingsWithFranchiseMorale(ratings: TeamRatings, state: FranchiseInteractionState, roster: Player[]): TeamRatings {
  const modifier = franchiseMoraleModifier(state, roster);
  if (!modifier) return ratings;
  const adjusted = { ...ratings };
  const keys: Array<keyof Pick<TeamRatings, 'overall' | 'offense' | 'defense' | 'passing' | 'rushing' | 'passProtection' | 'runBlocking' | 'passRush' | 'runDefense' | 'coverage'>> = [
    'overall', 'offense', 'defense', 'passing', 'rushing', 'passProtection', 'runBlocking', 'passRush', 'runDefense', 'coverage',
  ];
  for (const key of keys) adjusted[key] = clamp(adjusted[key] + modifier);
  return adjusted;
}

function goalFor(player: Player, lighter = false): FranchiseGoal {
  const scale = lighter ? .65 : 1;
  if (player.position === 'QB') return { metric: 'passing', primary: Math.round(250 * scale), secondary: lighter ? 1 : 2, description: `${Math.round(250 * scale)} passing yards and ${lighter ? 1 : 2} passing TD${lighter ? '' : 's'}` };
  if (['RB', 'FB'].includes(player.position)) return { metric: 'rushing', primary: Math.round(90 * scale), secondary: 1, description: `${Math.round(90 * scale)} rushing yards and a touchdown` };
  if (['WR', 'TE'].includes(player.position)) return { metric: 'receiving', primary: Math.round(85 * scale), secondary: 1, description: `${Math.round(85 * scale)} receiving yards and a touchdown` };
  if (['EDGE', 'DT', 'DE', 'NT', 'LB', 'CB', 'S', 'FS', 'SS'].includes(player.position)) return { metric: 'defense', primary: lighter ? 5 : 7, secondary: 1, description: `${lighter ? 5 : 7} tackles and a sack or interception` };
  if (player.position === 'K') return { metric: 'kicking', primary: lighter ? 2 : 3, description: `make ${lighter ? 2 : 3} field goals` };
  if (player.position === 'P') return { metric: 'punting', primary: lighter ? 1 : 2, description: `place ${lighter ? 1 : 2} punts inside the 20` };
  return { metric: 'impact', primary: lighter ? 4 : 7, description: `produce an impact score of ${lighter ? 4 : 7}+` };
}

function scenarioFor(state: FranchiseInteractionState, roster: Player[], week: number, focusPlayerId?: string): FranchiseScenario | null {
  const candidates = roster.filter(player => TRACKED_POSITIONS.has(player.position));
  if (!candidates.length) return null;
  const focused = focusPlayerId ? candidates.find(player => player.id === focusPlayerId) : null;
  const followUp = state.followUps?.find(item => item.dueWeek <= week && (item.kind !== 'leadership' || week % 3 === 2) && candidates.some(player => player.id === item.playerId));
  const player = (followUp ? candidates.find(player => player.id === followUp.playerId) : undefined) ?? focused ?? candidates[stableNumber(`${week}:${candidates.map(candidate => candidate.id).join('|')}`) % candidates.length];
  const kind: FranchiseScenarioKind = followUp?.kind ?? (focused ? (week % 2 ? 'breakout' : 'mentor') : (['playing_time', 'breakout', 'mentor', 'media_pressure', 'leadership'] as const)[(week - 1) % 5]);
  const id = `${week}-${kind}-${player.id}`;
  const relatedTo = followUp?.source;
  if (kind === 'trust_repair') return { id, week, kind, playerId: player.id, relatedTo, title: 'A promise has a second chapter', message: `${player.name} remembers the missed goal. ${relatedTo ?? 'The last conversation damaged trust.'} The next conversation will shape whether the relationship recovers.`, choices: [
    { id: 'honest', label: 'Own the missed promise', detail: 'Rebuild 10 trust and 4 morale. No new stat promise.' },
    { id: 'dismiss', label: 'Move on without addressing it', detail: 'Lose 10 trust and 8 morale; the problem remains in the relationship ledger.' },
  ] };
  if (kind === 'recovery') return { id, week, kind, playerId: player.id, relatedTo, title: 'Stay connected through recovery', message: `${player.name} is coming back from an injury report. Stay involved while the medical timeline runs its course.`, choices: [
    { id: 'mentor', label: 'Plan a film and recovery check-in', detail: '+6 trust, +4 morale and 25 XP. This does not shorten the injury.' },
    { id: 'team', label: 'Let the medical staff lead', detail: '+1 morale. Keep the current recovery timetable.' },
  ] };
  if (kind === 'media_pressure') return { id, week, kind, playerId: player.id, title: 'The microphone is waiting', message: `${player.name} is taking questions about the team's direction. Your answer will reach the locker room.`, choices: [
    { id: 'honest', label: 'Take responsibility publicly', detail: '+5 trust and +3 morale. Protect the player without making a performance promise.' },
    { id: 'dismiss', label: 'Challenge the player publicly', detail: '−8 trust and −8 morale. Pressure changes the relationship, not the stat target.' },
    { id: 'team', label: 'Keep the message inside the room', detail: '+2 trust and +1 morale. Address the team together.' },
  ] };
  if (kind === 'leadership') return { id, week, kind, playerId: player.id, relatedTo, title: relatedTo ? 'Earned trust becomes leadership' : 'A voice in the locker room', message: `${player.name} wants to lead the position room.${relatedTo ? ` ${relatedTo}` : ' Give the player a clear role in developing the group.'}`, choices: [
    { id: 'mentor', label: 'Build the weekly film session together', detail: '+6 trust, +4 morale and 55 XP for the leader. Existing promises still apply.' },
    { id: 'team', label: 'Keep leadership with the coaches', detail: '+1 morale. Preserve the current structure.' },
  ] };
  if (kind === 'playing_time') {
    const goal = goalFor(player, true);
    return { id, week, kind, playerId: player.id, title: 'Playing-time meeting', message: `${player.name} is frustrated with the game plan and wants a larger role this week.`, goal, choices: [
      { id: 'commit', label: 'Promise a larger role', detail: `Morale rises now. Deliver ${goal.description} or trust takes a major hit.` },
      { id: 'honest', label: 'Be honest', detail: 'No promise. A small morale loss, but no broken trust later.' },
      { id: 'dismiss', label: 'Dismiss concern', detail: 'Protect the team plan, but the player takes it personally.' },
    ] };
  }
  if (kind === 'breakout') {
    const goal = goalFor(player);
    return { id, week, kind, playerId: player.id, title: 'Breakout opportunity', message: `Coaches believe ${player.name} can take the next step against this opponent.`, goal, choices: [
      { id: 'commit', label: 'Feature the player', detail: `Hit ${goal.description} to earn a +2 OVR breakout and bonus XP.` },
      { id: 'team', label: 'Keep the normal plan', detail: 'No ratings risk or reward. Team morale gets a small boost.' },
    ] };
  }
  return { id, week, kind, playerId: player.id, title: 'Development meeting', message: `${player.name} asked for extra film and position work before this game.`, choices: [
    { id: 'mentor', label: 'Invest coaching time', detail: 'Gain 55 XP now and move closer to an upgrade point.' },
    { id: 'team', label: 'Focus on the team', detail: 'No individual XP; the player accepts the decision.' },
  ] };
}

export function ensureFranchiseWeek(state: FranchiseInteractionState, roster: Player[], week: number, focusPlayerId?: string) {
  const synced = syncFranchiseInteractions(state, roster);
  if (synced.pendingScenario || synced.decisions.some(decision => decision.week === week)) return synced;
  const pendingScenario = scenarioFor(synced, roster, week, focusPlayerId);
  return { ...synced, pendingScenario, followUps: synced.followUps?.filter(item => !(pendingScenario?.relatedTo === item.source && pendingScenario.playerId === item.playerId && item.dueWeek <= week)) };
}

function addNotice(state: FranchiseInteractionState, notice: Omit<FranchiseNotification, 'read'>) {
  return { ...state, notifications: [{ ...notice, read: false }, ...state.notifications.filter(item => item.id !== notice.id)].slice(0, 60) };
}

function addXp(development: PlayerDevelopment, amount: number) {
  const total = development.xp + Math.max(0, Math.round(amount));
  const earned = Math.floor(total / 100);
  return { ...development, xp: total % 100, upgradePoints: development.upgradePoints + earned };
}

export function respondToFranchiseScenario(state: FranchiseInteractionState, choiceId: string, roster: Player[]) {
  const scenario = state.pendingScenario;
  if (!scenario || !scenario.choices.some(choice => choice.id === choiceId)) return state;
  const player = roster.find(item => item.id === scenario.playerId);
  if (!player) return { ...state, pendingScenario: null };
  state = syncFranchiseInteractions(state, roster);
  const current = state.development[player.id] ?? developmentFor(player);
  const relationship = state.relationships![player.id];
  let trustDelta = 0;
  let development = current;
  let promises = state.promises;
  let body = `${player.name} accepted your decision.`;
  if (scenario.kind === 'trust_repair') {
    trustDelta = choiceId === 'honest' ? 10 : -10;
    development = { ...current, morale: clamp(current.morale + (choiceId === 'honest' ? 4 : -8)) };
    body = choiceId === 'honest' ? `${player.name} accepted your accountability. Trust is rebuilding; the missed promise remains in the ledger.` : `${player.name} felt the concern was ignored again. Trust fell further.`;
  } else if (scenario.kind === 'media_pressure') {
    trustDelta = choiceId === 'honest' ? 5 : choiceId === 'dismiss' ? -8 : 2;
    development = { ...current, morale: clamp(current.morale + (choiceId === 'honest' ? 3 : choiceId === 'dismiss' ? -8 : 1)) };
    body = `${player.name} heard your ${choiceId === 'honest' ? 'public support' : choiceId === 'dismiss' ? 'public challenge' : 'team-first message'}. Trust ${trustDelta > 0 ? '+' : ''}${trustDelta}.`;
  } else if (choiceId === 'commit' && scenario.goal) {
    development = { ...current, morale: clamp(current.morale + 8) };
    promises = [...promises, { id: scenario.id, playerId: player.id, dueWeek: scenario.week, kind: scenario.kind === 'breakout' ? 'breakout' : 'playing_time', goal: scenario.goal, rewardOvr: scenario.kind === 'breakout' ? 2 : 0 }];
    trustDelta = 2;
    body = `Promise made to ${player.name}: ${scenario.goal.description}.`;
  } else if (choiceId === 'honest') {
    development = { ...current, morale: clamp(current.morale - 3) };
    trustDelta = 4;
    body = `${player.name} wanted more, but respected the honest answer.`;
  } else if (choiceId === 'dismiss') {
    development = { ...current, morale: clamp(current.morale - 12) };
    trustDelta = -10;
    body = `${player.name}'s morale dropped after the meeting.`;
  } else if (choiceId === 'mentor') {
    const xp = scenario.kind === 'recovery' ? 25 : 55;
    trustDelta = 6;
    development = addXp({ ...current, morale: clamp(current.morale + 4) }, xp);
    body = `${player.name} gained ${xp} XP from ${scenario.kind === 'recovery' ? 'a recovery check-in' : 'extra coaching'}. Trust +6.`;
  } else if (choiceId === 'team') {
    development = { ...current, morale: clamp(current.morale + 1) };
    trustDelta = 1;
    body = `${player.name} agreed to stay focused on the team plan.`;
  }
  let next: FranchiseInteractionState = { ...state, development: { ...state.development, [player.id]: development }, relationships: { ...state.relationships, [player.id]: { ...relationship, trust: clamp(relationship.trust + trustDelta, 0, 100), meetings: relationship.meetings + 1, lastOutcome: body } }, promises, pendingScenario: null, decisions: [...state.decisions, { scenarioId: scenario.id, week: scenario.week, choiceId, season: state.season, playerId: player.id, outcome: body }].slice(-40) };
  next = addNotice(next, { id: `decision-${scenario.id}`, week: scenario.week, kind: scenario.kind === 'breakout' ? 'breakout' : 'morale', title: scenario.title, body });
  if (development.upgradePoints > current.upgradePoints) next = addNotice(next, { id: `upgrade-decision-${scenario.id}`, week: scenario.week, kind: 'upgrade', title: 'Player upgrade available', body: `${player.name} earned an upgrade point from focused development.` });
  return next;
}

export function applyFranchiseOpportunities(state: FranchiseInteractionState, roster: Player[], lines: PlayerLine[], week: number) {
  const next = [...lines];
  for (const promise of state.promises.filter(item => item.dueWeek === week)) {
    if (next.some(line => line.playerId === promise.playerId)) continue;
    const player = roster.find(item => item.id === promise.playerId);
    if (!player) continue;
    const completion = .72 + (stableNumber(`${promise.id}:opportunity`) % 47) / 100;
    const primary = Math.round(promise.goal.primary * completion);
    const secondary = completion >= 1 ? promise.goal.secondary ?? 0 : 0;
    const line: PlayerLine = { playerId: player.id, name: player.name, position: player.position, fantasyScore: Math.max(2, Math.round(primary / 10 + secondary * 5)) };
    if (promise.goal.metric === 'passing') Object.assign(line, { passYds: primary, passTD: secondary, interceptions: completion >= 1 ? 0 : 1 });
    else if (promise.goal.metric === 'rushing') Object.assign(line, { rushYds: primary, rushTD: secondary, receptions: 2, recYds: 16 });
    else if (promise.goal.metric === 'receiving') Object.assign(line, { receptions: Math.max(2, Math.round(primary / 13)), recYds: primary, recTD: secondary });
    else if (promise.goal.metric === 'defense') Object.assign(line, { tackles: primary, sacks: secondary, picks: 0 });
    else if (promise.goal.metric === 'kicking') Object.assign(line, { fgMade: primary, fgAtt: primary + (completion < 1 ? 1 : 0) });
    else if (promise.goal.metric === 'punting') Object.assign(line, { puntsInside20: primary });
    next.push(line);
  }
  return next;
}

function goalMet(goal: FranchiseGoal, line?: PlayerLine) {
  if (!line) return false;
  if (goal.metric === 'passing') return (line.passYds ?? 0) >= goal.primary && (line.passTD ?? 0) >= (goal.secondary ?? 0);
  if (goal.metric === 'rushing') return (line.rushYds ?? 0) >= goal.primary && ((line.rushTD ?? 0) + (line.recTD ?? 0)) >= (goal.secondary ?? 0);
  if (goal.metric === 'receiving') return (line.recYds ?? 0) >= goal.primary && (line.recTD ?? 0) >= (goal.secondary ?? 0);
  if (goal.metric === 'defense') return (line.tackles ?? 0) >= goal.primary && ((line.sacks ?? 0) + (line.picks ?? 0)) >= (goal.secondary ?? 0);
  if (goal.metric === 'kicking') return (line.fgMade ?? 0) >= goal.primary;
  if (goal.metric === 'punting') return (line.puntsInside20 ?? 0) >= goal.primary;
  return line.fantasyScore >= goal.primary;
}

function boostPlayer(player: Player, amount: number): Player {
  const ovr = clamp(player.ovr + amount);
  return { ...player, ovr, overall: ovr, overallRating: ovr, previousRating: player.ovr, attributes: { ...player.attributes, athleticism: clamp(player.attributes.athleticism + amount), footballIQ: clamp(player.attributes.footballIQ + amount) } };
}

export function resolveFranchiseWeek(state: FranchiseInteractionState, roster: Player[], lines: PlayerLine[], week: number, injuries: InjuryEvent[], won: boolean) {
  let next = syncFranchiseInteractions(state, roster);
  const resolutionKey = `${next.season}:${week}`;
  if (next.resolvedWeeks!.includes(resolutionKey)) return { state: next, roster };
  next = { ...next, resolvedWeeks: [...next.resolvedWeeks!, resolutionKey].slice(-90) };
  let nextRoster = [...roster];
  const beforePoints = Object.values(next.development).reduce((sum, item) => sum + item.upgradePoints, 0);
  const lineById = new Map(lines.map(line => [line.playerId, line]));
  const due = next.promises.filter(promise => promise.dueWeek === week);
  for (const promise of due) {
    const player = nextRoster.find(item => item.id === promise.playerId);
    if (!player) continue;
    const success = goalMet(promise.goal, lineById.get(player.id));
    const current = next.development[player.id] ?? developmentFor(player);
    next = { ...next, development: { ...next.development, [player.id]: addXp({ ...current, morale: clamp(current.morale + (success ? 14 : -16)) }, success ? 80 : 10) } };
    const relationship = next.relationships![player.id];
    const outcome = `${success ? 'Kept' : 'Missed'} promise: ${promise.goal.description}.`;
    next = { ...next, relationships: { ...next.relationships, [player.id]: { ...relationship, trust: clamp(relationship.trust + (success ? 10 : -16), 0, 100), promisesKept: relationship.promisesKept + Number(success), promisesBroken: relationship.promisesBroken + Number(!success), lastOutcome: outcome } }, followUps: [...next.followUps!, { id: `follow:${next.season}:${promise.id}`, playerId: player.id, dueWeek: week + (success ? 2 : 1), kind: (success ? 'leadership' : 'trust_repair') as FranchiseFollowUp['kind'], source: outcome }].slice(-20) };
    if (success && promise.rewardOvr) nextRoster = nextRoster.map(item => item.id === player.id ? boostPlayer(item, promise.rewardOvr) : item);
    next = addNotice(next, { id: `promise-${week}-${promise.id}`, week, kind: promise.kind === 'breakout' ? 'breakout' : 'morale', title: success ? 'Goal achieved' : 'Goal missed', body: success ? `${player.name} delivered ${promise.goal.description}${promise.rewardOvr ? ` and earned +${promise.rewardOvr} OVR` : ''}.` : `${player.name} did not reach ${promise.goal.description}. Morale and trust fell.` });
  }
  next = { ...next, promises: next.promises.filter(promise => promise.dueWeek !== week) };
  for (const line of lines) {
    const player = nextRoster.find(item => item.id === line.playerId);
    if (!player) continue;
    const current = next.development[player.id] ?? developmentFor(player);
    next = { ...next, development: { ...next.development, [player.id]: addXp({ ...current, morale: clamp(current.morale + (won ? 2 : -2)) }, Math.max(5, line.fantasyScore * 3)) } };
  }
  for (const injury of injuries) {
    next = { ...next, followUps: [...next.followUps!, { id: `recovery:${next.season}:${week}:${injury.playerId}`, playerId: injury.playerId, dueWeek: week + 1, kind: 'recovery' as const, source: `${injury.playerName} was injured in Week ${week}.` }].slice(-20) };
    next = addNotice(next, { id: `injury-${week}-${injury.playerId}`, week, kind: 'injury', title: `${injury.severity} injury`, body: `${injury.playerName} will miss approximately ${injury.weeks} week${injury.weeks === 1 ? '' : 's'}.` });
  }
  const afterPoints = Object.values(next.development).reduce((sum, item) => sum + item.upgradePoints, 0);
  if (afterPoints > beforePoints) next = addNotice(next, { id: `upgrade-${week}`, week, kind: 'upgrade', title: 'Player upgrade available', body: `${afterPoints - beforePoints} new upgrade point${afterPoints - beforePoints === 1 ? ' is' : 's are'} ready to spend.` });
  return { state: next, roster: nextRoster };
}

export function upgradeFranchisePlayer(state: FranchiseInteractionState, roster: Player[], playerId: string, focus: UpgradeFocus) {
  const development = state.development[playerId];
  const player = roster.find(item => item.id === playerId);
  if (!development || !player || development.upgradePoints < 1 || player.ovr >= 99) return { state, roster };
  const skillByPosition: Record<string, keyof Player['attributes']> = { QB: 'passing', RB: 'rushing', FB: 'rushing', WR: 'receiving', TE: 'receiving', OT: 'passBlocking', LT: 'passBlocking', RT: 'passBlocking', OG: 'runBlocking', LG: 'runBlocking', RG: 'runBlocking', C: 'passBlocking', EDGE: 'passRush', DE: 'passRush', DT: 'runDefense', NT: 'runDefense', LB: 'coverage', CB: 'coverage', S: 'coverage', FS: 'coverage', SS: 'coverage', K: 'kicking', P: 'kicking' };
  const attributes = { ...player.attributes };
  if (focus === 'physical') attributes.athleticism = clamp(attributes.athleticism + 3);
  else if (focus === 'awareness') attributes.footballIQ = clamp(attributes.footballIQ + 3);
  else {
    const key = skillByPosition[player.position] ?? 'footballIQ';
    attributes[key] = clamp((attributes[key] ?? player.ovr) + 3);
  }
  const upgraded = { ...player, ovr: player.ovr + 1, overall: player.ovr + 1, overallRating: player.ovr + 1, previousRating: player.ovr, attributes };
  let next: FranchiseInteractionState = { ...state, development: { ...state.development, [playerId]: { ...development, upgradePoints: development.upgradePoints - 1, morale: clamp(development.morale + 3) } } };
  next = addNotice(next, { id: `spent-${playerId}-${development.upgradePoints}`, week: state.pendingScenario?.week ?? 0, kind: 'upgrade', title: `${player.name} upgraded`, body: `${focus === 'position' ? 'Position skill' : focus} improved. ${player.ovr} → ${upgraded.ovr} OVR.` });
  return { state: next, roster: roster.map(item => item.id === playerId ? upgraded : item) };
}

export function markFranchiseNotificationsRead(state: FranchiseInteractionState) {
  return { ...state, notifications: state.notifications.map(notification => ({ ...notification, read: true })) };
}
