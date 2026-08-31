import{randomInt}from'node:crypto';
import{createClient}from'@supabase/supabase-js';
import{advanceOwnerSeason,normalizeOwnerAbbr,ownerCalendarWeek}from'../server/ownerSeasonRuntime.js';

type OwnerSeasonStage='preseason'|'regular'|'wild-card'|'divisional'|'conference'|'super-bowl';
const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'https://gpnboygoosrmeydwjpvk.supabase.co';
const serviceKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const service=serviceKey?createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const bearer=(req:any)=>{const raw=String(req?.headers?.authorization||'');return raw.startsWith('Bearer ')?raw.slice(7):''};
const stages=new Set<OwnerSeasonStage>(['preseason','regular','wild-card','divisional','conference','super-bowl']);
const GM_FOOTBALL:Record<string,number>={cap:78,scout:86,players:74};
const COACH_FOOTBALL:Record<string,number>={teacher:78,offense:91,defense:88};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

type ExpectedOwner={abbr:string;season:number;week:number;stage:OwnerSeasonStage;wins:number;losses:number;playoffSeed?:number|null};
type OwnerRun={user_id:string;abbr:string;season:number;week:number;stage:OwnerSeasonStage;wins:number;losses:number;playoff_seed:number|null;version:number};

const parseExpected=(value:any):ExpectedOwner|null=>{
  const abbr=String(value?.abbr||'').trim().toUpperCase();const season=Number(value?.season);const week=Number(value?.week);const stage=String(value?.stage||'') as OwnerSeasonStage;const wins=Number(value?.wins);const losses=Number(value?.losses);const playoffSeed=value?.playoffSeed==null?null:Number(value.playoffSeed);
  if(normalizeOwnerAbbr(abbr)!==abbr||!Number.isInteger(season)||season<2026||season>2200||!Number.isInteger(week)||week<0||week>21||!stages.has(stage)||!Number.isInteger(wins)||wins<0||wins>20||!Number.isInteger(losses)||losses<0||losses>20||!(playoffSeed==null||(Number.isInteger(playoffSeed)&&playoffSeed>=1&&playoffSeed<=7)))return null;
  return{abbr,season,week,stage,wins,losses,playoffSeed};
};
const cleanSeasonStart=(state:ExpectedOwner)=>state.stage==='preseason'&&state.week===0&&state.wins===0&&state.losses===0;
const matches=(run:OwnerRun,state:ExpectedOwner)=>run.abbr===state.abbr&&Number(run.season)===state.season&&Number(run.week)===state.week&&run.stage===state.stage&&Number(run.wins)===state.wins&&Number(run.losses)===state.losses&&Number(run.playoff_seed||0)===Number(state.playoffSeed||0);

async function getRun(userId:string):Promise<OwnerRun|null>{
  const result=await service!.rpc('get_ball_knower_verified_owner_run',{p_user_id:userId});if(result.error)throw result.error;return result.data?(result.data as OwnerRun):null;
}
async function beginRun(userId:string,state:ExpectedOwner):Promise<OwnerRun>{
  const result=await service!.rpc('begin_ball_knower_verified_owner_run',{p_user_id:userId,p_abbr:state.abbr,p_season:state.season});if(result.error)throw result.error;return result.data as OwnerRun;
}

export default async function handler(req:any,res:any){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!service)return res.status(503).json({error:'Progression service is not configured.'});
  try{
    const token=bearer(req);if(!token)return res.status(401).json({error:'Sign in required'});
    const auth=await service.auth.getUser(token);if(auth.error||!auth.data.user)return res.status(401).json({error:'Session expired'});
    const action=String(req?.body?.action||'');
    if(action!=='owner_step')return res.status(400).json({error:'Unsupported progression action'});
    const expected=parseExpected(req?.body?.expected);if(!expected)return res.status(400).json({error:'Invalid Owner state'});
    let run=await getRun(auth.data.user.id);
    if(!run&&cleanSeasonStart(expected))run=await beginRun(auth.data.user.id,expected);
    else if(run&&cleanSeasonStart(expected)&&expected.season>Number(run.season))run=await beginRun(auth.data.user.id,expected);
    if(!run||!matches(run,expected))return res.status(200).json({ok:true,verified:false,reason:'Owner career is not at a verified season boundary.'});

    const calendar=run.stage==='regular'?ownerCalendarWeek(run.abbr,run.week,run.season):undefined;
    const isPreseason=run.stage==='preseason';const isBye=run.stage==='regular'&&Boolean(calendar?.isBye);const isRegularGame=run.stage==='regular'&&!isBye;
    const gm=GM_FOOTBALL[String(req?.body?.gmId||'')]||75;const coach=COACH_FOOTBALL[String(req?.body?.coachId||'')]||75;const footballStrength=(gm+coach)/2;
    const winChance=clamp(.47+(footballStrength-75)/220,.32,.72);
    const won=!isPreseason&&!isBye&&randomInt(0,1_000_000)<Math.round(winChance*1_000_000);
    const completedWins=isRegularGame?run.wins+(won?1:0):run.wins;const completedLosses=isRegularGame?run.losses+(won?0:1):run.losses;
    const advance=advanceOwnerSeason({abbr:run.abbr,season:run.season,week:run.week,stage:run.stage,wins:run.wins,losses:run.losses,cashM:350,ticketPrice:125,parkingPrice:35,fanTrust:55,stadium:72,gmCostM:0,coachCostM:0,playoffSeed:run.playoff_seed||undefined},won);
    const nextSeason=advance.seasonEnded?run.season+1:run.season;const nextWins=advance.seasonEnded?0:completedWins;const nextLosses=advance.seasonEnded?0:completedLosses;const nextSeed=advance.seasonEnded?null:(advance.playoffSeed??run.playoff_seed??null);
    const committed=await service.rpc('commit_ball_knower_verified_owner_step',{p_user_id:auth.data.user.id,p_expected_version:run.version,p_next_season:nextSeason,p_next_week:advance.nextWeek,p_next_stage:advance.nextStage,p_next_wins:nextWins,p_next_losses:nextLosses,p_next_playoff_seed:nextSeed,p_won:won});
    if(committed.error)throw committed.error;
    return res.status(200).json({ok:true,verified:true,won,isBye,isPreseason,run:committed.data?.run||null,milestoneIds:Array.isArray(committed.data?.milestoneIds)?committed.data.milestoneIds:[]});
  }catch(error:any){
    console.warn('mode-progression-owner-step-failed',String(error?.message||error));
    return res.status(500).json({error:'Could not verify Owner progression.'});
  }
}
