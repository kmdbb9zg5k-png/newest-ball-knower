import React,{useState} from 'react';
import FootballH2HSession from './FootballH2HSession';
export default function GlobalFootballMatchmaking({me,team,onMatched}:{me:string;team:string;onOpenAuth:()=>void;onMatched:()=>void}){
 const [open,setOpen]=useState(false);
 return <section className="football-card" aria-label="Global matchmaking"><span className="football-eyebrow">QUICK MATCH</span><h3>There’s always a game.</h3><p>Pick your team. Find your opponent. Three drives to win.</p><button onClick={()=>setOpen(true)}>Pick your team</button>{open&&<FootballH2HSession key={me} me={me} initialTeam={team} onClose={()=>{setOpen(false);onMatched();}}/>}</section>;
}
