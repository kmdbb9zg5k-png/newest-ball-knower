import {createClient} from '@supabase/supabase-js';

const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'https://gpnboygoosrmeydwjpvk.supabase.co';
const serviceKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const service=serviceKey?createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const bearer=(req:any)=>{const raw=String(req?.headers?.authorization||'');return raw.startsWith('Bearer ')?raw.slice(7):''};
const AVATAR_BUCKET='ball-knower-avatars';

async function removeAvatarObjects(userId:string){
  if(!service)return;
  const listed=await service.storage.from(AVATAR_BUCKET).list(userId,{limit:100,sortBy:{column:'name',order:'asc'}});
  if(listed.error)throw listed.error;
  const paths=(listed.data||[]).filter(item=>item.name&&!item.name.endsWith('/')).map(item=>`${userId}/${item.name}`);
  if(!paths.length)return;
  const removed=await service.storage.from(AVATAR_BUCKET).remove(paths);
  if(removed.error)throw removed.error;
}

export default async function handler(req:any,res:any){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  if(!service)return res.status(503).json({error:'Account deletion is not configured.'});

  try{
    const token=bearer(req);
    if(!token)return res.status(401).json({error:'Sign in required'});
    const auth=await service.auth.getUser(token);
    if(auth.error||!auth.data.user)return res.status(401).json({error:'Session expired'});
    const user=auth.data.user;

    if(String(req?.body?.confirmation||'')!=='DELETE'){
      return res.status(400).json({error:'Deletion confirmation is required.'});
    }

    // Delete user-owned avatar bytes before removing the auth identity. Database
    // cleanup itself is transactionally coupled to auth.users through the migration
    // trigger, so failed relational cleanup aborts the account deletion.
    await removeAvatarObjects(user.id);
    const deleted=await service.auth.admin.deleteUser(user.id,false);
    if(deleted.error)throw deleted.error;

    return res.status(200).json({ok:true});
  }catch(error:any){
    console.warn('account-delete-failed',String(error?.message||error));
    return res.status(500).json({error:'Your account could not be deleted. No retry was performed automatically.'});
  }
}
