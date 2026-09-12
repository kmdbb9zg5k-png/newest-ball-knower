import {SoloPlayerLink} from './solo/SoloPresentation';
import React, { useMemo, useState } from 'react';
import { Bell, ChevronDown, ChevronUp, CircleAlert, Sparkles, TrendingUp, Users } from 'lucide-react';
import type { FranchiseInteractionState, UpgradeFocus } from './franchiseInteractions';
import type { Player } from './types';

type Props = {
  state: FranchiseInteractionState;
  roster: Player[];
  onRespond: (choiceId: string) => void;
  onUpgrade: (playerId: string, focus: UpgradeFocus) => void;
  onReadAll: () => void;
};

const KIND_COLOR = {
  story: 'text-sky-300', morale: 'text-amber-300', breakout: 'text-emerald-300', injury: 'text-red-300', upgrade: 'text-violet-300',
} as const;

export const FranchiseInteractionCenter: React.FC<Props> = ({ state, roster, onRespond, onUpgrade, onReadAll }) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUpgrades, setShowUpgrades] = useState(false);
  const playerById = useMemo(() => new Map(roster.map(player => [player.id, player])), [roster]);
  const unread = state.notifications.filter(notification => !notification.read).length;
  const upgrades = Object.values(state.development)
    .filter(item => item.upgradePoints > 0 && (playerById.get(item.playerId)?.ovr ?? 99) < 99)
    .sort((first, second) => second.upgradePoints - first.upgradePoints || (playerById.get(second.playerId)?.ovr ?? 0) - (playerById.get(first.playerId)?.ovr ?? 0));
  const moraleWatch = Object.values(state.development)
    .filter(item => playerById.has(item.playerId))
    .sort((first, second) => first.morale - second.morale)
    .slice(0, 3);
  const scenario = state.pendingScenario;
  const scenarioPlayer = scenario ? playerById.get(scenario.playerId) : null;

  const openNotifications = () => {
    const next = !showNotifications;
    setShowNotifications(next);
    if (next && unread) onReadAll();
  };

  return <section aria-label="Franchise interactions" className="mb-4 space-y-3">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <button type="button" onClick={openNotifications} aria-expanded={showNotifications} className="flex min-h-12 items-center justify-between rounded-xl border border-white/10 bg-[#111] px-3 text-left">
        <span className="flex items-center gap-2 text-[10px] font-black uppercase"><Bell className="h-4 w-4 text-[var(--bk-team-accent)]" />Inbox</span>
        <span className="flex items-center gap-1">{unread ? <b className="grid min-h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[9px]">{unread}</b> : null}{showNotifications ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
      </button>
      <button type="button" onClick={() => setShowUpgrades(value => !value)} aria-expanded={showUpgrades} className="flex min-h-12 items-center justify-between rounded-xl border border-white/10 bg-[#111] px-3 text-left">
        <span className="flex items-center gap-2 text-[10px] font-black uppercase"><TrendingUp className="h-4 w-4 text-violet-300" />Upgrades</span><b className="text-violet-300">{upgrades.reduce((sum, item) => sum + item.upgradePoints, 0)}</b>
      </button>
      <div className="col-span-2 flex min-h-12 items-center justify-between rounded-xl border border-white/10 bg-[#111] px-3 sm:col-span-1"><span className="flex items-center gap-2 text-[10px] font-black uppercase"><Users className="h-4 w-4 text-amber-300" />Morale</span><b className="text-xs">{moraleWatch[0] ? `${playerById.get(moraleWatch[0].playerId)?.name.split(' ').at(-1)} ${moraleWatch[0].morale}` : '—'}</b></div>
    </div>

    {showNotifications ? <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-[#0d1015] p-3" aria-label="Team notifications">
      {state.notifications.length ? state.notifications.slice(0, 20).map(notification => <article key={notification.id} className="rounded-xl border border-white/5 bg-white/[.03] p-3"><div className="flex justify-between gap-3"><b className={`text-xs ${KIND_COLOR[notification.kind]}`}>{notification.title}</b><span className="text-[9px] font-black text-zinc-600">WEEK {notification.week || 'OFFSEASON'}</span></div><p className="mt-1 text-xs leading-5 text-zinc-400">{notification.body}</p></article>) : <p className="p-3 text-sm text-zinc-500">No team notifications yet.</p>}
    </div> : null}

    {showUpgrades ? <div className="rounded-2xl border border-violet-400/20 bg-violet-400/[.04] p-3"><div className="mb-2 flex items-center gap-2 text-xs font-black uppercase text-violet-300"><Sparkles className="h-4 w-4" />Player upgrades</div>{upgrades.length ? <div className="space-y-2">{upgrades.slice(0, 6).map(development => { const player = playerById.get(development.playerId)!; return <div key={player.id} className="rounded-xl border border-white/10 bg-black/25 p-3"><div className="flex items-center justify-between gap-2"><div className="min-w-0"><div className="truncate text-sm font-black"><SoloPlayerLink player={player} development={development}/></div><div className="text-[10px] text-zinc-500">{player.position} · {player.ovr} OVR · {development.xp}/100 XP</div></div><b className="text-violet-300">{development.upgradePoints} PT</b></div><div className="mt-2 grid grid-cols-3 gap-1">{([['physical', 'Physical'], ['awareness', 'Awareness'], ['position', 'Position']] as Array<[UpgradeFocus, string]>).map(([focus, label]) => <button key={focus} type="button" onClick={() => onUpgrade(player.id, focus)} className="min-h-10 rounded-lg border border-violet-300/20 bg-violet-300/[.06] px-1 text-[8px] font-black uppercase text-violet-200">+1 {label}</button>)}</div></div>; })}</div> : <p className="text-xs leading-5 text-zinc-500">Players earn XP from weekly production, promises and breakout performances. Every 100 XP becomes an upgrade point.</p>}</div> : null}

    {scenario && scenarioPlayer ? <article className="overflow-hidden rounded-2xl border border-[var(--bk-team-accent)]/35 bg-[#10151d] shadow-xl">
      <div className="border-b border-white/10 bg-[var(--bk-team-accent)]/10 p-4"><div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[.18em] text-[var(--bk-team-accent)]"><CircleAlert className="h-4 w-4" />Decision required · Week {scenario.week}</div><h3 className="mt-2 text-xl font-black uppercase">{scenario.title}</h3><p className="mt-1 text-sm leading-5 text-zinc-300">{scenario.message}</p><div className="mt-2 text-[10px] font-black uppercase text-zinc-500">{scenarioPlayer.position} · {scenarioPlayer.ovr} OVR · Morale {state.development[scenarioPlayer.id]?.morale ?? 75}</div></div>
      <div className="grid gap-2 p-3 sm:grid-cols-3">{scenario.choices.map(choice => <button key={choice.id} type="button" onClick={() => onRespond(choice.id)} className="min-h-20 rounded-xl border border-white/10 bg-black/25 p-3 text-left active:scale-[.99]"><div className="text-xs font-black uppercase text-white">{choice.label}</div><div className="mt-1 text-[10px] leading-4 text-zinc-500">{choice.detail}</div></button>)}</div>
    </article> : null}
  </section>;
};
