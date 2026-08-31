export type OwnerSeasonStage='preseason'|'regular'|'wild-card'|'divisional'|'conference'|'super-bowl';

export type OwnerSeasonSnapshot={
  season:number;week:number;stage:OwnerSeasonStage;wins:number;losses:number;
  cashM:number;ticketPrice:number;parkingPrice:number;fanTrust:number;stadium:number;
  gmCostM:number;coachCostM:number;
};

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
  const regularRevenue=ownerGameRevenue(state,state.week%2===1,false);
  const playoffRevenue=ownerGameRevenue(state,true,true);
  const base={revenueM:regularRevenue,expensesM:0,profitM:regularRevenue};
  if(state.stage==='preseason')return{...base,nextStage:'regular',nextWeek:1,seasonEnded:false,playoffQualified:false,wonChampionship:false};
  if(state.stage==='regular'&&state.week<17)return{...base,nextStage:'regular',nextWeek:state.week+1,seasonEnded:false,playoffQualified:false,wonChampionship:false};
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
