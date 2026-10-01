const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/** Decisions use visible player positions and closing speed, never the user's input. */
export function cpuRead(actors,{snapZ,elapsed,toGo,level='pro',clock=120,deficit=0}){
 const qb=actors[5],defenders=actors.slice(11).filter(p=>!p.fallen),awareness=qb.ratings.awareness||75;
 const reaction=(level==='rookie'?.92:level==='all-pro'?.48:.66)+(90-awareness)*.003;
 const threats=defenders.filter(p=>!p.engaged).map(p=>{const dx=qb.x-p.x,dz=qb.z-p.z,d=Math.hypot(dx,dz),closing=((p.vx||0)*dx+(p.vz||0)*dz)/(d||1);return {p,d,eta:(d-.9)/Math.max(1,closing)};});
 const pressure=threats.some(t=>t.d<3.6||t.d<7&&t.eta<.85);
 const reads=[7,8,9,10,6].map(index=>{const p=actors[index],range=Math.hypot(p.x-qb.x,p.z-qb.z),separation=Math.min(...defenders.map(d=>Math.hypot(d.x-p.x,d.z-p.z)));
  const dx=p.x-qb.x,dz=p.z-qb.z,len2=dx*dx+dz*dz;
  const lane=defenders.some(d=>{const t=((d.x-qb.x)*dx+(d.z-qb.z)*dz)/(len2||1);return t>.15&&t<.9&&Math.hypot(d.x-qb.x-t*dx,d.z-qb.z-t*dz)<1.25;});
  const gain=p.z-snapZ,short=range<15,need=clock<25&&deficit>0;
  return {index,separation,lane,range,score:Math.min(separation,6)*1.8-(lane?4:0)+(gain>=toGo?2:0)+(pressure&&short?2.8:0)-(range>30?1:0)+(need&&Math.abs(p.x)>18?1:0)};
 }).sort((a,b)=>b.score-a.score);
 const target=reads.find(p=>p.separation>(pressure?1.35:1.9)&&!p.lane);
 if(elapsed>=reaction&&target&&(pressure||elapsed>reaction+.65))return {action:'throw',target:target.index,pressure,quick:pressure};
 if(pressure&&elapsed>=reaction&&!target&&Math.abs(qb.x)>8)return {action:'away',pressure};
 const nearest=threats.sort((a,b)=>a.d-b.d)[0];
 if(pressure||elapsed>3.3){const left=defenders.filter(p=>p.x<qb.x&&Math.abs(p.z-qb.z)<8).length,right=defenders.filter(p=>p.x>=qb.x&&Math.abs(p.z-qb.z)<8).length;return {action:'escape',side:left<right?-1:right<left?1:nearest?.p.x<qb.x?1:-1,pressure};}
 return {action:'read',pressure};
}
/** Fourth-down policy shared by interactive and simulated possessions. */
export function cpuFourthDown({ball,down,toGo,clock,deficit,overtime=0,otPossessions=0,kicker=80,opponentTimeouts=3}){
 const distance=117-ball,range=clamp(49+(kicker-70)*.35,47,60),make=clamp(.96-Math.max(0,distance-30)*.019+(kicker-80)*.005,.08,.99);
 const lastTry=overtime&&otPossessions===1;
 const needTD=(lastTry&&deficit>3)||(!overtime&&clock<65&&deficit>3);
 if(!overtime&&clock<=8&&deficit>=0&&deficit<=3&&distance<=range)return 'field-goal';
 if(down!==4)return null;
 if(needTD||lastTry&&deficit>0&&distance>range)return 'go';
 if(!overtime&&clock<65&&deficit>0){if(deficit<=3&&distance<=range)return 'field-goal';return 'go';}
 // A first down can finish a late lead; avoid surrendering a short field early.
 if(!overtime&&deficit<0&&clock<90&&opponentTimeouts===0&&toGo<=2&&ball>=40)return 'go';
 if(lastTry&&deficit<=0&&distance<=range)return 'field-goal';
 if(toGo<=1&&ball>=45&&ball<90&&!(deficit<0&&clock<90))return 'go';
 if(distance<=range&&make>=.48)return 'field-goal';
 if(overtime||ball>=52&&toGo<=4||ball>=65&&toGo<=7)return 'go';
 return 'punt';
}
