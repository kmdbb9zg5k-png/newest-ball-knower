import type {Position} from './types';

export type AthleteBuild = {
  position:Position;heightInches:number;weightLbs:number;bodyBuild:number;
  shoulderWidth:number;armSize:number;legSize:number;bodyPresetId:string;
};
export type AthleteMovement = {speed:number;acceleration:number;agility:number;strength:number;contact:number;stamina:number};
type Limits={height:[number,number];weight:[number,number];recommended:[number,number]};

export const ATHLETE_POSITIONS:Position[]=['QB','RB','WR','TE','EDGE','LB','CB','S'];
export const POSITION_LIMITS:Record<string,Limits>={
  QB:{height:[68,79],weight:[180,265],recommended:[74,220]}, RB:{height:[65,75],weight:[170,250],recommended:[70,210]},
  WR:{height:[66,80],weight:[165,245],recommended:[72,195]}, TE:{height:[70,81],weight:[215,290],recommended:[76,250]},
  EDGE:{height:[70,81],weight:[225,320],recommended:[76,265]}, LB:{height:[68,79],weight:[205,285],recommended:[73,235]},
  CB:{height:[65,77],weight:[160,225],recommended:[71,188]}, S:{height:[66,78],weight:[175,240],recommended:[72,205]},
};
export const BODY_PRESETS=[
  {id:'lean',label:'LEAN',detail:'Long-stride speed',bodyBuild:24,shoulderWidth:36,armSize:30,legSize:38,weightOffset:-24},
  {id:'compact',label:'COMPACT',detail:'Low center of gravity',bodyBuild:46,shoulderWidth:52,armSize:48,legSize:62,weightOffset:-4},
  {id:'balanced',label:'BALANCED',detail:'All-around frame',bodyBuild:50,shoulderWidth:54,armSize:48,legSize:52,weightOffset:0},
  {id:'muscular',label:'MUSCULAR',detail:'Burst and contact',bodyBuild:70,shoulderWidth:72,armSize:70,legSize:68,weightOffset:22},
  {id:'heavy',label:'HEAVY',detail:'Maximum power',bodyBuild:90,shoulderWidth:88,armSize:78,legSize:84,weightOffset:54},
] as const;

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,Math.round(Number.isFinite(value)?value:min)));
export const limitsFor=(position:string)=>POSITION_LIMITS[position]||POSITION_LIMITS.WR;
export function sanitizeAthleteBuild(value:Partial<AthleteBuild>&{position?:Position}):AthleteBuild{
  const position=ATHLETE_POSITIONS.includes(value.position as Position)?value.position as Position:'WR';
  const limits=limitsFor(position);
  return {position,heightInches:clamp(value.heightInches??limits.recommended[0],...limits.height),weightLbs:clamp(value.weightLbs??limits.recommended[1],...limits.weight),bodyBuild:clamp(value.bodyBuild??50,0,100),shoulderWidth:clamp(value.shoulderWidth??54,0,100),armSize:clamp(value.armSize??48,0,100),legSize:clamp(value.legSize??52,0,100),bodyPresetId:typeof value.bodyPresetId==='string'?value.bodyPresetId:'balanced'};
}
export function presetAthleteBuild(position:Position,preset:typeof BODY_PRESETS[number]):AthleteBuild{
  const limits=limitsFor(position),[height,weight]=limits.recommended;
  return sanitizeAthleteBuild({position,heightInches:height+(preset.id==='lean'?1:preset.id==='compact'?-1:preset.id==='heavy'?1:0),weightLbs:weight+preset.weightOffset,bodyBuild:preset.bodyBuild,shoulderWidth:preset.shoulderWidth,armSize:preset.armSize,legSize:preset.legSize,bodyPresetId:preset.id});
}
export const recommendedAthleteBuild=(position:Position)=>presetAthleteBuild(position,BODY_PRESETS[2]);
export function athleteMovement(value:Partial<AthleteBuild>&{position?:Position},competitive=false):AthleteMovement{
  if(competitive)return{speed:85,acceleration:85,agility:85,strength:85,contact:85,stamina:85};
  const build=sanitizeAthleteBuild(value),limits=limitsFor(build.position);
  const weight=(build.weightLbs-limits.weight[0])/(limits.weight[1]-limits.weight[0]);
  const height=(build.heightInches-limits.height[0])/(limits.height[1]-limits.height[0]);
  const muscle=(build.bodyBuild+build.armSize+build.legSize+build.shoulderWidth)/400;
  const rate=(n:number)=>clamp(n,60,96);
  return {speed:rate(94-weight*18-height*2+build.legSize*.025),acceleration:rate(94-weight*16-height*3+build.legSize*.035),agility:rate(95-weight*17-height*4+(100-build.bodyBuild)*.025),strength:rate(64+weight*19+muscle*13),contact:rate(65+weight*16+muscle*14+build.shoulderWidth*.025),stamina:rate(91-weight*9+(100-build.bodyBuild)*.02)};
}
export const feetAndInches=(inches:number)=>`${Math.floor(inches/12)}'${inches%12}\"`;
