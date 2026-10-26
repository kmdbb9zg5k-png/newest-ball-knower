export const MINI_CHALLENGE_GAMES = [
  {id:'dash',name:'40-Yard Dash',rule:'Fastest time wins',metric:'time',unit:'s',lower:true},
  {id:'broad-jump',name:'Broad Jump',rule:'Longest jump wins',metric:'distance',unit:'m'},
  {id:'shuttle',name:'20-Yard Shuttle',rule:'Fastest time including penalties wins',metric:'time',unit:'s',lower:true},
  {id:'bench',name:'Bench Press',rule:'Most complete reps wins',metric:'reps',unit:'reps'},
  {id:'routes',name:'Receiver Routes',rule:'Highest average route score wins',metric:'score',unit:'/100'},
  {id:'one-on-one',name:'1-on-1 Receiver',rule:'Highest average rep score wins',metric:'score',unit:'/100'},
  {id:'rb',name:'RB 1-on-1',rule:'Highest average rep score wins',metric:'score',unit:'/100'},
  {id:'db',name:'DB 1-on-1',rule:'Highest average coverage score wins',metric:'score',unit:'/100'},
  {id:'two-minute',name:'Two-Minute Warning',rule:'Points → yards → fewer turnovers',metric:'points',unit:'pts'},
  {id:'five-minute',name:'Five-Minute Game',rule:'Points → yards → fewer turnovers',metric:'points',unit:'pts'},
] as const;
export type MiniGameId=typeof MINI_CHALLENGE_GAMES[number]['id'];
export type MiniStats=Record<string,number>;
export type MiniChallenge={id:string;game:MiniGameId;challenger_id:string;opponent_id:string|null;challenger_name:string;opponent_name:string|null;status:'open'|'pending'|'active'|'completed'|'cancelled'|'declined'|'expired';seed:number;expires_at:string;challenger_stats:MiniStats|null;opponent_stats:MiniStats|null;winner_id:string|null;created_at:string};
export const miniGame=(id:string)=>MINI_CHALLENGE_GAMES.find(g=>g.id===id)!;
export function miniChallengeUrl(match:MiniChallenge,token:string){
  const football=match.game==='two-minute'||match.game==='five-minute';
  const params=new URLSearchParams({bkChallenge:match.id,bkToken:token,seed:String(match.seed)});
  if(football){params.set('mode',match.game);params.set('difficulty','pro');params.set('team','JCY');params.set('opponent','BRK');}
  else params.set('drill',match.game);
  return `${football?'/play-moment-3d-preview.html':'/combine.html'}?${params}`;
}
export function miniStatLabel(game:MiniGameId,stats:MiniStats|null){
  if(!stats)return 'Waiting for result';if(stats.dnf)return 'Did not finish';
  const g=miniGame(game),value=stats[g.metric];
  return `${g.metric==='time'||g.metric==='distance'?value.toFixed(3):value} ${g.unit}`;
}
