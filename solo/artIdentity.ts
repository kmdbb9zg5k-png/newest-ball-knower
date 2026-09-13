import type { Player, Position } from '../types';
import type { AppearancePlayer, BodyBuild } from './appearance';
import { CREATOR_EASTER_EGG_ID, appearanceSeed } from './appearance';

export const SIMULATED_ART_VERSION = 4 as const;
export const SIMULATED_ART_BUCKET = 'ball-knower-simulated-player-art';

export type SimulatedSkinTone =
  | 'deep ebony' | 'dark brown' | 'rich brown' | 'medium brown' | 'warm brown'
  | 'olive brown' | 'golden tan' | 'light olive' | 'warm beige' | 'fair';
export type SimulatedHairStyle =
  | 'shaved' | 'bald' | 'low fade' | 'high fade' | 'waves' | 'short curls'
  | 'medium curls' | 'braids' | 'cornrows' | 'short twists' | 'long twists'
  | 'short locs' | 'medium locs' | 'tapered afro' | 'crew cut' | 'textured crop';
export type SimulatedFacialHair =
  | 'clean shaven' | 'light stubble' | 'heavy stubble' | 'short boxed beard'
  | 'full beard' | 'goatee' | 'mustache' | 'beard and mustache';
export type SimulatedBodyArchetype =
  | 'lean skill' | 'compact skill' | 'balanced quarterback' | 'large athletic'
  | 'edge power' | 'linebacker power' | 'offensive line' | 'interior defensive line'
  | 'specialist';

export type SimulatedPlayerIdentity = {
  version: typeof SIMULATED_ART_VERSION;
  playerId: string;
  identitySeed: number;
  approximateAge: number;
  skinTone: SimulatedSkinTone;
  hairStyle: SimulatedHairStyle;
  hairColor: 'black' | 'dark brown' | 'brown' | 'auburn' | 'blond';
  facialHair: SimulatedFacialHair;
  faceShape: 'oval' | 'square' | 'round' | 'long' | 'heart' | 'diamond';
  eyeColor: 'dark brown' | 'brown' | 'hazel' | 'green' | 'blue';
  bodyArchetype: SimulatedBodyArchetype;
  heightInches: number;
  weightLbs: number;
  tattooProfile: 'none' | 'minimal' | 'one arm' | 'half sleeve' | 'full sleeve' | 'both arms';
  accessoryProfile: 'none' | 'gloves' | 'arm sleeve' | 'gloves and sleeve' | 'eye black and gloves';
  distinguishingDetail: string;
  lockedReference: 'eli-rodriguez-approved-face' | null;
};

const SKIN_TONES: SimulatedSkinTone[] = ['deep ebony','dark brown','rich brown','medium brown','warm brown','olive brown','golden tan','light olive','warm beige','fair'];
const HAIR_STYLES: SimulatedHairStyle[] = ['shaved','bald','low fade','high fade','waves','short curls','medium curls','braids','cornrows','short twists','long twists','short locs','medium locs','tapered afro','crew cut','textured crop'];
const FACIAL_HAIR: SimulatedFacialHair[] = ['clean shaven','light stubble','heavy stubble','short boxed beard','full beard','goatee','mustache','beard and mustache'];
const FACE_SHAPES: SimulatedPlayerIdentity['faceShape'][] = ['oval','square','round','long','heart','diamond'];
const EYE_COLORS: SimulatedPlayerIdentity['eyeColor'][] = ['dark brown','brown','hazel','green','blue'];
const DETAILS = ['slight eyebrow notch','subtle cheek scar','pronounced dimples','high cheekbones','broad nose bridge','narrow nose bridge','strong jawline','soft jawline','freckled cheeks','slightly crooked smile','close-set eyes','wide-set eyes'];

const POSITION_MEASUREMENTS: Record<string, { height:[number,number]; weight:[number,number]; body:SimulatedBodyArchetype }> = {
  QB:{height:[72,78],weight:[205,245],body:'balanced quarterback'},
  RB:{height:[67,73],weight:[195,235],body:'compact skill'},
  FB:{height:[69,74],weight:[230,265],body:'large athletic'},
  WR:{height:[68,77],weight:[170,225],body:'lean skill'},
  TE:{height:[75,79],weight:[240,275],body:'large athletic'},
  LT:{height:[76,81],weight:[300,380],body:'offensive line'},RT:{height:[76,81],weight:[300,380],body:'offensive line'},
  LG:{height:[73,79],weight:[295,365],body:'offensive line'},RG:{height:[73,79],weight:[295,365],body:'offensive line'},
  C:{height:[72,78],weight:[290,350],body:'offensive line'},OT:{height:[76,81],weight:[300,380],body:'offensive line'},OG:{height:[73,79],weight:[295,365],body:'offensive line'},
  EDGE:{height:[73,79],weight:[235,285],body:'edge power'},DE:{height:[73,79],weight:[255,310],body:'edge power'},
  DT:{height:[71,77],weight:[285,345],body:'interior defensive line'},NT:{height:[71,77],weight:[315,385],body:'interior defensive line'},
  LB:{height:[71,77],weight:[225,270],body:'linebacker power'},
  CB:{height:[68,75],weight:[170,210],body:'lean skill'},S:{height:[69,75],weight:[185,225],body:'compact skill'},
  FS:{height:[69,75],weight:[185,225],body:'compact skill'},SS:{height:[69,75],weight:[195,235],body:'compact skill'},
  K:{height:[68,76],weight:[170,220],body:'specialist'},P:{height:[70,78],weight:[185,235],body:'specialist'},
};

const between = (seed:number, min:number, max:number, shift:number) => min + ((seed >>> shift) % (max - min + 1));

export function bodyBuildForIdentity(identity: SimulatedPlayerIdentity): BodyBuild {
  if (identity.bodyArchetype === 'offensive line' || identity.bodyArchetype === 'interior defensive line') return 'heavy';
  if (['edge power','linebacker power'].includes(identity.bodyArchetype)) return 'power';
  if (identity.bodyArchetype === 'lean skill' || identity.bodyArchetype === 'specialist') return 'lean';
  return 'athletic';
}

export function simulatedPlayerIdentity(player: AppearancePlayer & Partial<Pick<Player,'age'|'heightInches'|'weightLbs'>>): SimulatedPlayerIdentity {
  if (player.id === CREATOR_EASTER_EGG_ID) {
    return {
      version:SIMULATED_ART_VERSION,playerId:player.id,identitySeed:appearanceSeed(player.id),approximateAge:30,
      skinTone:'warm brown',hairStyle:'low fade',hairColor:'black',facialHair:'full beard',faceShape:'diamond',eyeColor:'dark brown',
      bodyArchetype:'compact skill',heightInches:69,weightLbs:190,tattooProfile:'full sleeve',accessoryProfile:'eye black and gloves',
      distinguishingDetail:'approved creator likeness with sharp hairline and shaped beard',lockedReference:'eli-rodriguez-approved-face',
    };
  }
  const seed=appearanceSeed(player.id);const measurements=POSITION_MEASUREMENTS[player.position]??POSITION_MEASUREMENTS.WR;
  const skinTone=SKIN_TONES[seed%SKIN_TONES.length];
  const hairStyle=HAIR_STYLES[(seed>>>4)%HAIR_STYLES.length];
  const hairColor:SimulatedPlayerIdentity['hairColor']=skinTone==='fair'?(['black','dark brown','brown','auburn','blond'] as const)[(seed>>>9)%5]:(seed%7===0?'dark brown':'black');
  const heightInches=Number.isFinite(player.heightInches)?Math.round(player.heightInches!):between(seed,measurements.height[0],measurements.height[1],8);
  const weightLbs=Number.isFinite(player.weightLbs)?Math.round(player.weightLbs!):between(seed,measurements.weight[0],measurements.weight[1],15);
  return {
    version:SIMULATED_ART_VERSION,playerId:player.id,identitySeed:seed,
    approximateAge:Number.isFinite(player.age)?Math.round(player.age!):between(seed,21,35,20),
    skinTone,hairStyle,hairColor,facialHair:FACIAL_HAIR[(seed>>>12)%FACIAL_HAIR.length],
    faceShape:FACE_SHAPES[(seed>>>16)%FACE_SHAPES.length],eyeColor:EYE_COLORS[(seed>>>19)%EYE_COLORS.length],
    bodyArchetype:measurements.body,heightInches,weightLbs,
    tattooProfile:(['none','none','minimal','one arm','half sleeve','full sleeve','both arms'] as const)[(seed>>>22)%7],
    accessoryProfile:(['none','gloves','arm sleeve','gloves and sleeve','eye black and gloves'] as const)[(seed>>>25)%5],
    distinguishingDetail:DETAILS[(seed>>>6)%DETAILS.length],lockedReference:null,
  };
}

/** The fingerprint intentionally excludes team, season, rating and uniform. */
export function simulatedIdentityFingerprint(player: Parameters<typeof simulatedPlayerIdentity>[0]): string {
  const identity=simulatedPlayerIdentity(player);
  return [identity.version,identity.playerId,identity.identitySeed,identity.approximateAge,identity.skinTone,identity.hairStyle,identity.hairColor,identity.facialHair,identity.faceShape,identity.eyeColor,identity.bodyArchetype,identity.heightInches,identity.weightLbs,identity.tattooProfile,identity.accessoryProfile,identity.distinguishingDetail,identity.lockedReference??''].join('|');
}

export function fictionalUniformPrompt(player: Pick<AppearancePlayer,'team'|'teamName'>, number:number, variant:'home'|'away'|'alternate'='home') {
  return `${player.teamName || player.team || 'Ball Knower Training'} fictional professional football ${variant} uniform, jersey number ${number}; no NFL, real-team, league, sponsor, or manufacturer logos`;
}

export function isSupportedSimulatedPlayerId(value:string) {
  return /^(solo-[a-z0-9-]{3,80}|bk-001-eli-rodriguez|franchise-rookie-[a-z0-9-]{3,100}|my-player-[a-z0-9-]{3,100})$/.test(value);
}

export function positionForArt(value:string):Position {
  const allowed:Position[]=['QB','RB','FB','WR','TE','OT','LT','RT','OG','LG','RG','C','EDGE','DT','DE','NT','LB','CB','S','FS','SS','K','P'];
  return allowed.includes(value as Position)?value as Position:'WR';
}
