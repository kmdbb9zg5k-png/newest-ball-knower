import React, {useRef, useState} from 'react';
import {MAX_GHOST_BYTES, parseGhost} from './dash-ghost.js';
import './ghost-race.css';

export type DashReplay = {version:number;ruleset:string;athlete:{id:string;name:string;position:string;speed:number;acceleration:number;seed:number};inputs:number[][];time:number;recordedAt:number};
export default function GhostRacePanel({best, imported, selected, latest, onSelect, onImport}: {best:DashReplay|null;imported:DashReplay|null;selected:DashReplay|null;latest?:DashReplay|null;onSelect:(replay:DashReplay|null)=>void;onImport:(replay:DashReplay)=>boolean}) {
  const input = useRef<HTMLInputElement>(null), [message,setMessage] = useState('');
  const load = async (file?: File) => {
    if (!file) return;
    try {
      if(file.size>MAX_GHOST_BYTES)throw new Error('Choose a replay file under 64 KB.');
      const replay=parseGhost(await file.text());
      const saved=onImport(replay);onSelect(replay);
      setMessage(saved?'Friend replay loaded. It is ready to race offline.':'Replay loaded for this visit. Device storage is unavailable, so it will not survive a reload.');
    } catch(e) {setMessage(e instanceof Error?e.message:'Could not import replay.');}
    finally {if(input.current)input.current.value='';}
  };
  const share = async (replay:DashReplay) => {
    const file=new File([JSON.stringify(replay)],'ball-knower-dash.bkghost.json',{type:'application/json'});
    try {
      if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Race my Ball Knower dash'});setMessage('Replay shared.');return;}
      const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);setMessage('Replay downloaded. Send the file to a friend, who can import it here.');
    }catch(e){if(!(e instanceof DOMException&&e.name==='AbortError'))setMessage('Could not share this replay. Try again.');}
  };
  return <section className="bk-ghost-panel" aria-label="Ghost races"><h3>RACE THE TAPE</h3><p>Race recorded stride inputs in the next lane. Both runners use the replay’s athlete and ratings. Imported files are casual, unverified performances.</p>
    <div className="bk-ghost-options"><button type="button" aria-pressed={!selected} onClick={()=>onSelect(null)}>Solo run</button>{best&&<button type="button" aria-pressed={selected?.recordedAt===best.recordedAt&&selected?.time===best.time} onClick={()=>onSelect(best)}>My saved ghost · {best.time.toFixed(3)}s</button>}{imported&&<button type="button" aria-pressed={selected?.recordedAt===imported.recordedAt&&selected?.time===imported.time} onClick={()=>onSelect(imported)}>Friend replay · {imported.time.toFixed(3)}s</button>}</div>
    {selected&&<p role="status">Racing {selected.athlete.name} · {selected.athlete.position} · {selected.time.toFixed(3)}s. Replay starts at green.</p>}
    <div className="bk-ghost-options"><button type="button" onClick={()=>input.current?.click()}>Import friend replay</button>{(latest||best)&&<button type="button" onClick={()=>void share((latest||best)!)}>Share {latest?'this run':'my ghost'}</button>}</div>
    <input ref={input} hidden type="file" accept=".json,.bkghost,application/json" aria-label="Choose dash replay file" onChange={e=>void load(e.target.files?.[0])}/>
    {message&&<p role="status">{message}</p>}
    {!best&&!latest&&<p>Finish a standalone dash to record your first replay. Once loaded, ghost racing needs no connection while this game remains open.</p>}
  </section>;
}
