import React from 'react';

export function HomeSoloFeature({ onOpen }: { onOpen: () => void }) {
  return <section className="bk-home-solo-feature" aria-labelledby="home-solo-mode-heading">
    <button type="button" onClick={onOpen} aria-label="Play Solo Mode">
      <span id="home-solo-mode-heading" className="sr-only">Solo Mode</span>
      <img src="/solo-mode-home-cover.webp" alt="" loading="lazy" decoding="async" draggable={false}/>
    </button>
  </section>;
}
