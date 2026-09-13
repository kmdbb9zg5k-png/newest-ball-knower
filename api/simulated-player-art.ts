import { createHash, timingSafeEqual } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { appearanceRenderKey, defaultAppearance, normalizeAppearance, type AppearancePlayer, type UniformVariant } from '../solo/appearance';
import {
  SIMULATED_ART_BUCKET,SIMULATED_ART_VERSION,fictionalUniformPrompt,isSupportedSimulatedPlayerId,
  positionForArt,simulatedIdentityFingerprint,simulatedPlayerIdentity,
} from '../solo/artIdentity';
import { SOLO_TEAM_THEMES } from '../soloUniverse';

const DEFAULT_SUPABASE_URL='https://gpnboygoosrmeydwjpvk.supabase.co';
const DEFAULT_PUBLISHABLE_KEY='sb_publishable_tgnOH0RUtswLI58isL5Qfw_Pq3xaV9h';
const TABLE='ball_knower_simulated_player_art';
const MAX_BATCH=4;
const REVIEW_CHECKS=['distortedEyes','duplicatedFeatures','malformedEars','mangledHands','warpedJerseys','unreadableNumbers','identityMatch','uniqueIdentity','realisticAppearance','sharpExpandedView'] as const;
type Status='generating'|'pending_review'|'approved'|'rejected';

type ArtRow={
  player_id:string;team_abbr:string;uniform_variant:UniformVariant;appearance_key:string;art_version:number;
  identity_fingerprint:string;identity_descriptor:Record<string,unknown>;status:Status;
  identity_anchor_path:string|null;source_portrait_path:string|null;source_full_body_path:string|null;avatar_path:string|null;row_path:string|null;
  card_path:string|null;portrait_path:string|null;full_body_path:string|null;source_width:number|null;source_height:number|null;
  content_sha256:string|null;quality_report:Record<string,unknown>;reviewed_at:string|null;
  updated_at:string;
};
type JobInput={playerId:string;team:string;variant?:UniformVariant;position?:string;name?:string;number?:number;age?:number;heightInches?:number;weightLbs?:number;appearance?:unknown};

const json=(res:any,status:number,payload:unknown,cache='no-store')=>{
  res.setHeader('Cache-Control',cache);res.setHeader('Content-Type','application/json; charset=utf-8');return res.status(status).json(payload);
};
const safeText=(value:unknown,max:number,fallback:string)=>{
  const text=String(value??'').trim().replace(/[^A-Za-z0-9 .'-]/g,' ').replace(/\s+/g,' ').slice(0,max);
  return text||fallback;
};
const safeInt=(value:unknown,min:number,max:number,fallback:number)=>{const number=Math.round(Number(value));return Number.isFinite(number)&&number>=min&&number<=max?number:fallback;};
const safeVariant=(value:unknown):UniformVariant=>['home','away','alternate'].includes(String(value))?value as UniformVariant:'home';
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const secureEqual=(provided:string,expected:string)=>{
  const a=Buffer.from(provided),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);
};

function clients():{publicClient:any;serviceClient:any|null} {
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||DEFAULT_SUPABASE_URL;
  const publishable=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_ANON_KEY||DEFAULT_PUBLISHABLE_KEY;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  return {
    publicClient:createClient(url,publishable,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}),
    serviceClient:serviceKey?createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):null,
  };
}

function publicUrl(client:any,path:string|null) {
  return path?client.storage.from(SIMULATED_ART_BUCKET).getPublicUrl(path).data.publicUrl:undefined;
}

function manifest(client:any,row:ArtRow) {
  const urls={avatar:publicUrl(client,row.avatar_path),row:publicUrl(client,row.row_path),card:publicUrl(client,row.card_path),portrait:publicUrl(client,row.portrait_path),fullBody:publicUrl(client,row.full_body_path)};
  const complete=Object.values(urls).every(Boolean);
  return {status:row.status,playerId:row.player_id,teamAbbr:row.team_abbr,uniformVariant:row.uniform_variant,appearanceKey:row.appearance_key,
    identityFingerprint:row.identity_fingerprint,artVersion:row.art_version,urls:complete?urls:undefined,width:row.source_width,height:row.source_height,reviewedAt:row.reviewed_at};
}

function normalizeJob(input:JobInput) {
  const playerId=safeText(input.playerId,110,'');
  if(!isSupportedSimulatedPlayerId(playerId))throw new Error('Unsupported simulated player ID.');
  const team=String(input.team||'').toUpperCase();
  const teamRecord=SOLO_TEAM_THEMES.find(item=>item.abbr===team);
  if(!teamRecord&&!['BK','FA'].includes(team))throw new Error('Use a fictional Ball Knower team.');
  const position=positionForArt(String(input.position||'WR').toUpperCase());
  const teamName=teamRecord?.name||(team==='FA'?'Ball Knower Draft Class':'Ball Knower Training');
  const player:AppearancePlayer={id:playerId,name:safeText(input.name,60,'Simulated Player'),team,teamName,position,
    jerseyNumber:safeInt(input.number,0,99,defaultAppearance({id:playerId,name:'Simulated Player',team,position}).number),
    age:safeInt(input.age,20,45,21+(simulatedPlayerIdentity({id:playerId,name:'Simulated Player',team,position}).identitySeed%15)),
    heightInches:safeInt(input.heightInches,65,82,72),weightLbs:safeInt(input.weightLbs,155,400,210)};
  const appearance=normalizeAppearance(player,input.appearance??defaultAppearance(player));
  const appearanceKey=appearanceRenderKey(appearance);
  return {player,appearance,appearanceKey,variant:safeVariant(input.variant),identity:simulatedPlayerIdentity(player),fingerprint:simulatedIdentityFingerprint(player)};
}

function identityPrompt(job:ReturnType<typeof normalizeJob>) {
  const i=job.identity;
  return `Create one entirely fictional adult professional football player identity anchor. This is not a real athlete. ${i.approximateAge} years old; ${i.skinTone} skin; ${i.faceShape} face; ${i.eyeColor} eyes; ${i.hairColor} ${i.hairStyle}; ${i.facialHair}; ${i.distinguishingDetail}. ${i.heightInches} inches and ${i.weightLbs} pounds with a ${i.bodyArchetype} football build. ${i.tattooProfile} tattoos. Neutral dark football training jersey with no number, words, logos, league marks or trademarks. Photorealistic head-and-shoulders sports database portrait, natural pores and skin texture, believable ears, eyes, hairline and facial hair, neutral expression, dark stadium tunnel, cinematic key and rim lighting, centered 4:5 crop. No helmet. No watermark. Avoid cartoon, illustration, waxy skin, duplicated features, distorted eyes, malformed ears, blur, or any resemblance to a named real athlete.`;
}

function portraitPrompt(job:ReturnType<typeof normalizeJob>) {
  const i=job.identity,number=job.appearance.number;
  return `Use the supplied fictional identity anchor as the exact person reference. Preserve the same face, skin tone, age, facial structure, eyes, ears, hairline, ${i.hairStyle}, ${i.facialHair}, and distinguishing details. Create a photorealistic chest-up professional football player portrait in ${fictionalUniformPrompt(job.player,number,job.variant)}. Jersey number ${number} must be correct where visible. Equipment: ${job.appearance.eyeBlack?'eye black':'no eye black'}; ${job.appearance.sleeves} arm sleeves; ${job.appearance.gloves} gloves. Tattoo styling: ${job.appearance.tattooCoverage}, ${job.appearance.tattooStyle}. No helmet so the face is fully visible. Premium football game database card photography, realistic pores, fabric weave and stitching, dark stadium tunnel, cinematic key and rim lighting, centered 4:5 crop. No words, logos, trademarks, watermark, real teams, or real players. Reject distorted eyes, duplicate features, malformed ears, warped numbers, plastic skin, cartoon styling, or blur.`;
}

function bodyPrompt(job:ReturnType<typeof normalizeJob>) {
  const i=job.identity,number=job.appearance.number;
  return `Use the supplied fictional identity anchor as the exact person reference. Preserve the same face, skin tone, age, facial structure, eyes, hairline, ${i.hairStyle}, ${i.facialHair}, and distinguishing details. Create a photorealistic full-body professional football player, ${i.heightInches} inches and ${i.weightLbs} pounds, with a realistic ${i.bodyArchetype} position-appropriate build for ${job.player.position}. ${fictionalUniformPrompt(job.player,number,job.variant)}. Include fitted shoulder pads, football pants, socks and cleats. Equipment: ${job.appearance.eyeBlack?'eye black':'no eye black'}; ${job.appearance.sleeves} arm sleeves; ${job.appearance.gloves} gloves. Tattoo styling: ${job.appearance.tattooCoverage}, ${job.appearance.tattooStyle}; stable identity default: ${i.tattooProfile}. Helmet held at the side so the face remains visible. Natural standing three-quarter hero pose with both complete hands and both cleats inside frame. Premium football game database render, realistic fabric weave, stitching, pads, skin texture and anatomy, dark stadium tunnel, cinematic sports lighting. Vertical 2:3 composition. No words except the clearly readable jersey number ${number}; no logos, trademarks, watermark, real teams or real players. Reject extra fingers, fused hands, extra limbs, warped jersey, duplicate facial features, unreadable number, mannequin proportions, plastic skin, blur, or cropped feet.`;
}

function outputImage(interaction:any):{mime:string;buffer:Buffer} {
  const output=interaction?.output_image;
  if(!output?.data)throw new Error('The image model returned no artwork.');
  return {mime:String(output.mime_type||'image/jpeg'),buffer:Buffer.from(output.data,'base64')};
}

async function generateImage(ai:GoogleGenAI,prompt:string,reference?:{mime:string;buffer:Buffer},full=false) {
  const input:any[]=[{type:'text',text:prompt}];
  if(reference)input.push({type:'image',mime_type:reference.mime,data:reference.buffer.toString('base64')});
  const interaction=await ai.interactions.create({model:'gemini-3.1-flash-image',store:false,input,
    response_format:{type:'image',mime_type:'image/jpeg',aspect_ratio:full?'2:3':'4:5',image_size:full?'2K':'1K'}} as any);
  return outputImage(interaction);
}

async function upload(client:any,path:string,buffer:Buffer,contentType:string) {
  const {error}=await client.storage.from(SIMULATED_ART_BUCKET).upload(path,buffer,{contentType,cacheControl:'31536000',upsert:false});
  if(error&&!/already exists|duplicate/i.test(error.message))throw new Error(`Artwork upload failed: ${error.message}`);
}

async function download(client:any,path:string):Promise<{mime:string;buffer:Buffer}> {
  const {data,error}=await client.storage.from(SIMULATED_ART_BUCKET).download(path);
  if(error||!data)throw new Error(`Identity anchor download failed: ${error?.message||'empty object'}`);
  return {mime:data.type||'image/jpeg',buffer:Buffer.from(await data.arrayBuffer())};
}

async function reusableIdentityAnchor(service:any,job:ReturnType<typeof normalizeJob>) {
  const {data,error}=await service.from(TABLE).select('identity_anchor_path').eq('player_id',job.player.id).eq('identity_fingerprint',job.fingerprint)
    .eq('art_version',SIMULATED_ART_VERSION).not('identity_anchor_path','is',null).order('reviewed_at',{ascending:false,nullsFirst:false}).limit(1).maybeSingle();
  if(error)throw new Error(`Could not resolve the persistent identity anchor: ${error.message}`);
  return data?.identity_anchor_path?{path:String(data.identity_anchor_path),image:await download(service,String(data.identity_anchor_path))}:null;
}

async function renderJob(service:any,ai:GoogleGenAI,input:JobInput) {
  const job=normalizeJob(input),pathHash=sha(job.appearanceKey).slice(0,20);
  const identity=job.identity as unknown as Record<string,unknown>;
  const rowKey={player_id:job.player.id,team_abbr:job.player.team,uniform_variant:job.variant,appearance_key:job.appearanceKey,art_version:SIMULATED_ART_VERSION};
  const {data:existing}:{data:ArtRow|null}=await service.from(TABLE).select('*').match(rowKey).maybeSingle();
  if(existing?.status==='approved'||existing?.status==='pending_review')return existing as ArtRow;
  if(existing?.status==='generating'&&Date.now()-Date.parse(existing.updated_at)<15*60_000)return existing as ArtRow;
  const {error:startingError}=await service.from(TABLE).upsert({...rowKey,identity_fingerprint:job.fingerprint,identity_descriptor:identity,status:'generating',rejection_reason:null,updated_at:new Date().toISOString()},{onConflict:'player_id,team_abbr,uniform_variant,appearance_key,art_version'});
  if(startingError)throw new Error(`Could not reserve artwork identity: ${startingError.message}`);

  const identityRoot=`v${SIMULATED_ART_VERSION}/identities/${job.player.id}/${sha(job.fingerprint).slice(0,20)}`;
  const reusable=await reusableIdentityAnchor(service,job);
  const identityAnchorPath=reusable?.path??`${identityRoot}/anchor.jpg`;
  if(!reusable){
    const candidate=await generateImage(ai,identityPrompt(job));
    const candidateMeta=await sharp(candidate.buffer).metadata();
    if((candidateMeta.width??0)<640||(candidateMeta.height??0)<800)throw new Error('Identity anchor is below the production minimum.');
    await upload(service,identityAnchorPath,candidate.buffer,candidate.mime);
  }
  // The deterministic, write-once object is the identity authority. Downloading
  // it after upload also makes concurrent first renders converge on one face.
  const anchor=reusable?.image??await download(service,identityAnchorPath);
  const portrait=await generateImage(ai,portraitPrompt(job),anchor);
  const full=await generateImage(ai,bodyPrompt(job),anchor,true);
  const anchorMeta=await sharp(anchor.buffer).metadata(),portraitMeta=await sharp(portrait.buffer).metadata(),fullMeta=await sharp(full.buffer).metadata();
  if((anchorMeta.width??0)<640||(anchorMeta.height??0)<800)throw new Error('Identity anchor is below the production minimum.');
  if((portraitMeta.width??0)<640||(portraitMeta.height??0)<800)throw new Error('Portrait source is below the expanded-view production minimum.');
  if((fullMeta.width??0)<768||(fullMeta.height??0)<1536)throw new Error('Full-body source is below the production minimum.');
  const derivatives={
    avatar:await sharp(portrait.buffer).resize(96,96,{fit:'cover',position:'attention'}).webp({quality:76}).toBuffer(),
    row:await sharp(portrait.buffer).resize(160,200,{fit:'cover',position:'attention'}).webp({quality:78}).toBuffer(),
    card:await sharp(portrait.buffer).resize(384,480,{fit:'cover',position:'attention'}).webp({quality:82}).toBuffer(),
    portrait:await sharp(portrait.buffer).resize(640,800,{fit:'cover',position:'attention',withoutEnlargement:true}).webp({quality:84}).toBuffer(),
    fullBody:await sharp(full.buffer).resize(768,1152,{fit:'cover',position:'centre',withoutEnlargement:true}).webp({quality:84}).toBuffer(),
  };
  const assetHash=sha(Buffer.concat([portrait.buffer,full.buffer])).slice(0,20);
  const root=`v${SIMULATED_ART_VERSION}/uniforms/${job.player.id}/${job.player.team}/${job.variant}/${pathHash}/${assetHash}`;
  const paths={identityAnchor:identityAnchorPath,sourcePortrait:`${root}/source-portrait.jpg`,sourceFull:`${root}/source-full-body.jpg`,avatar:`${root}/avatar.webp`,row:`${root}/row.webp`,card:`${root}/card.webp`,portrait:`${root}/portrait.webp`,fullBody:`${root}/full-body.webp`};
  await Promise.all([
    upload(service,paths.sourcePortrait,portrait.buffer,portrait.mime),upload(service,paths.sourceFull,full.buffer,full.mime),
    upload(service,paths.avatar,derivatives.avatar,'image/webp'),upload(service,paths.row,derivatives.row,'image/webp'),
    upload(service,paths.card,derivatives.card,'image/webp'),upload(service,paths.portrait,derivatives.portrait,'image/webp'),upload(service,paths.fullBody,derivatives.fullBody,'image/webp'),
  ]);
  const qualityReport={automated:{identityAnchor:[anchorMeta.width,anchorMeta.height],portrait:[portraitMeta.width,portraitMeta.height],fullBody:[fullMeta.width,fullMeta.height],identityAnchorReused:Boolean(reusable),identityAnchorSha256:sha(anchor.buffer),portraitSha256:sha(portrait.buffer),fullBodySha256:sha(full.buffer),derivativeBytes:Object.fromEntries(Object.entries(derivatives).map(([key,value])=>[key,value.length]))},manual:{required:true,passed:false}};
  const {data:completed,error:completeError}=await service.from(TABLE).update({status:'pending_review',identity_anchor_path:paths.identityAnchor,source_portrait_path:paths.sourcePortrait,source_full_body_path:paths.sourceFull,
    avatar_path:paths.avatar,row_path:paths.row,card_path:paths.card,portrait_path:paths.portrait,full_body_path:paths.fullBody,
    source_width:fullMeta.width,source_height:fullMeta.height,content_sha256:sha(full.buffer),quality_report:qualityReport,generated_at:new Date().toISOString(),updated_at:new Date().toISOString()}).match(rowKey).select('*').single();
  if(completeError)throw new Error(`Could not finalize artwork manifest: ${completeError.message}`);
  return completed as ArtRow;
}

export default async function handler(req:any,res:any) {
  const {publicClient,serviceClient}=clients();
  if(req.method==='GET'){
    try {
      const input:JobInput={playerId:String(req.query?.playerId||''),team:String(req.query?.team||''),variant:safeVariant(req.query?.variant),position:String(req.query?.position||'WR'),name:String(req.query?.name||''),number:Number(req.query?.number),age:Number(req.query?.age),heightInches:Number(req.query?.heightInches),weightLbs:Number(req.query?.weightLbs)};
      const job=normalizeJob(input);
      const requestedAppearanceKey=String(req.query?.appearanceKey||job.appearanceKey);
      if(requestedAppearanceKey.length<8||requestedAppearanceKey.length>240)throw new Error('Appearance key has an invalid length.');
      const {data,error}=await publicClient.from(TABLE).select('*').match({player_id:job.player.id,team_abbr:job.player.team,uniform_variant:job.variant,appearance_key:requestedAppearanceKey,art_version:SIMULATED_ART_VERSION}).eq('status','approved').maybeSingle();
      if(error)return json(res,503,{status:'missing',error:'Player artwork catalog is temporarily unavailable.'});
      if(!data)return json(res,202,{status:'missing',playerId:job.player.id,teamAbbr:job.player.team,uniformVariant:job.variant,appearanceKey:job.appearanceKey,identityFingerprint:job.fingerprint,artVersion:SIMULATED_ART_VERSION},'private, max-age=30');
      return json(res,200,manifest(publicClient,data as ArtRow),'public, max-age=300, stale-while-revalidate=86400');
    } catch(error:any){return json(res,400,{status:'missing',error:String(error?.message||'Invalid artwork request.')});}
  }
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  const expected=process.env.SIMULATED_PLAYER_ART_ADMIN_KEY||'';
  const provided=String(req.headers['x-ball-knower-art-key']||'');
  if(!expected||!provided||!secureEqual(provided,expected))return json(res,401,{error:'Artwork publisher authorization required.'});
  if(!serviceClient)return json(res,503,{error:'Server-side artwork storage is not configured.'});
  const action=String(req.body?.action||'generate');
  try {
    if(action==='generate'){
      if(process.env.SIMULATED_PLAYER_ART_GENERATION_ENABLED!=='true'||!process.env.GEMINI_API_KEY)return json(res,503,{error:'Production artwork generation is not enabled.'});
      const jobs=(Array.isArray(req.body?.jobs)?req.body.jobs:[req.body?.job]).filter(Boolean).slice(0,MAX_BATCH) as JobInput[];
      if(!jobs.length)return json(res,400,{error:'At least one artwork job is required.'});
      const ai=new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});
      const results=[];for(const job of jobs)results.push(manifest(publicClient,await renderJob(serviceClient,ai,job)));
      return json(res,200,{results});
    }
    if(action==='approve'||action==='reject'){
      const input=req.body?.job as JobInput;const job=normalizeJob(input);
      const match={player_id:job.player.id,team_abbr:job.player.team,uniform_variant:job.variant,appearance_key:job.appearanceKey,art_version:SIMULATED_ART_VERSION};
      const {data:pending}=await serviceClient.from(TABLE).select('quality_report').match(match).eq('status','pending_review').maybeSingle();
      if(!pending)return json(res,409,{error:'Artwork is not awaiting review.'});
      const submitted=req.body?.checklist&&typeof req.body.checklist==='object'?req.body.checklist as Record<string,unknown>:{};
      const checklist=Object.fromEntries(REVIEW_CHECKS.map(check=>[check,submitted[check]===true]));
      const missing=REVIEW_CHECKS.filter(check=>checklist[check]!==true);
      if(action==='approve'&&missing.length)return json(res,422,{error:'Every production visual check must pass before approval.',missingChecks:missing});
      const manual=action==='approve'?{required:true,passed:true,reviewer:safeText(req.body?.reviewer,80,'Ball Knower visual QA'),checklist}:{required:true,passed:false,checklist};
      const quality_report={...(pending.quality_report??{}),manual};
      const patch=action==='approve'?{status:'approved',reviewed_at:new Date().toISOString(),rejection_reason:null,quality_report,updated_at:new Date().toISOString()}:{status:'rejected',rejection_reason:safeText(req.body?.reason,500,'Failed visual QA'),quality_report,updated_at:new Date().toISOString()};
      const {data,error}=await serviceClient.from(TABLE).update(patch).match(match).eq('status','pending_review').select('*').single();
      if(error)return json(res,409,{error:error.message});return json(res,200,manifest(publicClient,data as ArtRow));
    }
    return json(res,400,{error:'Unknown artwork action.'});
  } catch(error:any){console.error('simulated-player-art-error',error?.message||error);return json(res,500,{error:'Unable to process simulated player artwork.',detail:process.env.NODE_ENV==='development'?String(error?.message||error):undefined});}
}
