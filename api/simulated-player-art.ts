import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { appearanceRenderKey, defaultAppearance, normalizeAppearance, type AppearancePlayer, type UniformVariant } from '../solo/appearance';
import {
  SIMULATED_ART_BUCKET,SIMULATED_ART_VERSION,fictionalUniformPrompt,isSupportedSimulatedPlayerId,
  positionForArt,simulatedIdentityFingerprint,simulatedPlayerIdentity,
} from '../solo/artIdentity';
import {
  SIMULATED_ART_BATCH_COST_MICRO_USD as BATCH_COST_MICRO_USD,
  SIMULATED_ART_BUDGET_SCOPE as BUDGET_SCOPE,
  SIMULATED_ART_MODELS as MODELS,
  simulatedArtBudgetLimitMicroUsd,
  type SimulatedArtQualityTier as QualityTier,
} from '../solo/artBudget';
import { SOLO_TEAM_THEMES } from '../soloUniverse';

const DEFAULT_SUPABASE_URL='https://gpnboygoosrmeydwjpvk.supabase.co';
const DEFAULT_PUBLISHABLE_KEY='sb_publishable_tgnOH0RUtswLI58isL5Qfw_Pq3xaV9h';
const TABLE='ball_knower_simulated_player_art';
const BUDGET_TABLE='ball_knower_simulated_art_budgets';
const BATCH_TABLE='ball_knower_simulated_art_batches';
const LEDGER_TABLE='ball_knower_simulated_art_generation_ledger';
const MAX_BATCH=16;
// Batch list prices are $0.0168 and $0.034 per 1K image. The slightly higher
// reservations include prompt-input cost and ensure the hard cap fails safe.
const REVIEW_CHECKS=['distortedEyes','duplicatedFeatures','malformedEars','mangledHands','warpedJerseys','unreadableNumbers','identityMatch','uniqueIdentity','realisticAppearance','sharpExpandedView'] as const;
type Status='generating'|'pending_review'|'approved'|'rejected';

type ArtRow={
  player_id:string;team_abbr:string;uniform_variant:UniformVariant;appearance_key:string;art_version:number;
  identity_fingerprint:string;identity_descriptor:Record<string,unknown>;status:Status;
  identity_anchor_path:string|null;source_sheet_path?:string|null;source_portrait_path:string|null;source_full_body_path:string|null;avatar_path:string|null;row_path:string|null;
  card_path:string|null;portrait_path:string|null;full_body_path:string|null;source_width:number|null;source_height:number|null;
  content_sha256:string|null;quality_report:Record<string,unknown>;reviewed_at:string|null;generation_model?:string|null;
  generation_id?:string|null;estimated_cost_microusd?:number|null;updated_at:string;
};
type JobInput={playerId:string;team:string;variant?:UniformVariant;position?:string;name?:string;number?:number;age?:number;heightInches?:number;weightLbs?:number;appearance?:unknown;attempt?:number};
type StoredBatchJob={generationId:string;dedupeKey:string;attempt:number;input:JobInput};
type BatchRow={id:string;provider_job_name:string|null;model:string;quality_tier:QualityTier;status:string;jobs:StoredBatchJob[];expected_items:number;processed_items:number;expected_cost_microusd:number;provider_state:string|null};

const json=(res:any,status:number,payload:unknown,cache='no-store')=>{
  res.setHeader('Cache-Control',cache);res.setHeader('Content-Type','application/json; charset=utf-8');return res.status(status).json(payload);
};
const safeText=(value:unknown,max:number,fallback:string)=>{
  const text=String(value??'').trim().replace(/[^A-Za-z0-9 .'-]/g,' ').replace(/\s+/g,' ').slice(0,max);
  return text||fallback;
};
const safeInt=(value:unknown,min:number,max:number,fallback:number)=>{const number=Math.round(Number(value));return Number.isFinite(number)&&number>=min&&number<=max?number:fallback;};
const safeVariant=(value:unknown):UniformVariant=>['home','away','alternate'].includes(String(value))?value as UniformVariant:'home';
const safeTier=(value:unknown):QualityTier=>value==='review'?'review':'economy';
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const secureEqual=(provided:string,expected:string)=>{const a=Buffer.from(provided),b=Buffer.from(expected);return a.length===b.length&&timingSafeEqual(a,b);};
const budgetLimitMicroUsd=()=>simulatedArtBudgetLimitMicroUsd(process.env.SIMULATED_PLAYER_ART_BUDGET_USD);
// Keep compatibility with the originally configured Vercel variable. The
// canonical all-caps name remains preferred for every new environment.
const geminiApiKey=()=>process.env.GEMINI_API_KEY||process.env.Gemini_key||'';

function clients():{publicClient:any;serviceClient:any|null} {
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||DEFAULT_SUPABASE_URL;
  const publishable=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_ANON_KEY||DEFAULT_PUBLISHABLE_KEY;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY||'';
  return {
    publicClient:createClient(url,publishable,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}),
    serviceClient:serviceKey?createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}):null,
  };
}

function publicUrl(client:any,path:string|null|undefined) {return path?client.storage.from(SIMULATED_ART_BUCKET).getPublicUrl(path).data.publicUrl:undefined;}
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
  return {player,appearance,appearanceKey,variant:safeVariant(input.variant),identity:simulatedPlayerIdentity(player),fingerprint:simulatedIdentityFingerprint(player),attempt:safeInt(input.attempt,0,20,0)};
}

function serializedInput(job:ReturnType<typeof normalizeJob>):JobInput {
  return {playerId:job.player.id,team:job.player.team,variant:job.variant,position:job.player.position,name:job.player.name,
    number:job.appearance.number,age:job.player.age,heightInches:job.player.heightInches,weightLbs:job.player.weightLbs,
    appearance:job.appearance,attempt:job.attempt};
}

function sheetPrompt(job:ReturnType<typeof normalizeJob>,hasAnchor:boolean) {
  const i=job.identity,number=job.appearance.number;
  const identityDirection=hasAnchor
    ?'Use the supplied fictional identity anchor as the exact same person in both panels. Preserve the face, skin tone, age, facial structure, eyes, ears, hairline, hair and facial hair.'
    :`Create one entirely fictional adult professional football player, not a real athlete: ${i.approximateAge} years old; ${i.skinTone} skin; ${i.faceShape} face; ${i.eyeColor} eyes; ${i.hairColor} ${i.hairStyle}; ${i.facialHair}; ${i.distinguishingDetail}.`;
  return `${identityDirection} Produce one square two-panel professional football photography sheet with a clean split exactly at the vertical center. LEFT HALF: a large chest-up database portrait, face fully visible, no helmet. RIGHT HALF: the exact same player's realistic full body from hair to both cleats, standing in a natural three-quarter hero pose and holding a helmet at his side. Keep each person entirely inside their own half and do not cross the center. ${i.heightInches} inches and ${i.weightLbs} pounds with a ${i.bodyArchetype} build appropriate for ${job.player.position}. Both panels use the exact same ${fictionalUniformPrompt(job.player,number,job.variant)} and clearly readable jersey number ${number}. Equipment: ${job.appearance.eyeBlack?'eye black':'no eye black'}; ${job.appearance.sleeves} arm sleeves; ${job.appearance.gloves} gloves. Tattoos: ${job.appearance.tattooCoverage}, ${job.appearance.tattooStyle}; stable identity detail: ${i.tattooProfile}. Photorealistic skin pores, believable eyes, nose, ears, teeth if visible, hairline, hands, fingers, anatomy, football pads, fabric weave and stitching. Dark stadium tunnel with matching cinematic key and rim lighting in both halves. No divider line, captions, words, logos, trademarks, watermark, real teams or real players. Reject mismatched faces between panels, duplicate features, distorted eyes, malformed ears, extra fingers, fused hands, extra limbs, warped jersey, unreadable or inconsistent number, mannequin proportions, plastic skin, cartoon styling, blur, cropped feet, or cropped hair.`;
}

function rowKey(job:ReturnType<typeof normalizeJob>) {return {player_id:job.player.id,team_abbr:job.player.team,uniform_variant:job.variant,appearance_key:job.appearanceKey,art_version:SIMULATED_ART_VERSION};}

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

function batchRequest(job:ReturnType<typeof normalizeJob>,anchor?:{mime:string;buffer:Buffer}) {
  const parts:any[]=[{text:sheetPrompt(job,Boolean(anchor))}];
  if(anchor)parts.push({inlineData:{mimeType:anchor.mime,data:anchor.buffer.toString('base64')}});
  return {contents:[{role:'user',parts}],config:{responseModalities:['IMAGE'],imageConfig:{aspectRatio:'1:1',imageSize:'1K',personGeneration:'ALLOW_ADULT'}}};
}

function outputBatchImage(value:any):{mime:string;buffer:Buffer} {
  const parts=value?.response?.candidates?.flatMap((candidate:any)=>candidate?.content?.parts??[])??[];
  const part=parts.find((item:any)=>item?.inlineData?.data||item?.inline_data?.data),inline=part?.inlineData??part?.inline_data;
  if(!inline?.data)throw new Error(value?.error?.message||'The batch model returned no artwork.');
  return {mime:String(inline.mimeType||inline.mime_type||'image/png'),buffer:Buffer.from(inline.data,'base64')};
}

async function packageIdentitySheet(service:any,raw:ReturnType<typeof normalizeJob>,generated:{mime:string;buffer:Buffer},stored:StoredBatchJob,model:string,cost:number,batchId:string) {
  const meta=await sharp(generated.buffer).metadata(),width=meta.width??0,height=meta.height??0;
  if(width<900||height<900||Math.abs(width-height)>Math.max(width,height)*0.15)throw new Error('Identity sheet is not a production-size square.');
  // The production bucket intentionally accepts only WebP/JPEG. Normalize the
  // provider output so a PNG response cannot strand an otherwise valid batch.
  const sourceSheet=await sharp(generated.buffer).jpeg({quality:94,mozjpeg:true}).toBuffer();
  const leftWidth=Math.floor(width/2),rightWidth=width-leftWidth;
  const portraitSource=await sharp(generated.buffer).extract({left:0,top:0,width:leftWidth,height}).resize(640,800,{fit:'cover',position:'north'}).jpeg({quality:93}).toBuffer();
  const fullSource=await sharp(generated.buffer).extract({left:leftWidth,top:0,width:rightWidth,height}).resize(768,1536,{fit:'cover',position:'centre'}).jpeg({quality:92}).toBuffer();
  const portraitMeta=await sharp(portraitSource).metadata(),fullMeta=await sharp(fullSource).metadata();
  const derivatives={
    avatar:await sharp(portraitSource).resize(96,96,{fit:'cover',position:'attention'}).webp({quality:76}).toBuffer(),
    row:await sharp(portraitSource).resize(160,200,{fit:'cover',position:'attention'}).webp({quality:78}).toBuffer(),
    card:await sharp(portraitSource).resize(384,480,{fit:'cover',position:'attention'}).webp({quality:82}).toBuffer(),
    portrait:await sharp(portraitSource).resize(640,800,{fit:'cover',position:'attention'}).webp({quality:84}).toBuffer(),
    fullBody:await sharp(fullSource).resize(768,1152,{fit:'contain',background:{r:8,g:10,b:14}}).webp({quality:84}).toBuffer(),
  };
  const identityRoot=`v${SIMULATED_ART_VERSION}/identities/${raw.player.id}/${sha(raw.fingerprint).slice(0,20)}`,reusable=await reusableIdentityAnchor(service,raw);
  const identityAnchorPath=reusable?.path??`${identityRoot}/anchor.jpg`;
  if(!reusable)await upload(service,identityAnchorPath,portraitSource,'image/jpeg');
  const assetHash=sha(sourceSheet).slice(0,20),pathHash=sha(raw.appearanceKey).slice(0,20),root=`v${SIMULATED_ART_VERSION}/uniforms/${raw.player.id}/${raw.player.team}/${raw.variant}/${pathHash}/${assetHash}`;
  const paths={sheet:`${root}/source-sheet.jpg`,identityAnchor:identityAnchorPath,sourcePortrait:`${root}/source-portrait.jpg`,sourceFull:`${root}/source-full-body.jpg`,avatar:`${root}/avatar.webp`,row:`${root}/row.webp`,card:`${root}/card.webp`,portrait:`${root}/portrait.webp`,fullBody:`${root}/full-body.webp`};
  await Promise.all([
    upload(service,paths.sheet,sourceSheet,'image/jpeg'),upload(service,paths.sourcePortrait,portraitSource,'image/jpeg'),upload(service,paths.sourceFull,fullSource,'image/jpeg'),
    upload(service,paths.avatar,derivatives.avatar,'image/webp'),upload(service,paths.row,derivatives.row,'image/webp'),upload(service,paths.card,derivatives.card,'image/webp'),
    upload(service,paths.portrait,derivatives.portrait,'image/webp'),upload(service,paths.fullBody,derivatives.fullBody,'image/webp'),
  ]);
  const qualityReport={automated:{sheet:[width,height],portrait:[portraitMeta.width,portraitMeta.height],fullBody:[fullMeta.width,fullMeta.height],layout:'left-portrait-right-full-body',identityAnchorReused:Boolean(reusable),sheetSha256:sha(sourceSheet),portraitSha256:sha(portraitSource),fullBodySha256:sha(fullSource),derivativeBytes:Object.fromEntries(Object.entries(derivatives).map(([key,value])=>[key,value.length]))},generation:{generationId:stored.generationId,batchId,model,estimatedCostMicrousd:cost,attempt:stored.attempt},manual:{required:true,passed:false}};
  const {data:completed,error}=await service.from(TABLE).update({status:'pending_review',identity_anchor_path:paths.identityAnchor,source_sheet_path:paths.sheet,source_portrait_path:paths.sourcePortrait,source_full_body_path:paths.sourceFull,
    avatar_path:paths.avatar,row_path:paths.row,card_path:paths.card,portrait_path:paths.portrait,full_body_path:paths.fullBody,source_width:fullMeta.width,source_height:fullMeta.height,
    content_sha256:sha(fullSource),generation_model:model,generation_id:stored.generationId,estimated_cost_microusd:cost,quality_report:qualityReport,generated_at:new Date().toISOString(),updated_at:new Date().toISOString()}).match(rowKey(raw)).select('*').single();
  if(error)throw new Error(`Could not finalize artwork manifest: ${error.message}`);
  return completed as ArtRow;
}

async function budgetSnapshot(service:any) {
  const [{data:budget,error:budgetError},{count:approved,error:approvedError},{count:pending,error:pendingError}]=await Promise.all([
    service.from(BUDGET_TABLE).select('*').eq('budget_scope',BUDGET_SCOPE).single(),
    service.from(TABLE).select('*',{count:'exact',head:true}).eq('status','approved'),
    service.from(TABLE).select('*',{count:'exact',head:true}).eq('status','pending_review'),
  ]);
  if(budgetError||approvedError||pendingError)throw new Error(`Could not read artwork budget: ${budgetError?.message||approvedError?.message||pendingError?.message}`);
  const limit=Math.min(Number(budget.budget_microusd),budgetLimitMicroUsd());
  return {budgetUsd:limit/1_000_000,reservedUsd:Number(budget.reserved_microusd)/1_000_000,spentUsd:Number(budget.spent_microusd)/1_000_000,remainingUsd:Math.max(0,limit-Number(budget.reserved_microusd)-Number(budget.spent_microusd))/1_000_000,approvedPlayers:approved??0,pendingReviewPlayers:pending??0};
}

async function finishLedger(service:any,generationId:string,succeeded:boolean,error?:unknown) {
  const {error:finishError}=await service.rpc('finish_simulated_art_generation',{p_generation_id:generationId,p_succeeded:succeeded,p_error:succeeded?null:String(error??'Generation failed').slice(0,1000)});
  if(finishError)throw new Error(`Could not finalize artwork cost ledger: ${finishError.message}`);
}

async function submitBatch(service:any,ai:GoogleGenAI,inputs:JobInput[],tier:QualityTier) {
  const batchId=randomUUID(),model=MODELS[tier],cost=BATCH_COST_MICRO_USD[tier],normalized=inputs.slice(0,MAX_BATCH).map(normalizeJob);
  if(!normalized.length)throw new Error('At least one artwork job is required.');
  const requestedJobs=normalized.map(raw=>({generationId:randomUUID(),dedupeKey:sha(JSON.stringify({...rowKey(raw),tier,attempt:raw.attempt})),attempt:raw.attempt,input:serializedInput(raw)}));
  const {error:createError}=await service.from(BATCH_TABLE).insert({id:batchId,budget_scope:BUDGET_SCOPE,model,quality_tier:tier,status:'reserving',jobs:requestedJobs,expected_items:requestedJobs.length,expected_cost_microusd:requestedJobs.length*cost});
  if(createError)throw new Error(`Could not create artwork batch: ${createError.message}`);
  const accepted:StoredBatchJob[]=[];let budgetExhausted=false;
  for(let index=0;index<normalized.length;index++){
    const raw=normalized[index],stored=requestedJobs[index];
    const {data:existing,error:existingError}=await service.from(TABLE).select('status,updated_at,quality_report').match(rowKey(raw)).maybeSingle();
    if(existingError)throw new Error(`Could not check existing artwork: ${existingError.message}`);
    if(existing?.status==='approved'||existing?.status==='pending_review'||(existing?.status==='generating'&&Date.now()-Date.parse(existing.updated_at)<26*60*60_000))continue;
    const priorAttempt=Number(existing?.quality_report?.generation?.attempt);
    if(tier==='review'&&Number.isFinite(priorAttempt)&&stored.attempt<=priorAttempt){stored.attempt=priorAttempt+1;stored.input.attempt=stored.attempt;stored.dedupeKey=sha(JSON.stringify({...rowKey(raw),tier,attempt:stored.attempt}));}
    const {data,error}=await service.rpc('reserve_simulated_art_generation',{p_generation_id:stored.generationId,p_dedupe_key:stored.dedupeKey,p_budget_scope:BUDGET_SCOPE,p_budget_limit_microusd:budgetLimitMicroUsd(),p_batch_id:batchId,p_player_id:raw.player.id,p_team_abbr:raw.player.team,p_model:model,p_quality_tier:tier,p_estimated_cost_microusd:cost});
    if(error)throw new Error(`Could not reserve artwork budget: ${error.message}`);
    const reservation=Array.isArray(data)?data[0]:data;
    if(reservation?.accepted)accepted.push(stored);else if(reservation?.reason==='budget_exhausted'){budgetExhausted=true;break;}
  }
  if(!accepted.length){await service.from(BATCH_TABLE).update({status:'cancelled',jobs:requestedJobs,expected_items:requestedJobs.length,expected_cost_microusd:0,error:budgetExhausted?'The $35 artwork budget is exhausted.':'Every requested player already has artwork reserved.',completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',batchId);return {batchId,submitted:0,budgetExhausted,budget:await budgetSnapshot(service)};}
  await service.from(BATCH_TABLE).update({jobs:accepted,expected_items:accepted.length,expected_cost_microusd:accepted.length*cost,updated_at:new Date().toISOString()}).eq('id',batchId);
  let providerName='';
  try {
    const requests=[];
    for(const stored of accepted){
      const raw=normalizeJob(stored.input);
      const anchor=await reusableIdentityAnchor(service,raw);
      requests.push({...batchRequest(raw,anchor?.image),metadata:{generationId:stored.generationId}});
      const {error}=await service.from(TABLE).upsert({...rowKey(raw),identity_fingerprint:raw.fingerprint,identity_descriptor:raw.identity,status:'generating',generation_model:model,generation_id:stored.generationId,estimated_cost_microusd:cost,rejection_reason:null,updated_at:new Date().toISOString()},{onConflict:'player_id,team_abbr,uniform_variant,appearance_key,art_version'});
      if(error)throw new Error(`Could not reserve artwork manifest: ${error.message}`);
    }
    const provider=await ai.batches.create({model,src:{inlinedRequests:requests},config:{displayName:`ball-knower-v4-${batchId}`}} as any);
    providerName=String(provider?.name||'');
    if(!providerName)throw new Error('Gemini did not return a batch job name.');
    await service.from(LEDGER_TABLE).update({status:'submitted',provider_job_name:providerName,updated_at:new Date().toISOString()}).eq('batch_id',batchId).eq('status','reserved');
    await service.from(BATCH_TABLE).update({provider_job_name:providerName,status:'submitted',provider_state:String(provider.state??'JOB_STATE_PENDING'),updated_at:new Date().toISOString()}).eq('id',batchId);
    return {batchId,providerJobName:providerName,submitted:accepted.length,budgetExhausted,budget:await budgetSnapshot(service)};
  } catch(error){
    if(!providerName){
      for(const stored of accepted)await finishLedger(service,stored.generationId,false,error);
      await service.from(BATCH_TABLE).update({status:'failed',error:String(error).slice(0,1000),completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',batchId);
    } else {
      // The provider accepted the paid job. Keep the reservation intact so a
      // transient database failure can never allow the $35 cap to be exceeded.
      await service.from(BATCH_TABLE).update({provider_job_name:providerName,status:'running',error:String(error).slice(0,1000),updated_at:new Date().toISOString()}).eq('id',batchId);
    }
    throw error;
  }
}

async function syncBatch(service:any,publicClient:any,ai:GoogleGenAI,batchId:string) {
  const {data,error}=await service.from(BATCH_TABLE).select('*').eq('id',batchId).single();
  if(error||!data)throw new Error('Artwork batch was not found.');
  const batch=data as BatchRow;
  if(batch.status==='succeeded'||batch.status==='failed'||batch.status==='expired'||batch.status==='cancelled')return {batchId,status:batch.status,processed:batch.processed_items,budget:await budgetSnapshot(service)};
  if(!batch.provider_job_name)throw new Error('Artwork batch has no Gemini job name.');
  const provider:any=await ai.batches.get({name:batch.provider_job_name}),providerState=String(provider?.state??'JOB_STATE_UNSPECIFIED');
  if(!providerState.includes('SUCCEEDED')){
    const terminal=providerState.includes('FAILED')||providerState.includes('EXPIRED')||providerState.includes('CANCELLED');
    await service.from(BATCH_TABLE).update({status:terminal?(providerState.includes('EXPIRED')?'expired':providerState.includes('CANCELLED')?'cancelled':'failed'):'running',provider_state:providerState,error:terminal?String(provider?.error?.message||providerState):null,completed_at:terminal?new Date().toISOString():null,updated_at:new Date().toISOString()}).eq('id',batchId);
    if(terminal)for(const stored of batch.jobs)await finishLedger(service,stored.generationId,false,provider?.error?.message||providerState);
    return {batchId,status:terminal?'failed':'running',providerState,processed:0,budget:await budgetSnapshot(service)};
  }
  await service.from(BATCH_TABLE).update({status:'processing',provider_state:providerState,updated_at:new Date().toISOString()}).eq('id',batchId);
  const responses=provider?.dest?.inlinedResponses??provider?.dest?.inlined_responses??[];
  let processed=0;const failures:Record<string,string>[]=[];const results=[];
  for(let index=0;index<batch.jobs.length;index++){
    const stored=batch.jobs[index],raw=normalizeJob(stored.input);
    try {
      const {data:existing}=await service.from(TABLE).select('*').match(rowKey(raw)).in('status',['pending_review','approved']).maybeSingle();
      if(existing){processed++;results.push(manifest(publicClient,existing as ArtRow));continue;}
      const generated=outputBatchImage(responses.find((item:any)=>String(item?.metadata?.generationId||item?.metadata?.generation_id||'')===stored.generationId)??responses[index]);
      await finishLedger(service,stored.generationId,true);
      const completed=await packageIdentitySheet(service,raw,generated,stored,batch.model,BATCH_COST_MICRO_USD[batch.quality_tier],batchId);
      processed++;results.push(manifest(publicClient,completed));
    } catch(processError){
      try {await finishLedger(service,stored.generationId,false,processError);} catch {}
      const message=String(processError instanceof Error?processError.message:processError).slice(0,500);
      failures.push({playerId:raw.player.id,error:message});
      await service.from(TABLE).update({status:'rejected',rejection_reason:message,updated_at:new Date().toISOString()}).match(rowKey(raw)).eq('status','generating');
    }
  }
  const status=failures.length?'failed':'succeeded';
  await service.from(BATCH_TABLE).update({status,processed_items:processed,error:failures.length?`${failures.length} artwork results need a retry.`:null,completed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',batchId);
  return {batchId,status,processed,failures,results,budget:await budgetSnapshot(service)};
}

export default async function handler(req:any,res:any) {
  const {publicClient,serviceClient}=clients();
  if(req.method==='GET'){
    try {
      const input:JobInput={playerId:String(req.query?.playerId||''),team:String(req.query?.team||''),variant:safeVariant(req.query?.variant),position:String(req.query?.position||'WR'),name:String(req.query?.name||''),number:Number(req.query?.number),age:Number(req.query?.age),heightInches:Number(req.query?.heightInches),weightLbs:Number(req.query?.weightLbs)};
      const job=normalizeJob(input),requestedAppearanceKey=String(req.query?.appearanceKey||job.appearanceKey);
      if(requestedAppearanceKey.length<8||requestedAppearanceKey.length>240)throw new Error('Appearance key has an invalid length.');
      const {data,error}=await publicClient.from(TABLE).select('*').match({player_id:job.player.id,team_abbr:job.player.team,uniform_variant:job.variant,appearance_key:requestedAppearanceKey,art_version:SIMULATED_ART_VERSION}).eq('status','approved').maybeSingle();
      if(error)return json(res,503,{status:'missing',error:'Player artwork catalog is temporarily unavailable.'});
      if(!data)return json(res,202,{status:'missing',playerId:job.player.id,teamAbbr:job.player.team,uniformVariant:job.variant,appearanceKey:job.appearanceKey,identityFingerprint:job.fingerprint,artVersion:SIMULATED_ART_VERSION},'private, max-age=30');
      return json(res,200,manifest(publicClient,data as ArtRow),'public, max-age=300, stale-while-revalidate=86400');
    } catch(error:any){return json(res,400,{status:'missing',error:String(error?.message||'Invalid artwork request.')});}
  }
  if(req.method!=='POST')return json(res,405,{error:'Method not allowed'});
  const expected=process.env.SIMULATED_PLAYER_ART_ADMIN_KEY||'',provided=String(req.headers['x-ball-knower-art-key']||'');
  if(!expected||!provided||!secureEqual(provided,expected))return json(res,401,{error:'Artwork publisher authorization required.'});
  if(!serviceClient)return json(res,503,{error:'Server-side artwork storage is not configured.'});
  const action=String(req.body?.action||'submit-batch');
  try {
    if(action==='status'){
      const {data:batches}=await serviceClient.from(BATCH_TABLE).select('id,status,quality_tier,model,expected_items,processed_items,expected_cost_microusd,provider_state,created_at,completed_at').order('created_at',{ascending:false}).limit(20);
      return json(res,200,{budget:await budgetSnapshot(serviceClient),batches:batches??[]});
    }
    if(action==='submit-batch'||action==='generate'){
      const apiKey=geminiApiKey();
      if(process.env.SIMULATED_PLAYER_ART_GENERATION_ENABLED!=='true'||!apiKey)return json(res,503,{error:'Production artwork generation is not enabled.'});
      const jobs=(Array.isArray(req.body?.jobs)?req.body.jobs:[req.body?.job]).filter(Boolean) as JobInput[];
      if(!jobs.length)return json(res,400,{error:'At least one artwork job is required.'});
      const ai=new GoogleGenAI({apiKey});
      return json(res,202,await submitBatch(serviceClient,ai,jobs,safeTier(req.body?.qualityTier)));
    }
    if(action==='sync-batch'){
      const apiKey=geminiApiKey();if(!apiKey)return json(res,503,{error:'Gemini is not configured.'});
      const batchId=String(req.body?.batchId||'');if(!/^[0-9a-f-]{36}$/i.test(batchId))return json(res,400,{error:'A valid batch ID is required.'});
      const ai=new GoogleGenAI({apiKey});
      return json(res,200,await syncBatch(serviceClient,publicClient,ai,batchId));
    }
    if(action==='sync-open-batches'){
      const apiKey=geminiApiKey();if(!apiKey)return json(res,503,{error:'Gemini is not configured.'});
      const {data:open,error}=await serviceClient.from(BATCH_TABLE).select('id').in('status',['submitted','running','processing']).order('created_at',{ascending:true}).limit(4);
      if(error)throw new Error(`Could not find open artwork batches: ${error.message}`);
      if(!open?.length)return json(res,200,{status:'idle',budget:await budgetSnapshot(serviceClient)});
      const ai=new GoogleGenAI({apiKey});
      const results=[];for(const batch of open)results.push(await syncBatch(serviceClient,publicClient,ai,String(batch.id)));
      return json(res,200,{status:'checked',results,budget:await budgetSnapshot(serviceClient)});
    }
    if(action==='approve'||action==='reject'){
      const input=req.body?.job as JobInput,job=normalizeJob(input),match=rowKey(job);
      const {data:pending}=await serviceClient.from(TABLE).select('quality_report').match(match).eq('status','pending_review').maybeSingle();
      if(!pending)return json(res,409,{error:'Artwork is not awaiting review.'});
      const submitted=req.body?.checklist&&typeof req.body.checklist==='object'?req.body.checklist as Record<string,unknown>:{},checklist=Object.fromEntries(REVIEW_CHECKS.map(check=>[check,submitted[check]===true]));
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
