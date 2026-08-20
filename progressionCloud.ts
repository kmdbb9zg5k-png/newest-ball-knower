import { ensureOnlineSession, supabase } from './supabase';

export type ProgressProfile={
  userId:string;displayName:string;bkRating:number;xp:number;level:number;
  footballIq:number;gmRating:number;predictionRating:number;triviaRating:number;agentRating:number;ownerRating:number;
  championships:number;currentStreak:number;longestStreak:number;updatedAt:string;
};
export type ProgressEvent={id:number;eventType:string;category:string;xpAwarded:number;ratingDelta:number;occurredAt:string;metadata:Record<string,unknown>};
export type Achievement={key:string;title:string;description:string;category:string;tier:'bronze'|'silver'|'gold'|'diamond';xpReward:number;unlockedAt?:string};

const mapProfile=(x:any):ProgressProfile=>({
  userId:x.user_id,displayName:x.display_name,bkRating:Number(x.bk_rating)||50,xp:Number(x.xp)||0,level:Number(x.level)||1,
  footballIq:Number(x.football_iq)||50,gmRating:Number(x.gm_rating)||50,predictionRating:Number(x.prediction_rating)||50,triviaRating:Number(x.trivia_rating)||50,agentRating:Number(x.agent_rating)||50,ownerRating:Number(x.owner_rating)||50,
  championships:Number(x.championships)||0,currentStreak:Number(x.current_streak)||0,longestStreak:Number(x.longest_streak)||0,updatedAt:x.updated_at,
});

export async function fetchProgressionProfile(displayName?:string){
  if(!supabase) throw new Error('Ball Knower profile requires online services.');
  const auth=await ensureOnlineSession();
  const ensured=await supabase.rpc('ensure_ball_knower_progress_profile',{p_display_name:displayName?.trim()||null});
  if(ensured.error) throw ensured.error;
  const profileRow=Array.isArray(ensured.data)?ensured.data[0]:ensured.data;
  if(!profileRow) throw new Error('Could not load Ball Knower profile.');
  const [events,achievements,unlocked]=await Promise.all([
    supabase.from('ball_knower_progress_events').select('id,event_type,category,xp_awarded,rating_delta,metadata,occurred_at').eq('user_id',auth.id).order('occurred_at',{ascending:false}).limit(12),
    supabase.from('ball_knower_achievement_catalog').select('achievement_key,title,description,category,tier,xp_reward').order('xp_reward',{ascending:false}),
    supabase.from('ball_knower_user_achievements').select('achievement_key,unlocked_at').eq('user_id',auth.id),
  ]);
  const err=[events.error,achievements.error,unlocked.error].find(Boolean);if(err)throw err;
  const unlockedMap=new Map((unlocked.data||[]).map((x:any)=>[x.achievement_key,x.unlocked_at]));
  return {
    profile:mapProfile(profileRow),
    events:(events.data||[]).map((x:any)=>({id:Number(x.id),eventType:x.event_type,category:x.category,xpAwarded:Number(x.xp_awarded)||0,ratingDelta:Number(x.rating_delta)||0,occurredAt:x.occurred_at,metadata:x.metadata||{}} as ProgressEvent)),
    achievements:(achievements.data||[]).map((x:any)=>({key:x.achievement_key,title:x.title,description:x.description,category:x.category,tier:x.tier,xpReward:Number(x.xp_reward)||0,unlockedAt:unlockedMap.get(x.achievement_key)} as Achievement)),
  };
}
