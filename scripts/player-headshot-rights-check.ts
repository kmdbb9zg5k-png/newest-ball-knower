import fs from 'node:fs';

const portraitHelper = fs.readFileSync('playerPortraits.ts', 'utf8');
const registry = fs.readFileSync('licensedPlayerPortraits.ts', 'utf8');
const credits = fs.readFileSync('public/player-photo-credits.html', 'utf8');
const terms = fs.readFileSync('public/terms.html', 'utf8');

const forbiddenPortraitSources = [
  'ratings-images-prod.pulse.ea.com',
  'madden-nfl-27/portraits',
  'a.espncdn.com/i/teamlogos/nfl',
  'getMadden27RosterEntry',
  "from './madden27CurrentRoster'",
  "from './teamTheme'",
];

for (const source of forbiddenPortraitSources) {
  if (portraitHelper.includes(source)) {
    throw new Error(`Player portrait helper still references forbidden source: ${source}`);
  }
}

if (!portraitHelper.includes('getLicensedPlayerPortrait')) {
  throw new Error('Player portrait helper is not using the licensed portrait registry.');
}
if (!portraitHelper.includes('playerPortraitFallbackUrl')) {
  throw new Error('Player portrait helper must keep the Ball Knower fallback.');
}
if (!registry.includes('commons.wikimedia.org')) {
  throw new Error('Licensed portrait registry has no Wikimedia Commons sources.');
}
if (/ratings-images-prod\.pulse\.ea\.com|espncdn\.com|All Rights Reserved/i.test(registry)) {
  throw new Error('Licensed portrait registry contains an unapproved source marker.');
}

const entries = [...registry.matchAll(/["']?sourceUrl["']?:\s*["']([^"']+)["']/g)].map((match) => match[1]);
const licenses = [...registry.matchAll(/["']?license["']?:\s*["']([^"']+)["']/g)].map((match) => match[1]);
if (!entries.length || entries.length !== licenses.length) {
  throw new Error('Every licensed portrait must have source and license metadata.');
}
if (entries.length < 100) {
  throw new Error(`Fantasy photo coverage regressed below the launch floor: ${entries.length}/100.`);
}

for (const sourceUrl of entries) {
  if (!credits.includes(sourceUrl)) {
    throw new Error(`Missing public photo credit for ${sourceUrl}`);
  }
}
if (!terms.includes('/player-photo-credits.html')) {
  throw new Error('Terms must link to public player photo credits.');
}

for (const fantasySurface of [
  'FantasyHub.tsx',
  'FantasyLeagueEssentials.tsx',
  'FantasyLeaguePostDraft.tsx',
  'LeagueLiveDraftRoom.tsx',
]) {
  const source = fs.readFileSync(fantasySurface, 'utf8');
  if (!source.includes('FantasyPlayerPortrait')) {
    throw new Error(`${fantasySurface} must render the shared licensed Fantasy player portrait.`);
  }
}

for (const fictionalSurface of [
  'FantasyFranchise.tsx',
  'PlayerAgentMode.tsx',
  'SoloMode.tsx',
]) {
  const source = fs.readFileSync(fictionalSurface, 'utf8');
  if (source.includes('FantasyPlayerPortrait') || source.includes('playerPortraitUrl(')) {
    throw new Error(`${fictionalSurface} must remain in the fictional portrait universe.`);
  }
}

console.log(`player-headshot-rights-check: PASS (${entries.length} licensed portraits + Ball Knower fallback)`);
