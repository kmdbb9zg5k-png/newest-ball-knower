import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, RefreshCw, X } from 'lucide-react';
import './fantasyHqControls.css';
import { supabase, ensureOnlineSession } from './supabase';
import type { League } from './types';
import type { FantasyRanking } from './fantasyRankingsCloud';
import type { WeeklyScore } from './fantasyLeagueParityCloud';
import { ModalPortal } from './ModalPortal';
import { useBroadcastFocus } from './broadcastFocus';
import { buildHqPracticeDraft, fantasyHqSummary, fantasyHqScheduleFacts, hqPublishedProjection } from './fantasyHqData';

type ActivityRow = { id:string; text:string; time:string };
/** Fetch only the two activity sources; partial failures must not look like an empty feed. */
async function readHqActivity(leagueId: string) {
  if (!supabase) throw new Error('Online league activity is unavailable.');
  await ensureOnlineSession();
  const [transactions, messages] = await Promise.all([
    supabase.from('ball_knower_transactions').select('id,summary,created_at').eq('league_id',leagueId).order('created_at',{ascending:false}).limit(10),
    supabase.from('ball_knower_league_messages').select('id,body,kind,created_at').eq('league_id',leagueId).in('kind',['announcement','receipt']).order('created_at',{ascending:false}).limit(10),
  ]);
  if (transactions.error || messages.error) throw new Error('League activity could not sync.');
  return {
    transactions: (transactions.data || []).map(row => ({ id: String(row.id), summary: String(row.summary || ''), createdAt: String(row.created_at) })),
    messages: (messages.data || []).map(row => ({ id: String(row.id), body: String(row.body || ''), kind: String(row.kind), createdAt: String(row.created_at) })),
  };
}

/** Read the selected league's existing receipts; keep errors distinct from an empty feed. */
export function FantasyHqActivity({league}: {league?: League}) {
  const [rows,setRows]=useState<ActivityRow[]>([]);
  const [busy,setBusy]=useState(Boolean(league));
  const [error,setError]=useState('');
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    let active=true;
    setRows([]);setError('');setBusy(Boolean(league));
    if (!league) return;
    void readHqActivity(league.id).then(data=>{
      if (!active) return;
      const entries=[...data.transactions.map(item=>({id:`t-${item.id}`,text:item.summary,time:item.createdAt})),
        ...data.messages.filter(item=>item.kind==='announcement'||item.kind==='receipt').map(item=>({id:`m-${item.id}`,text:item.body,time:item.createdAt}))];
      setRows(entries.sort((a,b)=>(Date.parse(b.time)||0)-(Date.parse(a.time)||0)).slice(0,3));
    }).catch(()=>{if(active)setError('League activity is temporarily unavailable.');}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[league?.id,retry]);
  return <section className="bk-hq-activity" aria-label="Recent League Activity" aria-busy={busy}>
    <div><h3>Recent League Activity</h3><span className="bk-hq-activity-wave" aria-hidden="true"/></div>
    {busy?<p role="status">Checking league updates…</p>:error?<div role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>Retry activity</button></div>:rows.length?<ul>{rows.map(row=><li key={row.id}>{row.text}</li>)}</ul>:<p>{league?'No recent league activity yet. Draft and league updates will appear here.':'Create or join a league to see its activity here.'}</p>}
  </section>;
}

type Props={mode:'draft'|'matchup'|'leagues';leagues:League[];rankings:FantasyRanking[];rankingsBusy:boolean;rankingsError:string|null;onClose:()=>void;onCreate:()=>void;onJoin:()=>void;onOpenLeague:(league:League)=>void};
/** All tools operate on leagues already in the user's authorized context. */
export function FantasyHqWorkspace({mode,leagues,rankings,rankingsBusy,rankingsError,onClose,onCreate,onJoin,onOpenLeague}: Props) {
  const [selectedId,setSelectedId]=useState(leagues[0]?.id||'');
  const league=leagues.find(item=>item.id===selectedId)||leagues[0];
  const title=mode==='draft'?'Draft Simulation':mode==='matchup'?'Matchup Analyzer':'My Leagues';
  useBroadcastFocus(true);
  useEffect(()=>{const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose();};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[onClose]);
  return <ModalPortal><div className="bk-hq-workspace-scrim" onClick={event=>{if(event.target===event.currentTarget)onClose();}}><section className="bk-hq-workspace" role="dialog" aria-modal="true" aria-label={title}>
    <header><div><small>Fantasy HQ</small><h2>{title}</h2></div><button type="button" onClick={onClose} aria-label={`Close ${title}`}><X aria-hidden="true"/></button></header>
    {!league?<div className="bk-hq-tool-empty"><p>Create or join a league first. These tools use your league's teams and settings.</p><button type="button" onClick={onCreate}>Create League</button><button type="button" onClick={onJoin}>Join With Code</button></div>:mode==='leagues'?<div className="bk-hq-league-list">{leagues.map(item=><button type="button" key={item.id} onClick={()=>onOpenLeague(item)}><span><strong>{item.name}</strong><small>{item.members.length}/{item.maxMembers} teams · {fantasyHqSummary(item).phase}</small></span><ArrowRight aria-hidden="true"/></button>)}</div>:<>
      <label className="bk-hq-tool-league-picker">League<select aria-label="League" value={league.id} onChange={event=>setSelectedId(event.target.value)}>{leagues.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {mode==='draft'?<PracticeDraft key={league.id} league={league} rankings={rankings} busy={rankingsBusy} error={rankingsError}/>:<MatchupAnalysis key={league.id} league={league}/>}
      <button type="button" className="bk-hq-open-league" onClick={()=>onOpenLeague(league)}>Open {league.name} <ArrowRight aria-hidden="true"/></button>
    </>}
  </section></div></ModalPortal>;
}

function PracticeDraft({league,rankings,busy,error}: {league:League;rankings:FantasyRanking[];busy:boolean;error:string|null}) {
  const [seed,setSeed]=useState(0);
  const picks=useMemo(()=>seed?buildHqPracticeDraft(league,rankings,seed):[],[league,rankings,seed]);
  const rounds=Math.max(9,Math.min(30,league.settings?.rosterSize||15));
  return <div className="bk-hq-practice">
    <p>Private snake-draft practice using published full-PPR rankings and a standard one-QB roster. This does not change your live draft, league settings, or rosters.</p>
    <p className="bk-hq-tool-note">{league.members.length} teams · {rounds} rounds. Without an assigned draft order, practice uses the current member order.</p>
    {busy?<p role="status">Loading the published player board…</p>:error?<p role="alert">{error}</p>:rankings.length===0?<p>No published rankings are available yet.</p>:league.members.length<2?<p>At least two league members are needed for practice.</p>:<button type="button" className="bk-hq-run-mock" onClick={()=>setSeed(value=>value+1)}>{seed?'Run another simulation':'Run draft simulation'}<RefreshCw aria-hidden="true"/></button>}
    {seed>0&&<><p role="status">{picks.length} of {league.members.length*rounds} practice picks generated.{picks.length<league.members.length*rounds?' The published player pool could not fill every slot.':''}</p><ol className="bk-hq-mock-picks">{picks.map(pick=><li key={pick.overall}><b>#{pick.overall}</b><span><strong>{pick.player.player_name}</strong><small>{league.members.find(member=>member.id===pick.memberId)?.userName} · Round {pick.round}</small></span><em>{pick.player.position}</em></li>)}</ol></>}
  </div>;
}

type Pairing={id:string;homeMemberId:string;awayMemberId:string;week:number};
function MatchupAnalysis({league}: {league:League}) {
  const {weeks,persisted}=fantasyHqScheduleFacts(league);
  const [week,setWeek]=useState(Math.max(1,Math.min(weeks,league.settings?.currentWeek||1)));
  const [data,setData]=useState<{scores:WeeklyScore[];pairings:Pairing[]}|null>(null);
  const [busy,setBusy]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>setWeek(current=>Math.max(1,Math.min(weeks,current))),[weeks]);
  const ready=league.liveDraft?.status==='completed'&&league.members.length>=2&&league.members.length%2===0;
  useEffect(()=>{
    let active=true;
    setData(null);setError('');setBusy(ready);
    if(!ready)return;
    void Promise.all([import('./fantasyLeagueParityCloud'),import('./simulation')]).then(async([cloud,schedule])=>{
      const response=await cloud.fetchFantasyParityState(league.id,week,league.settings?.nflSeason||2026);
      if(!active)return;
      if(response.isDegraded)throw new Error('Some matchup data could not sync. Retry to see current scores.');
      const pairings=schedule.isCompleteFantasySchedule(league.members,weeks,persisted)?persisted.filter(game=>game.week===week):schedule.buildFantasyWeekPairings(league.members,week);
      setData({scores:[...response.scores],pairings});
    }).catch(()=>{if(active)setError('Matchup data is temporarily unavailable.');}).finally(()=>{if(active)setBusy(false);});
    return()=>{active=false;};
  },[league,week,weeks,ready,retry]);
  const points=(value:number|null|undefined)=>value!=null&&Number.isFinite(value)?value.toFixed(1):'—';
  return <div className="bk-hq-matchup-analysis">
    <p>Compare the league's regular-season matchups using published weekly scores and projections. Unavailable totals stay blank; no games are simulated.</p>
    {!ready?<p className="bk-hq-tool-empty">Matchups become available after the fantasy draft is complete and the league has an even number of teams.</p>:<>
      <label className="bk-hq-tool-league-picker">Week<select aria-label="Week" value={week} onChange={event=>setWeek(Number(event.target.value))}>{Array.from({length:weeks},(_,i)=><option key={i} value={i+1}>Week {i+1}</option>)}</select></label>
      {busy?<p role="status">Loading Week {week}…</p>:error?<div role="alert"><p>{error}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>Retry matchups</button></div>:data?.pairings.map(game=>{
        const home=data.scores.find(score=>score.memberId===game.homeMemberId&&score.week===week),away=data.scores.find(score=>score.memberId===game.awayMemberId&&score.week===week);
        const hp=hqPublishedProjection(home),ap=hqPublishedProjection(away);
        const homeName=league.members.find(member=>member.id===game.homeMemberId)?.userName||'Home',awayName=league.members.find(member=>member.id===game.awayMemberId)?.userName||'Away';
        const final=Boolean(home?.isFinal&&away?.isFinal);
        return <article key={game.id} className="bk-hq-matchup"><header><strong>{awayName}</strong><span>vs</span><strong>{homeName}</strong></header><div><span>{points(away?.livePoints)}</span><small>{final?'Final':'Posted points'}</small><span>{points(home?.livePoints)}</span></div><p>Projected: {points(ap)} — {points(hp)}</p>{!final&&hp!==null&&ap!==null&&<small>{hp===ap?'Even projection':`${hp>ap?homeName:awayName} has a ${Math.abs(hp-ap).toFixed(1)}-point projected edge.`}</small>}</article>;
      })}
    </>}
  </div>;
}
