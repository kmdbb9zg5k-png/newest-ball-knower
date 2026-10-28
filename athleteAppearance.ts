import type {TattooCoverage,TattooStyle} from './solo/appearance';
import type {SimulatedFacialHair,SimulatedHairStyle,SimulatedSkinTone} from './solo/artIdentity';

export type AthleteHairColor='black'|'dark brown'|'brown'|'auburn'|'blond';
export type AthleteAppearance={
  skinTone:SimulatedSkinTone;
  hairStyle:SimulatedHairStyle;
  hairColor:AthleteHairColor;
  facialHair:SimulatedFacialHair;
  tattooCoverage:TattooCoverage;
  tattooStyle:TattooStyle;
};

export const SKIN_TONES=[
  {id:'deep ebony',label:'Deep',color:'#51352b'},
  {id:'dark brown',label:'Dark',color:'#684330'},
  {id:'rich brown',label:'Rich',color:'#805338'},
  {id:'medium brown',label:'Medium',color:'#986340'},
  {id:'warm brown',label:'Warm',color:'#ae764e'},
  {id:'olive brown',label:'Olive',color:'#ac815b'},
  {id:'golden tan',label:'Golden',color:'#c79265'},
  {id:'light olive',label:'Light olive',color:'#c9a17c'},
  {id:'warm beige',label:'Beige',color:'#d8ad88'},
  {id:'fair',label:'Fair',color:'#e6bea2'},
] as const;
export const HAIR_STYLES=[
  'shaved','bald','low fade','high fade','waves','short curls','medium curls','braids',
  'cornrows','short twists','long twists','short locs','medium locs','tapered afro','crew cut','textured crop',
] as const;
export const HAIR_COLORS=[
  {id:'black',label:'Black',color:'#14100e'},
  {id:'dark brown',label:'Dark brown',color:'#281b15'},
  {id:'brown',label:'Brown',color:'#4a2f21'},
  {id:'auburn',label:'Auburn',color:'#653422'},
  {id:'blond',label:'Blond',color:'#977448'},
] as const;
export const FACIAL_HAIR=['clean shaven','light stubble','short boxed beard','full beard','goatee','mustache'] as const;
export const TATTOO_COVERAGE:TattooCoverage[]=['none','minimal','upper-arm','forearm','half-sleeve','full-sleeve','both-arms'];
export const TATTOO_STYLES:TattooStyle[]=['blackwork','geometric','script','traditional','mixed'];
export const DEFAULT_ATHLETE_APPEARANCE:AthleteAppearance={skinTone:'warm brown',hairStyle:'low fade',hairColor:'black',facialHair:'clean shaven',tattooCoverage:'none',tattooStyle:'blackwork'};

const oneOf=<T extends string>(value:unknown,allowed:readonly T[],fallback:T):T=>allowed.includes(value as T)?value as T:fallback;
export function sanitizeAthleteAppearance(value:unknown):AthleteAppearance{
  const raw=value&&typeof value==='object'?value as Record<string,unknown>:{};
  return{
    skinTone:oneOf(raw.skinTone,SKIN_TONES.map(item=>item.id),DEFAULT_ATHLETE_APPEARANCE.skinTone),
    hairStyle:oneOf(raw.hairStyle,HAIR_STYLES,DEFAULT_ATHLETE_APPEARANCE.hairStyle),
    hairColor:oneOf(raw.hairColor,HAIR_COLORS.map(item=>item.id),DEFAULT_ATHLETE_APPEARANCE.hairColor),
    facialHair:oneOf(raw.facialHair,FACIAL_HAIR,DEFAULT_ATHLETE_APPEARANCE.facialHair),
    tattooCoverage:oneOf(raw.tattooCoverage,TATTOO_COVERAGE,DEFAULT_ATHLETE_APPEARANCE.tattooCoverage),
    tattooStyle:oneOf(raw.tattooStyle,TATTOO_STYLES,DEFAULT_ATHLETE_APPEARANCE.tattooStyle),
  };
}

export const athleteTattooProfile=(coverage:TattooCoverage):'none'|'minimal'|'one arm'|'half sleeve'|'full sleeve'|'both arms'=>
  coverage==='none'?'none':coverage==='minimal'?'minimal':coverage==='both-arms'?'both arms':coverage==='half-sleeve'?'half sleeve':coverage==='full-sleeve'?'full sleeve':'one arm';
