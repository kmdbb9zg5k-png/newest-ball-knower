import { ensureOnlineSession, supabase } from './supabase';
import { leagueJoinCodeError, normalizeLeagueJoinCode } from './leagueJoinCode';

export { leagueJoinCodeError, normalizeLeagueJoinCode };

export async function customizeLeagueInvite(leagueId:string,requestedCode:string):Promise<string> {
  if(!supabase)return normalizeLeagueJoinCode(requestedCode);
  const auth=await ensureOnlineSession();
  const next=normalizeLeagueJoinCode(requestedCode);
  const validationError=leagueJoinCodeError(next);
  if(validationError)throw new Error(validationError);
  const {data,error}=await supabase.from('ball_knower_leagues').update({code:next,invite_enabled:true}).eq('id',leagueId).eq('commissioner_auth_id',auth.id).select('code').maybeSingle();
  if(error?.code==='23505')throw new Error('That join code is already taken. Try another one.');
  if(error)throw error;
  if(!data)throw new Error('Only the league commissioner can customize this join code.');
  return data.code;
}

export async function leaveCloudLeague(leagueId:string):Promise<void> {
  if(!supabase)return;
  const auth=await ensureOnlineSession();
  const {data,error}=await supabase.from('ball_knower_league_members').delete().eq('league_id',leagueId).eq('auth_user_id',auth.id).eq('is_commissioner',false).select('id').maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('Commissioners must delete the league instead of leaving it.');
}

export async function deleteCloudLeague(leagueId:string):Promise<void> {
  if(!supabase)return;
  const auth=await ensureOnlineSession();
  const {data,error}=await supabase.from('ball_knower_leagues').delete().eq('id',leagueId).eq('commissioner_auth_id',auth.id).select('id').maybeSingle();
  if(error)throw error;
  if(!data)throw new Error('Only the league commissioner can permanently delete this league.');
}
