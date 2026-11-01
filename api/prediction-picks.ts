import{createClient}from'@supabase/supabase-js';
import{fetchCanonicalPredictionGames,gradeCanonicalPrediction}from'../server/nflPredictionFeed.js';
import{createPredictionGameResolver,indexPredictionPicks,predictionPicksForGame,predictionTeam,resolvePredictionGame,samePredictionChoice}from'../server/predictionIdentity.js';

const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'https://gpnboygoosrmeydwjpvk.supabase.co';
const serviceKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const service=serviceKey?createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const bearer=(req:any)=>{const raw=String(req?.headers?.authorization||'');return raw.startsWith('Bearer ')?raw.slice(7):''};
const close=(a:number,b:number)=>Math.abs(a-b)<0.001;

async function signedUser(req:any,client:any){
  if(!client)throw new Error('Prediction service is not configured.');
  const token=bearer(req);if(!token)return null;
  const result=await client.auth.getUser(token);return result.error?null:result.data.user;
}

async function stored(userId:string,client:any){
  const result=await client.rpc('get_ball_knower_verified_prediction_picks',{p_user_id:userId});
  if(result.error)throw result.error;
  return(Array.isArray(result.data)?result.data:[]).map((row:any)=>({
    id:String(row.pick_id),gameId:String(row.game_id),label:String(row.label),market:String(row.market),selection:String(row.selection),lockedLine:Number(row.locked_line),lockedAt:String(row.locked_at),result:row.result||undefined,kickoffAt:String(row.kickoff_at),awayTeam:String(row.away_team),homeTeam:String(row.home_team),gradedAt:row.graded_at||undefined,
  }));
}

export function createPredictionPicksHandler({serviceClient=service,fetchGames=fetchCanonicalPredictionGames,now=Date.now}: {serviceClient?:any;fetchGames?:()=>Promise<any[]>;now?:()=>number}={}){
const service=serviceClient;
return async function handler(req:any,res:any){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  if(!service)return res.status(503).json({error:'Prediction service is not configured.'});
  try{
    const user=await signedUser(req,service);if(!user)return res.status(401).json({error:'Sign in required'});
    if(req.method==='GET')return res.status(200).json({picks:await stored(user.id,service)});
    if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
    const action=String(req?.body?.action||'');

    if(action==='delete'){
      const gameId=String(req?.body?.gameId||'');if(!gameId)return res.status(400).json({error:'Missing game'});
      const result=await service.rpc('delete_ball_knower_verified_prediction_pick',{p_user_id:user.id,p_game_id:gameId});
      if(result.error)throw result.error;if(!result.data)return res.status(409).json({error:'That pick is already locked.'});
      return res.status(200).json({ok:true,picks:await stored(user.id,service)});
    }

    if(action==='save'){
      const pick=req?.body?.pick||{};const gameId=String(pick.gameId||'');const market=String(pick.market||'');const selection=String(pick.selection||'');const lockedLine=Number(pick.lockedLine);
      if(!gameId||!['spread','total'].includes(market)||!Number.isFinite(lockedLine))return res.status(400).json({error:'Invalid pick'});
      const games=await fetchGames();const existingPicks=await stored(user.id,service);
      // Client-provided matchup metadata cannot redirect a verified write. Only
      // provider aliases and metadata previously saved by the server can match.
      const savedReference=existingPicks.find((item:any)=>item.gameId===gameId);
      const resolved=resolvePredictionGame(savedReference||{gameId},games);
      if(resolved.ambiguous)return res.status(409).json({error:'This game could not be matched uniquely. Your saved picks are unchanged.'});
      const game=resolved.game;if(!game||!game.kickoffAt)return res.status(404).json({error:'NFL game not found'});
      const attached=predictionPicksForGame(game,existingPicks,games);
      if(attached.ambiguous)return res.status(409).json({error:'Existing picks could not be matched uniquely. Your saved picks are unchanged.'});
      const existing=attached.picks[0];
      if(existing&&(existing.result||!Number.isFinite(Date.parse(existing.kickoffAt))||now()>=Date.parse(existing.kickoffAt)))return res.status(409).json({error:'That game is already locked.'});
      const kickoffMs=Date.parse(game.kickoffAt);if(!Number.isFinite(kickoffMs)||now()>=kickoffMs)return res.status(409).json({error:'That game is already locked.'});
      let expected:number|null=null;
      if(market==='spread')expected=predictionTeam(selection)===predictionTeam(game.away)?game.awaySpread:predictionTeam(selection)===predictionTeam(game.home)?game.homeSpread:null;
      else if(selection==='over'||selection==='under')expected=game.total;
      if(expected===null||!close(expected,lockedLine))return res.status(409).json({error:'That line moved. Refresh Picks before locking it.'});
      // Repeated submissions of an unchanged choice do not reset its original
      // ID, locked line, timestamp or matchup metadata after a provider switch.
      if(existing&&samePredictionChoice(existing,pick))return res.status(200).json({ok:true,picks:existingPicks});
      const saved=await service.rpc('save_ball_knower_verified_prediction_pick',{
        p_user_id:user.id,p_game_id:existing?.gameId||game.id,p_pick_id:String(pick.id||`${game.id}-${market}-${selection}-${lockedLine}`),p_market:market,p_selection:selection,p_locked_line:lockedLine,p_label:String(pick.label||selection),p_kickoff_at:existing?.kickoffAt||game.kickoffAt,p_away_team:existing?.awayTeam||game.away,p_home_team:existing?.homeTeam||game.home,
      });
      if(saved.error)throw saved.error;if(!saved.data)return res.status(409).json({error:'That pick is already locked.'});
      return res.status(200).json({ok:true,picks:await stored(user.id,service)});
    }

    if(action==='grade'){
      const picks=await stored(user.id,service);if(!picks.length)return res.status(200).json({ok:true,picks:[],milestoneIds:[]});
      const games=await fetchGames();const milestoneIds:number[]=[];const resolve=createPredictionGameResolver(games);const index=indexPredictionPicks(picks,games);
      for(const pick of picks){
        if(pick.result)continue;const resolved=resolve(pick);const game=resolved.game;if(!game||index.get(game.id)?.ambiguous)continue;const selection=pick.market==='spread'?(predictionTeam(pick.selection)===predictionTeam(game.away)?game.away:predictionTeam(pick.selection)===predictionTeam(game.home)?game.home:pick.selection):pick.selection;const result=gradeCanonicalPrediction({...pick,selection},game);if(!result||game.awayScore===null||game.homeScore===null)continue;
        const graded=await service.rpc('grade_ball_knower_verified_prediction_pick',{p_user_id:user.id,p_game_id:pick.gameId,p_result:result,p_away_score:game.awayScore,p_home_score:game.homeScore});
        if(graded.error)throw graded.error;const id=Number(graded.data);if(Number.isFinite(id))milestoneIds.push(id);
      }
      return res.status(200).json({ok:true,picks:await stored(user.id,service),milestoneIds});
    }

    return res.status(400).json({error:'Unsupported prediction action'});
  }catch(error:any){
    console.warn('prediction-picks-failed',String(error?.message||error));
    return res.status(500).json({error:'Could not verify prediction picks.'});
  }
};
}
export default createPredictionPicksHandler();
