import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { AppTab } from '../../App';
import { Navbar } from '../../Navbar';
import { HomeDashboard } from '../../HomeDashboard';
import { PlayHub } from '../../PlayHub';
import { ProfileLockerView } from '../../ProfileLockerView';
import { BALL_KNOWER_THEME } from '../../teamTheme';
import { achievements, profile, scenario } from './navigation-data';

function Review() {
  const [tab, setTab] = useState<AppTab>('home');
  const [action, setAction] = useState('');
  const navigate = (next: AppTab) => { setTab(next); window.scrollTo(0, 0); };
  return <div className="bk-app-shell min-h-[100dvh] bg-[#070c14] text-white" data-tab={tab}>
    <Navbar currentTab={tab} setCurrentTab={navigate} newsEnabled={false} onOpenAuth={() => setAction('Account requested')} onOpenCreateLeague={() => setAction('Create league requested')} onOpenJoinLeague={() => setAction('Join league requested')} onOpenDatabaseModal={() => setAction('Roster database requested')} onOpenIntro={() => setAction('Intro replay requested')}/>
    <main className="pb-[calc(5rem+env(safe-area-inset-bottom))]">
      {tab === 'home' ? <HomeDashboard teamTheme={BALL_KNOWER_THEME} onNavigate={navigate} onOpenCheatSheet={() => setAction('Cheat sheet requested')} onOpenCreateLeague={() => setAction('Create league requested')} onOpenJoinLeague={() => setAction('Join league requested')} onSelectLeague={(_, next) => navigate(next)} onViewMemberLocker={() => navigate('locker')}/>
        : tab === 'play' ? <PlayHub onNavigate={navigate}/>
        : tab === 'locker' ? <div className="bk-profile-page bk-screen mx-auto max-w-5xl"><h1 className="px-4 text-3xl font-bold">Profile</h1><ProfileLockerView profile={scenario() === 'offline' ? null : profile} achievements={scenario() === 'offline' ? [] : achievements} events={[]} predictionPicks={[]} loading={false} error={scenario() === 'offline' ? 'Offline fixture' : ''} onRefresh={() => setAction('Profile refresh requested')} identity={<div className="bk-profile-identity"><section><div><div>Review GM</div><div>Guest profile · review fixture</div></div></section></div>}/></div>
        : <section className="mx-auto max-w-5xl p-8"><h1 data-testid="review-destination" className="text-3xl">{tab}</h1><p>This fixture verifies the navigation callback. Open the full app to test this destination’s own behavior.</p></section>}
      <p role="status" data-testid="review-action">{action}</p>
    </main>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Review/>);
