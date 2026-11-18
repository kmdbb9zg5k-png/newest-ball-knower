import { practiceAsset, STORE_PRODUCTS } from './storeCatalog';
import { readGameAthlete } from './public/play-moment-3d/game-athlete.js';

export function gameCharacterAppearance(id = readGameAthlete()?.character) {
  const character = id && STORE_PRODUCTS.find(product => product.id === id);
  if (!character || !practiceAsset(character)) return {};
  return {
    practiceCharacterId: character.id,
  };
}
