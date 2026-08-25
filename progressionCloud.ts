import { ensureOnlineSession, supabase } from './supabase';

export type ProgressProfile={
  userId:string;displayName:string;bkRating:number;xp:number;level:number;
  footballIq:number;gmRating:number;predictionRating:number;triviaRating:number;agentRating:number;ownerRating:number;
  championships:number;currentStreak:number;longestStreak:number;updatedAt:string;
};
export type ProgressEvent={id:number;eventType:string;category:string;xpAwarded:number;ratingDelta:number;occurredAt:string;metadata:Record<string,unknown>};
export type Achievement={key:string;title:string;description:string;category:string;tier:'bronze'|'silver'|'gold'|'diamond';xpReward:number;unlockedAt?:string};
export type TriviaQuestion={attemptId:number;questionId:number;tier:string;question:string;answers:string[];practiceOnly?:boolean};
export type TriviaAnswerResult={isCorrect:boolean;correctIndex:number;explanation:string;xpAwarded:number;progressionRecorded:boolean};
export type ChampionshipClaimResult={applied:boolean;eventKey:string};

type LocalTrivia={tier:string;question:string;answers:string[];correctIndex:number;explanation:string};
const LOCAL_TRIVIA:LocalTrivia[]=[
  {tier:'ROOKIE',question:'How many points is a touchdown worth before the extra point?',answers:['3','6','7','8'],correctIndex:1,explanation:'A touchdown is worth six points. The extra-point attempt happens afterward.'},
  {tier:'ROOKIE',question:'Which position normally snaps the football to the quarterback?',answers:['Center','Tight end','Fullback','Safety'],correctIndex:0,explanation:'The center begins the play by snapping the ball.'},
  {tier:'ROOKIE',question:'How many yards does an offense normally need for a first down?',answers:['5','8','10','15'],correctIndex:2,explanation:'An offense normally receives a new set of downs after gaining ten yards.'},
  {tier:'PRO',question:'Which defensive package uses six defensive backs?',answers:['Nickel','Dime','Goal line','46'],correctIndex:1,explanation:'A dime package puts six defensive backs on the field.'},
  {tier:'PRO',question:'What is the maximum number of players one team may have on the field during a play?',answers:['10','11','12','13'],correctIndex:1,explanation:'Each team may use eleven players during a play.'},
  {tier:'PRO',question:'A quarterback kneel normally counts as what type of play in NFL statistics?',answers:['Incomplete pass','Sack','Rushing attempt','Penalty'],correctIndex:2,explanation:'Quarterback kneels are recorded as rushing attempts.'},
  {tier:'ALL-PRO',question:'What coverage family has each defender responsible for a specific receiver rather than an area?',answers:['Zone','Man','Prevent','Match quarters only'],correctIndex:1,explanation:'In man coverage, eligible receivers are assigned to individual defenders.'},
  {tier:'ALL-PRO',question:'On a basic inside-zone read, which defender is commonly left unblocked for the quarterback to read?',answers:['Backside/read-side edge defender','Free safety','Nose tackle','Boundary corner'],correctIndex:0,explanation:'On a basic inside-zone read, the quarterback commonly reads the backside/read-side edge defender while the line blocks zone away from him.'},
  {tier:'ALL-PRO',question:'Which route concept places receivers at different depths on the same side to stretch zone coverage vertically?',answers:['Smash','Levels','Four verticals','Mesh'],correctIndex:1,explanation:'Levels uses in-breaking routes at different depths to stress underneath zone defenders.'},
  {tier:'HALL OF FAME',question:'Who is the only player to win Super Bowl MVP three consecutive times?',answers:['Joe Montana','Tom Brady','Terry Bradshaw','No player has'],correctIndex:3,explanation:'No player has won Super Bowl MVP in three consecutive Super Bowls.'},
  {tier:'HALL OF FAME',question:'Which formation name traditionally describes a backfield with three running backs aligned behind the quarterback?',answers:['I formation','Wishbone','Pistol','Empty'],correctIndex:1,explanation:'The wishbone traditionally uses a fullback and two halfbacks behind the quarterback.'},
  {tier:'HALL OF FAME',question:'In pass protection, what does a half-slide commonly combine?',answers:['Man protection and zone slide','Two separate screen passes','Only double teams','A seven-man blitz'],correctIndex:0,explanation:'Half-slide protection combines man assignments on one side with a zone-style slide on the other.'},
];
const localAttempts=new Map<number,LocalTrivia>();
const localSeenByTier=new Map<string,Set<string>>();
const localLastByTier=new Map<string,string>();
let nextLocalAttempt=-1;

/** Chooses an offline practice question without repeating within a tier until its tiny fallback pool is exhausted. */
const localTriviaQuestion=(tier:string):TriviaQuestion=>{
  const normalized=tier.toUpperCase();
  const pool=LOCAL_TRIVIA.filter(item=>item.tier===normalized);
  const usablePool=pool.length?pool:[LOCAL_TRIVIA[0]];
  let seen=localSeenByTier.get(normalized)??new Set<string>();
  let candidates=usablePool.filter(item=>!seen.has(item.question));

  if(!candidates.length){
    const previous=localLastByTier.get(normalized);
    seen=new Set<string>();
    localSeenByTier.set(normalized,seen);
    candidates=usablePool.filter(item=>usablePool.length===1||item.question!==previous);
    if(!candidates.length)candidates=usablePool;
  }

  const question=candidates[Math.floor(Math.random()*candidates.length)]??usablePool[0];
  seen.add(question.question);
  localSeenByTier.set(normalized,seen);
  localLastByTier.set(normalized,question.question);
  const attemptId=nextLocalAttempt--;
  localAttempts.set(attemptId,question);
  return {attemptId,questionId:Math.abs(attemptId),tier:question.tier,question:question.question,answers:question.answers,practiceOnly:true};
};

const makeTriviaSessionToken=()=>{
  try{return crypto.randomUUID();}catch{return `bk-trivia-${Date.now()}-${Math.random().toString(36).slice(2)}`;}
};

/**
 * Starts an explicit trivia session before any question fetch. The server records the
 * newest token under a per-user lock, so a delayed request from an exited/older session
 * can be rejected without touching the currently displayed attempt.
 */
export async function beginTriviaSession():Promise<string>{
  const token=makeTriviaSessionToken();
  if(!supabase)return token;
  try{
    await ensureOnlineSession();
    const response=await supabase.rpc('begin_ball_knower_trivia_session',{p_session_token:token});
    if(response.error)throw response.error;
  }catch(error){
    console.warn('Verified trivia session could not start; offline practice may be used.',error);
  }
  return token;
}

const mapProfile=(x:any):ProgressProfile=>({
  userId:x.user_id,displayName:x.display_name,bkRating:Number(x.bk_rating)||50,xp:Number(x.xp)||0,level:Number(x.level)||1,
  footballIq:Number(x.football_iq)||50,gmRating:Number(x.gm_rating)||50,predictionRating:Number(x.prediction_rating)||50,triviaRating:Number(x.trivia_rating)||50,agentRating:Number(x.agent_rating)||50,ownerRating:Number(x.owner_rating)||50,
  championships:Number(x.championships)||0,currentStreak:Number(x.current_streak)||0,longestStreak:Number(x.longest_streak)||0,updatedAt:x.updated_at,
});

export async function fetchProgressionProfile(displayName?:string){
  if(!supabase) throw new Error('Ball Knower profile requires online services.');
  const auth=await ensureOnlineSession();
  const championshipSync=await supabase.rpc('sync_ball_knower_league_championships');
  if(championshipSync.error) console.warn('Verified championship progression sync failed',championshipSync.error.message);
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

export async function claimLeagueChampionshipProgress(leagueId:string):Promise<ChampionshipClaimResult>{
  if(!supabase) throw new Error('League progression requires online services.');
  await ensureOnlineSession();
  const response=await supabase.rpc('claim_ball_knower_league_championship',{p_league_id:leagueId});
  if(response.error) throw response.error;
  const row=Array.isArray(response.data)?response.data[0]:response.data;
  if(!row) throw new Error('Could not verify this championship result.');
  return {applied:Boolean(row.applied),eventKey:String(row.event_key||'')};
}

export async function fetchTriviaQuestion(tier:string,sessionToken?:string):Promise<TriviaQuestion>{
  if(!supabase)return localTriviaQuestion(tier);
  try{
    await ensureOnlineSession();
    const response=sessionToken
      ?await supabase.rpc('get_ball_knower_trivia_question',{p_tier:tier,p_session_token:sessionToken})
      :await supabase.rpc('get_ball_knower_trivia_question',{p_tier:tier});
    if(response.error)throw response.error;
    const row=Array.isArray(response.data)?response.data[0]:response.data;
    if(!row)throw new Error('No trivia question is available right now.');
    const answers=Array.isArray(row.answers)?row.answers.map((answer:unknown)=>String(answer)):[];
    if(answers.length!==4)throw new Error('Trivia question data is incomplete.');
    return {attemptId:Number(row.attempt_id),questionId:Number(row.question_id),tier:String(row.tier),question:String(row.question),answers,practiceOnly:false};
  }catch(error){
    console.warn('Cloud trivia unavailable; using offline practice bank.',error);
    return localTriviaQuestion(tier);
  }
}

export async function submitTriviaAnswer(attemptId:number,selectedIndex:number):Promise<TriviaAnswerResult>{
  const local=localAttempts.get(attemptId);
  if(local){
    localAttempts.delete(attemptId);
    return {isCorrect:selectedIndex===local.correctIndex,correctIndex:local.correctIndex,explanation:local.explanation,xpAwarded:0,progressionRecorded:false};
  }
  if(!supabase)throw new Error('That trivia question expired. Load a new one.');
  await ensureOnlineSession();
  const response=await supabase.rpc('submit_ball_knower_trivia_answer',{p_attempt_id:attemptId,p_selected_index:selectedIndex});
  if(response.error)throw response.error;
  const row=Array.isArray(response.data)?response.data[0]:response.data;
  if(!row)throw new Error('Could not score this trivia answer.');
  return {
    isCorrect:Boolean(row.is_correct),
    correctIndex:Number(row.correct_index),
    explanation:String(row.explanation||''),
    xpAwarded:Number(row.xp_awarded)||0,
    progressionRecorded:Boolean(row.progression_recorded),
  };
}
