import { SOLO_TEAM_THEMES } from './soloUniverse';

export type OwnerSeasonStage='preseason'|'regular'|'wild-card'|'divisional'|'conference'|'super-bowl';

export type OwnerSeasonSnapshot={
  abbr:string;season:number;week:number;stage:OwnerSeasonStage;wins:number;losses:number;
  cashM:number;ticketPrice:number;parkingPrice:number;fanTrust:number;stadium:number;
  gmCostM:number;coachCostM:number;playoffSeed?:number;
};

export type OwnerCalendarWeek={week:number;isBye:boolean;isHome:boolean};

export const OWNER_TEAM_ABBRS=SOLO_TEAM_THEMES.map(team=>team.abbr);

export const normalizeOwnerAbbr=(abbr:string)=>OWNER_TEAM_ABBRS.includes(abbr)?abbr:SOLO_TEAM_THEMES[0].abbr;

export const owner2026Calendar=(abbr:string):OwnerCalendarWeek[]=>{
  const normalizedAbbr=normalizeOwnerAbbr(abbr);
  const teamIndex=Math.max(0,OWNER_TEAM_ABBRS.indexOf(normalizedAbbr));
  const bye=teamIndex<12?5+Math.floor(teamIndex/2):11+Math.floor((teamIndex-12)/4);
  return Array.from({length:18},(_,index)=>{const week=index+1;const isBye=week===bye;return{week,isBye,isHome:!isBye&&(week+teamIndex)%2===0};});
};

export const ownerSeasonCalendar=(abbr:string,season:number):OwnerCalendarWeek[]=>{
  const calendar=owner2026Calendar(abbr);
  if(season<=2026)return calendar;
  const reverseHosts=(season-2026)%2===1;
  return calendar.map(entry=>({...entry,isHome:entry.isBye?false:reverseHosts?!entry.isHome:entry.isHome}));
};

export const ownerCalendarWeek=(abbr:string,week:number,season=2026)=>ownerSeasonCalendar(abbr,season).find(entry=>entry.week===week);

export const migrateOwnerLegacyWeek=(abbr:string,gameNumber:number)=>{
  if(gameNumber<=0)return 0;
  const gameWeeks=owner2026Calendar(abbr).filter(entry=>!entry.isBye);
  return gameWeeks[Math.min(gameNumber-1,gameWeeks.length-1)]?.week||gameNumber;
};

export type OwnerSeasonAdvance={
  nextStage:OwnerSeasonStage;nextWeek:number;seasonEnded:boolean;playoffQualified:boolean;
  wonChampionship:boolean;revenueM:number;expensesM:number;profitM:number;playoffSeed?:number;
};

const round=(value:number)=>Math.round(value*10)/10;

export const qualifiesForOwnerPlayoffs=(wins:number,losses:number)=>wins>=9||(wins===8&&losses<=9);

export const ownerPlayoffSeed=(wins:number,abbr:string,season:number)=>{
  if(wins>=13)return 1;
  if(wins===12)return 2;
  const tiebreak=[...abbr].reduce((total,char)=>total+char.charCodeAt(0),season)%2;
  if(wins===11)return 3+tiebreak;
  if(wins===10)return 4+tiebreak;
  if(wins===9)return 6;
  return 7;
};

export const ownerPlayoffHomeGame=(state:OwnerSeasonSnapshot)=>{
  const seed=state.playoffSeed||ownerPlayoffSeed(state.wins,state.abbr,state.season);
  if(state.stage==='wild-card')return seed<=4;
  if(state.stage==='divisional')return seed===1;
  if(state.stage==='conference')return seed<=2;
  return false;
};

export const ownerGameRevenue=(state:OwnerSeasonSnapshot,homeGame:boolean,playoff:boolean)=>{
  if(!homeGame)return 0;
  const demand=Math.max(.55,Math.min(1,(state.fanTrust+state.stadium)/180+(state.wins-state.losses)*.012));
  const tickets=state.ticketPrice*.052*demand;
  const parking=state.parkingPrice*.016*demand;
  return round((tickets+parking)*(playoff?1.65:1));
};

export const advanceOwnerSeason=(state:OwnerSeasonSnapshot,won:boolean):OwnerSeasonAdvance=>{
  const calendarWeek=ownerCalendarWeek(state.abbr,state.week,state.season);
  const regularRevenue=ownerGameRevenue(state,Boolean(calendarWeek?.isHome),false);
  const playoffRevenue=ownerGameRevenue(state,ownerPlayoffHomeGame(state),true);
  const base={revenueM:regularRevenue,expensesM:0,profitM:regularRevenue};
  if(state.stage==='preseason')return{...base,nextStage:'regular',nextWeek:1,seasonEnded:false,playoffQualified:false,wonChampionship:false};
  if(state.stage==='regular'&&state.week<18)return{...base,nextStage:'regular',nextWeek:state.week+1,seasonEnded:false,playoffQualified:false,wonChampionship:false};
  if(state.stage==='regular'){
    const finalWins=state.wins+(won?1:0);const finalLosses=state.losses+(won?0:1);
    const qualified=qualifiesForOwnerPlayoffs(finalWins,finalLosses);
    if(qualified){const playoffSeed=ownerPlayoffSeed(finalWins,state.abbr,state.season);return{...base,nextStage:playoffSeed===1?'divisional':'wild-card',nextWeek:playoffSeed===1?19:18,seasonEnded:false,playoffQualified:true,wonChampionship:false,playoffSeed};}
  }
  if(state.stage==='wild-card'&&won)return{revenueM:playoffRevenue,expensesM:0,profitM:playoffRevenue,nextStage:'divisional',nextWeek:19,seasonEnded:false,playoffQualified:true,wonChampionship:false,playoffSeed:state.playoffSeed};
  if(state.stage==='divisional'&&won)return{revenueM:playoffRevenue,expensesM:0,profitM:playoffRevenue,nextStage:'conference',nextWeek:20,seasonEnded:false,playoffQualified:true,wonChampionship:false,playoffSeed:state.playoffSeed};
  if(state.stage==='conference'&&won)return{revenueM:playoffRevenue,expensesM:0,profitM:playoffRevenue,nextStage:'super-bowl',nextWeek:21,seasonEnded:false,playoffQualified:true,wonChampionship:false,playoffSeed:state.playoffSeed};
  const champion=state.stage==='super-bowl'&&won;
  const expenses=round(state.gmCostM+state.coachCostM);
  const closingGameRevenue=state.stage==='regular'?base.revenueM:state.stage==='super-bowl'?0:playoffRevenue;
  const revenue=round(closingGameRevenue+(champion?85:0));
  return{nextStage:'preseason',nextWeek:0,seasonEnded:true,playoffQualified:state.stage!=='regular',wonChampionship:champion,revenueM:revenue,expensesM:expenses,profitM:round(revenue-expenses)};
};

export const ownerStageLabel=(stage:OwnerSeasonStage,week:number)=>stage==='preseason'?'PRESEASON':stage==='regular'?`WEEK ${week}`:stage==='super-bowl'?'LEGACY BOWL':stage.replace('-',' ').toUpperCase();
