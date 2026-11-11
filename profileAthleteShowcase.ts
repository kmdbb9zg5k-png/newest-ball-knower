import { sanitizeAthleteAppearance, type AthleteAppearance } from './athleteAppearance';
import { ATHLETE_POSITIONS, sanitizeAthleteBuild, type AthleteBuild } from './athleteBuild';
import { CLOTHING_SLOTS, DEFAULT_OUTFIT, wardrobeCatalog, type Outfit } from './playerWardrobe';

export type ShowcaseFit = AthleteBuild & AthleteAppearance & { number: number; wardrobe: Outfit };

export function sanitizeShowcaseFit(input: unknown): ShowcaseFit | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const value = input as Partial<ShowcaseFit>;
  if (!value.wardrobe || typeof value.wardrobe !== 'object') return null;
  const catalog = wardrobeCatalog();
  const wardrobe = { ...DEFAULT_OUTFIT };
  for (const slot of CLOTHING_SLOTS) {
    const item = catalog.find(item => item.slot === slot && item.id === value.wardrobe?.[slot] && !item.retailPreview);
    if (item && item.id !== 'top-career-jersey') wardrobe[slot] = item.id;
  }
  const position = value.position && ATHLETE_POSITIONS.includes(value.position) ? value.position : 'WR';
  const number = Number.isInteger(value.number) ? Math.max(0, Math.min(99, value.number!)) : 1;
  const { bodyPresetId: _bodyPreset, ...build } = sanitizeAthleteBuild({ ...value, position });
  return { ...build, bodyPresetId: 'custom', ...sanitizeAthleteAppearance(value), number, wardrobe };
}
