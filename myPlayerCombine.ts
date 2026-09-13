import type {Position} from './types';
export type CombineProfile={name:string;position:Position;heightInches:number;weightLbs:number;bodyBuild:number;armSize:number;legSize:number};
function hash(value:string){let result=2166136261;for(let index=0;index<value.length;index++){result^=value.charCodeAt(index);result=Math.imul(result,16777619);}return result>>>0;}

export const calculateCombineResults = (profile: CombineProfile) => {
  const base = hash(`${profile.name}:${profile.position}:${profile.heightInches}:${profile.weightLbs}`);
  const sizePenalty = Math.max(0, profile.weightLbs - 215) / 180;
  const athleticBonus = (profile.bodyBuild < 60 ? 0.05 : 0) + (profile.legSize - 50) / 1800;
  const forty = Number(Math.max(4.25, 4.34 + (base % 42) / 100 + sizePenalty - athleticBonus).toFixed(2));
  const bench = Math.max(8, 12 + ((base >>> 4) % 18) + Math.round((profile.armSize + profile.bodyBuild - 90) / 12));
  const vertical = Math.max(27, 31 + ((base >>> 7) % 10) + Math.round((profile.legSize - 50) / 18));
  const speedValue = Math.max(0, Math.min(100, 100 - (forty - 4.25) * 105));
  const strengthValue = Math.max(0, Math.min(100, 35 + bench * 2.15));
  const explosionValue = Math.max(0, Math.min(100, 20 + vertical * 2));
  const positionWeights = ['QB','K','P'].includes(profile.position) ? [.25, .25, .5] : ['OT','OG','EDGE','DT','LB'].includes(profile.position) ? [.2, .55, .25] : [.55, .15, .3];
  const score = Math.round(speedValue * positionWeights[0] + strengthValue * positionWeights[1] + explosionValue * positionWeights[2]);
  return { forty, bench, vertical, score, label: score >= 90 ? 'ELITE' : score >= 80 ? 'RISER' : score >= 68 ? 'SOLID' : score >= 58 ? 'MIXED' : 'SLIPPING' };
};
