export type FantasyDraftReportPosition='QB'|'RB'|'WR'|'TE'|'K'|'DST';

export type FantasyDraftReportPick={
  overall:number;
  playerName:string;
  position:FantasyDraftReportPosition;
  projectedPoints:number|null;
  overallRank:number|null;
};

export type FantasyDraftReportTeam={memberId:string;picks:FantasyDraftReportPick[]};
export type FantasyDraftValueNote={playerName:string;overall:number;overallRank:number;delta:number};

export type FantasyDraftReport={
  memberId:string;
  letter:string;
  score:number;
  projectedWins:number;
  projectedLosses:number;
  projectionRank:number;
  projectionScore:number;
  constructionScore:number;
  valueScore:number;
  benchScore:number;
  benchQuality:'Elite'|'Strong'|'Average'|'Thin'|'Critical';
  projectionCoverage:number;
  confidence:'High'|'Medium'|'Low';
  confidenceNote:string;
  strengths:string[];
  weaknesses:string[];
  bestValue:FantasyDraftValueNote|null;
  biggestReach:FantasyDraftValueNote|null;
  strongestPosition:string|null;
  explanation:string;
};

type Snapshot={
  input:FantasyDraftReportTeam;
  starterStrength:number;
  overallStrength:number;
  benchStrength:number;
  benchComposition:number;
  constructionScore:number;
  valueScore:number;
  coverage:number;
  bestValue:FantasyDraftValueNote|null;
  biggestReach:FantasyDraftValueNote|null;
  counts:Partial<Record<FantasyDraftReportPosition,number>>;
  positionStrength:Record<string,number>;
};

const POSITIONS:FantasyDraftReportPosition[]=['QB','RB','WR','TE','K','DST'];
const STARTERS:Record<FantasyDraftReportPosition,number>={QB:1,RB:2,WR:2,TE:1,K:1,DST:1};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const codeCompare=(a:string,b:string)=>a<b?-1:a>b?1:0;
const projection=(pick:FantasyDraftReportPick)=>{
  const value=Number(pick.projectedPoints);
  return Number.isFinite(value)&&value>0?value:0;
};
const comparePicks=(a:FantasyDraftReportPick,b:FantasyDraftReportPick)=>
  projection(b)-projection(a)||a.overall-b.overall||codeCompare(a.playerName,b.playerName);
const letterFor=(score:number)=>score>=97?'A+':score>=93?'A':score>=90?'A-':score>=87?'B+':score>=83?'B':score>=80?'B-':score>=77?'C+':score>=73?'C':score>=70?'C-':score>=60?'D':'F';
const valueNote=(pick:FantasyDraftReportPick,delta:number):FantasyDraftValueNote=>({
  playerName:pick.playerName,
  overall:pick.overall,
  overallRank:Number(pick.overallRank),
  delta:Math.round(delta),
});

const snapshotFor=(input:FantasyDraftReportTeam):Snapshot=>{
  const byPosition=new Map<FantasyDraftReportPosition,FantasyDraftReportPick[]>();
  POSITIONS.forEach(position=>byPosition.set(position,[]));
  input.picks.forEach(pick=>byPosition.get(pick.position)?.push(pick));
  byPosition.forEach(picks=>picks.sort(comparePicks));

  const selected=new Set<FantasyDraftReportPick>();
  const starters:FantasyDraftReportPick[]=[];
  POSITIONS.forEach(position=>{
    const picks=byPosition.get(position)||[];
    for(let index=0;index<Math.min(STARTERS[position],picks.length);index+=1){
      starters.push(picks[index]);selected.add(picks[index]);
    }
  });
  const flex=input.picks
    .filter(pick=>!selected.has(pick)&&['RB','WR','TE'].includes(pick.position))
    .sort(comparePicks)[0];
  if(flex){starters.push(flex);selected.add(flex);}
  const bench=input.picks.filter(pick=>!selected.has(pick));

  const starterStrength=starters.reduce((sum,pick)=>sum+projection(pick),0);
  const benchStrength=bench.reduce((sum,pick)=>{
    const weight=pick.position==='RB'||pick.position==='WR'?.28:pick.position==='TE'?.18:pick.position==='QB'?.10:.015;
    return sum+projection(pick)*weight;
  },0);
  const overallStrength=starterStrength+benchStrength;

  const counts=input.picks.reduce<Partial<Record<FantasyDraftReportPosition,number>>>((result,pick)=>{
    result[pick.position]=(result[pick.position]||0)+1;return result;
  },{});
  const missingBase=POSITIONS.reduce((sum,position)=>sum+Math.max(0,STARTERS[position]-(counts[position]||0)),0);
  const skillCount=(counts.RB||0)+(counts.WR||0)+(counts.TE||0);
  const flexMissing=skillCount>=6?0:1;
  const extraSpecial=Math.max(0,(counts.K||0)-1)+Math.max(0,(counts.DST||0)-1);
  const extraQb=Math.max(0,(counts.QB||0)-2);
  const extraTe=Math.max(0,(counts.TE||0)-3);
  const usableDepth=Math.max(0,(counts.RB||0)-2)+Math.max(0,(counts.WR||0)-2)+Math.max(0,(counts.TE||0)-1);
  const thinSkillPenalty=((counts.RB||0)<3?4:0)+((counts.WR||0)<3?4:0);
  const constructionScore=clamp(Math.round(
    90+Math.min(8,usableDepth*1.5)-(missingBase+flexMissing)*20-extraSpecial*7-extraQb*4-extraTe*3-thinSkillPenalty,
  ),45,98);

  const usefulBench=bench.filter(pick=>['RB','WR','TE'].includes(pick.position)).length;
  const backupQb=bench.some(pick=>pick.position==='QB')?1:0;
  const hoardPenalty=bench.filter(pick=>pick.position==='K'||pick.position==='DST').length*8+Math.max(0,bench.filter(pick=>pick.position==='QB').length-1)*5;
  const benchComposition=clamp(Math.round(58+Math.min(28,usefulBench*5)+backupQb*3-hoardPenalty),35,98);

  const ranked=input.picks.filter(pick=>Number.isFinite(Number(pick.overallRank))&&Number(pick.overallRank)>0);
  const deltas=ranked.map(pick=>clamp(pick.overall-Number(pick.overallRank),-30,30));
  const averageValue=deltas.length?deltas.reduce((sum,value)=>sum+value,0)/deltas.length:0;
  const valueScore=clamp(Math.round(82+averageValue*.45),55,98);
  const candidates=ranked.map(pick=>({pick,delta:pick.overall-Number(pick.overallRank)}));
  const best=[...candidates].sort((a,b)=>b.delta-a.delta||a.pick.overall-b.pick.overall)[0];
  const worst=[...candidates].sort((a,b)=>a.delta-b.delta||a.pick.overall-b.pick.overall)[0];
  const bestValue=best&&best.delta>=5?valueNote(best.pick,best.delta):null;
  const biggestReach=worst&&worst.delta<=-5?valueNote(worst.pick,worst.delta):null;
  const coverage=input.picks.length?input.picks.filter(pick=>projection(pick)>0).length/input.picks.length:0;

  const positionStrength:Record<string,number>={};
  for(const position of POSITIONS){
    const picks=byPosition.get(position)||[];
    positionStrength[position]=picks.slice(0,STARTERS[position]).reduce((sum,pick)=>sum+projection(pick),0)
      +picks.slice(STARTERS[position]).reduce((sum,pick)=>sum+projection(pick)*(position==='RB'||position==='WR'?.16:position==='TE'?.10:.03),0);
  }
  const remainingSkill=input.picks.filter(pick=>['RB','WR','TE'].includes(pick.position)&&!selected.has(pick)).sort(comparePicks);
  positionStrength.FLEX_DEPTH=remainingSkill.slice(0,3).reduce((sum,pick,index)=>sum+projection(pick)*(index===0?1:.25),0);

  return{input,starterStrength,overallStrength,benchStrength,benchComposition,constructionScore,valueScore,coverage,bestValue,biggestReach,counts,positionStrength};
};

const metricName=(key:string)=>key==='FLEX_DEPTH'?'FLEX/skill depth':key==='DST'?'D/ST':key;
const ranksFor=(snapshots:Snapshot[],key:string)=>new Map(
  [...snapshots]
    .sort((a,b)=>(b.positionStrength[key]||0)-(a.positionStrength[key]||0)||codeCompare(a.input.memberId,b.input.memberId))
    .map((snapshot,index)=>[snapshot.input.memberId,index+1]),
);

export const buildFantasyDraftReports=(teams:FantasyDraftReportTeam[],regularSeasonGames:number):Map<string,FantasyDraftReport>=>{
  const snapshots=teams.map(snapshotFor);
  const reports=new Map<string,FantasyDraftReport>();
  if(!snapshots.length)return reports;

  const games=Math.max(1,Math.round(regularSeasonGames));
  const strengths=snapshots.map(snapshot=>snapshot.overallStrength);
  const mean=strengths.reduce((sum,value)=>sum+value,0)/strengths.length;
  const variance=strengths.reduce((sum,value)=>sum+(value-mean)**2,0)/strengths.length;
  const deviation=Math.sqrt(variance);
  const probabilityScale=Math.max(1,deviation*1.35);
  const projectionOrder=[...snapshots].sort((a,b)=>b.overallStrength-a.overallStrength||codeCompare(a.input.memberId,b.input.memberId));
  const projectionRanks=new Map(projectionOrder.map((snapshot,index)=>[snapshot.input.memberId,index+1]));
  const positionRanks=new Map<string,Map<string,number>>();
  for(const key of [...POSITIONS,'FLEX_DEPTH'])positionRanks.set(key,ranksFor(snapshots,key));

  const benchMean=snapshots.reduce((sum,snapshot)=>sum+snapshot.benchStrength,0)/snapshots.length;
  const benchVariance=snapshots.reduce((sum,snapshot)=>sum+(snapshot.benchStrength-benchMean)**2,0)/snapshots.length;
  const benchDeviation=Math.sqrt(benchVariance);

  const rawWins=snapshots.map(snapshot=>{
    if(snapshots.length===1)return games/2;
    const rate=snapshots.filter(other=>other.input.memberId!==snapshot.input.memberId).reduce((sum,other)=>
      sum+1/(1+Math.exp(-(snapshot.overallStrength-other.overallStrength)/probabilityScale)),0)/(snapshots.length-1);
    return games*rate;
  });
  const integerWins=rawWins.map(value=>Math.floor(value));
  let remaining=Math.max(0,Math.round(snapshots.length*games/2)-integerWins.reduce((sum,value)=>sum+value,0));
  for(const item of rawWins.map((value,index)=>({index,remainder:value-Math.floor(value),memberId:snapshots[index].input.memberId})).sort((a,b)=>b.remainder-a.remainder||codeCompare(a.memberId,b.memberId))){
    if(remaining<=0)break;integerWins[item.index]+=1;remaining-=1;
  }

  snapshots.forEach((snapshot,index)=>{
    const z=deviation>.001?(snapshot.overallStrength-mean)/deviation:0;
    const projectionScore=clamp(Math.round(86+z*6.5),68,98);
    const benchProjection=benchDeviation>.001?clamp(Math.round(78+(snapshot.benchStrength-benchMean)/benchDeviation*8),50,98):78;
    const benchScore=clamp(Math.round(benchProjection*.65+snapshot.benchComposition*.35),45,98);
    const benchQuality:FantasyDraftReport['benchQuality']=benchScore>=90?'Elite':benchScore>=83?'Strong':benchScore>=73?'Average':benchScore>=62?'Thin':'Critical';
    const score=clamp(Math.round(projectionScore*.50+snapshot.constructionScore*.23+snapshot.valueScore*.17+benchScore*.10),55,98);
    const projectionRank=projectionRanks.get(snapshot.input.memberId)||snapshots.length;
    const projectedWins=clamp(integerWins[index],0,games);
    const projectedLosses=games-projectedWins;

    const metrics=[...POSITIONS,'FLEX_DEPTH'].map(key=>({
      key,rank:positionRanks.get(key)?.get(snapshot.input.memberId)||snapshots.length,value:snapshot.positionStrength[key]||0,
    })).filter(metric=>metric.value>0);
    const topCutoff=Math.max(1,Math.ceil(snapshots.length/3));
    const bottomCutoff=Math.max(1,Math.floor(snapshots.length*2/3)+1);
    const strengthsText=metrics.filter(metric=>metric.rank<=topCutoff).sort((a,b)=>a.rank-b.rank||b.value-a.value).slice(0,3)
      .map(metric=>`${metricName(metric.key)} projects #${metric.rank} of ${snapshots.length} in the league.`);
    const weaknessesText=metrics.filter(metric=>metric.rank>=bottomCutoff).sort((a,b)=>b.rank-a.rank||a.value-b.value).slice(0,3)
      .map(metric=>`${metricName(metric.key)} projects #${metric.rank} of ${snapshots.length}; this is a roster risk.`);
    if((snapshot.counts.RB||0)<3)weaknessesText.unshift('RB depth is thin behind the required starters.');
    if((snapshot.counts.WR||0)<3)weaknessesText.unshift('WR depth is thin behind the required starters.');
    if((snapshot.counts.QB||0)>3)weaknessesText.unshift('Too many roster spots are invested in backup quarterbacks.');
    if((snapshot.counts.K||0)>1||(snapshot.counts.DST||0)>1)weaknessesText.unshift('Extra K/D/ST picks reduced higher-upside bench depth.');
    const strengthsUnique=[...new Set(strengthsText)].slice(0,3);
    const weaknessesUnique=[...new Set(weaknessesText)].slice(0,3);
    if(!strengthsUnique.length)strengthsUnique.push(benchScore>=83?`${benchQuality} bench depth supports the starting lineup.`:'Roster strength is balanced without one dominant position group.');
    if(!weaknessesUnique.length)weaknessesUnique.push('No major construction hole stands out; weekly health and matchups become the main risk.');

    const confidence:FantasyDraftReport['confidence']=snapshot.coverage>=.85?'High':snapshot.coverage>=.65?'Medium':'Low';
    const coveragePercent=Math.round(snapshot.coverage*100);
    const confidenceNote=confidence==='High'
      ? `${coveragePercent}% of drafted players have published 2026 projection data.`
      : `${coveragePercent}% projection coverage; unavailable players lower confidence in the grade and projected record.`;
    const strongest=[...metrics].sort((a,b)=>a.rank-b.rank||b.value-a.value)[0];
    const strongestPosition=strongest?`${metricName(strongest.key)} (#${strongest.rank}/${snapshots.length})`:null;
    const valueText=snapshot.bestValue
      ? `Best value: ${snapshot.bestValue.playerName} at Pick ${snapshot.bestValue.overall}, ${snapshot.bestValue.delta} spots after Ball Knower rank.`
      : 'Best value: no ranked pick cleared the meaningful five-slot steal threshold.';
    const reachText=snapshot.biggestReach
      ? `Biggest reach: ${snapshot.biggestReach.playerName} at Pick ${snapshot.biggestReach.overall}, ${Math.abs(snapshot.biggestReach.delta)} spots ahead of rank.`
      : 'Biggest reach: no ranked pick cleared the meaningful five-slot reach threshold.';
    const explanation=[
      `#${projectionRank} projected scoring roster.`,
      `Bench: ${benchQuality} (${benchScore}/100).`,
      `Strength: ${strengthsUnique[0]}`,
      `Risk: ${weaknessesUnique[0]}`,
      valueText,
      reachText,
      `Confidence: ${confidence}. ${confidenceNote}`,
    ].join(' ');

    reports.set(snapshot.input.memberId,{
      memberId:snapshot.input.memberId,letter:letterFor(score),score,projectedWins,projectedLosses,projectionRank,
      projectionScore,constructionScore:snapshot.constructionScore,valueScore:snapshot.valueScore,benchScore,benchQuality,
      projectionCoverage:snapshot.coverage,confidence,confidenceNote,strengths:strengthsUnique,weaknesses:weaknessesUnique,
      bestValue:snapshot.bestValue,biggestReach:snapshot.biggestReach,strongestPosition,explanation,
    });
  });
  return reports;
};
