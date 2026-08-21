import { League, LeagueMember, LiveFantasyDraft, Player, TeamRatings, SeasonResult } from './types';
import { ensureOnlineSession, isCloudConfigured, supabase } from './supabase';

type UserLike = { id:string; name:string; avatarUrl?:string };
export type LeagueEvent = { id:string; leagueId:string; actorName:string; eventType:string; message:string; metadata:any; createdAt:string };
export type SeasonArchiveEntry = { id:string; leagueId:string; seasonNumber:number; result:SeasonResult; settings:any; createdAt:string };
export type RosterRevision = { id:string; leagueId:string; memberId:string; revisionNumber:number; roster:Player[]; teamRatings?:TeamRatings; reason:string; createdAt:string };
export type LeagueNotification = { id:string; leagueId?:string; title:string; body:string; kind:string; readAt?:string; createdAt:string };

const liveDraftFromRow = (row:any):LiveFantasyDraft|undefined => row ? ({
  leagueId:row.league_id,
  status:row.status,
  orderMemberIds:row.order_member_ids||[],
  rounds:Number(row.rounds)||20,
  pickIndex:Number(row.pick_index)||0,
  picks:row.picks||[],
  startedAt:row.started_at,
  completedAt:row.completed_at||undefined,
  updatedAt:row.updated_at,
}) : undefined;

const leagueFromRows = (row:any, members:any[], liveDraftRow?:any):League => ({
  id: row.id,
  code: row.code,
  name: row.name,
  maxMembers: row.max_members,
  salaryCap: Number(row.salary_cap),
  commissionerId: row.commissioner_auth_id,
  commissionerName: row.commissioner_name,
  status: row.status,
  members: members.map(memberFromRow),
  seasonResult: row.season_result || undefined,
  liveDraft: liveDraftFromRow(liveDraftRow),
  createdAt: row.created_at,
  settings: { seasonGames: 17, simulationStyle: 'realistic', ...(row.settings || {}) },
  inviteEnabled: row.invite_enabled !== false,
  paused: Boolean(row.paused),
  rostersLocked: Boolean(row.rosters_locked),
} as League & any);

const memberFromRow = (m:any):LeagueMember => ({
  id:m.id,
  userId:m.auth_user_id || m.app_user_id || m.id,
  userName:m.user_name,
  userAvatar:m.user_avatar || undefined,
  isCommissioner:Boolean(m.is_commissioner),
  isAi:Boolean(m.is_ai),
  aiArchetype:m.ai_archetype || undefined,
  status:m.status,
  roster:m.roster || undefined,
  teamRatings:m.team_ratings || undefined,
  submittedAt:m.submitted_at || undefined,
});

async function fetchMembers(leagueIds:string[]) {
  if (!supabase || leagueIds.length===0) return [];
  const { data,error }=await supabase.from('ball_knower_league_members').select('*').in('league_id',leagueIds);
  if(error) throw error;
  return data || [];
}

async function fetchLiveDrafts(leagueIds:string[]) {
  if (!supabase || leagueIds.length===0) return [];
  const {data,error}=await supabase.from('ball_knower_live_drafts').select('*').in('league_id',leagueIds);
  if(error) throw error;
  return data||[];
}

export async function loadMyCloudLeagues():Promise<League[]> {
  if(!isCloudConfigured || !supabase) return [];
  const user=await ensureOnlineSession();
  const {data:mine,error:mineError}=await supabase.from('ball_knower_league_members').select('league_id').eq('auth_user_id',user.id);
  if(mineError) throw mineError;
  const ids=[...new Set((mine||[]).map((x:any)=>x.league_id))] as string[];
  if(!ids.length) return [];
  const {data:rows,error}=await supabase.from('ball_knower_leagues').select('*').in('id',ids).order('created_at',{ascending:false});
  if(error) throw error;
  const [members,liveDrafts]=await Promise.all([fetchMembers(ids),fetchLiveDrafts(ids)]);
  return (rows||[]).map((r:any)=>leagueFromRows(r,members.filter((m:any)=>m.league_id===r.id),liveDrafts.find((draft:any)=>draft.league_id===r.id)));
}

export async function fetchCloudLeague(id:string):Promise<League|null> {
  if(!supabase) return null;
  await ensureOnlineSession();
  const {data:row,error}=await supabase.from('ball_knower_leagues').select('*').eq('id',id).maybeSingle();
  if(error) throw error;
  if(!row) return null;
  const [members,liveDrafts]=await Promise.all([fetchMembers([id]),fetchLiveDrafts([id])]);
  return leagueFromRows(row,members,liveDrafts[0]);
}

function code() {
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out='BK-';
  for(let i=0;i<6;i++) out+=alphabet[Math.floor(Math.random()*alphabet.length)];
  return out;
}

export async function logLeagueEvent(leagueId:string,eventType:string,message:string,_actorName='Ball Knower',metadata:any={}) {
  if(!supabase) throw new Error('League activity is unavailable because online services are not configured.');
  await ensureOnlineSession();
  const {error}=await supabase.rpc('log_ball_knower_league_event',{
    p_league_id:leagueId,
    p_event_type:eventType,
    p_message:message,
    p_metadata:metadata,
  });
  if(error) throw error;
}

export async function fetchLeagueEvents(leagueId:string,limit=75):Promise<LeagueEvent[]> {
  if(!supabase) return [];
  await ensureOnlineSession();
  const {data,error}=await supabase.from('ball_knower_league_events').select('*').eq('league_id',leagueId).order('created_at',{ascending:false}).limit(limit);
  if(error) throw error;
  return (data||[]).map((x:any)=>({id:x.id,leagueId:x.league_id,actorName:x.actor_name,eventType:x.event_type,message:x.message,metadata:x.metadata||{},createdAt:x.created_at}));
}

export async function fetchSeasonArchive(leagueId:string):Promise<SeasonArchiveEntry[]> {
  if(!supabase) return [];
  await ensureOnlineSession();
  const {data,error}=await supabase.from('ball_knower_season_archive').select('*').eq('league_id',leagueId).order('season_number',{ascending:false});
  if(error) throw error;
  return (data||[]).map((x:any)=>({id:x.id,leagueId:x.league_id,seasonNumber:x.season_number,result:x.result,settings:x.settings||{},createdAt:x.created_at}));
}

export async function archiveSeasonResult(league:League):Promise<void> {
  if(!supabase || !league.seasonResult) return;
  await ensureOnlineSession();
  const {count,error:countError}=await supabase.from('ball_knower_season_archive').select('id',{count:'exact',head:true}).eq('league_id',league.id);
  if(countError) throw countError;
  const seasonNumber=(count||0)+1;
  const {error}=await supabase.from('ball_knower_season_archive').upsert({league_id:league.id,season_number:seasonNumber,result:league.seasonResult,settings:league.settings||{}},{onConflict:'league_id,season_number'});
  if(error) throw error;
  await logLeagueEvent(league.id,'season_archived',`Season ${seasonNumber} was archived.`,league.commissionerName,{seasonNumber});
}

export async function fetchRosterRevisions(leagueId:string,memberId?:string):Promise<RosterRevision[]> {
  if(!supabase) return [];
  await ensureOnlineSession();
  let query=supabase.from('ball_knower_roster_revisions').select('*').eq('league_id',leagueId).order('created_at',{ascending:false});
  if(memberId) query=query.eq('member_id',memberId);
  const {data,error}=await query.limit(150);
  if(error) throw error;
  return (data||[]).map((x:any)=>({id:x.id,leagueId:x.league_id,memberId:x.member_id,revisionNumber:x.revision_number,roster:x.roster||[],teamRatings:x.team_ratings||undefined,reason:x.reason,createdAt:x.created_at}));
}

export async function fetchMyNotifications(limit=75):Promise<LeagueNotification[]> {
  if(!supabase) return [];
  const auth=await ensureOnlineSession();
  const {data,error}=await supabase.from('ball_knower_notifications').select('*').eq('auth_user_id',auth.id).order('created_at',{ascending:false}).limit(limit);
  if(error) throw error;
  return (data||[]).map((x:any)=>({id:x.id,leagueId:x.league_id||undefined,title:x.title,body:x.body,kind:x.kind,readAt:x.read_at||undefined,createdAt:x.created_at}));
}

export async function markNotificationRead(id:string):Promise<void> {
  if(!supabase) return;
  const auth=await ensureOnlineSession();
  const {error}=await supabase.from('ball_knower_notifications').update({read_at:new Date().toISOString()}).eq('id',id).eq('auth_user_id',auth.id);
  if(error) throw error;
}

export async function notifyLeagueMembers(league:League,title:string,body:string,kind='league'):Promise<void> {
  if(!supabase) throw new Error('League notifications are unavailable because online services are not configured.');
  await ensureOnlineSession();
  const {error}=await supabase.rpc('notify_ball_knower_league_members',{
    p_league_id:league.id,
    p_title:title,
    p_body:body,
    p_kind:kind,
  });
  if(error) throw error;
}

export async function createCloudLeague(name:string,maxMembers:number,salaryCap:number,user:UserLike):Promise<League> {
  if(!supabase) throw new Error('Online multiplayer is not configured.');
  const auth=await ensureOnlineSession();
  const id=crypto.randomUUID();
  let created:any=null;
  for(let tries=0;tries<5;tries++){
    const payload={id,code:code(),name:name.trim()||'Ball Knower League',max_members:maxMembers,salary_cap:salaryCap,commissioner_auth_id:auth.id,commissioner_name:user.name,status:'drafting',settings:{seasonGames:17,simulationStyle:'realistic'}};
    const {data,error}=await supabase.from('ball_knower_leagues').insert(payload).select().single();
    if(!error){created=data;break;}
    if(error.code!=='23505') throw error;
  }
  if(!created) throw new Error('Could not generate a unique league code.');
  const member={id:`member-${auth.id}-${Date.now()}`,league_id:id,auth_user_id:auth.id,app_user_id:auth.id,user_name:user.name,user_avatar:user.avatarUrl||null,is_commissioner:true,is_ai:false,status:'building'};
  const {error:memberError}=await supabase.from('ball_knower_league_members').insert(member);
  if(memberError) throw memberError;
  await logLeagueEvent(id,'league_created',`${user.name} created the league.`,user.name);
  return leagueFromRows(created,[member]);
}

export async function joinCloudLeague(inviteCode:string,user:UserLike):Promise<League> {
  if(!supabase) throw new Error('Online multiplayer is not configured.');
  await ensureOnlineSession();
  const clean=inviteCode.trim().toUpperCase();
  const {data:leagueId,error:joinError}=await supabase.rpc('join_ball_knower_league',{p_code:clean,p_user_name:user.name,p_user_avatar:user.avatarUrl||null});
  if(joinError){
    const message=String(joinError.message||'');
    if(message.toLowerCase().includes('full')) throw new Error('This league is full.');
    if(message.toLowerCase().includes('disabled')) throw new Error('This league invite is currently disabled.');
    if(message.toLowerCase().includes('not found')) throw new Error('League code not found. Check the code and try again.');
    throw joinError;
  }
  const league=await fetchCloudLeague(String(leagueId));
  if(!league) throw new Error('League joined, but the latest league state could not be loaded. Try opening the invite again.');
  await logLeagueEvent(league.id,'member_joined',`${user.name} joined the league.`,user.name);
  return league;
}

export async function joinOrCreatePublicCloudLeague(user:UserLike,maxMembers=10):Promise<League> {
  if(!supabase) throw new Error('Public matchmaking is unavailable because online services are not configured.');
  const auth=await ensureOnlineSession();
  const {data:leagueId,error}=await supabase.rpc('join_or_create_ball_knower_public_league',{
    p_user_name:user.name,
    p_user_avatar:user.avatarUrl||null,
    p_max_members:maxMembers,
  });
  if(error) throw error;
  const league=await fetchCloudLeague(String(leagueId));
  if(!league) throw new Error('Your public league was found, but its lobby could not be loaded. Try again.');
  const created=league.commissionerId===auth.id && league.members.filter(member=>!member.isAi).length===1;
  try {
    await logLeagueEvent(
      league.id,
      created?'public_league_created':'public_member_joined',
      created?`${user.name} opened a free public league.`:`${user.name} joined through public matchmaking.`,
      user.name,
      {leagueType:'public_free'},
    );
  } catch (auditError) {
    console.warn('Public league joined, but its audit event could not be saved.', auditError);
  }
  return league;
}

export async function saveMyCloudRoster(leagueId:string, roster:Player[], ratings:TeamRatings) {
  if(!supabase) return;
  await ensureOnlineSession();
  const {data,error}=await supabase.rpc('submit_ball_knower_roster',{
    p_league_id:leagueId,
    p_roster:roster,
    p_team_ratings:ratings,
  });
  if(error) throw error;
  const result=Array.isArray(data)?data[0]:data;
  if(!result) throw new Error('Roster submission completed without a confirmation receipt. Try again.');
  const revisionNumber=Number(result.revision_number)||1;
  const userName=String(result.user_name||'League member');
  await logLeagueEvent(leagueId,'roster_submitted',`${userName} submitted and locked a roster.`,userName,{revisionNumber});
}

export async function updateCloudLeague(leagueId:string, patch:{ salaryCap?:number; status?:string; seasonResult?:SeasonResult|null; settings?:any; inviteEnabled?:boolean; paused?:boolean; rostersLocked?:boolean; code?:string; }) {
  if(!supabase) return;
  await ensureOnlineSession();
  const data:any={};
  if(patch.salaryCap!==undefined) data.salary_cap=patch.salaryCap;
  if(patch.status!==undefined) data.status=patch.status;
  if(patch.seasonResult!==undefined) data.season_result=patch.seasonResult;
  if(patch.settings!==undefined) data.settings=patch.settings;
  if(patch.inviteEnabled!==undefined) data.invite_enabled=patch.inviteEnabled;
  if(patch.paused!==undefined) data.paused=patch.paused;
  if(patch.rostersLocked!==undefined) data.rosters_locked=patch.rostersLocked;
  if(patch.code!==undefined) data.code=patch.code;
  const {data:updated,error}=await supabase.from('ball_knower_leagues').update(data).eq('id',leagueId).select('id').maybeSingle();
  if(error) throw error;
  if(!updated) throw new Error('League update did not modify a league. Confirm your commissioner access and try again.');
}

export async function startCloudLiveFantasyDraft(leagueId:string):Promise<LiveFantasyDraft> {
  if(!supabase) throw new Error('Online fantasy drafting is unavailable.');
  await ensureOnlineSession();
  const {data,error}=await supabase.rpc('start_ball_knower_live_draft',{p_league_id:leagueId});
  if(error) throw error;
  const draft=liveDraftFromRow(data);
  if(!draft) throw new Error('The fantasy draft started without a saved draft room.');
  return draft;
}

export async function makeCloudLiveFantasyDraftPick(leagueId:string,playerId:string,group:string):Promise<LiveFantasyDraft> {
  if(!supabase) throw new Error('Online fantasy drafting is unavailable.');
  await ensureOnlineSession();
  const {data,error}=await supabase.rpc('make_ball_knower_live_draft_pick',{
    p_league_id:leagueId,
    p_player_id:playerId,
    p_group:group,
  });
  if(error) throw error;
  const draft=liveDraftFromRow(data);
  if(!draft) throw new Error('The draft pick was not saved.');
  return draft;
}

export async function updateLeagueOperations(leagueId:string,patch:{inviteEnabled?:boolean;paused?:boolean;rostersLocked?:boolean},actorName:string) {
  await updateCloudLeague(leagueId,patch);
  const details=Object.entries(patch).map(([key,value])=>`${key}=${value}`).join(', ');
  await logLeagueEvent(leagueId,'commissioner_control',`Commissioner updated league controls: ${details}.`,actorName,patch);
}

export async function regenerateLeagueInvite(leagueId:string,actorName:string):Promise<string> {
  if(!supabase) return '';
  await ensureOnlineSession();
  for(let tries=0;tries<5;tries++){
    const next=code();
    const {data,error}=await supabase.from('ball_knower_leagues').update({code:next,invite_enabled:true}).eq('id',leagueId).select('code').single();
    if(!error && data){await logLeagueEvent(leagueId,'invite_regenerated','Commissioner regenerated the league invite code.',actorName);return data.code;}
    if(!error) throw new Error('Invite code update returned no league row. Confirm you are the commissioner of this league.');
    if(error.code!=='23505') throw error;
  }
  throw new Error('Could not generate a new invite code.');
}

export async function upsertAiCloudMembers(leagueId:string, members:LeagueMember[]) {
  if(!supabase || !members.length) return;
  await ensureOnlineSession();
  const rows=members.map(m=>({id:m.id,league_id:leagueId,auth_user_id:null,app_user_id:m.userId,user_name:m.userName,user_avatar:m.userAvatar||null,is_commissioner:false,is_ai:true,ai_archetype:m.aiArchetype||null,status:m.status,roster:m.roster||null,team_ratings:m.teamRatings||null,submitted_at:m.submittedAt||null}));
  const {error}=await supabase.from('ball_knower_league_members').upsert(rows,{onConflict:'id'});
  if(error) throw error;
  try {
    await logLeagueEvent(leagueId,'cpu_fill',`${members.length} CPU GM${members.length===1?'':'s'} added to the league.`,'Commissioner',{count:members.length});
  } catch (auditError) {
    console.warn('CPU members were saved, but their audit event could not be saved.', auditError);
  }
}

export async function lockPublicLeagueForCpuFill(leagueId:string):Promise<number> {
  if(!supabase) throw new Error('Public matchmaking is unavailable because online services are not configured.');
  await ensureOnlineSession();
  const {data,error}=await supabase.rpc('lock_ball_knower_public_league_for_cpu_fill',{p_league_id:leagueId});
  if(error) throw error;
  return Math.max(0,Number(data)||0);
}

export async function reopenPublicLeagueMatchmaking(leagueId:string):Promise<boolean> {
  if(!supabase) throw new Error('Public matchmaking is unavailable because online services are not configured.');
  await ensureOnlineSession();
  const {data,error}=await supabase.rpc('reopen_ball_knower_public_league_matchmaking',{p_league_id:leagueId});
  if(error) throw error;
  return Boolean(data);
}

export async function deleteCloudMember(leagueId:string,memberId:string) {
  if(!supabase) return;
  await ensureOnlineSession();
  const {data:member}=await supabase.from('ball_knower_league_members').select('user_name').eq('league_id',leagueId).eq('id',memberId).maybeSingle();
  const {error}=await supabase.from('ball_knower_league_members').delete().eq('league_id',leagueId).eq('id',memberId);
  if(error) throw error;
  await logLeagueEvent(leagueId,'member_removed',`${member?.user_name||'A member'} was removed from the league.`,'Commissioner');
}

export function subscribeToCloudLeague(leagueId:string,onChange:()=>void) {
  if(!supabase) return ()=>{};
  const channel=supabase.channel(`ball-knower-${leagueId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'ball_knower_leagues',filter:`id=eq.${leagueId}`},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'ball_knower_league_members',filter:`league_id=eq.${leagueId}`},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'ball_knower_live_drafts',filter:`league_id=eq.${leagueId}`},onChange)
    .on('postgres_changes',{event:'*',schema:'public',table:'ball_knower_league_events',filter:`league_id=eq.${leagueId}`},onChange)
    .subscribe();
  return ()=>{ supabase.removeChannel(channel); };
}
