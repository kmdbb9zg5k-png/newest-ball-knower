// Original mobile controls, inspired by combine events. All time is active time.
export const DRILL_KEY='bk-combine-skills-v1';
export const BENCH_SECONDS=30;
export const SHUTTLE_DISTANCE=18.288;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export function newSkill(athlete,drill){return {athlete,drill,phase:'idle',clock:0,countdown:3,distance:0,z:0,velocity:0,turn:0,locked:false,penalty:0,cuts:[],feedback:'',feedbackUntil:0,lastInput:-1,pressing:false,lift:0,reps:0,energy:1,lowering:false,stall:0,score:0};}
export function startSkill(s){if(s.phase==='idle')s.phase='countdown';}
export function cutProgress(s){const end=s.turn===0?4.572:13.716;return clamp(1-(end-s.distance)/1.8);}
export function cutSkill(s,side){
 if(s.drill!=='shuttle'||s.phase!=='running'||s.turn>=2||s.locked||s.clock-s.lastInput<.22)return;
 s.lastInput=s.clock;const p=cutProgress(s),correct=side===(s.turn===0?'left':'right');
 if(!correct||p<.35){s.penalty+=.15;s.feedback=correct?'EARLY · +0.15s':'WRONG CUT · +0.15s';}
 else {const perfect=p>=.62&&p<=.94;const loss=perfect?0:.18;s.penalty+=loss;s.locked=true;s.cuts.push(perfect?'PERFECT':'OFF TIMING');s.feedback=perfect?'PERFECT CUT':'OFF TIMING · +0.18s';}
 s.feedbackUntil=s.clock+.75;
}
export function stepSkill(s,dt){
 if(!Number.isFinite(dt)||dt<=0||['idle','finished'].includes(s.phase))return;
 // Integrate consistently across refresh rates. The UI pauses on long frame stalls.
 let remaining=dt;while(remaining>1e-8){let h=Math.min(remaining,1/120);remaining-=h;
 if(s.phase==='countdown'){s.countdown=Math.max(0,s.countdown-h);if(s.countdown<1e-8){s.phase='running';s.countdown=0;}continue;}
 if(s.phase!=='running')break;
 if(s.drill==='shuttle'){
  const speed=4.6+(s.athlete.speed-70)*.025;
  s.velocity=Math.min(speed,s.velocity+h*10);const end=[4.572,13.716,SHUTTLE_DISTANCE][s.turn];
  const travel=Math.min(s.velocity*h,end-s.distance);s.clock+=travel/Math.max(.001,s.velocity);s.distance+=travel;
  s.z=s.turn===0?s.distance:s.turn===1?9.144-s.distance:s.distance-SHUTTLE_DISTANCE;
  if(s.distance>=end-1e-8){if(s.turn<2){if(!s.locked){s.penalty+=.45;s.cuts.push('MISSED');s.feedback='MISSED CUT · +0.45s';s.feedbackUntil=s.clock+.75;}s.turn++;s.locked=false;s.velocity=1.1;}else{s.phase='finished';s.score=Number((s.clock+s.penalty).toFixed(3));}}
 }else{
  h=Math.min(h,BENCH_SECONDS-s.clock);s.clock+=h;
  if(s.pressing&&!s.lowering&&s.energy>0){s.lift=clamp(s.lift+h*(.8+s.energy*.65));s.energy=clamp(s.energy-h*.28);s.stall=0;if(s.lift>=1){s.reps++;s.lowering=true;s.feedback='REP COMPLETE · RELEASE';}}
  else if(!s.pressing){s.lift=clamp(s.lift-h*1.75);s.energy=clamp(s.energy+h*(s.lift===0?.22:.10));s.stall=0;if(s.lift===0)s.lowering=false;}
  else if(!s.lowering&&s.energy<=0){s.stall+=h;s.feedback='FATIGUED · RELEASE TO RECOVER';}
  if(s.clock>=BENCH_SECONDS-1e-8||s.stall>=2){s.phase='finished';s.score=s.reps;s.pressing=false;}
 }
 }
}
export function readSkills(){try{const rows=JSON.parse(localStorage.getItem(DRILL_KEY)||'[]');return Array.isArray(rows)?rows.filter(r=>r&&['shuttle','bench'].includes(r.drill)&&typeof r.playerId==='string'&&Number.isFinite(r.score)&&r.score>=0).slice(-200):[];}catch{return [];}}
export function saveSkill(s,context){try{const rows=readSkills();rows.push({drill:s.drill,playerId:s.athlete.id,context,score:s.score,date:Date.now()});localStorage.setItem(DRILL_KEY,JSON.stringify(rows.slice(-200)));return true;}catch{return false;}}
