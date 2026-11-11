import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Coins, Crown, Footprints, Gem, Glasses, Hand, HardHat, Package, RotateCcw, Shirt, ShoppingCart, Star, UserRound } from 'lucide-react';
import './cleatsShop.css';

type Rarity = 'legendary' | 'elite' | 'rare';
type Cleats = { id: string; name: string; rarity: Rarity; price: number; accent: string; description: string };
type Filter = 'all' | Rarity | 'common';
type Sort = 'newest' | 'low' | 'high' | 'name';
export type CleatNavigation = 'featured' | 'characters' | 'clothing' | 'helmets' | 'jerseys' | 'pants' | 'cleats' | 'accessories' | 'bundles' | 'coins';

const CLEATS: readonly Cleats[] = [
  { id: 'gold-standard', name: 'Gold Standard', rarity: 'legendary', price: 3500, accent: '#f5bd36', description: 'A signature BK look. Gold-plated accents and a black performance upper built for the biggest moments.' },
  { id: 'frostbite', name: 'Frostbite', rarity: 'elite', price: 3000, accent: '#30c9ff', description: 'Ice-white traction cleats with electric-blue accents and frosted detailing.' },
  { id: 'shadow-ops', name: 'Shadow Ops', rarity: 'elite', price: 3000, accent: '#b6b8c5', description: 'Stealth black-on-black cleats with textured uppers and a smoked soleplate.' },
  { id: 'bloodline', name: 'Bloodline', rarity: 'legendary', price: 3250, accent: '#fc214d', description: 'Blood-red lightning against a glossy black upper, with matching red studs.' },
  { id: 'purple-reign', name: 'Purple Reign', rarity: 'elite', price: 3000, accent: '#b15bff', description: 'Royal violet and metallic-gold cleats with a bold BK crest.' },
  { id: 'camo-elite', name: 'Camo Elite', rarity: 'rare', price: 2250, accent: '#a9bc60', description: 'Woodland camouflage cleats with rugged black and gold trims.' },
  { id: 'neon-strike', name: 'Neon Strike', rarity: 'elite', price: 2750, accent: '#baff00', description: 'Black and neon-lime cleats with high-voltage accents and matching studs.' },
  { id: 'chrome-phantom', name: 'Chrome Phantom', rarity: 'legendary', price: 3250, accent: '#dce5f1', description: 'Polished chrome finish over a jet-black football cleat.' },
  { id: 'desert-storm', name: 'Desert Storm', rarity: 'rare', price: 2500, accent: '#e8bb81', description: 'Desert-tan camo cleats with black accents and durable stud detailing.' },
  { id: 'titanium-edge', name: 'Titanium Edge', rarity: 'elite', price: 2750, accent: '#3facff', description: 'Black carbon-fiber cleats with striking blue graphics and blue studs.' },
];
const formatCoins = (price: number) => price.toLocaleString('en-US');
const cleatsImage = (id: string) => `/store/bk-cleat-${id}.webp`;
const sideLinks: { id: CleatNavigation; label: string; icon: typeof Star }[] = [
  { id: 'featured', label: 'Featured', icon: Star },
  { id: 'characters', label: 'Characters', icon: UserRound },
  { id: 'clothing', label: 'Active Wear', icon: Shirt },
  { id: 'helmets', label: 'Helmets', icon: HardHat },
  { id: 'jerseys', label: 'Jerseys', icon: Shirt },
  { id: 'pants', label: 'Pants', icon: Shirt },
  { id: 'accessories', label: 'Accessories', icon: Glasses },
  { id: 'cleats', label: 'Cleats', icon: Footprints },
  { id: 'bundles', label: 'Bundles', icon: Package },
  { id: 'coins', label: 'BK Coins', icon: Coins },
];
const matchingGear = [
  { name: 'Gold Helmet', price: 2500, icon: HardHat },
  { name: 'Gold Jersey', price: 3000, icon: Shirt },
  { name: 'Gold Pants', price: 2750, icon: Shirt },
  { name: 'Gold Gloves', price: 750, icon: Hand },
] as const;

export default function CleatShop({ onNavigate }: { onNavigate: (destination: CleatNavigation) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [selectedId, setSelectedId] = useState('gold-standard');
  const [notice, setNotice] = useState<'buy' | 'three-d' | 'gear' | null>(null);
  const selected = CLEATS.find(item => item.id === selectedId) ?? CLEATS[0];
  const visible = useMemo(() => {
    const items = CLEATS.filter(item => filter === 'all' || item.rarity === filter);
    if (sort === 'low') items.sort((a, b) => a.price - b.price);
    if (sort === 'high') items.sort((a, b) => b.price - a.price);
    if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [filter, sort]);
  const move = (step: number) => {
    const current = CLEATS.findIndex(item => item.id === selectedId);
    setSelectedId(CLEATS[(current + step + CLEATS.length) % CLEATS.length].id);
    setNotice(null);
  };
  const choose = (id: string) => { setSelectedId(id); setNotice(null); };
  const styleFor = (item: Cleats) => ({ '--cleats-accent': item.accent } as CSSProperties);

  return <section className="bk-cleats" aria-label="BK Cleats Collection" data-cleats-store="true">
    <div className="bk-c-shell">
      <aside className="bk-c-side" aria-label="Store navigation">
        <button type="button" className="bk-c-brand" onClick={() => onNavigate('featured')}><ShoppingCart size={22}/><strong>BK Store</strong></button>
        <nav aria-label="Shop departments" className="bk-c-side-nav">
          {sideLinks.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={id === 'cleats' ? 'page' : undefined} onClick={() => id !== 'cleats' && onNavigate(id)}><Icon size={19} aria-hidden="true"/><span>{label}</span></button>)}
        </nav>
        <div className="bk-c-promo"><Crown size={35} aria-hidden="true"/><strong>BK<br/> Premium Gear</strong><small>Exclusive drops<br/> Limited time only</small></div>
      </aside>

      <div className="bk-c-main">
        <button type="button" className="bk-c-mobile-back" onClick={() => onNavigate('featured')}><ArrowLeft size={16}/> Back to Store</button>
        <div className="bk-c-hero" role="img" aria-label="Ball Knower Cleats Collection: elite gear, next-level style"><img src="/store/bk-cleat-hero.webp" alt="" fetchPriority="high"/><span className="bk-c-hero-reader">BK Cleats Collection · Elite leg gear. Next level style.</span></div>
        <div className="bk-c-toolbar">
          <div className="bk-c-filters" role="group" aria-label="Filter cleats by rarity">
            {(['all', 'legendary', 'elite', 'rare', 'common'] as Filter[]).map(kind =>
              <button type="button" key={kind} data-rarity={kind} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{kind === 'legendary' && <Crown size={14} aria-hidden="true"/>}{kind === 'elite' && <Gem size={14} aria-hidden="true"/>}{kind === 'rare' && <span className="bk-c-triangle" aria-hidden="true">△</span>}{kind.charAt(0).toUpperCase() + kind.slice(1)}</button>)}
          </div>
          <label className="bk-c-sort"><span className="bk-c-sr">Sort cleats</span><select aria-label="Sort cleats" value={sort} onChange={event => setSort(event.target.value as Sort)}><option value="newest">Sort: Newest</option><option value="low">Price: Low to High</option><option value="high">Price: High to Low</option><option value="name">Name: A-Z</option></select></label>
        </div>
        {visible.length === 0 ? <p className="bk-c-empty" role="status">No cleats in this rarity tier yet.</p> : <div className="bk-c-grid" aria-label="Ten premium cleats">
          {visible.map(item => <button key={item.id} className="bk-c-item" type="button" style={styleFor(item)} aria-pressed={selectedId === item.id} onClick={() => choose(item.id)} data-cleats={item.id}>
            <span className="bk-c-item-image"><img src={cleatsImage(item.id)} alt={`${item.name} BK football cleats`} loading="lazy" decoding="async"/></span>
            <span className="bk-c-tier" data-rarity={item.rarity}>{item.rarity === 'legendary' ? <Crown size={12}/> : item.rarity === 'elite' ? <Gem size={12}/> : <span aria-hidden="true">△</span>}{item.rarity}</span>
            <strong>{item.name}</strong><span className="bk-c-cost"><span className="bk-c-coin">BK</span>{formatCoins(item.price)}</span>
          </button>)}
        </div>}
      </div>

      <aside className="bk-c-detail" style={styleFor(selected)} aria-label={`${selected.name} cleats details`}>
        <div className="bk-c-detail-image" data-gold={selected.id === 'gold-standard' ? 'true' : undefined}>
          <button type="button" className="bk-c-360" onClick={() => setNotice('three-d')} aria-label="360-degree preview status"><RotateCcw size={22}/><span>360°</span></button>
          <img key={selected.id} src={selected.id === 'gold-standard' ? '/store/bk-cleat-gold-preview.webp' : cleatsImage(selected.id)} alt={`${selected.name} cleats concept artwork`}/>
          <button type="button" className="bk-c-step bk-c-step-left" onClick={() => move(-1)} aria-label="Previous cleats"><ChevronLeft size={29}/></button>
          <button type="button" className="bk-c-step bk-c-step-right" onClick={() => move(1)} aria-label="Next cleats"><ChevronRight size={29}/></button>
        </div>
        <div className="bk-c-details-body">
          <h2><Crown size={25} aria-hidden="true"/>{selected.name}</h2>
          <div className="bk-c-detail-tier">{selected.rarity} cleats</div>
          <p className="bk-c-desc">{selected.description}</p>
          <button type="button" className="bk-c-buy" onClick={() => setNotice('buy')}><span className="bk-c-price"><span className="bk-c-coin">BK</span>{formatCoins(selected.price)}</span><span>Buy Now</span><ShoppingCart size={20} aria-hidden="true"/></button>
          {notice && <p className="bk-c-notice" role="status">{notice === 'three-d' ? '360° cleats model is not available yet. This view shows the approved front and back artwork.' : notice === 'gear' ? 'Matching gear is a visual preview. Accessories are not for sale yet.' : 'Preview price only. BK Coin checkout is not enabled, and no coins have been deducted.'}</p>}
          <div className="bk-c-matching"><h3>Complete the Look</h3><div className="bk-c-matching-grid">
            {matchingGear.map(({ name, price }, index) => <button type="button" key={name} onClick={() => setNotice('gear')} aria-label={`${name}, ${formatCoins(price)} proposed BK Coins`}><span className="bk-c-matching-pic" style={{ backgroundPosition: `${index * 100 / 3}% center` }} aria-hidden="true"/><span className="bk-c-mini-price"><span className="bk-c-coin">BK</span>{formatCoins(price)}</span></button>)}
          </div></div>
          <p className="bk-c-disclaimer">Cleats artwork is a store concept. 3D wearable cleats and BK Coin purchases are not active yet.</p>
        </div>
      </aside>
    </div>
  </section>;
}