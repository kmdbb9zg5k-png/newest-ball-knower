import{withPicksDeadline}from'./picksRequest';
import{createPicksMutationQueue}from'./picksMutationQueue';
import{supabase,ensureOnlineSession}from'./supabase';
import type{OwnerSeasonStage}from'./ownerSeasonEngine';

export type VerifiedPredictionPick={id:string;gameId:string;label:string;market:'spread'|'total';selection:string;lockedLine:number;lockedAt:string;result?:'win'|'loss'|'push';kickoffAt?:string;awayTeam?:string;homeTeam?:string;gradedAt?:string};
export type VerifiedOwnerExpected={abbr:string;season:number;week:number;stage:OwnerSeasonStage;wins:number;losses:number;playoffSeed?:number|null};
export type VerifiedOwnerStepResult={ok:boolean;verified:boolean;reason?:string;won?:boolean;isBye?:boolean;isPreseason?:boolean;run?:unknown;ownerState?:unknown;milestoneIds?:number[]};

const predictionMutationChain=createPicksMutationQueue();
const queuePredictionMutation=predictionMutationChain.run;

async function accessToken(){
  if(!supabase)throw new Error('Online services are unavailable.');
  await ensureOnlineSession();const session=await supabase.auth.getSession();const token=session.data.session?.access_token;if(!token)throw new Error('Online session expired.');return token;
}

async function request(path:string,init:RequestInit={},beforeSend?:AbortSignal){
  const token=beforeSend?await withPicksDeadline(()=>accessToken(),20_000,beforeSend):await accessToken();if(init.signal?.aborted||beforeSend?.aborted)throw new DOMException('Request cancelled','AbortError');const response=await fetch(path,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...(init.headers||{})},cache:'no-store'});
  const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error||`Request failed (${response.status})`);return data;
}

export async function advanceVerifiedOwnerStep(expected:VerifiedOwnerExpected,ownerState:unknown,ownerOutcomes:{won:unknown;lost:unknown},gmId?:string,coachId?:string):Promise<VerifiedOwnerStepResult>{
  return request('/api/mode-progression',{method:'POST',body:JSON.stringify({action:'owner_step',expected,ownerState,ownerOutcomes,gmId:gmId||null,coachId:coachId||null})}) as Promise<VerifiedOwnerStepResult>;
}

export async function claimPendingVerifiedModeMilestones(){
  if(!supabase)return 0;await ensureOnlineSession();const pending=await supabase.rpc('list_ball_knower_unclaimed_mode_milestones');if(pending.error)throw pending.error;let claimed=0;
  for(const row of Array.isArray(pending.data)?pending.data:[]){const id=Number(row?.id);if(!Number.isFinite(id))continue;const result=await supabase.rpc('claim_ball_knower_verified_mode_milestone',{p_milestone_id:id});if(result.error)throw result.error;claimed+=1;}
  return claimed;
}

// Bound reads and caller waits. Submitted writes retain their queue slot until the actual response.
const predictionRead=()=>withPicksDeadline(async signal=>{await predictionMutationChain.whenIdle();return request('/api/prediction-picks',{signal})});
const predictionWrite=(init:RequestInit)=>queuePredictionMutation(beforeSend=>request('/api/prediction-picks',init,beforeSend));

export async function loadVerifiedPredictionPicks():Promise<VerifiedPredictionPick[]>{
  const data=await predictionRead();return Array.isArray(data?.picks)?data.picks:[];
}

export async function saveVerifiedPredictionPick(pick:Omit<VerifiedPredictionPick,'lockedAt'|'result'>):Promise<VerifiedPredictionPick[]>{
  const data=await predictionWrite({method:'POST',body:JSON.stringify({action:'save',pick})});return Array.isArray(data?.picks)?data.picks:[];
}

export async function deleteVerifiedPredictionPick(gameId:string):Promise<VerifiedPredictionPick[]>{
  const data=await predictionWrite({method:'POST',body:JSON.stringify({action:'delete',gameId})});return Array.isArray(data?.picks)?data.picks:[];
}

export async function gradeVerifiedPredictionPicks():Promise<VerifiedPredictionPick[]> {
  const data=await predictionWrite({method:'POST',body:JSON.stringify({action:'grade'})});// Milestone replay must never hold the pick-mutation queue hostage.
  void withPicksDeadline(()=>claimPendingVerifiedModeMilestones()).catch(error=>console.warn('Prediction milestones pending',error));return Array.isArray(data?.picks)?data.picks:[];
}
