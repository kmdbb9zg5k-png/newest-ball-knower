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
  {name:'Jacksonville Jaguars',abbr:'JAX',primary:'#101820',secondary:'#D7A22A'},
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

export const teamLogoUrl = (abbr: string) =>
  `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr.toLowerCase()}.png`;

export function getTeamTheme(name?: string | null): TeamTheme {
  return TEAM_THEMES.find(team => team.name === name) ?? TEAM_THEMES[25];
}

export function getSavedTeamTheme(): TeamTheme {
  try {
    return getTeamTheme(localStorage.getItem('ball-knower-favorite-team'));
  } catch {
    return TEAM_THEMES[25];
  }
}

export function applyTeamCssVariables(team: TeamTheme) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--bk-team-primary', team.primary);
  document.documentElement.style.setProperty('--bk-team-secondary', team.secondary);
}
