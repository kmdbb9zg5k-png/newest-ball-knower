import {createPrivateKey,sign} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'https://gpnboygoosrmeydwjpvk.supabase.co';
const serviceKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const service=serviceKey?createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}}):null;
const bearer=(req:any)=>{const raw=String(req?.headers?.authorization||'');return raw.startsWith('Bearer ')?raw.slice(7):''};
const AVATAR_BUCKET='ball-knower-avatars';
const base64url=(value:Buffer|string)=>Buffer.from(value).toString('base64url');

async function removeAvatarObjects(userId:string){
  if(!service)return;
  const listed=await service.storage.from(AVATAR_BUCKET).list(userId,{limit:100,sortBy:{column:'name',order:'asc'}});
  if(listed.error)throw listed.error;
  const paths=(listed.data||[]).filter(item=>item.name&&!item.name.endsWith('/')).map(item=>`${userId}/${item.name}`);
  if(!paths.length)return;
  const removed=await service.storage.from(AVATAR_BUCKET).remove(paths);
  if(removed.error)throw removed.error;
}

const hasAppleIdentity=(user:any)=>{
  const providers=Array.isArray(user?.app_metadata?.providers)?user.app_metadata.providers:[];
  return providers.includes('apple')||Boolean(user?.identities?.some((identity:any)=>identity?.provider==='apple'));
};

function appleClientSecret(){
  const clientId=process.env.APPLE_OAUTH_CLIENT_ID||'';
  const teamId=process.env.APPLE_TEAM_ID||'';
  const keyId=process.env.APPLE_KEY_ID||'';
  const privateKey=String(process.env.APPLE_PRIVATE_KEY||'').replace(/\\n/g,'\n');
  if(!clientId||!teamId||!keyId||!privateKey)return null;
  const now=Math.floor(Date.now()/1000);
  const header=base64url(JSON.stringify({alg:'ES256',kid:keyId,typ:'JWT'}));
  const payload=base64url(JSON.stringify({iss:teamId,iat:now,exp:now+600,aud:'https://appleid.apple.com',sub:clientId}));
  const unsigned=`${header}.${payload}`;
  const signature=sign('sha256',Buffer.from(unsigned),{key:createPrivateKey(privateKey),dsaEncoding:'ieee-p1363'});
  return{clientId,secret:`${unsigned}.${base64url(signature)}`};
}

async function revokeAppleAuthorization(providerToken:string,tokenType:'access_token'|'refresh_token'){
  const client=appleClientSecret();
  if(!client)throw Object.assign(new Error('Apple authorization revocation is not configured.'),{code:'APPLE_REVOCATION_NOT_CONFIGURED'});
  const body=new URLSearchParams({client_id:client.clientId,client_secret:client.secret,token:providerToken,token_type_hint:tokenType});
  const response=await fetch('https://appleid.apple.com/auth/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal:AbortSignal.timeout(10_000)});
  if(!response.ok)throw Object.assign(new Error(`Apple authorization revocation failed (${response.status}).`),{code:'APPLE_REVOCATION_FAILED'});
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

    if(String(req?.body?.confirmation||'')!=='DELETE')return res.status(400).json({error:'Deletion confirmation is required.'});

    if(hasAppleIdentity(user)){
      const refreshToken=String(req?.body?.providerRefreshToken||'').trim();
      const accessToken=String(req?.body?.providerToken||'').trim();
      const providerToken=refreshToken||accessToken;
      if(!providerToken){
        return res.status(409).json({error:'Sign in with Apple again before deleting your account.',code:'APPLE_REAUTH_REQUIRED'});
      }
      await revokeAppleAuthorization(providerToken,refreshToken?'refresh_token':'access_token');
    }

    // Apple authorization is revoked first when applicable. Delete user-owned
    // avatar bytes before removing the auth identity. Database cleanup itself is
    // transactionally coupled to auth.users, so failed relational cleanup aborts
    // the account deletion rather than leaving a partial Ball Knower identity.
    await removeAvatarObjects(user.id);
    const deleted=await service.auth.admin.deleteUser(user.id,false);
    if(deleted.error)throw deleted.error;

    return res.status(200).json({ok:true});
  }catch(error:any){
    const code=String(error?.code||'');
    console.warn('account-delete-failed',code||String(error?.message||error));
    if(code==='APPLE_REVOCATION_NOT_CONFIGURED')return res.status(503).json({error:'Apple account deletion is not fully configured.',code});
    if(code==='APPLE_REVOCATION_FAILED')return res.status(502).json({error:'Apple authorization could not be revoked. Your Ball Knower account was not deleted.',code});
    return res.status(500).json({error:'Your account could not be deleted. No retry was performed automatically.'});
  }
}
