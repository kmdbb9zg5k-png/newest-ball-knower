import type { AppTab } from './App';

export const PRIMARY_DESTINATIONS = [
  { tab: 'home', label: 'Home' },
  { tab: 'play', label: 'Play' },
  { tab: 'fantasy', label: 'Fantasy' },
  { tab: 'community', label: 'Community' },
  { tab: 'locker', label: 'Profile' },
] as const satisfies readonly { tab: AppTab; label: string }[];

export type PrimaryDestination = typeof PRIMARY_DESTINATIONS[number]['tab'];

/** Every secondary screen remains reachable without opening an account menu. */
export const SECONDARY_DESTINATIONS = [
  { tab: 'solo', label: 'Solo careers', detail: 'Build a franchise, agency or player career', group: 'Play' },
  { tab: 'football', label: 'Online football', detail: 'Challenge a friend or find an opponent', group: 'Play' },
  { tab: 'challenges', label: 'Trivia', detail: 'Test your football knowledge', group: 'Play' },
  { tab: 'sportsbook', label: 'NFL picks', detail: 'Make predictions and track your record', group: 'Play' },
  { tab: 'news', label: 'NFL news', detail: 'Read the latest league headlines', group: 'Explore' },
  { tab: 'ask', label: 'Ask BK', detail: 'Talk football and get lineup help', group: 'Explore' },
  { tab: 'legacy', label: 'Hall of Fame', detail: 'See records and earned achievements', group: 'Explore' },
  { tab: 'partners', label: 'Partners', detail: 'Discover the Ball Knower community', group: 'Explore' },
  { tab: 'wardrobe', label: 'Player locker', detail: 'Customize your My Player appearance', group: 'Your game' },
] as const satisfies readonly { tab: AppTab; label: string; detail: string; group: string }[];

export function primaryDestinationForTab(tab: AppTab): PrimaryDestination {
  if (['lobby', 'draft', 'simulation', 'fantasy'].includes(tab)) return 'fantasy';
  if (['play', 'solo', 'football', 'challenges', 'sportsbook'].includes(tab)) return 'play';
  if (['locker', 'wardrobe'].includes(tab)) return 'locker';
  if (tab === 'community') return 'community';
  return 'home';
}
