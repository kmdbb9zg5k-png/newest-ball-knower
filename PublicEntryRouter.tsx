import React,{lazy,Suspense,useEffect} from 'react';
import App from './App';
import {trackBallKnowerEvent} from './analytics';

const SpectatorLeagueView=lazy(()=>import('./SpectatorLeagueView').then(m=>({default:m.SpectatorLeagueView})));

export const PublicEntryRouter:React.FC=()=>{
 const slug=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('spectate'):null;
 useEffect(()=>{if(slug)trackBallKnowerEvent('Spectator View Opened')},[slug]);
 if(!slug)return <App/>;
 return <Suspense fallback={<div className="min-h-[100dvh] bg-[#07090c] grid place-items-center text-xs font-black uppercase tracking-[.2em] text-zinc-500">Loading Ball Knower broadcast…</div>}><SpectatorLeagueView slug={slug}/></Suspense>;
};
