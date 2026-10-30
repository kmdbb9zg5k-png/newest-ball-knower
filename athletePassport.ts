import {sanitizeGameGear,type GameGear} from './public/play-moment-3d/game-gear.js';
import {cleanDraftCombine, draftDrillMark, type DraftDrill} from './myPlayerDraftCombine';
import {athleteMovement,sanitizeAthleteBuild,type AthleteBuild,type AthleteMovement} from './athleteBuild';
import {sanitizeAthleteAppearance,type AthleteAppearance} from './athleteAppearance';

// This is the existing career save, not a second athlete or a second progression ledger.
export const ATHLETE_SAVE_KEY = 'ballknower_solo_my_player_v2';
export const ATHLETE_CHANGED = 'ballknower:athlete-changed';
const positions = ['QB','RB','WR','TE','EDGE','LB','CB','S'];
const stages = ['creator','combine','drafted','camp','season'];
const count = (v:unknown,max=100000) => typeof v==='number'&&Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
const text = (v:unknown,max=80) => typeof v==='string'?v.trim().slice(0,max):'';
export type AthleteTrophy = {id:string;title:string;detail:string};
export type AthletePassport = {
 id:string;name:string;position:string;number:number;overall:number;stage:string;team:string;
 gameGear:GameGear;portrait:string;games:number;draft:string;build:AthleteBuild;movement:AthleteMovement;appearance:AthleteAppearance;marks:{id:string;label:string;value:string}[];trophies:AthleteTrophy[];
};
const labels:Record<DraftDrill,string>={dash:'40-yard dash','broad-jump':'Broad jump',shuttle:'20-yard shuttle',bench:'Bench press',routes:'Receiver routes',rb:'Running back',db:'Defensive back'};
export function athletePassport(raw:unknown):AthletePassport|null {
 if(!raw||typeof raw!=='object')return null;
 const p=raw as Record<string,any>;
 if(p.version!==1||!positions.includes(p.position)||!stages.includes(p.stage)||!text(p.name))return null;
 const marks=Object.entries(cleanDraftCombine(p.combinePerformance).results).map(([id,r])=>({id,label:labels[id as DraftDrill],value:draftDrillMark(id as DraftDrill,r!.best)}));
 const round=count(p.draftRound,7),pick=count(p.draftPick,32),drafted=['drafted','camp','season'].includes(p.stage);
 const draft=drafted?(round&&pick?`Round ${round} · Pick ${pick}`:'Undrafted signing'):'Draft ahead';
 const trophies:AthleteTrophy[]=[];
 if(marks.length)trophies.push({id:'first-tape',title:'First tape',detail:`${marks.length} recorded combine event${marks.length===1?'':'s'}`});
 if(drafted)trophies.push({id:'draft',title:round===1?'First-round selection':'Earned a roster opportunity',detail:draft});
 if(p.careerLife?.camp?.complete)trophies.push({id:'camp',title:'Camp graduate',detail:'Completed training-camp evaluations'});
 if(count(p.careerArc?.own?.firstStart)>0)trophies.push({id:'first-start',title:'First start',detail:'Earned a starting opportunity'});
 const seasons=Array.isArray(p.careerArc?.seasons)?p.careerArc.seasons:[];
 const championYears=new Set<number>();
 for(const season of seasons)if(season?.champion===true&&Number.isInteger(season.year)&&season.year>=2026&&season.year<=2200)championYears.add(season.year);
 for(const year of [...championYears].sort((a,b)=>a-b))trophies.push({id:`champion-${year}`,title:'Legacy Bowl champion',detail:`${year} season`});
 const awards=count(p.careerArc?.own?.awards,200);
 if(awards)trophies.push({id:'class-awards',title:'Draft-class honors',detail:`${awards} career award${awards===1?'':'s'}`});
 const games=count(p.gamesPlayed);
 if(games>=17)trophies.push({id:'17-games',title:'Seasoned pro',detail:`${games} career games played`});
 const build=sanitizeAthleteBuild(p);
 const appearance=sanitizeAthleteAppearance(p);
 return {gameGear:sanitizeGameGear(p.gameGear),id:text(p.combineId,120)||`legacy:${text(p.name)}:${p.position}`,name:text(p.name),position:p.position,number:count(p.number,99),overall:count(p.overall,99),stage:p.stage,team:text(p.teamAbbr,4),portrait:athletePortrait(p),games,draft,build,movement:athleteMovement(build),appearance,marks,trophies};
}
export function readAthletePassport():AthletePassport|null {
 try{return athletePassport(JSON.parse(localStorage.getItem(ATHLETE_SAVE_KEY)||'null'));}catch{return null;}
}

/** Cosmetic identity only: never replace a competitive simulation seed, position or ratings. */
export function withAthleteIdentity<T extends {name:string}>(athlete:T, identity:{id:string;name:string;number:number;build?:AthleteBuild;appearance?:AthleteAppearance}|null):T & {cosmeticIdentityId?:string;jerseyNumber?:number;heightInches?:number;weightLbs?:number;bodyBuild?:number;shoulderWidth?:number;armSize?:number;legSize?:number;athleteAppearance?:AthleteAppearance} {
 return identity?{...athlete,name:identity.name,jerseyNumber:identity.number,cosmeticIdentityId:`my-player-${identity.id}`,...(identity.build?{heightInches:identity.build.heightInches,weightLbs:identity.build.weightLbs,bodyBuild:identity.build.bodyBuild,shoulderWidth:identity.build.shoulderWidth,armSize:identity.build.armSize,legSize:identity.build.legSize}:{}),...(identity.appearance?{athleteAppearance:identity.appearance}:{})}:{...athlete};
}
export function careerAthleteIdentity(profile:{combineId?:string;name:string;number:number;position:string}&Partial<AthleteAppearance>&Partial<AthleteBuild>) {
 return {id:profile.combineId||`legacy:${profile.name}:${profile.position}`,name:profile.name,number:profile.number,build:sanitizeAthleteBuild(profile as Partial<AthleteBuild>),appearance:sanitizeAthleteAppearance(profile)};
}

type PortraitProfile={faceImage?:unknown;athletePortrait?:unknown;portraitSource?:unknown;presetFaceId?:unknown};
/** Older saves only identify explicit selections when they differ from the Malik default. */
export function usesPresetAthletePortrait(profile:PortraitProfile):boolean {
 return ['mason','nico','malik','darius'].includes(String(profile.presetFaceId))&&
  (profile.portraitSource==='preset'||profile.portraitSource===undefined&&profile.presetFaceId!=='malik');
}
/** Only explicitly selected portraits or the creator's actual rendered athlete. */
export function athletePortrait(profile:PortraitProfile):string {
 const safe=(v:unknown)=>typeof v==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)&&v.length<2000000?v:'';
 return safe(profile.faceImage)||(usesPresetAthletePortrait(profile)?`/solo-characters/v2/my-player-presets/${profile.presetFaceId}/portrait.webp`:safe(profile.athletePortrait));
}
