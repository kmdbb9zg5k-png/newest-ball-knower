import {createClient} from '@supabase/supabase-js';
import type {GatewayProviderOptions} from '@ai-sdk/gateway';
import {gateway,generateText,stepCountIs,type ModelMessage} from 'ai';
import {normalizeNews} from './nfl-news';

const BALL_KNOWER_SUPABASE_URL='https://gpnboygoosrmeydwjpvk.supabase.co';
const BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY='sb_publishable_tgnOH0RUtswLI58isL5Qfw_Pq3xaV9h';
const PRIMARY_MODEL='google/gemini-3.1-flash-lite';
const FALLBACK_MODEL='openai/gpt-5.4-nano';
const TANK01_HOST='tank01-nfl-live-in-game-real-time-statistics-nfl.p.rapidapi.com';
const MAX_IMAGES=5;
const MAX_IMAGE_DATA_CHARS=3_200_000;
const MAX_MESSAGE_CHARS=2_000;
const MAX_HISTORY_MESSAGES=12;
const LIVE_SEARCH_PATTERN=/\b(latest|current(?:ly)?|right now|today|tonight|tomorrow|yesterday|this (?:week|season|year)|last (?:game|week|night|season)|breaking|news|update|injur(?:y|ed|ies)|questionable|doubtful|inactive|ruled out|game[- ]time decision|depth chart|starting lineup|start\s*(?:\/|or)\s*sit|who (?:do|should) i start|waiver|free agent|transaction|trade rumor|traded|released|signed|score|result|standings|schedule|kickoff|game time|odds|spread|moneyline|over\/under|weather|projection|rankings?|rest of season|ros)\b|\b20(?:2[5-9]|[3-9]\d)\b/i;

type InputMessage={role:'user'|'assistant';text:string};
type InputImage={name?:string;dataUrl:string};
type SafeSource={title:string;url:string};

export function needsAskBkLiveSearch(question:string){return LIVE_SEARCH_PATTERN.test(question)}

const recentRequests=new Map<string,number[]>();
function allowed(key:string){
  const now=Date.now();
  if(recentRequests.size>1_000){for(const [candidate,times] of recentRequests)if(!times.some(time=>now-time<60_000))recentRequests.delete(candidate)}
  const active=(recentRequests.get(key)||[]).filter(time=>now-time<60_000);
  if(active.length>=8)return false;
  active.push(now);recentRequests.set(key,active);return true;
}

const bearer=(req:any)=>{const value=String(req?.headers?.authorization||'');return value.startsWith('Bearer ')?value.slice(7):''};
const plain=(value:unknown,max:number)=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,' ').trim().slice(0,max);
const safeUrl=(value:unknown)=>{try{const url=new URL(String(value));return url.protocol==='https:'&&!url.username&&!url.password?url.toString():null}catch{return null}};

function parseMessages(value:unknown):InputMessage[]{
  if(!Array.isArray(value))return[];
  return value.slice(-MAX_HISTORY_MESSAGES).flatMap(row=>{
    const role=(row as any)?.role;
    const text=plain((row as any)?.text,MAX_MESSAGE_CHARS);
    return (role==='user'||role==='assistant')&&text?[{role,text}]:[];
  });
}

function parseImages(value:unknown):InputImage[]{
  if(!Array.isArray(value)||value.length>MAX_IMAGES)throw new Error('image_count');
  let total=0;
  return value.map(row=>{
    const dataUrl=String((row as any)?.dataUrl||'');
    const match=dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if(!match)throw new Error('image_format');
    total+=dataUrl.length;
    if(total>MAX_IMAGE_DATA_CHARS)throw new Error('image_size');
    return{name:plain((row as any)?.name||'screenshot',80),dataUrl};
  });
}

function parseLeagueContext(value:unknown){
  const input=(value&&typeof value==='object'?value:{}) as any;
  const roster=Array.isArray(input.roster)?input.roster.slice(0,30).map((player:any)=>({
    name:plain(player?.name,80),team:plain(player?.team,8),position:plain(player?.position,8),rating:Number.isFinite(Number(player?.rating))?Number(player.rating):undefined,
  })).filter((player:any)=>player.name):[];
  const context={
    leagueName:plain(input.leagueName,80),teamName:plain(input.teamName,80),status:plain(input.status,30),scoring:plain(input.scoring,30),
    currentWeek:Number.isFinite(Number(input.currentWeek))?Math.max(1,Math.min(30,Number(input.currentWeek))):undefined,
    salaryCap:Number.isFinite(Number(input.salaryCap))?Number(input.salaryCap):undefined,memberCount:Number.isFinite(Number(input.memberCount))?Number(input.memberCount):undefined,roster,
  };
  return context.leagueName||context.roster.length?context:null;
}

async function latestNflContext(lastQuestion:string){
  if(!/(latest|today|tonight|news|injur|waiver|trade|start\s*\/\s*sit|start or sit|lineup|depth chart|inactive)/i.test(lastQuestion))return'';
  const key=process.env.TANK01_API_KEY||process.env.RAPIDAPI_KEY;
  if(!key)return'';
  try{
    const response=await fetch(`https://${TANK01_HOST}/getNFLNews?topNews=true&maxItems=8`,{headers:{'x-rapidapi-key':key,'x-rapidapi-host':TANK01_HOST},signal:AbortSignal.timeout(6_000),redirect:'error'});
    if(!response.ok)return'';
    const raw=await response.text();if(raw.length>600_000)return'';
    const normalized=normalizeNews(JSON.parse(raw));
    return normalized.articles.slice(0,8).map(article=>`- ${article.headline} (${article.source}${article.published?`, ${article.published}`:''}) ${article.url}`).join('\n');
  }catch{return''}
}

function collectSources(result:any):SafeSource[]{
  const found=new Map<string,SafeSource>();
  const add=(urlValue:unknown,titleValue:unknown)=>{const url=safeUrl(urlValue);if(!url||found.has(url)||found.size>=6)return;found.set(url,{url,title:plain(titleValue,120)||new URL(url).hostname.replace(/^www\./,'')})};
  for(const source of result?.sources||[])if(source?.sourceType==='url')add(source.url,source.title);
  for(const toolResult of result?.toolResults||[]){const output=toolResult?.output;for(const row of Array.isArray(output?.results)?output.results:[])add(row?.url,row?.title)}
  return [...found.values()];
}

function errorStatus(error:any){
  const status=Number(error?.statusCode||error?.response?.status||0);
  if(status===429)return{status:429,message:'Ask BK is getting a lot of questions. Wait a moment and try again.'};
  if(status===402)return{status:503,message:'Ask BK has reached its AI spending limit for now.'};
  if(status===401||status===403)return{status:503,message:'Ask BK still needs its secure AI connection enabled.'};
  return{status:502,message:'Ask BK could not finish that answer. Try again in a moment.'};
}

export default async function handler(req:any,res:any){
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='GET')return res.status(200).json({available:Boolean(process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN),maxImages:MAX_IMAGES,conversationStorage:false});
  if(req.method!=='POST'){res.setHeader('Allow','GET, POST');return res.status(405).json({error:'Method not allowed'})}

  const token=bearer(req);
  if(!token)return res.status(401).json({error:'Your Ball Knower session expired. Reopen Ask BK and try again.'});
  const supabaseUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL||BALL_KNOWER_SUPABASE_URL;
  const supabaseKey=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_ANON_KEY||BALL_KNOWER_SUPABASE_PUBLISHABLE_KEY;
  const auth=createClient(supabaseUrl,supabaseKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:`Bearer ${token}`}}});
  const {data:verified,error:authError}=await auth.auth.getUser(token);
  if(authError||!verified.user)return res.status(401).json({error:'Your Ball Knower session expired. Reopen Ask BK and try again.'});
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  if(!allowed(`${verified.user.id}:${ip}`))return res.status(429).json({error:'Ask BK needs a quick timeout. Wait a minute before asking again.'});

  try{
    const rawBody=typeof req.body==='string'?req.body:JSON.stringify(req.body||{});
    if(rawBody.length>3_600_000)return res.status(413).json({error:'Those screenshots are still too large. Remove one and try again.'});
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
    const messages=parseMessages(body.messages);
    const images=parseImages(body.images);
    const leagueContext=parseLeagueContext(body.leagueContext);
    if(!messages.length)return res.status(400).json({error:'Ask a sports question first.'});
    const totalText=messages.reduce((sum,message)=>sum+message.text.length,0);
    if(totalText>12_000)return res.status(400).json({error:'This session is too long. Clear it and start a fresh question.'});
    const lastUserIndex=messages.map(message=>message.role).lastIndexOf('user');
    if(lastUserIndex<0)return res.status(400).json({error:'Ask a sports question first.'});
    const lastQuestion=messages[lastUserIndex].text;
    const liveSearchRequested=needsAskBkLiveSearch(lastQuestion);
    const liveSearchEnabled=process.env.ASK_BK_LIVE_SEARCH_ENABLED!=='false';
    const allowLiveSearch=liveSearchRequested&&liveSearchEnabled;
    const nflNews=await latestNflContext(lastQuestion);
    const now=new Date().toISOString();
    const system=`You are Ask BK, Ball Knower's sharp, plain-spoken sports assistant. Football and fantasy football are your specialty, but you can answer questions about any sport. Today is ${now}.

Accuracy rules:
- ${allowLiveSearch?'This question may need current information. Call sports_search no more than once before answering, and never present old model knowledge as current.':'No live-search tool is available for this question. Answer from the supplied context and stable knowledge; if the user needs current information, say what could not be confirmed.'}
- Prefer league/team/player primary sources and established sports reporting. Link important current claims using markdown links, and say when current information could not be confirmed.
- Treat the Ball Knower league context as user-supplied planning context, not as an authoritative real-world stat feed.
- When screenshots are attached, read all of them, call out uncertainty or unreadable details, and compare them when useful.
- Give direct recommendations with the reasoning and the biggest risk. Never imply certainty about injuries, betting outcomes, or future performance.
- Keep answers useful on a phone: lead with the answer, use short sections or bullets, and normally stay under 550 words.
- Do not claim to remember a prior session. Ball Knower does not save this conversation.

${leagueContext?`Current Ball Knower league context:\n${JSON.stringify(leagueContext)}`:'No Ball Knower league is currently attached.'}
${nflNews?`\nRecent Tank01 NFL headlines (verify with search before treating as decisive):\n${nflNews}`:''}`;
    const modelMessages:ModelMessage[]=messages.map((message,index)=>{
      if(message.role==='assistant')return{role:'assistant',content:message.text};
      const isLatest=index===lastUserIndex;
      return{role:'user',content:isLatest&&images.length?[{type:'text',text:message.text},...images.map(image=>({type:'image' as const,image:image.dataUrl}))]:message.text};
    });
    const gatewayOptions={
      sort:'cost',models:[process.env.ASK_BK_FALLBACK_MODEL||FALLBACK_MODEL],user:verified.user.id,
      tags:['ask-bk','session-only','v1',allowLiveSearch?'live-search':'no-search'],zeroDataRetention:true,disallowPromptTraining:true,...(images.length?{has:['vision' as const]}:{}),
    } satisfies GatewayProviderOptions;
    const result=await generateText({
      model:process.env.ASK_BK_MODEL||PRIMARY_MODEL,system,messages:modelMessages,maxOutputTokens:700,temperature:.3,
      ...(allowLiveSearch?{
        tools:{sports_search:gateway.tools.perplexitySearch({maxResults:5,maxTokensPerPage:384,maxTokens:1_500,country:'US',searchLanguageFilter:['en']})},
        stopWhen:stepCountIs(2),
      }:{}),providerOptions:{gateway:gatewayOptions},
    });
    const answer=result.text.trim();
    if(!answer)return res.status(502).json({error:'Ask BK did not return an answer. Try wording that question another way.'});
    return res.status(200).json({answer,sources:collectSources(result),answeredAt:new Date().toISOString(),conversationStorage:false,liveSearchUsed:allowLiveSearch&&Boolean(result.toolResults?.length)});
  }catch(error:any){
    if(error?.message==='image_count')return res.status(400).json({error:`Attach up to ${MAX_IMAGES} screenshots at once.`});
    if(error?.message==='image_format')return res.status(400).json({error:'Ask BK accepts compressed JPG, PNG, or WebP screenshots.'});
    if(error?.message==='image_size')return res.status(413).json({error:'Those screenshots are still too large. Remove one and try again.'});
    if(error instanceof SyntaxError)return res.status(400).json({error:'That request could not be read.'});
    const mapped=errorStatus(error);console.error('ask-bk-generation-failed',{status:Number(error?.statusCode||0)||undefined,name:plain(error?.name,60)});
    return res.status(mapped.status).json({error:mapped.message});
  }
}
