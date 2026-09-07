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
  'Patrick Mahomes': {
    fileName: 'Patrick Mahomes TTU.JPG',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Patrick_Mahomes_TTU.JPG',
    creator: 'Christian M. Mericle',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  },
  'Joe Burrow': {
    fileName: 'Joe Burrow Bengals.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Joe_Burrow_Bengals.jpg',
    creator: 'Alexander Jonesi',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
  },
  'Lamar Jackson': {
    fileName: 'Lamar Jackson 2021.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Lamar_Jackson_2021.jpg',
    creator: 'All-Pro Reels',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
  },
  'Saquon Barkley': {
    fileName: 'Saquon Barkley.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Saquon_Barkley.jpg',
    creator: 'Chris Spon / Chris Sponagle',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  'Derrick Henry': {
    fileName: 'Derrick Henry.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Derrick_Henry.jpg',
    creator: 'Tennessee Titans',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  },
  'Christian McCaffrey': {
    fileName: 'Christian McCaffrey.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Christian_McCaffrey.jpg',
    creator: 'All-Pro Reels',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
  },
  'Breece Hall': {
    fileName: 'BreeceHall2019.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:BreeceHall2019.jpg',
    creator: 'Daniel Hartwig',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
  },
  'Jonathan Taylor': {
    fileName: 'Jonathan Taylor.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Jonathan_Taylor.jpg',
    creator: 'Brady Klain',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
  },
  'Jahmyr Gibbs': {
    fileName: 'JahmyrGibbs.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:JahmyrGibbs.jpg',
    creator: 'Ck18102006',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  "Ja'Marr Chase": {
    fileName: "Ja'Marr Chase.jpg",
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Ja%27Marr_Chase.jpg',
    creator: 'Joe Glorioso | All-Pro Reels',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
  },
  'Justin Jefferson': {
    fileName: 'Justin Jefferson Commanders vs Vikings NOV2022.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Justin_Jefferson_Commanders_vs_Vikings_NOV2022.jpg',
    creator: 'All-Pro Reels',
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
  'A.J. Brown': {
    fileName: 'AJ Brown.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:AJ_Brown.jpg',
    creator: 'Tennessee Titans',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  },
  'Amon-Ra St. Brown': {
    fileName: 'Amon-Ra St. Brown.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Amon-Ra_St._Brown.jpg',
    creator: 'Steve Cheng, Bruin Report',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
  },
  'Drake London': {
    fileName: 'Drake London.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Drake_London.jpg',
    creator: 'Atlanta Falcons',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  },
  'Malik Nabers': {
    fileName: 'Malik Nabers Giants week 1 2025.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Malik_Nabers_Giants_week_1_2025.jpg',
    creator: 'All-Pro Reels',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  'Brock Bowers': {
    fileName: 'Brock Bowers.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Brock_Bowers.jpg',
    creator: 'BullDawg2021',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  'Trey McBride': {
    fileName: '2024 FanDuel Interview Trey McBride (cropped).png',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:2024_FanDuel_Interview_Trey_McBride_(cropped).png',
    creator: 'FanDuel',
    license: 'CC BY 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/3.0/',
  },
  'George Kittle': {
    fileName: 'George Kittle (cropped).jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:George_Kittle_(cropped).jpg',
    creator: 'Alexander Jonesi',
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
  const safeWidth = Math.max(64, Math.min(1024, Math.round(Number.isFinite(width) ? width : 512)));
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(portrait.fileName)}?width=${safeWidth}`;
}
