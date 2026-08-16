import { ensureOnlineSession, isCloudConfigured, supabase } from '../lib/supabase';
import { CareerProfile } from '../utils/soloSeasonEngine';

export async function publishCareer(displayName:string, c:CareerProfile){
 if(!isCloudConfigured||!supabase)return;
 const u=await ensureOnlineSession();
 const {error}=await supabase.from('ball_knower_leaderboard').upsert({
  auth_user_id:u.id,display_name:displayName,championships:c.championships,career_wins:c.regularWins,
  career_losses:c.regularLosses,playoff_wins:c.playoffWins,best_ball_knower_score:c.bestScore,
  best_record:c.bestRecord,perfect_seasons:c.perfectSeasons,updated_at:new Date().toISOString()
 },{onConflict:'auth_user_id'}); if(error)throw error;
}
export async function fetchLeaderboard(){
 if(!isCloudConfigured||!supabase)return [];
 await ensureOnlineSession();
 const {data,error}=await supabase.from('ball_knower_leaderboard').select('*')
  .order('championships',{ascending:false}).order('best_ball_knower_score',{ascending:false}).limit(50);
 if(error)throw error; return data||[];
}
