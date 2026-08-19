import React from 'react';
import {
  ArrowRight,
  Award,
  Newspaper,
  Shield,
  Sparkles,
  Trophy,
  Users,
  UserRound,
  Gamepad2,
  BarChart3,
} from 'lucide-react';
import type { AppTab } from './App';

type Props = {
  onNavigate: (tab: AppTab) => void;
  onOpenCreateLeague: () => void;
  onOpenJoinLeague: () => void;
  activeLeagueCount: number;
};

type ModeCard = {
  title: string;
  eyebrow: string;
  description: string;
  action: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  featured?: boolean;
};

export const OverviewModeGrid: React.FC<Props> = ({
  onNavigate,
  onOpenCreateLeague,
  onOpenJoinLeague,
  activeLeagueCount,
}) => {
  const cards: ModeCard[] = [
    {
      title: 'Online League',
      eyebrow: activeLeagueCount ? `${activeLeagueCount} ACTIVE` : 'MULTIPLAYER',
      description: 'Create or join a league, build under the cap, and compete for fantasy draft order.',
      action: 'Create League',
      icon: Users,
      featured: true,
      onClick: onOpenCreateLeague,
    },
    {
      title: 'Solo Franchise',
      eyebrow: 'MADDEN-STYLE SOLO',
      description: 'Choose Cap Challenge, Fantasy Draft, a real NFL team, or My Player career.',
      action: 'Open Solo',
      icon: Gamepad2,
      onClick: () => onNavigate('solo'),
    },
    {
      title: 'Fantasy Draft',
      eyebrow: '32 TEAMS • SNAKE DRAFT',
      description: 'Draft against CPU GMs and build your own franchise from the full NFL player pool.',
      action: 'Start Draft',
      icon: Trophy,
      onClick: () => onNavigate('solo'),
    },
    {
      title: 'Real NFL Team',
      eyebrow: 'FRANCHISE MODE',
      description: 'Take over any NFL roster, manage the depth chart, trades, free agency, and season.',
      action: 'Pick a Team',
      icon: Shield,
      onClick: () => onNavigate('solo'),
    },
    {
      title: 'My Player',
      eyebrow: 'PLAYER CAREER',
      description: 'Create your player, run the combine, get drafted, upgrade ratings, and build a career.',
      action: 'Create Player',
      icon: UserRound,
      onClick: () => onNavigate('solo'),
    },
    {
      title: 'NFL News',
      eyebrow: 'LIVE FEED',
      description: 'Catch current NFL headlines without leaving Ball Knower.',
      action: 'Read News',
      icon: Newspaper,
      onClick: () => onNavigate('news'),
    },
    {
      title: 'Fantasy Hub',
      eyebrow: 'LEAGUE TOOLS',
      description: 'Jump into fantasy-focused league tools, player context, and competition views.',
      action: 'Open Fantasy',
      icon: BarChart3,
      onClick: () => onNavigate('fantasy'),
    },
    {
      title: 'Sportsbook',
      eyebrow: 'GAMES & ODDS',
      description: 'See the NFL slate and sportsbook data in the same team-driven experience.',
      action: 'View Odds',
      icon: Sparkles,
      onClick: () => onNavigate('sportsbook'),
    },
    {
      title: 'Hall of Fame',
      eyebrow: 'LEGACY',
      description: 'See the best Ball Knower seasons, champions, and franchise accomplishments.',
      action: 'View Legacy',
      icon: Award,
      onClick: () => onNavigate('legacy'),
    },
  ];

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-10 pt-8 sm:px-8 sm:pt-12">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="bk-overline text-[10px]">BALL KNOWER COMMAND CENTER</p>
          <h1 className="mt-1 text-3xl font-black uppercase tracking-tight text-white sm:text-4xl">What do you want to do?</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-zinc-400">Everything in Ball Knower, one tap away. Pick a mode and get straight into football.</p>
        </div>
        <button
          type="button"
          onClick={onOpenJoinLeague}
          className="hidden min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-black/35 px-4 text-[11px] font-black uppercase tracking-wider text-zinc-200 sm:flex"
        >
          Join Code <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {cards.map(({ title, eyebrow, description, action, icon: Icon, onClick, featured }) => (
          <button
            key={title}
            type="button"
            onClick={onClick}
            className={`group relative min-h-[178px] overflow-hidden rounded-[28px] border p-4 text-left transition active:scale-[.985] sm:min-h-[205px] sm:p-5 ${
              featured
                ? 'border-[var(--bk-team-accent)]/45 bg-[linear-gradient(145deg,rgb(var(--bk-team-primary-rgb)/.28),rgb(8_11_17/.92))] shadow-[0_20px_70px_rgb(var(--bk-team-primary-rgb)/.14)]'
                : 'border-white/10 bg-[linear-gradient(145deg,rgb(20_25_34/.82),rgb(8_11_17/.86))] hover:border-[var(--bk-team-accent)]/35'
            }`}
          >
            <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[rgb(var(--bk-team-primary-rgb)/.12)] blur-2xl transition group-hover:bg-[rgb(var(--bk-team-primary-rgb)/.2)]" />
            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-black/25 text-[var(--bk-team-accent-text,var(--bk-team-accent))]">
                  <Icon className="h-5 w-5" />
                </div>
                <ArrowRight className="mt-1 h-4 w-4 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-white" />
              </div>
              <p className="mt-4 text-[9px] font-black uppercase tracking-[.18em] text-[var(--bk-team-accent-text,var(--bk-team-accent))]">{eyebrow}</p>
              <h2 className="mt-1 text-lg font-black uppercase leading-tight tracking-tight text-white sm:text-xl">{title}</h2>
              <p className="mt-2 line-clamp-3 text-[11px] font-medium leading-relaxed text-zinc-400 sm:text-xs">{description}</p>
              <span className="mt-auto pt-3 text-[10px] font-black uppercase tracking-widest text-zinc-300">{action}</span>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenJoinLeague}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-black/35 text-[11px] font-black uppercase tracking-wider text-zinc-200 sm:hidden"
      >
        Join an Online League <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </section>
  );
};
