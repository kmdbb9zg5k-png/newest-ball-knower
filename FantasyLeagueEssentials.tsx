import React,{useEffect,useMemo,useState} from 'react';
import {Activity,ArrowRightLeft,Bandage,Banknote,BookOpen,Check,Clock3,Crown,RefreshCw,Save,Shield,Trophy,Users,Zap} from 'lucide-react';
import {League} from './types';
import {PLAYERS_DATABASE} from './players';
import {useBallKnower} from './BallKnowerContext';
import {fetchSeasonOperations,getLeagueFreeAgents,LeagueInjury,TradeOffer} from './fantasySeasonCloud';
import {
  ArchivedSeason,buildLeagueRecords,counterTrade,fetchFantasyParityState,LINEUP_SLOTS,
  MemberFantasyMeta,optimizeWeeklyLineup,saveMyWeeklyLineup,setMyIrPlayer,submitFaabClaim,
  validateWeeklyLineup,WeeklyLineup,WeeklyScore,
} from './fantasyLeagueParityCloud';

type Tab='lineup'|'matchup'|'moves'|'trades'|'records'|'rules';
const tabs:{id:Tab;label:string;icon:React.ReactNode}[]=[
  {id:'lineup',label:'Lineup',icon:<Users className="h-4 w-4"/>},
  {id:'matchup',label:'Matchup',icon:<Activity className="h-4 w-4"/>},
  {id:'moves',label:'FAAB + IR',icon:<Banknote className="h-4 w-4"/>},
  {id:'trades',label:'Trade+',icon:<ArrowRightLeft className="h-4 w-4"/>},
  {id:'records',label:'Records',icon:<Trophy className="h-4 w-4"/>},
  {id:'rules',label:'Rules',icon:<BookOpen className="h-4 w-4"/>},
];

export const FantasyLeagueEssentials:React.FC<{league:League}>=({league})=>{
  const {currentUser,showToast,updateLeagueSettings}=useBallKnower();
  const me=league.members.find(member=>member.userId===currentUser?.id);
  const settings=(league.settings||{}) as any;
  const isCommissioner=currentUser?.id===league.commissionerId;
  const maxWeek=Math.max(17,Number(settings.seasonGames)||17);
  const [tab,setTab]=useState<Tab>('lineup');
  const [week,setWeek]=useState(Math.min(maxWeek,Math.max(1,Number(settings.currentWeek)||1)));
  const [lineups,setLineups]=useState<WeeklyLineup[]>([]);
  const [scores,setScores]=useState<WeeklyScore[]>([]);
  const [memberMeta,setMemberMeta]=useState<MemberFantasyMeta[]>([]);
  const [archives,setArchives]=useState<ArchivedSeason[]>([]);
  const [trades,setTrades]=useState<TradeOffer[]>([]);
  const [injuries,setInjuries]=useState<LeagueInjury[]>([]);
  const [starters,setStarters]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [faabPlayer,setFaabPlayer]=useState('');
  const [faabBid,setFaabBid]=useState(1);
  const [dropPlayer,setDropPlayer]=useState('');
  const [counterTradeId,setCounterTradeId]=useState('');
  const [counterGive,setCounterGive]=useState('');
  const [counterGet,setCounterGet]=useState('');
  const [counterNote,setCounterNote]=useState('');

  const roster=me?.roster||[];
  const refresh=async()=>{
    try{
      setError('');
      const [parity,ops]=await Promise.all([fetchFantasyParityState(league.id,week),fetchSeasonOperations(league.id)]);
      setLineups([...parity.lineups]);setScores([...parity.scores]);setMemberMeta([...parity.members]);setArchives([...parity.archives]);
      setTrades([...ops.trades]);setInjuries([...ops.injuries]);
    }catch(err:any){setError(err?.message||'Could not sync league essentials.');}
  };
  useEffect(()=>{void refresh();},[league.id,week]);

  const myLineup=lineups.find(item=>item.memberId===me?.id);
  useEffect(()=>{
    if(!me)return;
    setStarters(myLineup?.starters&&Object.keys(myLineup.starters).length?{...myLineup.starters}:optimizeWeeklyLineup(roster));
  },[me?.id,myLineup?.id,week,roster.length]);

  const myMeta=memberMeta.find(item=>item.memberId===me?.id);
  const irIds=myMeta?.irPlayerIds||[];
  const lineupErrors=validateWeeklyLineup(roster,starters);
  const starterIds=new Set(Object.values(starters).filter(Boolean));
  const bench=roster.filter(player=>!starterIds.has(player.id)&&!irIds.includes(player.id)).map(player=>player.id);
  const freeAgents=useMemo(()=>getLeagueFreeAgents(league,PLAYERS_DATABASE).slice(0,100),[league.members]);
  const records=useMemo(()=>buildLeagueRecords(league,archives),[league,archives]);
  const receivedTrades=trades.filter(trade=>trade.status==='pending'&&trade.recipientMemberId===me?.id);
  const selectedCounter=receivedTrades.find(trade=>trade.id===counterTradeId);
  const counterPartner=league.members.find(member=>member.id===selectedCounter?.proposerMemberId);
  const myInjuries=injuries.filter(injury=>injury.memberId===me?.id);
  const waiverType=settings.waiverType||'priority';

  const run=async(fn:()=>Promise<void>,success?:string)=>{
    if(busy)return;setBusy(true);
    try{await fn();if(success)showToast(success);await refresh();}
    catch(err:any){showToast(err?.message||'League operation failed.');}
    finally{setBusy(false);}
  };

  const saveLineup=()=>run(async()=>{
    if(!me)throw new Error('League membership not found.');
    const errors=validateWeeklyLineup(roster,starters);if(errors.length)throw new Error(errors[0]);
    await saveMyWeeklyLineup(league.id,week,starters,bench);
  },`Week ${week} lineup saved.`);

  const submitClaim=()=>run(async()=>{
    if(!me)throw new Error('League membership not found.');
    if(!faabPlayer)throw new Error('Choose a free agent.');
    const bid=waiverType==='faab'?faabBid:0;
    if(waiverType==='faab'&&bid>(myMeta?.faabBalance||0))throw new Error('That bid is higher than your remaining FAAB.');
    if(roster.length>=20&&!dropPlayer)throw new Error('Choose a player to drop because your roster is full.');
    await submitFaabClaim(league.id,me.id,faabPlayer,bid,dropPlayer||undefined,1);
    setFaabPlayer('');setDropPlayer('');setFaabBid(1);
  },waiverType==='faab'?'FAAB claim submitted.':'Waiver claim submitted.');

  const sendCounter=()=>run(async()=>{
    if(!selectedCounter)throw new Error('Choose a trade to counter.');
    if(!counterGive||!counterGet)throw new Error('Choose both sides of your counter offer.');
    await counterTrade(selectedCounter.id,[counterGive],[counterGet],counterNote);
    setCounterTradeId('');setCounterGive('');setCounterGet('');setCounterNote('');
  },'Counter offer sent.');

  const updateRule=(patch:any)=>{
    if(!isCommissioner)return;
    updateLeagueSettings(league.id,patch as any);
  };

  const matchup=league.seasonResult?.games.find(game=>game.week===week&&(game.homeMemberId===me?.id||game.awayMemberId===me?.id));
  const opponentId=matchup?(matchup.homeMemberId===me?.id?matchup.awayMemberId:matchup.homeMemberId):undefined;
  const opponent=league.members.find(member=>member.id===opponentId);
  const myScore=scores.find(score=>score.memberId===me?.id);
  const opponentScore=scores.find(score=>score.memberId===opponentId);
  const fallbackMyPoints=matchup?(matchup.homeMemberId===me?.id?matchup.homeScore:matchup.awayScore):0;
  const fallbackOppPoints=matchup?(matchup.homeMemberId===me?.id?matchup.awayScore:matchup.homeScore):0;

  return <section className="mt-5 space-y-4">
    <div className="rounded-[1.75rem] border border-[#D4AF37]/20 bg-[#0b0e12] p-4 shadow-2xl sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.18em] text-[#D4AF37]"><Zap className="h-4 w-4"/>Fantasy League Essentials</div><h2 className="mt-1 text-2xl font-black uppercase">Weekly Manager Center</h2><p className="mt-1 text-xs font-semibold text-zinc-500">Starters, matchup scoring, FAAB, IR, counter offers, records and league rules.</p></div>
        <div className="flex items-center gap-2"><label className="text-[9px] font-black uppercase text-zinc-500">Week <select value={week} onChange={event=>setWeek(Number(event.target.value))} className="ml-2 min-h-10 rounded-lg border border-white/10 bg-black/40 px-2 text-xs text-white">{Array.from({length:maxWeek},(_,index)=>index+1).map(value=><option key={value} value={value}>{value}</option>)}</select></label><button onClick={()=>void refresh()} className="grid h-10 w-10 place-items-center rounded-lg border border-white/10"><RefreshCw className="h-4 w-4"/></button></div>
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 no-scrollbar">{tabs.map(item=><button key={item.id} onClick={()=>setTab(item.id)} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-[10px] font-black uppercase ${tab===item.id?'bg-[#D4AF37] text-black':'border border-white/10 bg-black/25 text-zinc-400'}`}>{item.icon}{item.label}</button>)}</div>
    </div>

    {error&&<div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3 text-xs font-bold text-red-300">{error}</div>}

    {tab==='lineup'&&<div className="grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
      <div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center justify-between"><div><h3 className="font-black uppercase">Week {week} Starters</h3><p className="mt-1 text-[11px] text-zinc-500">9-player Ball Knower IDP lineup. Your remaining roster becomes the bench.</p></div><button onClick={()=>setStarters(optimizeWeeklyLineup(roster))} className="rounded-lg border border-[#D4AF37]/25 px-3 py-2 text-[9px] font-black uppercase text-[#D4AF37]">Optimize</button></div>
        {!me?<Empty text="Join this league to set a lineup."/>:!roster.length?<Empty text="Your weekly lineup unlocks after your fantasy draft roster is saved."/>:<div className="mt-4 space-y-2">{LINEUP_SLOTS.map(slot=>{const eligible=roster.filter(player=>slot.accept(player));return <label key={slot.id} className="grid grid-cols-[4rem_1fr] items-center gap-2 rounded-xl bg-black/30 p-2"><span className="text-[10px] font-black text-[#D4AF37]">{slot.label}</span><select value={starters[slot.id]||''} onChange={event=>setStarters(prev=>({...prev,[slot.id]:event.target.value}))} className="min-h-10 min-w-0 rounded-lg border border-white/10 bg-[#090b0e] px-2 text-xs font-bold"><option value="">Choose starter</option>{eligible.map(player=><option key={player.id} value={player.id}>{player.name} · {player.team} · {player.ovr} OVR</option>)}</select></label>})}<button onClick={saveLineup} disabled={busy||lineupErrors.length>0} className="mt-3 min-h-12 w-full rounded-xl bg-[#D4AF37] text-xs font-black uppercase text-black disabled:opacity-35"><Save className="mr-2 inline h-4 w-4"/>{myLineup?'Update Lineup':'Save Lineup'}</button>{lineupErrors.length>0&&<div className="mt-2 text-[10px] font-bold text-amber-300">{lineupErrors[0]}</div>}</div>}
      </div>
      <div className="space-y-3"><Stat label="Starters" value={`${Object.values(starters).filter(Boolean).length}/${LINEUP_SLOTS.length}`}/><Stat label="Bench" value={String(bench.length)}/><Stat label="IR" value={`${irIds.length}/${Number(settings.irSlots??2)}`}/><div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="text-[10px] font-black uppercase text-zinc-500">Lineup status</div><div className={`mt-2 text-lg font-black uppercase ${myLineup?'text-emerald-400':'text-[#D4AF37]'}`}>{myLineup?'Submitted':'Not submitted'}</div><p className="mt-2 text-[11px] leading-5 text-zinc-500">Player-level kickoff locking is supported by the saved weekly lineup structure; the scoring feed can lock eligible slots as games begin.</p></div></div>
    </div>}

    {tab==='matchup'&&<div className="space-y-4"><div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center justify-between"><div><div className="text-[10px] font-black uppercase text-[#D4AF37]">Week {week} Matchup</div><div className="mt-1 text-xl font-black uppercase">{me?.userName||'Your Team'} vs {opponent?.userName||'TBD'}</div></div><Clock3 className="h-5 w-5 text-zinc-600"/></div>{matchup?<div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3"><ScoreBox name={me?.userName||'You'} points={myScore?.livePoints??fallbackMyPoints} projection={myScore?.projectedPoints}/><div className="text-xs font-black text-zinc-600">VS</div><ScoreBox name={opponent?.userName||'Opponent'} points={opponentScore?.livePoints??fallbackOppPoints} projection={opponentScore?.projectedPoints}/></div>:<Empty text="This matchup appears when the weekly schedule is available."/>}<div className="mt-4 rounded-xl border border-white/5 bg-black/25 p-3 text-[10px] leading-5 text-zinc-500">When a weekly scoring feed is present, this view reads live and projected totals. Until then, completed Ball Knower simulation scores remain the fallback so the matchup page never lies about having live NFL data.</div></div></div>}

    {tab==='moves'&&<div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center justify-between"><div><h3 className="font-black uppercase">Waivers {waiverType==='faab'?'· FAAB':''}</h3><p className="mt-1 text-[11px] text-zinc-500">{waiverType==='faab'?`$${myMeta?.faabBalance??100} budget remaining`:'Rolling waiver priority is active.'}</p></div><Banknote className="h-5 w-5 text-[#D4AF37]"/></div>{me&&<div className="mt-4 space-y-2"><select value={faabPlayer} onChange={event=>setFaabPlayer(event.target.value)} className="min-h-11 w-full rounded-xl bg-black/40 px-3 text-xs"><option value="">Choose free agent</option>{freeAgents.slice(0,60).map(player=><option key={player.id} value={player.id}>{player.name} · {player.position} · {player.ovr}</option>)}</select>{waiverType==='faab'&&<input type="number" min={0} max={myMeta?.faabBalance??100} value={faabBid} onChange={event=>setFaabBid(Number(event.target.value))} className="min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-xs" placeholder="FAAB bid"/>}<select value={dropPlayer} onChange={event=>setDropPlayer(event.target.value)} className="min-h-11 w-full rounded-xl bg-black/40 px-3 text-xs"><option value="">{roster.length>=20?'Choose player to drop':'No drop needed'}</option>{roster.map(player=><option key={player.id} value={player.id}>{player.name} · {player.position}</option>)}</select><button disabled={busy||!faabPlayer} onClick={submitClaim} className="min-h-11 w-full rounded-xl bg-white text-[10px] font-black uppercase text-black disabled:opacity-30">Submit Claim</button></div>}</div>
      <div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center justify-between"><div><h3 className="font-black uppercase">Injured Reserve</h3><p className="mt-1 text-[11px] text-zinc-500">{irIds.length}/{Number(settings.irSlots??2)} IR slots used</p></div><Bandage className="h-5 w-5 text-red-400"/></div><div className="mt-4 space-y-2">{myInjuries.length?myInjuries.map(injury=>{const onIr=irIds.includes(injury.playerId);return <div key={injury.id} className="flex items-center justify-between gap-3 rounded-xl bg-black/30 p-3"><div><div className="text-xs font-black uppercase">{injury.playerName}</div><div className="mt-1 text-[9px] uppercase text-zinc-500">{injury.status} · {injury.weeksRemaining} week(s)</div></div><button disabled={busy} onClick={()=>run(()=>setMyIrPlayer(league.id,injury.playerId,!onIr),onIr?'Player activated from IR.':'Player moved to IR.')} className={`rounded-lg px-3 py-2 text-[9px] font-black uppercase ${onIr?'bg-emerald-500/10 text-emerald-400':'bg-red-500/10 text-red-300'}`}>{onIr?'Activate':'Move to IR'}</button></div>}):<Empty text="No eligible injuries on your roster."/>}</div></div></div>}

    {tab==='trades'&&<div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center justify-between"><div><h3 className="font-black uppercase">Counter Offer Center</h3><p className="mt-1 text-[11px] text-zinc-500">Accept/reject stays in Trade Center. This adds real counter offers without rewriting the original receipt.</p></div><ArrowRightLeft className="h-5 w-5 text-[#D4AF37]"/></div>{receivedTrades.length?<div className="mt-4 space-y-3"><select value={counterTradeId} onChange={event=>{setCounterTradeId(event.target.value);setCounterGive('');setCounterGet('');}} className="min-h-11 w-full rounded-xl bg-black/40 px-3 text-xs"><option value="">Choose received offer</option>{receivedTrades.map(trade=><option key={trade.id} value={trade.id}>{league.members.find(m=>m.id===trade.proposerMemberId)?.userName||'Owner'} · {trade.offeredPlayerIds.length} for {trade.requestedPlayerIds.length}</option>)}</select>{selectedCounter&&<><div className="grid gap-2 sm:grid-cols-2"><select value={counterGive} onChange={event=>setCounterGive(event.target.value)} className="min-h-11 rounded-xl bg-black/40 px-3 text-xs"><option value="">You send</option>{roster.map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select><select value={counterGet} onChange={event=>setCounterGet(event.target.value)} className="min-h-11 rounded-xl bg-black/40 px-3 text-xs"><option value="">You request</option>{(counterPartner?.roster||[]).map(player=><option key={player.id} value={player.id}>{player.name}</option>)}</select></div><input value={counterNote} onChange={event=>setCounterNote(event.target.value)} maxLength={500} placeholder="Counter message (optional)" className="min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-xs"/><button disabled={busy||!counterGive||!counterGet} onClick={sendCounter} className="min-h-11 w-full rounded-xl bg-[#D4AF37] text-[10px] font-black uppercase text-black disabled:opacity-30">Send Counter Offer</button></>}</div>:<Empty text="No pending offers waiting on you."/>}</div>}

    {tab==='records'&&<div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><RecordCard label="Highest Score" value={records.highGame?`${records.highGame.name} · ${records.highGame.score}`:'—'} sub={records.highGame?`S${records.highGame.season} W${records.highGame.week}`:'No completed games'}/><RecordCard label="Biggest Blowout" value={records.biggestBlowout?`${records.biggestBlowout.name} · +${records.biggestBlowout.margin}`:'—'} sub={records.biggestBlowout?`S${records.biggestBlowout.season} W${records.biggestBlowout.week}`:'No completed games'}/><RecordCard label="Best Season" value={records.bestSeason?`${records.bestSeason.name} · ${records.bestSeason.wins}-${records.bestSeason.losses}`:'—'} sub={records.bestSeason?`Season ${records.bestSeason.season}`:'No standings yet'}/><RecordCard label="Most Titles" value={records.dynasty?`${records.dynasty.name} · ${records.dynasty.titles}`:'—'} sub={`${records.seasons} season${records.seasons===1?'':'s'} tracked`}/></div><div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center gap-2 text-xs font-black uppercase text-[#D4AF37]"><Trophy className="h-4 w-4"/>League Record Book</div><p className="mt-2 text-xs leading-5 text-zinc-500">Archived seasons and the current completed season feed these records automatically, so championships and league milestones survive resets.</p></div></div>}

    {tab==='rules'&&<div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-center justify-between"><div><h3 className="font-black uppercase">League Format & Rules</h3><p className="mt-1 text-[11px] text-zinc-500">Core settings expected in a serious fantasy platform.</p></div>{isCommissioner?<Crown className="h-5 w-5 text-[#D4AF37]"/>:<Shield className="h-5 w-5 text-zinc-600"/>}</div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><RuleSelect label="Scoring" value={settings.scoringFormat||'ppr'} disabled={!isCommissioner} options={[['ppr','Full PPR'],['half_ppr','Half PPR'],['standard','Standard']]} onChange={value=>updateRule({scoringFormat:value})}/><RuleSelect label="Waivers" value={waiverType} disabled={!isCommissioner} options={[['priority','Rolling Priority'],['faab','FAAB']]} onChange={value=>updateRule({waiverType:value})}/><RuleSelect label="IR Slots" value={String(settings.irSlots??2)} disabled={!isCommissioner} options={[['0','0'],['1','1'],['2','2'],['3','3'],['4','4']]} onChange={value=>updateRule({irSlots:Number(value)})}/><RuleSelect label="Trade Deadline" value={String(settings.tradeDeadlineWeek??11)} disabled={!isCommissioner} options={Array.from({length:7},(_,i)=>String(i+8)).map(value=>[value,`Week ${value}`] as [string,string])} onChange={value=>updateRule({tradeDeadlineWeek:Number(value)})}/><RuleSelect label="Playoff Teams" value={String(settings.playoffTeams??6)} disabled={!isCommissioner} options={[['4','4'],['6','6'],['8','8']]} onChange={value=>updateRule({playoffTeams:Number(value)})}/><RuleSelect label="Draft Clock" value={String(settings.draftPickSeconds??60)} disabled={!isCommissioner} options={[['30','30 sec'],['60','60 sec'],['90','90 sec'],['120','2 min']]} onChange={value=>updateRule({draftPickSeconds:Number(value)})}/><RuleSelect label="QB Format" value={settings.superflex?'superflex':'single'} disabled={!isCommissioner} options={[['single','1 QB'],['superflex','Superflex']]} onChange={value=>updateRule({superflex:value==='superflex'})}/><RuleSelect label="League Type" value={settings.keeperMode||'redraft'} disabled={!isCommissioner} options={[['redraft','Redraft'],['keeper','Keeper'],['dynasty','Dynasty']]} onChange={value=>updateRule({keeperMode:value})}/><RuleSelect label="Trade Review" value={settings.tradeReview||'none'} disabled={!isCommissioner} options={[['none','Instant'],['commissioner','Commissioner Review']]} onChange={value=>updateRule({tradeReview:value})}/></div>{!isCommissioner&&<p className="mt-4 text-[10px] font-semibold text-zinc-600">Only the commissioner can change league rules.</p>}</div>}
  </section>;
};

const Empty=({text}:{text:string})=><div className="mt-4 rounded-xl border border-dashed border-white/10 p-6 text-center text-xs font-semibold text-zinc-600">{text}</div>;
const Stat=({label,value}:{label:string;value:string})=><div className="rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{label}</div><div className="mt-1 text-xl font-black">{value}</div></div>;
const ScoreBox=({name,points,projection}:{name:string;points:number;projection?:number})=><div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-center"><div className="truncate text-[10px] font-black uppercase text-zinc-500">{name}</div><div className="mt-2 text-4xl font-black">{Number(points||0).toFixed(1)}</div>{projection!==undefined&&projection>0&&<div className="mt-1 text-[9px] font-bold text-zinc-600">PROJ {projection.toFixed(1)}</div>}</div>;
const RecordCard=({label,value,sub}:{label:string;value:string;sub:string})=><div className="rounded-2xl border border-[#D4AF37]/15 bg-[#101318] p-4"><div className="text-[9px] font-black uppercase tracking-widest text-[#D4AF37]">{label}</div><div className="mt-2 text-sm font-black uppercase">{value}</div><div className="mt-1 text-[9px] text-zinc-600">{sub}</div></div>;
const RuleSelect=({label,value,options,onChange,disabled}:{label:string;value:string;options:[string,string][];onChange:(value:string)=>void;disabled:boolean})=><label className="text-[9px] font-black uppercase text-zinc-500">{label}<select value={value} disabled={disabled} onChange={event=>onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-xs font-bold text-white disabled:opacity-60">{options.map(([key,text])=><option key={key} value={key}>{text}</option>)}</select></label>;
