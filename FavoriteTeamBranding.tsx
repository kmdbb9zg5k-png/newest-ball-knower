import React, { useState } from 'react';
import { TEAM_THEMES, teamLogoUrl, type TeamTheme } from './teamTheme';

// Preference-screen only: do not replace the shared original badges or solo identities.
// Restore the previous image source; its availability is not evidence of licensing.
export function favoriteTeamLogoUrl(abbr: string): string {
  const raw = String(abbr || '').trim().toUpperCase();
  const aliases: Record<string, string> = { WSH: 'WAS', JAC: 'JAX', LA: 'LAR' };
  const normalized = aliases[raw] || raw;
  const team = TEAM_THEMES.find(item => item.abbr === normalized);
  if (!team) return teamLogoUrl(normalized);
  const code = team.abbr === 'WAS' ? 'wsh' : team.abbr.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${code}.png`;
}

export function FavoriteTeamLogo({ team, className, decorative = false }: {
  team: Pick<TeamTheme, 'abbr' | 'name'>;
  className?: string;
  decorative?: boolean;
}) {
  const source = favoriteTeamLogoUrl(team.abbr);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const useFallback = failedSource === source;

  return <img
    src={useFallback ? teamLogoUrl(team.abbr) : source}
    alt={decorative ? '' : `${team.name} logo`}
    aria-hidden={decorative ? true : undefined}
    className={className}
    data-favorite-team-logo={team.abbr}
    referrerPolicy="no-referrer"
    onError={() => { if (!useFallback) setFailedSource(source); }}
  />;
}

export function FavoriteTeamDisclaimer() {
  return <footer
    aria-label="Favorite team notice"
    data-testid="favorite-team-notice"
    className="mt-5 rounded-2xl border border-white/10 bg-black/70 px-4 py-4 text-center text-xs leading-relaxed text-zinc-300"
  >
    <p>We’d like to know your favorite team to personalize your Ball Knower experience.</p>
    <p className="mt-2">Ball Knower is an independent app and is not affiliated with, endorsed by, or sponsored by the NFL or any NFL team. All team names and trademarks belong to their respective owners.</p>
  </footer>;
}
