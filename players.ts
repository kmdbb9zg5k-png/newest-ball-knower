import { Player, Position, PositionGroup, RosterMigrationReport, RosterMismatch, RatingsValidationReport } from '../types';
import { AFC_EAST_PLAYERS } from './teams/afcEast';
import { AFC_NORTH_PLAYERS } from './teams/afcNorth';
import { AFC_SOUTH_PLAYERS } from './teams/afcSouth';
import { AFC_WEST_PLAYERS } from './teams/afcWest';
import { NFC_EAST_PLAYERS } from './teams/nfcEast';
import { NFC_NORTH_PLAYERS } from './teams/nfcNorth';
import { NFC_SOUTH_PLAYERS } from './teams/nfcSouth';
import { NFC_WEST_PLAYERS } from './teams/nfcWest';
import { validateDatabase, DatabaseValidationReport } from '../utils/databaseValidator';
import {
  CURRENT_ROSTER_METADATA,
  HISTORICAL_ROSTER_MIGRATIONS,
  detectRosterMismatches,
  generateRosterMigrationReport
} from './rosterSync';
import {
  MADDEN_RATING_METADATA,
  OFFICIAL_MADDEN_RATINGS,
  getOfficialMaddenRating,
} from './ratings/maddenRatings';
import {
  MASTER_2026_ROSTER_REGISTRY,
  enforce2026Roster,
  validateAndSyncRoster,
  generateFull2026RosterValidationReport,
  CentralizedRosterValidationReport,
  RosterValidationEntry,
} from './rosters/masterRoster2026';
import { validatePlayerRatings } from '../utils/ratingsValidator';
import { applyCurrent2026Roster } from './currentSeasonRoster';

export {
  CURRENT_ROSTER_METADATA,
  HISTORICAL_ROSTER_MIGRATIONS,
  detectRosterMismatches,
  generateRosterMigrationReport,
  MADDEN_RATING_METADATA,
  OFFICIAL_MADDEN_RATINGS,
  getOfficialMaddenRating,
  validatePlayerRatings,
  MASTER_2026_ROSTER_REGISTRY,
  enforce2026Roster,
  validateAndSyncRoster,
  generateFull2026RosterValidationReport,
};
export type { CentralizedRosterValidationReport, RosterValidationEntry };

export interface NFLTeamInfo {
  code: string;
  name: string;
  city: string;
  conference: 'AFC' | 'NFC';
  division: 'East' | 'North' | 'South' | 'West';
  primaryColor?: string;
  secondaryColor?: string;
}

export const NFL_TEAMS: NFLTeamInfo[] = [
  // AFC East
  { code: 'BUF', name: 'Bills', city: 'Buffalo', conference: 'AFC', division: 'East', primaryColor: '#00338D', secondaryColor: '#C60C30' },
  { code: 'MIA', name: 'Dolphins', city: 'Miami', conference: 'AFC', division: 'East', primaryColor: '#008E97', secondaryColor: '#FC4C02' },
  { code: 'NE', name: 'Patriots', city: 'New England', conference: 'AFC', division: 'East', primaryColor: '#002244', secondaryColor: '#C60C30' },
  { code: 'NYJ', name: 'Jets', city: 'New York', conference: 'AFC', division: 'East', primaryColor: '#125740', secondaryColor: '#000000' },
  // AFC North
  { code: 'BAL', name: 'Ravens', city: 'Baltimore', conference: 'AFC', division: 'North', primaryColor: '#241773', secondaryColor: '#9E7C0C' },
  { code: 'CIN', name: 'Bengals', city: 'Cincinnati', conference: 'AFC', division: 'North', primaryColor: '#FB4F14', secondaryColor: '#000000' },
  { code: 'CLE', name: 'Browns', city: 'Cleveland', conference: 'AFC', division: 'North', primaryColor: '#311D00', secondaryColor: '#FF3C00' },
  { code: 'PIT', name: 'Steelers', city: 'Pittsburgh', conference: 'AFC', division: 'North', primaryColor: '#FFB612', secondaryColor: '#101820' },
  // AFC South
  { code: 'HOU', name: 'Texans', city: 'Houston', conference: 'AFC', division: 'South', primaryColor: '#03202F', secondaryColor: '#A71930' },
  { code: 'IND', name: 'Colts', city: 'Indianapolis', conference: 'AFC', division: 'South', primaryColor: '#002C5F', secondaryColor: '#A2AAAD' },
  { code: 'JAX', name: 'Jaguars', city: 'Jacksonville', conference: 'AFC', division: 'South', primaryColor: '#006778', secondaryColor: '#D7A22A' },
  { code: 'TEN', name: 'Titans', city: 'Tennessee', conference: 'AFC', division: 'South', primaryColor: '#0C2340', secondaryColor: '#4B92DB' },
  // AFC West
  { code: 'DEN', name: 'Broncos', city: 'Denver', conference: 'AFC', division: 'West', primaryColor: '#FB4F14', secondaryColor: '#002244' },
  { code: 'KC', name: 'Chiefs', city: 'Kansas City', conference: 'AFC', division: 'West', primaryColor: '#E31837', secondaryColor: '#FFB81C' },
  { code: 'LV', name: 'Raiders', city: 'Las Vegas', conference: 'AFC', division: 'West', primaryColor: '#000000', secondaryColor: '#A5ACAF' },
  { code: 'LAC', name: 'Chargers', city: 'Los Angeles', conference: 'AFC', division: 'West', primaryColor: '#0080C6', secondaryColor: '#FFC20E' },
  // NFC East
  { code: 'DAL', name: 'Cowboys', city: 'Dallas', conference: 'NFC', division: 'East', primaryColor: '#003594', secondaryColor: '#041E42' },
  { code: 'NYG', name: 'Giants', city: 'New York', conference: 'NFC', division: 'East', primaryColor: '#0B2265', secondaryColor: '#A71930' },
  { code: 'PHI', name: 'Eagles', city: 'Philadelphia', conference: 'NFC', division: 'East', primaryColor: '#004C54', secondaryColor: '#A5ACAF' },
  { code: 'WAS', name: 'Commanders', city: 'Washington', conference: 'NFC', division: 'East', primaryColor: '#5A1414', secondaryColor: '#FFB612' },
  // NFC North
  { code: 'CHI', name: 'Bears', city: 'Chicago', conference: 'NFC', division: 'North', primaryColor: '#0B162A', secondaryColor: '#C83803' },
  { code: 'DET', name: 'Lions', city: 'Detroit', conference: 'NFC', division: 'North', primaryColor: '#0076B6', secondaryColor: '#B0B7BC' },
  { code: 'GB', name: 'Packers', city: 'Green Bay', conference: 'NFC', division: 'North', primaryColor: '#203731', secondaryColor: '#FFB612' },
  { code: 'MIN', name: 'Vikings', city: 'Minnesota', conference: 'NFC', division: 'North', primaryColor: '#4F2683', secondaryColor: '#FFC62F' },
  // NFC South
  { code: 'ATL', name: 'Falcons', city: 'Atlanta', conference: 'NFC', division: 'South', primaryColor: '#A71930', secondaryColor: '#000000' },
  { code: 'CAR', name: 'Panthers', city: 'Carolina', conference: 'NFC', division: 'South', primaryColor: '#0085CA', secondaryColor: '#101820' },
  { code: 'NO', name: 'Saints', city: 'New Orleans', conference: 'NFC', division: 'South', primaryColor: '#D3BC8D', secondaryColor: '#101820' },
  { code: 'TB', name: 'Buccaneers', city: 'Tampa Bay', conference: 'NFC', division: 'South', primaryColor: '#D50A0A', secondaryColor: '#34302B' },
  // NFC West
  { code: 'ARI', name: 'Cardinals', city: 'Arizona', conference: 'NFC', division: 'West', primaryColor: '#97233F', secondaryColor: '#000000' },
  { code: 'LAR', name: 'Rams', city: 'Los Angeles', conference: 'NFC', division: 'West', primaryColor: '#003594', secondaryColor: '#FFA300' },
  { code: 'SF', name: '49ers', city: 'San Francisco', conference: 'NFC', division: 'West', primaryColor: '#AA0000', secondaryColor: '#B3995D' },
  { code: 'SEA', name: 'Seahawks', city: 'Seattle', conference: 'NFC', division: 'West', primaryColor: '#002244', secondaryColor: '#69BE28' },
];

/**
 * Maps a specific player position to a high-level position group.
 */
export function getPositionGroup(pos: Position): PositionGroup {
  switch (pos) {
    case 'QB':
      return 'QB';
    case 'RB':
    case 'FB':
      return 'RB';
    case 'WR':
      return 'WR';
    case 'TE':
      return 'TE';
    case 'OT':
    case 'LT':
    case 'RT':
    case 'OG':
    case 'LG':
    case 'RG':
    case 'C':
      return 'OL';
    case 'EDGE':
      return 'EDGE';
    case 'DT':
    case 'DE':
    case 'NT':
      return 'DL';
    case 'LB':
      return 'LB';
    case 'CB':
      return 'CB';
    case 'S':
    case 'FS':
    case 'SS':
      return 'S';
    case 'K':
    case 'P':
      return 'K';
    default:
      return 'ALL';
  }
}

/**
 * Normalizes raw player record into a fully enriched, standardized Ball Knower master record.
 */
function normalizePlayer(raw: Player): Player {
  const nameParts = (raw.name || '').trim().split(' ');
  const firstName = raw.firstName || (nameParts.length > 0 ? nameParts[0] : '');
  const lastName = raw.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '');
  const fullName = raw.fullName || raw.name;

  const teamData = NFL_TEAMS.find(t => t.code === raw.team);
  const conference = raw.conference || teamData?.conference || 'AFC';
  const division = raw.division || teamData?.division || 'East';
  const teamCity = teamData?.city || raw.teamCity || 'NFL';
  const teamName = teamData?.name || raw.teamName || '';
  const positionGroup = raw.positionGroup || getPositionGroup(raw.position);

  // Derive starter status
  let starterStatus: Player['starterStatus'] = 'rotational';
  if (raw.starter) {
    starterStatus = raw.projectedStarter ? 'projected_starter' : 'starter';
  } else if (raw.starter === false) {
    starterStatus = 'backup';
  }

  // Derive mobility/speed/strength
  const athleticism = raw.attributes?.athleticism || 80;
  const footballIQ = raw.attributes?.footballIQ || 80;
  const speed = raw.speed || athleticism;
  const strength = raw.strength || (raw.attributes?.runBlocking || raw.attributes?.runDefense || athleticism);
  const awareness = raw.awareness || footballIQ;

  // Enrich QB-specific attributes with realistic football ratings
  const attributes = { ...raw.attributes };
  if (raw.position === 'QB') {
    const passOvr = attributes.passing || raw.ovr;
    const rushOvr = attributes.rushing || 70;
    attributes.throwPower = attributes.throwPower || Math.min(99, Math.round(passOvr * 0.98 + athleticism * 0.04));
    attributes.shortAccuracy = attributes.shortAccuracy || Math.min(99, Math.round(passOvr * 0.99 + footballIQ * 0.03));
    attributes.mediumAccuracy = attributes.mediumAccuracy || Math.min(99, Math.round(passOvr * 0.97 + footballIQ * 0.04));
    attributes.deepAccuracy = attributes.deepAccuracy || Math.min(99, Math.round(passOvr * 0.94 + athleticism * 0.06));
    attributes.pocketPresence = attributes.pocketPresence || Math.min(99, Math.round(footballIQ * 0.95 + passOvr * 0.05));
    attributes.decisionMaking = attributes.decisionMaking || Math.min(99, Math.round(footballIQ * 0.96 + 3));
    attributes.mobility = attributes.mobility || rushOvr;
    attributes.playAction = attributes.playAction || Math.min(99, Math.round(passOvr * 0.95 + footballIQ * 0.05));
    attributes.throwUnderPressure = attributes.throwUnderPressure || Math.min(99, Math.round(passOvr * 0.92 + footballIQ * 0.08));
  }

  // Fetch official EA SPORTS Madden rating single source of truth
  const maddenData = getOfficialMaddenRating(raw.id, raw.name, raw.team, raw.position);
  const overallRating = raw.overallRating || maddenData.overallRating || raw.ovr;
  const ratingSource = raw.ratingSource || maddenData.ratingSource;
  const ratingSeason = raw.ratingSeason || maddenData.ratingSeason;
  const ratingLastUpdated = raw.lastUpdated || maddenData.lastUpdated;
  const ratingStatus = raw.ratingStatus || maddenData.ratingStatus;
  const previousRating = raw.previousRating || maddenData.previousOvr;
  const legacyRatingRemoved = raw.legacyRatingRemoved !== undefined ? raw.legacyRatingRemoved : maddenData.legacyRatingRemoved;

  const basePlayer: Player = {
    ...raw,
    id: raw.id,
    playerId: raw.playerId || raw.id,
    teamId: raw.teamId || raw.team,
    team: raw.team,
    firstName,
    lastName,
    fullName,
    teamAbbreviation: raw.team,
    teamCity,
    teamName,
    conference,
    division,
    positionGroup,
    starterStatus,
    active: raw.active !== undefined ? raw.active : true,
    isFreeAgent: raw.team === 'FA' || !!raw.isFreeAgent,
    rosterSeason: 2026,
    rosterLastUpdated: CURRENT_ROSTER_METADATA.rosterLastUpdated,
    // Unified rating single source of truth
    overallRating,
    ovr: overallRating,
    overall: overallRating,
    ratingSource,
    ratingSeason,
    lastUpdated: ratingLastUpdated,
    ratingStatus,
    previousRating,
    legacyRatingRemoved,
    speed,
    strength,
    awareness,
    attributes,
  };

  // Do NOT apply the legacy migration registry here. It contains historical 2024/2025
  // moves and used to silently overwrite newer team files. Current-season corrections
  // are applied once to the raw dataset before normalization instead.
  return basePlayer;
}

// Master Raw Combined Player Array
const LEGACY_RAW_PLAYERS: Player[] = [
  ...AFC_EAST_PLAYERS,
  ...AFC_NORTH_PLAYERS,
  ...AFC_SOUTH_PLAYERS,
  ...AFC_WEST_PLAYERS,
  ...NFC_EAST_PLAYERS,
  ...NFC_NORTH_PLAYERS,
  ...NFC_SOUTH_PLAYERS,
  ...NFC_WEST_PLAYERS,
];

// Apply the auditable 2026 correction layer once, then normalize.
const RAW_PLAYERS_COMBINED: Player[] = applyCurrent2026Roster(LEGACY_RAW_PLAYERS);

// Master normalized player database. Team files + current-season corrections are canonical.
export const PLAYERS_DATABASE: Player[] = RAW_PLAYERS_COMBINED.map(normalizePlayer);

// Run automatic validation on startup
export const DATABASE_VALIDATION_REPORT: DatabaseValidationReport = validateDatabase(PLAYERS_DATABASE, NFL_TEAMS);

// Official 2026 Roster Migration QA Report
export const ROSTER_MIGRATION_REPORT: RosterMigrationReport = generateRosterMigrationReport(PLAYERS_DATABASE, NFL_TEAMS);

// Official Madden NFL Player Ratings Validation Report
export const RATINGS_VALIDATION_REPORT: RatingsValidationReport = validatePlayerRatings(PLAYERS_DATABASE);

// Master Centralized 2026 Roster Source Validation Report
export const CENTRALIZED_ROSTER_VALIDATION_REPORT: CentralizedRosterValidationReport = generateFull2026RosterValidationReport(PLAYERS_DATABASE);

// Safe check helper functions
export function getPlayerById(id: string): Player | undefined {
  return PLAYERS_DATABASE.find(p => p.id === id);
}

export function getPlayersByPosition(position: Position): Player[] {
  return PLAYERS_DATABASE.filter(p => p.position === position);
}

export function getPlayersByPositionGroup(group: PositionGroup): Player[] {
  if (group === 'ALL') return PLAYERS_DATABASE;
  if (group === 'OFFENSE') {
    return PLAYERS_DATABASE.filter(p => ['QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'C'].includes(p.position));
  }
  if (group === 'DEFENSE') {
    return PLAYERS_DATABASE.filter(p => ['EDGE', 'DT', 'DE', 'NT', 'LB', 'CB', 'S', 'FS', 'SS'].includes(p.position));
  }
  if (group === 'OL') {
    return PLAYERS_DATABASE.filter(p => ['OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'C'].includes(p.position));
  }
  if (group === 'DL_EDGE') {
    return PLAYERS_DATABASE.filter(p => ['EDGE', 'DT', 'DE', 'NT'].includes(p.position));
  }
  if (group === 'DL') {
    return PLAYERS_DATABASE.filter(p => ['DT', 'DE', 'NT'].includes(p.position));
  }
  if (group === 'EDGE') {
    return PLAYERS_DATABASE.filter(p => p.position === 'EDGE');
  }
  if (group === 'S') {
    return PLAYERS_DATABASE.filter(p => ['S', 'FS', 'SS'].includes(p.position));
  }
  if (group === 'K') {
    return PLAYERS_DATABASE.filter(p => ['K', 'P'].includes(p.position));
  }
  return PLAYERS_DATABASE.filter(p => p.positionGroup === group || p.position === group);
}

export function getPlayersByTeam(teamCode: string): Player[] {
  return PLAYERS_DATABASE.filter(p => p.team === teamCode);
}

export function getTeamData(teamCode: string): NFLTeamInfo | undefined {
  return NFL_TEAMS.find(t => t.code === teamCode);
}

export interface PlayerSearchOptions {
  query?: string;
  positionGroup?: PositionGroup | 'ALL';
  specificPosition?: Position | 'ALL';
  teamCode?: string | 'ALL';
  minOvr?: number;
  maxSalary?: number;
  startersOnly?: boolean;
  sortBy?: 'overall_desc' | 'overall_asc' | 'name_asc' | 'name_desc' | 'salary_desc' | 'salary_asc';
}

/**
 * High-performance search and filtering utility across the centralized NFL master player database.
 * Supports first name, last name, full name, team name (e.g. 'Eagles', 'Cowboys'), team city, and code.
 */
export function searchPlayers(options: PlayerSearchOptions = {}): Player[] {
  const {
    query = '',
    positionGroup = 'ALL',
    specificPosition = 'ALL',
    teamCode = 'ALL',
    minOvr = 0,
    maxSalary = 999,
    startersOnly = false,
    sortBy = 'overall_desc',
  } = options;

  const q = query.trim().toLowerCase();

  const results = PLAYERS_DATABASE.filter(player => {
    // 1. OVR and Salary filter
    if (player.ovr < minOvr || player.salary > maxSalary) return false;

    // 2. Starter only filter
    if (startersOnly && !player.starter) return false;

    // 3. Team filter
    if (teamCode !== 'ALL' && player.team !== teamCode) return false;

    // 4. Specific position filter
    if (specificPosition !== 'ALL' && player.position !== specificPosition) return false;

    // 5. Position Group filter
    if (positionGroup !== 'ALL') {
      if (positionGroup === 'OFFENSE') {
        const isOffense = ['QB', 'RB', 'FB', 'WR', 'TE', 'OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'C'].includes(player.position);
        if (!isOffense) return false;
      } else if (positionGroup === 'DEFENSE') {
        const isDefense = ['EDGE', 'DT', 'DE', 'NT', 'LB', 'CB', 'S', 'FS', 'SS'].includes(player.position);
        if (!isDefense) return false;
      } else if (positionGroup === 'OL') {
        const isOL = ['OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'C'].includes(player.position);
        if (!isOL) return false;
      } else if (positionGroup === 'DL_EDGE') {
        const isDLEdge = ['EDGE', 'DT', 'DE', 'NT'].includes(player.position);
        if (!isDLEdge) return false;
      } else if (positionGroup === 'DL') {
        const isDL = ['DT', 'DE', 'NT'].includes(player.position);
        if (!isDL) return false;
      } else if (positionGroup === 'S') {
        const isS = ['S', 'FS', 'SS'].includes(player.position);
        if (!isS) return false;
      } else if (positionGroup === 'K') {
        const isK = ['K', 'P'].includes(player.position);
        if (!isK) return false;
      } else if (player.positionGroup !== positionGroup && player.position !== positionGroup) {
        return false;
      }
    }

    // 6. Text Query search (Matches first name, last name, full name, team name, team city, team abbreviation)
    if (q) {
      const nameMatch = player.name.toLowerCase().includes(q);
      const firstMatch = player.firstName ? player.firstName.toLowerCase().includes(q) : false;
      const lastMatch = player.lastName ? player.lastName.toLowerCase().includes(q) : false;
      const teamCodeMatch = player.team.toLowerCase() === q || player.team.toLowerCase().startsWith(q);
      const teamCityMatch = player.teamCity ? player.teamCity.toLowerCase().includes(q) : false;
      const teamNameMatch = player.teamName ? player.teamName.toLowerCase().includes(q) : false;
      const posMatch = player.position.toLowerCase() === q;
      const archetypeMatch = player.archetype ? player.archetype.toLowerCase().includes(q) : false;

      // Special aliases: "eagles" -> PHI, "cowboys" -> DAL, "chiefs" -> KC, "bills" -> BUF, etc.
      const isMatch = nameMatch || firstMatch || lastMatch || teamCodeMatch || teamCityMatch || teamNameMatch || posMatch || archetypeMatch;
      if (!isMatch) return false;
    }

    return true;
  });

  // Sort results
  return results.sort((a, b) => {
    switch (sortBy) {
      case 'overall_asc':
        return a.ovr - b.ovr;
      case 'name_asc':
        return a.name.localeCompare(b.name);
      case 'name_desc':
        return b.name.localeCompare(a.name);
      case 'salary_desc':
        return b.salary - a.salary;
      case 'salary_asc':
        return a.salary - b.salary;
      case 'overall_desc':
      default:
        return b.ovr - a.ovr;
    }
  });
}
