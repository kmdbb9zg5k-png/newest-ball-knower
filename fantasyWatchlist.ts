/** Stored preferences are untrusted: older clients and interrupted restores can
 * leave valid JSON that is not a player-id list. Keep only usable unique IDs. */
export function normalizeFantasyWatchlist(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))];
}

export const fantasyWatchlistStorageKey = (userId?: string) =>
  `bk-fantasy-watchlist-v2:${userId || 'guest'}`;
