/**
 * Central Global Season & Roster Configuration
 * Single Source of Truth for Season Year, Dataset, and Validation Standards
 */

export const CURRENT_NFL_SEASON = 2026;
export const CURRENT_ROSTER_DATASET = '2026 Official NFL Season (32 Active Rosters)';
export const LAST_ROSTER_UPDATE = '2026-08-16T08:35:00Z';
export const LAST_ROSTER_UPDATE_FORMATTED = 'August 16, 2026';

export const BALL_KNOWER_SALARY_CAP_MILLIONS = 301.2; // $200M Gameplay Cap
export const BALL_KNOWER_ROSTER_SIZE = 20; // 20 Player Roster with kicker and punter

export const SEASON_CONFIG = {
  season: CURRENT_NFL_SEASON,
  dataset: CURRENT_ROSTER_DATASET,
  lastUpdated: LAST_ROSTER_UPDATE,
  lastUpdatedFormatted: LAST_ROSTER_UPDATE_FORMATTED,
  gameSalaryCap: BALL_KNOWER_SALARY_CAP_MILLIONS,
  rosterLimit: BALL_KNOWER_ROSTER_SIZE,
  leagueName: `Ball Knower ${CURRENT_NFL_SEASON} NFL Championship`,
  brandingCopyright: `© ${CURRENT_NFL_SEASON} BALL KNOWER NFL CAP ENGINE`,
} as const;
