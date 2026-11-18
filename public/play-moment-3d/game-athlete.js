export const GAME_ATHLETE_KEY = 'bk-game-athlete-v1';
export const GAME_ATHLETE_OWNER_KEY = 'bk-game-athlete-owner-v1';
export const ATHLETE_ROSTER_SLOTS = Object.freeze({QB:5,RB:6,WR:7,TE:10,EDGE:11,LB:15,CB:18,S:21});
const size = (value, low, high, fallback) => Number.isFinite(value)
  ? Math.min(high, Math.max(low, Math.round(value))) : fallback;

export function gameAthlete(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    character: typeof value.character === 'string' && /^[a-z0-9-]{1,40}$/.test(value.character) ? value.character : '',
    position: Object.hasOwn(ATHLETE_ROSTER_SLOTS, value.position) ? value.position : 'WR',
    heightInches: size(value.heightInches, 65, 81, 72),
    weightLbs: size(value.weightLbs, 160, 320, 195),
  };
}

export function readGameAthlete(storage) {
  try { return gameAthlete(JSON.parse((storage ?? globalThis.localStorage).getItem(GAME_ATHLETE_KEY))); }
  catch { return null; }
}

// The standalone field also runs directly from public/ for guest practice.
export function hasStoredGameAccount(storage = globalThis.localStorage) {
  try {
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (!/^sb-.+-auth-token$/.test(key)) continue;
      const user = JSON.parse(storage.getItem(key))?.user;
      if (user?.id && !user.is_anonymous) return true;
    }
  } catch {}
  return false;
}

export function readGuestGameAthlete(storage = globalThis.localStorage) {
  try {
    const owner = storage.getItem(GAME_ATHLETE_OWNER_KEY);
    if (owner && owner !== 'guest') return null;
    const saved = readGameAthlete(storage);
    return saved ? { ...saved, character: '' } : null;
  } catch {
    return null;
  }
}

export function gameAthleteScale(profile) {
  return { height: profile.heightInches / 72, width: Math.sqrt(profile.weightLbs / 195) };
}
