import { useEffect, useRef, useState } from 'react';
import { loadUserState, saveUserState } from './userStateCloud';
import { fantasyWatchlistStorageKey, normalizeFantasyWatchlist } from './fantasyWatchlist';

/** Mount once per FantasyHub account session. Never adopt another account's
 * unowned legacy cache or write choices through a newly switched session. */
export function useFantasyWatchlist(userId?: string) {
  const storageKey = fantasyWatchlistStorageKey(userId);
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try { return normalizeFantasyWatchlist(JSON.parse(localStorage.getItem(storageKey) || '[]')); }
    catch { return []; }
  });
  const value = useRef(watchlist);
  const ready = useRef(false);
  const cloudReady = useRef(false);
  const edits = useRef(new Map<string, boolean>());
  const writes = useRef(Promise.resolve());

  const store = (next: string[], save = false) => {
    value.current = next;
    setWatchlist(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
    if (save && userId && cloudReady.current) {
      // Preserve tap order even if the first cloud request is slower than the
      // next. The helper rejects a session mismatch before it touches data.
      writes.current = writes.current.then(() => saveUserState('fantasy_watchlist', next, userId))
        .catch(() => console.warn('Fantasy watchlist cloud save unavailable'));
    }
  };

  useEffect(() => {
    let active = true;
    ready.current = false;
    cloudReady.current = false;
    if (!userId) { ready.current = true; return; }
    void loadUserState<unknown>('fantasy_watchlist', userId).then(cloud => {
      if (!active) return;
      let next = Array.isArray(cloud) ? normalizeFantasyWatchlist(cloud) : value.current;
      const edited = edits.current.size > 0;
      for (const [id, wanted] of edits.current) {
        next = wanted ? [...new Set([...next, id])] : next.filter(item => item !== id);
      }
      edits.current.clear();
      ready.current = true;
      cloudReady.current = true;
      store(next, edited);
    }).catch(() => {
      if (!active) return;
      ready.current = true;
      // Keep edits on this account's device. A failed restore must not replace
      // a potentially larger cloud list with an incomplete local snapshot.
      edits.current.clear();
    });
    return () => { active = false; };
  }, [userId]);

  const toggleWatch = (id: string) => {
    const wanted = !value.current.includes(id);
    const next = wanted ? [...value.current, id] : value.current.filter(item => item !== id);
    if (!ready.current) edits.current.set(id, wanted);
    store(next, ready.current);
  };
  return { watchlist, toggleWatch };
}
