import {supabase,ensureOnlineSession} from './supabase';
export type FootballOffenseStats={passingYards:number;rushingYards:number;passAttempts:number;completions:number;touchdowns:number;turnovers:number;returnTouchdowns?:number};
export type FootballDrive=Partial<{[K in keyof FootballOffenseStats]:number|null}>&{user_id:string;ordinal:number;points:number|null;yards:number|null;plays:number|null;forfeited:boolean;finished_at:string|null;deadline:string};
export type FootballMatch={id:string;challenger_id:string;opponent_id:string|null;challenger_team:string;opponent_team:string|null;challenger_name:string;opponent_name:string;status:'open'|'pending'|'active'|'completed'|'cancelled'|'declined'|'expired';winner_id:string|null;created_at:string;expires_at:string;drives:FootballDrive[]};
export type FootballStanding={user_id:string;name:string;games:number;wins:number;losses:number;ties:number;rating:number};
export type FootballHome={matches:FootballMatch[];standings:FootballStanding[]};
export type FootballAttempt={token:string;drive:number;deadline:string;seed:number;team:string;opponent:string};
export type FootballStats={points:number;yards:number;plays:number}&Partial<FootballOffenseStats>;
export type FootballQuickMatch={id:string;status:'open'|'active'};
export async function footballArenaAction<T>(action:string,args:Record<string,unknown>={}):Promise<T>{
  if(!supabase)throw new Error('Online football is unavailable.');
  const user=await ensureOnlineSession();
  if(user.is_anonymous)throw new Error('Sign in to play Football H2H.');
  const {data,error}=await supabase.rpc('ball_knower_football_arena',{p_action:action,p_args:args}).abortSignal(AbortSignal.timeout(15000));
  const {data:session}=await supabase.auth.getSession();
  if(session.session?.user.id!==user.id)throw new Error('Your account changed. Reopen Football H2H.');
  if(error)throw new Error(error.message);
  return data as T;
}
export const footballTotal=(match:FootballMatch,user:string)=>match.drives.filter(d=>d.user_id===user).reduce((sum,d)=>sum+(d.points??0),0);
export function footballDriveUrl(id:string,attempt:FootballAttempt){
  return '/play-moment-3d-preview.html?'+new URLSearchParams({mode:'arena',bkArena:id,token:attempt.token,drive:String(attempt.drive),seed:String(attempt.seed),team:attempt.team,opponent:attempt.opponent});
}
export function validFootballStats(value:unknown):value is FootballStats{
  if(!value||typeof value!=='object')return false;
  const s=value as FootballStats;
  const detailKeys=['passingYards','rushingYards','passAttempts','completions','touchdowns','turnovers'] as const;
  const allowed=['points','yards','plays',...detailKeys,'returnTouchdowns'];
  if(Object.keys(s).some(key=>!allowed.includes(key))||![s.points,s.yards,s.plays].every(Number.isInteger))return false;
  const detailed=detailKeys.some(key=>key in s)||'returnTouchdowns' in s;
  if(detailed){
    if(!detailKeys.every(key=>Number.isInteger(s[key])))return false;
    if(s.passingYards!< -200||s.passingYards!>500||s.rushingYards!< -200||s.rushingYards!>500)return false;
    if(s.passAttempts!<0||s.passAttempts!>s.plays||s.completions!<0||s.completions!>s.passAttempts!)return false;
    if(s.touchdowns!<0||s.touchdowns!>1||s.turnovers!<0||s.turnovers!>1)return false;
    if('returnTouchdowns' in s&&(!Number.isInteger(s.returnTouchdowns)||s.returnTouchdowns!<0||s.returnTouchdowns!>1))return false;
    if(s.touchdowns!+(s.returnTouchdowns??0)>1||(s.returnTouchdowns===1&&s.points<6))return false;
  }
  return [0,3,6,7,8].includes(s.points)&&s.yards>=-200&&s.yards<=500&&s.plays>=0&&s.plays<=200&&(s.points<6||s.plays>0||s.returnTouchdowns===1);
}
