export type TeamTheme = {
  name: string;
  abbr: string;
  primary: string;
  secondary: string;
};

export const NEUTRAL_THEME: TeamTheme = {
  name: 'Ball Knower',
  abbr: 'BK',
  primary: '#D4A72C',
  secondary: '#E5E7EB',
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

const ESPN_TEAM_LOGO_CODES: Record<string, string> = {
  WAS: 'wsh',
};

const TRANSPARENT_LOGO = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/%3E';

export const teamLogoUrl = (abbr: string) => {
  const normalized = String(abbr || '').toUpperCase();
  if (!normalized || normalized === NEUTRAL_THEME.abbr) return TRANSPARENT_LOGO;
  const espnCode = ESPN_TEAM_LOGO_CODES[normalized] ?? normalized.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${espnCode}.png`;
};

export function getTeamTheme(name?: string | null): TeamTheme {
  return TEAM_THEMES.find(team => team.name === name) ?? NEUTRAL_THEME;
}

export function getSavedTeamTheme(): TeamTheme {
  try {
    return getTeamTheme(localStorage.getItem('ball-knower-favorite-team'));
  } catch {
    return NEUTRAL_THEME;
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

function deriveOnAccent(accent: string) {
  const darkForeground = '#07090D';
  const lightForeground = '#FFFFFF';
  return contrastRatio(accent, darkForeground) >= contrastRatio(accent, lightForeground)
    ? darkForeground
    : lightForeground;
}

/** Applies real team atmosphere colors plus a contrast-safe UI accent for dark surfaces. */
export function applyTeamCssVariables(team: TeamTheme) {
  if (typeof document === 'undefined') return;
  const rawAccent = team.primary;
  const readableAccent = ensureSurfaceContrast(rawAccent);
  const onAccent = deriveOnAccent(readableAccent);
  const root = document.documentElement;
  root.dataset.team = team.abbr;
  root.style.setProperty('--bk-team-primary', team.primary);
  root.style.setProperty('--bk-team-secondary', team.secondary);
  root.style.setProperty('--bk-team-primary-rgb', hexToRgb(team.primary));
  root.style.setProperty('--bk-team-secondary-rgb', hexToRgb(team.secondary));
  root.style.setProperty('--bk-team-accent-raw', rawAccent);
  root.style.setProperty('--bk-team-accent', readableAccent);
  root.style.setProperty('--bk-team-accent-rgb', hexToRgb(readableAccent));
  root.style.setProperty('--bk-team-accent-text', readableAccent);
  root.style.setProperty('--bk-on-accent', onAccent);
}
