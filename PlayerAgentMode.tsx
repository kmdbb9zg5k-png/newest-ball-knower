import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  ChevronRight,
  FastForward,
  Handshake,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { PLAYERS_DATABASE } from './players';
import { Player } from './types';
import { playerPortraitUrl } from './playerPortraits';

const SAVE_KEY = 'ballknower_player_agent_v4';
const LEGACY_SAVE_KEYS = ['ballknower_player_agent_v3', 'ballknower_player_agent_v2', 'ballknower_player_agent_v1'];
const RECRUIT_COOLDOWN_DAYS = 7;
const STARTING_CLIENT_CAP = 3;
const TRADE_DEADLINE_WEEK = 9;
const REGULAR_SEASON_WEEKS = 18;

type Pitch = 'money' | 'trust' | 'brand' | 'opportunity';
type AgentProfile = { name: string; age: number; location: string };
type FutureDeal = { totalM: number; annualM: number; guaranteedM: number; years: number; negotiatedAt: string };
type NegotiationState = {
  playerId: string;
  round: number;
  years: number;
  annualM: number;
  guaranteedPct: number;
  gmPatience: number;
  message: string;
};
type TradeRequest = { requestedWeek: number; requestedAt: string; reason: string; status: 'open' | 'resolved' | 'denied' };
type Client = {
  playerId: string;
  trust: number;
  futureDeal?: FutureDeal;
  signedAt: string;
  tradeRequest?: TradeRequest;
};
type SeasonPhase = 'preseason' | 'regular' | 'postseason' | 'offseason';
type AgencyState = {
  profile?: AgentProfile;
  reputation: number;
  negotiation: number;
  brandPower: number;
  clientCare: number;
  clients: Client[];
  wins: number;
  losses: number;
  recruitCooldowns: Record<string, string>;
  storyStarted: boolean;
  seasonYear: number;
  seasonWeek: number;
  phase: SeasonPhase;
  simulatedDate: string;
  timeline: string[];
};
type RecruitState = {
  playerId: string;
  interest: number;
  round: number;
  used: Pitch[];
  rivalPressure: number;
  message: string;
  playerReply: string;
  failed?: boolean;
};

const MAJOR_CITIES = [
  'Atlanta, GA','Austin, TX','Baltimore, MD','Boston, MA','Buffalo, NY','Charlotte, NC','Chicago, IL','Cincinnati, OH','Cleveland, OH','Columbus, OH','Dallas, TX','Denver, CO','Detroit, MI','Fort Worth, TX','Houston, TX','Indianapolis, IN','Jacksonville, FL','Kansas City, MO','Las Vegas, NV','Los Angeles, CA','Louisville, KY','Memphis, TN','Miami, FL','Milwaukee, WI','Minneapolis, MN','Nashville, TN','New Orleans, LA','New York, NY','Oklahoma City, OK','Orlando, FL','Philadelphia, PA','Phoenix, AZ','Pittsburgh, PA','Portland, OR','Raleigh, NC','Sacramento, CA','Salt Lake City, UT','San Antonio, TX','San Diego, CA','San Francisco, CA','San Jose, CA','Seattle, WA','St. Louis, MO','Tampa, FL','Washington, DC','Allentown, PA','Birmingham, AL','Boise, ID','Charleston, SC','Des Moines, IA','Hartford, CT','Honolulu, HI','Little Rock, AR','Omaha, NE','Providence, RI','Richmond, VA','Rochester, NY','Tucson, AZ','Virginia Beach, VA','Wichita, KS'
];

const fallbackAgency = (): AgencyState => ({
  reputation: 20,
  negotiation: 32,
  brandPower: 24,
  clientCare: 48,
  clients: [],
  wins: 0,
  losses: 0,
  recruitCooldowns: {},
  storyStarted: false,
  seasonYear: 2026,
  seasonWeek: 0,
  phase: 'preseason',
  simulatedDate: '2026-09-03',
  timeline: ['Your agency opened its doors. The league has no idea who you are yet.'],
});

const restore = (): AgencyState => {
  try {
    let raw = localStorage.getItem(SAVE_KEY);
    if (!raw) {
      for (const key of LEGACY_SAVE_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
    if (!raw) return fallbackAgency();
    const v = JSON.parse(raw);
    return {
      ...fallbackAgency(),
      ...v,
      profile: v?.profile,
      clients: Array.isArray(v?.clients)
        ? v.clients.map((c: any) => ({
            playerId: String(c.playerId),
            trust: Number(c.trust) || 72,
            futureDeal: c.futureDeal,
            signedAt: c.signedAt || new Date().toISOString(),
            tradeRequest: c.tradeRequest,
          }))
        : [],
      recruitCooldowns: v?.recruitCooldowns && typeof v.recruitCooldowns === 'object' ? v.recruitCooldowns : {},
      storyStarted: Boolean(v?.profile),
      timeline: Array.isArray(v?.timeline) ? v.timeline : fallbackAgency().timeline,
    };
  } catch {
    return fallbackAgency();
  }
};

const persist = (state: AgencyState) => {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {}
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const moneyM = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 1 }).format(n * 1_000_000);
const prettyDate = (iso: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${iso}T12:00:00`));
const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
const cooldownDaysLeft = (until?: string) => {
  if (!until) return 0;
  return Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 86400000));
};

const marketProjection = (p: Player) => {
  const age = p.age ?? 27;
  const ageFactor = age <= 24 ? 1.14 : age <= 27 ? 1.04 : age <= 30 ? .92 : .72;
  const premium = p.position === 'QB' ? 1.35 : ['WR','EDGE','OT','LT','RT','CB'].includes(p.position) ? 1.12 : 1;
  return Math.max(1.1, p.salary * 1.08, (p.ovr - 60) * .62 * ageFactor * premium);
};
const salaryRange = (p: Player) => {
  const mid = marketProjection(p);
  return [Math.max(1, mid * .82), mid * 1.18] as const;
};
const maxUnlockedOverall = (reputation: number) => reputation < 45 ? 75 : reputation < 60 ? 80 : reputation < 75 ? 85 : reputation < 90 ? 90 : 99;
const signingDifficulty = (p: Player) => clamp(Math.round(36 + (p.ovr - 68) * 2.1 + Math.max(0, p.salary - 8) * .55), 34, 92);
const pitchLabel: Record<Pitch, string> = {
  money: 'I can get you paid',
  trust: 'I will put you first',
  brand: 'I can grow your name',
  opportunity: 'I see what other people miss',
};
const playerReplyForPitch = (pitch: Pitch) => {
  if (pitch === 'money') return '“Everybody says they can get me paid. Show me why you are different.”';
  if (pitch === 'trust') return '“My last agent talked a lot. I need somebody who actually picks up the phone.”';
  if (pitch === 'brand') return '“I am not a superstar yet. If you can help people notice my game, I am listening.”';
  return '“That is what I needed to hear. I know I can be more than what my current role says.”';
};
const pitchImpact = (pitch: Pitch, p: Player, agency: AgencyState) => {
  const age = p.age ?? 27;
  if (pitch === 'money') return 8 + agency.negotiation * .10 + (p.salary < marketProjection(p) * .72 ? 5 : 0);
  if (pitch === 'trust') return 8 + agency.clientCare * .11 + (age <= 25 ? 3 : 0);
  if (pitch === 'brand') return 6 + agency.brandPower * .10;
  return 7 + agency.reputation * .09 + (p.ovr <= 72 ? 4 : 0);
};

const tradeReasons = (p: Player) => [
  `${p.name} is frustrated with his role and wants a bigger opportunity.`,
  `${p.name} believes the current offense/defense is hurting his value before his next contract.`,
  `${p.name} wants a fresh start with a contender before the deadline.`,
  `${p.name} is unhappy with how the team has handled his playing time and future.`,
  `${p.name} thinks a new team can put him in a better position for his next deal.`,
];

export const PlayerAgentMode: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [agency, setAgency] = useState<AgencyState>(restore);
  const [introStep, setIntroStep] = useState(0);
  const [draftName, setDraftName] = useState(agency.profile?.name || '');
  const [draftAge, setDraftAge] = useState(String(agency.profile?.age || 22));
  const [draftLocation, setDraftLocation] = useState(agency.profile?.location || '');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recruit, setRecruit] = useState<RecruitState | null>(null);
  const [negotiationRoom, setNegotiationRoom] = useState<NegotiationState | null>(null);
  const [filter, setFilter] = useState('ALL');

  const clients = useMemo(
    () => agency.clients
      .map(client => ({ client, player: PLAYERS_DATABASE.find(p => p.id === client.playerId) }))
      .filter((x): x is { client: Client; player: Player } => Boolean(x.player)),
    [agency.clients]
  );

  const unlockedOvr = maxUnlockedOverall(agency.reputation);
  const prospects = useMemo(() => PLAYERS_DATABASE
    .filter(p => p.active !== false)
    .filter(p => !agency.clients.some(c => c.playerId === p.id))
    .filter(p => p.ovr <= unlockedOvr)
    .filter(p => filter === 'ALL' || p.position === filter)
    .sort((a, b) => b.ovr - a.ovr || a.salary - b.salary)
    .slice(0, 50), [agency.clients, filter, unlockedOvr]);

  const selected = PLAYERS_DATABASE.find(p => p.id === selectedId) || null;

  const createAgent = () => {
    const age = Number(draftAge);
    if (!draftName.trim() || !draftLocation.trim() || !Number.isFinite(age) || age < 18) return;
    const next: AgencyState = {
      ...agency,
      profile: { name: draftName.trim(), age, location: draftLocation.trim() },
      storyStarted: true,
      reputation: agency.profile ? agency.reputation : 20,
    };
    setAgency(next); persist(next); setIntroStep(3);
  };

  const advanceWeek = () => {
    let nextWeek = agency.seasonWeek + 1;
    let nextYear = agency.seasonYear;
    let nextPhase: SeasonPhase = agency.phase;
    let nextDate = addDays(agency.simulatedDate, 7);
    const events: string[] = [];

    if (agency.phase === 'preseason') {
      nextPhase = 'regular'; nextWeek = 1;
      events.push(`The ${nextYear} regular season has begun.`);
    } else if (agency.phase === 'regular' && nextWeek > REGULAR_SEASON_WEEKS) {
      nextPhase = 'postseason'; nextWeek = 1;
      events.push('The regular season is over. Postseason and end-of-year contract decisions begin.');
    } else if (agency.phase === 'postseason' && nextWeek > 5) {
      nextPhase = 'offseason'; nextWeek = 1;
      events.push('The offseason has begun. Teams are preparing for the new league year.');
    } else if (agency.phase === 'offseason' && nextWeek > 4) {
      nextYear += 1; nextPhase = 'preseason'; nextWeek = 0;
      events.push(`The ${nextYear} league year is open. Contract markets reset and every relationship matters again.`);
    }

    const updatedClients = agency.clients.map(client => {
      const p = PLAYERS_DATABASE.find(x => x.id === client.playerId);
      if (!p) return client;
      const tradeWindowOpen = nextPhase === 'regular' && nextWeek <= TRADE_DEADLINE_WEEK;
      const alreadyOpen = client.tradeRequest?.status === 'open';
      const requestChance = Math.max(.03, Math.min(.18, .13 - client.trust / 1000 + (p.ovr >= 75 ? .02 : 0)));
      if (tradeWindowOpen && !alreadyOpen && Math.random() < requestChance) {
        const reasons = tradeReasons(p);
        const reason = reasons[Math.floor(Math.random() * reasons.length)];
        events.push(`TRADE REQUEST: ${reason}`);
        return { ...client, tradeRequest: { requestedWeek: nextWeek, requestedAt: nextDate, reason, status: 'open' as const } };
      }
      return client;
    });

    if (nextPhase === 'regular' && nextWeek === TRADE_DEADLINE_WEEK) events.push('Trade deadline week. Any client who wants out has to make the move now.');
    if (nextPhase === 'regular' && nextWeek === TRADE_DEADLINE_WEEK + 1) events.push('The trade deadline has passed. No new trade requests can be acted on until the next league year.');

    const next: AgencyState = {
      ...agency,
      clients: updatedClients,
      seasonYear: nextYear,
      seasonWeek: nextWeek,
      phase: nextPhase,
      simulatedDate: nextDate,
      timeline: [...events, ...agency.timeline].slice(0, 20),
    };
    setAgency(next); persist(next);
  };

  const resolveTradeRequest = (playerId: string, status: 'resolved' | 'denied') => {
    const p = PLAYERS_DATABASE.find(x => x.id === playerId);
    const next: AgencyState = {
      ...agency,
      reputation: clamp(agency.reputation + (status === 'resolved' ? 2 : -1), 0, 100),
      clients: agency.clients.map(c => c.playerId === playerId && c.tradeRequest ? { ...c, tradeRequest: { ...c.tradeRequest, status } } : c),
      timeline: [`${p?.name || 'Your client'}'s trade request was ${status === 'resolved' ? 'handled' : 'denied'}.`, ...agency.timeline].slice(0, 20),
    };
    setAgency(next); persist(next);
  };

  const beginRecruit = (p: Player) => {
    if (clients.length >= STARTING_CLIENT_CAP && agency.reputation < 45) return;
    const daysLeft = cooldownDaysLeft(agency.recruitCooldowns[p.id]);
    if (daysLeft > 0) {
      setSelectedId(p.id);
      setRecruit({ playerId:p.id, interest:0, round:1, used:[], rivalPressure:0, failed:true, message:`${p.name}'s camp is not taking another meeting yet. Try again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`, playerReply:'“We already made our decision for now.”' });
      return;
    }
    const difficulty = signingDifficulty(p);
    const base = clamp(22 + agency.reputation * .30 + agency.clientCare * .10 - difficulty * .19, 10, 55);
    setSelectedId(p.id);
    setRecruit({ playerId:p.id, interest:Math.round(base), round:1, used:[], rivalPressure:Math.round(28 + difficulty * .48), message:`${p.name}'s current deal is entering its final year. This is your chance to prove you can create a better future than the last representation did.`, playerReply:'“You are new. Why should I trust my career to you?”' });
  };

  const makePitch = (pitch: Pitch) => {
    if (!selected || !recruit || recruit.failed || recruit.used.includes(pitch)) return;
    const impact = pitchImpact(pitch, selected, agency);
    const nextInterest = clamp(Math.round(recruit.interest + impact - recruit.rivalPressure / 28), 0, 100);
    const ready = nextInterest >= signingDifficulty(selected);
    setRecruit({ ...recruit, interest:nextInterest, round:recruit.round + 1, used:[...recruit.used,pitch], message:ready ? `The room changed. ${selected.name} is seriously considering you. Ask for the signature when you are ready.` : `You made progress, but ${selected.name} still needs another reason to bet on a rookie agent.`, playerReply:playerReplyForPitch(pitch) });
  };

  const askToSign = () => {
    if (!selected || !recruit || recruit.failed) return;
    const won = recruit.interest + (agency.reputation + agency.negotiation + agency.clientCare) / 34 - recruit.rivalPressure / 20 >= signingDifficulty(selected);
    if (won) {
      const cooldowns = { ...agency.recruitCooldowns }; delete cooldowns[selected.id];
      const next: AgencyState = { ...agency, reputation:clamp(agency.reputation + (selected.ovr <= 75 ? 8 : 5),0,100), negotiation:clamp(agency.negotiation+1,0,100), clients:[...agency.clients,{playerId:selected.id,trust:72,signedAt:new Date().toISOString()}], wins:agency.wins+1, recruitCooldowns:cooldowns, timeline:[`${selected.name} signed with your agency.`,...agency.timeline].slice(0,20) };
      setAgency(next); persist(next); setRecruit(null); setSelectedId(null);
    } else {
      const until = new Date(Date.now()+RECRUIT_COOLDOWN_DAYS*86400000).toISOString();
      const next: AgencyState = { ...agency, losses:agency.losses+1, reputation:clamp(agency.reputation-1,0,100), recruitCooldowns:{...agency.recruitCooldowns,[selected.id]:until} };
      setAgency(next); persist(next); setRecruit({ ...recruit, failed:true, message:`${selected.name} chose another agency. You can approach again in ${RECRUIT_COOLDOWN_DAYS} days.`, playerReply:'“I respect the pitch, but I need somebody more established right now.”' });
    }
  };

  const openNegotiation = (p: Player, c: Client) => {
    if (c.futureDeal) return;
    const market = marketProjection(p);
    setNegotiationRoom({
      playerId: p.id,
      round: 1,
      years: (p.age ?? 27) >= 30 ? 2 : 3,
      annualM: Number((market * .78).toFixed(1)),
      guaranteedPct: 42,
      gmPatience: clamp(62 + Math.round(agency.negotiation / 5), 62, 82),
      message: `The GM opens below market at ${moneyM(market * .78)} per year. Your client expects you to fight.`,
    });
  };

  const counterNegotiation = () => {
    if (!negotiationRoom) return;
    const p = PLAYERS_DATABASE.find(x => x.id === negotiationRoom.playerId);
    if (!p) return;
    const market = marketProjection(p);
    const askScore = (negotiationRoom.annualM / market) * 55 + negotiationRoom.guaranteedPct * .35 + negotiationRoom.years * 2;
    const leverage = agency.negotiation * .23 + agency.reputation * .09;
    const accepted = askScore <= 69 + leverage || negotiationRoom.round >= 3;
    if (accepted) {
      const totalM = Number((negotiationRoom.annualM * negotiationRoom.years).toFixed(1));
      const deal: FutureDeal = {
        totalM,
        annualM: negotiationRoom.annualM,
        guaranteedM: Number((totalM * negotiationRoom.guaranteedPct / 100).toFixed(1)),
        years: negotiationRoom.years,
        negotiatedAt: new Date().toISOString(),
      };
      const next: AgencyState = {
        ...agency,
        reputation: clamp(agency.reputation + 4, 0, 100),
        negotiation: clamp(agency.negotiation + 3, 0, 100),
        clients: agency.clients.map(x => x.playerId === p.id ? { ...x, futureDeal: deal, trust: clamp(x.trust + 7, 0, 100) } : x),
        timeline: [`DEAL: ${p.name} signed for ${negotiationRoom.years} years, ${moneyM(totalM)} total and ${moneyM(deal.guaranteedM)} guaranteed.`, ...agency.timeline].slice(0, 20),
      };
      setAgency(next); persist(next); setNegotiationRoom(null);
      return;
    }
    const nextPatience = negotiationRoom.gmPatience - Math.max(12, Math.round(askScore - 54));
    if (nextPatience <= 0) {
      const next: AgencyState = {
        ...agency,
        reputation: clamp(agency.reputation - 1, 0, 100),
        clients: agency.clients.map(x => x.playerId === p.id ? { ...x, trust: clamp(x.trust - 5, 0, 100) } : x),
        timeline: [`The ${p.team} GM walked away from extension talks with ${p.name}.`, ...agency.timeline].slice(0, 20),
      };
      setAgency(next); persist(next); setNegotiationRoom(null);
      return;
    }
    const gmAnnual = Number((market * (.82 + negotiationRoom.round * .055 + agency.negotiation / 1400)).toFixed(1));
    setNegotiationRoom({
      ...negotiationRoom,
      round: negotiationRoom.round + 1,
      annualM: gmAnnual,
      guaranteedPct: Math.min(62, negotiationRoom.guaranteedPct + 5),
      gmPatience: nextPatience,
      message: `The GM counters at ${moneyM(gmAnnual)} per year with ${Math.min(62, negotiationRoom.guaranteedPct + 5)}% guaranteed. Push again or protect the relationship.`,
    });
  };

  if (!agency.profile) {
    return <div className="relative min-h-[100dvh] overflow-hidden bg-[#05070b] text-white">
      <div className="relative mx-auto flex min-h-[100dvh] max-w-5xl flex-col px-5 py-6 sm:px-8">
        <button onClick={onBack} className="flex w-fit min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 text-xs font-black"><ArrowLeft size={16}/> BACK</button>
        <div className="flex flex-1 items-center justify-center py-8"><div className="w-full max-w-3xl">
          {introStep < 2 && <div className="mx-auto max-w-2xl rounded-[2rem] border border-violet-300/25 bg-[#0b0f17]/95 p-6 sm:p-8">
            <div className="mb-5 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-400 text-black"><MessageCircle/></div><div><div className="text-[10px] font-black tracking-[.25em] text-violet-300">AGENT CAREER · YEAR ONE</div><div className="text-sm font-bold text-zinc-500">The league does not know your name yet.</div></div></div>
            {introStep === 0 ? <><h1 className="text-3xl font-black leading-tight sm:text-5xl">YOU'RE A ROOKIE AGENT,<br/>TRYING TO FIND YOUR PLACE IN THIS LEAGUE.</h1><p className="mt-5 text-sm font-semibold leading-7 text-zinc-400">No superstar is calling you. You have to earn every relationship, every contract and every point of reputation.</p><button onClick={()=>setIntroStep(1)} className="mt-6 flex min-h-12 w-full items-center justify-between rounded-2xl bg-violet-400 px-5 font-black text-black">CONTINUE <ChevronRight/></button></> : <><h1 className="text-3xl font-black leading-tight sm:text-5xl">START WITH SOMEBODY<br/>THE LEAGUE IS OVERLOOKING.</h1><p className="mt-5 text-sm font-semibold leading-7 text-zinc-400">Find a player entering the last year of his deal and prove you can change his career.</p><button onClick={()=>setIntroStep(2)} className="mt-6 flex min-h-12 w-full items-center justify-between rounded-2xl bg-violet-400 px-5 font-black text-black">CREATE YOUR AGENT <ChevronRight/></button></>}
          </div>}
          {introStep >= 2 && <div className="rounded-[2rem] border border-white/10 bg-[#0b0f17]/95 p-6 sm:p-8"><div className="text-[10px] font-black tracking-[.25em] text-violet-300">CREATE YOUR AGENT</div><h1 className="mt-2 text-4xl font-black sm:text-5xl">WHO ARE YOU?</h1><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs font-black text-zinc-400">NAME<input value={draftName} onChange={e=>setDraftName(e.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-base font-bold text-white"/></label><label className="text-xs font-black text-zinc-400">AGE · 18 MIN<input type="number" min={18} value={draftAge} onChange={e=>setDraftAge(e.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-base font-bold text-white"/></label><label className="text-xs font-black text-zinc-400 sm:col-span-2">HOME CITY<input list="agent-cities" value={draftLocation} onChange={e=>setDraftLocation(e.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-white/10 bg-black/40 px-4 text-base font-bold text-white"/><datalist id="agent-cities">{MAJOR_CITIES.map(city=><option key={city} value={city}/>)}</datalist></label></div><button onClick={createAgent} disabled={!draftName.trim()||Number(draftAge)<18||!draftLocation.trim()} className="mt-6 flex min-h-12 w-full items-center justify-between rounded-2xl bg-violet-400 px-5 font-black text-black disabled:opacity-30">BEGIN MY CAREER <ChevronRight/></button></div>}
        </div></div>
      </div>
    </div>;
  }

  const deadlineOpen = agency.phase === 'regular' && agency.seasonWeek <= TRADE_DEADLINE_WEEK;
  return <div className="min-h-[100dvh] bg-[#06080d] px-4 py-5 text-white sm:px-8"><div className="mx-auto max-w-6xl">
    <div className="mb-5 flex items-center justify-between gap-4"><button onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 text-xs font-black"><ArrowLeft size={16}/> SOLO</button><div className="text-right"><div className="text-[10px] font-black tracking-[.25em] text-violet-300">AGENT CAREER</div><div className="text-lg font-black">{agency.profile.name}</div></div></div>

    <section className="rounded-[2rem] border border-violet-300/20 bg-[#0c1018] p-5 sm:p-6"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex items-center gap-2 text-violet-300"><CalendarDays size={18}/><span className="text-xs font-black tracking-[.2em]">CAREER CALENDAR</span></div><div className="mt-2 text-3xl font-black">{agency.phase === 'regular' ? `WEEK ${agency.seasonWeek}` : agency.phase.toUpperCase()} · {agency.seasonYear}</div><div className="mt-1 text-sm font-bold text-zinc-400">{prettyDate(agency.simulatedDate)} · {deadlineOpen ? `Trade deadline closes after Week ${TRADE_DEADLINE_WEEK}` : agency.phase === 'regular' ? 'Trade deadline closed' : 'Trade requests unavailable'}</div></div><button onClick={advanceWeek} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-violet-400 px-5 font-black text-black"><FastForward size={18}/> ADVANCE ONE WEEK</button></div></section>

    {agency.timeline.length>0 && <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4"><div className="text-[10px] font-black tracking-[.2em] text-zinc-500">LATEST LEAGUE EVENT</div><div className="mt-2 text-sm font-bold text-zinc-200">{agency.timeline[0]}</div></div>}

    <section className="mt-5 overflow-hidden rounded-[2rem] border border-violet-300/20 bg-[#0c1018] p-5 sm:p-7"><div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]"><div><div className="text-[10px] font-black tracking-[.26em] text-violet-300">YEAR {agency.seasonYear} · EARN YOUR NAME</div><h1 className="mt-2 text-4xl font-black leading-none sm:text-6xl">PROVE YOU<br/>BELONG.</h1><div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-zinc-400"><span className="rounded-full bg-white/5 px-3 py-2"><UserRound size={13} className="mr-1 inline"/>{agency.profile.age} years old</span><span className="rounded-full bg-white/5 px-3 py-2"><MapPin size={13} className="mr-1 inline"/>{agency.profile.location}</span><span className="rounded-full bg-white/5 px-3 py-2"><BriefcaseBusiness size={13} className="mr-1 inline"/>{clients.length}/{STARTING_CLIENT_CAP} starter clients</span></div></div><div className="rounded-3xl border border-white/10 bg-black/30 p-5"><div className="text-xs font-black tracking-wider text-violet-300">REPUTATION</div><div className="mt-1 text-5xl font-black">{agency.reputation}</div><div className="mt-4 grid grid-cols-2 gap-2 text-xs">{[['Negotiation',agency.negotiation],['Brand',agency.brandPower],['Client Care',agency.clientCare],['Max OVR',unlockedOvr]].map(([l,v])=><div key={String(l)} className="rounded-xl bg-white/5 p-3"><div className="text-zinc-500">{l}</div><div className="mt-1 font-black">{v}</div></div>)}</div></div></div></section>

    {clients.length>0 && <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#0d121b] p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><BriefcaseBusiness className="text-violet-300"/><h2 className="text-2xl font-black">YOUR CLIENTS</h2></div><div className="grid gap-3 md:grid-cols-2">{clients.map(({client,player})=><div key={player.id} className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-center gap-3"><img src={playerPortraitUrl(player)} alt="" className="h-14 w-14 rounded-xl bg-white/5 object-cover"/><div className="min-w-0 flex-1"><div className="font-black">{player.name}</div><div className="text-xs text-zinc-500">{player.team} · {player.position} · {player.ovr} OVR</div></div><div className="text-right"><div className="text-[9px] font-black text-zinc-500">TRUST</div><div className="font-black text-emerald-300">{client.trust}%</div></div></div>
      {client.tradeRequest?.status==='open' && <div className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3"><div className="flex items-center gap-2 text-xs font-black text-amber-200"><AlertTriangle size={14}/> TRADE REQUEST</div><p className="mt-2 text-xs font-semibold leading-5 text-zinc-300">{client.tradeRequest.reason}</p><div className="mt-3 grid grid-cols-2 gap-2"><button onClick={()=>resolveTradeRequest(player.id,'resolved')} className="min-h-10 rounded-xl bg-violet-400 px-3 text-xs font-black text-black">WORK THE PHONES</button><button onClick={()=>resolveTradeRequest(player.id,'denied')} className="min-h-10 rounded-xl bg-white/10 px-3 text-xs font-black">TELL HIM NO</button></div></div>}
      <div className="mt-3 rounded-xl bg-white/5 p-3 text-xs"><div className="text-zinc-500">Current deal baseline</div><div className="mt-1 font-black">{moneyM(player.salary)} · final contract year</div></div>{client.futureDeal?<div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs"><div className="font-black text-emerald-300">YOU GOT HIM PAID</div><div className="mt-1 text-zinc-300">{client.futureDeal.years} years · {moneyM(client.futureDeal.totalM)} total · {moneyM(client.futureDeal.guaranteedM || 0)} guaranteed</div></div>:<button onClick={()=>openNegotiation(player,client)} className="mt-3 min-h-11 w-full rounded-xl bg-violet-400 px-4 text-xs font-black text-black">ENTER NEGOTIATION ROOM</button>}</div>)}</div></section>}

    <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#0d121b] p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-black tracking-[.22em] text-violet-300">FIRST CLIENT BOARD</div><h2 className="mt-1 text-3xl font-black">WHO ARE YOU BETTING ON?</h2><p className="mt-2 text-xs font-semibold text-zinc-500">50 available targets · current unlock: {unlockedOvr} OVR and below</p></div><select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl border border-white/10 bg-black px-3 py-3 text-sm font-black">{['ALL','QB','RB','WR','TE','OT','EDGE','DT','LB','CB','S','K','P'].map(x=><option key={x}>{x}</option>)}</select></div><div className="mt-5 grid gap-3 md:grid-cols-2">{prospects.map(p=>{const [low,high]=salaryRange(p);const days=cooldownDaysLeft(agency.recruitCooldowns[p.id]);return <button key={p.id} onClick={()=>beginRecruit(p)} disabled={clients.length>=STARTING_CLIENT_CAP&&agency.reputation<45} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-left disabled:opacity-35"><img src={playerPortraitUrl(p)} alt="" className="h-16 w-16 rounded-xl bg-white/5 object-cover"/><div className="min-w-0 flex-1"><div className="truncate font-black">{p.name}</div><div className="text-xs text-zinc-500">{p.team} · {p.position} · Age {p.age??'—'} · 1 year left</div><div className="mt-1 text-[10px] text-zinc-500">Expected next deal: {moneyM(low)}–{moneyM(high)}/yr</div></div><div className="text-right"><div className="text-xl font-black text-violet-300">{p.ovr}</div><div className="text-[9px] font-black text-zinc-500">{days>0?`${days}D WAIT`:'OVR'}</div></div></button>})}</div></section>

    {selected&&recruit&&<div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-4 backdrop-blur-md"><div className="mx-auto mt-[max(2rem,env(safe-area-inset-top))] max-w-xl rounded-[2rem] border border-violet-300/25 bg-[#0c1018] p-5 sm:p-7"><div className="flex items-start gap-4"><img src={playerPortraitUrl(selected)} alt="" className="h-20 w-20 rounded-2xl bg-white/5 object-cover"/><div className="min-w-0 flex-1"><div className="text-[10px] font-black tracking-[.2em] text-violet-300">PRIVATE MEETING</div><h3 className="mt-1 text-2xl font-black">{selected.name}</h3><div className="text-xs text-zinc-500">{selected.team} · {selected.position} · {selected.ovr} OVR · final year</div></div><button onClick={()=>{setRecruit(null);setSelectedId(null)}} className="rounded-xl bg-white/5 px-3 py-2 text-xs font-black">CLOSE</button></div><div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-4"><div className="text-[10px] font-black text-zinc-500">PLAYER</div><p className="mt-2 text-lg font-black leading-7 text-white">{recruit.playerReply}</p></div><div className="mt-3 rounded-2xl bg-violet-400/10 p-4"><div className="text-[10px] font-black text-violet-300">STORY</div><p className="mt-2 text-sm font-semibold leading-6 text-zinc-300">{recruit.message}</p></div>{!recruit.failed&&<><div className="mt-5 grid gap-2 sm:grid-cols-2">{(Object.keys(pitchLabel) as Pitch[]).map(pitch=><button key={pitch} disabled={recruit.used.includes(pitch)} onClick={()=>makePitch(pitch)} className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-left text-xs font-black disabled:opacity-25">{pitchLabel[pitch]}</button>)}</div><button onClick={askToSign} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-violet-400 px-5 font-black text-black"><Handshake size={18}/> ASK HIM TO SIGN WITH YOU</button></>}<div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-zinc-600"><ShieldCheck size={13}/> Reputation determines which players will even take your meeting.</div></div></div>}
    {negotiationRoom&&(()=>{const p=PLAYERS_DATABASE.find(x=>x.id===negotiationRoom.playerId);if(!p)return null;const market=marketProjection(p);return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/90 p-4 backdrop-blur-md"><div className="mx-auto mt-[max(1rem,env(safe-area-inset-top))] max-w-xl rounded-[2rem] border border-violet-300/25 bg-[#0c1018] p-5 sm:p-7"><div className="flex items-start justify-between gap-3"><div><div className="text-[10px] font-black tracking-[.22em] text-violet-300">NEGOTIATION ROOM · ROUND {negotiationRoom.round}</div><h3 className="mt-1 text-3xl font-black">{p.name}</h3><div className="text-xs text-zinc-500">{p.team} GM · Market estimate {moneyM(market)}/yr</div></div><button onClick={()=>setNegotiationRoom(null)} className="min-h-11 rounded-xl bg-white/5 px-3 text-xs font-black">LEAVE</button></div><div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-4"><div className="text-[10px] font-black text-zinc-500">GENERAL MANAGER</div><p className="mt-2 text-lg font-black leading-7">“{negotiationRoom.message}”</p></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="rounded-2xl bg-white/5 p-3 text-[10px] font-black text-zinc-400">YEARS<input type="range" min="1" max="5" value={negotiationRoom.years} onChange={e=>setNegotiationRoom({...negotiationRoom,years:Number(e.target.value)})} className="mt-3 w-full accent-violet-400"/><span className="mt-2 block text-2xl text-white">{negotiationRoom.years}</span></label><label className="rounded-2xl bg-white/5 p-3 text-[10px] font-black text-zinc-400">PER YEAR<input type="range" min={Math.max(1,market*.65)} max={market*1.3} step="0.5" value={negotiationRoom.annualM} onChange={e=>setNegotiationRoom({...negotiationRoom,annualM:Number(e.target.value)})} className="mt-3 w-full accent-violet-400"/><span className="mt-2 block text-lg text-white">{moneyM(negotiationRoom.annualM)}</span></label><label className="rounded-2xl bg-white/5 p-3 text-[10px] font-black text-zinc-400">GUARANTEED<input type="range" min="25" max="80" step="5" value={negotiationRoom.guaranteedPct} onChange={e=>setNegotiationRoom({...negotiationRoom,guaranteedPct:Number(e.target.value)})} className="mt-3 w-full accent-violet-400"/><span className="mt-2 block text-2xl text-white">{negotiationRoom.guaranteedPct}%</span></label></div><div className="mt-4 flex items-center justify-between rounded-xl bg-white/5 p-3 text-xs"><span className="text-zinc-500">GM patience</span><span className={negotiationRoom.gmPatience<30?'font-black text-red-300':'font-black text-emerald-300'}>{negotiationRoom.gmPatience}/100</span></div><button onClick={counterNegotiation} className="mt-4 min-h-12 w-full rounded-2xl bg-violet-400 px-5 font-black text-black">SEND COUNTEROFFER · {moneyM(negotiationRoom.annualM*negotiationRoom.years)} TOTAL</button></div></div>})()}
  </div></div>;
};
