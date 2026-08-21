import { TEAM_THEMES } from './teamTheme';
import { Position } from './types';

export type MyPlayerStage = 'creator' | 'combine' | 'drafted' | 'season';

export type MyPlayerProfile = {
  version: 1;
  stage: MyPlayerStage;
  name: string;
  position: Position;
  number: number;
  faceImage: string;
  renderImage: string;
  appearancePrompt: string;
  teamAbbr: string;
  draftRound: number;
  draftPick: number;
  overall: number;
  xp: number;
  upgradePoints: number;
  gamesPlayed: number;
  speed: number;
  power: number;
  awareness: number;
  heightInches: number;
  weightLbs: number;
  bodyBuild: number;
  shoulderWidth: number;
  armSize: number;
  legSize: number;
  viewRotation: number;
};

export const MY_PLAYER_POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE', 'EDGE', 'LB', 'CB', 'S'];
const MY_PLAYER_STAGES: MyPlayerStage[] = ['creator', 'combine', 'drafted', 'season'];
const TEAM_ABBRS = new Set(TEAM_THEMES.map(team => team.abbr));

export const MY_PLAYER_EMPTY_PROFILE: MyPlayerProfile = {
  version: 1,
  stage: 'creator',
  name: '',
  position: 'WR',
  number: 17,
  faceImage: '',
  renderImage: '',
  appearancePrompt: '',
  teamAbbr: '',
  draftRound: 0,
  draftPick: 0,
  overall: 68,
  xp: 0,
  upgradePoints: 0,
  gamesPlayed: 0,
  speed: 78,
  power: 72,
  awareness: 65,
  heightInches: 72,
  weightLbs: 205,
  bodyBuild: 48,
  shoulderWidth: 52,
  armSize: 46,
  legSize: 50,
  viewRotation: 0,
};

type NumericRule = { min: number; max: number; integer?: boolean };

const NUMERIC_RULES: Record<keyof Pick<MyPlayerProfile,
  | 'number'
  | 'draftRound'
  | 'draftPick'
  | 'overall'
  | 'xp'
  | 'upgradePoints'
  | 'gamesPlayed'
  | 'speed'
  | 'power'
  | 'awareness'
  | 'heightInches'
  | 'weightLbs'
  | 'bodyBuild'
  | 'shoulderWidth'
  | 'armSize'
  | 'legSize'
  | 'viewRotation'
>, NumericRule> = {
  number: { min: 0, max: 99, integer: true },
  draftRound: { min: 0, max: 7, integer: true },
  draftPick: { min: 0, max: 32, integer: true },
  overall: { min: 0, max: 99, integer: true },
  xp: { min: 0, max: 99, integer: true },
  upgradePoints: { min: 0, max: 99, integer: true },
  gamesPlayed: { min: 0, max: 400, integer: true },
  speed: { min: 0, max: 99, integer: true },
  power: { min: 0, max: 99, integer: true },
  awareness: { min: 0, max: 99, integer: true },
  heightInches: { min: 66, max: 80, integer: true },
  weightLbs: { min: 165, max: 360, integer: true },
  bodyBuild: { min: 0, max: 100, integer: true },
  shoulderWidth: { min: 0, max: 100, integer: true },
  armSize: { min: 0, max: 100, integer: true },
  legSize: { min: 0, max: 100, integer: true },
  viewRotation: { min: -180, max: 180, integer: true },
};

const STRING_FIELDS: Array<keyof Pick<MyPlayerProfile,
  'name' | 'faceImage' | 'renderImage' | 'appearancePrompt' | 'teamAbbr'
>> = ['name', 'faceImage', 'renderImage', 'appearancePrompt', 'teamAbbr'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function numericFieldIsValid(source: Record<string, unknown>, key: keyof typeof NUMERIC_RULES) {
  if (!(key in source) || source[key] === undefined) return true;
  const value = source[key];
  const rule = NUMERIC_RULES[key];
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= rule.min
    && value <= rule.max
    && (!rule.integer || Number.isInteger(value));
}

export function normalizeMyPlayerSave(value: unknown): MyPlayerProfile | null {
  if (!isRecord(value) || value.version !== 1) return null;
  if (typeof value.position !== 'string' || !MY_PLAYER_POSITIONS.includes(value.position as Position)) return null;
  if (typeof value.stage !== 'string' || !MY_PLAYER_STAGES.includes(value.stage as MyPlayerStage)) return null;

  for (const field of STRING_FIELDS) {
    if (field in value && value[field] !== undefined && typeof value[field] !== 'string') return null;
  }
  for (const key of Object.keys(NUMERIC_RULES) as Array<keyof typeof NUMERIC_RULES>) {
    if (!numericFieldIsValid(value, key)) return null;
  }

  const stage = value.stage as MyPlayerStage;
  const teamAbbr = typeof value.teamAbbr === 'string' ? value.teamAbbr : '';
  if ((stage === 'drafted' || stage === 'season') && !TEAM_ABBRS.has(teamAbbr)) return null;

  const profile = { ...MY_PLAYER_EMPTY_PROFILE, ...value } as MyPlayerProfile;
  return profile;
}

export function parseMyPlayerSave(raw: string): MyPlayerProfile | null {
  try {
    return normalizeMyPlayerSave(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function isMyPlayerProfileCustomized(profile: MyPlayerProfile) {
  return Boolean(
    profile.name ||
    profile.faceImage ||
    profile.renderImage ||
    profile.appearancePrompt ||
    profile.position !== MY_PLAYER_EMPTY_PROFILE.position ||
    profile.number !== MY_PLAYER_EMPTY_PROFILE.number ||
    profile.heightInches !== MY_PLAYER_EMPTY_PROFILE.heightInches ||
    profile.weightLbs !== MY_PLAYER_EMPTY_PROFILE.weightLbs ||
    profile.bodyBuild !== MY_PLAYER_EMPTY_PROFILE.bodyBuild ||
    profile.shoulderWidth !== MY_PLAYER_EMPTY_PROFILE.shoulderWidth ||
    profile.armSize !== MY_PLAYER_EMPTY_PROFILE.armSize ||
    profile.legSize !== MY_PLAYER_EMPTY_PROFILE.legSize ||
    profile.viewRotation !== MY_PLAYER_EMPTY_PROFILE.viewRotation
  );
}
