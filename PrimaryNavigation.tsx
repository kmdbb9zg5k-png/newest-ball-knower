import React from 'react';
import { Home, Play, Trophy, User, Users } from 'lucide-react';
import type { AppTab } from './App';
import { PRIMARY_DESTINATIONS, primaryDestinationForTab } from './appNavigation';

const ICONS = { home: Home, play: Play, fantasy: Trophy, community: Users, locker: User };

export function PrimaryNavigation({ currentTab, onNavigate, mobile = false }: {
  currentTab: AppTab; onNavigate: (tab: AppTab) => void; mobile?: boolean;
}) {
  const active = primaryDestinationForTab(currentTab);
  return <div className={`bk-primary-destinations ${mobile ? 'bk-primary-mobile' : 'bk-primary-desktop'}`}>
    {PRIMARY_DESTINATIONS.map(({ tab, label }) => {
      const Icon = ICONS[tab];
      return <button type="button" key={tab} id={`${mobile ? 'mobile-' : ''}nav-tab-${tab}`} onClick={() => onNavigate(tab)} aria-current={active === tab ? 'page' : undefined}>
        <Icon aria-hidden="true"/><span>{label}</span>
      </button>;
    })}
  </div>;
}
