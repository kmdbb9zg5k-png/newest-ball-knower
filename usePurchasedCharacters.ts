import { useEffect, useState } from 'react';
import { purchasedCharacterIds } from './characterPurchases';
import { supabase } from './supabase';

const pending = { owned: new Set<string>() as ReadonlySet<string>, loading: true };

export function usePurchasedCharacters(enabled = true) {
  const [access, setAccess] = useState(pending);
  useEffect(() => {
    if (!enabled) return;
    let refreshVersion = 0;
    let timer: ReturnType<typeof setTimeout>;
    let userId: string | undefined;
    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      if (event !== 'INITIAL_SESSION' && (session?.user.id === userId && event !== 'USER_UPDATED')) return;
      userId = session?.user.id;
      refresh();
    }).data.subscription;
    function refresh() {
      const version = ++refreshVersion;
      setAccess(pending);
      clearTimeout(timer);
      // Run the read outside the Supabase auth callback.
      timer = setTimeout(() => {
        void purchasedCharacterIds().then(owned => {
          if (version === refreshVersion) setAccess({ owned, loading: false });
        });
      }, 0);
    }
    refresh();
    return () => {
      refreshVersion++;
      clearTimeout(timer);
      subscription?.unsubscribe();
      setAccess(pending);
    };
  }, [enabled]);
  return access;
}
