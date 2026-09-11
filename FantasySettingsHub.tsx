import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Bell, BookOpen, Crown, Eye, LayoutList, Settings, Shield, Trophy, X } from 'lucide-react';
import { useBallKnower } from './BallKnowerContext';
import { CommunitySafetySettings, useCommunitySafety } from './CommunitySafety';
import { FantasyNotificationPreferences } from './FantasyNotificationPreferences';
import { isLeagueCommissioner } from './leaguePermissions';
import { homeLeaguePhase } from './homeDashboardState';
import type { League } from './types';
import { ModalPortal } from './ModalPortal';
import { FANTASY_DISPLAY_EVENT, FANTASY_DISPLAY_KEY, readFantasyDisplayPreferences, type FantasyDisplayPreferences } from './fantasyDisplayPreferences';
import './fantasySettingsHub.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onOpenLeague: (league: League) => void;
  onManageLeague: (league: League) => void;
};

type Section = 'leagues' | 'notifications' | 'display' | 'safety' | 'help';

export function FantasySettingsHub({ isOpen, onClose, onOpenLeague, onManageLeague }: Props) {
  const { leagues, currentUser, setActiveLeagueId, showToast } = useBallKnower();
  const safety = useCommunitySafety();
  const [section, setSection] = useState<Section>('leagues');
  const [selectedLeagueId, setSelectedLeagueId] = useState('');
  const [preferences, setPreferences] = useState(readFantasyDisplayPreferences);
  const selectedLeague = leagues.find(league => league.id === selectedLeagueId);
  const names = useMemo(() => Object.fromEntries(leagues.flatMap(league => league.members)
    .filter(member => member.userId).map(member => [member.userId!, member.userName])), [leagues]);
  const orderedLeagues = useMemo(() => [...leagues].sort((a, b) => preferences.leagueOrder === 'alphabetical'
    ? a.name.localeCompare(b.name) : Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')), [leagues, preferences.leagueOrder]);

  useEffect(() => { if (!isOpen) { setSection('leagues'); setSelectedLeagueId(''); } }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') selectedLeagueId ? setSelectedLeagueId('') : onClose(); };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [isOpen, onClose, selectedLeagueId]);

  if (!isOpen) return null;
  const savePreferences = (patch: Partial<FantasyDisplayPreferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    try { localStorage.setItem(FANTASY_DISPLAY_KEY, JSON.stringify(next)); } catch {}
    if (patch.defaultLeagueId) setActiveLeagueId(patch.defaultLeagueId);
    window.dispatchEvent(new CustomEvent(FANTASY_DISPLAY_EVENT, { detail: next }));
    showToast('Fantasy preference saved');
  };

  return <ModalPortal><div className="bk-settings-scrim" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="bk-settings-sheet" role="dialog" aria-modal="true" aria-labelledby="fantasy-settings-title">
      <header>
        <button type="button" aria-label={selectedLeague ? 'Back to all leagues' : 'Close fantasy settings'} onClick={() => selectedLeague ? setSelectedLeagueId('') : onClose()}>{selectedLeague ? <ArrowLeft/> : <X/>}</button>
        <div><small>Fantasy HQ</small><h2 id="fantasy-settings-title">{selectedLeague ? selectedLeague.name : 'Settings'}</h2></div>
        <span aria-hidden="true"><Settings/></span>
      </header>

      {!selectedLeague && <nav aria-label="Fantasy settings sections">
        <Tab active={section === 'leagues'} label="Leagues" icon={<Trophy/>} onClick={() => setSection('leagues')}/>
        <Tab active={section === 'notifications'} label="Alerts" icon={<Bell/>} onClick={() => setSection('notifications')}/>
        <Tab active={section === 'display'} label="Display" icon={<Eye/>} onClick={() => setSection('display')}/>
        <Tab active={section === 'safety'} label="Safety" icon={<Shield/>} onClick={() => setSection('safety')}/>
        <Tab active={section === 'help'} label="Help" icon={<BookOpen/>} onClick={() => setSection('help')}/>
      </nav>}

      <div className="bk-settings-body">
        {selectedLeague ? <LeaguePanel league={selectedLeague} userId={currentUser?.id} onOpen={() => onOpenLeague(selectedLeague)} onManage={() => onManageLeague(selectedLeague)}/>
          : section === 'leagues' ? <section><Heading title="All My Leagues" detail={`${leagues.length} total · choose one to manage`}/>
            <label className="bk-settings-order">League order<select value={preferences.leagueOrder} onChange={event => savePreferences({ leagueOrder: event.target.value as FantasyDisplayPreferences['leagueOrder'] })}><option value="recent">Recently created</option><option value="alphabetical">Alphabetical</option></select></label>
            <div className="bk-settings-leagues">{orderedLeagues.length ? orderedLeagues.map(league => <button type="button" key={league.id} onClick={() => setSelectedLeagueId(league.id)}>
              <span className="bk-settings-crest"><Trophy/>{isLeagueCommissioner(league, currentUser?.id) && <Crown/>}</span>
              <span><strong>{league.name}</strong><small>{league.members.length}/{league.maxMembers} teams · {homeLeaguePhase(league)}</small></span><ArrowRight/>
            </button>) : <p className="bk-settings-empty">Create or join a league and it will appear here.</p>}</div>
          </section>
          : section === 'notifications' ? <section><Heading title="Notifications" detail="Control draft, roster, transaction and league alerts"/><FantasyNotificationPreferences userId={currentUser?.id}/></section>
          : section === 'display' ? <section><Heading title="Display Preferences" detail="Make Fantasy HQ work the way you like"/>
            <SettingSelect label="Default league" detail="This league opens first across Fantasy HQ" value={preferences.defaultLeagueId} onChange={value => savePreferences({ defaultLeagueId: value })} options={[['', 'Automatic'], ...leagues.map(league => [league.id, league.name])]}/>
            <SettingSelect label="Layout density" detail="Compact fits more football on your screen" value={preferences.density} onChange={value => savePreferences({ density: value as FantasyDisplayPreferences['density'] })} options={[["compact", "Compact"], ["comfortable", "Comfortable"]]}/>
            <SettingToggle label="Show projections" detail="Show projected totals before and during matchups" checked={preferences.showProjections} onClick={() => savePreferences({ showProjections: !preferences.showProjections })}/>
            <SettingToggle label="Spoiler-free scores" detail="Hide matchup scores on Home until you open the league" checked={preferences.spoilerFree} onClick={() => savePreferences({ spoilerFree: !preferences.spoilerFree })}/>
          </section>
          : section === 'safety' ? <section><Heading title="Blocked & Muted" detail="Review managers you have blocked and report problems"/><CommunitySafetySettings safety={safety} names={names}/></section>
          : <section><Heading title="Help & League Rules" detail="Quick answers and a direct path to support"/>
            <Info title="League rules">Open a league and select League Settings to review scoring, roster, draft, waivers, trades, playoffs and schedule rules.</Info>
            <Info title="Commissioner help">Commissioner-only controls are marked with a crown and are never shown as available to regular members.</Info>
            <Info title="Need help?"><a href="mailto:BallKnowerOfficial@gmail.com?subject=Fantasy%20league%20support">Contact Ball Knower support</a></Info>
          </section>}
      </div>
    </section>
  </div></ModalPortal>;
}

function LeaguePanel({ league, userId, onOpen, onManage }: { league: League; userId?: string; onOpen: () => void; onManage: () => void }) {
  const commissioner = isLeagueCommissioner(league, userId);
  return <section className="bk-settings-league-panel">
    <div className="bk-settings-league-hero"><span><Trophy/></span><div><small>{commissioner ? 'Commissioner' : 'League member'}</small><h3>{league.name}</h3><p>{league.members.length}/{league.maxMembers} teams · {homeLeaguePhase(league)}</p></div></div>
    <button type="button" className="bk-settings-primary" onClick={onOpen}>Open League <ArrowRight/></button>
    <div className="bk-settings-card"><h4>League Management</h4><p>{commissioner ? 'Edit scoring, rosters, waivers, trades, playoffs, schedule, invitations and commissioner tools inside League HQ.' : 'Review league rules, scoring, roster settings, schedule and commissioner information.'}</p><button type="button" onClick={onOpen}>{commissioner ? 'Open Commissioner Tools' : 'View League Rules'}<ArrowRight/></button></div>
    <div className="bk-settings-card"><h4>Membership & Access</h4><p>Manage the invitation code and sharing. {commissioner ? 'The protected Danger Zone for deleting this league is at the bottom.' : 'The protected option to leave this league is at the bottom.'}</p><button type="button" onClick={onManage}>Manage League Access<ArrowRight/></button></div>
  </section>;
}

const Heading = ({ title, detail }: { title: string; detail: string }) => <div className="bk-settings-heading"><h3>{title}</h3><p>{detail}</p></div>;
const Tab = ({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) => <button type="button" aria-current={active ? 'page' : undefined} onClick={onClick}>{icon}<span>{label}</span></button>;
const SettingToggle = ({ label, detail, checked, onClick }: { label: string; detail: string; checked: boolean; onClick: () => void }) => <div className="bk-settings-row"><span><strong>{label}</strong><small>{detail}</small></span><button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={onClick}><i/></button></div>;
const SettingSelect = ({ label, detail, value, options, onChange }: { label: string; detail: string; value: string; options: string[][]; onChange: (value: string) => void }) => <label className="bk-settings-row bk-settings-select"><span><strong>{label}</strong><small>{detail}</small></span><select value={value} onChange={event => onChange(event.target.value)}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
const Info = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="bk-settings-info"><LayoutList/><div><strong>{title}</strong><p>{children}</p></div></div>;
