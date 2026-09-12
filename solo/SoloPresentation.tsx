import React,{createContext,lazy,Suspense,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import type {Player} from '../types';
import type {SoloWeek,PlayerLine} from '../soloSeasonEngine';
import type {FranchiseInteractionState} from '../franchiseInteractions';
import {Appearance,AppearancePlayer,readAppearance,SOLO_ART_ROOT,UniformVariant} from './appearance';

export type PlayerGameLog = PlayerLine & {week:number;opponent:string;won:boolean;year?:number};
export type SoloPlayerRecord = {player:Player;logs?:PlayerGameLog[];development?:FranchiseInteractionState['development'][string]};
type PresentationContext = {openPlayer:(record:SoloPlayerRecord)=>void;registerRecords:(records:Map<string,SoloPlayerRecord>)=>()=>void};
const Context=createContext<PresentationContext|null>(null);
const Profile=lazy(()=>import('./SoloPlayerProfile'));
const ELI_EASTER_EGG_ID='bk-001-eli-rodriguez';
const ELI_FACE=`${SOLO_ART_ROOT}/creator/eli-face.webp`;

export function useAppearance(player:AppearancePlayer):Appearance {
  const [look,setLook]=useState(()=>readAppearance(player));
  useEffect(()=>{
    const sync=()=>setLook(readAppearance(player));sync();
    const local=(event:Event)=>{if((event as CustomEvent).detail===player.id)sync();};
    const remote=(event:StorageEvent)=>{if(event.key===null||event.key?.endsWith(encodeURIComponent(player.id)))sync();};
    window.addEventListener('bk-solo-appearance',local);window.addEventListener('storage',remote);
    return()=>{window.removeEventListener('bk-solo-appearance',local);window.removeEventListener('storage',remote);};
  },[player.id,player.position,player.jerseyNumber]);
  return look;
}

export function SoloPresentationProvider({children}:{children:React.ReactNode}) {
  const [selected,setSelected]=useState<SoloPlayerRecord|null>(null);
  const records=useRef(new Map<symbol,Map<string,SoloPlayerRecord>>());
  const [revision,setRevision]=useState(0);
  const registerRecords=useCallback((value:Map<string,SoloPlayerRecord>)=>{
    const owner=Symbol();records.current.set(owner,value);setRevision(n=>n+1);
    return()=>{records.current.delete(owner);};
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
  return <Context.Provider value={value}><div className="bk-solo-presentation" data-solo-presentation="v1">{children}</div>
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
  const look=useAppearance(player);const selected=face??look.face;
  const [failed,setFailed]=useState(false);
  if(player.id===ELI_EASTER_EGG_ID&&face===undefined){
    return <span className={`bk-solo-portrait ${className}`} aria-hidden="true" data-face="bk-001" style={{backgroundImage:`url(${ELI_FACE})`,backgroundSize:'cover',backgroundPosition:'50% 24%',backgroundRepeat:'no-repeat'}}/>;
  }
  return <span className={`bk-solo-portrait ${className}`} aria-hidden="true" data-face={selected}>
    {!failed?<img src={`${SOLO_ART_ROOT}/faces.webp`} alt="" loading="lazy" decoding="async" width="384" height="480" onError={()=>setFailed(true)} style={{left:`-${selected%3*100}%`,top:`-${Math.floor(selected/3)*100}%`}}/>:<span className="bk-solo-art-fallback">BK</span>}
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

export function SoloCharacter({player,look,variant='home',helmet=false,className=''}:{player:AppearancePlayer;look:Appearance;variant?:UniformVariant;helmet?:boolean;className?:string}) {
  const canvas=useRef<HTMLCanvasElement>(null);const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let current=true;let frame=0;setState('loading');
    frame=requestAnimationFrame(()=>{import('./characterRenderer').then(async({drawCharacter})=>{
      if(!current||!canvas.current)return;
      await drawCharacter(canvas.current,player,look,variant,helmet,()=>current);
      if(current)setState('ready');
    }).catch(()=>{if(current)setState('error');});});
    return()=>{current=false;cancelAnimationFrame(frame);};
  },[player.id,player.name,player.team,player.teamName,look.face,look.build,look.number,look.sleeves,variant,helmet,retry]);
  return <div className={`bk-solo-character ${className}`} data-render-state={state}>
    <canvas ref={canvas} width="256" height="768" role="img" aria-label={`${player.name}, simulated full-body player in ${variant} uniform`} />
    {state==='loading'&&<span className="bk-solo-art-status" role="status">Loading player…</span>}
    {state==='error'&&<div className="bk-solo-art-status" role="status">Artwork unavailable.<button type="button" onClick={()=>setRetry(n=>n+1)}>Retry preview</button></div>}
  </div>;
}

/** Decorative, shared artwork for the six entry tiles; never a roster/stat source. */
export function SoloModeArtwork({seed}:{seed:string}) {
  return <span className="bk-solo-tile-art" aria-hidden="true"><img src={`${SOLO_ART_ROOT}/body.webp`} alt="" loading="lazy" decoding="async"/><SoloPortrait player={{id:`solo-tile:${seed}`,name:'',position:'WR',team:'BK'}}/></span>;
}
