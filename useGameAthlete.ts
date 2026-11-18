import { useEffect, useState } from 'react';
import { GAME_ATHLETE_KEY, readGameAthlete } from './public/play-moment-3d/game-athlete.js';
import { practiceAsset, STORE_PRODUCTS } from './storeCatalog';
import { usePurchasedCharacters } from './usePurchasedCharacters';

const gameAthleteChanged = 'bk-game-athlete-changed';

export function saveGameAthlete(athlete: ReturnType<typeof readGameAthlete>) {
  localStorage.setItem(GAME_ATHLETE_KEY, JSON.stringify(athlete));
  window.dispatchEvent(new Event(gameAthleteChanged));
}

export function useGameAthlete(enabled: boolean) {
  const [saved, setSaved] = useState(readGameAthlete);
  const { owned, loading } = usePurchasedCharacters(enabled);
  useEffect(() => {
    const update = () => setSaved(readGameAthlete());
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key === GAME_ATHLETE_KEY) update();
    };
    window.addEventListener(gameAthleteChanged, update);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(gameAthleteChanged, update);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  const character = enabled && saved && owned.has(saved.character)
    ? STORE_PRODUCTS.find(product => product.id === saved.character && practiceAsset(product))
    : undefined;
  return { saved, owned, loading, character };
}
