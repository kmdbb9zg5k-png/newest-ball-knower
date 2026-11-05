import { defaultCareer, type CareerProfile } from './soloSeasonEngine';

/** Device saves may come from older releases or interrupted writes. */
export function normalizeCareerProfile(value: unknown): CareerProfile {
  const profile = defaultCareer();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return profile;
  const saved = value as Record<string, unknown>;
  const counts = ['runs', 'championships', 'playoffWins', 'regularWins', 'regularLosses', 'perfectSeasons'] as const;
  for (const key of counts) {
    const count = saved[key];
    if (typeof count === 'number' && Number.isSafeInteger(count) && count >= 0) profile[key] = count;
  }
  if (typeof saved.bestScore === 'number' && Number.isFinite(saved.bestScore)) profile.bestScore = Math.max(0, Math.min(100, saved.bestScore));
  if (typeof saved.bestRecord === 'string' && /^\d{1,3}-\d{1,3}$/.test(saved.bestRecord)) profile.bestRecord = saved.bestRecord;
  if (Array.isArray(saved.achievements)) profile.achievements = [...new Set(saved.achievements.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))];
  return profile;
}
