import type {Position} from './types';
import {journeyHash} from './myPlayerJourney';
export type CareerFieldConfig={seed:number;title:string;opponent:string};
export function careerFieldAssignment(position:Position){
 if(position==='QB')return {kind:'drive' as const,title:'Two-minute showcase',detail:'Take team control in a 3D two-minute game. Jersey City trails Brooklyn 23–27. Your team’s yards, new points and turnovers determine your evaluation. This showcase is separate from your scheduled season game.'};
 if(position==='RB')return {kind:'rb' as const,title:'Beat the last defender',detail:'Three live 3D runs against a linebacker. Steer, juke, spin or stiff-arm to reach the goal line. Your average execution score determines the evaluation.'};
 if(position==='WR'||position==='TE')return {kind:'receiver' as const,title:'Win your matchup',detail:'Three contested 3D catches against man coverage. Create separation, find the throw and secure the catch. Your average execution score determines the evaluation.'};
 if(position==='CB'||position==='S'||position==='LB')return {kind:'coverage' as const,title:position==='LB'?'Coverage responsibility':'Close the passing window',detail:'Three live 3D coverage assignments. Follow the receiver, then choose a safer swat or risk an interception. Your average coverage score determines the evaluation.'};
 return undefined;
}
export function careerFieldSeed(identity:string,key:string){return journeyHash(`${identity}:field:${key}`);}
export function careerFieldScore(kind:string,stats:Record<string,number>):number|undefined{
 if(!stats||typeof stats!=='object'||Object.values(stats).some(n=>typeof n!=='number'||!Number.isFinite(n))||stats.dnf)return;
 if(kind==='drive'){
  if(!Number.isInteger(stats.plays)||stats.plays<1||stats.plays>500||!Number.isInteger(stats.points)||stats.points<23||stats.points>200||!Number.isInteger(stats.turnovers)||stats.turnovers<0||stats.turnovers>stats.plays||!Number.isFinite(stats.yards)||Math.abs(stats.yards)>10000)return;
  // The showcase starts at 23 points; those points were not earned by the player.
  return Math.round(Math.max(0,Math.min(100,25+Math.max(0,stats.yards)*.35+(stats.points-23)*5-stats.turnovers*18)));
 }
 const counts=kind==='receiver'?['catches']:kind==='rb'?['touchdowns']:['stops','picks'];
 if(counts.some(key=>!Number.isInteger(stats[key])||stats[key]<0||stats[key]>3))return;
 if(!['receiver','rb','coverage'].includes(kind)||stats.reps!==3||stats.score<0||stats.score>100||!Number.isFinite(stats.score))return;
 return Math.round(stats.score);
}
