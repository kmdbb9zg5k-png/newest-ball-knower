import { ensureOnlineSession, supabase } from './supabase';

export async function setMemberRosterStatus(leagueId:string,memberId:string,status:'building'|'ready',_actorName:string) {
  if(!supabase) return;
  await ensureOnlineSession();
  const {error}=await supabase.rpc('commissioner_set_member_roster_status',{
    p_league_id:leagueId,
    p_member_id:memberId,
    p_status:status,
  });
  if(error) throw error;
}
