import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {footballArenaAction,footballDriveUrl,footballTotal,validFootballStats,type FootballHome,type FootballMatch,type FootballAttempt,type FootballStats} from './footballArena';
import {FOOTBALL_ARENA_TEAMS} from './footballArenaTeams';
import {useCommunityResource} from './useCommunityResource';
import type {CommunityFriend} from './communityCloud';
import './footballArena.css';
const teamName=(id:string|null)=>FOOTBALL_ARENA_TEAMS.find(t=>t.abbr===id)?.name||'Choose a team';
const message=(error:unknown)=>error instanceof Error?error.message:'Could not connect. Please try again.';
export default function CommunityFootballArena({me,friends,onOpenAuth}:{me:string;friends:CommunityFriend[];onOpenAuth:()=>void}){
  const [tab,setTab]=useState<'play'|'history'|'standings'>('play');
  const [team,setTeam]=useState('JCY'),[opponent,setOpponent]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const lock=useRef(false),launches=useRef(new Map<string,string>());
  const [playing,setPlaying]=useState<{match:FootballMatch;attempt:FootballAttempt}|null>(null);
  const {data,loading,error:loadError,refresh}=useCommunityResource<FootballHome>(async()=>me?footballArenaAction('home'):{matches:[],standings:[]});
  useEffect(()=>{if(!me)return;const timer=window.setInterval(()=>{if(!document.hidden&&!lock.current)void refresh();},10000);return()=>clearInterval(timer);},[me,refresh]);
  async function act(work:()=>Promise<unknown>){
    if(!me){onOpenAuth();return;}if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{await work();await refresh(true);}catch(reason){setError(message(reason));}finally{lock.current=false;setBusy(false);}
  }
  function begin(match:FootballMatch){
    const finished=match.drives.filter(d=>d.user_id===me&&d.finished_at).length,drive=finished+1,key=`${match.id}:${drive}`;
    if(!launches.current.has(key))launches.current.set(key,crypto.randomUUID());
    void act(async()=>{const attempt=await footballArenaAction<FootballAttempt>('begin',{id:match.id,drive,launch:launches.current.get(key)});setPlaying({match,attempt});});
  }
  const matches=data?.matches||[],mine=matches.filter(m=>m.challenger_id===me||m.opponent_id===me);
  const visible=tab==='history'?mine.filter(m=>!['open','pending','active'].includes(m.status)):matches.filter(m=>['open','pending','active'].includes(m.status));
  return <section className="football-arena" aria-label="Football H2H">
    <header className="football-hero"><span className="football-eyebrow">SEASON 1 · THREE-DRIVE ARENA</span><h2>YOUR OFFENSE.<br/><em>THEIR DEFENSE.</em></h2><p>Three drives each. Play offense against your rival’s CPU defense. Highest total wins.</p><div className="football-rules"><span>3 DRIVES</span><span>OWN 25</span><span>PRO DIFFICULTY</span></div></header>
    <nav aria-label="Football H2H sections" className="football-tabs">{(['play','history','standings'] as const).map(t=><button type="button" key={t} aria-current={tab===t?'page':undefined} onClick={()=>setTab(t)}>{t==='play'?'Play football':t==='history'?'Match history':'Standings'}</button>)}</nav>
    <p className="football-note">Casual online competition · device-reported results. You play at your own pace; both players don’t need to be online together.</p>
    {!me?<div className="football-card"><h3>Bring your game to the Arena</h3><p>Sign in to challenge a friend, join an open match, and save your record.</p><button onClick={onOpenAuth}>Sign in to play</button></div>:<>
    {(error||loadError)&&<div role="alert" className="football-error">{error||loadError}<button onClick={()=>void refresh()}>Refresh matches</button></div>}
    {tab==='play'&&<section className="football-card" aria-label="Create football challenge"><h3>Choose your team</h3><div className="football-selects"><label>Your team<select aria-label="Your team" value={team} onChange={e=>setTeam(e.target.value)} disabled={busy}>{FOOTBALL_ARENA_TEAMS.map(t=><option key={t.abbr} value={t.abbr}>{t.name} · {t.overall} OVR</option>)}</select></label><label>Opponent<select aria-label="Opponent" value={opponent} onChange={e=>setOpponent(e.target.value)} disabled={busy}><option value="">Open challenge · anyone can join</option>{friends.map(f=><option key={f.userId} value={f.userId}>{f.displayName}</option>)}</select></label></div><button disabled={busy} onClick={()=>void act(()=>footballArenaAction('create',{team,opponent:opponent||null}))}>{busy?'Connecting…':opponent?'Challenge friend':'Create open match'}</button><p className="football-note">Team selection locks when you create or accept a match. Finish within 24 hours. Equal scores are a tie.</p></section>}
    {loading&&!data&&<p role="status">Loading Football H2H…</p>}
    {tab==='standings'?<section className="football-card"><h3>Season 1 standings</h3><p className="football-note">3 standings points per win · 1 per tie · completed matches only. Football record stays separate from trivia ratings.</p>{!data?.standings.length?<p>The first finished match starts the standings.</p>:<ol className="football-standings">{data.standings.map((p,i)=><li key={p.user_id} className={p.user_id===me?'is-you':''}><span>#{i+1}</span><div><strong>{p.name}{p.user_id===me?' · You':''}</strong><small>{p.wins}W · {p.losses}L · {p.ties}T</small></div><b>{p.rating}<small>PTS</small></b></li>)}</ol>}</section>:<div className="football-matches" aria-label={tab==='history'?'Football match history':'Football challenges'}>{!visible.length&&!loading&&<p className="football-card">{tab==='history'?'Your finished matches will appear here.':'No matches yet. Create a challenge to kick things off.'}</p>}{visible.map(m=>{
      const own=m.challenger_id===me||m.opponent_id===me,started=m.drives.find(d=>d.user_id===me&&!d.finished_at),completed=m.drives.filter(d=>d.user_id===me&&d.finished_at).length;
      const incoming=m.challenger_id!==me&&(m.status==='open'||m.status==='pending'&&m.opponent_id===me);
      return <article className="football-card" key={m.id}><div className="football-match-heading"><span className="football-eyebrow">{m.status==='completed'?(m.winner_id===me?'YOU WIN':m.winner_id?'OPPONENT WINS':'TIE GAME'):m.status.toUpperCase()}</span><small>{new Date(m.created_at).toLocaleDateString()}</small></div><div className="football-versus"><div><strong>{m.challenger_id===me?'You':m.challenger_name}</strong><small>{teamName(m.challenger_team)}</small></div><b>{footballTotal(m,m.challenger_id)}<span>–</span>{m.opponent_id?footballTotal(m,m.opponent_id):'?'}</b><div><strong>{m.opponent_id===me?'You':m.opponent_id?m.opponent_name:'Open opponent'}</strong><small>{m.opponent_team?teamName(m.opponent_team):'Waiting to join'}</small></div></div>
        {own&&m.opponent_id&&<div className="football-scorecard" aria-label="Drive scorecard"><table><thead><tr><th>Offense</th>{[1,2,3].map(n=><th key={n}>D{n}</th>)}</tr></thead><tbody>{[m.challenger_id,m.opponent_id].map(id=><tr key={id}><th>{id===me?'You':id===m.challenger_id?m.challenger_name:m.opponent_name}</th>{[1,2,3].map(n=>{const d=m.drives.find(d=>d.user_id===id&&d.ordinal===n);return <td key={n} title={d?.forfeited?'Forfeit · 0 points':d?.finished_at?`${d.yards} yards · ${d.plays} plays`:d?'In progress':'Not started'}>{d?.finished_at?`${d.points}${d.forfeited?'*':''}`:d?'…':'—'}</td>;})}</tr>)}</tbody></table><small>* Interrupted or expired drive · 0 points</small></div>}
        <div className="football-match-actions">
          {incoming&&<button disabled={busy} onClick={()=>void act(()=>footballArenaAction('accept',{id:m.id,team}))}>Join as {team}</button>}
          {m.status==='pending'&&m.opponent_id===me&&<button disabled={busy} className="secondary" onClick={()=>void act(()=>footballArenaAction('decline',{id:m.id}))}>Decline</button>}
          {m.challenger_id===me&&['open','pending'].includes(m.status)&&<button disabled={busy} className="secondary" onClick={()=>void act(()=>footballArenaAction('cancel',{id:m.id}))}>Cancel challenge</button>}
          {own&&m.status==='active'&&(started?<button disabled={busy} onClick={()=>void act(()=>footballArenaAction('forfeit',{id:m.id,drive:started.ordinal}))}>Record 0 for interrupted drive {started.ordinal}</button>:completed<3?<button disabled={busy} onClick={()=>begin(m)}>Play drive {completed+1} of 3</button>:<p>Your three drives are locked. Waiting for your opponent.</p>)}
        </div>{own&&m.status==='active'&&<p className="football-note">Deadline: {new Date(m.expires_at).toLocaleString()}. Unfinished drives score 0. A started drive has 12 minutes to finish and cannot restart.</p>}
      </article>;
    })}</div>}
    </>}
    <details className="football-card football-help"><summary>How Football H2H works</summary><p>Each player chooses a season 1 team, then gets three offensive drives from their own 25 against the other team’s CPU defense. Each drive has a two-minute game clock, with three timeouts. Touchdowns score 6, followed by a 1- or 2-point try. Field goals score 3. Turnovers, punts, safeties and expired clocks end the drive.</p><p>Leaving an unfinished drive records 0; a closed app or disconnected session can’t restart the drive. After all six drives, the higher total wins. Equal totals stay tied. At the 24-hour match deadline, unfinished drives count as 0.</p></details>
    {playing&&createPortal(<FootballDrivePlayer key={`${playing.match.id}:${playing.attempt.drive}`} match={playing.match} attempt={playing.attempt} onClose={()=>{setPlaying(null);void refresh();}}/>,document.body)}
  </section>;
}
function FootballDrivePlayer({match,attempt,onClose}:{match:FootballMatch;attempt:FootballAttempt;onClose:()=>void}){
  const frame=useRef<HTMLIFrameElement>(null),dialog=useRef<HTMLDialogElement>(null),lock=useRef(false),received=useRef(false);
  const [stats,setStats]=useState<FootballStats|null>(null),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[leaving,setLeaving]=useState(false),[expired,setExpired]=useState(false);
  const [savedPoints,setSavedPoints]=useState<number|null>(null);
  useEffect(()=>{const prior=document.activeElement as HTMLElement|null;dialog.current?.showModal();const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;prior?.focus();};},[]);
  async function save(result:FootballStats|null){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{const response=await footballArenaAction<{points?:number;forfeited?:boolean}>(result?'submit':'forfeit',{id:match.id,drive:attempt.drive,token:attempt.token,...(result?{stats:result}:{})});setSaved(true);setSavedPoints(response.points??0);if(!result)onClose();}
    catch(reason){setError(message(reason));}finally{lock.current=false;setBusy(false);}
  }
  const saveRef=useRef(save);saveRef.current=save;
  useEffect(()=>{const listener=(event:MessageEvent)=>{
    const d=event.data;if(event.origin!==location.origin||event.source!==frame.current?.contentWindow||!d||d.matchId!==match.id||d.token!==attempt.token||d.drive!==attempt.drive)return;
    if(d.type==='bk-arena-result'&&!received.current&&validFootballStats(d.stats)){received.current=true;setStats(d.stats);void saveRef.current(d.stats);}
    if(d.type==='bk-arena-exit')setLeaving(true);
  };window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);},[match.id,attempt]);
  useEffect(()=>{const timer=window.setInterval(()=>{if(Date.now()>=Date.parse(attempt.deadline))setExpired(true);},1000);return()=>clearInterval(timer);},[attempt.deadline]);
  return <dialog ref={dialog} aria-label={`Football H2H drive ${attempt.drive}`} className="football-drive-dialog" onCancel={e=>{e.preventDefault();saved?onClose():setLeaving(true);}}><header><div><strong>FOOTBALL H2H · DRIVE {attempt.drive}/3</strong><small>{teamName(attempt.team)} vs {teamName(attempt.opponent)} · CPU defense</small></div><button aria-label="Close drive" disabled={busy} onClick={()=>saved?onClose():setLeaving(true)}>✕</button></header>
    {saved?<section className="football-drive-message"><span className="football-eyebrow">DRIVE LOCKED</span><h2>{savedPoints} POINTS</h2><p>{savedPoints!==stats?.points?'The drive deadline passed; the server recorded 0.':'Your result is saved to this match.'}</p><button onClick={onClose}>Back to match</button></section>:stats?<section className="football-drive-message"><h2>{busy?'Saving your drive…':'Result ready'}</h2><p>{stats.points} points · {stats.yards} yards</p>{error&&<p role="alert">{error}</p>}<button disabled={busy} onClick={()=>void save(stats)}>Retry saving result</button>{leaving&&<><p>Leaving now records 0 points for this drive.</p><button disabled={busy} onClick={()=>void save(null)}>Record 0 and leave without saving</button><button className="secondary" onClick={()=>setLeaving(false)}>Keep this result</button></>}<p>Keep this screen open until the save completes.</p></section>:leaving||expired?<section className="football-drive-message"><h2>{expired?'Drive time expired':'Leave this drive?'}</h2><p>This drive will count as 0 points. It cannot be restarted.</p>{error&&<p role="alert">{error}</p>}<button disabled={busy} onClick={()=>void save(null)}>Record 0 and return to match</button>{!expired&&<button className="secondary" onClick={()=>setLeaving(false)}>Keep playing</button>}</section>:null}
    {!saved&&!stats&&<iframe ref={frame} title={`Football H2H offensive drive ${attempt.drive}`} src={footballDriveUrl(match.id,attempt)} allow="fullscreen" className={leaving||expired?'football-frame-hidden':''}/>}
  </dialog>;
}
