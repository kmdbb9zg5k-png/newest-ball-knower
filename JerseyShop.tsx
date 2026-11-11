import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Coins, Crown, Footprints, Gem, Glasses, Hand, HardHat, Package, RotateCcw, Shirt, ShoppingCart, Star, UserRound } from 'lucide-react';
import './jerseyShop.css';

type Rarity = 'legendary' | 'elite' | 'rare';
type Jersey = { id: string; name: string; rarity: Rarity; price: number; accent: string; description: string };
type Filter = 'all' | Rarity | 'common';
type Sort = 'newest' | 'low' | 'high' | 'name';
export type JerseyNavigation = 'featured' | 'characters' | 'clothing' | 'helmets' | 'jerseys' | 'pants' | 'accessories' | 'cleats' | 'bundles' | 'coins';

const JERSEYS: readonly Jersey[] = [
  { id: 'gold-standard', name: 'Gold Standard', rarity: 'legendary', price: 2500, accent: '#f5bd36', description: 'A signature BK look. Premium materials, elite detail, and game-day dominance.' },
  { id: 'frostbite', name: 'Frostbite', rarity: 'elite', price: 2000, accent: '#30c9ff', description: 'Crystal-white frost textures, silver panels and electric blue trim.' },
  { id: 'shadow-ops', name: 'Shadow Ops', rarity: 'elite', price: 2000, accent: '#b6b8c5', description: 'Stealth-black carbon weave, tactical panels and smoke-gray stripes.' },
  { id: 'bloodline', name: 'Bloodline', rarity: 'legendary', price: 2750, accent: '#fc214d', description: 'Crimson lightning runs across a glossy black game-day jersey.' },
  { id: 'purple-reign', name: 'Purple Reign', rarity: 'elite', price: 2500, accent: '#b15bff', description: 'Royal purple shine with metallic gold crowns and premium trim.' },
  { id: 'camo-elite', name: 'Camo Elite', rarity: 'rare', price: 1500, accent: '#a9bc60', description: 'Woodland camouflage with olive detailing and black performance panels.' },
  { id: 'neon-strike', name: 'Neon Strike', rarity: 'elite', price: 2250, accent: '#baff00', description: 'High-voltage neon-lime details over a jet-black performance jersey.' },
  { id: 'chrome-phantom', name: 'Chrome Phantom', rarity: 'legendary', price: 2750, accent: '#dce5f1', description: 'Mirror-polished chrome panels and black-on-black luxury trim.' },
  { id: 'desert-storm', name: 'Desert Storm', rarity: 'rare', price: 1750, accent: '#e8bb81', description: 'Sand-toned digital camo with warm tan and black details.' },
  { id: 'titanium-edge', name: 'Titanium Edge', rarity: 'elite', price: 2250, accent: '#3facff', description: 'Carbon-black texture and vivid electric-blue performance lines.' },
];
const formatCoins = (price: number) => price.toLocaleString('en-US');
const jerseyImage = (id: string) => `/store/bk-jersey-${id}.webp`;
const sideLinks: { id: JerseyNavigation; label: string; icon: typeof Star }[] = [
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
  { name: 'Gold Gloves', price: 750, icon: Hand },
  { name: 'Gold Sleeve', price: 500, icon: Shirt },
  { name: 'Gold Cleats', price: 1250, icon: Footprints },
  { name: 'Gold Visor', price: 500, icon: Glasses },
] as const;

export default function JerseyShop({ onNavigate }: { onNavigate: (destination: JerseyNavigation) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [selectedId, setSelectedId] = useState('gold-standard');
  const [notice, setNotice] = useState<'buy' | 'three-d' | 'gear' | null>(null);
  const selected = JERSEYS.find(item => item.id === selectedId) ?? JERSEYS[0];
  const visible = useMemo(() => {
    const items = JERSEYS.filter(item => filter === 'all' || item.rarity === filter);
    if (sort === 'low') items.sort((a, b) => a.price - b.price);
    if (sort === 'high') items.sort((a, b) => b.price - a.price);
    if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [filter, sort]);
  const move = (step: number) => {
    const current = JERSEYS.findIndex(item => item.id === selectedId);
    setSelectedId(JERSEYS[(current + step + JERSEYS.length) % JERSEYS.length].id);
    setNotice(null);
  };
  const choose = (id: string) => { setSelectedId(id); setNotice(null); };
  const styleFor = (item: Jersey) => ({ '--jersey-accent': item.accent } as CSSProperties);

  return <section className="bk-jerseys" aria-label="BK Jersey Collection" data-jersey-store="true">
    <div className="bk-j-shell">
      <aside className="bk-j-side" aria-label="Store navigation">
        <button type="button" className="bk-j-brand" onClick={() => onNavigate('featured')}><ShoppingCart size={22}/><strong>BK Store</strong></button>
        <nav aria-label="Shop departments" className="bk-j-side-nav">
          {sideLinks.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={id === 'jerseys' ? 'page' : undefined} onClick={() => id !== 'jerseys' && onNavigate(id)}><Icon size={19} aria-hidden="true"/><span>{label}</span></button>)}
        </nav>
        <div className="bk-j-promo"><Crown size={35} aria-hidden="true"/><strong>BK<br/> Premium Gear</strong><small>Exclusive drops<br/> Limited time only</small></div>
      </aside>

      <div className="bk-j-main">
        <button type="button" className="bk-j-mobile-back" onClick={() => onNavigate('featured')}><ArrowLeft size={16}/> Back to Store</button>
        <div className="bk-j-hero" role="img" aria-label="Ball Knower Jersey Collection: elite gear, next-level style"><img src="/store/bk-jersey-hero.webp" alt="" fetchPriority="high"/><span className="bk-j-hero-reader">BK Jersey Collection · Elite gear. Next level style.</span></div>
        <div className="bk-j-toolbar">
          <div className="bk-j-filters" role="group" aria-label="Filter jerseys by rarity">
            {(['all', 'legendary', 'elite', 'rare', 'common'] as Filter[]).map(kind =>
              <button type="button" key={kind} data-rarity={kind} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{kind === 'legendary' && <Crown size={14} aria-hidden="true"/>}{kind === 'elite' && <Gem size={14} aria-hidden="true"/>}{kind === 'rare' && <span className="bk-j-triangle" aria-hidden="true">△</span>}{kind.charAt(0).toUpperCase() + kind.slice(1)}</button>)}
          </div>
          <label className="bk-j-sort"><span className="bk-j-sr">Sort jerseys</span><select aria-label="Sort jerseys" value={sort} onChange={event => setSort(event.target.value as Sort)}><option value="newest">Sort: Newest</option><option value="low">Price: Low to High</option><option value="high">Price: High to Low</option><option value="name">Name: A-Z</option></select></label>
        </div>
        {visible.length === 0 ? <p className="bk-j-empty" role="status">No jerseys in this rarity tier yet.</p> : <div className="bk-j-grid" aria-label="Ten premium jerseys">
          {visible.map(item => <button key={item.id} className="bk-j-item" type="button" style={styleFor(item)} aria-pressed={selectedId === item.id} onClick={() => choose(item.id)} data-jersey={item.id}>
            <span className="bk-j-item-image"><img src={jerseyImage(item.id)} alt={`${item.name} BK football jersey`} loading="lazy" decoding="async"/></span>
            <span className="bk-j-tier" data-rarity={item.rarity}>{item.rarity === 'legendary' ? <Crown size={12}/> : item.rarity === 'elite' ? <Gem size={12}/> : <span aria-hidden="true">△</span>}{item.rarity}</span>
            <strong>{item.name}</strong><span className="bk-j-cost"><span className="bk-j-coin">BK</span>{formatCoins(item.price)}</span>
          </button>)}
        </div>}
      </div>

      <aside className="bk-j-detail" style={styleFor(selected)} aria-label={`${selected.name} jersey details`}>
        <div className="bk-j-detail-image" data-gold={selected.id === 'gold-standard' ? 'true' : undefined}>
          <button type="button" className="bk-j-360" onClick={() => setNotice('three-d')} aria-label="360-degree preview status"><RotateCcw size={22}/><span>360°</span></button>
          <img key={selected.id} src={jerseyImage(selected.id)} alt={`${selected.name} jersey concept artwork`}/>
          <button type="button" className="bk-j-step bk-j-step-left" onClick={() => move(-1)} aria-label="Previous jersey"><ChevronLeft size={29}/></button>
          <button type="button" className="bk-j-step bk-j-step-right" onClick={() => move(1)} aria-label="Next jersey"><ChevronRight size={29}/></button>
        </div>
        <div className="bk-j-details-body">
          <h2><Crown size={25} aria-hidden="true"/>{selected.name}</h2>
          <div className="bk-j-detail-tier">{selected.rarity} jersey</div>
          <p className="bk-j-desc">{selected.description}</p>
          <button type="button" className="bk-j-buy" onClick={() => setNotice('buy')}><span className="bk-j-price"><span className="bk-j-coin">BK</span>{formatCoins(selected.price)}</span><span>Buy Now</span><ShoppingCart size={20} aria-hidden="true"/></button>
          {notice && <p className="bk-j-notice" role="status">{notice === 'three-d' ? '360° jersey model is not available yet. This view shows the approved front and back artwork.' : notice === 'gear' ? 'Matching gear is a visual preview. Accessories are not for sale yet.' : 'Preview price only. BK Coin checkout is not enabled, and no coins have been deducted.'}</p>}
          <div className="bk-j-matching"><h3>Complete the Look</h3><div className="bk-j-matching-grid">
            {matchingGear.map(({ name, price }, index) => <button type="button" key={name} onClick={() => setNotice('gear')} aria-label={`${name}, ${formatCoins(price)} proposed BK Coins`}><span className="bk-j-matching-pic" style={{ backgroundPosition: `${index * 100 / 3}% center` }} aria-hidden="true"/><span className="bk-j-mini-price"><span className="bk-j-coin">BK</span>{formatCoins(price)}</span></button>)}
          </div></div>
          <p className="bk-j-disclaimer">Jersey artwork is a store concept. 3D wearable jerseys and BK Coin purchases are not active yet.</p>
        </div>
      </aside>
    </div>
  </section>;
}