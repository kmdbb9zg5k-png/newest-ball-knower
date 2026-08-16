export type Position =
  | 'QB'
  | 'RB'
  | 'FB'
  | 'WR'
  | 'TE'
  | 'OT'
  | 'LT'
  | 'RT'
  | 'OG'
  | 'LG'
  | 'RG'
  | 'C'
  | 'EDGE'
  | 'DT'
  | 'DE'
  | 'NT'
  | 'LB'
  | 'CB'
  | 'S'
  | 'FS'
  | 'SS'
  | 'K'
  | 'P';

export type PositionGroup =
  | 'QB'
  | 'RB'
  | 'WR'
  | 'TE'
  | 'OL'
  | 'EDGE'
  | 'DL'
  | 'DL_EDGE'
  | 'LB'
  | 'CB'
  | 'S'
  | 'K'
  | 'P'
  | 'SPECIAL_TEAMS'
  | 'OFFENSE'
  | 'DEFENSE'
  | 'ALL';

export interface PlayerRatingRecord {
  playerId: string;
  fullName: string;
  team: string;
  position: Position;
  overallRating: number;
  ratingSource: 'EA SPORTS Madden';
  ratingSeason: number | string;
  lastUpdated: string;
  ratingStatus: 'VERIFIED' | 'RATING_REVIEW_REQUIRED';
  previousOvr?: number;
}

export interface Player {
  id: string; // Permanent Unique Player Identity (e.g. 'p-jalen-hurts', 'p-saquon-barkley')
  playerId?: string; // Standardized Player ID alias
  teamId?: string; // Current Franchise Code (e.g. 'PHI', 'KC', 'BAL') or 'FA' for Free Agent
  team: string; // Synced current team abbreviation
  name: string; // Full display name e.g. 'Jalen Hurts'
  firstName?: string;
  lastName?: string;
  fullName?: string;
  teamAbbreviation?: string;
  teamCity: string;
  teamName?: string;
  conference?: 'AFC' | 'NFC';
  division?: 'East' | 'North' | 'South' | 'West';
  position: Position;
  positionGroup?: PositionGroup;
  jerseyNumber?: number;
  age?: number;
  experience?: number;
  starterStatus?: 'starter' | 'backup' | 'rotational' | 'projected_starter';
  starter?: boolean;
  projectedStarter?: boolean;
  active?: boolean;
  isFreeAgent?: boolean;
  previousTeamId?: string;
  rosterSeason?: number;
  rosterLastUpdated?: string;
  injured?: boolean;
  depthChartOrder?: number;
  ovr: number; // 0 - 99 (synced alias to overallRating)
  overallRating?: number; // 0 - 99 Single Source of Truth EA SPORTS Madden OVR (guaranteed on normalized players)
  overall?: number; // alias for ovr
  ratingSource?: 'EA SPORTS Madden' | string; // Centralized Source of Truth
  ratingSeason?: number | string; // 2026 / 'CURRENT'
  lastUpdated?: string; // ISO timestamp
  ratingStatus?: 'VERIFIED' | 'RATING_REVIEW_REQUIRED';
  legacyRatingRemoved?: boolean;
  previousRating?: number;
  salary: number; // 2026 cap hit in millions when salaryType === 'cap_hit'
  salaryType?: 'cap_hit' | 'estimated';
  salarySeason?: number;
  salarySource?: 'Spotrac' | 'Over The Cap' | 'legacy_estimate' | string;
  salaryLastUpdated?: string;
  archetype?: string;
  speed?: number;
  strength?: number;
  awareness?: number;
  positionSpecificRatings?: Record<string, number>;
  attributes: {
    passing?: number;
    rushing?: number;
    receiving?: number;
    passBlocking?: number;
    runBlocking?: number;
    passRush?: number;
    runDefense?: number;
    coverage?: number;
    kicking?: number;
    athleticism: number;
    footballIQ: number;
    throwPower?: number;
    shortAccuracy?: number;
    mediumAccuracy?: number;
    deepAccuracy?: number;
    pocketPresence?: number;
    decisionMaking?: number;
    mobility?: number;
    playAction?: number;
    throwUnderPressure?: number;
  };
  highlightStat?: string;
}

export interface RatingsValidationReport {
  totalPlayersChecked: number;
  ratingsVerifiedCount: number;
  ratingsUpdatedCount: number;
  ratingsUnchangedCount: number;
  missingRatingsCount: number;
  legacyRatingsRemovedCount: number;
  playersRequiringReviewCount: number;
  ratingSource: string;
  ratingSeason: string | number;
  lastAuditTimestamp: string;
  isValid: boolean;
  highestRatedPlayers: Player[];
  lowestRatedPlayers: Player[];
  flaggedErrors: string[];
  flaggedWarnings: string[];
  maddenClub99: Player[];
}

export interface RosterRequirements {
  QB: number; RB: number; WR: number; TE: number; OL: number;
  DL_EDGE: number; LB: number; CB: number; S: number; K: number; P: number;
}

export const ROSTER_REQUIREMENTS: RosterRequirements = {
  QB: 1, RB: 1, WR: 2, TE: 1, OL: 4,
  DL_EDGE: 3, LB: 2, CB: 2, S: 2, K: 1, P: 1,
};

export const TOTAL_ROSTER_SIZE = 20;
export const DEFAULT_SALARY_CAP = 301.2; // Official 2026 NFL cap in millions

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface TeamRatings {
  overall: number;
  offense: number;
  defense: number;
  passing: number;
  rushing: number;
  passProtection: number;
  runBlocking: number;
  passRush: number;
  runDefense: number;
  coverage: number;
  balanceScore: number;
  efficiencyRating: number; // value per million spent
  penalties: string[];
  strengths: string[];
}

export interface PositionGrade {
  position: string;
  grade: 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D' | 'F';
  score: number;
  comment: string;
}

export interface TeamReportAnalysis {
  memberId: string;
  memberName: string;
  teamRatings: TeamRatings;
  whatYouDidWell: string[];
  whatCostYou: string[];
  bestValuePick: {
    player: Player;
    reason: string;
  };
  worstValuePick: {
    player: Player;
    reason: string;
  };
  biggestWeakness: string;
  positionGrades: PositionGrade[];
}

export interface SimulationGame {
  id: string;
  week: number;
  homeMemberId: string;
  awayMemberId: string;
  homeScore: number;
  awayScore: number;
  winnerId: string;
  loserId: string;
  isTie: boolean;
  keyMatchupFactor: string;
  quarterScores?: {
    home: [number, number, number, number];
    away: [number, number, number, number];
  };
}

export interface StandingItem {
  rank: number;
  memberId: string;
  memberName: string;
  memberAvatar?: string;
  isAi?: boolean;
  wins: number;
  losses: number;
  ties: number;
  winPercentage: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  teamRating: number;
  ballKnowerScore?: number;
  streak: string;
}

export interface DraftOrderItem {
  pickNumber: number;
  memberId: string;
  memberName: string;
  memberAvatar?: string;
  isAi?: boolean;
  record: string;
  pointDiff: number;
  teamRating: number;
  badge?: string;
}

export interface WinnerAnalysis {
  winnerId: string;
  winnerName: string;
  summary: string;
  keyFactors: string[];
}

export interface SeasonResult {
  completedAt: string;
  standings: StandingItem[];
  games: SimulationGame[];
  draftOrder: DraftOrderItem[];
  winnerAnalysis: WinnerAnalysis;
  teamReports: Record<string, TeamReportAnalysis>;
}

export interface LeagueMember {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  isCommissioner: boolean;
  isAi?: boolean;
  aiArchetype?: string;
  status: 'not_started' | 'building' | 'ready';
  roster?: Player[];
  teamRatings?: TeamRatings;
  submittedAt?: string;
}

export interface LeagueSettings {
  seasonGames?: 16 | 17;
  simulationStyle?: 'realistic' | 'balanced' | 'chaos';
  playoffTeams?: 4 | 6 | 8;
  injuriesEnabled?: boolean;
  aiDifficulty?: 'pro' | 'all_pro' | 'all_madden';
}

export interface League {
  id: string;
  code: string; // BK-92741
  name: string;
  maxMembers: number; // 6, 8, 10, 12, 14, 16
  salaryCap: number; // default 200
  commissionerId: string;
  commissionerName: string;
  status: 'drafting' | 'simulating' | 'completed';
  members: LeagueMember[];
  seasonResult?: SeasonResult;
  createdAt: string;
  settings?: LeagueSettings;
}

export interface RosterMismatch {
  playerId: string;
  playerName: string;
  ballKnowerTeam: string;
  current2026Team: string;
  position: string;
  action: 'UPDATE REQUIRED' | 'SYNCHRONIZED' | 'RESOLVED';
  reason: string;
}

export interface RosterMigrationReport {
  title: string;
  season: number;
  rosterLastUpdated: string;
  teamsScanned: number;
  playersCompared: number;
  playersMovedToNewTeam: number;
  newPlayersAdded: number;
  playersRemovedInactive: number;
  freeAgentsIdentified: number;
  duplicatePlayers: number;
  invalidTeamAssignments: number;
  teamsPassingValidation: number;
  rosterStatus: 'CURRENT 2026 DATABASE ✓' | 'FAILED';
  mismatchesDetected: RosterMismatch[];
  migrationLog: string[];
}
