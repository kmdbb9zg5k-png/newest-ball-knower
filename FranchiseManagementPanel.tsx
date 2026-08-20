import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowRightLeft, ClipboardList, Search, UserMinus, UserPlus, Users } from 'lucide-react';
import { playerPortraitUrl } from './playerPortraits';
import {
  depthGroups,
  franchiseCapLeft,
  franchiseCapUsed,
  franchiseFreeAgents,
  franchiseRoster,
  FranchiseManagementState,
  moveDepthPlayer,
  playerById,
  proposeTrade,
  releasePlayer,
  signFreeAgent,
} from './franchiseManagementEngine';
import { getDraftPositionGroup } from './rosterRules';
import { TEAM_THEMES } from './teamTheme';
import { Player } from './types';

type ManagementTab = 'depth' | 'free-agents' | 'trades' | 'transactions';

type Props = {
  state: FranchiseManagementState;
  onChange: (state: FranchiseManagementState) => void;
  onMessage: (message: string) => void;
};

const money = (value: number) => `$${(Number(value) || 0).toFixed(1)}M`;

export const FranchiseManagementPanel: React.FC<Props> = ({ state, onChange, onMessage }) => {
  const [tab, setTab] = useState<ManagementTab>('depth');
  const [query, setQuery] = useState('');
  const [tradeTeam, setTradeTeam] = useState(() => TEAM_THEMES.find(team => team.abbr !== state.teamAbbr)?.abbr ?? '');
  const [outgoingId, setOutgoingId] = useState('');
  const [incomingId, setIncomingId] = useState('');
  const roster = useMemo(() => franchiseRoster(state), [state]);
  const capUsed = useMemo(() => franchiseCapUsed(state), [state]);
  const capLeft = useMemo(() => franchiseCapLeft(state), [state]);

  const freeAgents = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return franchiseFreeAgents(state)
      .filter(player => !lower || `${player.name} ${player.position} ${player.team}`.toLowerCase().includes(lower))
      .slice(0, 80);
  }, [state, query]);

  const targetPlayers = useMemo(() => {
    const ids = state.cpuRosters[tradeTeam] ?? [];
    return ids
      .map(id => playerById(id))
      .filter((player): player is Player => Boolean(player))
      .sort((first, second) => second.ovr - first.ovr);
  }, [state, tradeTeam]);

  const apply = (result: { state: FranchiseManagementState; message: string }) => {
    onChange(result.state);
    onMessage(result.message);
  };

  const submitTrade = () => {
    if (!outgoingId || !incomingId || !tradeTeam) return onMessage('Choose one of your players and one player to target.');
    const result = proposeTrade(state, outgoingId, tradeTeam, incomingId);
    onChange(result.state);
    onMessage(result.message);
    if (result.decision === 'accepted') {
      setOutgoingId('');
      setIncomingId('');
    }
  };

  return (
    <div className="px-4 pb-12 pt-4 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-3 gap-2">
          <Metric label="ROSTER" value={`${roster.length}/24`} />
          <Metric label="CAP USED" value={money(capUsed)} />
          <Metric label="CAP LEFT" value={money(capLeft)} />
        </div>

        <div className="mt-4 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-2">
            <TabButton active={tab === 'depth'} onClick={() => setTab('depth')} icon={<Users size={16} />} label="DEPTH CHART" />
            <TabButton active={tab === 'free-agents'} onClick={() => setTab('free-agents')} icon={<UserPlus size={16} />} label="FREE AGENTS" />
            <TabButton active={tab === 'trades'} onClick={() => setTab('trades')} icon={<ArrowRightLeft size={16} />} label="TRADES" />
            <TabButton active={tab === 'transactions'} onClick={() => setTab('transactions')} icon={<ClipboardList size={16} />} label="TRANSACTIONS" />
          </div>
        </div>

        {tab === 'depth' ? (
          <div className="mt-4 space-y-4">
            {depthGroups(state).map(({ group, players }) => (
              <section key={group} className="rounded-[2rem] border border-white/10 bg-[#10151d] p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-black">{group}</h3><span className="text-[10px] font-black tracking-widest text-zinc-500">DEPTH ORDER</span></div>
                <div className="space-y-2">
                  {players.map((player, index) => (
                    <div key={player.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-3">
                      <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black ${index === 0 ? 'bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]' : 'bg-white/5 text-zinc-400'}`}>{index + 1}</div>
                      <PlayerThumb player={player} />
                      <div className="min-w-0 flex-1"><div className="truncate font-black">{player.name}</div><div className="text-[10px] font-bold text-zinc-500">{player.position} • {player.ovr} OVR • {money(player.salary)}</div></div>
                      <div className="flex gap-1">
                        <button type="button" disabled={index === 0} onClick={() => onChange(moveDepthPlayer(state, player.id, -1))} aria-label={`Move ${player.name} up`} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 disabled:opacity-25"><ArrowUp size={16} /></button>
                        <button type="button" disabled={index === players.length - 1} onClick={() => onChange(moveDepthPlayer(state, player.id, 1))} aria-label={`Move ${player.name} down`} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 disabled:opacity-25"><ArrowDown size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}

        {tab === 'free-agents' ? (
          <div className="mt-4">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-[#111] px-4"><Search size={17} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search free agents…" aria-label="Search free agents" className="min-w-0 flex-1 bg-transparent py-3 outline-none" /></div>
            <div className="mt-3 space-y-2">
              {freeAgents.length ? freeAgents.map(player => (
                <PlayerRow key={player.id} player={player} action={
                  <button type="button" onClick={() => apply(signFreeAgent(state, player.id))} className="min-h-11 rounded-xl bg-[var(--bk-team-accent)] px-3 text-[10px] font-black text-[var(--bk-on-accent)]"><UserPlus className="mr-1 inline" size={14} /> SIGN</button>
                } />
              )) : <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-zinc-500">No free agents match that search.</div>}
            </div>
            <div className="mt-6 rounded-[2rem] border border-white/10 bg-[#10151d] p-4">
              <div className="text-xs font-black tracking-widest text-zinc-500">ROSTER MOVES</div>
              <p className="mt-1 text-xs text-zinc-500">Sign up to 24 players, then release players to reshape the roster. The season simulation uses your managed roster.</p>
              <div className="mt-3 space-y-2">
                {roster.map(player => <PlayerRow key={player.id} player={player} action={<button type="button" onClick={() => apply(releasePlayer(state, player.id))} className="min-h-11 rounded-xl border border-red-400/25 px-3 text-[10px] font-black text-red-300"><UserMinus className="mr-1 inline" size={14} /> RELEASE</button>} />)}
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'trades' ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-white/10 bg-[#10151d] p-5">
              <div className="text-[10px] font-black tracking-[.2em] text-[var(--bk-team-accent)]">YOUR OFFER</div>
              <h3 className="mt-1 text-2xl font-black">CHOOSE A PLAYER</h3>
              <div className="mt-4 space-y-2">{roster.slice().sort((a,b)=>b.ovr-a.ovr).map(player => <SelectPlayer key={player.id} player={player} selected={outgoingId === player.id} onClick={() => setOutgoingId(player.id)} />)}</div>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-[#10151d] p-5">
              <div className="text-[10px] font-black tracking-[.2em] text-[var(--bk-team-accent)]">TRADE TARGET</div>
              <select value={tradeTeam} onChange={event => { setTradeTeam(event.target.value); setIncomingId(''); }} className="mt-3 w-full rounded-xl border border-white/10 bg-[#151515] p-3 font-black">
                {TEAM_THEMES.filter(team => team.abbr !== state.teamAbbr).map(team => <option key={team.abbr} value={team.abbr}>{team.name}</option>)}
              </select>
              <div className="mt-3 max-h-[56dvh] space-y-2 overflow-y-auto overscroll-contain">{targetPlayers.map(player => <SelectPlayer key={player.id} player={player} selected={incomingId === player.id} onClick={() => setIncomingId(player.id)} />)}</div>
              <button type="button" onClick={submitTrade} disabled={!outgoingId || !incomingId} className="mt-4 w-full rounded-2xl bg-[var(--bk-team-accent)] py-4 font-black text-[var(--bk-on-accent)] disabled:opacity-35"><ArrowRightLeft className="mr-2 inline" /> PROPOSE TRADE</button>
              <p className="mt-2 text-center text-[10px] font-bold text-zinc-500">CPU teams compare OVR, age and contract value, then accept, counter or reject.</p>
            </div>
          </div>
        ) : null}

        {tab === 'transactions' ? (
          <div className="mt-4 rounded-[2rem] border border-white/10 bg-[#10151d] p-5">
            <h3 className="text-2xl font-black">TRANSACTION LOG</h3>
            <div className="mt-4 space-y-2">
              {state.transactions.length ? state.transactions.map(item => <div key={item.id} className="rounded-2xl border border-white/8 bg-black/20 p-4"><div className="text-[9px] font-black tracking-widest text-[var(--bk-team-accent)]">{item.type}</div><div className="mt-1 text-sm font-bold">{item.text}</div></div>) : <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-zinc-500">No transactions yet.</div>}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => <div className="rounded-2xl border border-white/10 bg-[#10151d] p-3"><div className="text-[8px] font-black tracking-widest text-zinc-500">{label}</div><div className="mt-1 text-lg font-black">{value}</div></div>;

const TabButton = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => <button type="button" onClick={onClick} className={`flex min-h-11 items-center gap-2 rounded-xl border px-4 text-xs font-black ${active ? 'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/10 text-[var(--bk-team-accent)]' : 'border-white/10 bg-[#111] text-zinc-400'}`}>{icon}{label}</button>;

const PlayerThumb = ({ player }: { player: Player }) => { const portrait = playerPortraitUrl(player); return <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-white/5">{portrait ? <img src={portrait} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}</div>; };

const PlayerRow: React.FC<{ player: Player; action: React.ReactNode }> = ({ player, action }) => <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-[#111] p-3"><PlayerThumb player={player}/><div className="min-w-0 flex-1"><div className="truncate font-black">{player.name}</div><div className="text-[10px] font-bold text-zinc-500">{player.position} • {getDraftPositionGroup(player)} • {player.ovr} OVR • {money(player.salary)}</div></div>{action}</div>;

const SelectPlayer: React.FC<{ player: Player; selected: boolean; onClick: () => void }> = ({ player, selected, onClick }) => <button type="button" aria-pressed={selected} onClick={onClick} className={`flex w-full min-w-0 items-center gap-3 rounded-2xl border p-3 text-left ${selected ? 'border-[var(--bk-team-accent)] bg-[var(--bk-team-accent)]/10' : 'border-white/10 bg-black/20'}`}><PlayerThumb player={player}/><div className="min-w-0 flex-1"><div className="truncate font-black">{player.name}</div><div className="text-[10px] font-bold text-zinc-500">{player.position} • {player.ovr} OVR • {money(player.salary)}</div></div></button>;
