import {createPrivateKey,sign} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {verifyAppleDeletionIdentity} from '../server/appleDeletionIdentity.js';
import {createResilientFetch} from '../resilientFetch.js';

const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||'https://gpnboygoosrmeydwjpvk.supabase.co';
const serviceKey=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
const service=serviceKey?createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:createResilientFetch({readAttempts:1,readTimeoutMs:10_000,writeTimeoutMs:10_000})}}):null;
const bearer=(req:any)=>{const raw=String(req?.headers?.authorization||'');return raw.startsWith('Bearer ')?raw.slice(7):''};
const AVATAR_BUCKET='ball-knower-avatars';
const base64url=(value:Buffer|string)=>Buffer.from(value).toString('base64url');

async function removeAvatarObjects(userId:string){
  if(!service)return;
  const prefixes=[userId],seen=new Set(prefixes),paths:string[]=[];
  let pages=0;
  // Collect before removing so pagination cannot skip files as pages shrink.
  // Storage policies allow nested owner folders, including legacy uploads.
  while(prefixes.length){
    const prefix=prefixes.pop()!;
    for(let offset=0;;offset+=100){
      if(++pages>200)throw new Error('Avatar cleanup needs another attempt.');
      const listed=await service.storage.from(AVATAR_BUCKET).list(prefix,{limit:100,offset,sortBy:{column:'name',order:'asc'}});
      if(listed.error)throw listed.error;
      for(const item of listed.data||[]){
        if(!item.name)continue;
        const path=`${prefix}/${item.name}`;
        if(item.id)paths.push(path);
        else if(!seen.has(path)){seen.add(path);prefixes.push(path);}
      }
      if((listed.data||[]).length<100)break;
    }
  }
  for(let offset=0;offset<paths.length;offset+=100){
    const removed=await service.storage.from(AVATAR_BUCKET).remove(paths.slice(offset,offset+100));
    if(removed.error)throw removed.error;
  }
}

const hasAppleIdentity=(user:any)=>{
  const providers=Array.isArray(user?.app_metadata?.providers)?user.app_metadata.providers:[];
  return providers.includes('apple')||Boolean(user?.identities?.some((identity:any)=>identity?.provider==='apple'));
};

function appleClientSecret(clientId=process.env.APPLE_OAUTH_CLIENT_ID||''){
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

async function revokeAppleAuthorization(providerToken:string,tokenType:'access_token'|'refresh_token',client=appleClientSecret(),signal=AbortSignal.timeout(10_000)){
  if(!client)throw new Error('Apple authorization revocation is not configured.');
  const body=new URLSearchParams({client_id:client.clientId,client_secret:client.secret,token:providerToken,token_type_hint:tokenType});
  const response=await fetch('https://appleid.apple.com/auth/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal});
  if(!response.ok)throw new Error(`Apple authorization revocation failed (${response.status}).`);
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

    let appleAuthorizationRevoked:boolean|null=null;
    let manualAppleRevokeRequired=false;
    let appleRevocationReason:string|null=null;
    if(hasAppleIdentity(user)){
      const refreshToken=String(req?.body?.providerRefreshToken||'').trim();
      const accessToken=String(req?.body?.providerToken||'').trim();
      const providerToken=refreshToken||accessToken;
      const native=req?.body?.appleAuthorization;
      if(native){
        const clientId=process.env.APPLE_NATIVE_CLIENT_ID||'com.ballknower.ios';
        const client=appleClientSecret(clientId);
        if(!client){
          manualAppleRevokeRequired=true;
          appleAuthorizationRevoked=false;
          appleRevocationReason='server_config_missing';
        }else{
          try{
            if(typeof native.authorizationCode!=='string'||native.authorizationCode.length>4096||
               typeof native.nonce!=='string'||!/^[a-f0-9]{64}$/.test(native.nonce)||typeof native.user!=='string')throw new Error('Invalid Apple authorization.');
            const signal=AbortSignal.timeout(10_000);
            const body=new URLSearchParams({client_id:client.clientId,client_secret:client.secret,code:native.authorizationCode,grant_type:'authorization_code'});
            const response=await fetch('https://appleid.apple.com/auth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body,signal});
            if(!response.ok)throw new Error('Apple authorization could not be exchanged.');
            const tokens=await response.json() as {id_token?:string;refresh_token?:string};
            if(!tokens.id_token||!tokens.refresh_token)throw new Error('Apple did not return a revocable authorization.');
            const linkedSubjects=(user.identities||[]).filter(identity=>identity.provider==='apple').map(identity=>String(identity.identity_data?.sub||identity.id||''));
            await verifyAppleDeletionIdentity(tokens.id_token,{clientId,nonce:native.nonce,subject:native.user,linkedSubjects},signal);
            await revokeAppleAuthorization(tokens.refresh_token,'refresh_token',client,signal);
            appleAuthorizationRevoked=true;
          }catch{
            // Never revoke another Apple account or delete the Ball Knower
            // identity after an unverified, expired, replayed or failed code.
            return res.status(409).json({error:'Apple authorization could not be verified. Your account was not deleted. Try again using the Apple account linked to Ball Knower.',code:'APPLE_AUTHORIZATION_FAILED'});
          }
        }
      }else if(providerToken){
        try{
          await revokeAppleAuthorization(providerToken,refreshToken?'refresh_token':'access_token');
          appleAuthorizationRevoked=true;
        }catch(error:any){
          // Apple requires the Ball Knower account deletion request to continue
          // even when a provider token cannot be revoked automatically. Surface
          // manual revocation to the client instead of stranding the account.
          console.warn('apple-authorization-revocation-deferred',{status:Number.isInteger(error?.status)?error.status:null});
          appleAuthorizationRevoked=false;
          manualAppleRevokeRequired=true;
          appleRevocationReason='provider_unavailable';
        }
      }else{
        appleAuthorizationRevoked=false;
        manualAppleRevokeRequired=true;
        appleRevocationReason='missing_provider_token';
      }
    }

    // Remove user-owned avatar bytes before removing the auth identity. Database
    // cleanup itself is transactionally coupled to auth.users, so failed
    // relational cleanup aborts account deletion rather than leaving partial data.
    await removeAvatarObjects(user.id);
    // Revoke every refresh session before removing the identity. Issued access
    // JWTs still expire naturally; this is not a claim of instant JWT revocation.
    const signedOut=await service.auth.admin.signOut(token,'global');
    if(signedOut.error)throw signedOut.error;
    const deleted=await service.auth.admin.deleteUser(user.id,false);
    if(deleted.error)throw deleted.error;

    return res.status(200).json({ok:true,appleAuthorizationRevoked,manualAppleRevokeRequired,appleRevocationReason});
  }catch(error:any){
    console.warn('account-delete-failed',{status:Number.isInteger(error?.status)?error.status:null});
    return res.status(500).json({error:'Your account could not be deleted. No retry was performed automatically.'});
  }
}
