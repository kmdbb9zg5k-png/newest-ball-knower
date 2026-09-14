import {BroadcastStage} from './BroadcastScene';
import React, { useState } from 'react';
import { BadgeDollarSign, BriefcaseBusiness, Building2, ChevronRight, Shuffle, Sparkles, Users } from 'lucide-react';
import { SOLO_FRANCHISE_SAVE_KEYS } from './soloFranchiseEngine';
import { OwnerBusinessMode } from './OwnerBusinessMode';
import { PlayerAgentMode } from './PlayerAgentMode';

export type SoloExperience = 'hub' | 'cap' | 'fantasy' | 'real' | 'player';

type Props = {
  onOpen: (experience: Exclude<SoloExperience, 'hub'>) => void;
};

type SceneKey = 'agent' | 'owner' | Exclude<SoloExperience, 'hub'>;

type SceneArt = {
  src: string;
  width: number;
  height: number;
  position: string;
};

const MODE_SCENES: Record<SceneKey, SceneArt> = {
  agent: {
    src: '/solo-mode-scenes/agent-mode.webp',
    width: 304,
    height: 368,
    position: '66% center',
  },
  owner: {
    src: '/solo-mode-scenes/owner-office.webp',
    width: 306,
    height: 368,
    position: '58% center',
  },
  cap: {
    src: '/solo-mode-scenes/cap-challenge.webp',
    width: 420,
    height: 211,
    position: '72% center',
  },
  fantasy: {
    src: '/solo-mode-scenes/fantasy-draft.webp',
    width: 304,
    height: 342,
    position: '56% center',
  },
  real: {
    src: '/solo-mode-scenes/franchise-command.webp',
    width: 306,
    height: 342,
    position: '66% center',
  },
  player: {
    src: '/solo-mode-scenes/my-player.webp',
    width: 638,
    height: 349,
    position: '69% center',
  },
};

const MODE_EYEBROW_STYLE: React.CSSProperties = {
  display: 'inline-block',
  width: 'fit-content',
  maxWidth: '100%',
  padding: '4px 7px',
  marginBottom: '7px',
  borderRadius: '999px',
  border: '1px solid rgba(223,185,84,.28)',
  background: 'rgba(5,8,12,.86)',
  color: '#f1f5fa',
  fontWeight: 900,
  lineHeight: 1.25,
  textShadow: '0 1px 3px rgba(0,0,0,.9)',
  boxShadow: '0 2px 8px rgba(0,0,0,.45)',
};

const MODE_TITLE_STYLE: React.CSSProperties = {
  color: '#fff6dc',
  textShadow: '0 2px 8px rgba(0,0,0,.95)',
};

const MODE_DESCRIPTION_STYLE: React.CSSProperties = {
  color: '#dce3ed',
  fontWeight: 600,
  textShadow: '0 1px 6px rgba(0,0,0,.9)',
};

const MODE_CONTINUE_STYLE: React.CSSProperties = {
  color: '#f0c96a',
  textShadow: '0 1px 4px rgba(0,0,0,.9)',
};

function ModeSceneArt({ seed }: { seed: SceneKey }) {
  const art = MODE_SCENES[seed];

  return (
    <span
      aria-hidden="true"
      data-scene-art={seed}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    >
      <img
        src={art.src}
        alt=""
        loading="lazy"
        decoding="async"
        width={art.width}
        height={art.height}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: art.position,
          opacity: 0.72,
          filter: 'saturate(.9) contrast(1.05)',
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg,rgba(4,7,11,.97) 0%,rgba(4,7,11,.92) 44%,rgba(4,7,11,.62) 72%,rgba(4,7,11,.30) 100%),linear-gradient(180deg,rgba(0,0,0,.18),rgba(0,0,0,.55))',
        }}
      />
    </span>
  );
}

const MODES = [
  {
    id: 'cap' as const,
    eyebrow: 'THE ORIGINAL',
    title: 'CAP CHALLENGE',
    description: 'Draft your 20-player superteam under the cap, then survive 17 games and the playoffs.',
    icon: BadgeDollarSign,
    key: SOLO_FRANCHISE_SAVE_KEYS.cap,
  },
  {
    id: 'fantasy' as const,
    eyebrow: 'CREATE YOUR LEAGUE',
    title: 'FANTASY DRAFT',
    description: 'Create a custom football team, draft a full 53-man roster, then play a 17-game season through the Legacy Bowl.',
    icon: Shuffle,
    key: SOLO_FRANCHISE_SAVE_KEYS.fantasy,
  },
  {
    id: 'real' as const,
    eyebrow: 'SIMULATED ROSTERS',
    title: 'FRANCHISE COMMAND',
    description: 'Run football operations: shape a simulated roster, answer coaches, make deals and chase a championship.',
    icon: Users,
    key: SOLO_FRANCHISE_SAVE_KEYS.real,
  },
  {
    id: 'player' as const,
    eyebrow: 'STORY MODE',
    title: 'MY PLAYER',
    description: 'Create yourself, get drafted, earn XP and upgrade your ratings through a Ball Knower League career.',
    icon: Sparkles,
    key: SOLO_FRANCHISE_SAVE_KEYS.player,
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
    <BroadcastStage scene="field" page="solo" className="min-h-[100dvh] bg-transparent pb-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="bk-solo-universe-hero" aria-hidden="true">
          <img
            src="/solo-universe-edition.jpg?v=2"
            alt=""
            width="816"
            height="1203"
            fetchPriority="high"
            decoding="async"
            draggable={false}
          />
        </div>

        <header className="bk-solo-universe-heading">
          <p>THE BALL KNOWER UNIVERSE</p>
          <h1>CHOOSE YOUR ROAD</h1>
          <span>Run the team. Own the business. Represent the talent. Build your legacy.</span>
        </header>

        <div className="bk-mode-grid bk-solo-universe-grid">
          <button type="button" className="bk-mode-card" onClick={() => setAgentOpen(true)}>
            <BriefcaseBusiness style={{ zIndex: 2 }} />
            <ModeSceneArt seed="agent" />
            <div>
              <small style={MODE_EYEBROW_STYLE}>PLAYER REPRESENTATION</small>
              <strong style={MODE_TITLE_STYLE}>Agent Mode</strong>
              <p style={MODE_DESCRIPTION_STYLE}>Build your agency. Recruit clients and negotiate their next move.</p>
              <span className="bk-mode-continue" style={MODE_CONTINUE_STYLE}>BUILD YOUR AGENCY</span>
            </div>
            <ChevronRight size={17} style={{ zIndex: 2 }} />
          </button>

          <button type="button" className="bk-mode-card" onClick={() => setOwnerOpen(true)}>
            <Building2 style={{ zIndex: 2 }} />
            <ModeSceneArt seed="owner" />
            <div>
              <small style={MODE_EYEBROW_STYLE}>FRONT OFFICE / BUSINESS</small>
              <strong style={MODE_TITLE_STYLE}>Owner Office</strong>
              <p style={MODE_DESCRIPTION_STYLE}>Make the decisions that shape the entire organization.</p>
              <span className="bk-mode-continue" style={MODE_CONTINUE_STYLE}>ENTER OWNER OFFICE</span>
            </div>
            <ChevronRight size={17} style={{ zIndex: 2 }} />
          </button>

          {MODES.map(mode => {
            const Icon = mode.icon;
            const saved = hasSave(mode.key);

            return (
              <button
                key={mode.id}
                type="button"
                className="bk-mode-card"
                onClick={() => onOpen(mode.id)}
              >
                <Icon style={{ zIndex: 2 }} />
                <ModeSceneArt seed={mode.id} />
                <div>
                  <small style={MODE_EYEBROW_STYLE}>{mode.eyebrow}</small>
                  <strong style={MODE_TITLE_STYLE}>{mode.title}</strong>
                  <p style={MODE_DESCRIPTION_STYLE}>{mode.description}</p>
                  <span className="bk-mode-continue" style={MODE_CONTINUE_STYLE}>
                    {saved ? 'RESUME FRANCHISE' : 'CREATE FRANCHISE'}
                  </span>
                </div>
                <ChevronRight size={17} style={{ zIndex: 2 }} />
              </button>
            );
          })}
        </div>
      </div>
    </BroadcastStage>
  );
};
