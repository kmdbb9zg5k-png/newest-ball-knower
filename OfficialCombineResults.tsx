import React,{useEffect,useRef} from 'react';
import {officialCombineStandings} from './officialCombine';
import {draftDrillMark,type DraftDrill,type DraftDrillRecord} from './myPlayerDraftCombine';
import type {JourneyProfile,JourneyState} from './myPlayerJourney';
import './officialCombine.css';
export type OfficialCombineEntry={profile:JourneyProfile&{draftJourney?:JourneyState};result?:DraftDrillRecord};
export default function OfficialCombineResults({entry,drill,result,name,onClose}:{entry:OfficialCombineEntry;drill:DraftDrill;result:DraftDrillRecord;name:string;onClose:()=>void}){
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{heading.current?.focus({preventScroll:true});},[]);
 const standings=officialCombineStandings(entry.profile,drill,result),top=standings.slice(0,5),mine=standings.find(row=>row.mine)!;
 return <section className="official-combine-results" aria-label="Official Combine results">
  <header><span className="career-eyebrow">OFFICIAL COMBINE · SESSION COMPLETE</span><h2 ref={heading} tabIndex={-1}>{name}</h2><strong className="official-combine-mark">{result.dnf?'NO TIME':draftDrillMark(drill,result.best)}</strong><p>Your result is locked. {result.dnf?'Both attempts were false starts.':'Best mark from your completed session.'}</p></header>
  {result.marks&&<div className="official-combine-attempts">{result.marks.map((mark,index)=><div key={index}><span>{result.marks!.length>1?`ATTEMPT ${index+1}`:'SESSION SCORE'}</span><b>{mark===null?'FALSE START':draftDrillMark(drill,mark)}</b></div>)}</div>}
  <section aria-label="Top five Combine performers"><h3>TOP 5 PERFORMERS</h3><p className="official-combine-caption">Your draft class · simulated prospects</p><table><caption className="sr-only">{name} standings</caption><thead><tr><th scope="col">Rank</th><th scope="col">Athlete</th><th scope="col">Result</th></tr></thead><tbody>{top.map(row=><tr key={row.id} data-mine={row.mine}><td>{row.rank}</td><th scope="row">{row.name}<small>{row.position}{row.mine?' · YOU':''}</small></th><td>{draftDrillMark(drill,row.mark)}</td></tr>)}</tbody></table>
   {!top.some(row=>row.mine)&&<div className="official-combine-own" aria-label="Your Combine standing"><span>#{mine.rank} <small>of {standings.length}</small></span><strong>{mine.name}<small>{mine.position} · YOU</small></strong><b>{result.dnf?'NO TIME':draftDrillMark(drill,mine.mark)}</b></div>}
   <p className="official-combine-caption">{mine.dnf?'No valid time posted':`Your rank: ${mine.rank} of ${standings.length}`}. {drill==='dash'||drill==='shuttle'?'Lower times rank higher.':'Higher marks rank higher.'} Equal marks share a rank.</p>
  </section>
  {result.details&&<details className="official-combine-details"><summary>Session breakdown</summary><dl>{Object.entries(result.details).filter(([key])=>drill==='dash'?key.startsWith('split'):drill==='shuttle'?key==='penalty':drill==='routes'?['reps','catches'].includes(key):drill==='db'?['reps','stops','picks'].includes(key):drill==='rb'?['reps','yards','touchdowns'].includes(key):drill==='bench'?key==='reps':false).map(([key,value])=><div key={key}><dt>{{split10:'10-yard split',split20:'20-yard split',penalty:'Best attempt penalties',reps:'Reps',catches:'Catches',stops:'Stops',picks:'Interceptions',yards:'Yards',touchdowns:'Touchdowns'}[key]}</dt><dd>{key.startsWith('split')||key==='penalty'?`${value.toFixed(3)}s`:value}</dd></div>)}</dl></details>}
  <button className="career-primary" onClick={onClose}>BACK TO COMBINE</button>
 </section>;
}
