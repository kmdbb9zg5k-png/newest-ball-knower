import { useEffect, useState } from 'react';
import { accountGameAthlete, equippedCharacter, GAME_ATHLETE_CHANGED } from './gameAthletePreference';
import { GAME_ATHLETE_KEY } from './public/play-moment-3d/game-athlete.js';
import { supabase } from './supabase';
import { usePurchasedCharacters } from './usePurchasedCharacters';

export function useGameAthlete(enabled: boolean) {
  const [profile, setProfile] = useState<{ saved: ReturnType<typeof accountGameAthlete>; loading: boolean }>({ saved: null, loading: true });
  const { owned, loading } = usePurchasedCharacters(enabled);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const update = () => {
      void Promise.resolve(supabase?.auth.getSession()).then(result => {
        if (active) setProfile({ saved: accountGameAthlete(result?.data.session ?? null), loading: false });
      });
    };
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      if (active) setProfile({ saved: accountGameAthlete(session), loading: false });
    }).data.subscription;
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === GAME_ATHLETE_KEY) update();
    };
    update();
    window.addEventListener(GAME_ATHLETE_CHANGED, update);
    window.addEventListener('storage', onStorage);
    return () => {
      active = false;
      subscription?.unsubscribe();
      window.removeEventListener(GAME_ATHLETE_CHANGED, update);
      window.removeEventListener('storage', onStorage);
    };
  }, [enabled]);
  return { saved: profile.saved, owned, loading: profile.loading || loading,
    character: equippedCharacter(profile.saved, owned) };
}
