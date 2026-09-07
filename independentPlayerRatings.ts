import type { Player, Position } from './types';

/** Reproducible Ball Knower estimates. No external game ratings are inputs. */
export interface FootballInput {
  id: string; gsisId: string | null; providerId: string | null;
  name: string; sourceName: string; team: string; position: string; active: boolean;
  depth: number | null; experience: number | null; draftPick: number | null;
  rosterStatus: string; stats: Record<string, number>;
}
export const BALL_KNOWER_RATING_METADATA = {
  ratingSource: 'Ball Knower independent model v1', ratingSeason: 2026,
  lastUpdated: '2026-09-06', source: 'nflverse 2025 regular-season statistics and 2026 roster/depth snapshot',
  disclaimer: 'Model estimates, not measured athletic skills or official league ratings.',
};
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n) ? n : 0;
export const normalizeFootballName = (name: string) => name.normalize('NFKD').toLowerCase()
  .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').replace(/[^a-z0-9]/g, '');
// Owner's independent editorial choices, recorded September 6, 2026.
const EDITORIAL: Record<string, number> = {
  jalenhurts:90, patrickmahomes:96, joshallen:98, lamarjackson:97, joeburrow:93,
};
export const isOffensiveLine = (pos:string) => ['OT','LT','RT','OG','LG','RG','C'].includes(pos);

export function independentRating(input: FootballInput) {
  const s=input.stats; const value=(key:string)=>finite(s[key]);
  const games=Math.max(1,value('games')); const rank=input.depth??5;
  const role=rank===1?79:rank===2?71:rank===3?65:59;
  const draftPrior=input.experience===0 && input.draftPick!==null
    ? clamp(82-Math.log2(Math.max(1,input.draftPick))*2.3,60,82) : role;
  const prior=input.experience===0?Math.max(role,draftPrior):role+Math.min(3,Math.max(0,input.experience??0)*0.4);
  let measured=prior; let evidence=0;
  if(input.position==='QB'){
    const att=value('attempts'); const ypa=(value('passing_yards')+1400)/(att+200);
    const epa=value('passing_epa')/(att+200);
    measured=75+clamp((ypa-6.7)*6,-12,14)+clamp(epa*35,-12,12)
      +clamp(value('rushing_yards')/games/9,0,6);
    evidence=att/(att+160);
  }else if(['RB','FB','WR','TE'].includes(input.position)){
    const usage=value('carries')+value('targets');
    const yards=value('rushing_yards')+value('receiving_yards');
    const tds=value('rushing_tds')+value('receiving_tds');
    const typical=input.position==='TE'?38:input.position==='WR'?55:60;
    measured=70+clamp((yards/games-typical)/3,-16,21)
      +clamp(value('receptions')/games*1.4,0,9)+clamp(tds/games*8,0,8);
    evidence=usage/(usage+70);
  }else if(input.position==='K'){
    const attempts=value('fg_att'); const accuracy=(value('fg_made')+17)/(attempts+20);
    measured=77+(accuracy-.8)*80-clamp(value('pat_missed')/2,0,5);
    evidence=attempts/(attempts+18);
  }else if(input.position==='P'){
    const punts=value('pt_att'); const net=(value('pt_net_yards')+800)/(punts+20);
    measured=76+(net-39)*2; evidence=punts/(punts+25);
  }else if(!isOffensiveLine(input.position)){
    const impact=value('def_tackles_solo')*.35+value('def_tackle_assists')*.12
      +value('def_tackles_for_loss')*1.4+value('def_sacks')*4+value('def_qb_hits')*.7
      +value('def_interceptions')*3+value('def_pass_defended')*1.8+value('def_fumbles_forced')*2;
    measured=68+clamp(impact/games*3.8,0,29);
    evidence=games/(games+7);
  }
  const editorial=input.position==='QB'?EDITORIAL[normalizeFootballName(input.name)]:undefined;
  const overall=editorial??Math.round(clamp(prior*(1-evidence)+measured*evidence,50,98));
  const confidence:'low'|'medium'|'editorial'=editorial!==undefined?'editorial':isOffensiveLine(input.position)||evidence<.35?'low':'medium';
  return {overall,confidence,source:editorial!==undefined?'Ball Knower owner editorial':BALL_KNOWER_RATING_METADATA.ratingSource};
}

/** Gameplay cap estimate, not a reported NFL contract or cap hit. */
export function estimatePlayerSalary(position: string, ovr: number): number {
  const fraction=Math.max(0,clamp(ovr,0,99)-55)/44;
  const ceiling=position==='QB'?55:['WR','EDGE'].includes(position)?32:
    ['CB','OT','LT','RT'].includes(position)?24:['K','P'].includes(position)?5:18;
  return Math.round(Math.max(.85,Math.pow(fraction,2)*ceiling)*100)/100;
}
export function playerFromIndependentInput(input: FootballInput): Player {
  const {overall,confidence,source}=independentRating(input);
  const pos=input.position as Position;
  const is=(...positions:string[])=>positions.includes(pos);
  const attributes:Player['attributes']={athleticism:overall,footballIQ:overall};
  if(is('QB')) attributes.passing=overall;
  if(is('QB','RB','FB')) attributes.rushing=overall;
  if(is('RB','FB','WR','TE')) attributes.receiving=overall;
  if(isOffensiveLine(pos)){attributes.passBlocking=overall;attributes.runBlocking=overall;}
  if(is('EDGE','DE','DT','NT')) attributes.passRush=overall;
  if(is('EDGE','DE','DT','NT','LB')) attributes.runDefense=overall;
  if(is('LB','CB','S','FS','SS')) attributes.coverage=overall;
  if(is('K','P')) attributes.kicking=overall;
  return {
    id:input.id, playerId:input.id, name:input.name, fullName:input.name,
    team:input.team,teamId:input.team,teamAbbreviation:input.team,teamCity:'NFL',
    position:pos,active:input.active,rosterSeason:2026,rosterLastUpdated:'2026-09-06',
    starter:input.depth===1,projectedStarter:input.depth===1,depthChartOrder:input.depth??undefined,
    experience:input.experience??undefined,ovr:overall,overall:overall,overallRating:overall,
    ratingSource:source,ratingSeason:2026,ratingStatus:confidence==='editorial'?'EDITORIAL':'ESTIMATED',
    ratingConfidence:confidence,ratingExplanation:isOffensiveLine(pos)
      ? 'Low-confidence role/experience estimate; individual blocking quality is not measured by this data.'
      : confidence==='editorial'?'Independent owner assessment.':'Regularized 2025 production and 2026 depth-role estimate.',
    salary:estimatePlayerSalary(pos,overall),salaryType:'estimated',salarySource:'Ball Knower gameplay estimate v1',
    attributes,highlightStat:'Ball Knower estimate · not an official league rating',
  };
}

export type ProjectionFormat='standard'|'half_ppr'|'ppr';
/** Snapshot forecast, not a live injury feed or a claim of precise predictive accuracy. */
export function independentProjection(input:FootballInput,format:ProjectionFormat='ppr'){
  const pos=input.position; const s=input.stats; const v=(k:string)=>finite(s[k]);
  if(!['QB','RB','WR','TE','K'].includes(pos)) return null;
  const catches=format==='ppr'?1:format==='half_ppr'?.5:0;
  const basePoints=pos==='K'?v('fg_made')*3-v('fg_missed')+v('pat_made')-v('pat_missed'):
    v('passing_yards')/25+v('passing_tds')*4-v('passing_interceptions')*2
    +(v('rushing_yards')+v('receiving_yards'))/10+(v('rushing_tds')+v('receiving_tds'))*6
    +v('receptions')*catches+2*(v('passing_2pt_conversions')+v('rushing_2pt_conversions')+v('receiving_2pt_conversions'))-(v('rushing_fumbles_lost')+v('receiving_fumbles_lost')+v('sack_fumbles_lost'))*2;
  const hasStats=Object.keys(s).length>0; const games=v('games');
  const rank=input.depth??5;
  const rolePoints=pos==='QB'?(rank===1?17:rank===2?3:1):pos==='RB'?(rank===1?11+2*catches:rank===2?6+catches:2):
    pos==='WR'?(rank===1?9+4*catches:rank===2?5+2*catches:2+catches):
    pos==='TE'?(rank===1?6+3*catches:rank===2?3+catches:1):rank===1?7.5:1;
  // A full-season prior stabilizes small samples; depth changes are explicit and bounded.
  const weight=games/(games+7);
  const historicalPace=games>0?basePoints/games:rolePoints;
  const roleDiscount=pos==='QB'&&rank>1?.18:rank>=4?.45:rank===3?.7:1;
  const availability=input.rosterStatus==='RES'?.55:1;
  const projected=Math.max(.5,17*(historicalPace*weight*.9+rolePoints*(1-weight))*roleDiscount*availability);
  return {
    actualPoints:hasStats?Math.round(basePoints*10)/10:null,
    projectedPoints:Math.round(projected*10)/10,
    reason:`Ball Knower snapshot model: 2025 ${games||'no recorded'} games, ${input.depth===null?'unconfirmed depth role':`depth rank ${input.depth}`}; historical pace is shrunk toward a positional role prior.${input.rosterStatus==='RES'?' Reserve-list availability is discounted.':''} Not a live injury forecast.`,
  };
}
