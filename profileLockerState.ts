// Display-only helpers. Awards, ratings, achievements and levels remain server owned.
// Verified against ball_knower_private.apply_progress_event on 2026-09-08:
// level = greatest(1, 1 + floor((xp + awarded_xp) / 1000.0)).
export const PROFILE_XP_PER_LEVEL = 1000;

export function profileXpProgress(xp: number, level: number) {
  if (!Number.isFinite(xp) || !Number.isInteger(level) || level < 1 || xp < 0) return null;
  const start = (level - 1) * PROFILE_XP_PER_LEVEL;
  const earned = xp - start;
  // Do not invent a percentage if the returned level and XP disagree.
  if (earned < 0 || earned >= PROFILE_XP_PER_LEVEL) return null;
  return { earned, required: PROFILE_XP_PER_LEVEL, nextLevel: level + 1, nextTotal: start + PROFILE_XP_PER_LEVEL, percent: earned / PROFILE_XP_PER_LEVEL * 100 };
}

export const profileNumber = (value: number | undefined) => Number.isFinite(value) ? Number(value).toLocaleString('en-US') : '—';
export const signedProfileDelta = (value: number) => `${value > 0 ? '+' : ''}${profileNumber(value)}`;
export function profileDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
