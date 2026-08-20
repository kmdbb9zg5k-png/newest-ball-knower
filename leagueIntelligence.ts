import { League, Player } from './types';
import { calculateTeamRatings, getPlayerOvr } from './evaluation';
import { LeagueTransaction } from './fantasySeasonCloud';

export type PowerRanking={rank:number;memberId:string;memberName:string;score:number;previousRank?:number;movement:number;reason:string;record:string;teamOvr:number};
export type DraftGrade={memberId:string;memberName:string;grade:string;score:number;bestPick?:Player;worstValue?:Player;capEfficiency:number;balance:number;summary:string};
export type AwardWinner={award:string;player:Player;memberId:string;memberName:string;reason:string};
export type Rivalry={aId:string;bId:string;aName:string;bName:string;aWins:number;bWins:number;games:number;pointDiff:number;heat:number;label:string};
export type Achievement={id:string;title:string;description:string;emoji:string;memberId:string;memberName:string};
export type LeagueRecord={label:string;value:string;holder:string;detail:string};
export type Storyline={kind:'headline'|'injury'|'trade'|'playoff'|'rivalry'|'award'|'record';headline:string;body:string;priority:number};
export type OwnerReputation={memberId:string;memberName:string;rating:number;tier:string;winPct:number;championships:number;achievements:number;record:string;reason:string};
export type TradeAnalysis={fairness:number;winner:'proposer'|'recipient'|'even';proposerValue:number;recipientValue:number;proposerCapDelta:number;recipientCapDelta:number;proposerOvrDelta:number;recipientOvrDelta:number;explanation:string};

const grade=(score:number)=>score>=96?'A+':score>=92?'A':score>=89?'A-':score>=86?'B+':score>=82?'B':score>=79?'B-':score>=75?'C+':score>=71?'C':score>=67?'C-':score>=62?'D':'F';
const memberById=(league:League,id:string)=>league.members.find(m=>m.id===id||m.userId===id);
const recordOf=(league:League,id:string)=>{const s=league.seasonResult?.standings.find(x=>x.memberId===id);return s?`${s.wins}-${s.losses}${s.ties?`-${s.ties}`:''}`:'0-0';};
const playerValue=(p:Player)=>getPlayerOvr(p)*1.15-(Number(p.salary)||0)*0.32+((p.age||27)<=25?2.5:0);

export function buildPowerRankings(league:League,previous?:PowerRanking[]):PowerRanking[]{
  const prior=new Map((previous||[]).map(x=>[x.memberId,x.rank]));
  return league.members.map(m=>{
    const ratings=m.teamRatings||calculateTeamRatings(m.roster||[]);
    const s=league.seasonResult?.standings.find(x=>x.memberId===m.id);
    const winPct=s?.winPercentage||0;
    const diff=s?.pointDifferential||0;
    const score=Math.round(Math.max(0,Math.min(100,ratings.overall*.48+ratings.balanceScore*.14+ratings.efficiencyRating*.12+winPct*22+Math.max(-5,Math.min(5,diff/18))+8)));
    const reason=s?`${s.wins}-${s.losses}${s.ties?`-${s.ties}`:''} with a ${ratings.overall} OVR roster and ${diff>=0?'+':''}${diff} point differential.`:`${ratings.overall} OVR roster, ${ratings.balanceScore} balance and ${ratings.efficiencyRating} cap efficiency before games begin.`;
    return {rank:0,memberId:m.id,memberName:m.userName,score,previousRank:prior.get(m.id),movement:0,reason,record:recordOf(league,m.id),teamOvr:ratings.overall};
  }).sort((a,b)=>b.score-a.score).map((x,i)=>({...x,rank:i+1,movement:x.previousRank?x.previousRank-(i+1):0}));
}

export function buildDraftGrades(league:League):DraftGrade[]{
  return league.members.map(m=>{
    const roster=m.roster||[];const ratings=m.teamRatings||calculateTeamRatings(roster);const spent=roster.reduce((s,p)=>s+(Number(p.salary)||0),0);
    const complete=roster.length===20; const capEfficiency=Math.round(Math.max(0,Math.min(100,ratings.efficiencyRating+(league.salaryCap-spent)*.12)));
    const score=Math.round(Math.max(0,Math.min(100,ratings.overall*.48+ratings.balanceScore*.24+capEfficiency*.22+(complete?6:-12))));
    const sorted=[...roster].sort((a,b)=>(playerValue(b)/(Math.max(1,b.salary)))-(playerValue(a)/(Math.max(1,a.salary))));
    const costly=[...roster].sort((a,b)=>(b.salary/Math.max(1,getPlayerOvr(b)-65))-(a.salary/Math.max(1,getPlayerOvr(a)-65)));
    return {memberId:m.id,memberName:m.userName,grade:grade(score),score,bestPick:sorted[0],worstValue:costly[0],capEfficiency,balance:ratings.balanceScore,summary:complete?`${ratings.overall} OVR, ${ratings.balanceScore} balance and ${capEfficiency} cap-efficiency score.`:'Incomplete roster prevented a full grade.'};
  }).sort((a,b)=>b.score-a.score);
}

export function buildAwards(league:League):AwardWinner[]{
  if(!league.members.length) return [];
  const standingRank=new Map((league.seasonResult?.standings||[]).map((s,i)=>[s.memberId,i]));
  const entries=league.members.flatMap(m=>(m.roster||[]).map(p=>({m,p,boost:Math.max(0,8-(standingRank.get(m.id)??8))*0.6})));
  const pick=(name:string,test:(p:Player)=>boolean)=>{const candidates=entries.filter(x=>test(x.p)).sort((a,b)=>(getPlayerOvr(b.p)+b.boost)-(getPlayerOvr(a.p)+a.boost));const x=candidates[0];return x?{award:name,player:x.p,memberId:x.m.id,memberName:x.m.userName,reason:`${getPlayerOvr(x.p)} OVR centerpiece on ${x.m.userName}'s roster${league.seasonResult?' with winning context':''}.`}:null;};
  const offense=new Set(['QB','RB','FB','WR','TE','OT','LT','RT','OG','LG','RG','C']);
  const defense=new Set(['EDGE','DT','DE','NT','LB','CB','S','FS','SS']);
  return [pick('BALL KNOWER MVP',()=>true),pick('OFFENSIVE PLAYER OF THE YEAR',p=>offense.has(p.position)),pick('DEFENSIVE PLAYER OF THE YEAR',p=>defense.has(p.position)),pick('ROOKIE OF THE YEAR',p=>(p.experience??9)<=1||(p.age??99)<=23)].filter(Boolean) as AwardWinner[];
}

export function buildRivalries(league:League):Rivalry[]{
  const map=new Map<string,{aId:string;bId:string;aWins:number;bWins:number;games:number;pointDiff:number}>();
  for(const g of league.seasonResult?.games||[]){const ids=[g.homeMemberId,g.awayMemberId].sort();const key=ids.join('|');const row=map.get(key)||{aId:ids[0],bId:ids[1],aWins:0,bWins:0,games:0,pointDiff:0};row.games++; if(g.winnerId===row.aId)row.aWins++;else if(g.winnerId===row.bId)row.bWins++; const aScore=g.homeMemberId===row.aId?g.homeScore:g.awayScore;const bScore=g.homeMemberId===row.bId?g.homeScore:g.awayScore;row.pointDiff+=aScore-bScore;map.set(key,row);}
  return [...map.values()].map(r=>{const a=memberById(league,r.aId);const b=memberById(league,r.bId);const close=Math.max(0,20-Math.abs(r.pointDiff));const heat=Math.round(r.games*12+close+Math.min(r.aWins,r.bWins)*8);return {...r,aName:a?.userName||'Owner A',bName:b?.userName||'Owner B',heat,label:heat>=70?'BLOOD FEUD':heat>=45?'HEATED':heat>=25?'RIVALRY':'DEVELOPING'};}).sort((a,b)=>b.heat-a.heat);
}

export function buildAchievements(league:League,transactions:LeagueTransaction[]=[]):Achievement[]{
  const out:Achievement[]=[]; const standings=league.seasonResult?.standings||[];
  for(const m of league.members){const s=standings.find(x=>x.memberId===m.id);const ratings=m.teamRatings||calculateTeamRatings(m.roster||[]);const spent=(m.roster||[]).reduce((sum,p)=>sum+(Number(p.salary)||0),0);const add=(id:string,title:string,description:string,emoji:string)=>out.push({id:`${m.id}-${id}`,title,description,emoji,memberId:m.id,memberName:m.userName});
    if(s?.rank===1)add('champ','League Champion','Finished #1 in the league.','🏆'); if(s&&s.losses===0&&s.wins>0)add('perfect','Undefeated','Completed the season without a loss.','💎'); if(ratings.efficiencyRating>=85)add('cap','Cap Wizard','Built an elite-value roster under the cap.','🧙'); if(ratings.balanceScore>=90)add('balance','No Weak Links','Posted a 90+ roster balance score.','🛡️'); if(spent<=league.salaryCap*.88&&(m.roster||[]).length===20)add('value','Coupon King','Finished a legal roster with 12%+ cap room.','💰'); if((s?.streak||'').startsWith('W')&&Number((s?.streak||'W0').slice(1))>=5)add('streak','On Fire','Won five or more straight games.','🔥');
    const tradeWins=transactions.filter(t=>t.transactionType==='trade'&&String(t.summary).includes(m.userName)).length;if(tradeWins>=3)add('trader','Front Office Menace','Completed at least three trades.','📞');
  }
  return out;
}

export function buildOwnerReputation(league:League,achievements:Achievement[]):OwnerReputation[]{
  return league.members.map(m=>{const s=league.seasonResult?.standings.find(x=>x.memberId===m.id);const games=(s?.wins||0)+(s?.losses||0)+(s?.ties||0);const winPct=games?((s?.wins||0)+.5*(s?.ties||0))/games:0;const champ=s?.rank===1?1:0;const badgeCount=achievements.filter(a=>a.memberId===m.id).length;const ratings=m.teamRatings||calculateTeamRatings(m.roster||[]);const rating=Math.round(Math.max(0,Math.min(100,42+winPct*28+champ*12+badgeCount*2+ratings.efficiencyRating*.08+ratings.balanceScore*.06)));const tier=rating>=90?'ELITE BALL KNOWER':rating>=80?'CERTIFIED':rating>=70?'KNOWS BALL':rating>=60?'SOLID GM':'PROVE IT';return {memberId:m.id,memberName:m.userName,rating,tier,winPct,championships:champ,achievements:badgeCount,record:recordOf(league,m.id),reason:`${Math.round(winPct*100)}% win rate, ${badgeCount} badge${badgeCount===1?'':'s'}, ${ratings.overall} roster OVR.`};}).sort((a,b)=>b.rating-a.rating);
}

export function analyzeTrade(league:League,proposerId:string,recipientId:string,offeredIds:string[],requestedIds:string[]):TradeAnalysis{
  const proposer=memberById(league,proposerId);const recipient=memberById(league,recipientId);if(!proposer||!recipient)return {fairness:0,winner:'even',proposerValue:0,recipientValue:0,proposerCapDelta:0,recipientCapDelta:0,proposerOvrDelta:0,recipientOvrDelta:0,explanation:'Choose two valid league owners.'};
  const offer=(proposer.roster||[]).filter(p=>offeredIds.includes(p.id));const request=(recipient.roster||[]).filter(p=>requestedIds.includes(p.id));const proposerValue=request.reduce((s,p)=>s+playerValue(p),0);const recipientValue=offer.reduce((s,p)=>s+playerValue(p),0);const total=Math.max(1,proposerValue+recipientValue);const fairness=Math.round(Math.max(0,100-Math.abs(proposerValue-recipientValue)/total*120));const winner=proposerValue>recipientValue*1.08?'proposer':recipientValue>proposerValue*1.08?'recipient':'even';
  const pBefore=calculateTeamRatings(proposer.roster||[]).overall;const rBefore=calculateTeamRatings(recipient.roster||[]).overall;const pAfter=[...(proposer.roster||[]).filter(p=>!offeredIds.includes(p.id)),...request];const rAfter=[...(recipient.roster||[]).filter(p=>!requestedIds.includes(p.id)),...offer];const pAfterOvr=calculateTeamRatings(pAfter).overall;const rAfterOvr=calculateTeamRatings(rAfter).overall;const offerSalary=offer.reduce((s,p)=>s+p.salary,0);const requestSalary=request.reduce((s,p)=>s+p.salary,0);
  return {fairness,winner,proposerValue:Math.round(proposerValue),recipientValue:Math.round(recipientValue),proposerCapDelta:Number((requestSalary-offerSalary).toFixed(1)),recipientCapDelta:Number((offerSalary-requestSalary).toFixed(1)),proposerOvrDelta:pAfterOvr-pBefore,recipientOvrDelta:rAfterOvr-rBefore,explanation:winner==='even'?`Balanced deal: ${fairness}% fairness with similar total value.`:`${winner==='proposer'?proposer.userName:recipient.userName} projects to gain more roster value; fairness scores ${fairness}%.`};
}

export function buildLeagueRecords(league:League):LeagueRecord[]{
  const result=league.seasonResult;if(!result)return [];
  const games=result.games;const biggest=[...games].sort((a,b)=>Math.abs((b.homeScore-b.awayScore))-Math.abs((a.homeScore-a.awayScore)))[0];const highest=[...result.standings].sort((a,b)=>b.pointsFor-a.pointsFor)[0];const defense=[...result.standings].sort((a,b)=>a.pointsAgainst-b.pointsAgainst)[0];const streak=[...result.standings].sort((a,b)=>Number((b.streak||'').slice(1))-Number((a.streak||'').slice(1)))[0];
  const out:LeagueRecord[]=[];if(biggest){const winner=memberById(league,biggest.winnerId);out.push({label:'Biggest Blowout',value:`${Math.abs(biggest.homeScore-biggest.awayScore)} pts`,holder:winner?.userName||'Unknown',detail:`Week ${biggest.week}: ${biggest.homeScore}-${biggest.awayScore}`});} if(highest)out.push({label:'Scoring Machine',value:String(highest.pointsFor),holder:highest.memberName,detail:'Most points scored in a season'});if(defense)out.push({label:'Clamp City',value:String(defense.pointsAgainst),holder:defense.memberName,detail:'Fewest points allowed'});if(streak)out.push({label:'Longest Current Streak',value:streak.streak,holder:streak.memberName,detail:'Best finishing streak'});return out;
}

export function buildStorylines(league:League,rivalries:Rivalry[],transactions:LeagueTransaction[]=[]):Storyline[]{
  const out:Storyline[]=[];const s=league.seasonResult?.standings||[];const leader=s[0];if(leader)out.push({kind:'headline',headline:`${leader.memberName} owns the top spot`,body:`A ${leader.wins}-${leader.losses}${leader.ties?`-${leader.ties}`:''} record and ${leader.pointDifferential>=0?'+':''}${leader.pointDifferential} point differential have set the pace.`,priority:100});const hot=s.find(x=>(x.streak||'').startsWith('W')&&Number(x.streak.slice(1))>=4);if(hot)out.push({kind:'playoff',headline:`${hot.memberName} is surging`,body:`${hot.streak} has turned the playoff race into a problem for everybody else.`,priority:90});const rival=rivalries[0];if(rival)out.push({kind:'rivalry',headline:`${rival.aName} vs ${rival.bName} is becoming personal`,body:`${rival.games} meetings, ${rival.aWins}-${rival.bWins} head-to-head, rivalry heat ${rival.heat}.`,priority:80});const recentTrade=transactions.find(t=>t.transactionType==='trade');if(recentTrade)out.push({kind:'trade',headline:'Trade market is moving',body:recentTrade.summary,priority:70});const upset=(league.seasonResult?.games||[]).map(g=>{const winner=s.find(x=>x.memberId===g.winnerId);const loser=s.find(x=>x.memberId===g.loserId);return {g,gap:(loser?.teamRating||0)-(winner?.teamRating||0)};}).sort((a,b)=>b.gap-a.gap)[0];if(upset&&upset.gap>2)out.push({kind:'headline',headline:'Upset alert became a receipt',body:`${memberById(league,upset.g.winnerId)?.userName} knocked off a roster rated ${upset.gap} OVR higher.`,priority:75});return out.sort((a,b)=>b.priority-a.priority);
}

export function buildLeagueNews(league:League,storylines:Storyline[],awards:AwardWinner[],records:LeagueRecord[]):Storyline[]{
  const out=[...storylines];if(awards[0])out.push({kind:'award',headline:`MVP watch: ${awards[0].player.name}`,body:`${awards[0].memberName}'s ${awards[0].player.position} is currently the Ball Knower MVP favorite.`,priority:65});if(records[0])out.push({kind:'record',headline:`Record book update: ${records[0].holder}`,body:`${records[0].label}: ${records[0].value}.`,priority:55});if(!league.seasonResult)out.push({kind:'headline',headline:'The league is still being built',body:'Draft grades and roster strength are live now; weekly storylines unlock when games begin.',priority:50});return out.sort((a,b)=>b.priority-a.priority);
}
