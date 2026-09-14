import React from 'react';
import { ArrowRight } from 'lucide-react';

const FEATURE_PLAYERS = [
  { id: 'kendrick-fairmont', role: 'qb', src: '/solo-characters/v2/qa/solo-brk-02/card.webp' },
  { id: 'cameron-gaines', role: 'edge', src: '/solo-characters/v2/qa/solo-brk-30/card.webp' },
  { id: 'leo-fairmont', role: 'rb', src: '/solo-characters/v2/qa/solo-brk-05/card.webp' },
  { id: 'eli-rodriguez', role: 'eli', src: '/solo-characters/v2/eli-rodriguez/card.webp' },
] as const;

export function HomeSoloFeature({ onOpen }: { onOpen: () => void }) {
  return <section className="bk-home-solo-feature" aria-labelledby="home-solo-mode-heading">
    <button type="button" onClick={onOpen} aria-describedby="home-solo-mode-description">
      <span className="bk-home-solo-art" aria-hidden="true">
        {FEATURE_PLAYERS.map(player => <img
          key={player.id}
          className={`bk-home-solo-player bk-home-solo-player-${player.role}`}
          src={player.src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
        />)}
      </span>
      <span className="bk-home-solo-shade" aria-hidden="true"/>
      <span className="bk-home-solo-copy">
        <small>Ball Knower Football</small>
        <strong id="home-solo-mode-heading"><span>Solo</span> Mode</strong>
        <em id="home-solo-mode-description">Build your legacy</em>
        <span className="bk-home-solo-cta">Play Solo <ArrowRight size={18} aria-hidden="true"/></span>
      </span>
      <span className="bk-home-solo-kicker" aria-hidden="true">More than fantasy</span>
    </button>
  </section>;
}
