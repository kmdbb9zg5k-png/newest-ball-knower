import React from 'react';
import {useBallKnower} from './BallKnowerContext';
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
  return <section className="football-showdown-page" aria-labelledby="football-showdown-title"><div className="football-showdown-shell">
    <header className="football-showdown-header">
      <div className="football-showdown-copy">
        <button type="button" onClick={onBack} className="football-showdown-back">← Back to Game Modes</button>
        <p className="football-showdown-eyebrow">Game Modes · Online</p>
        <h1 id="football-showdown-title">Online Head-to-Head</h1>
        <p className="football-showdown-description">Your Football H2H matches, friends and record—also available in Community.</p>
      </div>
      <img className="football-showdown-art" src="/images/football-showdown-v1.webp" width={1536} height={1024} alt="" fetchPriority="high" decoding="async"/>
    </header>
    <div className="football-showdown-lobby">
    {error&&<div role="alert" className="mb-4 rounded-xl border border-red-400/25 p-3 text-sm text-red-200">Could not load your friends: {error}<button type="button" className="ml-2 min-h-11 px-3 underline" onClick={()=>void refresh()}>Retry friends</button></div>}
    <CommunityFootballArena me={permanent?currentUser?.id||'':''} friends={data?.friends.filter(friend=>friend.status==='accepted')||[]} onOpenAuth={onOpenAuth}/>
    </div>
  </div></section>;
}
