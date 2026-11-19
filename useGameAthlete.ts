import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { currentGameAthlete, equippedCharacter, GAME_ATHLETE_CHANGED } from './gameAthletePreference';
import { GAME_ATHLETE_KEY } from './public/play-moment-3d/game-athlete.js';
import { supabase } from './supabase';
import { usePurchasedCharacters } from './usePurchasedCharacters';

export function useGameAthlete(enabled: boolean) {
  const [profile, setProfile] = useState<{ saved: Awaited<ReturnType<typeof currentGameAthlete>>; loading: boolean }>({ saved: null, loading: true });
  const { owned, loading } = usePurchasedCharacters(enabled);
  useEffect(() => {
    if (!enabled) return;
    let request = 0;
    let active = true;
    const refresh = async (session?: Session | null) => {
      const latest = ++request;
      const current = session === undefined ? (await supabase?.auth.getSession())?.data.session ?? null : session;
      const saved = await currentGameAthlete(current);
      if (active && latest === request) setProfile({ saved, loading: false });
    };
    const update = () => { void refresh(); };
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      void refresh(session);
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
