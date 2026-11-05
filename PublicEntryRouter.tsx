import React,{lazy,Suspense,useEffect} from 'react';
import App from './App';
import {ScreenErrorBoundary,ScreenLoading} from './ScreenErrorBoundary';
import {trackBallKnowerEvent} from './analytics';
import {initializeNativeAuthCallback} from './nativeAuth';

const SpectatorLeagueView=lazy(()=>import('./SpectatorLeagueView').then(m=>({default:m.SpectatorLeagueView})));

export const PublicEntryRouter:React.FC=()=>{
 const slug=typeof window!=='undefined'?new URLSearchParams(window.location.search).get('spectate'):null;
 useEffect(()=>{void initializeNativeAuthCallback().catch(error=>console.error('Native auth bridge could not start',error))},[]);
 useEffect(()=>{if(slug)trackBallKnowerEvent('Spectator View Opened')},[slug]);
 if(!slug)return <App/>;
 return <ScreenErrorBoundary onHome={()=>window.location.assign('/')}><Suspense fallback={<ScreenLoading onHome={()=>window.location.assign('/')}/>}><SpectatorLeagueView slug={slug}/></Suspense></ScreenErrorBoundary>;
};