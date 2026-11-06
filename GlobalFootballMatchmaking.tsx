import React,{useState} from 'react';
import FootballH2HSession from './FootballH2HSession';
export default function GlobalFootballMatchmaking({me,team,onMatched}:{me:string;team:string;onOpenAuth:()=>void;onMatched:()=>void}){
 const [open,setOpen]=useState(false);
 return <section className="football-card football-matchmaking-card" aria-label="Global matchmaking">
  <div className="football-matchmaking-visual"><img className="football-matchmaking-art" src="/profile/cinematic/stadium-field.webp" width="2172" height="724" alt="" aria-hidden="true" loading="lazy" decoding="async"/><span className="football-eyebrow">{me?'ONLINE MATCHMAKING':'AUTOMATED PRACTICE'}</span></div>
  <div className="football-card-copy"><h3>Three drives. Your next rival.</h3><p>{me?'Search for a real player for up to 30 seconds. If no one joins, automated practice starts after 30 seconds.':'After a 30-second countdown, play three drives against a clearly labelled CPU opponent. Sign in to find real players and keep online records.'}</p><button type="button" onClick={()=>setOpen(true)}>Pick your team</button></div>
  {open&&<FootballH2HSession key={me} me={me} initialTeam={team} onClose={()=>{setOpen(false);onMatched();}}/>}
 </section>;
}
