export type FantasyDisplayPreferences = {
  density: 'compact' | 'comfortable';
  showProjections: boolean;
  spoilerFree: boolean;
  leagueOrder: 'recent' | 'alphabetical';
  defaultLeagueId: string;
};

export const FANTASY_DISPLAY_KEY = 'ball-knower:fantasy-display-v1';
export const FANTASY_DISPLAY_EVENT = 'ball-knower:fantasy-display-changed';
export const readFantasyDisplayPreferences = (): FantasyDisplayPreferences => {
  const fallback: FantasyDisplayPreferences = { density: 'compact', showProjections: true, spoilerFree: false, leagueOrder: 'recent', defaultLeagueId: '' };
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(FANTASY_DISPLAY_KEY) || '{}') }; } catch { return fallback; }
};
