import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TEAM_THEMES, teamLogoUrl } from '../teamTheme';
import { FavoriteTeamDisclaimer, FavoriteTeamLogo, favoriteTeamLogoUrl } from '../FavoriteTeamBranding';

assert.equal(TEAM_THEMES.length, 32);
assert.equal(new Set(TEAM_THEMES.map(team => favoriteTeamLogoUrl(team.abbr))).size, 32);
for (const team of TEAM_THEMES) {
  const expectedCode = team.abbr === 'WAS' ? 'wsh' : team.abbr.toLowerCase();
  assert.equal(favoriteTeamLogoUrl(team.abbr), `https://a.espncdn.com/i/teamlogos/nfl/500/${expectedCode}.png`);
  assert.ok(teamLogoUrl(team.abbr).startsWith('data:image/svg+xml,'), 'Shared badges must remain original');
  const image = renderToStaticMarkup(React.createElement(FavoriteTeamLogo, { team }));
  assert.ok(image.includes(`src="${favoriteTeamLogoUrl(team.abbr)}"`));
  assert.ok(image.includes(`alt="${team.name} logo"`));
  assert.match(image, /referrerPolicy="no-referrer"/i);
}
assert.equal(favoriteTeamLogoUrl(' wsh '), favoriteTeamLogoUrl('WAS'));
assert.equal(favoriteTeamLogoUrl('jac'), favoriteTeamLogoUrl('JAX'));
assert.equal(favoriteTeamLogoUrl('LA'), favoriteTeamLogoUrl('LAR'));
for (const unknown of ['', 'BK', 'UNKNOWN', '../../evil', '<script>']) {
  assert.equal(favoriteTeamLogoUrl(unknown), teamLogoUrl('BK'));
}
const decorative = renderToStaticMarkup(React.createElement(FavoriteTeamLogo, { team: TEAM_THEMES[25], decorative: true }));
assert.match(decorative, /alt=""/);
assert.match(decorative, /aria-hidden="true"/);

const notice = renderToStaticMarkup(React.createElement(FavoriteTeamDisclaimer));
assert.match(notice, /<footer/);
assert.match(notice, /We’d like to know your favorite team to personalize your Ball Knower experience\./);
assert.match(notice, /not affiliated with, endorsed by, or sponsored by the NFL or any NFL team/);
assert.match(notice, /All team names and trademarks belong to their respective owners\./);
assert.match(notice, /text-xs/);
assert.match(notice, /text-zinc-300/);

const source = readFileSync(new URL('../FavoriteTeamExperience.tsx', import.meta.url), 'utf8');
assert.equal((source.match(/<FavoriteTeamLogo\b/g) || []).length, 2, 'Cards and background both use scoped logos');
assert.ok(source.indexOf('<FavoriteTeamDisclaimer') > source.indexOf('SKIP FOR NOW'), 'Notice must follow all selection controls');
assert.match(source, /overflow-x-hidden overflow-y-auto/);
assert.match(source, /safe-area-inset-bottom/);
assert.match(source, /\[-2, -1, 0, 1, 2\]/, 'Preserve the five-card cinematic selector');
assert.match(source, /ball-knower-favorite-team/);
assert.match(source, /ball-knower-team-setup-v2/);
console.log('Favorite-team branding checks passed: 32 scoped logos, aliases, safe unknown fallback, readable footer and unchanged shared badges. No license certification.');
