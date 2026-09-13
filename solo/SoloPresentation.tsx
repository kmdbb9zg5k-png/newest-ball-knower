import React,{createContext,lazy,Suspense,useCallback,useContext,useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import type {Player} from '../types';
import type {SoloWeek,PlayerLine} from '../soloSeasonEngine';
import type {FranchiseInteractionState} from '../franchiseInteractions';
import {Appearance,AppearancePlayer,CREATOR_EASTER_EGG_ID,appearanceKey,appearanceRenderKey,defaultAppearance,readAppearance,SOLO_ART_ROOT,UniformVariant} from './appearance';

import {portraitAsset} from './portraitAsset';
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

export function SoloPortrait({player,className='',face}:{player:AppearancePlayer;className?:string;face?:number}) {
  const look=useAppearance(player);
  const asset=portraitAsset(player,face??look.face,face!==undefined);
  const [failedSource,setFailedSource]=useState<string|null>(null);
  const failed=failedSource===asset.src;
  return <span className={`bk-solo-portrait ${className}`} aria-hidden="true"
    data-face={asset.single?'bk-001':asset.face} data-creator={asset.single?'true':undefined}
    data-portrait-kind={asset.single?'single':'atlas'} data-hair={look.hair} data-beard={look.facialHair} data-eye-black={look.eyeBlack}>
    {!failed?<img key={asset.src} src={asset.src} alt="" loading="lazy" decoding="async"
      width={asset.single?192:384} height={asset.single?240:480}
      onError={()=>setFailedSource(asset.src)}
      style={{left:`-${asset.single?0:asset.column*100}%`,top:`-${asset.single?0:asset.row*100}%`}}/>
      :<span className="bk-solo-art-fallback">{player.name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('')||'BK'}</span>}
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

export function SoloCharacter({player,look,variant='home',helmet=false,className='',customFaceSrc}:{player:AppearancePlayer;look:Appearance;variant?:UniformVariant;helmet?:boolean;className?:string;customFaceSrc?:string}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const container=useRef<HTMLDivElement>(null);
  const [visible,setVisible]=useState(false);
  const [retry,setRetry]=useState(0);
  const customFaceKey=customFaceSrc?`${customFaceSrc.length}:${customFaceSrc.slice(-32)}`:'';
  const renderKey=JSON.stringify([player.id,player.name,player.team,player.teamName,appearanceRenderKey(look),variant,helmet,customFaceKey,retry]);
  const [result,setResult]=useState<{key:string;state:'loading'|'ready'|'error'}>({key:'',state:'loading'});
  const state=result.key===renderKey?result.state:'loading';
  useEffect(()=>{
    if(typeof IntersectionObserver==='undefined'){setVisible(true);return;}
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){setVisible(true);observer.disconnect();}
    },{rootMargin:'128px'});
    if(container.current)observer.observe(container.current);
    return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!visible)return;
    let current=true;
    setResult({key:renderKey,state:'loading'});
    const frame=requestAnimationFrame(()=>{import('./characterRenderer').then(async({drawCharacter})=>{
      if(!current||!canvas.current)return;
      await drawCharacter(canvas.current,player,look,variant,helmet,customFaceSrc,()=>current);
      if(current)setResult({key:renderKey,state:'ready'});
    }).catch(()=>{if(current)setResult({key:renderKey,state:'error'});});});
    return()=>{current=false;cancelAnimationFrame(frame);};
  },[renderKey,visible]);
  return <div ref={container} className={`bk-solo-character ${className}`} data-render-state={visible?state:'waiting'} data-build={look.build}>
    {/* A new identity gets a new canvas immediately; an old player's pixels never carry over. */}
    <canvas key={renderKey} ref={canvas} width="256" height="768" role="img" aria-hidden={state!=='ready'}
      style={{visibility:state==='ready'?'visible':'hidden'}} aria-label={`${player.name}, simulated full-body player in ${variant} uniform`} />
    {visible&&state==='loading'&&<span className="bk-solo-art-status" role="status">Loading player…</span>}
    {state==='error'&&<>
      <div className="bk-solo-character-fallback" role="img" aria-label={`${player.name}, portrait fallback`}>
        {customFaceSrc?<img src={customFaceSrc} alt="" className="bk-solo-custom-face-fallback"/>:<SoloPortrait key={`${player.id}:${retry}`} player={player} face={player.id===CREATOR_EASTER_EGG_ID?undefined:look.face}/>}
      </div>
      <div className="bk-solo-art-status" role="status">Full-body preview unavailable. Your player is unchanged.
        <button type="button" onClick={()=>setRetry(n=>n+1)}>Retry preview</button>
      </div>
    </>}
  </div>;
}

/** Decorative, shared artwork for the six entry tiles; never a roster/stat source. */
export function SoloModeArtwork({seed}:{seed:string}) {
  return <span className="bk-solo-tile-art" aria-hidden="true"><img src={`${SOLO_ART_ROOT}/body.webp`} alt="" loading="lazy" decoding="async"/><SoloPortrait player={{id:`solo-tile:${seed}`,name:'',position:'WR',team:'BK'}}/></span>;
}
