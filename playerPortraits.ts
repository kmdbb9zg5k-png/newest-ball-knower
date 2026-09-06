import { Player } from './types';
import {
  getLicensedPlayerPortrait,
  LICENSED_PLAYER_PORTRAITS,
  licensedPlayerPortraitUrl,
} from './licensedPlayerPortraits';

type PortraitPlayer = Pick<Player, 'id' | 'name' | 'position'> &
  Partial<Pick<Player, 'team'>>;

// Compatibility export used by existing UI/tests. Every URL here comes from
// the separately documented, commercially reusable portrait registry.
export const PLAYER_PORTRAITS: Record<string, string> = Object.fromEntries(
  Object.entries(LICENSED_PLAYER_PORTRAITS).map(([name, portrait]) => [
    name,
    licensedPlayerPortraitUrl(portrait),
  ]),
);

export function playerPortraitFallbackUrl(player: PortraitPlayer): string {
  const initials =
    player.position === 'DST' && player.team
      ? player.team.slice(0, 3).toUpperCase()
      : player.name
          .split(/\s+/)
          .filter(Boolean)
          .map((part) => part[0])
          .slice(0, 2)
          .join('')
          .toUpperCase() || player.position.slice(0, 2);
  const safeName = player.name.replace(/[<>&"']/g, '');
  const fontSize = initials.length > 2 ? 27 : 34;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="64" fill="#171b22"/><circle cx="64" cy="64" r="61" fill="none" stroke="#d4af37" stroke-opacity=".35" stroke-width="3"/><text x="64" y="72" text-anchor="middle" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="900" fill="#f4f4f5">${initials}</text><title>${safeName}</title></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function playerPortraitUrl(player: PortraitPlayer): string {
  // Team defenses intentionally use Ball Knower's neutral abbreviation badge
  // until separately licensed team artwork is available.
  if (player.position === 'DST') return playerPortraitFallbackUrl(player);

  const licensed = getLicensedPlayerPortrait(player.name);
  return licensed
    ? licensedPlayerPortraitUrl(licensed)
    : playerPortraitFallbackUrl(player);
}

export function playerPortraitAttribution(player: PortraitPlayer) {
  return getLicensedPlayerPortrait(player.name);
}
