export type FantasyDraftReportPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DST';

export type FantasyDraftReportPick = {
  overall: number;
  playerName: string;
  position: FantasyDraftReportPosition;
  projectedPoints: number | null;
  overallRank: number | null;
};

export type FantasyDraftReportTeam = {
  memberId: string;
  picks: FantasyDraftReportPick[];
};

export type FantasyDraftValueNote = {
  playerName: string;
  overall: number;
  overallRank: number;
  delta: number;
};

export type FantasyDraftReport = {
  memberId: string;
  letter: string;
  score: number;
  projectedWins: number;
  projectedLosses: number;
  projectionRank: number;
  projectionScore: number;
  constructionScore: number;
  valueScore: number;
  benchScore: number;
  benchQuality: 'Elite' | 'Strong' | 'Average' | 'Thin' | 'Critical';
  projectionCoverage: number;
  confidence: 'High' | 'Medium' | 'Low';
  confidenceNote: string;
  strengths: string[];
  weaknesses: string[];
  bestValue: FantasyDraftValueNote | null;
  biggestReach: FantasyDraftValueNote | null;
  strongestPosition: string | null;
  explanation: string;
};

type TeamSnapshot = {
  input: FantasyDraftReportTeam;
  strength: number;
  benchStrength: number;
  benchCompositionScore: number;
  constructionScore: number;
  valueScore: number;
  projectionCoverage: number;
  bestValue: FantasyDraftValueNote | null;
  biggestReach: FantasyDraftValueNote | null;
  counts: Partial<Record<FantasyDraftReportPosition, number>>;
  positionStrength: Record<string, number>;
};

const POSITIONS:FantasyDraftReportPosition[]=['QB','RB','WR','TE','K','DST'];
const STARTER_REQUIREMENTS: Record<FantasyDraftReportPosition, number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  K: 1,
  DST: 1,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const letterForScore = (score: number) =>
  score >= 97 ? 'A+' :
  score >= 93 ? 'A' :
  score >= 90 ? 'A-' :
  score >= 87 ? 'B+' :
  score >= 83 ? 'B' :
  score >= 80 ? 'B-' :
  score >= 77 ? 'C+' :
  score >= 73 ? 'C' :
  score >= 70 ? 'C-' :
  score >= 60 ? 'D' : 'F';

const projectionFor = (pick: FantasyDraftReportPick) => {
  const value = Number(pick.projectedPoints);
  return Number.isFinite(value) && value > 0 ? value : 0;
};

const comparePicks=(a:FantasyDraftReportPick,b:FantasyDraftReportPick)=>
  projectionFor(b)-projectionFor(a)||a.overall-b.overall||a.playerName.localeCompare(b.playerName);

const valueNote=(pick:FantasyDraftReportPick,delta:number):FantasyDraftValueNote=>({
  playerName:pick.playerName,
  overall:pick.overall,
  overallRank:Number(pick.overallRank),
  delta:Math.round(delta),
});

const buildSnapshot = (input: FantasyDraftReportTeam): TeamSnapshot => {
  const byPosition = new Map<FantasyDraftReportPosition, FantasyDraftReportPick[]>();
  POSITIONS.forEach(position => byPosition.set(position, []));
  input.picks.forEach(pick => byPosition.get(pick.position)?.push(pick));
  byPosition.forEach(picks => picks.sort(comparePicks));

  const starterPicks: FantasyDraftReportPick[] = [];
  const chosen = new Set<FantasyDraftReportPick>();
  POSITIONS.forEach(position => {
    const required = STARTER_REQUIREMENTS[position];
    const picks = byPosition.get(position) || [];
    for (let index = 0; index < Math.min(required, picks.length); index += 1) {
      starterPicks.push(picks[index]);
      chosen.add(picks[index]);
    }
  });

  const flex = input.picks
    .filter(pick => !chosen.has(pick) && (pick.position === 'RB' || pick.position === 'WR' || pick.position === 'TE'))
    .sort(comparePicks)[0];
  if (flex) {
    starterPicks.push(flex);
    chosen.add(flex);
  }

  const bench=input.picks.filter(pick=>!chosen.has(pick));
  const starterProjection = starterPicks.reduce((sum, pick) => sum + projectionFor(pick), 0);
  const benchStrength = bench.reduce((sum,pick)=>{
    const weight=pick.position==='RB'||pick.position==='WR'?0.28:pick.position==='TE'?0.18:pick.position==='QB'?0.10:0.015;
    return sum+projectionFor(pick)*weight;
  },0);
  const strength = starterProjection + benchStrength;

  const counts = input.picks.reduce<Partial<Record<FantasyDraftReportPosition, number>>>((result, pick) => {
    result[pick.position] = (result[pick.position] || 0) + 1;
    return result;
  }, {});
  const missingBaseStarters = POSITIONS
    .reduce((sum, position) => sum + Math.max(0, STARTER_REQUIREMENTS[position] - (counts[position] || 0)), 0);
  const skillCount = (counts.RB || 0) + (counts.WR || 0) + (counts.TE || 0);
  const flexMissing = skillCount >= 6 ? 0 : 1;
  const extraSpecialTeams = Math.max(0, (counts.K || 0) - 1) + Math.max(0, (counts.DST || 0) - 1);
  const extraQuarterbacks = Math.max(0, (counts.QB || 0) - 2);
  const extraTightEnds = Math.max(0,(counts.TE||0)-3);
  const rbDepth=Math.max(0,(counts.RB||0)-2);
  const wrDepth=Math.max(0,(counts.WR||0)-2);
  const teDepth=Math.max(0,(counts.TE||0)-1);
  const skillDepth = rbDepth+wrDepth+teDepth;
  const depthBonus = Math.min(8, skillDepth * 1.5);
  const thinSkillPenalty=(counts.RB||0)<3?4:0+(counts.WR||0)<3?4:0;
  const constructionScore = clamp(
    Math.round(90 + depthBonus - (missingBaseStarters + flexMissing) * 20 - extraSpecialTeams * 7 - extraQuarterbacks * 4 - extraTightEnds*3-thinSkillPenalty),
    45,
    98,
  );

  const usefulBenchSkill=bench.filter(pick=>pick.position==='RB'||pick.position==='WR'||pick.position==='TE').length;
  const backupQb=bench.some(pick=>pick.position==='QB')?1:0;
  const benchHoardPenalty=bench.filter(pick=>pick.position==='K'||pick.position==='DST').length*8+Math.max(0,bench.filter(pick=>pick.position==='QB').length-1)*5;
  const benchCompositionScore=clamp(Math.round(58+Math.min(28,usefulBenchSkill*5)+backupQb*3-benchHoardPenalty),35,98);

  const rankedPicks = input.picks.filter(pick => Number.isFinite(Number(pick.overallRank)) && Number(pick.overallRank) > 0);
  const valueDeltas = rankedPicks.map(pick => clamp(pick.overall - Number(pick.overallRank), -30, 30));
  const averageValue = valueDeltas.length
    ? valueDeltas.reduce((sum, value) => sum + value, 0) / valueDeltas.length
    : 0;
  const valueScore = clamp(Math.round(82 + averageValue * 0.45), 55, 98);
  const valueCandidates=rankedPicks.map(pick=>({pick,delta:pick.overall-Number(pick.overallRank)}));
  const best=valueCandidates.sort((a,b)=>b.delta-a.delta||a.pick.overall-b.pick.overall)[0];
  const worst=[...valueCandidates].sort((a,b)=>a.delta-b.delta||a.pick.overall-b.pick.overall)[0];
  const bestValue=best&&best.delta>=5?valueNote(best.pick,best.delta):null;
  const biggestReach=worst&&worst.delta<=-5?valueNote(worst.pick,worst.delta):null;
  const projectionCoverage = input.picks.length
    ? input.picks.filter(pick => projectionFor(pick) > 0).length / input.picks.length
    : 0;

  const positionStrength:Record<string,number>={};
  for(const position of POSITIONS){
    const picks=byPosition.get(position)||[];
    const starterCount=STARTER_REQUIREMENTS[position];
    positionStrength[position]=picks.slice(0,starterCount).reduce((sum,pick)=>sum+projectionFor(pick),0)
      +picks.slice(starterCount).reduce((sum,pick)=>sum+projectionFor(pick)*(position==='RB'||position==='WR'?0.16:position==='TE'?0.10:0.03),0);
  }
  const remainingSkill=input.picks.filter(pick=>(pick.position==='RB'||pick.position==='WR'||pick.position==='TE')&&!chosen.has(pick)).sort(comparePicks);
  positionStrength.FLEX_DEPTH=remainingSkill.slice(0,3).reduce((sum,pick,index)=>sum+projectionFor(pick)*(index===0?1:0.25),0);

  return {
    input,
    strength,
    benchStrength,
    benchCompositionScore,
    constructionScore,
    valueScore,
    projectionCoverage,
    bestValue,
    biggestReach,
    counts,
    positionStrength,
  };
};

const rankMetrics=(snapshots:TeamSnapshot[],key:string)=>{
  const ordered=[...snapshots].sort((a,b)=>(b.positionStrength[key]||0)-(a.positionStrength[key]||0)||a.input.memberId.localeCompare(b.input.memberId));
  return new Map(ordered.map((snapshot,index)=>[snapshot.input.memberId,index+1]));
};

const metricPhrase=(key:string)=>key==='FLEX_DEPTH'?'FLEX/skill depth':key==='DST'?'D/ST':key;

export const buildFantasyDraftReports = (
  teams: FantasyDraftReportTeam[],
  regularSeasonGames: number,
): Map<string, FantasyDraftReport> => {
  const snapshots = teams.map(buildSnapshot);
  const result = new Map<string, FantasyDraftReport>();
  if (!snapshots.length) return result;

  const games = Math.max(1, Math.round(regularSeasonGames));
  const strengths = snapshots.map(snapshot => snapshot.strength);
  const meanStrength = strengths.reduce((sum, value) => sum + value, 0) / strengths.length;
  const variance = strengths.reduce((sum, value) => sum + (value - meanStrength) ** 2, 0) / strengths.length;
  const standardDeviation = Math.sqrt(variance);
  const probabilityScale = Math.max(1, standardDeviation * 1.35);
  const ranked = [...snapshots].sort((a, b) => b.strength - a.strength || a.input.memberId.localeCompare(b.input.memberId));
  const projectionRanks = new Map(ranked.map((snapshot, index) => [snapshot.input.memberId, index + 1]));
  const positionRanks=new Map<string,Map<string,number>>();
  for(const key of [...POSITIONS,'FLEX_DEPTH'])positionRanks.set(key,rankMetrics(snapshots,key));

  const benchMean=snapshots.reduce((sum,snapshot)=>sum+snapshot.benchStrength,0)/snapshots.length;
  const benchVariance=snapshots.reduce((sum,snapshot)=>sum+(snapshot.benchStrength-benchMean)**2,0)/snapshots.length;
  const benchDeviation=Math.sqrt(benchVariance);

  const rawWins = snapshots.map(snapshot => {
    if (snapshots.length === 1) return games / 2;
    const expectedWinRate = snapshots
      .filter(other => other.input.memberId !== snapshot.input.memberId)
      .reduce((sum, other) => {
        const probability = 1 / (1 + Math.exp(-(snapshot.strength - other.strength) / probabilityScale));
        return sum + probability;
      }, 0) / (snapshots.length - 1);
    return games * expectedWinRate;
  });

  const integerWins = rawWins.map(value => Math.floor(value));
  const targetLeagueWins = Math.round((snapshots.length * games) / 2);
  let remainingWins = Math.max(0, targetLeagueWins - integerWins.reduce((sum, value) => sum + value, 0));
  const remainders = rawWins
    .map((value, index) => ({ index, remainder: value - Math.floor(value), memberId: snapshots[index].input.memberId }))
    .sort((a, b) => b.remainder - a.remainder || a.memberId.localeCompare(b.memberId));
  for (const item of remainders) {
    if (remainingWins <= 0) break;
    integerWins[item.index] += 1;
    remainingWins -= 1;
  }

  snapshots.forEach((snapshot, index) => {
    const zScore = standardDeviation > 0.001 ? (snapshot.strength - meanStrength) / standardDeviation : 0;
    const projectionScore = clamp(Math.round(86 + zScore * 6.5), 68, 98);
    const benchProjectionScore=benchDeviation>0.001?clamp(Math.round(78+(snapshot.benchStrength-benchMean)/benchDeviation*8),50,98):78;
    const benchScore=clamp(Math.round(benchProjectionScore*.65+snapshot.benchCompositionScore*.35),45,98);
    const benchQuality:FantasyDraftReport['benchQuality']=benchScore>=90?'Elite':benchScore>=83?'Strong':benchScore>=73?'Average':benchScore>=62?'Thin':'Critical';
    const score = clamp(
      Math.round(projectionScore * 0.50 + snapshot.constructionScore * 0.23 + snapshot.valueScore * 0.17 + benchScore*.10),
      55,
      98,
    );
    const projectionRank = projectionRanks.get(snapshot.input.memberId) || snapshots.length;
    const projectedWins = clamp(integerWins[index], 0, games);
    const projectedLosses = games - projectedWins;

    const metricRows=[...POSITIONS,'FLEX_DEPTH'].map(key=>({
      key,
      rank:positionRanks.get(key)?.get(snapshot.input.memberId)||snapshots.length,
      value:snapshot.positionStrength[key]||0,
    })).filter(row=>row.value>0);
    const strengthCutoff=Math.max(1,Math.ceil(snapshots.length/3));
    const weaknessCutoff=Math.max(1,Math.floor(snapshots.length*2/3)+1);
    const strengthsText=metricRows
      .filter(row=>row.rank<=strengthCutoff)
      .sort((a,b)=>a.rank-b.rank||b.value-a.value)
      .slice(0,3)
      .map(row=>`${metricPhrase(row.key)} projects #${row.rank} of ${snapshots.length} in the league.`);
    const weaknessesText=metricRows
      .filter(row=>row.rank>=weaknessCutoff)
      .sort((a,b)=>b.rank-a.rank||a.value-b.value)
      .slice(0,3)
      .map(row=>`${metricPhrase(row.key)} projects #${row.rank} of ${snapshots.length}; this is a roster risk.`);

    if((snapshot.counts.RB||0)<3)weaknessesText.unshift('RB depth is thin behind the required starters.');
    if((snapshot.counts.WR||0)<3)weaknessesText.unshift('WR depth is thin behind the required starters.');
    if((snapshot.counts.QB||0)>3)weaknessesText.unshift('Too many roster spots are invested in backup quarterbacks.');
    if((snapshot.counts.K||0)>1||(snapshot.counts.DST||0)>1)weaknessesText.unshift('Extra K/D/ST picks reduced higher-upside bench depth.');
    const strengthsUnique=[...new Set(strengthsText)].slice(0,3);
    const weaknessesUnique=[...new Set(weaknessesText)].slice(0,3);
    if(!strengthsUnique.length)strengthsUnique.push(benchScore>=83?`${benchQuality} bench depth supports the starting lineup.`:'Roster strength is balanced without one dominant position group.');
    if(!weaknessesUnique.length)weaknessesUnique.push('No major construction hole stands out; weekly health and matchups become the main risk.');

    const confidence:FantasyDraftReport['confidence']=snapshot.projectionCoverage>=.85?'High':snapshot.projectionCoverage>=.65?'Medium':'Low';
    const coveragePercent=Math.round(snapshot.projectionCoverage*100);
    const confidenceNote=confidence==='High'
      ? `${coveragePercent}% of drafted players have published 2026 projection data.`
      : `${coveragePercent}% projection coverage; unavailable players lower confidence in the grade and projected record.`;
    const strongest=metricRows.sort((a,b)=>a.rank-b.rank||b.value-a.value)[0];
    const strongestPosition=strongest?`${metricPhrase(strongest.key)} (#${strongest.rank}/${snapshots.length})`:null;
    const valueText=snapshot.bestValue
      ? `Best value was ${snapshot.bestValue.playerName} at Pick ${snapshot.bestValue.overall}, ${snapshot.bestValue.delta} spots after Ball Knower rank.`
      : snapshot.biggestReach
        ? `The draft did not produce a clear steal; value was closer to market cost.`
        : 'Most ranked selections landed close to Ball Knower draft value.';
    const reachText=snapshot.biggestReach
      ? ` Biggest reach: ${snapshot.biggestReach.playerName} at Pick ${snapshot.biggestReach.overall}, ${Math.abs(snapshot.biggestReach.delta)} spots ahead of rank.`
      : '';
    const explanation=`#${projectionRank} projected scoring roster with ${benchQuality.toLowerCase()} bench depth. ${strengthsUnique[0]} ${valueText}${reachText}${confidence==='High'?'':` ${confidenceNote}`}`;

    result.set(snapshot.input.memberId, {
      memberId: snapshot.input.memberId,
      letter: letterForScore(score),
      score,
      projectedWins,
      projectedLosses,
      projectionRank,
      projectionScore,
      constructionScore: snapshot.constructionScore,
      valueScore: snapshot.valueScore,
      benchScore,
      benchQuality,
      projectionCoverage: snapshot.projectionCoverage,
      confidence,
      confidenceNote,
      strengths:strengthsUnique,
      weaknesses:weaknessesUnique,
      bestValue:snapshot.bestValue,
      biggestReach:snapshot.biggestReach,
      strongestPosition,
      explanation,
    });
  });

  return result;
};
