import type { Session } from '@supabase/supabase-js';
import { purchasedCharacterIds } from './characterPurchases';
import { gameAthlete, GAME_ATHLETE_KEY, GAME_ATHLETE_OWNER_KEY, readGameAthlete, readGuestGameAthlete } from './public/play-moment-3d/game-athlete.js';
import { practiceAsset, STORE_PRODUCTS } from './storeCatalog';
import { supabase } from './supabase';

export const GAME_ATHLETE_CHANGED = 'bk-game-athlete-changed';
const metadataKey = 'bk_game_athlete';
const characters = STORE_PRODUCTS.filter(practiceAsset);
type Preference = NonNullable<ReturnType<typeof gameAthlete>>;

export function accountGameAthlete(session: Session | null) {
  const user = session?.user;
  const account = user && !user.is_anonymous ? user : null;
  if (!account) return readGuestGameAthlete();
  const remote = gameAthlete(account.user_metadata?.[metadataKey]);
  if (remote) return remote;
  try {
    const owner = localStorage.getItem(GAME_ATHLETE_OWNER_KEY);
    if (owner && owner !== account.id) return null;
    return readGameAthlete();
  } catch {
    return null;
  }
}

export async function currentGameAthlete(session: Session | null) {
  const cached = accountGameAthlete(session);
  if (!supabase || !session?.user || session.user.is_anonymous) return cached;

  try {
    // An existing browser session can retain old user metadata after another
    // device equips a character. Read the account with this session's token.
    const { data, error } = await supabase.auth.getUser(session.access_token);
    if (!error && data.user?.id === session.user.id) {
      return accountGameAthlete({ ...session, user: data.user });
    }
  } catch {
    // A temporary account read failure leaves this session's saved choice usable.
  }
  return cached;
}

export function equippedCharacter(preference: ReturnType<typeof gameAthlete>, owned: ReadonlySet<string>) {
  return preference && owned.has(preference.character)
    ? characters.find(product => product.id === preference.character)
    : undefined;
}

export async function resolveGameAthlete() {
  const session = (await supabase?.auth.getSession())?.data.session ?? null;
  const saved = await currentGameAthlete(session);
  const character = saved?.character ? equippedCharacter(saved, await purchasedCharacterIds()) : undefined;
  if (session) {
    const current = (await supabase?.auth.getSession())?.data.session;
    if (current?.user.id !== session.user.id) throw new Error('Your account changed. Retry to load your character.');
  }
  if (saved?.character && !character) throw new Error('Could not load your equipped character. Retry or check your selection in the Locker.');
  return { saved, character };
}

export async function saveGameAthlete(preference: Preference) {
  const session = (await supabase?.auth.getSession())?.data.session;
  const account = session?.user && !session.user.is_anonymous ? session.user : null;
  if (preference.character && (!account || !(await purchasedCharacterIds()).has(preference.character))) {
    throw new Error('Could not verify this character. Check your connection and try again.');
  }
  if (account && supabase) {
    const current = (await supabase.auth.getSession()).data.session;
    if (current?.user.id !== account.id) throw new Error('The account changed. Reopen the Locker and try again.');
    const { data, error } = await supabase.auth.updateUser({ data: { [metadataKey]: preference } });
    if (error || data.user?.id !== account.id) throw new Error('Could not save to your account. Try again.');
  }
  try {
    localStorage.setItem(GAME_ATHLETE_OWNER_KEY, account?.id ?? 'guest');
    localStorage.setItem(GAME_ATHLETE_KEY, JSON.stringify(preference));
  } catch {
    if (!account) throw new Error('Could not save on this device.');
  }
  window.dispatchEvent(new Event(GAME_ATHLETE_CHANGED));
}
