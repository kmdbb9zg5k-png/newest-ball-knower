export type TeamTheme = {
  name: string;
  abbr: string;
  primary: string;
  secondary: string;
};

export const TEAM_THEMES: TeamTheme[] = [
  {name:'Arizona Cardinals',abbr:'ARI',primary:'#97233F',secondary:'#FFB612'},
  {name:'Atlanta Falcons',abbr:'ATL',primary:'#A71930',secondary:'#A5ACAF'},
  {name:'Baltimore Ravens',abbr:'BAL',primary:'#241773',secondary:'#9E7C0C'},
  {name:'Buffalo Bills',abbr:'BUF',primary:'#00338D',secondary:'#C60C30'},
  {name:'Carolina Panthers',abbr:'CAR',primary:'#0085CA',secondary:'#101820'},
  {name:'Chicago Bears',abbr:'CHI',primary:'#0B162A',secondary:'#C83803'},
  {name:'Cincinnati Bengals',abbr:'CIN',primary:'#FB4F14',secondary:'#000000'},
  {name:'Cleveland Browns',abbr:'CLE',primary:'#311D00',secondary:'#FF3C00'},
  {name:'Dallas Cowboys',abbr:'DAL',primary:'#003594',secondary:'#869397'},
  {name:'Denver Broncos',abbr:'DEN',primary:'#FB4F14',secondary:'#002244'},
  {name:'Detroit Lions',abbr:'DET',primary:'#0076B6',secondary:'#B0B7BC'},
  {name:'Green Bay Packers',abbr:'GB',primary:'#203731',secondary:'#FFB612'},
  {name:'Houston Texans',abbr:'HOU',primary:'#03202F',secondary:'#A71930'},
  {name:'Indianapolis Colts',abbr:'IND',primary:'#002C5F',secondary:'#A2AAAD'},
  {name:'Jacksonville Jaguars',abbr:'JAX',primary:'#006778',secondary:'#D7A22A'},
  {name:'Kansas City Chiefs',abbr:'KC',primary:'#E31837',secondary:'#FFB81C'},
  {name:'Las Vegas Raiders',abbr:'LV',primary:'#000000',secondary:'#A5ACAF'},
  {name:'Los Angeles Chargers',abbr:'LAC',primary:'#0080C6',secondary:'#FFC20E'},
  {name:'Los Angeles Rams',abbr:'LAR',primary:'#003594',secondary:'#FFA300'},
  {name:'Miami Dolphins',abbr:'MIA',primary:'#008E97',secondary:'#FC4C02'},
  {name:'Minnesota Vikings',abbr:'MIN',primary:'#4F2683',secondary:'#FFC62F'},
  {name:'New England Patriots',abbr:'NE',primary:'#002244',secondary:'#C60C30'},
  {name:'New Orleans Saints',abbr:'NO',primary:'#D3BC8D',secondary:'#101820'},
  {name:'New York Giants',abbr:'NYG',primary:'#0B2265',secondary:'#A71930'},
  {name:'New York Jets',abbr:'NYJ',primary:'#125740',secondary:'#000000'},
  {name:'Philadelphia Eagles',abbr:'PHI',primary:'#004C54',secondary:'#A5ACAF'},
  {name:'Pittsburgh Steelers',abbr:'PIT',primary:'#FFB612',secondary:'#101820'},
  {name:'San Francisco 49ers',abbr:'SF',primary:'#AA0000',secondary:'#B3995D'},
  {name:'Seattle Seahawks',abbr:'SEA',primary:'#002244',secondary:'#69BE28'},
  {name:'Tampa Bay Buccaneers',abbr:'TB',primary:'#D50A0A',secondary:'#34302B'},
  {name:'Tennessee Titans',abbr:'TEN',primary:'#0C2340',secondary:'#4B92DB'},
  {name:'Washington Commanders',abbr:'WAS',primary:'#5A1414',secondary:'#FFB81C'},
];

export const BALL_KNOWER_THEME: TeamTheme = {
  name: 'Ball Knower',
  abbr: 'BK',
  primary: '#D8A93A',
  secondary: '#D9D9D9',
};

const ESPN_TEAM_LOGO_CODES: Record<string, string> = {
  WAS: 'wsh',
};

export const teamLogoUrl = (abbr: string) => {
  const normalized = String(abbr || '').toUpperCase();
  const espnCode = ESPN_TEAM_LOGO_CODES[normalized] ?? normalized.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${espnCode}.png`;
};

export function getTeamTheme(name?: string | null): TeamTheme {
  return TEAM_THEMES.find(team => team.name === name) ?? BALL_KNOWER_THEME;
}

export function getSavedTeamTheme(): TeamTheme {
  try {
    return getTeamTheme(localStorage.getItem('ball-knower-favorite-team'));
  } catch {
    return BALL_KNOWER_THEME;
  }
}

function hexToRgb(hex: string) {
  const value = hex.replace('#', '');
  const normalized = value.length === 3 ? value.split('').map(char => char + char).join('') : value;
  const number = Number.parseInt(normalized, 16);
  return `${(number >> 16) & 255} ${(number >> 8) & 255} ${number & 255}`;
}

function relativeLuminance(hex: string) {
  const channels = hexToRgb(hex).split(' ').map(Number).map(value => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first: string, second: string) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function blendTowardWhite(hex: string, amount: number) {
  const [red, green, blue] = hexToRgb(hex).split(' ').map(Number);
  const blend = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `#${[blend(red), blend(green), blend(blue)]
    .map(channel => channel.toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

function ensureSurfaceContrast(color: string, surface = '#0A0A0A', minimumRatio = 4.5) {
  if (contrastRatio(color, surface) >= minimumRatio) return color;

  for (let step = 1; step <= 20; step += 1) {
    const candidate = blendTowardWhite(color, step / 20);
    if (contrastRatio(candidate, surface) >= minimumRatio) return candidate;
  }

  return '#FFFFFF';
}

function ensureAtmosphereVisibility(color: string, minimumLuminance = 0.05) {
  if (relativeLuminance(color) >= minimumLuminance) return color;

  // Some authentic NFL colors are almost black. Keep the solid brand token exact,
  // but lift translucent lighting just enough to stay visible against the dark stadium.
  for (let step = 1; step <= 10; step += 1) {
    const candidate = blendTowardWhite(color, step * 0.05);
    if (relativeLuminance(candidate) >= minimumLuminance) return candidate;
  }

  return blendTowardWhite(color, 0.5);
}

function deriveOnAccent(accent: string) {
  const darkForeground = '#07090D';
  const lightForeground = '#FFFFFF';
  return contrastRatio(accent, darkForeground) >= contrastRatio(accent, lightForeground)
    ? darkForeground
    : lightForeground;
}

/** Returns the complete theme variable map so team-driven surfaces can scope the selected club locally. */
export function getTeamCssVariables(team: TeamTheme): Record<string, string> {
  const rawAccent = team.primary;
  const readableAccent = ensureSurfaceContrast(rawAccent);
  const atmospherePrimary = ensureAtmosphereVisibility(team.primary);
  const atmosphereSecondary = ensureAtmosphereVisibility(team.secondary);
  const onAccent = deriveOnAccent(readableAccent);
  return {
    '--bk-team-primary': team.primary,
    '--bk-team-secondary': team.secondary,
    '--bk-team-primary-rgb': hexToRgb(atmospherePrimary),
    '--bk-team-secondary-rgb': hexToRgb(atmosphereSecondary),
    '--bk-team-accent-raw': rawAccent,
    '--bk-team-accent': readableAccent,
    '--bk-team-accent-rgb': hexToRgb(readableAccent),
    '--bk-team-accent-text': readableAccent,
    '--bk-on-accent': onAccent,
  };
}

/** Applies real team atmosphere colors plus a contrast-safe UI accent for dark surfaces. */
export function applyTeamCssVariables(team: TeamTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.team = team.abbr;
  for (const [name, value] of Object.entries(getTeamCssVariables(team))) {
    root.style.setProperty(name, value);
  }
}