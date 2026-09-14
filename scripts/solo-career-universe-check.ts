import {
  activateSoloCareer,
  activeSoloCareer,
  applySoloCareerDecision,
  awardSoloChampionships,
  createSoloUniverseState,
  ensureSoloCareerSave,
  isSoloCareerEventResolved,
  normalizeSoloUniverseState,
  soloCareerEvent,
  syncSoloUniverseFromStorage,
} from '../soloCareerUniverse';

type MemoryStore = Record<string, string>;

function memoryStorage(seed: MemoryStore = {}): Storage {
  const values = new Map(Object.entries(seed));
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key: string) { return values.get(key) ?? null; },
    key(index: number) { return [...values.keys()][index] ?? null; },
    removeItem(key: string) { values.delete(key); },
    setItem(key: string, value: string) { values.set(key, String(value)); },
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const storage = memoryStorage({
  ballknower_solo_franchise_v2: JSON.stringify({
    version: 5,
    teamAbbr: 'PHI',
    roster: [],
  }),
  'ballknower_solo_franchise_v2:season': JSON.stringify({
    version: 2,
    year: 2028,
    stage: 'regular',
    weeks: [
      { won: true, game: {}, playerLines: [] },
      { won: false, game: {}, playerLines: [] },
      { won: true, game: {}, playerLines: [] },
    ],
    playoffs: [],
  }),
  ballknower_owner_career_v3: JSON.stringify({
    ownerName: 'Jordan Knox',
    season: 2027,
    week: 9,
    stage: 'regular',
    wins: 6,
    losses: 2,
    championships: 1,
    approval: 70,
    staffMorale: 82,
  }),
});

let state = createSoloUniverseState();
state = syncSoloUniverseFromStorage(state, storage, 1000);
assert(state.saves.length === 2, 'Native Solo saves should be discovered without creating duplicates.');

const franchise = state.saves.find(save => save.mode === 'real');
assert(franchise, 'Franchise Command save should be discovered.');
assert(franchise.season === 2028, 'Franchise year should come from the real season save.');
assert(franchise.week === 4, 'Franchise week should follow completed weeks.');
assert(franchise.wins === 2 && franchise.losses === 1, 'Franchise record should come from actual weekly results.');

const owner = state.saves.find(save => save.mode === 'owner');
assert(owner, 'Owner career should be discovered.');
assert(owner.subtitle === 'Jordan Knox', 'Owner name should label the persistent career.');
assert(owner.wins === 6 && owner.losses === 2, 'Owner record should remain authoritative.');

state = ensureSoloCareerSave(state, 'agent', 2000, storage);
assert(state.saves.some(save => save.mode === 'agent'), 'Opening an untouched mode should create its career slot.');
assert(activeSoloCareer(state)?.mode === 'agent', 'Opening a mode should make it the active career.');

state = activateSoloCareer(state, franchise.id, 3000);
const active = activeSoloCareer(state);
assert(active?.id === franchise.id, 'Career saves must be individually resumable.');

const event = soloCareerEvent(active!);
const firstChoice = event.choices[0];
const beforeXp = state.profile.xp;
const beforeDecisions = state.profile.decisions;
state = applySoloCareerDecision(state, active!.id, event, firstChoice.id, 4000);
const resolved = state.saves.find(save => save.id === active!.id)!;
assert(state.profile.xp > beforeXp, 'Meaningful weekly decisions should award progression XP.');
assert(state.profile.decisions === beforeDecisions + 1, 'Weekly decisions should count toward career history.');
assert(isSoloCareerEventResolved(resolved, event), 'The same weekly event must be locked after a choice.');
assert(state.history[0]?.detail.includes(firstChoice.label), 'Decision consequences should be recorded in career history.');

const afterFirstDecision = JSON.stringify(state);
state = applySoloCareerDecision(state, active!.id, event, firstChoice.id, 5000);
assert(JSON.stringify(state) === afterFirstDecision, 'A resolved weekly event must not be farmable for XP.');

state = awardSoloChampionships(state);
assert(state.profile.championships === 1, 'Championships from native careers should feed the universal profile.');
assert(state.profile.achievements.includes('Champion'), 'Winning a title should unlock a universal achievement.');

const repaired = normalizeSoloUniverseState({
  version: 1,
  profile: { level: -4, xp: -20, reputation: 1000 },
  saves: [{ ...franchise, pressure: 999, morale: -5, resolvedEvents: ['one'] }],
  activeSaveId: franchise.id,
  history: [],
});
assert(repaired.profile.level === 1 && repaired.profile.xp === 0, 'Corrupt progression should normalize safely.');
assert(repaired.profile.reputation === 100, 'Reputation should remain bounded.');
assert(repaired.saves[0].pressure === 100 && repaired.saves[0].morale === 0, 'Career pressure and morale should remain bounded.');

console.log('Solo career universe check passed.');
