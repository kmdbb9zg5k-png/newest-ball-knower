// Original mobile controls, inspired by combine events. All time is active time.
export const DRILL_KEY='bk-combine-skills-v1';
export const SHUTTLE_RULESET='precision-turns-v2';
export const BENCH_SECONDS=30;
export const SHUTTLE_DISTANCE=18.288;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export function newSkill(athlete,drill){return {athlete,drill,phase:'idle',clock:0,countdown:3,distance:0,z:0,velocity:0,turn:0,cutElapsed:0,locked:false,penalty:0,cuts:[],feedback:'',feedbackUntil:0,lastInput:-1,pressing:false,lift:0,reps:0,energy:1,lowering:false,topHold:0,forcedLower:false,needsRelease:false,stall:0,score:0};}
export function startSkill(s){if(s.phase==='idle')s.phase='countdown';}
export function cutProgress(s){return s.phase==='cut'?clamp(s.cutElapsed/.8):0;}
export function cutSkill(s,side){
 if(s.drill!=='shuttle'||!['running','cut'].includes(s.phase)||s.turn>=2||s.locked||s.clock-s.lastInput<.22)return;
 s.lastInput=s.clock;const p=cutProgress(s),correct=side===(s.turn===0?'left':'right');
 if(!correct||p<.35){s.penalty+=.15;s.feedback=correct?'EARLY · +0.15s':'WRONG CUT · +0.15s';}
 else {const green=p>=.45&&p<=.90,error=Math.abs(p-.675);const loss=green?(error/.325)**2*.24:.18+error*.12;
  const label=green?(error<=.08?'PERFECT':'CLEAN'):'OFF TIMING';s.penalty+=loss;s.locked=true;s.cuts.push(label);s.feedback=`${label} CUT · +${loss.toFixed(2)}s`;}

 s.feedbackUntil=s.clock+.75;
}
export function stepSkill(s,dt){
 if(!Number.isFinite(dt)||dt<=0||['idle','finished'].includes(s.phase))return;
 // Integrate consistently across refresh rates. The UI pauses on long frame stalls.
 let remaining=dt;while(remaining>1e-8){let h=Math.min(remaining,1/120);remaining-=h;
 if(s.phase==='countdown'){s.countdown=Math.max(0,s.countdown-h);if(s.countdown<1e-8){s.phase='running';s.countdown=0;}continue;}
 if(s.phase==='cut') {
  s.cutElapsed+=h;s.clock+=h;
  if(s.cutElapsed>=.8-1e-8){if(!s.locked){s.penalty+=.45;s.cuts.push('MISSED');s.feedback='MISSED CUT · +0.45s';s.feedbackUntil=s.clock+.75;}s.phase='running';s.turn++;s.locked=false;s.velocity=1.1;}
  continue;
 }
 if(s.phase!=='running')break;
 if(s.drill==='shuttle'){
  const speed=4.6+(s.athlete.speed-70)*.025;
  s.velocity=Math.min(speed,s.velocity+h*10);const end=[4.572,13.716,SHUTTLE_DISTANCE][s.turn];
  const travel=Math.min(s.velocity*h,end-s.distance);s.clock+=h;s.distance+=travel;
  s.z=s.turn===0?s.distance:s.turn===1?9.144-s.distance:s.distance-SHUTTLE_DISTANCE;
  if(s.distance>=end-1e-8){if(s.turn<2){s.phase='cut';s.cutElapsed=0;s.velocity=0;}else{s.phase='finished';s.score=Number((s.clock+s.penalty).toFixed(3));}}
 }else{
  h=Math.min(h,BENCH_SECONDS-s.clock);s.clock+=h;
  const careerStrength=Number.isFinite(s.athlete.careerStrength)?clamp(1+(s.athlete.careerStrength-72)*.006,.84,1.16):1;
  if(s.forcedLower){
   s.lift=clamp(s.lift-h*.7);s.energy=clamp(s.energy-h*.08);
   if(s.lift===0){s.forcedLower=false;s.needsRelease=true;}
  }else if(s.needsRelease){
   if(!s.pressing){s.needsRelease=false;s.lowering=false;s.topHold=0;}
  }else if(s.pressing&&s.lowering){
   s.topHold+=h;s.energy=clamp(s.energy-h*.32);
   if(s.topHold>=1.25||s.energy<=.04)s.forcedLower=true;
  }else if(!s.pressing){
   s.lift=clamp(s.lift-h*1.1);s.energy=clamp(s.energy+h*(s.lift===0?.20:.04));s.topHold=0;
   if(s.lift===0)s.lowering=false;
  }else if(s.energy>0){
   s.lift=clamp(s.lift+h*(.45+s.energy*.8)*careerStrength);s.energy=clamp(s.energy-h*.30/careerStrength);
   if(s.lift>=1){s.reps++;s.lowering=true;s.topHold=0;}
  }else{s.forcedLower=true;}
  if(s.clock>=BENCH_SECONDS-1e-8){s.phase='finished';s.score=s.reps;s.pressing=false;}

 }
 }
}
export function readSkills(){try{const rows=JSON.parse(localStorage.getItem(DRILL_KEY)||'[]');return Array.isArray(rows)?rows.filter(r=>r&&['shuttle','bench'].includes(r.drill)&&typeof r.playerId==='string'&&Number.isFinite(r.score)&&r.score>=0).slice(-200):[];}catch{return [];}}
export function saveSkill(s,context){try{const rows=readSkills();rows.push({drill:s.drill,playerId:s.athlete.id,context,score:s.score,ruleset:s.drill==='shuttle'?SHUTTLE_RULESET:'bench-v1',date:Date.now()});localStorage.setItem(DRILL_KEY,JSON.stringify(rows.slice(-200)));return true;}catch{return false;}}

export function benchCue(s){return s.forcedLower?'LOSING GRIP · BAR LOWERING':s.needsRelease?'RELEASE TO RESET':s.lowering?(s.topHold>=.55?'LOSING GRIP · RELEASE NOW':'LOWER · RELEASE PRESS'):s.lift===0&&!s.pressing?'RECOVER · HOLD PRESS WHEN READY':s.energy<.15?'LOW STRENGTH · RELEASE TO RECOVER':'PRESS · FULL EXTENSION';}
