import { Player } from '../types';
import { CURRENT_2026_QB_STARTERS } from '../data/currentSeasonRoster';

export interface PositionGroupStatus {
  group: string;
  label: string;
  positions: string[];
  count: number;
  players: Player[];
  isFilled: boolean;
}

export interface TeamRosterAudit {
  code: string;
  name: string;
  city: string;
  fullName: string;
  conference: string;
  division: string;
  totalPlayers: number;
  hasActiveQB: boolean;
  activeQBs: Player[];
  startingQB?: Player;
  positionGroups: {
    qb: PositionGroupStatus;
    rb: PositionGroupStatus;
    wr: PositionGroupStatus;
    te: PositionGroupStatus;
    ol: PositionGroupStatus;
    dl: PositionGroupStatus;
    lb: PositionGroupStatus;
    cb: PositionGroupStatus;
    s: PositionGroupStatus;
    st: PositionGroupStatus;
  };
  allPositionGroupsFilled: boolean;
  missingPositionGroups: string[];
  isValid: boolean;
}

export interface ValidationCheckResult {
  id: number;
  name: string;
  passed: boolean;
  message: string;
  category: 'roster_integrity' | 'qb_coverage' | 'position_groups' | 'data_integrity' | 'starters';
  details?: string[];
}

export interface DatabaseValidationReport {
  timestamp: string;
  isValid: boolean;
  totalPlayers: number;
  totalTeams: number;
  passedCount: number;
  totalChecks: number;
  checks: ValidationCheckResult[];
  errors: string[];
  warnings: string[];
  teamAudits: TeamRosterAudit[];
  teamSummary: {
    totalTeams: number;
    teamsWithActiveQB: number;
    teamsWithAllGroupsFilled: number;
    all32TeamsValid: boolean;
  };
  keyFranchiseQBs: {
    name: string;
    team: string;
    found: boolean;
    player?: Player;
  }[];
  positionDistribution: Record<string, number>;
  teamPlayerCounts: Record<string, number>;
}

// Known retired or inactive players who must NOT appear as active roster players in 2026
export const RETIRED_OR_INACTIVE_PLAYERS = [
  'tom brady',
  'drew brees',
  'matt ryan',
  'ben roethlisberger',
  'philip rivers',
  'eli manning',
  'andrew luck',
  'aaron donald',
  'jason kelce',
  'fletcher cox',
  'jj watt',
  'j.j. watt',
  'rob gronkowski',
  'antonio brown',
  'julio jones',
  'richard sherman',
  'luke kuechly',
];

export const VALID_NFL_TEAM_CODES = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE',
  'DAL', 'DEN', 'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC',
  'LV', 'LAC', 'LAR', 'MIA', 'MIN', 'NE', 'NO', 'NYG',
  'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS'
];

export const MANDATORY_FRANCHISE_QBS = Object.entries(CURRENT_2026_QB_STARTERS).map(([team, name]) => ({
  name, team, pos: 'QB' as const,
}));

export const POSITION_GROUP_DEFINITIONS = [
  { group: 'qb', label: 'Quarterback (QB)', positions: ['QB'] },
  { group: 'rb', label: 'Running Back / FB (RB, FB)', positions: ['RB', 'FB'] },
  { group: 'wr', label: 'Wide Receiver (WR)', positions: ['WR'] },
  { group: 'te', label: 'Tight End (TE)', positions: ['TE'] },
  { group: 'ol', label: 'Offensive Line (OT, OG, C)', positions: ['OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'C'] },
  { group: 'dl', label: 'Defensive Line / EDGE (EDGE, DE, DT, NT)', positions: ['EDGE', 'DE', 'DT', 'NT'] },
  { group: 'lb', label: 'Linebacker (LB, ILB, OLB, MLB)', positions: ['LB', 'ILB', 'OLB', 'MLB'] },
  { group: 'cb', label: 'Cornerback (CB)', positions: ['CB'] },
  { group: 's', label: 'Safety (S, FS, SS)', positions: ['S', 'FS', 'SS'] },
  { group: 'st', label: 'Special Teams (K, P, LS)', positions: ['K', 'P', 'LS'] },
];

/**
 * Audits a single team's roster for active QBs and all position groups.
 */
export function auditTeamRoster(
  team: { code: string; name: string; city: string; conference: string; division: string },
  players: Player[]
): TeamRosterAudit {
  const teamPlayers = players.filter(p => p.team === team.code);
  const activeQBs = teamPlayers.filter(p => p.position === 'QB');
  const startingQB = activeQBs.find(p => p.starter) || activeQBs[0];
  const hasActiveQB = activeQBs.length > 0;

  const buildGroupStatus = (groupKey: string, label: string, positions: string[]): PositionGroupStatus => {
    const grpPlayers = teamPlayers.filter(p => positions.includes(p.position));
    return {
      group: groupKey,
      label,
      positions,
      count: grpPlayers.length,
      players: grpPlayers,
      isFilled: grpPlayers.length > 0,
    };
  };

  const positionGroups = {
    qb: buildGroupStatus('qb', 'Quarterback', ['QB']),
    rb: buildGroupStatus('rb', 'Running Backs', ['RB', 'FB']),
    wr: buildGroupStatus('wr', 'Wide Receivers', ['WR']),
    te: buildGroupStatus('te', 'Tight Ends', ['TE']),
    ol: buildGroupStatus('ol', 'Offensive Line', ['OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'C']),
    dl: buildGroupStatus('dl', 'Defensive Line / Edge', ['EDGE', 'DE', 'DT', 'NT']),
    lb: buildGroupStatus('lb', 'Linebackers', ['LB', 'ILB', 'OLB', 'MLB']),
    cb: buildGroupStatus('cb', 'Cornerbacks', ['CB']),
    s: buildGroupStatus('s', 'Safeties', ['S', 'FS', 'SS']),
    st: buildGroupStatus('st', 'Special Teams', ['K', 'P', 'LS']),
  };

  const missingPositionGroups: string[] = [];
  Object.values(positionGroups).forEach(grp => {
    if (!grp.isFilled) {
      missingPositionGroups.push(grp.label);
    }
  });

  const allPositionGroupsFilled = missingPositionGroups.length === 0;
  const isValid = hasActiveQB && allPositionGroupsFilled && teamPlayers.length >= 8;

  return {
    code: team.code,
    name: team.name,
    city: team.city,
    fullName: `${team.city} ${team.name}`,
    conference: team.conference,
    division: team.division,
    totalPlayers: teamPlayers.length,
    hasActiveQB,
    activeQBs,
    startingQB,
    positionGroups,
    allPositionGroupsFilled,
    missingPositionGroups,
    isValid,
  };
}

/**
 * Runs an automated integrity check on all team rosters and the master database.
 * Verifies every team has at least one active QB and every position group is filled.
 */
export function validateDatabase(
  players: Player[],
  teams: { code: string; name: string; city: string; conference: string; division: string }[]
): DatabaseValidationReport {
  const checks: ValidationCheckResult[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  // Generate complete audits for each of the 32 teams
  const teamAudits = teams.map(t => auditTeamRoster(t, players));

  // Check 1: Exactly 32 NFL teams exist
  const teamCodes = teams.map(t => t.code);
  const uniqueTeams = new Set(teamCodes);
  const check1Passed = uniqueTeams.size === 32 && teams.length === 32;
  checks.push({
    id: 1,
    name: 'Exactly 32 NFL Franchises Configured',
    passed: check1Passed,
    category: 'roster_integrity',
    message: check1Passed ? '32 / 32 NFL franchises verified' : `Found ${teams.length} teams (Expected 32)`,
  });
  if (!check1Passed) errors.push(`Team count mismatch: expected 32, got ${teams.length}`);

  // Check 2: Every team contains at least one active QB
  const teamsWithoutQB = teamAudits.filter(t => !t.hasActiveQB).map(t => t.code);
  const check2Passed = teamsWithoutQB.length === 0;
  checks.push({
    id: 2,
    name: 'Active QB on Every Team (32/32 Teams)',
    passed: check2Passed,
    category: 'qb_coverage',
    message: check2Passed
      ? 'All 32 NFL teams have at least one active QB on roster'
      : `Missing active QB for: ${teamsWithoutQB.join(', ')}`,
    details: teamsWithoutQB,
  });
  if (!check2Passed) errors.push(`Teams missing active QB: ${teamsWithoutQB.join(', ')}`);

  // Check 3: Every position group filled on every team
  const teamsWithMissingGroups = teamAudits.filter(t => !t.allPositionGroupsFilled);
  const check3Passed = teamsWithMissingGroups.length === 0;
  const missingGroupDetails = teamsWithMissingGroups.map(
    t => `${t.code}: missing ${t.missingPositionGroups.join(', ')}`
  );
  checks.push({
    id: 3,
    name: 'All 10 Position Groups Filled (32/32 Teams)',
    passed: check3Passed,
    category: 'position_groups',
    message: check3Passed
      ? 'All 32 teams have every position group filled (QB, RB, WR, TE, OL, DL, LB, CB, S, ST)'
      : `Incomplete position groups on ${teamsWithMissingGroups.length} teams`,
    details: missingGroupDetails,
  });
  if (!check3Passed) errors.push(`Teams with missing position groups: ${missingGroupDetails.join('; ')}`);

  // Check 4: Offensive depth on all teams (QB, RB, WR, TE, OL)
  const teamsWithWeakOffense = teamAudits.filter(t => {
    const p = t.positionGroups;
    return !p.qb.isFilled || !p.rb.isFilled || !p.wr.isFilled || !p.te.isFilled || !p.ol.isFilled;
  }).map(t => t.code);
  const check4Passed = teamsWithWeakOffense.length === 0;
  checks.push({
    id: 4,
    name: 'Complete Offensive Units (32/32 Teams)',
    passed: check4Passed,
    category: 'position_groups',
    message: check4Passed
      ? 'All 32 teams have complete offensive skill + line depth'
      : `Offensive deficits for: ${teamsWithWeakOffense.join(', ')}`,
    details: teamsWithWeakOffense,
  });
  if (!check4Passed) errors.push(`Teams with incomplete offensive units: ${teamsWithWeakOffense.join(', ')}`);

  // Check 5: Defensive depth on all teams (DL/EDGE, LB, CB, S)
  const teamsWithWeakDefense = teamAudits.filter(t => {
    const p = t.positionGroups;
    return !p.dl.isFilled || !p.lb.isFilled || !p.cb.isFilled || !p.s.isFilled;
  }).map(t => t.code);
  const check5Passed = teamsWithWeakDefense.length === 0;
  checks.push({
    id: 5,
    name: 'Complete Defensive Units (32/32 Teams)',
    passed: check5Passed,
    category: 'position_groups',
    message: check5Passed
      ? 'All 32 teams have complete defensive front + secondary depth'
      : `Defensive deficits for: ${teamsWithWeakDefense.join(', ')}`,
    details: teamsWithWeakDefense,
  });
  if (!check5Passed) errors.push(`Teams with incomplete defensive units: ${teamsWithWeakDefense.join(', ')}`);

  // Check 6: Special teams coverage (K / P)
  const teamsWithWeakST = teamAudits.filter(t => !t.positionGroups.st.isFilled).map(t => t.code);
  const check6Passed = teamsWithWeakST.length === 0;
  checks.push({
    id: 6,
    name: 'Special Teams Coverage (32/32 Teams)',
    passed: check6Passed,
    category: 'position_groups',
    message: check6Passed
      ? 'All 32 teams have designated active specialist / kicker'
      : `Special teams missing for: ${teamsWithWeakST.join(', ')}`,
    details: teamsWithWeakST,
  });
  if (!check6Passed) warnings.push(`Special teams missing for: ${teamsWithWeakST.join(', ')}`);

  // Check 7: No duplicate player IDs exist
  const idCounts = new Map<string, number>();
  const duplicateIds: string[] = [];
  players.forEach(p => {
    const c = (idCounts.get(p.id) || 0) + 1;
    idCounts.set(p.id, c);
    if (c === 2) duplicateIds.push(p.id);
  });
  const check7Passed = duplicateIds.length === 0;
  checks.push({
    id: 7,
    name: 'No Duplicate Player IDs',
    passed: check7Passed,
    category: 'data_integrity',
    message: check7Passed ? 'All player IDs are unique' : `Duplicate IDs found: ${duplicateIds.join(', ')}`,
    details: duplicateIds,
  });
  if (!check7Passed) errors.push(`Duplicate player IDs: ${duplicateIds.join(', ')}`);

  // Check 8: No duplicate franchise entries
  const duplicateTeams = teamCodes.filter((c, idx) => teamCodes.indexOf(c) !== idx);
  const check8Passed = duplicateTeams.length === 0;
  checks.push({
    id: 8,
    name: 'No Duplicate Franchise Entries',
    passed: check8Passed,
    category: 'data_integrity',
    message: check8Passed ? '32 unique franchise codes verified' : `Duplicate teams: ${duplicateTeams.join(', ')}`,
  });
  if (!check8Passed) errors.push(`Duplicate teams: ${duplicateTeams.join(', ')}`);

  // Check 9: Zero retired players on active roster
  const retiredFound: string[] = [];
  players.forEach(p => {
    const cleanName = (p.name || '').toLowerCase();
    RETIRED_OR_INACTIVE_PLAYERS.forEach(ret => {
      if (cleanName === ret || cleanName.includes(ret)) {
        retiredFound.push(`${p.name} (${p.team})`);
      }
    });
  });
  const check9Passed = retiredFound.length === 0;
  checks.push({
    id: 9,
    name: 'Zero Retired Players on Active Roster',
    passed: check9Passed,
    category: 'roster_integrity',
    message: check9Passed ? 'No retired players detected' : `Retired players found: ${retiredFound.join(', ')}`,
    details: retiredFound,
  });
  if (!check9Passed) errors.push(`Retired players on active rosters: ${retiredFound.join(', ')}`);

  // Check 10: All players mapped to valid NFL teams
  const invalidTeamPlayers: string[] = [];
  players.forEach(p => {
    if (!VALID_NFL_TEAM_CODES.includes(p.team)) {
      invalidTeamPlayers.push(`${p.name} (invalid team: ${p.team})`);
    }
  });
  const check10Passed = invalidTeamPlayers.length === 0;
  checks.push({
    id: 10,
    name: 'All Players Mapped to Valid NFL Teams',
    passed: check10Passed,
    category: 'data_integrity',
    message: check10Passed ? 'All players mapped to valid NFL franchises' : `Invalid teams for: ${invalidTeamPlayers.join(', ')}`,
  });
  if (!check10Passed) errors.push(`Players with invalid team codes: ${invalidTeamPlayers.join(', ')}`);

  // Key Individual Franchise QB Checks (Checks 11 - 20)
  const keyFranchiseQBs: DatabaseValidationReport['keyFranchiseQBs'] = [];

  const individualQBChecks = [
    { id: 11, name: 'Jalen Hurts exists under PHI', player: 'Jalen Hurts', team: 'PHI' },
    { id: 12, name: 'Dak Prescott exists under DAL', player: 'Dak Prescott', team: 'DAL' },
    { id: 13, name: 'Josh Allen exists under BUF', player: 'Josh Allen', team: 'BUF' },
    { id: 14, name: 'Lamar Jackson exists under BAL', player: 'Lamar Jackson', team: 'BAL' },
    { id: 15, name: 'Joe Burrow exists under CIN', player: 'Joe Burrow', team: 'CIN' },
    { id: 16, name: 'Patrick Mahomes exists under KC', player: 'Patrick Mahomes', team: 'KC' },
    { id: 17, name: 'Justin Herbert exists under LAC', player: 'Justin Herbert', team: 'LAC' },
    { id: 18, name: 'Jayden Daniels exists under WAS', player: 'Jayden Daniels', team: 'WAS' },
    { id: 19, name: 'Caleb Williams exists under CHI', player: 'Caleb Williams', team: 'CHI' },
    { id: 20, name: 'Brock Purdy exists under SF', player: 'Brock Purdy', team: 'SF' },
  ];

  individualQBChecks.forEach(ic => {
    const found = players.find(p =>
      p.team === ic.team &&
      p.position === 'QB' &&
      (p.name.toLowerCase().includes(ic.player.toLowerCase()) ||
       (p.lastName && ic.player.toLowerCase().includes(p.lastName.toLowerCase())))
    );
    const passed = !!found;
    checks.push({
      id: ic.id,
      name: ic.name,
      passed,
      category: 'starters',
      message: passed
        ? `Verified ${found?.name} (${ic.team} QB) — OVR: ${found?.ovr}, $${found?.salary}M`
        : `CRITICAL ERROR: ${ic.player} is missing from ${ic.team}!`,
    });
    keyFranchiseQBs.push({
      name: ic.player,
      team: ic.team,
      found: passed,
      player: found,
    });
    if (!passed) {
      errors.push(`CRITICAL OMISSION: ${ic.player} (${ic.team} QB) missing from database.`);
    }
  });

  // Check 21: 2026 NFL Roster Synchronization & Outdated Data Detection
  const currentStarterMismatches: string[] = [];
  Object.entries(CURRENT_2026_QB_STARTERS).forEach(([team, expectedName]) => {
    const starter = players.find(p => p.team === team && p.position === 'QB' && p.starter);
    if (!starter) {
      currentStarterMismatches.push(`${team}: no starting QB marked`);
    } else if (starter.name !== expectedName) {
      currentStarterMismatches.push(`${team}: ${starter.name} marked starter; expected ${expectedName}`);
    }
  });

  const check21Passed = currentStarterMismatches.length === 0;
  checks.push({
    id: 21,
    name: '2026 Starting QB Synchronization',
    passed: check21Passed,
    category: 'qb_coverage',
    message: check21Passed
      ? 'All 32 teams match the current 2026 starting-QB correction table'
      : `Starting-QB mismatches: ${currentStarterMismatches.join('; ')}`,
    details: currentStarterMismatches,
  });
  if (!check21Passed) errors.push(`2026 Starting QB mismatches: ${currentStarterMismatches.join('; ')}`);

  // Check 22: Player Identity & Dynamic Team Assignment Field Integrity
  const missingIdentityFields = players.filter(p => !p.id || !p.team || !p.position).map(p => p.name || 'Unnamed Player');
  const check22Passed = missingIdentityFields.length === 0;
  checks.push({
    id: 22,
    name: 'Player Identity vs Team Separation',
    passed: check22Passed,
    category: 'data_integrity',
    message: check22Passed
      ? 'All player records separate permanent identity (id) from franchise (teamId / team)'
      : `Missing required schema fields for ${missingIdentityFields.length} players`,
    details: missingIdentityFields,
  });
  if (!check22Passed) errors.push(`Players with missing schema fields: ${missingIdentityFields.join(', ')}`);

  // Calculate position distribution
  const positionDistribution: Record<string, number> = {};
  players.forEach(p => {
    positionDistribution[p.position] = (positionDistribution[p.position] || 0) + 1;
  });

  // Calculate team player counts
  const teamPlayerCounts: Record<string, number> = {};
  teams.forEach(t => {
    teamPlayerCounts[t.code] = players.filter(p => p.team === t.code).length;
  });

  const passedCount = checks.filter(c => c.passed).length;
  const teamsWithActiveQB = teamAudits.filter(t => t.hasActiveQB).length;
  const teamsWithAllGroupsFilled = teamAudits.filter(t => t.allPositionGroupsFilled).length;
  const all32TeamsValid = teamsWithActiveQB === 32 && teamsWithAllGroupsFilled === 32;

  const isValid = errors.length === 0 && passedCount === checks.length && all32TeamsValid;

  if (!isValid) {
    console.error('====================================================');
    console.error('🚨 ROSTER DATABASE VALIDATION FAILURES 🚨');
    console.error(`Passed: ${passedCount}/${checks.length} checks`);
    errors.forEach(err => console.error(' - ' + err));
    console.error('====================================================');
  } else {
    console.log(`✅ [DATABASE VALIDATOR] All 32 NFL teams verified: 100% QB coverage & all position groups filled (${players.length} players).`);
  }

  return {
    timestamp: new Date().toISOString(),
    isValid,
    totalPlayers: players.length,
    totalTeams: teams.length,
    passedCount,
    totalChecks: checks.length,
    checks,
    errors,
    warnings,
    teamAudits,
    teamSummary: {
      totalTeams: teams.length,
      teamsWithActiveQB,
      teamsWithAllGroupsFilled,
      all32TeamsValid,
    },
    keyFranchiseQBs,
    positionDistribution,
    teamPlayerCounts,
  };
}

/**
 * Helper to run automated roster check and return concise validation summary
 */
export function runAutomatedRosterCheck(
  players: Player[],
  teams: { code: string; name: string; city: string; conference: string; division: string }[]
): {
  isValid: boolean;
  totalTeams: number;
  teamsWithActiveQB: number;
  teamsWithAllGroupsFilled: number;
  totalPlayers: number;
  audits: TeamRosterAudit[];
} {
  const report = validateDatabase(players, teams);
  return {
    isValid: report.isValid,
    totalTeams: report.totalTeams,
    teamsWithActiveQB: report.teamSummary.teamsWithActiveQB,
    teamsWithAllGroupsFilled: report.teamSummary.teamsWithAllGroupsFilled,
    totalPlayers: report.totalPlayers,
    audits: report.teamAudits,
  };
}
