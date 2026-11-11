import { ArrowRight, ChevronRight, Crown, Hand, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import './storeLandingShowcase.css';

export type PremiumDepartment = 'game-fits' | 'helmets' | 'jerseys' | 'pants' | 'cleats' | 'accessories';

const collections: {
  id: PremiumDepartment;
  number: string;
  label: string;
  tagline: string;
  image: string;
  accent: string;
}[] = [
  { id: 'helmets', number: '01', label: 'Helmets', tagline: 'Make your entrance', image: '/store/bk-helmet-gold-standard.webp', accent: '#dfae47' },
  { id: 'jerseys', number: '02', label: 'Jerseys', tagline: 'Own every snap', image: '/store/bk-jersey-gold-standard.webp', accent: '#dca13e' },
  { id: 'pants', number: '03', label: 'Pants', tagline: 'Style in motion', image: '/store/bk-pants-gold-standard.webp', accent: '#d8a94c' },
  { id: 'cleats', number: '04', label: 'Cleats', tagline: 'Leave your mark', image: '/store/bk-cleat-gold-standard.webp', accent: '#edc66e' },
  { id: 'accessories', number: '05', label: 'Accessories', tagline: 'The final touch', image: '/store/bk-accessory-gold-standard.webp', accent: '#e2b458' },
];

const spotlight: {
  id: PremiumDepartment;
  label: string;
  image: string;
}[] = [
  { id: 'helmets', label: 'Helmet', image: '/store/bk-helmet-gold-standard.webp' },
  { id: 'jerseys', label: 'Jersey', image: '/store/bk-jersey-gold-standard.webp' },
  { id: 'pants', label: 'Pants', image: '/store/bk-pants-gold-standard.webp' },
  { id: 'cleats', label: 'Cleats', image: '/store/bk-cleat-gold-standard.webp' },
];

export default function StoreLandingShowcase({
  onNavigate,
  onTunnelFits,
}: {
  onNavigate: (id: PremiumDepartment) => void;
  onTunnelFits: () => void;
}) {
  return <div className="bk-vault-landing">
    <section className="bk-vault-hero" aria-labelledby="bk-vault-hero-title">
      <img className="bk-vault-hero-athlete" src="/store/bk-accessory-gold-player.webp" alt="Football player wearing premium gold-and-black Ball Knower equipment" fetchPriority="high" />
      <div className="bk-vault-hero-content">
        <span className="bk-vault-eyebrow"><Crown size={16} aria-hidden="true"/> Welcome to the BK vault</span>
        <h2 id="bk-vault-hero-title">YOUR GAME.<br/><em>YOUR LOOK.</em></h2>
        <p>The gear hits different when it's yours. Build a full BK game-day fit, piece by piece.</p>
        <div className="bk-vault-hero-actions">
          <button type="button" className="bk-vault-gold-action" onClick={() => onNavigate('game-fits')}>Explore game gear <ArrowRight size={17} aria-hidden="true"/></button>
          <button type="button" className="bk-vault-outline-action" onClick={onTunnelFits}>Tunnel fits <ChevronRight size={16} aria-hidden="true"/></button>
        </div>
      </div>
      <div className="bk-vault-hero-footer"><Sparkles size={14} aria-hidden="true"/> Five collections · 50 individual styles · Preview only</div>
    </section>

    <section className="bk-vault-collections" id="bk-store-premium-categories" aria-labelledby="bk-vault-collections-title">
      <div className="bk-vault-heading">
        <div><span className="bk-vault-overline">The equipment vault</span><h2 id="bk-vault-collections-title">BUILD YOUR LOADOUT</h2></div>
        <span className="bk-vault-collection-count">05 collections</span>
      </div>
      <div className="bk-vault-category-grid">
        {collections.map(collection => <button
          type="button"
          className="bk-vault-category-card"
          key={collection.id}
          style={{'--bk-vault-accent': collection.accent} as CSSProperties}
          onClick={() => onNavigate(collection.id)}
          aria-label={`Shop ${collection.label}, 10 designs`}
        >
          <span className="bk-vault-category-count">{collection.number} / 05</span>
          <img src={collection.image} alt="" loading="lazy" decoding="async"/>
          <span className="bk-vault-category-content">
            <span className="bk-vault-category-tag">10 premium designs</span>
            <strong>{collection.label}</strong>
            <span className="bk-vault-category-bottom"><span>{collection.tagline}</span><span className="bk-vault-category-arrow"><ArrowRight size={16} aria-hidden="true"/></span></span>
          </span>
        </button>)}
      </div>
    </section>

    <section className="bk-vault-spotlight" aria-labelledby="bk-vault-spotlight-title">
      <div className="bk-vault-spotlight-head"><span className="bk-vault-spotlight-crown"><Crown size={24} aria-hidden="true"/></span><div><span className="bk-vault-overline">Signature set</span><h2 id="bk-vault-spotlight-title">GOLD STANDARD</h2></div></div>
      <p>Four matching pieces. One complete look. Explore each collection and build your own set.</p>
      <div className="bk-vault-spotlight-grid">
        {spotlight.map(item => <button key={item.id} type="button" onClick={() => onNavigate(item.id)} aria-label={`Explore Gold Standard ${item.label.toLowerCase()} collection`}>
          <img src={item.image} alt="" loading="lazy" decoding="async"/>
          <span>{item.label}<ChevronRight size={13} aria-hidden="true"/></span>
        </button>)}
      </div>
      <button type="button" className="bk-vault-accessory-cta" onClick={() => onNavigate('accessories')}><Hand size={18} aria-hidden="true"/><span>Finish the look with accessories</span><ArrowRight size={18} aria-hidden="true"/></button>
    </section>
  </div>;
}
