import type { Player, Position, PositionGroup } from './types';
import type { TeamTheme } from './teamTheme';

/**
 * The Ball Knower League is the self-contained fictional universe used by
 * every Solo career mode. Keep this module independent from players.ts and
 * TEAM_THEMES so real NFL identities cannot leak into simulated stories.
 */
export const SOLO_UNIVERSE_VERSION = 1;
export const SOLO_TEAM_STORAGE_KEY = 'ball-knower-solo-team-v1';

export const SOLO_TEAM_THEMES: TeamTheme[] = [
  { name: 'Albuquerque Scorpions', abbr: 'ABQ', primary: '#8B2F3C', secondary: '#E4B363' },
  { name: 'Anchorage Aurora', abbr: 'ANC', primary: '#185C66', secondary: '#8DE1D2' },
  { name: 'Austin Outlaws', abbr: 'AUS', primary: '#7A2E18', secondary: '#E6A15A' },
  { name: 'Birmingham Forge', abbr: 'BIR', primary: '#5B1F2A', secondary: '#C9A55C' },
  { name: 'Boise Mountaineers', abbr: 'BOI', primary: '#16425B', secondary: '#A3C4BC' },
  { name: 'Brooklyn Guardians', abbr: 'BRK', primary: '#252A5A', secondary: '#D0B66A' },
  { name: 'Charleston Corsairs', abbr: 'CHS', primary: '#123B3A', secondary: '#D09B52' },
  { name: 'Columbus Aviators', abbr: 'CLB', primary: '#263C6A', secondary: '#C6D4E1' },
  { name: 'Des Moines Harvesters', abbr: 'DSM', primary: '#5A421B', secondary: '#E2C46D' },
  { name: 'Hartford Foundry', abbr: 'HFD', primary: '#30343B', secondary: '#D06B3C' },
  { name: 'Honolulu Tides', abbr: 'HNL', primary: '#006D77', secondary: '#F2CC8F' },
  { name: 'Jersey City Knights', abbr: 'JCY', primary: '#172554', secondary: '#D4AF37' },
  { name: 'Louisville Stallions', abbr: 'LOU', primary: '#4A1942', secondary: '#E2B96F' },
  { name: 'Memphis Pharaohs', abbr: 'MEM', primary: '#382C63', secondary: '#D9B44A' },
  { name: 'Milwaukee Lakehawks', abbr: 'MIL', primary: '#164E63', secondary: '#B8D8D8' },
  { name: 'Oklahoma City Bison', abbr: 'OKC', primary: '#6B2D1A', secondary: '#E0A458' },
  { name: 'Omaha Stampede', abbr: 'OMA', primary: '#7C2D12', secondary: '#F1C27D' },
  { name: 'Orlando Orbit', abbr: 'ORL', primary: '#4338CA', secondary: '#67E8F9' },
  { name: 'Portland Pioneers', abbr: 'POR', primary: '#14532D', secondary: '#D8B25C' },
  { name: 'Raleigh Redtails', abbr: 'RAL', primary: '#7F1D1D', secondary: '#E7B95E' },
  { name: 'Richmond Generals', abbr: 'RIC', primary: '#1E3A5F', secondary: '#B8A16A' },
  { name: 'Reno Highrollers', abbr: 'RNO', primary: '#3F3F46', secondary: '#D7B65D' },
  { name: 'Sacramento Gold', abbr: 'SAC', primary: '#4C1D95', secondary: '#F2C14E' },
  { name: 'Salt Lake Summit', abbr: 'SLC', primary: '#1E40AF', secondary: '#C7D2FE' },
  { name: 'San Antonio Marshals', abbr: 'SAT', primary: '#3F1D38', secondary: '#D8A84E' },
  { name: 'San Diego Breakers', abbr: 'SDG', primary: '#075985', secondary: '#FDE68A' },
  { name: 'St. Louis Archers', abbr: 'STL', primary: '#4C1D24', secondary: '#D8B46A' },
  { name: 'Toronto Northstars', abbr: 'TOR', primary: '#1E3A8A', secondary: '#E5E7EB' },
  { name: 'Virginia Beach Tritons', abbr: 'VBH', primary: '#0F766E', secondary: '#F0C36E' },
  { name: 'Albany Empire', abbr: 'ALB', primary: '#312E81', secondary: '#D5B55F' },
  { name: 'El Paso Dust Devils', abbr: 'ELP', primary: '#7C3A17', secondary: '#F3B562' },
  { name: 'Fargo Frost', abbr: 'FAR', primary: '#155E75', secondary: '#E0F2FE' },
];

const STADIUM_NAMES = [
  'Desert Crown Stadium','Aurora Field','Lone Star Grounds','Ironworks Stadium','Sawtooth Field','Guardian Grounds','Harbor Fortress',
  'Flight Deck Stadium','Heartland Field','Foundry Park','Pacific Tide Stadium','Knightfall Grounds','Bluegrass Coliseum','Pyramid Field',
  'Lakeshore Stadium','Prairie Crown Field','Stampede Grounds','Orbit Park','Pioneer Stadium','Redtail Field','Commonwealth Grounds',
  'Silver Basin Stadium','Capital Gold Park','Summit Field','Marshal Grounds','Breaker Bay Stadium','Gateway Grounds','Northstar Dome',
  'Triton Field','Empire Stadium','Sunset Mesa Park','Frostline Dome',
];

export const SOLO_OWNER_TEAMS = SOLO_TEAM_THEMES.map((team, index) => ({
  abbr: team.abbr,
  name: team.name,
  stadium: STADIUM_NAMES[index],
  capacity: 58_000 + ((index * 1_937) % 19_000),
  marketValueB: Number((4.8 + ((index * 13) % 57) / 10).toFixed(1)),
}));

const FIRST_NAMES = [
  'Aiden','Amari','Andre','Ashton','Blake','Bryce','Cameron','Cedric','Damon','Darius','Devin','Eli',
  'Emmett','Evan','Felix','Gavin','Grant','Isaiah','Jabari','Jace','Jalen','Jamal','Jonah','Jordan',
  'Kaden','Kai','Kendrick','Khalil','Landon','Leo','Malik','Marcus','Mason','Micah','Miles','Nico',
  'Noah','Owen','Quentin','Rashad','Roman','Silas','Tariq','Theo','Tristan','Tyrese','Xavier','Zion',
];

const LAST_NAMES = [
  'Aldridge','Bellamy','Callen','Dunley','Easton','Fairmont','Gaines','Hollowell','Irons','Kessler','Langford','Mercer',
  'Norwood','Oakley','Pryor','Quade','Redvale','Sterling','Tolliver','Underhill','Voss','Westfall','Yardley','Zeller',
  'Ashford','Bexley','Corwin','Danner','Ellery','Farrow','Grady','Hartwell','Ingram','Keller','Lockwood','Marlowe',
  'Nash','Orson','Parker','Quinlan','Rowan','Sayer','Thorne','Ulmer','Vale','Whitaker','York','Zane',
];

const TEAM_POSITIONS: Position[] = [
  'QB','QB','QB','RB','RB','RB','RB','WR','WR','WR','WR','WR','WR','TE','TE','TE',
  'LT','LT','RT','RT','LG','LG','RG','RG','C','C',
  'EDGE','EDGE','EDGE','DE','DE','DT','DT','DT','NT','LB','LB','LB','LB','LB','LB',
  'CB','CB','CB','CB','CB','CB','FS','FS','SS','SS','K','P',
];

const positionGroup = (position: Position): PositionGroup => {
  if (['LT','RT','LG','RG','C','OT','OG'].includes(position)) return 'OL';
  if (['EDGE','DE','DT','NT'].includes(position)) return 'DL_EDGE';
  if (['FS','SS','S'].includes(position)) return 'S';
  return position as PositionGroup;
};

const stableNumber = (value: string) =>
  Array.from(value).reduce((total, character) => Math.imul(total ^ character.charCodeAt(0), 16777619), 2166136261) >>> 0;

const clampRating = (value: number) => Math.max(60, Math.min(97, Math.round(value)));

const salaryFor = (position: Position, overall: number, seed: number) => {
  const premium: Record<string, number> = { QB: 1.75, EDGE: 1.25, WR: 1.16, LT: 1.14, CB: 1.08, RT: .92, DT: .9, DE: .9, TE: .72, RB: .62, LB: .68, FS: .62, SS: .62, K: .18, P: .14 };
  const floor = ['K','P'].includes(position) ? .8 : 1.1;
  const talent = Math.max(0, overall - 66);
  return Number(Math.max(floor, (talent * talent / 48) * (premium[position] ?? .58) + (seed % 9) * .12).toFixed(1));
};

const attributesFor = (position: Position, overall: number, seed: number): Player['attributes'] => {
  const variation = (offset: number) => clampRating(overall + ((seed >>> offset) % 9) - 4);
  return {
    athleticism: variation(1),
    footballIQ: variation(5),
    passing: position === 'QB' ? variation(8) : undefined,
    rushing: ['QB','RB'].includes(position) ? variation(10) : undefined,
    receiving: ['RB','WR','TE'].includes(position) ? variation(12) : undefined,
    passBlocking: ['LT','RT','LG','RG','C'].includes(position) ? variation(14) : undefined,
    runBlocking: ['LT','RT','LG','RG','C','TE'].includes(position) ? variation(16) : undefined,
    passRush: ['EDGE','DE','DT','NT','LB'].includes(position) ? variation(18) : undefined,
    runDefense: ['EDGE','DE','DT','NT','LB','FS','SS'].includes(position) ? variation(20) : undefined,
    coverage: ['LB','CB','FS','SS'].includes(position) ? variation(22) : undefined,
    kicking: ['K','P'].includes(position) ? variation(24) : undefined,
  };
};

const buildSoloPlayers = (): Player[] => {
  let globalIndex = 0;
  return SOLO_TEAM_THEMES.flatMap((team, teamIndex) => {
    const depthByGroup = new Map<string, number>();
    return TEAM_POSITIONS.map((position, rosterIndex) => {
      const group = positionGroup(position);
      const depth = depthByGroup.get(group) ?? 0;
      depthByGroup.set(group, depth + 1);
      const seed = stableNumber(`${team.abbr}:${position}:${rosterIndex}:ball-knower-league`);
      const teamStrength = (teamIndex * 7 % 9) - 4;
      const depthPenalty = Math.min(12, depth * 2);
      const overall = clampRating(84 + teamStrength - depthPenalty + (seed % 9) - 4);
      const firstName = FIRST_NAMES[globalIndex % FIRST_NAMES.length];
      const lastName = LAST_NAMES[Math.floor(globalIndex / FIRST_NAMES.length) % LAST_NAMES.length];
      const name = `${firstName} ${lastName}`;
      const id = `solo-${team.abbr.toLowerCase()}-${String(rosterIndex + 1).padStart(2, '0')}`;
      globalIndex += 1;
      return {
        id,
        playerId: id,
        teamId: team.abbr,
        team: team.abbr,
        teamAbbreviation: team.abbr,
        teamCity: team.name.split(' ').slice(0, -1).join(' '),
        teamName: team.name,
        conference: teamIndex < 16 ? 'AFC' : 'NFC',
        division: ['East','North','South','West'][Math.floor((teamIndex % 16) / 4)] as Player['division'],
        name,
        firstName,
        lastName,
        fullName: name,
        position,
        positionGroup: group,
        jerseyNumber: (seed % 98) + 1,
        age: 21 + (seed % 14),
        experience: seed % 12,
        starter: depth === 0 || (group === 'WR' && depth < 3) || (['OL','DL_EDGE','LB','CB','S'].includes(group) && depth < 4),
        active: true,
        isFreeAgent: false,
        rosterSeason: 1,
        ovr: overall,
        overall: overall,
        overallRating: overall,
        ratingSource: 'Ball Knower simulated universe',
        ratingSeason: 'SIM-1',
        ratingStatus: 'EDITORIAL',
        salary: salaryFor(position, overall, seed),
        salaryType: 'estimated',
        salarySource: 'Ball Knower simulation model',
        archetype: 'Simulated pro player',
        attributes: attributesFor(position, overall, seed),
      } satisfies Player;
    });
  });
};

const SOLO_CREATOR_EASTER_EGG: Player = {
  id: 'bk-001-eli-rodriguez', playerId: 'bk-001-eli-rodriguez',
  teamId: 'JCY', team: 'JCY', teamAbbreviation: 'JCY', teamCity: 'Jersey City', teamName: 'Jersey City Knights',
  conference: 'AFC', division: 'East',
  name: 'Eli Rodriguez', firstName: 'Eli', lastName: 'Rodriguez', fullName: 'Eli Rodriguez',
  position: 'WR', positionGroup: 'WR', jerseyNumber: 11,
  age: 30, experience: 10, starter: true, active: true, isFreeAgent: false, rosterSeason: 1,
  ovr: 85, overall: 85, overallRating: 85,
  ratingSource: 'Ball Knower simulated universe', ratingSeason: 'SIM-1', ratingStatus: 'EDITORIAL',
  salary: 14.8, salaryType: 'estimated', salarySource: 'Ball Knower simulation model',
  archetype: 'Elite slot route runner',
  speed: 96, awareness: 93,
  attributes: { athleticism: 91, footballIQ: 94, receiving: 95 },
} satisfies Player;

const BASE_SOLO_PLAYERS_DATABASE: Player[] = buildSoloPlayers();
const eliRosterSlot = BASE_SOLO_PLAYERS_DATABASE.findIndex(player => player.team === 'JCY' && player.position === 'WR' && !player.starter);
if (eliRosterSlot >= 0) BASE_SOLO_PLAYERS_DATABASE[eliRosterSlot] = SOLO_CREATOR_EASTER_EGG;

export const SOLO_PLAYERS_DATABASE: Player[] = BASE_SOLO_PLAYERS_DATABASE;
export const SOLO_KNOWN_PLAYERS_DATABASE: Player[] = SOLO_PLAYERS_DATABASE;
export const SOLO_PLAYER_BY_ID = new Map(SOLO_PLAYERS_DATABASE.map(player => [player.id, player]));

export function getSoloTeam(abbr?: string | null): TeamTheme {
  return SOLO_TEAM_THEMES.find(team => team.abbr === abbr) ??