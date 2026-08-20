import { ensureOnlineSession, supabase } from './supabase';
import { logLeagueEvent } from './leagueCloud';

export async function setMemberRosterStatus(leagueId:string,memberId:string,status:'building'|'ready',actorName:string) {
  if(!supabase) return;
  await ensureOnlineSession();
  const {data:member,error:memberError}=await supabase.from('ball_knower_league_members').select('user_name,roster').eq('league_id',leagueId).eq('id',memberId).maybeSingle();
  if(memberError) throw memberError;
  if(!member) throw new Error('League member not found.');
  if(status==='ready') {
    if(!Array.isArray(member.roster) || member.roster.length!==20) {
      throw new Error('That owner does not have a complete 20-player roster, so they cannot be force-readied.');
    }
    const {data:league,error:leagueError}=await supabase.from('ball_knower_leagues').select('salary_cap').eq('id',leagueId).maybeSingle();
    if(leagueError) throw leagueError;
    if(!league) throw new Error('League not found.');
    const spent=member.roster.reduce((sum:number,p:any)=>sum+(Number(p?.salary)||0),0);
    const salaryCap=Number(league.salary_cap);
    if(!Number.isFinite(salaryCap) || salaryCap<=0) throw new Error('League salary cap is invalid.');
    if(spent>salaryCap) {
      throw new Error('That roster is over the salary cap, so it cannot be force-readied.');
    }
  }
  const {error}=await supabase.from('ball_knower_league_members').update({status,submitted_at:status==='ready'?new Date().toISOString():null}).eq('league_id',leagueId).eq('id',memberId);
  if(error) throw error;
  await logLeagueEvent(leagueId,status==='ready'?'commissioner_force_ready':'roster_reopened',status==='ready'?`Commissioner force-readied ${member.user_name}.`:`Commissioner reopened ${member.user_name}'s roster.`,actorName,{memberId});
}
