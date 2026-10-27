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

export function careerFieldReview(kind:string,stats:Record<string,number>){
 const score=careerFieldScore(kind,stats);if(score===undefined)return;
 const band=score>=85?'standout':score>=65?'solid':'development';
 const headline=band==='standout'?'YOU PUT IT ON TAPE.':band==='solid'?'A FOUNDATION TO BUILD ON.':'THE NEXT REP STARTS HERE.';
 const common={score,band,headline};
 if(kind==='drive'){
  const points=stats.points-23,yards=Math.max(0,stats.yards)*.35,scoring=points*5,turnovers=stats.turnovers*18;
  return {...common,focus:'QB / POSSESSION & PRODUCTION',summary:points>0?`${points} new points from your team showcase.`:'No new points in this team showcase.',cue:stats.turnovers>0?'Protect the next possession. Identify the outlet before committing to a tight throwing window.':points===0?'Turn field position into points. Check the clock and choose a play that keeps a scoring opportunity alive.':'Keep the drive organized: identify pressure, work through your reads and protect possession.',metrics:[{label:'New points',value:String(points)},{label:'Team yards',value:String(stats.yards)},{label:'Turnovers',value:String(stats.turnovers)}],formula:`25 base + ${yards.toFixed(1)} yards bonus + ${scoring} points bonus − ${turnovers} turnover penalty. Rounded and capped between 0 and 100. Starting scoreboard points are excluded.`};
 }
 if(kind==='receiver')return {...common,focus:'RECEIVER / SEPARATION & HANDS',summary:`${stats.catches} of 3 contested catches secured.`,cue:stats.catches<3?'Create space before the throw, then keep moving through the catch. Track the defender as you make your break.':'Repeat the same discipline against a different coverage look. Keep your route and catch timing consistent.',metrics:[{label:'Catches',value:`${stats.catches}/3`},{label:'Completed reps',value:'3'},{label:'Raw tape',value:`${score}/100`}],formula:'Your three-rep average execution score, rounded to the nearest whole number.'};
 if(kind==='rb')return {...common,focus:'RUNNING BACK / SPACE & FINISH',summary:`${stats.touchdowns} of 3 runs reached the goal line.`,cue:stats.touchdowns<3?'Read the linebacker before choosing your move. Make one decisive cut into space instead of steering back into contact.':'Keep your cuts controlled and repeat the finish. Test a different move when the defender changes leverage.',metrics:[{label:'Touchdowns',value:`${stats.touchdowns}/3`},{label:'Completed reps',value:'3'},{label:'Raw tape',value:`${score}/100`}],formula:'Your three-rep average execution score, rounded to the nearest whole number.'};
 return {...common,focus:'DEFENSE / LEVERAGE & BALL SKILLS',summary:`${stats.stops} stops and ${stats.picks} interceptions across 3 reps.`,cue:stats.stops<3?'Keep your coverage leverage before attacking the ball. A well-timed swat is the safer choice when you cannot get into interception position.':'Stay disciplined after the stop. Keep the same leverage and choose interceptions only when you have position.',metrics:[{label:'Stops',value:`${stats.stops}/3`},{label:'Interceptions',value:String(stats.picks)},{label:'Raw tape',value:`${score}/100`}],formula:'Your three-rep average coverage score, rounded to the nearest whole number.'};
}
