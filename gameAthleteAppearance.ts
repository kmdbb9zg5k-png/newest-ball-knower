import type { StoreProduct } from './storeCatalog';

export function withGameCharacter<T extends { name: string }>(athlete: T, character?: StoreProduct) {
  return character ? { ...athlete, name: character.name, practiceCharacterId: character.id } : athlete;
}
