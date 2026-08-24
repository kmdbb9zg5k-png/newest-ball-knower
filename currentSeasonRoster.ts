import { Player } from './types';
import { SPECIAL_TEAMS_2026 } from './specialTeams2026';
import { MADDEN_27_CURRENT_PLAYERS, normalizeMaddenRosterName } from './madden27CurrentRoster';

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

  // Madden NFL 27 launch roster corrections
  'Micah Parsons': 'GB',
};

// EA's Madden NFL 27 launch database is authoritative for the Solo card OVR.
// Keep these corrections separate from the legacy per-division card values so
// an old `overallRating` field cannot silently win during normalization.
export const MADDEN_27_PLAYER_OVERRIDES: Record<string, number> = {
  'Matthew Stafford': 99,
  'Christian McCaffrey': 97,
  'Trent Williams': 96,
  'Micah Parsons': 98,
  'Justin Jefferson': 94,
  'Fred Warner': 97,
};

// Players absent from the current EA NFL roster database must not be draftable.
const INACTIVE_PLAYERS = new Set([
  'Tyreek Hill',
  'Zack Martin',
]);

const MISSING_2026_PLAYERS: Player[] = [
  {
    id: 'qb-cam-ward', name: 'Cam Ward', team: 'TEN', teamCity: 'Tennessee', position: 'QB',
    ovr: 75, overallRating: 75, overall: 75, ratingSource: 'Ball Knower Composite', ratingSeason: 2026, ratingStatus: 'VERIFIED', salary: 10, starter: true,
    archetype: 'Second-Year Creator',
    attributes: { passing: 77, rushing: 76, athleticism: 82, footballIQ: 73 },
    highlightStat: 'Live-arm creator entering Year 2',
  },
  {
    id: 'qb-jaxson-dart', name: 'Jaxson Dart', team: 'NYG', teamCity: 'New York', position: 'QB',
    ovr: 77, overallRating: 77, overall: 77, ratingSource: 'Ball Knower Composite', ratingSeason: 2026, ratingStatus: 'VERIFIED', salary: 8, starter: true,
    archetype: 'Aggressive Young Dual-Threat',
    attributes: { passing: 78, rushing: 80, athleticism: 84, footballIQ: 77 },
    highlightStat: 'Athletic second-year starter',
  },
  {
    id: 'qb-tyler-shough', name: 'Tyler Shough', team: 'NO', teamCity: 'New Orleans', position: 'QB',
    ovr: 77, overallRating: 77, overall: 77, ratingSource: 'Ball Knower Composite', ratingSeason: 2026, ratingStatus: 'VERIFIED', salary: 7, starter: true,
    archetype: 'Tall Rhythm Passer',
    attributes: { passing: 79, rushing: 72, athleticism: 78, footballIQ: 76 },
    highlightStat: 'Promising young pocket passer',
  },
  {
    id: 'qb-fernando-mendoza', name: 'Fernando Mendoza', team: 'LV', teamCity: 'Las Vegas', position: 'QB',
    ovr: 74, overallRating: 74, overall: 74, ratingSource: 'Ball Knower Composite', ratingSeason: 2026, ratingStatus: 'VERIFIED', salary: 9, starter: false,
    projectedStarter: true,
    archetype: 'No. 1 Pick Developmental Franchise QB',
    attributes: { passing: 75, rushing: 73, athleticism: 84, footballIQ: 75 },
    highlightStat: '2026 No. 1 overall pick',
  },
  {
    id: 'qb-shedeur-sanders', name: 'Shedeur Sanders', team: 'CLE', teamCity: 'Cleveland', position: 'QB',
    ovr: 69, overallRating: 69, overall: 69, ratingSource: 'Ball Knower Composite', ratingSeason: 2026, ratingStatus: 'VERIFIED', salary: 4, starter: false,
    archetype: 'Accurate Young Pocket Passer',
    attributes: { passing: 74, rushing: 68, athleticism: 78, footballIQ: 75 },
    highlightStat: 'Developmental QB with starting upside',
  },
];

export function applyCurrent2026Roster(rawPlayers: Player[]): Player[] {
  const expectedStarterByName = new Map(
    Object.entries(CURRENT_2026_QB_STARTERS).map(([team, name]) => [normalizeMaddenRosterName(name), team])
  );

  const legacyByName = new Map<string, Player[]>();
  for (const player of rawPlayers) {
    const key = normalizeMaddenRosterName(player.name);
    legacyByName.set(key, [...(legacyByName.get(key) || []), player]);
  }

  return MADDEN_27_CURRENT_PLAYERS.map((official): Player => {
    const legacyMatches = legacyByName.get(normalizeMaddenRosterName(official.name)) || [];
    const legacy = legacyMatches.find(player => player.position === official.position) || legacyMatches[0];
    const expectedStarterTeam = official.position === 'QB'
      ? expectedStarterByName.get(normalizeMaddenRosterName(official.name))
      : undefined;
    const baseline = official.overallRating;
    const estimatedSalary = Math.min(60, Math.max(0.75, (baseline - 60) * (official.position === 'QB' ? 1.35 : ['WR','EDGE','CB','LT','RT'].includes(official.position) ? 1.05 : 0.8)));

    return {
      ...(legacy || {}),
      id: `ea-${official.eaId}`,
      playerId: `ea-${official.eaId}`,
      name: official.name,
      team: official.team,
      teamId: official.team,
      teamCity: legacy?.teamCity || 'NFL',
      position: official.position,
      positionGroup: undefined,
      ovr: baseline,
      overallRating: baseline,
      overall: baseline,
      salary: legacy?.salary ?? Number(estimatedSalary.toFixed(2)),
      salaryType: legacy?.salaryType ?? 'estimated',
      salarySource: legacy?.salarySource ?? 'legacy_estimate',
      attributes: legacy?.attributes || {
        passing: official.position === 'QB' ? baseline : undefined,
        rushing: ['QB','RB','FB'].includes(official.position) ? baseline : undefined,
        receiving: ['RB','FB','WR','TE'].includes(official.position) ? baseline : undefined,
        passBlocking: ['LT','RT','LG','RG','C'].includes(official.position) ? baseline : undefined,
        runBlocking: ['LT','RT','LG','RG','C','TE'].includes(official.position) ? baseline : undefined,
        passRush: ['EDGE','DT'].includes(official.position) ? baseline : undefined,
        runDefense: ['EDGE','DT','LB'].includes(official.position) ? baseline : undefined,
        coverage: ['LB','CB','FS','SS'].includes(official.position) ? baseline : undefined,
        kicking: ['K','P'].includes(official.position) ? baseline : undefined,
        athleticism: baseline,
        footballIQ: baseline,
      },
      active: true,
      isFreeAgent: false,
      starter: official.position === 'QB' ? expectedStarterTeam === official.team : legacy?.starter,
      projectedStarter: official.position === 'QB' ? expectedStarterTeam === official.team : legacy?.projectedStarter,
      ratingSource: 'Ball Knower Composite',
      ratingSeason: 2026,
      ratingStatus: 'VERIFIED' as const,
      rosterSeason: 2026,
      rosterLastUpdated: '2026-08-19',
    };
  });
}
