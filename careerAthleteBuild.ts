import {athleteMovement,sanitizeAthleteBuild,type AthleteBuild} from './athleteBuild';
import {type DraftCombinePerformance} from './myPlayerDraftCombine';

type CareerBuild=AthleteBuild&{stage:string;speed:number;power:number;buildMovementApplied?:boolean;combinePerformance?:DraftCombinePerformance;renderImage:string};
const clamp=(value:number)=>Math.max(45,Math.min(99,Math.round(value)));
/** Rebase physique ratings once, preserving earned story bonuses and later upgrades. */
export function applyCareerBuild<T extends CareerBuild>(current:T,patch:Partial<T>={}):T {
 const next={...current,...patch,...sanitizeAthleteBuild({...current,...patch})};
 const before=athleteMovement(current),after=athleteMovement(next);
 // Active career upgrades remain authoritative; physique rebasing is pre-draft only.
 if(!['creator','combine'].includes(current.stage))return next;
 return {...next,
  speed:clamp(after.speed+current.speed-(current.buildMovementApplied?before.speed:78)),
  power:clamp(after.strength+current.power-(current.buildMovementApplied?before.strength:72)),
  buildMovementApplied:true,
  renderImage:Object.keys(patch).some(key=>!['name','athletePortrait'].includes(key))?'':current.renderImage,
 };
}
