import React from 'react';
import {useBallKnower} from './BallKnowerContext';
import {BroadcastStage} from './BroadcastScene';
import CommunityFootballArena from './CommunityFootballArena';
import {fetchCommunityHome,type CommunityHome} from './communityCloud';
import {fetchProgressionProfile} from './progressionCloud';
import {useCommunityResource} from './useCommunityResource';

type Props={onOpenAuth:()=>void;onBack:()=>void};
/** Game Modes and Community render the same lobby against the same online records. */
export default function FootballArenaScreen(props:Props){
  const {currentUser}=useBallKnower();
  return <FootballArenaSession key={`${currentUser?.id}:${currentUser?.isAnonymous}`} {...props}/>;
}
function FootballArenaSession({onOpenAuth,onBack}:Props){
  const {currentUser}=useBallKnower();
  const permanent=Boolean(currentUser&&!currentUser.isAnonymous);
  const {data,error,refresh}=useCommunityResource<CommunityHome|null>(async()=>{
    if(!permanent)return null;
    await fetchProgressionProfile(currentUser?.name);
    return fetchCommunityHome();
  });
  return <BroadcastStage scene="studio" page="football" className="min-h-[calc(100dvh-7rem)] px-3 pb-10 pt-4 sm:px-6 sm:pt-7"><div className="mx-auto max-w-5xl">
    <header className="mb-5"><button type="button" onClick={onBack} className="mb-4 min-h-11 rounded-xl border border-[#d9b43b]/35 px-4 text-xs font-bold text-[#ecd67d]">← Back to Game Modes</button><p className="text-[10px] font-black uppercase tracking-[.2em] text-[#d9b43b]">Game Modes · Online</p><h1 className="mt-2 text-3xl font-black uppercase sm:text-5xl">Online Head-to-Head</h1><p className="mt-2 text-xs text-zinc-400">Your Football H2H matches, friends and record—also available in Community.</p></header>
    {error&&<div role="alert" className="mb-4 rounded-xl border border-red-400/25 p-3 text-sm text-red-200">Could not load your friends: {error}<button type="button" className="ml-2 min-h-11 px-3 underline" onClick={()=>void refresh()}>Retry friends</button></div>}
    <CommunityFootballArena me={permanent?currentUser?.id||'':''} friends={data?.friends.filter(friend=>friend.status==='accepted')||[]} onOpenAuth={onOpenAuth}/>
  </div></BroadcastStage>;
}
