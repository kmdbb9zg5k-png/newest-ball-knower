import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Gamepad2,Loader2,RefreshCcw,Swords,Trophy,X} from 'lucide-react';
import {miniChallengeAction,subscribeCommunity,type CommunityFriend} from './communityCloud';
import {useCommunityResource} from './useCommunityResource';
import {MINI_CHALLENGE_GAMES,miniGame,miniChallengeUrl,miniStatLabel,type MiniChallenge,type MiniGameId,type MiniStats} from './miniChallenges';
import './communityMiniGames.css';

export default function CommunityMiniGames({me,friends,onOpenAuth}:{me:string;friends:CommunityFriend[];onOpenAuth:()=>void}){
  const {data,loading,error,refresh}=useCommunityResource<MiniChallenge[]>(async()=>me?await miniChallengeAction('list') as MiniChallenge[]:[]);
  const [game,setGame]=useState<MiniGameId>('dash');
  const [opponent,setOpponent]=useState('');
  const [pending,setPending]=useState(false),[actionError,setActionError]=useState('');
  const [playing,setPlaying]=useState<{match:MiniChallenge;token:string}|null>(null);
  const lock=useRef(false);
  useEffect(()=>me?subscribeCommunity('public',()=>void refresh(),10000):undefined,[me,refresh]);
  const act=async(work:()=>Promise<unknown>)=>{
    if(!me){onOpenAuth();return;}if(lock.current)return;lock.current=true;setPending(true);setActionError('');
    try{await work();await refresh(true);}catch(e){setActionError(e instanceof Error?e.message:'Challenge could not be updated. Try again.');}
    finally{lock.current=false;setPending(false);}
  };
  const play=(match:MiniChallenge)=>void act(async()=>{
    const attempt=await miniChallengeAction('begin',{id:match.id}) as {token:string};
    setPlaying({match,token:attempt.token});
  });
  const matches=data||[];
  const mine=matches.filter(m=>m.challenger_id===me||m.opponent_id===me);
  const open=matches.filter(m=>m.status==='open'&&m.challenger_id!==me);
  return <div className="bk-mini-arena">
    <section className="bk-mini-arena-hero"><span className="arena-kicker">COMMUNITY / MINI GAMES</span><Gamepad2 aria-hidden="true"/><h2>YOUR GAME.<br/><em>THEIR SCORE TO BEAT.</em></h2><p>Pick a game. Bring a rival. Let the stats settle it.</p><div className="bk-mini-rule-strip"><span>Same athlete or teams</span><span>One submitted result each</span><span>24 hours to finish</span></div></section>
    <section className="bk-mini-challenge-builder" aria-label="Create mini game challenge"><h3>Pick your challenge</h3><div className="bk-mini-game-list">{MINI_CHALLENGE_GAMES.map(g=><button type="button" key={g.id} aria-pressed={game===g.id} onClick={()=>setGame(g.id)}><span><strong>{g.name}</strong><small>{g.rule}</small></span><Swords aria-hidden="true"/></button>)}</div>
      <label htmlFor="mini-challenge-opponent">Choose your opponent</label><select id="mini-challenge-opponent" value={opponent} onChange={e=>setOpponent(e.target.value)}><option value="">Open challenge · any Ball Knower</option>{friends.map(f=><option key={f.userId} value={f.userId}>{f.displayName}</option>)}</select>
      <p className="bk-mini-explanation">{['two-minute','five-minute'].includes(game)?'Both players use Jersey City vs Brooklyn on Pro.':'Both players use the same athlete. Speed and acceleration are fixed at 85.'} {['routes','one-on-one','rb','db'].includes(game)?'Complete all reps; your average score decides the winner.':'Your first completed attempt posts automatically.'} Equal stats finish as a tie.</p>
      <button type="button" className="bk-mini-primary" disabled={pending} onClick={()=>void act(async()=>{await miniChallengeAction('create',{game,opponent:opponent||null});})}>{pending?<Loader2 className="animate-spin"/>:<Swords/>}{me?'Create challenge':'Sign in to challenge'}</button>
      <p className="bk-mini-casual">Casual competition · game results are device-reported. Trivia rating is separate.</p>
    </section>
    {(error||actionError)&&<div className="bk-mini-error" role="alert">{actionError||error}<button type="button" onClick={()=>void refresh()}>Refresh challenges</button></div>}
    <section className="bk-mini-challenge-feed" aria-label="Your mini game challenges"><header><h3>Your challenges</h3><button type="button" aria-label="Refresh mini game challenges" disabled={loading} onClick={()=>void refresh()}><RefreshCcw className={loading?'animate-spin':''}/></button></header>
      {!me?<p className="bk-mini-empty">Browse the games above. Sign in to compete and see your challenges.</p>:loading&&!data?<p className="bk-mini-empty" role="status">Loading challenges…</p>:!mine.length?<p className="bk-mini-empty">Your next rivalry starts here. Choose a game above.</p>:mine.map(m=>{
        const incoming=m.status==='pending'&&m.opponent_id===me;
        const myStats=m.challenger_id===me?m.challenger_stats:m.opponent_stats;
        return <ChallengeCard key={m.id} match={m} me={me}>
          {incoming&&<><button disabled={pending} className="bk-mini-primary" onClick={()=>void act(()=>miniChallengeAction('accept',{id:m.id}))}>Accept challenge</button><button disabled={pending} onClick={()=>void act(()=>miniChallengeAction('decline',{id:m.id}))}>Decline</button></>}
          {m.status==='active'&&!myStats&&<button disabled={pending} className="bk-mini-primary" onClick={()=>play(m)}>Play your turn</button>}
          {m.status==='active'&&myStats&&<span className="bk-mini-locked">Your result is locked · waiting for your rival</span>}
          {['pending','open'].includes(m.status)&&m.challenger_id===me&&<button disabled={pending} onClick={()=>void act(()=>miniChallengeAction('cancel',{id:m.id}))}>Cancel challenge</button>}
          {m.status==='completed'&&<button disabled={pending} onClick={()=>{setGame(m.game);setOpponent(friends.some(f=>f.userId===(m.challenger_id===me?m.opponent_id:m.challenger_id))?(m.challenger_id===me?m.opponent_id||'':m.challenger_id):'');document.getElementById('mini-challenge-opponent')?.scrollIntoView({behavior:'smooth',block:'center'});}}>Set up rematch</button>}
        </ChallengeCard>;
      })}
    </section>
    {me&&<section className="bk-mini-challenge-feed" aria-label="Open mini game challenges"><header><h3>Open challenges</h3></header>{!open.length?<p className="bk-mini-empty">No open challenges yet. Post one and let someone step up.</p>:open.map(m=><ChallengeCard key={m.id} match={m} me={me}><button disabled={pending} className="bk-mini-primary" onClick={()=>void act(()=>miniChallengeAction('accept',{id:m.id}))}>Take this challenge</button></ChallengeCard>)}</section>}
    {playing&&createPortal(<MiniChallengePlayer key={playing.token} match={playing.match} token={playing.token} onClose={()=>{setPlaying(null);void refresh();}}/>,document.body)}
  </div>;
}
const statNames:Record<string,string>={time:'Time (sec)',distance:'Distance (m)',split10:'10-yard split (sec)',split20:'20-yard split (sec)',penalty:'Penalty (sec)',score:'Average score',reps:'Reps',catches:'Catches',stops:'Stops',picks:'Interceptions',points:'Points',yards:'Total yards',passYards:'Passing yards',rushYards:'Rushing yards',turnovers:'Turnovers',touchdowns:'Touchdowns',plays:'Plays'};
function ChallengeCard({match:m,me,children}:{match:MiniChallenge;me:string;children:React.ReactNode}){
  const game=miniGame(m.game);
  return <article className="bk-mini-challenge-card"><div className="bk-mini-card-title"><strong>{game.name}</strong><span>{m.status==='completed'?<><Trophy aria-hidden="true"/>{!m.winner_id?'Tie game':m.winner_id===me?'You win':'Opponent wins'}</>:m.status}</span></div><p>{game.rule}</p><div className="bk-mini-versus"><div><strong>{m.challenger_name}{m.challenger_id===me?' · You':''}</strong><b>{miniStatLabel(m.game,m.challenger_stats)}</b></div><span>VS</span><div><strong>{m.opponent_name||'Open opponent'}{m.opponent_id===me?' · You':''}</strong><b>{miniStatLabel(m.game,m.opponent_stats)}</b></div></div>
    {(m.challenger_stats||m.opponent_stats)&&<details><summary>Compare all stats</summary><table><thead><tr><th>Stat</th><th>{m.challenger_name}</th><th>{m.opponent_name||'Opponent'}</th></tr></thead><tbody>{Array.from(new Set([...Object.keys(m.challenger_stats||{}),...Object.keys(m.opponent_stats||{})])).filter(k=>k!=='dnf').map(k=><tr key={k}><th>{statNames[k]||k}</th><td>{m.challenger_stats?.[k]??'—'}</td><td>{m.opponent_stats?.[k]??'—'}</td></tr>)}</tbody></table></details>}
    {['open','pending','active'].includes(m.status)&&<p className="bk-mini-expiry">Finish by {new Date(m.expires_at).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}</p>}<div className="bk-mini-card-actions">{children}</div></article>;
}
function MiniChallengePlayer({match,token,onClose}:{match:MiniChallenge;token:string;onClose:()=>void}){
  const frame=useRef<HTMLIFrameElement>(null),dialog=useRef<HTMLDialogElement>(null);
  const [result,setResult]=useState<MiniStats|null>(null),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('');
  const locked=useRef(false),mounted=useRef(true);
  const submit=async(stats:MiniStats)=>{
    if(locked.current)return;locked.current=true;setSaving(true);setError('');
    try{await miniChallengeAction('submit',{id:match.id,token,stats});if(mounted.current)setSaved(true);}
    catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Result could not be saved. Retry below.');}
    finally{locked.current=false;if(mounted.current)setSaving(false);}
  };
  useEffect(()=>{
    mounted.current=true;dialog.current?.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    let received=false;
    const receive=(e:MessageEvent)=>{
      if(received||e.origin!==location.origin||e.source!==frame.current?.contentWindow||!['bk-mini-result','bk-mini-exit'].includes(e.data?.type)||e.data.challengeId!==match.id||e.data.token!==token)return;
      if(e.data.type==='bk-mini-exit'){onClose();return;}
      if(!e.data.stats||typeof e.data.stats!=='object'||Object.values(e.data.stats).some(v=>typeof v!=='number'||!Number.isFinite(v)))return;
      received=true;setResult(e.data.stats);void submit(e.data.stats);
    };
    window.addEventListener('message',receive);return()=>{mounted.current=false;document.body.style.overflow=overflow;window.removeEventListener('message',receive);};
  },[match.id,token]);
  return <dialog ref={dialog} className="bk-mini-play-dialog" aria-label={`${miniGame(match.game).name} head to head`} onCancel={e=>{e.preventDefault();if(!saving)onClose();}}><header><span><b>{miniGame(match.game).name}</b><small>Community challenge · fixed settings</small></span><button type="button" aria-label="Leave mini game challenge" disabled={saving} onClick={onClose}><X/></button></header>{result?<section className="bk-mini-post-result"><Trophy/><h2>{saved?'RESULT LOCKED':saving?'POSTING YOUR RESULT':'RESULT READY'}</h2><strong>{miniStatLabel(match.game,result)}</strong><p role="status">{saved?'Your result is saved. Compare stats in Community.':saving?'Saving your challenge result…':error}</p>{error&&<button className="bk-mini-primary" disabled={saving} onClick={()=>void submit(result)}>Retry saving result</button>}<button disabled={saving} onClick={onClose}>Back to challenges</button></section>:<iframe ref={frame} title={`${miniGame(match.game).name} challenge game`} src={miniChallengeUrl(match,token)} allow="fullscreen; autoplay"/>}</dialog>;
}
