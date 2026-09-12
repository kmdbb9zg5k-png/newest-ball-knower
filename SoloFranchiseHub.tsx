import {SoloModeArtwork} from './solo/SoloPresentation';
import {BroadcastStage,BroadcastMasthead} from './BroadcastScene';
import React, { useState } from 'react';
import { BadgeDollarSign, BriefcaseBusiness, Building2, ChevronRight, Crown, Shuffle, Sparkles, Trophy, Users } from 'lucide-react';
import { SOLO_FRANCHISE_SAVE_KEYS } from './soloFranchiseEngine';
import { OwnerBusinessMode } from './OwnerBusinessMode';
import { PlayerAgentMode } from './PlayerAgentMode';

export type SoloExperience = 'hub' | 'cap' | 'fantasy' | 'real' | 'player';

type Props = {
  onOpen: (experience: Exclude<SoloExperience, 'hub'>) => void;
};

const MODES = [
  {
    id: 'cap' as const,
    eyebrow: 'THE ORIGINAL',
    title: 'CAP CHALLENGE',
    description: 'Draft your 20-player superteam under the cap, then survive 17 games and the playoffs.',
    icon: BadgeDollarSign,
    key: SOLO_FRANCHISE_SAVE_KEYS.cap,
    accent: 'from-amber-400/25 to-transparent',
    image: '/team-cinematic/gold-trophy.jpg',
  },
  {
    id: 'fantasy' as const,
    eyebrow: 'CREATE YOUR LEAGUE',
    title: 'FANTASY DRAFT',
    description: 'Create a custom football team, draft a full 53-man roster, then play a 17-game season through the Legacy Bowl.',
    icon: Shuffle,
    key: SOLO_FRANCHISE_SAVE_KEYS.fantasy,
    accent: 'from-sky-400/25 to-transparent',
    image: '/team-cinematic/crimson-player.jpg',
  },
  {
    id: 'real' as const,
    eyebrow: 'SIMULATED ROSTERS',
    title: 'FRANCHISE COMMAND',
    description: 'Run football operations: shape a simulated roster, answer coaches, make deals and chase a championship.',
    icon: Users,
    key: SOLO_FRANCHISE_SAVE_KEYS.real,
    accent: 'from-emerald-400/25 to-transparent',
    image: '/team-cinematic/gold-trophy.jpg',
  },
  {
    id: 'player' as const,
    eyebrow: 'STORY MODE',
    title: 'MY PLAYER',
    description: 'Create yourself, get drafted, earn XP and upgrade your ratings through a Ball Knower League career.',
    icon: Sparkles,
    key: SOLO_FRANCHISE_SAVE_KEYS.player,
    accent: 'from-violet-400/25 to-transparent',
    image: '/team-cinematic/purple-receiver.jpg',
  },
];

function hasSave(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    if (key === SOLO_FRANCHISE_SAVE_KEYS.player) {
      const profile = JSON.parse(raw);
      if (profile?.stage !== 'creator') return true;
      return Boolean(
        profile?.name || profile?.faceImage || profile?.renderImage || profile?.appearancePrompt ||
        profile?.position !== 'WR' || profile?.number !== 17 || profile?.heightInches !== 72 ||
        profile?.weightLbs !== 205 || profile?.bodyBuild !== 48 || profile?.shoulderWidth !== 52 ||
        profile?.armSize !== 46 || profile?.legSize !== 50 || profile?.viewRotation !== 0
      );
    }
    return true;
  } catch {
    return false;
  }
}

export const SoloFranchiseHub: React.FC<Props> = ({ onOpen }) => {
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  if (ownerOpen) return <OwnerBusinessMode onBack={() => setOwnerOpen(false)} />;
  if (agentOpen) return <PlayerAgentMode onBack={() => setAgentOpen(false)} />;

  return (
  <BroadcastStage scene="field" page="solo" className="min-h-[100dvh] bg-transparent px-4 pb-10 pt-4 text-white sm:px-8">
    <div className="mx-auto max-w-6xl">
      <BroadcastMasthead eyebrow="The Ball Knower universe" title="Choose Your Road" subtitle="Run the team. Own the business. Represent the talent. Build your legacy."/>
      <div className="bk-mode-grid">
        <button type="button" className="bk-mode-card" onClick={()=>setAgentOpen(true)}><SoloModeArtwork seed={'agent'}/><BriefcaseBusiness/><div><small>PLAYER REPRESENTATION</small><strong>Agent Mode</strong><p>Build your agency. Recruit clients and negotiate their next move.</p><span className="bk-mode-continue">BUILD YOUR AGENCY</span></div><ChevronRight size={17}/></button>
        <button type="button" className="bk-mode-card" onClick={()=>setOwnerOpen(true)}><SoloModeArtwork seed={'owner'}/><Building2/><div><small>FRONT OFFICE / BUSINESS</small><strong>Owner Office</strong><p>Make the decisions that shape the entire organization.</p><span className="bk-mode-continue">ENTER OWNER OFFICE</span></div><ChevronRight size={17}/></button>
        {MODES.map(mode=>{const Icon=mode.icon;const saved=hasSave(mode.key);return <button key={mode.id} type="button" className="bk-mode-card" onClick={()=>onOpen(mode.id)}><SoloModeArtwork seed={mode.id}/><Icon/><div><small>{mode.eyebrow}</small><strong>{mode.title}</strong><p>{mode.description}</p><span className="bk-mode-continue">{saved?'RESUME FRANCHISE':'CREATE FRANCHISE'}</span></div><ChevronRight size={17}/></button>})}
      </div>
    </div>
  </BroadcastStage>
  );
};
