import React from 'react';
import { BadgeDollarSign, BriefcaseBusiness, Building2, ChevronRight, Shuffle } from 'lucide-react';

const soloRoads = [
  {
    eyebrow: 'PLAYER REPRESENTATION',
    title: 'AGENT MODE',
    description: 'Build your agency. Recruit clients and negotiate their next move.',
    action: 'BUILD YOUR AGENCY',
    icon: BriefcaseBusiness,
    portrait: '/solo-characters/v2/qa/solo-slc-05/card.webp',
  },
  {
    eyebrow: 'FRONT OFFICE / BUSINESS',
    title: 'OWNER OFFICE',
    description: 'Make the decisions that shape the entire organization.',
    action: 'ENTER OWNER OFFICE',
    icon: Building2,
    portrait: '/solo-characters/v2/qa/solo-brk-10/card.webp',
  },
  {
    eyebrow: 'THE ORIGINAL',
    title: 'CAP CHALLENGE',
    description: 'Draft your 20-player superteam under the cap, then survive 17 games and the playoffs.',
    action: 'START THE CHALLENGE',
    icon: BadgeDollarSign,
    portrait: '/solo-characters/v2/qa/solo-brk-21/card.webp',
  },
  {
    eyebrow: 'CREATE YOUR LEAGUE',
    title: 'FANTASY DRAFT',
    description: 'Create a custom football team, draft a full 53-man roster, then play a 17-game season.',
    action: 'CREATE FRANCHISE',
    icon: Shuffle,
    portrait: '/solo-characters/v2/qa/solo-slc-45/card.webp',
  },
];

export function HomeSoloFeature({ onOpen }: { onOpen: () => void }) {
  return <section className="bk-home-solo-feature" aria-labelledby="home-solo-mode-heading">
    <button type="button" className="bk-home-solo-hero" onClick={onOpen} aria-label="Explore Solo Mode">
      <img src="/solo-universe-edition.webp" alt="" fetchPriority="high" decoding="async" draggable={false}/>
    </button>
    <div className="bk-home-solo-heading">
      <p>THE BALL KNOWER UNIVERSE</p>
      <h2 id="home-solo-mode-heading">CHOOSE YOUR ROAD</h2>
      <span>Run the team. Own the business. Represent the talent. Build your legacy.</span>
    </div>
    <div className="bk-home-solo-roads">
      {soloRoads.map(road => { const Icon = road.icon; return <button type="button" key={road.title} onClick={onOpen} aria-label={`Open ${road.title}`}>
        <img src={road.portrait} alt="" loading="lazy" decoding="async" aria-hidden="true"/>
        <span className="bk-home-solo-road-icon" aria-hidden="true"><Icon/></span>
        <span className="bk-home-solo-road-copy"><small>{road.eyebrow}</small><strong>{road.title}</strong><p>{road.description}</p><b>{road.action}<ChevronRight/></b></span>
      </button>})}
    </div>
  </section>;
}
