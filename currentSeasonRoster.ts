import { Player } from '../types';
import { SPECIAL_TEAMS_2026 } from './specialTeams2026';

/**
 * 2026 runtime roster corrections.
 *
 * The original project mixed 2024 team files with a hard-coded migration registry.
 * That registry could silently move players back to stale teams. This layer is deliberately
 * small, auditable and applied BEFORE normalization. Team files remain the base dataset,
 * while known 2026 moves/starters are corrected here until the full dataset is refreshed.
 */
export const CURRENT_2026_QB_STARTERS: Record<string, string> = {
  BUF: 'Josh Allen',
  MIA: 'Malik Willis',
  NE: 'Drake Maye',
  NYJ: 'Geno Smith',
  BAL: 'Lamar Jackson',
  CIN: 'Joe Burrow',
  CLE: 'Deshaun Watson',
  PIT: 'Aaron Rodgers',
  HOU: 'C.J. Stroud',
  IND: 'Daniel Jones',
  JAX: 'Trevor Lawrence',
  TEN: 'Cam Ward',
  DEN: 'Bo Nix',
  KC: 'Patrick Mahomes',
  LV: 'Kirk Cousins',
  LAC: 'Justin Herbert',
  DAL: 'Dak Prescott',
  NYG: 'Jaxson Dart',
  PHI: 'Jalen Hurts',
  WAS: 'Jayden Daniels',
  CHI: 'Caleb Williams',
  DET: 'Jared Goff',
  GB: 'Jordan Love',
  MIN: 'Kyler Murray',
  ATL: 'Michael Penix Jr.',
  CAR: 'Bryce Young',
  NO: 'Tyler Shough',
  TB: 'Baker Mayfield',
  ARI: 'Jacoby Brissett',
  LAR: 'Matthew Stafford',
  SF: 'Brock Purdy',
  SEA: 'Sam Darnold',
};

// Official Madden NFL 27 QB OVRs captured from EA's current ratings database (Aug. 2026).
export const MADDEN_27_QB_OVERRIDES: Record<string, number> = {
  'Josh Allen': 99,
  'Matthew Stafford': 99,
  'Joe Burrow': 97,
  'Lamar Jackson': 94,
  'Patrick Mahomes': 93,
  'Drake Maye': 92,
  'Dak Prescott': 91,
  'Caleb Williams': 90,
  'Justin Herbert': 90,
  'Jared Goff': 88,
  'Sam Darnold': 87,
  'Jordan Love': 86,
  'Brock Purdy': 85,
  'Trevor Lawrence': 84,
  'Baker Mayfield': 83,
  'Jalen Hurts': 82,
  'Bo Nix': 81,
  'Jayden Daniels': 80,
  'Aaron Rodgers': 79,
  'Bryce Young': 78,
  'Daniel Jones': 78,
  'Jaxson Dart': 77,
  'Tyler Shough': 77,
  'C.J. Stroud': 76,
  'Cam Ward': 75,
  'Kyler Murray': 75,
  'Fernando Mendoza': 74,
  'Malik Willis': 74,
  'Tua Tagovailoa': 74,
  'Kirk Cousins': 73,
  'Michael Penix Jr.': 73,
  'Geno Smith': 72,
  'Jacoby Brissett': 72,
  'Deshaun Watson': 69,
  'Shedeur Sanders': 69,
};

const TEAM_OVERRIDES: Record<string, string> = {
  // QB movement / 2026 depth-chart corrections
  'Malik Willis': 'MIA',
  'Geno Smith': 'NYJ',
  'Aaron Rodgers': 'PIT',
  'Daniel Jones': 'IND',
  'Kirk Cousins': 'LV',
  'Kyler Murray': 'MIN',
  'Jacoby Brissett': 'ARI',
  'Sam Darnold': 'SEA',
  'Tua Tagovailoa': 'ATL',

  // High-impact 2026 veteran movement represented in current NFL reporting
  'Davante Adams': 'LAR',
  'A.J. Brown': 'NE',
  'Jaylen Waddle': 'DEN',
  'Myles Garrett': 'LAC',
};

const MISSING_2026_PLAYERS: Player[] = [
  {
    id: 'qb-cam-ward', name: 'Cam Ward', team: 'TEN', teamCity: 'Tennessee', position: 'QB',
    ovr: 75, overallRating: 75, overall: 75, ratingSource: 'EA SPORTS Madden', ratingSeason: 2026, ratingStatus: 'VERIFIED', salary: 10, starter: true,
    archetype: 'Second-Year Creator',
    attributes: { passing: 77, rushing: 76, athleticism: 82, footballIQ: 73 },
    highlightStat: 'Live-arm creator entering Year 2',
  },
  {
    id: 'qb-jaxson-dart', name: 'Jaxson Dart', team: 'NYG', teamCity: 'New York', position: 'QB',
    ovr: 77, overallRating: 77, overall: 77, ratingSource: 'EA SPORTS Madden', ratingSeason: 2026, ratingStatus: 'VERIFIED', salary: 8, starter: true,
    archetype: 'Aggressive Young Dual-Threat',
    attributes: { passing: 78, rushing: 80, athleticism: 84, footballIQ: 77 },
    highlightStat: 'Athletic second-year starter',
  },
  {
    id: 'qb-tyler-shough', name: 'Tyler Shough', team: 'NO', teamCity: 'New Orleans', position: 'QB',
    ovr: 77, overallRating: 77, overall: 77, ratingSource: 'EA SPORTS Madden', ratingSeason: 2026, ratingStatus: 'VERIFIED', salary: 7, starter: true,
    archetype: 'Tall Rhythm Passer',
    attributes: { passing: 79, rushing: 72, athleticism: 78, footballIQ: 76 },
    highlightStat: 'Promising young pocket passer',
  },
  {
    id: 'qb-fernando-mendoza', name: 'Fernando Mendoza', team: 'LV', teamCity: 'Las Vegas', position: 'QB',
    ovr: 74, overallRating: 74, overall: 74, ratingSource: 'EA SPORTS Madden', ratingSeason: 2026, ratingStatus: 'VERIFIED', salary: 9, starter: false,
    projectedStarter: true,
    archetype: 'No. 1 Pick Developmental Franchise QB',
    attributes: { passing: 75, rushing: 73, athleticism: 84, footballIQ: 75 },
    highlightStat: '2026 No. 1 overall pick',
  },
  {
    id: 'qb-shedeur-sanders', name: 'Shedeur Sanders', team: 'CLE', teamCity: 'Cleveland', position: 'QB',
    ovr: 69, overallRating: 69, overall: 69, ratingSource: 'EA SPORTS Madden', ratingSeason: 2026, ratingStatus: 'VERIFIED', salary: 4, starter: false,
    archetype: 'Accurate Young Pocket Passer',
    attributes: { passing: 74, rushing: 68, athleticism: 78, footballIQ: 75 },
    highlightStat: 'Developmental QB with starting upside',
  },
];

export function applyCurrent2026Roster(rawPlayers: Player[]): Player[] {
  const expectedStarterByName = new Map(
    Object.entries(CURRENT_2026_QB_STARTERS).map(([team, name]) => [name, team])
  );

  const corrected: Player[] = rawPlayers.map((player): Player => {
    const nextTeam = TEAM_OVERRIDES[player.name] || player.team;
    const officialQbOvr = player.position === 'QB' ? MADDEN_27_QB_OVERRIDES[player.name] : undefined;
    const expectedStarterTeam = player.position === 'QB' ? expectedStarterByName.get(player.name) : undefined;

    return {
      ...player,
      team: nextTeam,
      teamId: nextTeam,
      starter: player.position === 'QB' ? expectedStarterTeam === nextTeam : player.starter,
      projectedStarter: player.position === 'QB' ? expectedStarterTeam === nextTeam : player.projectedStarter,
      ...(officialQbOvr ? {
        ovr: officialQbOvr,
        overallRating: officialQbOvr,
        overall: officialQbOvr,
        ratingSource: 'EA SPORTS Madden',
        ratingSeason: 2026,
        ratingStatus: 'VERIFIED' as const,
      } : {}),
    };
  });

  const existingNames = new Set(corrected.map(p => p.name.toLowerCase()));
  for (const player of MISSING_2026_PLAYERS) {
    if (!existingNames.has(player.name.toLowerCase())) corrected.push(player);
  }

  const specialistNames = new Set(SPECIAL_TEAMS_2026.map(p => p.name.toLowerCase()));
  const updated = corrected.filter(p => !((p.position === 'K' || p.position === 'P') && specialistNames.has(p.name.toLowerCase())));
  updated.push(...SPECIAL_TEAMS_2026);
  return updated;
}
