import React, { lazy, Suspense } from 'react';
import type { League } from './types';
import type { TeamTheme } from './teamTheme';
import type { AppTab } from './App';
import './homeBroadcast.css';

export interface HomeDashboardProps {
  onOpenCreateLeague: () => void;
  onOpenJoinLeague: () => void;
  onSelectLeague: (league: League, tab: 'lobby' | 'draft' | 'simulation') => void;
  onNavigate: (tab: AppTab) => void;
  onOpenCheatSheet: () => void;
  teamTheme: TeamTheme;
}
// Keep Home-only artwork, research and panels out of the shared startup bundle.
const CommandCenter = lazy(() => import('./HomeCommandCenter').then(module => ({ default: module.HomeCommandCenter })));
export const HomeDashboard: React.FC<HomeDashboardProps> = props => <Suspense fallback={<div role="status" className="mx-auto min-h-[60dvh] px-4 py-8 text-center text-sm text-zinc-400">Opening your command center…</div>}><CommandCenter {...props}/></Suspense>;
