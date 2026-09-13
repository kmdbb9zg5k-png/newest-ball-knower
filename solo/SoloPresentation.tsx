import React,{createContext,lazy,Suspense,useCallback,useContext,useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import type {Player} from '../types';
import type {SoloWeek,PlayerLine} from '../soloSeasonEngine';
import type {FranchiseInteractionState} from '../franchiseInteractions';
import {Appearance,AppearancePlayer,appearanceKey,defaultAppearance,readAppearance,UniformVariant} from './appearance';
import {cacheSimulatedArtwork,localApprovedArtwork,recoverCachedSimulatedArtwork,SimulatedArtSize,useSimulatedArtwork} from './simulatedArt';
import './playerPhotos.css';

export type PlayerGameLog = PlayerLine & {week:number;opponent:string;won:boolean;year?:number};
export type SoloPlayerRecord = {player:Player;logs?:PlayerGameLog[];development?:FranchiseInteractionState['development'][string]};
type PresentationContext = {openPlayer:(record:SoloPlayerRecord)=>void;registerRecords:(records:Map<string,SoloPlayerRecord>)=>()=>void};
const Context=createContext<PresentationContext|null>(null);
const Profile=lazy(()=>import('./SoloPlayerProfile'));

export function useAppearance(player:AppearancePlayer):Appearance {
  const subscribe=useCallback((sync:()=>void)=>{
    const local=(event:Event)=>{if((event as CustomEvent).detail===player.id)sync();};
    const remote=(event:StorageEvent)=>{if(event.key===null||event.key===appearanceKey(player.id))sync();};
    window.addEventListener('bk-solo-appearance',local);window.addEventListener('storage',remote);
    return()=>{window.removeEventListener('bk-solo-appearance',local);window.removeEventListener('storage',remote);};
  },[player.id]);
  // Primitive snapshots are stable between reads. A reused row reads its NEW player's
  // appearance during render, rather than displaying the previous face until an effect runs.
  const getSnapshot=useCallback(()=>JSON.stringify(readAppearance(player)),[player.id,player.position,player.jerseyNumber]);
  const getServerSnapshot=useCallback(()=>JSON.stringify(defaultAppearance(player)),[player.id,player.position,player.jerseyNumber]);
  const snapshot=useSyncExternalStore(subscribe,getSnapshot,getServerSnapshot);
  return useMemo(()=>JSON.parse(snapshot) as Appearance,[snapshot]);
}

export function SoloPresentationProvider({children}:{children:React.ReactNode}) {
  const [selected,setSelected]=useState<SoloPlayerRecord|null>(null);
  const records=useRef(new Map<symbol,Map<string,SoloPlayerRecord>>());
  const [revision,setRevision]=useState(0);
  const registerRecords=useCallback((value:Map<string,SoloPlayerRecord>)=>{
    const owner=Symbol();records.current.set(owner,value);setRevision(n=>n+1);
    return()=>{records.current.delete(owner);setRevision(n=>n+1);};
  },[]);
  const openPlayer=useCallback((record:SoloPlayerRecord)=>setSelected(record),[]);
  const value=useMemo(()=>({openPlayer,registerRecords}),[openPlayer,registerRecords]);
  const selectedRecord=useMemo(()=>{
    if(!selected)return null;
    for(const batch of Array.from(records.current.values()).reverse()){
      const registered=batch.get(selected.player.id);
      if(registered)return {...selected,...registered,development:registered.development??selected.development};
    }
    return selected;
  },[selected,revision]);
  return <Context.Provider value={value}><div className="bk-solo-presentation" data-solo-presentation="v2">{children}</div>
    {selectedRecord&&<Suspense fallback={<div className="bk-solo-opening" role="status">Opening player profile…<button type="button" onClick={()=>setSelected(null)}>Cancel</button></div>}><Profile key={selectedRecord.player.id} record={selectedRecord} onClose={()=>setSelected(null)}/></Suspense>}
  </Context.Provider>;
}

export function withSoloPresentation<P extends object>(Component:React.ComponentType<P>):React.FC<P> {
  const Wrapped:React.FC<P>=props=><SoloPresentationProvider><Component {...props}/></SoloPresentationProvider>;
  Wrapped.displayName=`SoloPresentation(${Component.displayName||Component.name||'Career'})`;
  return Wrapped;
}

export function useSoloRecords(roster:Player[],weeks:SoloWeek[],interactions?:FranchiseInteractionState,year?:number) {
  const presentation=useContext(Context);
  const register=presentation?.registerRecords;
  useEffect(()=>{
    if(!register)return;
    const records=new Map<string,SoloPlayerRecord>();
    for(const player of roster)records.set(player.id,{player,logs:[],development:interactions?.development[player.id]});
    for(const week of weeks)for(const line of week.playerLines??[]){
      const record=records.get(line.playerId);
      record?.logs?.push({...line,week:week.week,opponent:week.opponent,won:week.won,year});
    }
    return register(records);
  },[register,roster,weeks,interactions,year]);
}

const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase()||'BK';
const dimensions:Record<SimulatedArtSize,[number,number]>={avatar:[96,96],row:[160,200],card:[384,480],portrait:[640,800],fullBody:[768,1152]};

function useNearViewport<T extends HTMLElement>() {
  const ref=useRef<T>(null);const [visible,setVisible]=useState(false);
  useEffect(()=>{
    if(typeof IntersectionObserver==='undefined'){setVisible(true);return;}
    const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'240px'});
    if(ref.current)observer.observe(ref.current);return()=>observer.disconnect();
  },[]);
  return {ref,visible};
}

export function SoloPortrait({player,className='',size='row',variant='home'}:{player:AppearancePlayer;className?:string;size?:Exclude<SimulatedArtSize,'fullBody'>;variant?:UniformVariant}) {
  const look=useAppearance(player);const {ref,visible}=useNearViewport<HTMLSpanElement>();
  const identityPortrait=player.simulatedPortraitUrl;const local=localApprovedArtwork(player,variant,look);const art=useSimulatedArtwork(player,variant,look,visible&&!local&&!identityPortrait);
  const source=identityPortrait||local?.[size]||(art.state==='ready'?art.manifest?.urls?.[size]:undefined);const sourceIsPrivate=Boolean(source&&source===identityPortrait);
  const [failedSource,setFailedSource]=useState<string|null>(null);const [recovered,setRecovered]=useState<{source:string;blob:string}|null>(null);const failed=Boolean(source&&failedSource===source);const displaySource=source&&recovered?.source===source?recovered.blob:source;const [width,height]=dimensions[size];
  return <span ref={ref} className={`bk-solo-portrait ${className}`} aria-hidden="true" data-art-state={source&&!failed?'ready':art.state} data-art-size={size} data-solo-player-id={player.id}>
    {source&&!failed?<img key={displaySource} src={displaySource} alt="" loading="lazy" decoding="async" width={width} height={height} onLoad={()=>{if(!sourceIsPrivate&&displaySource===source)void cacheSimulatedArtwork(source)}} onError={()=>{if(sourceIsPrivate){setFailedSource(source);return;}if(displaySource!==source){setFailedSource(source);return;}void recoverCachedSimulatedArtwork(source).then(blob=>blob?setRecovered({source,blob}):setFailedSource(source));}}/>
      :<span className="bk-solo-art-fallback"><b>{initials(player.name)}</b><small>{art.state==='loading'?'RENDERING':'ART PENDING'}</small></span>}
  </span>;
}

export function SoloPlayerIdentity({player,showPortrait=true}:{player:Player;showPortrait?:boolean}) {
  return <span className="bk-solo-identity">{showPortrait&&<SoloPortrait player={player}/>}<span className="bk-solo-player-name">{player.name}</span></span>;
}
export function SoloPlayerLink({player,development,showPortrait=true}:{player:Player;development?:SoloPlayerRecord['development'];showPortrait?:boolean}) {
  const presentation=useContext(Context);
  if(!presentation)return <span>{player.name}</span>;
  return <button type="button" className="bk-solo-player-link" data-solo-player-id={player.id} aria-label={`View ${player.name} player profile`} onClick={event=>{event.stopPropagation();presentation.openPlayer({player,development});}}>
    <SoloPlayerIdentity player={player} showPortrait={showPortrait}/><span className="bk-solo-link-chevron" aria-hidden="true">›</span>
  </button>;
}
export function SoloQuickView({player}:{player:Player}) {
  const presentation=useContext(Context);
  if(!presentation)return null;
  return <button type="button" className="bk-solo-quick-view" data-solo-player-id={player.id} aria-label={`View ${player.name} player profile`} onClick={()=>presentation.openPlayer({player})}><span aria-hidden="true">↗</span></button>;
}

export function SoloCharacter({player,look,variant='home',className='',customFaceSrc}:{player:AppearancePlayer;look:Appearance;variant?:UniformVariant;className?:string;customFaceSrc?:string}) {
  const {ref,visible}=useNearViewport<HTMLDivElement>();const local=localApprovedArtwork(player,variant,look);const identityPortrait=customFaceSrc||player.simulatedPortraitUrl;const customBody=player.simulatedFullBodyUrl;const art=useSimulatedArtwork(player,variant,look,visible&&!local&&!customBody&&!identityPortrait);
  const source=visible?(customBody||local?.fullBody||(art.state==='ready'?art.manifest?.urls?.fullBody:undefined)):undefined;const sourceIsPrivate=Boolean(source&&source===customBody);const [failedSource,setFailedSource]=useState<string|null>(null);const [recovered,setRecovered]=useState<{source:string;blob:string}|null>(null);const failed=Boolean(source&&failedSource===source);const displaySource=source&&recovered?.source===source?recovered.blob:source;
  const renderState=!visible?'waiting':failed?'error':source?'ready':identityPortrait?'portrait':art.state;
  return <div ref={ref} className={`bk-solo-character ${className}`} data-render-state={renderState} data-build={look.build}>
    {source&&!failed?<img key={displaySource} src={displaySource} loading="lazy" decoding="async" width="768" height="1152" alt={`${player.name}, fictional professional football player in ${variant} uniform`} onLoad={()=>{if(!sourceIsPrivate&&displaySource===source)void cacheSimulatedArtwork(source)}} onError={()=>{if(sourceIsPrivate){setFailedSource(source);return;}if(displaySource!==source){setFailedSource(source);return;}void recoverCachedSimulatedArtwork(source).then(blob=>blob?setRecovered({source,blob}):setFailedSource(source));}}/>
      :identityPortrait?<div className="bk-solo-character-fallback" role="img" aria-label={`${player.name}, persistent identity portrait`}><img src={identityPortrait} alt="" className="bk-solo-custom-face-fallback"/><span>Full-body render not created yet</span></div>
      :visible?<div className="bk-solo-character-fallback" role="status"><SoloPortrait player={player} size="portrait" variant={variant}/><span>{art.state==='loading'?'Loading production player art…':'Production player art awaiting visual approval'}</span></div>:null}
  </div>;
}

/** Decorative, optimized artwork for entry tiles; never a roster/stat source. */
export function SoloModeArtwork({seed}:{seed:string}) {
  const samples=['solo-brk-02','solo-slc-05','solo-brk-10','solo-slc-15','solo-brk-21','solo-slc-45'];
  const index=Array.from(seed).reduce((hash,char)=>(hash*31+char.charCodeAt(0))>>>0,0)%samples.length;
  return <span className="bk-solo-tile-art bk-solo-tile-art-v4" data-art-seed={seed} aria-hidden="true"><img src={`/solo-characters/v2/qa/${samples[index]}/card.webp`} alt="" loading="lazy" decoding="async" width="384" height="480"/></span>;
}
