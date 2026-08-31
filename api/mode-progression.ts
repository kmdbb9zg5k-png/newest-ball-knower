import{createClient}from'@supabase/supabase-js';

const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'https://gpnboygoosrmeydwjpvk.supabase.co';
const serviceKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const service=serviceKey?createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const bearer=(req:any)=>{const raw=String(req?.headers?.authorization||'');return raw.startsWith('Bearer ')?raw.slice(7):''};

export default async function handler(req:any,res:any){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!service)return res.status(503).json({error:'Progression service is not configured.'});
  try{
    const token=bearer(req);if(!token)return res.status(401).json({error:'Sign in required'});
    const auth=await service.auth.getUser(token);if(auth.error||!auth.data.user)return res.status(401).json({error:'Session expired'});
    const mode=String(req?.body?.mode||'');const snapshot=req?.body?.snapshot;
    if(!['owner','agent'].includes(mode)||!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))return res.status(400).json({error:'Invalid mode snapshot'});
    const forbidden=['eventType','event_type','eventKey','event_key','xp','xpAwarded','ratingDelta','rating_delta'];
    if(forbidden.some(key=>Object.prototype.hasOwnProperty.call(snapshot,key)))return res.status(400).json({error:'Reward fields are server-owned'});
    if(JSON.stringify(snapshot).length>8192)return res.status(413).json({error:'Mode snapshot is too large'});
    const result=await service.rpc('record_ball_knower_verified_mode_snapshot',{p_user_id:auth.data.user.id,p_mode:mode,p_snapshot:snapshot});
    if(result.error)throw result.error;
    const milestoneIds=(Array.isArray(result.data)?result.data:[]).map((row:any)=>Number(row?.milestone_id)).filter(Number.isFinite);
    return res.status(200).json({ok:true,milestoneIds});
  }catch(error:any){
    console.warn('mode-progression-sync-failed',String(error?.message||error));
    return res.status(500).json({error:'Could not verify mode progression.'});
  }
}
