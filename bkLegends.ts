import { MINI_TEAMS } from './public/play-moment-3d/mini-teams-data.js';

export const FIRST_CLEAR_COINS = 1000;
const STARTER_MAX_OVERALL = 80;
export const PACK_PRICE = 8 * FIRST_CLEAR_COINS;
export const PREMIUM_PRICE = 6 * FIRST_CLEAR_COINS;
export const CHAPTERS = ['Training Camp', 'Move the Chains', 'Red Zone', 'Lockdown', 'Against the Clock', 'Underdogs', 'The Playoff Run', 'Legacy Game'];
export const POSITIONS = ['LT','LG','C','RG','RT','QB','HB','WR','WR','WR','TE','EDGE','DT','DT','EDGE','LB','LB','LB','CB','S','CB','S','FB','K','P'] as const;
export type Position = typeof POSITIONS[number];
export const PACK_POSITIONS: Position[] = ['QB', 'HB', 'WR', 'TE', 'LT', 'EDGE', 'LB', 'CB', 'S', 'K'];
const starterTeam = MINI_TEAMS.find(team => team.abbr === 'JCY')!;
const teamPlayers = (team: typeof starterTeam) => [...team.lineup, team.fullback, team.kicker, team.punter];
const cards = MINI_TEAMS.flatMap(team => teamPlayers(team).map((player, index) => ({ ...player, position: POSITIONS[index] })));
export const CARD_BY_ID = new Map(cards.map(card => [card.id, card]));
const cardOrder = (a: typeof cards[number], b: typeof cards[number]) => b.overall - a.overall || a.id.localeCompare(b.id);
const starterIds = teamPlayers(starterTeam).map(player => player.id);
type Goal = 'win' | 'pass' | 'rush' | 'shutout';
export type Scenario = {
  id: number; title: string; opponent: string; difficulty: string; goal: Goal; target: number;
  ball: number; clock: number; score: number; awayScore: number; defending: boolean; timeouts: number;
};
const chapterTitles = [
  ['First Snap', 'Find Your Receiver', 'Set the Edge', 'Camp Scrimmage', 'Hit the Hole', 'Quick Reads', 'Keep It Clean', 'Air It Out', 'Stay on Schedule', 'Final Cut'],
  ['First and Ten', 'Through the Gap', 'Move the Sticks', 'The Long Drive', 'Two-Minute Tempo', 'Play Action', 'Keep the Drive Alive', 'Control the Clock', 'Find a Seam', 'Drive of the Day'],
  ['Inside the Twenty', 'Tight Windows', 'Punch It In', 'From the Five', 'Corner Route', 'Heavy Set', 'Short Field', 'No Room to Miss', 'Four Downs', 'Red Zone Final'],
  ['The Goal Line Stand', 'Protect the Lead', 'Close the Door', 'No Easy Yards', 'Defend the House', 'Backs to the Wall', 'Last Line', 'Hold the Edge', 'One More Stop', 'Lockdown Final'],
  ['Clock Starts Now', 'No Timeouts', 'Hurry Up', 'Sideline Drive', 'Forty-Five Seconds', 'Need Six', 'One Timeout', 'Beat the Clock', 'Last Possession', 'Final Seconds'],
  ['Road Underdogs', 'Unfriendly Turf', 'Against the Favorite', 'Keep Believing', 'An Early Hole', 'One Possession', 'Win the Trenches', 'Big Road Test', 'Take the Lead', 'The Upset'],
  ['Wild Card', 'Win or Go Home', 'Road to the Divisional', 'Divisional Round', 'Survive and Advance', 'Road Comeback', 'Conference Semifinal', 'One More Game', 'Conference Final', 'Punch Your Ticket'],
  ['The Final Stretch', 'Title Defense', 'Legends at Home', 'The Last Drive', 'Fourth Quarter', 'The Heavyweights', 'The Big Stage', 'Leave Your Mark', 'Championship Eve', 'The Legacy Game'],
];
// Chapter order sets the CPU tier and how much room the player has to recover.
const chapterDifficulty = [
  { difficulty: 'rookie', deficit: 0, timeouts: 3 },
  { difficulty: 'rookie', deficit: 3, timeouts: 3 },
  { difficulty: 'pro', deficit: 4, timeouts: 2 },
  { difficulty: 'pro', deficit: 0, timeouts: 2 },
  { difficulty: 'pro', deficit: 6, timeouts: 1 },
  { difficulty: 'all-pro', deficit: 7, timeouts: 2 },
  { difficulty: 'all-pro', deficit: 10, timeouts: 1 },
  { difficulty: 'all-pro', deficit: 13, timeouts: 1 },
] as const;

export const CAMPAIGN: Scenario[] = chapterTitles.flatMap((titles, chapter) => titles.map((title, index): Scenario => {
  const final = index === 9;
  const rules = chapterDifficulty[chapter];
  const deficit = rules.deficit + (chapter >= 5 && final ? 1 : 0);
  const defending = chapter === 3 || (chapter === 7 && index === 1);
  const goal = defending ? 'shutout' : final || chapter > 2 ? 'win' : (['win', 'pass', 'rush'] as const)[index % 3];
  const opponent = MINI_TEAMS.filter(team => team.abbr !== 'JCY')[(chapter * 11 + index * 3) % (MINI_TEAMS.length - 1)];
  const ball = chapter === 0 && index === 0 ? 90 : defending ? (index === 0 ? 98 : 62 + index * 3) : chapter === 2 ? (final ? 85 : 81 + index) : chapter === 4 && index === 4 ? 25 : 20 + (index % 5) * 5;
  const clock = chapter === 0 && index === 0 ? 45 : final ? (chapter === 7 ? 300 : 150 + chapter * 12) : defending ? 18 + index * 3 : chapter === 4 ? (index === 4 ? 45 : 42 + index * 4) : chapter >= 5 ? 100 - (chapter - 5) * 10 + index * 3 : 72 + index * 5 + chapter * 3;
  return { id: chapter * 10 + index, title, opponent: opponent.abbr, ball, clock, goal,
    target: goal === 'pass' || goal === 'rush' ? (chapter === 2 ? Math.min(7 + index, 100 - ball) : 12 + chapter * 8 + index * 2) : 0,
    difficulty: rules.difficulty,
    score: defending ? 24 : 21 - deficit,
    awayScore: 21,
    defending, timeouts: chapter === 4 && index === 1 ? 0 : rules.timeouts };
}));

export const TRAINING: Scenario[] = [
  { ...CAMPAIGN[1], id: -1, title: 'Passing Session', target: 20 },
  { ...CAMPAIGN[2], id: -2, title: 'Rushing Session', target: 20 },
  { ...CAMPAIGN[30], id: -3, title: 'Goal Line Practice' },
];

export function goalText(scenario: Scenario) {
  if (scenario.goal === 'shutout') return 'Protect your lead without giving up any points.';
  if (scenario.goal === 'pass' || scenario.goal === 'rush') return `Win with at least ${scenario.target} ${scenario.goal === 'pass' ? 'passing' : 'rushing'} yards.`;
  return 'Finish ahead when the clock runs out.';
}
export function opponentName(scenario: Scenario) {
  return MINI_TEAMS.find(team => team.abbr === scenario.opponent)?.name ?? 'BK Rivals';
}

type OwnedCard = { copies: number; level: number; clears: number; starter?: boolean };
type Pack = { position: Position; premium: boolean; choices?: string[] };
export type LegendsState = {
  version: 1; coins: number; training: number; complete: number;
  owned: Record<string, OwnedCard>; lineup: string[]; chapterClaims: number[];
  starterOpened: boolean; legacyClaimed: boolean; pack?: Pack;
};
export type LegendsResult = { homeScore: number; awayScore: number; passYards: number; rushYards: number; plays: number };
export function isLegendsResult(value: unknown): value is LegendsResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<LegendsResult>;
  return [result.homeScore, result.awayScore, result.passYards, result.rushYards, result.plays].every(Number.isSafeInteger)
    && result.homeScore! >= 0 && result.awayScore! >= 0 && result.plays! >= 0;
}
export const initialLegends = (): LegendsState => ({
  version: 1, coins: 0, training: 0, complete: 0, owned: {}, lineup: [], chapterClaims: [], starterOpened: false, legacyClaimed: false,
});
export function loadLegends(storage: Storage, key: string): LegendsState {
  try {
    const state: LegendsState = JSON.parse(storage.getItem(key) ?? 'null');
    if (state?.version === 1 && Number.isInteger(state.complete) && state.complete >= 0 && state.complete <= CAMPAIGN.length &&
      Number.isSafeInteger(state.coins) && state.coins >= 0 && Number.isSafeInteger(state.training) && state.training >= 0 &&
      state.owned && Array.isArray(state.chapterClaims) && Array.isArray(state.lineup) &&
      (state.starterOpened ? state.lineup.length === POSITIONS.length && state.lineup.every((id, index) => state.owned[id] && CARD_BY_ID.get(id)?.position === POSITIONS[index]) : state.lineup.length === 0)) return state;
  } catch { /* A missing or unreadable save starts a new squad. */ }
  return initialLegends();
}
function addCard(state: LegendsState, id: string, starter = false): LegendsState {
  const owned = state.owned[id] ?? { copies: 0, level: 0, clears: 0 };
  return { ...state, owned: { ...state.owned, [id]: { ...owned, copies: owned.copies + 1, starter } } };
}
export function openStarter(state: LegendsState) {
  if (state.starterOpened) return state;
  return starterIds.reduce((roster, id) => addCard(roster, id, true), { ...state, starterOpened: true, lineup: starterIds });
}
export function equip(state: LegendsState, index: number, id: string) {
  if (!state.owned[id] || !state.lineup[index] || CARD_BY_ID.get(id)?.position !== POSITIONS[index]) return state;
  const lineup = [...state.lineup];
  const currentIndex = lineup.indexOf(id);
  if (currentIndex !== -1) lineup[currentIndex] = lineup[index];
  lineup[index] = id;
  return { ...state, lineup };
}
function baseOverall(state: LegendsState, id: string) {
  const overall = CARD_BY_ID.get(id)?.overall ?? 0;
  return state.owned[id]?.starter ? Math.min(overall, STARTER_MAX_OVERALL) : overall;
}
export function playerOverall(state: LegendsState, id: string) {
  return Math.min(99, baseOverall(state, id) + 4 * (state.owned[id]?.level ?? 0));
}
export function squadOverall(state: LegendsState) {
  return state.lineup.length ? Math.round(state.lineup.reduce((sum, id) => sum + playerOverall(state, id), 0) / state.lineup.length) : 0;
}
export function gameSquad(state: LegendsState) {
  const players = state.lineup.map(id => {
    const card = CARD_BY_ID.get(id)!;
    const boost = playerOverall(state, id) - card.overall;
    const attributes = Object.fromEntries(Object.entries(card.attributes).filter((entry): entry is [string, number] => typeof entry[1] === 'number')
      .map(([key, rating]) => [key, Math.min(97, rating + boost)]));
    return { id: card.id, name: card.name, lastName: card.lastName, number: card.number,
      overall: playerOverall(state, id), attributes, ...('speed' in card && typeof card.speed === 'number' ? { speed: Math.min(97, card.speed + boost) } : {}) };
  });
  const meanOverall = (unit: typeof players) => Math.round(unit.reduce((sum, player) => sum + player.overall, 0) / unit.length);
  return { ...starterTeam, name: 'BK Legends', abbr: 'BKL', primary: '#16171b', secondary: '#dfb746',
    overall: squadOverall(state), offense: meanOverall(players.slice(0, 11)), defense: meanOverall(players.slice(11, 22)),
    lineup: players.slice(0,22), fullback: players[22], kicker: players[23], punter: players[24] };
}
export function cleared(scenario: Scenario, result: LegendsResult) {
  if (!isLegendsResult(result) || result.plays < 1 || result.homeScore <= result.awayScore) return false;
  if (scenario.goal === 'pass') return result.passYards >= scenario.target;
  if (scenario.goal === 'rush') return result.rushYards >= scenario.target;
  if (scenario.goal === 'shutout') return result.awayScore === scenario.awayScore;
  return true;
}
export function recordClear(state: LegendsState, scenario: Scenario, result: LegendsResult, playedLineup: readonly string[]) {
  if (!state.starterOpened || !cleared(scenario, result) || (scenario.id >= 0 && scenario.id !== state.complete)) return state;
  const owned = { ...state.owned };
  for (const id of new Set(playedLineup)) {
    if (owned[id]?.level === 1) owned[id] = { ...owned[id], clears: Math.min(3, owned[id].clears + 1) };
  }
  return scenario.id >= 0
    ? { ...state, complete: state.complete + 1, coins: state.coins + FIRST_CLEAR_COINS, owned }
    : { ...state, training: state.training + 100, owned };
}
export function trainingCost(state: LegendsState, id: string) {
  const owned = state.owned[id];
  if (!owned || playerOverall(state, id) >= 99) return null;
  const ceiling = baseOverall(state, id) >= 90 ? 3 : 2;
  return owned.level < ceiling ? 200 + owned.level * 200 : null;
}
export function trainCard(state: LegendsState, id: string) {
  const cost = trainingCost(state, id), card = state.owned[id];
  if (cost === null || state.training < cost || (card.level >= 1 && card.clears < 3)) return state;
  return { ...state, training: state.training - cost, owned: { ...state.owned, [id]: { ...card, level: card.level + 1 } } };
}
export function packFloor(premium: boolean) { return premium ? 84 : 78; }
function packPool(position: Position, premium: boolean) {
  return cards.filter(card => card.position === position && card.overall >= packFloor(premium)).sort(cardOrder);
}
export function buyPack(state: LegendsState, position: Position) {
  if (!state.starterOpened || state.pack || !PACK_POSITIONS.includes(position) || state.coins < PACK_PRICE) return state;
  return { ...state, coins: state.coins - PACK_PRICE, pack: { position, premium: false } };
}
export function boostPack(state: LegendsState) {
  if (!state.pack || state.pack.choices || state.pack.premium || state.coins < PREMIUM_PRICE) return state;
  return { ...state, coins: state.coins - PREMIUM_PRICE, pack: { ...state.pack, premium: true } };
}
export function revealPack(state: LegendsState, random = Math.random) {
  if (!state.pack || state.pack.choices) return state;
  const pool = packPool(state.pack.position, state.pack.premium), choices: string[] = [];
  for (let i = 0; i < 3 && pool.length; i++) choices.push(pool.splice(Math.floor(random() * pool.length), 1)[0].id);
  return { ...state, pack: { ...state.pack, choices } };
}
export function claimPack(state: LegendsState, id: string) {
  return state.pack?.choices?.includes(id) ? addCard({ ...state, pack: undefined }, id) : state;
}
export function chapterChoices(chapter: number) {
  const positions = ['QB','HB','WR','TE','EDGE','LB','CB','S','K'] as const;
  return Array.from({length: 3}, (_, i) => {
    const pool = cards.filter(card => card.position === positions[(chapter + i * 3) % positions.length] && !starterIds.includes(card.id)).sort(cardOrder);
    const ideal = chapter === CHAPTERS.length ? 92 : 79 + chapter;
    return (pool.find(card => card.overall <= ideal) ?? pool.at(-1)!).id;
  });
}
export function claimChapter(state: LegendsState, chapter: number, id: string) {
  if (chapter < 0 || chapter > CHAPTERS.length || !Number.isInteger(chapter) || !chapterChoices(chapter).includes(id)) return state;
  if (chapter === CHAPTERS.length) return state.complete === CAMPAIGN.length && !state.legacyClaimed ? addCard({ ...state, legacyClaimed: true }, id) : state;
  if (state.complete < (chapter + 1) * 10 || state.chapterClaims.includes(chapter)) return state;
  return addCard({ ...state, chapterClaims: [...state.chapterClaims, chapter] }, id);
}
export function duplicates(state: LegendsState) {
  return Object.values(state.owned).reduce((sum, card) => sum + card.copies - 1, 0);
}
export function exchangeCardId(position: Position) { return packPool(position, true).at(-1)?.id; }
export function exchangeCard(state: LegendsState, position: Position) {
  const id = exchangeCardId(position);
  if (!id || state.owned[id] || duplicates(state) < 3) return state;
  const owned = { ...state.owned };
  let cost = 3;
  for (const [key, card] of Object.entries(owned)) {
    const spent = Math.min(cost, card.copies - 1);
    if (spent > 0) owned[key] = { ...card, copies: card.copies - spent };
    cost -= spent;
    if (!cost) break;
  }
  return addCard({ ...state, owned }, id);
}
