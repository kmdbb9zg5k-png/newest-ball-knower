export type OwnerSeasonStage='preseason'|'regular'|'wild-card'|'divisional'|'conference'|'super-bowl';

export type OwnerSeasonSnapshot={
  abbr:string;season:number;week:number;stage:OwnerSeasonStage;wins:number;losses:number;
  cashM:number;ticketPrice:number;parkingPrice:number;fanTrust:number;stadium:number;
  gmCostM:number;coachCostM:number;
};

export type OwnerCalendarWeek={week:number;isBye:boolean;isHome:boolean};

export const OWNER_TEAM_ABBRS=['ARI','ATL','BAL','BUF','CAR','CHI','CIN','CLE','DAL','DEN','DET','GB','HOU','IND','JAX','KC','LV','LAC','LAR','MIA','MIN','NE','NO','NYG','NYJ','PHI','PIT','SF','SEA','TB','TEN','WAS'] as const;
const OWNER_2026_BYE_WEEK:Record<string,number>={ARI:14,ATL:11,BAL:13,BUF:7,CAR:5,CHI:10,CIN:6,CLE:11,DAL:14,DEN:10,DET:6,GB:11,HOU:8,IND:13,JAX:7,KC:5,LV:13,LAC:7,LAR:11,MIA:6,MIN:6,NE:11,NO:8,NYG:8,NYJ:13,PHI:10,PIT:9,SF:8,SEA:11,TB:10,TEN:9,WAS:7};

export const owner2026Calendar=(abbr:string):OwnerCalendarWeek[]=>{
  const teamIndex=Math.max(0,OWNER_TEAM_ABBRS.indexOf(abbr as typeof OWNER_TEAM_ABBRS[number]));
  const bye=OWNER_2026_BYE_WEEK[abbr]||10;
  const calendar=Array.from({length:18},(_,index)=>{const week=index+1;const isBye=week===bye;let isHome=!isBye&&(week+teamIndex)%2===0;if(abbr==='WAS'&&week===1)isHome=false;if(abbr==='PHI'&&week===1)isHome=true;return{week,isBye,isHome};});
  const homeCount=calendar.filter(entry=>entry.isHome).length;
  if(homeCount<8){const replacement=calendar.find(entry=>!entry.isBye&&!entry.isHome&&!(abbr==='WAS'&&entry.week===1));if(replacement)replacement.isHome=true;}
  if(homeCount>9){const replacement=[...calendar].reverse().find(entry=>entry.isHome&&!(abbr==='PHI'&&entry.week===1));if(replacement)replacement.isHome=false;}
  return calendar;
};

export const ownerCalendarWeek=(abbr:string,week:number)=>owner2026Calendar(abbr).find(entry=>entry.week===week);

export type OwnerSeasonAdvance={
  nextStage:OwnerSeasonStage;nextWeek:number;seasonEnded:boolean;playoffQualified:boolean;
  wonChampionship:boolean;revenueM:number;expensesM:number;profitM:number;
};

const round=(value:number)=>Math.round(value*10)/10;

export const qualifiesForOwnerPlayoffs=(wins:number,losses:number)=>wins>=9||(wins===8&&losses<=9);

export const ownerGameRevenue=(state:OwnerSeasonSnapshot,homeGame:boolean,playoff:boolean)=>{
  if(!homeGame)return 0;
  const demand=Math.max(.55,Math.min(1,(state.fanTrust+state.stadium)/180+(state.wins-state.losses)*.012));
  const tickets=state.ticketPrice*.052*demand;
  const parking=state.parkingPrice*.016*demand;
  return round((tickets+parking)*(playoff?1.65:1));
};

export const advanceOwnerSeason=(state:OwnerSeasonSnapshot,won:boolean):OwnerSeasonAdvance=>{
  const calendarWeek=ownerCalendarWeek(state.abbr,state.week);
  const regularRevenue=ownerGameRevenue(state,Boolean(calendarWeek?.isHome),false);
  const playoffRevenue=ownerGameRevenue(state,true,true);
  const base={revenueM:regularRevenue,expensesM:0,profitM:regularRevenue};
  if(state.stage==='preseason')return{...base,nextStage:'regular',nextWeek:1,seasonEnded:false,playoffQualified:false,wonChampionship:false};
  if(state.stage==='regular'&&state.week<18)return{...base,nextStage:'regular',nextWeek:state.week+1,seasonEnded:false,playoffQualified:false,wonChampionship:false};
  if(state.stage==='regular'){
    const finalWins=state.wins+(won?1:0);const finalLosses=state.losses+(won?0:1);
    const qualified=qualifiesForOwnerPlayoffs(finalWins,finalLosses);
    if(qualified)return{...base,nextStage:'wild-card',nextWeek:18,seasonEnded:false,playoffQualified:true,wonChampionship:false};
  }
  if(state.stage==='wild-card'&&won)return{revenueM:playoffRevenue,expensesM:0,profitM:playoffRevenue,nextStage:'divisional',nextWeek:19,seasonEnded:false,playoffQualified:true,wonChampionship:false};
  if(state.stage==='divisional'&&won)return{revenueM:playoffRevenue,expensesM:0,profitM:playoffRevenue,nextStage:'conference',nextWeek:20,seasonEnded:false,playoffQualified:true,wonChampionship:false};
  if(state.stage==='conference'&&won)return{revenueM:playoffRevenue,expensesM:0,profitM:playoffRevenue,nextStage:'super-bowl',nextWeek:21,seasonEnded:false,playoffQualified:true,wonChampionship:false};
  const champion=state.stage==='super-bowl'&&won;
  const expenses=round(state.gmCostM+state.coachCostM);
  const closingGameRevenue=state.stage==='regular'?base.revenueM:state.stage==='super-bowl'?0:playoffRevenue;
  const revenue=round(closingGameRevenue+(champion?85:0));
  return{nextStage:'preseason',nextWeek:0,seasonEnded:true,playoffQualified:state.stage!=='regular',wonChampionship:champion,revenueM:revenue,expensesM:expenses,profitM:round(revenue-expenses)};
};

export const ownerStageLabel=(stage:OwnerSeasonStage,week:number)=>stage==='preseason'?'PRESEASON':stage==='regular'?`WEEK ${week}`:stage.replace('-',' ').toUpperCase();
