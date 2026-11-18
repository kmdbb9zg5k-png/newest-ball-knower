import React from 'react';
import { ArrowRight, Brain, Flag, Shield, Target, Trophy } from 'lucide-react';
import type { AppTab } from './App';
import { HomeMiniGamesFeature } from './HomeMiniGamesFeature';
import { ModeHelp } from './ModeHelp';
import './homeLayout.css';
import './playHub.css';
import './playSectionArt.css';

export function PlayHub({ onNavigate }: { onNavigate: (tab: AppTab) => void }) {
  return <div className="bk-play-hub" data-testid="play-hub">
    <header className="bk-play-heading"><div><p>Make your next play</p><h1>Play your game.</h1><span>Quick games, long careers and a chance to prove you know ball.</span></div><ModeHelp mode="play" autoOpen={false}/></header>
    <HomeMiniGamesFeature compact onOpenFootball={() => onNavigate('football')}/>
    <button type="button" className="bk-play-legends" onClick={() => onNavigate('legends')}>
      <Trophy aria-hidden="true"/><span><small>Build your squad</small><strong>BK Legends</strong><span>80 challenges on the Road to Legend.</span></span><ArrowRight aria-hidden="true"/>
    </button>
    <section className="bk-play-choices" aria-label="Choose how to play">
      <button type="button" className="bk-play-careers" onClick={() => onNavigate('solo')}>
        <img src="/solo-mode-scenes/franchise-command.webp" alt="" width="306" height="342" loading="lazy"/>
        <span className="bk-play-card-copy"><Flag aria-hidden="true"/><small>Solo Mode</small><strong>Build your legacy.</strong><span>Manage a franchise, run an agency or create your player. Your saved careers continue in Solo.</span><b>Open Solo careers <ArrowRight aria-hidden="true"/></b></span>
      </button>
      <button type="button" className="bk-play-online" onClick={() => onNavigate('football')}>
        <img src="/community/arena-h2h-v1.webp" alt="" width="640" height="427" loading="lazy" decoding="async"/>
        <span className="bk-play-card-copy"><Shield aria-hidden="true"/><small>Online football</small><strong>Meet on the field.</strong><span>Challenge a friend or find an opponent. Play three drives against their CPU defense.</span><b>Enter online arena <ArrowRight aria-hidden="true"/></b></span>
      </button>
    </section>
    <section className="bk-play-knowledge" aria-label="Prove you know ball">
      <div><p>Prove you know ball</p><h2>Every decision counts.</h2></div>
      <button type="button" className="bk-play-trivia-art" onClick={() => onNavigate('challenges')}><img src="/community/arena-film-room-mobile-v1.webp" width="768" height="512" alt="" loading="lazy" decoding="async"/><Brain aria-hidden="true"/><span><strong>Trivia</strong><small>Answer questions. Climb the rankings.</small></span><ArrowRight aria-hidden="true"/></button>
      <button type="button" className="bk-play-picks-art" onClick={() => onNavigate('sportsbook')}><img src="/community/arena-mini-games-v1.webp" width="640" height="427" alt="" loading="lazy" decoding="async"/><Target aria-hidden="true"/><span><strong>NFL picks</strong><small>Call the winners. Build your record.</small></span><ArrowRight aria-hidden="true"/></button>
    </section>
  </div>;
}
