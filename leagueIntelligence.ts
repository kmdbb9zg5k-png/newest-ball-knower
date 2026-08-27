import { League, Player } from './types';
import { calculateTeamRatings, getPlayerOvr } from './evaluation';
import { LeagueTransaction } from './fantasySeasonCloud';
import { resolveSeasonChampion } from './simulation';

export type PowerRanking={rank:number;memberId:string;memberName:string;score:number;previousRank?:number;movement:number;reason:string;record:string;teamOvr:number};
export type DraftGrade={memberId:string;memberName:string;grade:string;score:number;bestPick?:Player;projectionScore:number;valueScore:number;balance:number;summary:string};
export type FantasyProjectionLike={player_name:string;team:string;overall_rank:number;projected_points_2026:number};
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

const normalizeName=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const projectionKey=(name:string,team:string)=>`${normalizeName(name)}|${team.toUpperCase()}`;
const clamp=(value:number,min=0,max=100)=>Math.max(min,Math.min(max,value));
const scale=(value:number,min:number,max:number,low=62,high=96)=>max<=min?(low+high)/2:low+(clamp((value-min)/(max-min),0,1)*(high-low));

const rosterConstructionScore=(roster:Player[])=>{
  const count=(position:string)=>roster.filter(player=>player.position===position).length;
  const starters={QB:1,RB:2,WR:2,TE:1,K:1,DST:1};
  const targets={QB:2,RB:5,WR:7,TE:2,K:2,DST:2};
  let score=100;
  for(const [position,minimum] of Object.entries(starters))score-=Math.max(0,minimum-count(position))*18;
  for(const [position,target] of Object.entries(targets))score-=Math.max(0,count(position)-target)*(position==='QB'||position==='TE'?8:4);
  if(roster.length<20)score-=(20-roster.length)*3;
  return Math.round(clamp(score));
};

const fantasyRosterProjection=(roster:Player[],projectionByPlayer:Map<string,FantasyProjectionLike>)=>{
  const projected=(player:Player)=>projectionByPlayer.get(projectionKey(player.name,player.team))?.projected_points_2026||0;
  const available=[...roster].sort((a,b)=>projected(b)-projected(a)||a.name.localeCompare(b.name));
  const used=new Set<string>();
  const take=(positions:string[],count:number)=>available.filter(player=>positions.includes(player.position)&&!used.has(player.id)).slice(0,count).map(player=>{used.add(player.id);return projected(player);});
  const starters=[...take(['QB'],1),...take(['RB'],2),...take(['WR'],2),...take(['TE'],1),...take(['RB','WR','TE'],1),...take(['K'],1),...take(['DST'],1)];
  const depth=available.filter(player=>!used.has(player.id)).slice(0,5).map(projected);
  return {total:starters.reduce((sum,value)=>sum+value,0)+depth.reduce((sum,value)=>sum+value*.18,0),coverage:starters.filter(Boolean).length,construction:rosterConstructionScore(roster)};
};

export function buildPowerRankings(league:League,previous?:PowerRanking[],projections:FantasyProjectionLike[]=[]):PowerRanking[]{
  const prior=new Map((previous||[]).map(x=>[x.memberId,x.rank]));
  const projectionByPlayer=new Map(projections.map(projection=>[projectionKey(projection.player_name,projection.team),projection]));
  const metrics=new Map(league.members.map(member=>[member.id,fantasyRosterProjection(member.roster||[],projectionByPlayer)]));
  const totals=[...metrics.values()].map(item=>item.total);const totalMin=totals.length?Math.min(...totals):0;const totalMax=totals.length?Math.max(...totals):0;
  const played=league.seasonResult?.standings||[];
  const ppgRows=played.map(s=>{const games=s.wins+s.losses+s.ties;return games?s.pointsFor/games:0;});
  const diffRows=played.map(s=>{const games=s.wins+s.losses+s.ties;return games?s.pointDifferential/games:0;});
  const ppgMin=ppgRows.length?Math.min(...ppgRows):0,ppgMax=ppgRows.length?Math.max(...ppgRows):0,diffMin=diffRows.length?Math.min(...diffRows):0,diffMax=diffRows.length?Math.max(...diffRows):0;
  return league.members.map(m=>{
    const s=league.seasonResult?.standings.find(x=>x.memberId===m.id);
    const games=(s?.wins||0)+(s?.losses||0)+(s?.ties||0);
    const winPct=games?((s?.wins||0)+.5*(s?.ties||0))/games:0;
    const diff=s?.pointDifferential||0;const diffPerGame=games?diff/games:0;
    const metric=metrics.get(m.id)||{total:0,coverage:0,construction:0};
    const projectionScore=projectionByPlayer.size?scale(metric.total,totalMin,totalMax):metric.construction;
    const pointsPerGame=games?(s?.pointsFor||0)/games:0;
    const scoringScore=scale(pointsPerGame,ppgMin,ppgMax);const differentialScore=scale(diffPerGame,diffMin,diffMax);
    const score=Math.round(games?winPct*35+scoringScore*.25+projectionScore*.30+differentialScore*.10:projectionScore*.80+metric.construction*.20);
    const reason=games?`${s?.wins}-${s?.losses}${s?.ties?`-${s.ties}`:''} · ${pointsPerGame.toFixed(1)} points/game · ${diff>=0?'+':''}${diff} differential · ${Math.round(projectionScore)} projected roster strength.`:`Preseason: ${Math.round(projectionScore)} projection score · ${metric.construction} roster-construction score.`;
    return {rank:0,memberId:m.id,memberName:m.userName,score:Math.round(clamp(score)),previousRank:prior.get(m.id),movement:0,reason,record:recordOf(league,m.id),teamOvr:Math.round(projectionScore)};
  }).sort((a,b)=>b.score-a.score).map((x,i)=>({...x,rank:i+1,movement:x.previousRank?x.previousRank-(i+1):0}));
}

export function buildDraftGrades(league:League,projections:FantasyProjectionLike[]=[]):DraftGrade[]{
  const projectionByPlayer=new Map(projections.map(projection=>[projectionKey(projection.player_name,projection.team),projection]));
  const playerById=new Map(league.members.flatMap(member=>(member.roster||[]).map(player=>[player.id,player] as const)));
  const metrics=new Map(league.members.map(member=>[member.id,fantasyRosterProjection(member.roster||[],projectionByPlayer)]));
  const totals=[...metrics.values()].map(item=>item.total);const totalMin=totals.length?Math.min(...totals):0;const totalMax=totals.length?Math.max(...totals):0;
  return league.members.map(m=>{
    const roster=m.roster||[];const metric=metrics.get(m.id)||{total:0,coverage:0,construction:0};const complete=roster.length===20;
    const projectionScore=Math.round(projectionByPlayer.size?scale(metric.total,totalMin,totalMax):metric.construction);
    const picks=(league.liveDraft?.picks||[]).filter(pick=>pick.memberId===m.id).flatMap(pick=>{const player=playerById.get(pick.playerId);const projection=player&&projectionByPlayer.get(projectionKey(player.name,player.team));return player&&projection?[{player,value:pick.overall-projection.overall_rank}]:[];});
    const averageValue=picks.length?picks.reduce((sum,pick)=>sum+pick.value,0)/picks.length:0;
    const valueScore=Math.round(clamp(70+averageValue*.7));
    const score=Math.round(clamp(projectionScore*.50+metric.construction*.30+valueScore*.20+(complete?0:-18)));
    const bestPick=[...picks].sort((a,b)=>b.value-a.value)[0]?.player;
    return {memberId:m.id,memberName:m.userName,grade:grade(score),score,bestPick,projectionScore,valueScore,balance:metric.construction,summary:complete?`${projectionScore} projection score, ${metric.construction} roster construction and ${valueScore} draft value — no salary-cap grading.`:'Incomplete roster prevented a full grade.'};
  }).sort((a,b)=>b.score-a.score);
}

export function buildAwards(league:League):AwardWinner[]{
  const gamesPlayed=(league.seasonResult?.standings||[]).reduce((sum,row)=>sum+(row.wins||0)+(row.losses||0)+(row.ties||0),0);
  if(!league.members.length||gamesPlayed===0) return [];
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
  const out:Achievement[]=[]; const standings=league.seasonResult?.standings||[];const championId=league.seasonResult?resolveSeasonChampion(league.seasonResult)?.memberId:undefined;
  for(const m of league.members){const s=standings.find(x=>x.memberId===m.id);const construction=rosterConstructionScore(m.roster||[]);const add=(id:string,title:string,description:string,emoji:string)=>out.push({id:`${m.id}-${id}`,title,description,emoji,memberId:m.id,memberName:m.userName});
    if(m.id===championId)add('champ','League Champion','Won the fantasy playoff championship.','🏆'); if(s&&s.losses===0&&s.wins>0)add('perfect','Undefeated','Completed the regular season without a loss.','💎'); if(construction>=96)add('construction','Roster Architect','Built a complete fantasy roster with disciplined positional depth.','🧠'); if((s?.streak||'').startsWith('W')&&Number((s?.streak||'W0').slice(1))>=5)add('streak','On Fire','Won five or more straight games.','🔥');
    const tradeWins=transactions.filter(t=>t.transactionType==='trade'&&String(t.summary).includes(m.userName)).length;if(tradeWins>=3)add('trader','Front Office Menace','Completed at least three trades.','📞');
  }
  return out;
}

export function buildOwnerReputation(league:League,achievements:Achievement[]):OwnerReputation[]{
  const championId=league.seasonResult?resolveSeasonChampion(league.seasonResult)?.memberId:undefined;
  return league.members.map(m=>{const s=league.seasonResult?.standings.find(x=>x.memberId===m.id);const games=(s?.wins||0)+(s?.losses||0)+(s?.ties||0);const winPct=games?((s?.wins||0)+.5*(s?.ties||0))/games:0;const champ=m.id===championId?1:0;const badgeCount=achievements.filter(a=>a.memberId===m.id).length;const construction=rosterConstructionScore(m.roster||[]);const rating=Math.round(Math.max(0,Math.min(100,42+winPct*34+champ*14+badgeCount*2+construction*.08)));const tier=rating>=90?'ELITE BALL KNOWER':rating>=80?'CERTIFIED':rating>=70?'KNOWS BALL':rating>=60?'SOLID GM':'PROVE IT';return {memberId:m.id,memberName:m.userName,rating,tier,winPct,championships:champ,achievements:badgeCount,record:recordOf(league,m.id),reason:`${Math.round(winPct*100)}% win rate, ${badgeCount} badge${badgeCount===1?'':'s'}, ${construction} roster-construction score.`};}).sort((a,b)=>b.rating-a.rating);
}

export function analyzeTrade(league:League,proposerId:string,recipientId:string,offeredIds:string[],requestedIds:string[]):TradeAnalysis{
  const proposer=memberById(league,proposerId);const recipient=memberById(league,recipientId);if(!proposer||!recipient)return {fairness:0,winner:'even',proposerValue:0,recipientValue:0,proposerCapDelta:0,recipientCapDelta:0,proposerOvrDelta:0,recipientOvrDelta:0,explanation:'Choose two valid league owners.'};
  const offer=(proposer.roster||[]).filter(p=>offeredIds.includes(p.id));const request=(recipient.roster||[]).filter(p=>requestedIds.includes(p.id));const proposerValue=request.reduce((s,p)=>s+playerValue(p),0);const recipientValue=offer.reduce((s,p)=>s+playerValue(p),0);const total=Math.max(1,proposerValue+recipientValue);const fairness=Math.round(Math.max(0,100-Math.abs(proposerValue-recipientValue)/total*120));const winner=proposerValue>recipientValue*1.08?'proposer':recipientValue>proposerValue*1.08?'recipient':'even';
  const pBefore=calculateTeamRatings(proposer.roster||[]).overall;const rBefore=calculateTeamRatings(recipient.roster||[]).overall;const pAfter=[...(proposer.roster||[]).filter(p=>!offeredIds.includes(p.id)),...request];const rAfter=[...(recipient.roster||[]).filter(p=>!requestedIds.includes(p.id)),...offer];const pAfterOvr=calculateTeamRatings(pAfter).overall;const rAfterOvr=calculateTeamRatings(rAfter).overall;const offerSalary=offer.reduce((s,p)=>s+p.salary,0);const requestSalary=request.reduce((s,p)=>s+p.salary,0);
  return {fairness,winner,proposerValue:Math.round(proposerValue),recipientValue:Math.round(recipientValue),proposerCapDelta:Number((requestSalary-offerSalary).toFixed(1)),recipientCapDelta:Number((offerSalary-requestSalary).toFixed(1)),proposerOvrDelta:pAfterOvr-pBefore,recipientOvrDelta:rAfterOvr-rBefore,explanation:winner==='even'?`Balanced deal: ${fairness}% fairness with similar total value.`:`${winner==='proposer'?proposer.userName:recipient.userName} projects to gain more roster value; fairness scores ${fairness}%.`};
}

export function buildLeagueRecords(league:League):LeagueRecord[]{
  const result=league.seasonResult;if(!result)return [];
  const games=result.games||[];const standings=result.standings||[];const biggest=[...games].sort((a,b)=>Math.abs((b.homeScore-b.awayScore))-Math.abs((a.homeScore-a.awayScore)))[0];const highest=[...standings].sort((a,b)=>b.pointsFor-a.pointsFor)[0];const defense=[...standings].sort((a,b)=>a.pointsAgainst-b.pointsAgainst)[0];const streak=standings.filter(s=>(s.streak||'').startsWith('W')).sort((a,b)=>Number((b.streak||'').slice(1))-Number((a.streak||'').slice(1)))[0];
  if(!standings.some(row=>(row.wins||0)+(row.losses||0)+(row.ties||0)>0))return [];
  const out:LeagueRecord[]=[];if(biggest){const winner=memberById(league,biggest.winnerId);out.push({label:'Biggest Blowout',value:`${Math.abs(biggest.homeScore-biggest.awayScore)} pts`,holder:winner?.userName||'Unknown',detail:`Week ${biggest.week}: ${biggest.homeScore}-${biggest.awayScore}`});} if(highest)out.push({label:'Scoring Machine',value:String(highest.pointsFor),holder:highest.memberName,detail:'Most points scored in a season'});if(defense)out.push({label:'Clamp City',value:String(defense.pointsAgainst),holder:defense.memberName,detail:'Fewest points allowed'});if(streak)out.push({label:'Longest Current Streak',value:streak.streak,holder:streak.memberName,detail:'Best finishing streak'});return out;
}

export function buildStorylines(league:League,rivalries:Rivalry[],transactions:LeagueTransaction[]=[]):Storyline[]{
  const out:Storyline[]=[];const s=league.seasonResult?.standings||[];const hasGames=s.some(row=>(row.wins||0)+(row.losses||0)+(row.ties||0)>0);const leader=hasGames?s[0]:undefined;if(leader)out.push({kind:'headline',headline:`${leader.memberName} owns the top spot`,body:`A ${leader.wins}-${leader.losses}${leader.ties?`-${leader.ties}`:''} record and ${leader.pointDifferential>=0?'+':''}${leader.pointDifferential} point differential have set the pace.`,priority:100});const hot=s.find(x=>(x.streak||'').startsWith('W')&&Number(x.streak.slice(1))>=4);if(hot)out.push({kind:'playoff',headline:`${hot.memberName} is surging`,body:`${hot.streak} has turned the playoff race into a problem for everybody else.`,priority:90});const rival=rivalries[0];if(rival)out.push({kind:'rivalry',headline:`${rival.aName} vs ${rival.bName} is becoming personal`,body:`${rival.games} meetings, ${rival.aWins}-${rival.bWins} head-to-head, rivalry heat ${rival.heat}.`,priority:80});const recentTrade=transactions.find(t=>t.transactionType==='trade');if(recentTrade)out.push({kind:'trade',headline:'Trade market is moving',body:recentTrade.summary,priority:70});const upset=hasGames?(league.seasonResult?.games||[]).map(g=>{const winner=s.find(x=>x.memberId===g.winnerId);const loser=s.find(x=>x.memberId===g.loserId);return {g,gap:(loser?.teamRating||0)-(winner?.teamRating||0)};}).sort((a,b)=>b.gap-a.gap)[0]:undefined;if(upset&&upset.gap>2)out.push({kind:'headline',headline:'Upset alert became a receipt',body:`${memberById(league,upset.g.winnerId)?.userName} knocked off a roster rated ${upset.gap} OVR higher.`,priority:75});return out.sort((a,b)=>b.priority-a.priority);
}

export function buildLeagueNews(league:League,storylines:Storyline[],awards:AwardWinner[],records:LeagueRecord[]):Storyline[]{
  const out=[...storylines];if(awards[0])out.push({kind:'award',headline:`MVP watch: ${awards[0].player.name}`,body:`${awards[0].memberName}'s ${awards[0].player.position} is currently the Ball Knower MVP favorite.`,priority:65});records.forEach(record=>out.push({kind:'record',headline:`Record book update: ${record.holder}`,body:`${record.label}: ${record.value}.`,priority:55}));if(!out.length)out.push({kind:'headline',headline:'Week 1 is ready',body:'Preseason power rankings and draft grades are live. Awards, records and weekly storylines unlock after games are played.',priority:50});return out.sort((a,b)=>b.priority-a.priority);
}
