import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRightLeft,
  Bandage,
  Bell,
  Check,
  ChevronRight,
  Clock3,
  Gavel,
  Medal,
  MessageCircle,
  Play,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  Star,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { League, LeagueMember, Player } from './types';
import { PLAYERS_DATABASE } from './players';
import { playerPortraitUrl } from './playerPortraits';
import { useBallKnower } from './BallKnowerContext';
import {
  fetchSeasonOperations,
  getLeagueFreeAgents,
  LeagueInjury,
  LeagueMessage,
  LeagueTransaction,
  postLeagueMessage,
  proposeTrade,
  resolveTrade,
  TradeOffer,
  WaiverClaim,
} from './fantasySeasonCloud';
import {
  ArchivedSeason,
  buildLeagueRecords,
  fetchFantasyParityState,
  LINEUP_SLOTS,
  MemberFantasyMeta,
  optimizeWeeklyLineup,
  saveMyWeeklyLineup,
  setMyIrPlayer,
  submitFaabClaim,
  validateWeeklyLineup,
  WeeklyLineup,
  WeeklyScore,
} from './fantasyLeagueParityCloud';
import { counterTradeV2 } from './fantasyTradeV2Cloud';
import { FantasyRanking, loadFantasyRankings } from './fantasyRankingsCloud';

type Tab = 'team' | 'matchup' | 'players' | 'league' | 'activity' | 'intel';
type ActivityView = 'trades' | 'moves' | 'messages';
type IntelView = 'awards' | 'allbk';

type Props = {
  league: League;
  onGoToSimulation: () => void;
};

const STANDARD_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'DST']);
const normalizeName = (value:string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const displayManagerName = (member?:LeagueMember) => {
  if (!member) return 'Team';
  if (!member.isAi) return member.userName;
  const clean = member.userName.replace(/\s+CPU(?:\s+\d+)?$/i, '').trim();
  return clean || 'CPU Team';
};
const rosterCount = (member?:LeagueMember) => member?.roster?.length || 0;

export const FantasyLeaguePostDraft: React.FC<Props> = ({ league, onGoToSimulation }) => {
  const { currentUser, showToast, startSimulation, updateLeagueSettings } = useBallKnower();
  const me = league.members.find(member => member.userId === currentUser?.id);
  const roster = me?.roster || [];
  const settings = (league.settings || {}) as any;
  const isCommissioner = currentUser?.id === league.commissionerId;
  const maxWeek = Math.max(17, Number(settings.seasonGames) || 17);

  const [tab, setTab] = useState<Tab>('team');
  const [activityView, setActivityView] = useState<ActivityView>('trades');
  const [intelView, setIntelView] = useState<IntelView>('allbk');
  const [week, setWeek] = useState(Math.min(maxWeek, Math.max(1, Number(settings.currentWeek) || 1)));
  const [lineups, setLineups] = useState<WeeklyLineup[]>([]);
  const [scores, setScores] = useState<WeeklyScore[]>([]);
  const [memberMeta, setMemberMeta] = useState<MemberFantasyMeta[]>([]);
  const [archives, setArchives] = useState<ArchivedSeason[]>([]);
  const [trades, setTrades] = useState<TradeOffer[]>([]);
  const [claims, setClaims] = useState<WaiverClaim[]>([]);
  const [injuries, setInjuries] = useState<LeagueInjury[]>([]);
  const [messages, setMessages] = useState<LeagueMessage[]>([]);
  const [transactions, setTransactions] = useState<LeagueTransaction[]>([]);
  const [rankings, setRankings] = useState<FantasyRanking[]>([]);
  const [starters, setStarters] = useState<Record<string,string>>({});
  const [swapSlot, setSwapSlot] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [freeAgentQuery, setFreeAgentQuery] = useState('');
  const [faabPlayer, setFaabPlayer] = useState('');
  const [faabBid, setFaabBid] = useState(1);
  const [dropPlayer, setDropPlayer] = useState('');

  const [tradeTarget, setTradeTarget] = useState('');
  const [tradeGive, setTradeGive] = useState<string[]>([]);
  const [tradeGet, setTradeGet] = useState<string[]>([]);
  const [tradeDrops, setTradeDrops] = useState<string[]>([]);
  const [counterTradeId, setCounterTradeId] = useState('');
  const [counterGive, setCounterGive] = useState<string[]>([]);
  const [counterGet, setCounterGet] = useState<string[]>([]);
  const [counterDrops, setCounterDrops] = useState<string[]>([]);
  const [acceptDrops, setAcceptDrops] = useState<Record<string,string[]>>({});
  const [message, setMessage] = useState('');
  const tradeBuilderRef = useRef<HTMLDivElement>(null);

  const rankingsByName = useMemo(() => {
    const map = new Map<string, FantasyRanking>();
    rankings.forEach(ranking => map.set(normalizeName(ranking.player_name), ranking));
    return map;
  }, [rankings]);

  const rankingFor = (player?:Player) => player ? rankingsByName.get(normalizeName(player.name)) : undefined;
  const fantasyValue = (player:Player) => {
    const ranking = rankingFor(player);
    if (ranking) return Number(ranking.projected_points_2026) || 0;
    const multiplier = player.position === 'QB' ? 2.3 : player.position === 'RB' ? 2.65 : player.position === 'WR' ? 2.55 : player.position === 'TE' ? 1.95 : player.position === 'K' ? 1.15 : player.position === 'DST' ? 1.2 : 1;
    return (Number(player.ovr) || 65) * multiplier;
  };
  const valueLabel = (player:Player) => {
    const ranking = rankingFor(player);
    if (ranking) return `#${ranking.overall_rank} overall · #${ranking.position_rank} ${ranking.position} · ${Number(ranking.projected_points_2026).toFixed(1)} proj`;
    return player.position === 'DST' ? `${player.team} D/ST · Ball Knower value` : `${player.team} · ${player.position} · projection pending`;
  };

  const refresh = async () => {
    try {
      setError('');
      const [parity, ops] = await Promise.all([
        fetchFantasyParityState(league.id, week),
        fetchSeasonOperations(league.id),
      ]);
      setLineups([...parity.lineups]);
      setScores([...parity.scores]);
      setMemberMeta([...parity.members]);
      setArchives([...parity.archives]);
      setTrades([...ops.trades]);
      setClaims([...ops.claims]);
      setInjuries([...ops.injuries]);
      setMessages([...ops.messages]);
      setTransactions([...ops.transactions]);
    } catch (err:any) {
      setError(err?.message || 'Could not sync this league.');
    }
  };

  useEffect(() => { void refresh(); }, [league.id, week]);
  useEffect(() => {
    let active = true;
    void loadFantasyRankings().then(data => { if (active) setRankings(data); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const myLineup = lineups.find(item => item.memberId === me?.id);
  useEffect(() => {
    setStarters(
      myLineup?.starters && Object.keys(myLineup.starters).length
        ? { ...myLineup.starters }
        : optimizeWeeklyLineup(roster),
    );
  }, [league.id, week, myLineup?.id, myLineup?.updatedAt, roster.length]);

  const myMeta = memberMeta.find(item => item.memberId === me?.id);
  const irIds = myMeta?.irPlayerIds || [];
  const lineupErrors = validateWeeklyLineup(roster, starters);
  const starterIds = new Set(Object.values(starters).filter(Boolean));
  const bench = roster.filter(player => !starterIds.has(player.id) && !irIds.includes(player.id));
  const waiverType = settings.waiverType || 'priority';
  const records = useMemo(() => buildLeagueRecords(league, archives), [league, archives]);

  const freeAgents = useMemo(() => getLeagueFreeAgents(league, PLAYERS_DATABASE)
    .filter(player => STANDARD_POSITIONS.has(player.position))
    .sort((a,b) => fantasyValue(b) - fantasyValue(a)), [league.members, rankingsByName]);
  const visibleFreeAgents = useMemo(() => {
    const query = freeAgentQuery.trim().toLowerCase();
    return freeAgents.filter(player => !query || `${player.name} ${player.team} ${player.position}`.toLowerCase().includes(query)).slice(0, 30);
  }, [freeAgents, freeAgentQuery]);

  const selectedTeam = league.members.find(member => member.id === selectedTeamId);
  const tradePartner = league.members.find(member => member.id === tradeTarget);
  const selectedCounter = trades.find(trade => trade.id === counterTradeId);
  const counterPartner = league.members.find(member => member.id === selectedCounter?.proposerMemberId);
  const receivedTrades = trades.filter(trade => trade.status === 'pending' && trade.recipientMemberId === me?.id);
  const sentTrades = trades.filter(trade => trade.status === 'pending' && trade.proposerMemberId === me?.id);
  const reviewTrades = trades.filter(trade => trade.status === 'accepted_pending_review');
  const myInjuries = injuries.filter(injury => injury.memberId === me?.id);

  const requiredTradeDrops = Math.max(0, roster.length - tradeGive.length + tradeGet.length - 20);
  const requiredCounterDrops = Math.max(0, roster.length - counterGive.length + counterGet.length - 20);
  useEffect(() => setTradeDrops(prev => prev.filter(id => !tradeGive.includes(id)).slice(0, requiredTradeDrops)), [tradeGive.join('|'), requiredTradeDrops]);
  useEffect(() => setCounterDrops(prev => prev.filter(id => !counterGive.includes(id)).slice(0, requiredCounterDrops)), [counterGive.join('|'), requiredCounterDrops]);

  const run = async (fn:() => Promise<void>, success?:string) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (success) showToast(success);
      await refresh();
    } catch (err:any) {
      showToast(err?.message || 'League operation failed.');
    } finally {
      setBusy(false);
    }
  };

  const saveLineup = () => run(async () => {
    if (!me) throw new Error('League membership not found.');
    if (lineupErrors.length) throw new Error(lineupErrors[0]);
    await saveMyWeeklyLineup(league.id, week, starters, bench.map(player => player.id));
  }, `Week ${week} lineup saved.`);

  const submitClaim = () => run(async () => {
    if (!me || !faabPlayer) throw new Error('Choose a free agent.');
    if (roster.length >= 20 && !dropPlayer) throw new Error('Choose a player to drop.');
    await submitFaabClaim(league.id, me.id, faabPlayer, waiverType === 'faab' ? faabBid : 0, dropPlayer || undefined, 1);
    setFaabPlayer('');
    setDropPlayer('');
  }, 'Claim submitted.');

  const sendTrade = () => run(async () => {
    if (!me || !tradeTarget || !tradeGive.length || !tradeGet.length) throw new Error('Choose players from both teams.');
    if (tradeGive.length > 3 || tradeGet.length > 3) throw new Error('Trade packages are limited to three players per side.');
    if (tradeDrops.length !== requiredTradeDrops) throw new Error(`Choose ${requiredTradeDrops} roster cut${requiredTradeDrops === 1 ? '' : 's'} first.`);
    const result = await proposeTrade(league, me.id, tradeTarget, tradeGive, tradeGet, tradeDrops);
    showToast(result.reason || (result.status === 'accepted' ? 'CPU accepted the trade.' : result.status === 'rejected' ? 'CPU declined the trade.' : 'Trade offer sent.'));
    setTradeGive([]); setTradeGet([]); setTradeDrops([]);
  });

  const startTrade = (memberId:string, playerId?:string) => {
    setTradeTarget(memberId);
    setTradeGive([]);
    setTradeGet(playerId ? [playerId] : []);
    setTradeDrops([]);
    setSelectedTeamId('');
    setActivityView('trades');
    setTab('activity');
    window.setTimeout(() => tradeBuilderRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
  };

  const openCounter = (trade:TradeOffer) => {
    setCounterTradeId(trade.id);
    setCounterGive([...trade.requestedPlayerIds]);
    setCounterGet([...trade.offeredPlayerIds]);
    setCounterDrops([]);
  };

  const sendCounter = () => run(async () => {
    if (!selectedCounter || !counterGive.length || !counterGet.length) throw new Error('Choose players from both teams.');
    if (counterDrops.length !== requiredCounterDrops) throw new Error(`Choose ${requiredCounterDrops} roster cut${requiredCounterDrops === 1 ? '' : 's'} first.`);
    await counterTradeV2(selectedCounter.id, counterGive, counterGet, counterDrops);
    setCounterTradeId(''); setCounterGive([]); setCounterGet([]); setCounterDrops([]);
  }, 'Counter offer sent.');

  const actOnTrade = (trade:TradeOffer, action:'accepted'|'rejected'|'cancelled'|'approved'|'vetoed') => run(async () => {
    const drops = action === 'accepted' ? (acceptDrops[trade.id] || []) : [];
    const result = await resolveTrade(trade.id, action, drops);
    showToast(result.reason || `Trade ${result.status}.`);
    if (action === 'accepted') setAcceptDrops(prev => ({ ...prev, [trade.id]: [] }));
  });

  const sendMessage = () => run(async () => {
    await postLeagueMessage(
      league.id,
      currentUser?.name || me?.userName || 'Ball Knower',
      message,
      isCommissioner && message.startsWith('!') ? 'announcement' : 'chat',
    );
    setMessage('');
  }, 'Message sent.');

  const launchSeason = () => run(async () => {
    const started = await startSimulation(league.id);
    if (!started) throw new Error('The season could not start. Check the league rosters and try again.');
    onGoToSimulation();
  });

  const matchup = league.seasonResult?.games.find(game => game.week === week && (game.homeMemberId === me?.id || game.awayMemberId === me?.id));
  const opponentId = matchup ? (matchup.homeMemberId === me?.id ? matchup.awayMemberId : matchup.homeMemberId) : undefined;
  const opponent = league.members.find(member => member.id === opponentId);
  const myScore = scores.find(score => score.memberId === me?.id);
  const opponentScore = scores.find(score => score.memberId === opponentId);
  const myPoints = matchup ? (matchup.homeMemberId === me?.id ? matchup.homeScore : matchup.awayScore) : 0;
  const oppPoints = matchup ? (matchup.homeMemberId === me?.id ? matchup.awayScore : matchup.homeScore) : 0;
  const seasonHasGames = Boolean(league.seasonResult?.games?.length);

  const findPlayer = (id:string) => league.members.flatMap(member => member.roster || []).find(player => player.id === id) || PLAYERS_DATABASE.find(player => player.id === id);
  const swapDefinition = LINEUP_SLOTS.find(slot => slot.id === swapSlot);
  const currentSwapPlayer = roster.find(player => player.id === starters[swapSlot]);
  const otherStarterIds = new Set(Object.entries(starters).filter(([slot]) => slot !== swapSlot).map(([,id]) => id).filter(Boolean));
  const swapOptions = swapDefinition ? roster.filter(player => swapDefinition.accept(player) && !otherStarterIds.has(player.id) && !irIds.includes(player.id)).sort((a,b) => fantasyValue(b)-fantasyValue(a)) : [];

  const weeklyAwards = useMemo(() => {
    const games = league.seasonResult?.games || [];
    const weeks = [...new Set(games.map(game => game.week))].sort((a,b) => a-b);
    return weeks.map(awardWeek => {
      const entries = games.filter(game => game.week === awardWeek).flatMap(game => [
        { memberId:game.homeMemberId, points:Number(game.homeScore)||0 },
        { memberId:game.awayMemberId, points:Number(game.awayScore)||0 },
      ]).sort((a,b) => b.points-a.points);
      const best = entries[0];
      const member = league.members.find(item => item.id === best?.memberId);
      return best ? { week:awardWeek, points:best.points, member } : null;
    }).filter(Boolean) as {week:number;points:number;member?:LeagueMember}[];
  }, [league.seasonResult?.games, league.members]);

  const allBkTeam = useMemo(() => {
    const pool = league.members.flatMap(member => (member.roster || [])
      .filter(player => STANDARD_POSITIONS.has(player.position))
      .map(player => ({ member, player, score:fantasyValue(player) })));
    const used = new Set<string>();
    const take = (label:string, test:(player:Player) => boolean, count=1) => pool
      .filter(item => test(item.player) && !used.has(item.player.id))
      .sort((a,b) => b.score-a.score)
      .slice(0,count)
      .map(item => { used.add(item.player.id); return { label, ...item }; });
    const picks = [
      ...take('QB', player => player.position === 'QB'),
      ...take('RB', player => player.position === 'RB', 2),
      ...take('WR', player => player.position === 'WR', 2),
      ...take('TE', player => player.position === 'TE'),
      ...take('FLEX', player => ['RB','WR','TE'].includes(player.position)),
      ...take('K', player => player.position === 'K'),
      ...take('D/ST', player => player.position === 'DST'),
    ];
    return picks;
  }, [league.members, rankingsByName]);

  const navItems:{id:Tab;label:string;icon:React.ReactNode}[] = [
    {id:'team',label:'My Team',icon:<Users className="h-4 w-4"/>},
    {id:'matchup',label:'Matchup',icon:<Clock3 className="h-4 w-4"/>},
    {id:'players',label:'Players',icon:<Zap className="h-4 w-4"/>},
    {id:'league',label:'League',icon:<Trophy className="h-4 w-4"/>},
    {id:'activity',label:'Activity',icon:<Bell className="h-4 w-4"/>},
    {id:'intel',label:'Intel',icon:<Star className="h-4 w-4"/>},
  ];

  return (
    <section className="space-y-4 pb-24 text-white">
      <header className="rounded-2xl border border-[#D4AF37]/20 bg-[radial-gradient(circle_at_90%_10%,rgba(212,175,55,.14),transparent_34%),#0b0e12] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] font-black uppercase tracking-[.2em] text-[#D4AF37]">Fantasy League</div>
            <h1 className="mt-1 truncate text-xl font-black uppercase sm:text-3xl">{league.name}</h1>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[10px] font-bold text-zinc-500">
              <span>{league.members.length} teams</span><span>•</span><span>{settings.seasonGames || 17} games</span><span>•</span><span>{settings.scoringFormat === 'half_ppr' ? 'Half PPR' : settings.scoringFormat === 'standard' ? 'Standard' : 'Full PPR'}</span>
            </div>
          </div>
          <button aria-label="Refresh league" onClick={() => void refresh()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/20"><RefreshCw className="h-4 w-4"/></button>
        </div>
      </header>

      <div className="sticky top-16 z-30 -mx-1 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0e12]/95 p-1.5 shadow-2xl backdrop-blur-md">
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`relative flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-3 text-[10px] font-black uppercase ${tab === item.id ? 'bg-[#D4AF37] text-black' : 'text-zinc-400'}`}>{item.icon}<span>{item.label}</span>{item.id === 'activity' && receivedTrades.length > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[8px] text-white">{receivedTrades.length}</span>}</button>)}
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-3 text-xs text-red-300">{error}</div>}

      {tab === 'team' && <div className="space-y-3">
        <div className="flex items-end justify-between gap-3"><div><h2 className="text-xl font-black uppercase">My Team</h2><p className="text-xs text-zinc-500">Tap Swap to change a starter.</p></div><div className={`max-w-[45%] text-right text-[10px] font-black uppercase ${lineupErrors.length ? 'text-amber-300' : 'text-emerald-400'}`}>{lineupErrors.length ? lineupErrors[0] : 'Lineup ready'}</div></div>
        {!roster.length ? <Empty text="Your roster appears here after the draft."/> : <>
          <RosterSection title="Starters">
            {LINEUP_SLOTS.map(slot => <LineupRow key={slot.id} label={slot.label} player={roster.find(player => player.id === starters[slot.id])} valueLabel={valueLabel} onSwap={() => setSwapSlot(slot.id)}/>) }
          </RosterSection>
          <button onClick={saveLineup} disabled={busy || lineupErrors.length > 0} className="min-h-12 w-full rounded-xl bg-[#D4AF37] text-xs font-black uppercase text-black disabled:opacity-35"><Save className="mr-2 inline h-4 w-4"/>Save Lineup</button>
          <RosterSection title={`Bench · ${bench.length}`}>{bench.sort((a,b)=>fantasyValue(b)-fantasyValue(a)).map(player => <PlayerRow key={player.id} label="BN" player={player} valueLabel={valueLabel}/>)}</RosterSection>
        </>}
      </div>}

      {tab === 'matchup' && <div className="space-y-3">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black uppercase">Matchup</h2><p className="text-xs text-zinc-500">Your weekly head-to-head.</p></div><select aria-label="Fantasy week" value={week} onChange={event => setWeek(Number(event.target.value))} className="min-h-11 rounded-xl border border-white/10 bg-[#101318] px-3 text-xs">{Array.from({length:maxWeek},(_,index)=>index+1).map(value=><option key={value} value={value}>Week {value}</option>)}</select></div>
        {!seasonHasGames && isCommissioner && <StartSeasonCard league={league} busy={busy} onStart={launchSeason}/>} 
        <Panel title={`Week ${week}`} sub={`${displayManagerName(me)} vs ${displayManagerName(opponent)}`} icon={<Clock3 className="h-5 w-5 text-[#D4AF37]"/>}>{matchup ? <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><Score name={displayManagerName(me)} points={myScore?.livePoints ?? myPoints} projection={myScore?.projectedPoints}/><b className="text-zinc-600">VS</b><Score name={displayManagerName(opponent)} points={opponentScore?.livePoints ?? oppPoints} projection={opponentScore?.projectedPoints}/></div> : <Empty text="Start the season to generate the schedule and matchups."/>}</Panel>
      </div>}

      {tab === 'players' && <div className="space-y-3">
        <div><h2 className="text-xl font-black uppercase">Players</h2><p className="text-xs text-zinc-500">Free agents, waivers and IR without salary-cap clutter.</p></div>
        <Panel title="Available Players" sub={waiverType === 'faab' ? `$${myMeta?.faabBalance ?? 100} FAAB remaining` : 'Free agents and waivers'} icon={<Search className="h-5 w-5 text-[#D4AF37]"/>}>
          <input value={freeAgentQuery} onChange={event => setFreeAgentQuery(event.target.value)} placeholder="Search name, team or position…" className="min-h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 text-sm outline-none focus:border-[#D4AF37]/50"/>
          <div className="max-h-[44dvh] space-y-1 overflow-y-auto pr-1">{visibleFreeAgents.map(player => <button key={player.id} onClick={() => setFaabPlayer(player.id)} className={`flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 text-left ${faabPlayer === player.id ? 'bg-[#D4AF37] text-black' : 'bg-black/25'}`}><div className="min-w-0"><div className="truncate text-xs font-black">{player.name}</div><div className={`truncate text-[9px] ${faabPlayer === player.id ? 'text-black/60' : 'text-zinc-500'}`}>{valueLabel(player)}</div></div><span className="shrink-0 text-[9px] font-black uppercase">{faabPlayer === player.id ? 'Selected' : 'Claim'}</span></button>)}</div>
          {faabPlayer && <div className="space-y-2 rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-3">{waiverType === 'faab' && <input type="number" min={0} max={myMeta?.faabBalance ?? 100} value={faabBid} onChange={event => setFaabBid(Number(event.target.value))} className="min-h-11 w-full rounded-xl bg-black/40 px-3 text-xs" placeholder="FAAB bid"/>}<select value={dropPlayer} onChange={event => setDropPlayer(event.target.value)} className="min-h-11 w-full rounded-xl bg-black/40 px-3 text-xs"><option value="">{roster.length >= 20 ? 'Choose player to drop' : 'No drop needed'}</option>{roster.filter(player => player.id !== faabPlayer).sort((a,b)=>fantasyValue(a)-fantasyValue(b)).map(player => <option key={player.id} value={player.id}>{player.name} · {player.position}</option>)}</select><button disabled={busy || (roster.length >= 20 && !dropPlayer)} onClick={submitClaim} className="min-h-11 w-full rounded-xl bg-white text-[10px] font-black uppercase text-black disabled:opacity-30">Submit Claim</button></div>}
          {claims.filter(claim => claim.memberId === me?.id && claim.status === 'pending').length > 0 && <div className="text-[10px] font-bold text-zinc-500">{claims.filter(claim => claim.memberId === me?.id && claim.status === 'pending').length} pending claim(s)</div>}
        </Panel>
        <Panel title="Injured Reserve" sub={`${irIds.length}/${Number(settings.irSlots ?? 2)} slots used`} icon={<Bandage className="h-5 w-5 text-red-400"/>}>{myInjuries.length ? myInjuries.map(injury => { const onIr = irIds.includes(injury.playerId); return <Action key={injury.id} text={`${injury.playerName} · ${injury.status}`} label={onIr ? 'Activate' : 'Move to IR'} onClick={() => run(() => setMyIrPlayer(league.id, injury.playerId, !onIr))}/>; }) : <Empty text="No IR-eligible injuries."/>}</Panel>
      </div>}

      {tab === 'league' && <div className="space-y-3">
        {!seasonHasGames && isCommissioner && <StartSeasonCard league={league} busy={busy} onStart={launchSeason}/>} 
        {seasonHasGames && <div className="grid grid-cols-2 gap-2 lg:grid-cols-4"><Record label="Highest Score" value={records.highGame ? `${records.highGame.name} · ${records.highGame.score}` : '—'}/><Record label="Biggest Win" value={records.biggestBlowout ? `${records.biggestBlowout.name} · +${records.biggestBlowout.margin}` : '—'}/><Record label="Best Season" value={records.bestSeason ? `${records.bestSeason.name} · ${records.bestSeason.wins}-${records.bestSeason.losses}` : '—'}/><Record label="Most Titles" value={records.dynasty ? `${records.dynasty.name} · ${records.dynasty.titles}` : '—'}/></div>}
        <Panel title="Teams & Standings" sub="Tap a team, see its full roster, then trade for a player" icon={<Users className="h-5 w-5 text-[#D4AF37]"/>}>{league.members.map(member => { const standing = league.seasonResult?.standings.find(row => row.memberId === member.id); return <button key={member.id} onClick={() => setSelectedTeamId(member.id)} className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-white/5 px-1 py-2 text-left"><div className="min-w-0"><div className="flex items-center gap-2"><span className="truncate text-sm font-black">{displayManagerName(member)}</span>{member.isAi && <CpuBadge/>}{member.id === me?.id && <span className="rounded-full bg-[#D4AF37]/15 px-2 py-0.5 text-[8px] font-black uppercase text-[#D4AF37]">You</span>}</div><div className="text-[10px] text-zinc-500">{rosterCount(member)} players · {standing ? `${standing.wins}-${standing.losses}${standing.ties ? `-${standing.ties}` : ''}` : '0-0'}</div></div><ChevronRight className="h-4 w-4 shrink-0 text-zinc-600"/></button>; })}</Panel>
        <Panel title="League Rules" sub={isCommissioner ? 'Tap settings to edit core fantasy rules' : 'League settings'} icon={<Settings className="h-5 w-5 text-[#D4AF37]"/>}><button onClick={() => setSettingsOpen(open => !open)} className="flex min-h-11 w-full items-center justify-between rounded-xl bg-black/25 px-3 text-xs font-black uppercase"><span>{settingsOpen ? 'Hide Settings' : 'Open Settings'}</span><ChevronRight className={`h-4 w-4 transition ${settingsOpen ? 'rotate-90' : ''}`}/></button>{settingsOpen && <div className="grid gap-2 pt-2 sm:grid-cols-3"><Rule label="Scoring" value={settings.scoringFormat || 'ppr'} disabled={!isCommissioner} options={[["ppr","Full PPR"],["half_ppr","Half PPR"],["standard","Standard"]]} onChange={value => updateLeagueSettings(league.id,{scoringFormat:value} as any)}/><Rule label="Waivers" value={waiverType} disabled={!isCommissioner} options={[["priority","Rolling Priority"],["faab","FAAB"]]} onChange={value => updateLeagueSettings(league.id,{waiverType:value} as any)}/><Rule label="IR Slots" value={String(settings.irSlots ?? 2)} disabled={!isCommissioner} options={[["0","0"],["1","1"],["2","2"],["3","3"]]} onChange={value => updateLeagueSettings(league.id,{irSlots:Number(value)} as any)}/></div>}</Panel>
      </div>}

      {tab === 'activity' && <div className="space-y-3">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#101318] p-1">{(['trades','moves','messages'] as ActivityView[]).map(view => <button key={view} onClick={() => setActivityView(view)} className={`min-h-11 rounded-lg text-[9px] font-black uppercase ${activityView === view ? 'bg-white text-black' : 'text-zinc-400'}`}>{view}{view === 'trades' && receivedTrades.length ? ` (${receivedTrades.length})` : ''}</button>)}</div>
        {activityView === 'trades' && <div className="space-y-3">
          <Panel title="Trade Market" sub="Browse a team in League, or build any 1–3 player package here" icon={<ArrowRightLeft className="h-5 w-5 text-[#D4AF37]"/>}>
            <div ref={tradeBuilderRef} className="scroll-mt-36 space-y-3">
              <select value={tradeTarget} onChange={event => { setTradeTarget(event.target.value); setTradeGet([]); setTradeGive([]); setTradeDrops([]); }} className="min-h-12 w-full rounded-xl bg-black/40 px-3 text-xs"><option value="">Choose a team</option>{league.members.filter(member => member.id !== me?.id).map(member => <option key={member.id} value={member.id}>{displayManagerName(member)}{member.isAi ? ' · CPU' : ''}</option>)}</select>
              {tradeTarget && <><TeamNeedStrip member={tradePartner} fantasyValue={fantasyValue}/><PackagePicker title="You send" players={roster} selected={tradeGive} onChange={setTradeGive} valueLabel={valueLabel}/><PackagePicker title="You receive" players={tradePartner?.roster || []} selected={tradeGet} onChange={setTradeGet} valueLabel={valueLabel}/>{requiredTradeDrops > 0 && <CutPicker title={`Your roster cut · choose ${requiredTradeDrops}`} players={roster.filter(player => !tradeGive.includes(player.id))} selected={tradeDrops} onChange={setTradeDrops} max={requiredTradeDrops} valueLabel={valueLabel}/>}<TradeSizeNote myCount={roster.length} give={tradeGive.length} get={tradeGet.length} partner={tradePartner}/><button disabled={busy || !tradeGive.length || !tradeGet.length || tradeDrops.length !== requiredTradeDrops} onClick={sendTrade} className="min-h-12 w-full rounded-xl bg-[#D4AF37] text-xs font-black uppercase text-black disabled:opacity-35">{tradePartner?.isAi ? 'Send Offer · CPU Decides Now' : 'Send Trade Offer'}</button></>}
            </div>
          </Panel>

          {receivedTrades.length > 0 && <Panel title="Offers To You" sub="Accept, reject or counter without leaving this screen" icon={<Bell className="h-5 w-5 text-[#D4AF37]"/>}>{receivedTrades.map(trade => { const proposer = league.members.find(member => member.id === trade.proposerMemberId); const neededDrops = Math.max(0, roster.length - trade.requestedPlayerIds.length + trade.offeredPlayerIds.length - 20); const selectedDrops = acceptDrops[trade.id] || []; return <div key={trade.id} className="space-y-3 rounded-xl border border-white/10 bg-black/25 p-3"><TradeSummary trade={trade} proposer={proposer} recipient={me} findPlayer={findPlayer} valueLabel={valueLabel}/>{neededDrops > 0 && <CutPicker title={`Accepting requires ${neededDrops} roster cut${neededDrops === 1 ? '' : 's'}`} players={roster.filter(player => !trade.requestedPlayerIds.includes(player.id))} selected={selectedDrops} onChange={ids => setAcceptDrops(prev => ({...prev,[trade.id]:ids}))} max={neededDrops} valueLabel={valueLabel}/>}<div className="grid grid-cols-3 gap-2"><button disabled={busy || selectedDrops.length !== neededDrops} onClick={() => actOnTrade(trade,'accepted')} className="min-h-10 rounded-lg bg-emerald-500/15 text-[9px] font-black uppercase text-emerald-300 disabled:opacity-35"><Check className="mr-1 inline h-3.5 w-3.5"/>Accept</button><button disabled={busy} onClick={() => openCounter(trade)} className="min-h-10 rounded-lg border border-white/10 text-[9px] font-black uppercase">Counter</button><button disabled={busy} onClick={() => actOnTrade(trade,'rejected')} className="min-h-10 rounded-lg bg-red-500/10 text-[9px] font-black uppercase text-red-300"><X className="mr-1 inline h-3.5 w-3.5"/>Reject</button></div></div>; })}</Panel>}

          {selectedCounter && <Panel title={`Counter ${displayManagerName(counterPartner)}`} sub="Change either side; unequal packages are allowed" icon={<ArrowRightLeft className="h-5 w-5 text-[#D4AF37]"/>}><PackagePicker title="You send" players={roster} selected={counterGive} onChange={setCounterGive} valueLabel={valueLabel}/><PackagePicker title="You request" players={counterPartner?.roster || []} selected={counterGet} onChange={setCounterGet} valueLabel={valueLabel}/>{requiredCounterDrops > 0 && <CutPicker title={`Your roster cut · choose ${requiredCounterDrops}`} players={roster.filter(player => !counterGive.includes(player.id))} selected={counterDrops} onChange={setCounterDrops} max={requiredCounterDrops} valueLabel={valueLabel}/>}<div className="grid grid-cols-[1fr_auto] gap-2"><button disabled={busy || !counterGive.length || !counterGet.length || counterDrops.length !== requiredCounterDrops} onClick={sendCounter} className="min-h-11 rounded-xl bg-[#D4AF37] text-[10px] font-black uppercase text-black disabled:opacity-35">Send Counter</button><button onClick={() => {setCounterTradeId('');setCounterGive([]);setCounterGet([]);setCounterDrops([]);}} className="min-h-11 rounded-xl border border-white/10 px-4 text-[10px] font-black uppercase">Cancel</button></div></Panel>}

          {sentTrades.length > 0 && <Panel title="Sent Offers" sub="Pending with the other owner" icon={<Clock3 className="h-5 w-5 text-zinc-500"/>}>{sentTrades.map(trade => <div key={trade.id} className="flex items-center justify-between gap-3 rounded-xl bg-black/25 p-3"><div className="min-w-0"><div className="truncate text-xs font-black">To {displayManagerName(league.members.find(member => member.id === trade.recipientMemberId))}</div><div className="text-[9px] text-zinc-500">{trade.offeredPlayerIds.length} for {trade.requestedPlayerIds.length}</div></div><button disabled={busy} onClick={() => actOnTrade(trade,'cancelled')} className="min-h-10 rounded-lg border border-red-500/20 px-3 text-[9px] font-black uppercase text-red-300">Cancel</button></div>)}</Panel>}

          {isCommissioner && reviewTrades.length > 0 && <Panel title="Commissioner Review" sub="Accepted trades waiting for a ruling" icon={<Gavel className="h-5 w-5 text-[#D4AF37]"/>}>{reviewTrades.map(trade => <div key={trade.id} className="space-y-2 rounded-xl bg-black/25 p-3"><TradeSummary trade={trade} proposer={league.members.find(member => member.id === trade.proposerMemberId)} recipient={league.members.find(member => member.id === trade.recipientMemberId)} findPlayer={findPlayer} valueLabel={valueLabel}/><div className="grid grid-cols-2 gap-2"><button disabled={busy} onClick={() => actOnTrade(trade,'approved')} className="min-h-10 rounded-lg bg-emerald-500/15 text-[9px] font-black uppercase text-emerald-300">Approve</button><button disabled={busy} onClick={() => actOnTrade(trade,'vetoed')} className="min-h-10 rounded-lg bg-red-500/10 text-[9px] font-black uppercase text-red-300">Veto</button></div></div>)}</Panel>}

          {!receivedTrades.length && !sentTrades.length && !selectedCounter && <Empty text="No pending offers. Open League, tap a team, then tap Trade for on any player."/>}
        </div>}
        {activityView === 'moves' && <Panel title="League Moves" sub="Adds, drops, waivers and completed trades" icon={<Activity className="h-5 w-5 text-[#D4AF37]"/>}>{transactions.length ? transactions.slice(0,40).map(item => <div key={item.id} className="border-b border-white/5 py-3 text-xs">{item.summary}</div>) : <Empty text="No league transactions yet."/>}</Panel>}
        {activityView === 'messages' && <Panel title="Messages" sub="League chat and commissioner announcements" icon={<MessageCircle className="h-5 w-5 text-[#D4AF37]"/>}><div className="flex gap-2"><input value={message} onChange={event => setMessage(event.target.value)} onKeyDown={event => { if(event.key === 'Enter' && message.trim()) void sendMessage(); }} placeholder="Message the league…" className="min-h-12 min-w-0 flex-1 rounded-xl bg-black/40 px-3 text-sm"/><button disabled={!message.trim() || busy} onClick={sendMessage} className="rounded-xl bg-[#D4AF37] px-4 text-xs font-black text-black disabled:opacity-35">Send</button></div><div className="max-h-[50dvh] space-y-2 overflow-y-auto">{messages.length ? messages.map(item => <div key={item.id} className="rounded-xl bg-black/30 p-3"><b className="text-[10px] uppercase text-[#D4AF37]">{item.memberName}</b><p className="mt-1 text-sm">{item.body}</p></div>) : <Empty text="No messages yet."/>}</div></Panel>}
      </div>}

      {tab === 'intel' && <div className="space-y-3">
        <div><div className="text-[9px] font-black uppercase tracking-[.2em] text-[#D4AF37]">Fantasy Intelligence</div><h2 className="mt-1 text-xl font-black uppercase">Awards & Roster Value</h2><p className="mt-1 text-xs text-zinc-500">Trade tools live under Activity. This page stays focused on fantasy results and value.</p></div>
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[#101318] p-1"><button onClick={() => setIntelView('awards')} className={`min-h-11 rounded-lg text-[9px] font-black uppercase ${intelView === 'awards' ? 'bg-white text-black' : 'text-zinc-400'}`}>Weekly Awards</button><button onClick={() => setIntelView('allbk')} className={`min-h-11 rounded-lg text-[9px] font-black uppercase ${intelView === 'allbk' ? 'bg-white text-black' : 'text-zinc-400'}`}>All-BK Team</button></div>
        {intelView === 'awards' && <Panel title="Weekly High Scores" sub="Only results the league actually has — no fake player stat awards" icon={<Medal className="h-5 w-5 text-[#D4AF37]"/>}>{weeklyAwards.length ? weeklyAwards.map(award => <div key={award.week} className="flex items-center justify-between gap-3 border-b border-white/5 py-3"><div><div className="text-[9px] font-black uppercase text-[#D4AF37]">Week {award.week}</div><div className="text-sm font-black">{displayManagerName(award.member)}</div></div><div className="text-lg font-black">{award.points.toFixed(1)}</div></div>) : <Empty text="Weekly awards unlock after games are played."/>}</Panel>}
        {intelView === 'allbk' && <Panel title={seasonHasGames ? 'All-BK Roster Value Team' : 'Preseason All-BK Team'} sub="QB · RB · WR · TE · FLEX · K · D/ST only, ranked by 2026 fantasy projection/value" icon={<Star className="h-5 w-5 text-[#D4AF37]"/>}>{allBkTeam.length ? <div className="divide-y divide-white/5">{allBkTeam.map((item,index) => <div key={`${item.label}-${item.player.id}-${index}`} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 py-3"><span className="text-[10px] font-black uppercase text-[#D4AF37]">{item.label}</span><div className="min-w-0"><div className="truncate text-sm font-black">{item.player.name}</div><div className="flex items-center gap-1.5 truncate text-[9px] text-zinc-500"><span>{displayManagerName(item.member)}</span>{item.member.isAi && <CpuBadge/>}</div></div><div className="max-w-28 text-right text-[9px] font-black text-zinc-400">{rankingFor(item.player) ? `${Number(rankingFor(item.player)?.projected_points_2026).toFixed(1)} proj` : 'BK value'}</div></div>)}</div> : <Empty text="The All-BK Team appears when drafted rosters are available."/>}</Panel>}
      </div>}

      {swapSlot && swapDefinition && <div className="fixed inset-0 z-[80] flex items-end bg-black/70 backdrop-blur-sm sm:items-center sm:justify-center" onMouseDown={event => { if(event.target === event.currentTarget) setSwapSlot(''); }}><div className="max-h-[78dvh] w-full overflow-hidden rounded-t-3xl border border-white/10 bg-[#0d1015] shadow-2xl sm:max-w-lg sm:rounded-3xl"><div className="flex items-center justify-between border-b border-white/10 p-4"><div><div className="text-[9px] font-black uppercase text-[#D4AF37]">{swapDefinition.label} starter</div><div className="text-lg font-black">Swap {currentSwapPlayer?.name || 'player'}</div></div><button aria-label="Close lineup swap" onClick={() => setSwapSlot('')} className="grid h-10 w-10 place-items-center rounded-full border border-white/10"><X className="h-4 w-4"/></button></div><div className="max-h-[62dvh] space-y-1 overflow-y-auto p-3">{swapOptions.map(player => <button key={player.id} onClick={() => { setStarters(prev => ({...prev,[swapSlot]:player.id})); setSwapSlot(''); }} className={`flex min-h-16 w-full items-center gap-3 rounded-xl p-2 text-left ${player.id === currentSwapPlayer?.id ? 'border border-[#D4AF37]/30 bg-[#D4AF37]/5' : 'bg-black/25'}`}><Portrait player={player}/><div className="min-w-0 flex-1"><div className="text-sm font-black">{player.name}</div><div className="text-[10px] text-zinc-500">{valueLabel(player)}</div></div>{player.id === currentSwapPlayer?.id ? <span className="text-[9px] font-black uppercase text-[#D4AF37]">Current</span> : <span className="text-[9px] font-black uppercase">Start</span>}</button>)}</div></div></div>}

      {selectedTeam && <TeamRosterDrawer member={selectedTeam} me={me} fantasyValue={fantasyValue} valueLabel={valueLabel} onClose={() => setSelectedTeamId('')} onTrade={(playerId) => startTrade(selectedTeam.id, playerId)}/>} 
    </section>
  );
};

const CpuBadge = () => <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wide text-sky-300">CPU</span>;

const Portrait = ({player}:{player?:Player}) => <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/5 bg-white/5">{player && playerPortraitUrl(player) ? <img src={playerPortraitUrl(player)} alt="" className="h-full w-full object-cover"/> : <div className="grid h-full w-full place-items-center text-xs font-black text-zinc-600">{player?.name.split(' ').map(piece=>piece[0]).slice(0,2).join('') || '—'}</div>}</div>;

const RosterSection = ({title,children}:{title:string;children:React.ReactNode}) => <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101318]"><div className="border-b border-white/10 px-3 py-2 text-[9px] font-black uppercase text-zinc-500">{title}</div>{children}</section>;

const LineupRow = ({label,player,valueLabel,onSwap}:{label:string;player?:Player;valueLabel:(player:Player)=>string;onSwap:()=>void}) => <div className="grid grid-cols-[38px_48px_minmax(0,1fr)_64px] items-center gap-2 border-b border-white/5 p-2"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#D4AF37] text-[9px] font-black text-black">{label}</span><Portrait player={player}/><div className="min-w-0"><div className="truncate text-xs font-black">{player?.name || 'Empty starter'}</div><div className="truncate text-[9px] text-zinc-500">{player ? valueLabel(player) : 'Choose an eligible player'}</div></div><button onClick={onSwap} className="min-h-10 rounded-lg border border-white/10 bg-black/30 px-2 text-[9px] font-black uppercase">Swap</button></div>;

const PlayerRow = ({label,player,valueLabel}:{label:string;player:Player;valueLabel:(player:Player)=>string}) => <div className="grid grid-cols-[38px_48px_minmax(0,1fr)] items-center gap-2 border-b border-white/5 p-2"><span className="grid h-9 w-9 place-items-center rounded-full border border-[#D4AF37]/30 text-[9px] font-black text-[#D4AF37]">{label}</span><Portrait player={player}/><div className="min-w-0"><div className="truncate text-xs font-black">{player.name}</div><div className="truncate text-[9px] text-zinc-500">{valueLabel(player)}</div></div></div>;

const Panel = ({title,sub,icon,children}:{title:string;sub:string;icon:React.ReactNode;children:React.ReactNode}) => <section className="space-y-3 rounded-2xl border border-white/10 bg-[#101318] p-4"><div className="flex items-start gap-3">{icon}<div className="min-w-0"><h3 className="text-sm font-black uppercase">{title}</h3><p className="mt-0.5 text-[10px] leading-4 text-zinc-500">{sub}</p></div></div>{children}</section>;
const Empty = ({text}:{text:string}) => <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs font-semibold leading-5 text-zinc-600">{text}</div>;
const Action = ({text,label,onClick}:{text:string;label:string;onClick?:()=>void}) => <button disabled={!onClick} onClick={onClick} className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-white/5 text-left text-xs disabled:cursor-default"><span>{text}</span><span className="shrink-0 text-[9px] font-black uppercase text-[#D4AF37]">{label}</span></button>;
const Record = ({label,value}:{label:string;value:string}) => <div className="rounded-xl border border-white/10 bg-[#101318] p-3"><div className="text-[8px] font-black uppercase tracking-wider text-zinc-600">{label}</div><div className="mt-1 truncate text-xs font-black">{value}</div></div>;
const Score = ({name,points,projection}:{name:string;points:number;projection?:number}) => <div className="min-w-0 text-center"><div className="truncate text-[10px] font-black uppercase text-zinc-400">{name}</div><div className="mt-1 text-3xl font-black">{Number(points || 0).toFixed(1)}</div>{projection !== undefined && projection > 0 && <div className="text-[9px] text-zinc-600">{Number(projection).toFixed(1)} proj</div>}</div>;

const Rule = ({label,value,disabled,options,onChange}:{label:string;value:string;disabled:boolean;options:string[][];onChange:(value:string)=>void}) => <label className="rounded-xl bg-black/25 p-3"><span className="mb-1 block text-[8px] font-black uppercase text-zinc-600">{label}</span><select disabled={disabled} value={value} onChange={event => onChange(event.target.value)} className="min-h-10 w-full bg-transparent text-xs font-bold disabled:text-zinc-500">{options.map(option => <option key={option[0]} value={option[0]}>{option[1]}</option>)}</select></label>;

const PackagePicker = ({title,players,selected,onChange,valueLabel}:{title:string;players:Player[];selected:string[];onChange:(ids:string[])=>void;valueLabel:(player:Player)=>string}) => <fieldset className="rounded-xl border border-white/10 p-2"><legend className="px-1 text-[9px] font-black uppercase text-zinc-500">{title} · {selected.length}/3</legend><div className="max-h-56 space-y-1 overflow-y-auto">{[...players].sort((a,b)=>selected.includes(a.id)===selected.includes(b.id)?0:selected.includes(a.id)?-1:1).map(player => { const active=selected.includes(player.id); return <button type="button" key={player.id} aria-pressed={active} onClick={() => onChange(active ? selected.filter(id => id !== player.id) : selected.length < 3 ? [...selected,player.id] : selected)} className={`flex min-h-13 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${active ? 'bg-[#D4AF37] text-black' : 'bg-black/30'}`}><div className="min-w-0"><div className="truncate text-xs font-black"><span className="mr-1 text-[9px] uppercase">{player.position}</span>{player.name}</div><div className={`truncate text-[8px] ${active ? 'text-black/60' : 'text-zinc-600'}`}>{valueLabel(player)}</div></div><b className="shrink-0 text-[9px] uppercase">{active ? '✓' : 'Select'}</b></button>; })}</div></fieldset>;

const CutPicker = ({title,players,selected,onChange,max,valueLabel}:{title:string;players:Player[];selected:string[];onChange:(ids:string[])=>void;max:number;valueLabel:(player:Player)=>string}) => <fieldset className="rounded-xl border border-amber-400/20 bg-amber-400/[.04] p-2"><legend className="px-1 text-[9px] font-black uppercase text-amber-300">{title} · {selected.length}/{max}</legend><div className="max-h-44 space-y-1 overflow-y-auto">{[...players].sort((a,b)=>selected.includes(a.id)===selected.includes(b.id)?0:selected.includes(a.id)?-1:1).map(player => { const active=selected.includes(player.id); return <button type="button" key={player.id} aria-pressed={active} onClick={() => onChange(active ? selected.filter(id => id !== player.id) : selected.length < max ? [...selected,player.id] : selected)} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${active ? 'bg-amber-300 text-black' : 'bg-black/30'}`}><div className="min-w-0"><div className="truncate text-xs font-black">{player.name} · {player.position}</div><div className={`truncate text-[8px] ${active ? 'text-black/60' : 'text-zinc-600'}`}>{valueLabel(player)}</div></div><b className="shrink-0 text-[9px] uppercase">{active ? 'Cut ✓' : 'Cut'}</b></button>; })}</div></fieldset>;

const TradeSizeNote = ({myCount,give,get,partner}:{myCount:number;give:number;get:number;partner?:LeagueMember}) => <div className="grid grid-cols-2 gap-2 text-center"><div className="rounded-xl bg-black/25 p-2"><div className="text-[8px] font-black uppercase text-zinc-600">Your roster after deal</div><div className="mt-1 text-sm font-black">{myCount - give + get} before cuts</div></div><div className="rounded-xl bg-black/25 p-2"><div className="text-[8px] font-black uppercase text-zinc-600">Other team</div><div className="mt-1 text-sm font-black">{Math.max(0,rosterCount(partner) - get + give)} before cuts</div></div></div>;

const TradeSummary = ({trade,proposer,recipient,findPlayer,valueLabel}:{trade:TradeOffer;proposer?:LeagueMember;recipient?:LeagueMember;findPlayer:(id:string)=>Player|undefined;valueLabel:(player:Player)=>string}) => <div><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase"><span>{displayManagerName(proposer)}</span><span className="text-zinc-600">→</span><span>{displayManagerName(recipient)}</span></div><div className="grid gap-2 sm:grid-cols-2"><TradeSide label={`${displayManagerName(proposer)} sends`} ids={trade.offeredPlayerIds} findPlayer={findPlayer} valueLabel={valueLabel}/><TradeSide label={`${displayManagerName(recipient)} sends`} ids={trade.requestedPlayerIds} findPlayer={findPlayer} valueLabel={valueLabel}/></div></div>;
const TradeSide = ({label,ids,findPlayer,valueLabel}:{label:string;ids:string[];findPlayer:(id:string)=>Player|undefined;valueLabel:(player:Player)=>string}) => <div className="rounded-xl bg-black/25 p-2"><div className="mb-1 text-[8px] font-black uppercase text-zinc-600">{label}</div>{ids.map(id => { const player=findPlayer(id); return <div key={id} className="py-1"><div className="truncate text-xs font-black">{player?.name || 'Player unavailable'}</div>{player && <div className="truncate text-[8px] text-zinc-600">{valueLabel(player)}</div>}</div>; })}</div>;

const TeamNeedStrip = ({member,fantasyValue}:{member?:LeagueMember;fantasyValue:(player:Player)=>number}) => {
  if(!member) return null;
  const roster=member.roster||[];
  const targets:Record<string,number>={QB:2,RB:4,WR:5,TE:2,K:1,DST:1};
  const counts=Object.fromEntries(Object.keys(targets).map(position=>[position,roster.filter(player=>player.position===position).length]));
  const needs=Object.keys(targets).filter(position=>counts[position]<targets[position]).slice(0,3);
  const groups=Object.keys(targets).map(position=>({position,value:roster.filter(player=>player.position===position).sort((a,b)=>fantasyValue(b)-fantasyValue(a)).slice(0,2).reduce((sum,player)=>sum+fantasyValue(player),0)})).sort((a,b)=>b.value-a.value);
  const strengths=groups.filter(group=>group.value>0).slice(0,3).map(group=>group.position);
  return <div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-red-500/[.06] p-2"><div className="text-[8px] font-black uppercase text-red-300">Roster needs</div><div className="mt-1 text-[10px] font-bold">{needs.length ? needs.join(' · ') : 'No obvious depth hole'}</div></div><div className="rounded-xl bg-emerald-500/[.06] p-2"><div className="text-[8px] font-black uppercase text-emerald-300">Strongest rooms</div><div className="mt-1 text-[10px] font-bold">{strengths.join(' · ') || 'Building'}</div></div></div>;
};

const StartSeasonCard = ({league,busy,onStart}:{league:League;busy:boolean;onStart:()=>void}) => <section className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/[.06] p-4"><div className="flex items-start gap-3"><Play className="mt-0.5 h-5 w-5 shrink-0 text-[#D4AF37]"/><div className="min-w-0 flex-1"><div className="text-xs font-black uppercase text-[#D4AF37]">Draft complete · ready for football</div><p className="mt-1 text-xs leading-5 text-zinc-400">All drafted rosters are saved. Start the {league.settings?.seasonGames || 17}-game season when you are ready.</p></div></div><button disabled={busy} onClick={onStart} className="mt-3 min-h-12 w-full rounded-xl bg-[#D4AF37] text-xs font-black uppercase text-black disabled:opacity-40"><Play className="mr-2 inline h-4 w-4"/>Start {league.settings?.seasonGames || 17}-Game Season</button></section>;

const TeamRosterDrawer = ({member,me,fantasyValue,valueLabel,onClose,onTrade}:{member:LeagueMember;me?:LeagueMember;fantasyValue:(player:Player)=>number;valueLabel:(player:Player)=>string;onClose:()=>void;onTrade:(playerId:string)=>void}) => {
  const roster=(member.roster||[]).filter(player=>STANDARD_POSITIONS.has(player.position)).sort((a,b)=>fantasyValue(b)-fantasyValue(a));
  return <div className="fixed inset-0 z-[75] flex items-end bg-black/70 backdrop-blur-sm sm:items-center sm:justify-center" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><div className="max-h-[88dvh] w-full overflow-hidden rounded-t-3xl border border-white/10 bg-[#0d1015] shadow-2xl sm:max-w-2xl sm:rounded-3xl"><div className="border-b border-white/10 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-xl font-black uppercase">{displayManagerName(member)}</h2>{member.isAi&&<CpuBadge/>}</div><p className="mt-1 text-xs text-zinc-500">{roster.length} fantasy players · tap any player to build a trade</p></div><button aria-label="Close roster" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10"><X className="h-4 w-4"/></button></div><div className="mt-3"><TeamNeedStrip member={member} fantasyValue={fantasyValue}/></div></div><div className="max-h-[68dvh] overflow-y-auto p-3"><div className="space-y-1">{roster.map(player=><div key={player.id} className="flex min-h-16 items-center gap-3 rounded-xl bg-black/25 p-2"><Portrait player={player}/><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[9px] font-black uppercase text-[#D4AF37]">{player.position}</span><span className="truncate text-sm font-black">{player.name}</span></div><div className="truncate text-[9px] text-zinc-500">{valueLabel(player)}</div></div>{member.id !== me?.id && <button onClick={()=>onTrade(player.id)} className="min-h-10 shrink-0 rounded-lg bg-[#D4AF37] px-3 text-[8px] font-black uppercase text-black">Trade for</button>}</div>)}</div></div></div></div>;
};
