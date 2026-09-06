export type LicensedPlayerPortrait = {
  fileName: string;
  sourceUrl: string;
  creator: string;
  license: string;
  licenseUrl: string;
};

const normalizePlayerName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '');

export const LICENSED_PLAYER_PORTRAITS: Record<string, LicensedPlayerPortrait> = {
  'Jalen Hurts': {
    fileName: 'Jalen Hurts.png',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Jalen_Hurts.png',
    creator: "Don't Tell",
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  },
  'Josh Allen': {
    fileName: 'Josh Allen.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Josh_Allen.jpg',
    creator: 'Erik Drost',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
  },
  'Saquon Barkley': {
    fileName: 'Saquon Barkley.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Saquon_Barkley.jpg',
    creator: 'Chris Spon / Chris Sponagle',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  "Ja'Marr Chase": {
    fileName: "Ja'Marr Chase.jpg",
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ja%27Marr_Chase.jpg',
    creator: 'Joe Glorioso | All-Pro Reels',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
  },
  'CeeDee Lamb': {
    fileName: 'Ceedee.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ceedee.jpg',
    creator: 'Addadadsadsaf123',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  'Jahmyr Gibbs': {
    fileName: 'JahmyrGibbs.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:JahmyrGibbs.jpg',
    creator: 'Ck18102006',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  'Christian McCaffrey': {
    fileName: 'Christian McCaffrey.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Christian_McCaffrey.jpg',
    creator: 'All-Pro Reels',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
  },
  'Amon-Ra St. Brown': {
    fileName: 'Amon-Ra St. Brown.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Amon-Ra_St._Brown.jpg',
    creator: 'Steve Cheng, Bruin Report',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
  },
};

const LICENSED_BY_NORMALIZED_NAME = new Map(
  Object.entries(LICENSED_PLAYER_PORTRAITS).map(([name, portrait]) => [
    normalizePlayerName(name),
    portrait,
  ]),
);

export function getLicensedPlayerPortrait(
  playerName: string,
): LicensedPlayerPortrait | undefined {
  return LICENSED_BY_NORMALIZED_NAME.get(normalizePlayerName(playerName));
}

export function licensedPlayerPortraitUrl(
  portrait: LicensedPlayerPortrait,
  width = 512,
): string {
  const safeWidth = Math.max(64, Math.min(1024, Math.round(width)));
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(portrait.fileName)}?width=${safeWidth}`;
}
