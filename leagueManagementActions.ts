import type { League } from './types';
import { getLeagueCommissionerName, isLeagueCommissioner } from './leaguePermissions';
import { customizeLeagueInvite, deleteCloudLeague, leagueJoinCodeError, leaveCloudLeague, normalizeLeagueJoinCode } from './leagueManagementCloud';

export type LeagueManagementResult={success:boolean;message:string;code?:string};

export async function customizeLeagueAction(league:League|undefined,currentUserId:string|undefined,demo:boolean,cloud:boolean,requestedCode:string):Promise<LeagueManagementResult>{
  if(!league)return{success:false,message:'League not found.'};
  if(!isLeagueCommissioner(league,currentUserId,demo))return{success:false,message:`Only Commissioner ${getLeagueCommissionerName(league)} can change this join code.`};
  const next=normalizeLeagueJoinCode(requestedCode),validationError=leagueJoinCodeError(next);
  if(validationError)return{success:false,message:validationError};
  try{
    const saved=cloud&&league.id!=='demo-league-instance'?await customizeLeagueInvite(league.id,next):next;
    return{success:true,message:'Join code updated.',code:saved};
  }catch(err:any){return{success:false,message:err?.message||'Could not update the join code.'};}
}

export async function removeLeagueAction(league:League|undefined,currentUserId:string|undefined,demo:boolean,cloud:boolean):Promise<LeagueManagementResult>{
  if(!league)return{success:false,message:'League not found.'};
  const commissioner=isLeagueCommissioner(league,currentUserId,demo);
  try{
    if(cloud&&league.id!=='demo-league-instance')await (commissioner?deleteCloudLeague(league.id):leaveCloudLeague(league.id));
    return{success:true,message:commissioner?'League permanently deleted.':'You left the league.'};
  }catch(err:any){return{success:false,message:err?.message||`Could not ${commissioner?'delete':'leave'} the league.`};}
}
