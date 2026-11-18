import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Coins, Crown, Footprints, Gem, Glasses, Hand, HardHat, Package, RotateCcw, Shirt, ShoppingCart, Star, UserRound } from 'lucide-react';
import { HELMETS, type StoreHelmet as Helmet } from './storeGearCatalog';
import type { StoreGearCartAction } from './storeCart';
import './helmetShop.css';

type Rarity = 'legendary' | 'elite' | 'rare';
type Filter = 'all' | Rarity | 'common';
type Sort = 'newest' | 'low' | 'high' | 'name';
export type HelmetNavigation = 'featured' | 'characters' | 'clothing' | 'helmets' | 'jerseys' | 'pants' | 'accessories' | 'cleats' | 'bundles' | 'coins';

const formatCoins = (price: number) => price.toLocaleString('en-US');
const helmetImage = (id: string) => `/store/bk-helmet-${id}.webp`;
const sideLinks: { id: HelmetNavigation; label: string; icon: typeof Star }[] = [
  { id: 'featured', label: 'Featured', icon: Star },
  { id: 'characters', label: 'Characters', icon: UserRound },
  { id: 'clothing', label: 'Active Wear', icon: Shirt },
  { id: 'helmets', label: 'Helmets', icon: HardHat },
  { id: 'jerseys', label: 'Jerseys', icon: Shirt },
  { id: 'pants', label: 'Pants', icon: Shirt },
  { id: 'jerseys', label: 'Jerseys', icon: Shirt },
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

export default function HelmetShop({ onNavigate, cartAction }: { cartAction: StoreGearCartAction; onNavigate: (destination: HelmetNavigation) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [selectedId, setSelectedId] = useState('gold-standard');
  const [notice, setNotice] = useState<'three-d' | 'gear' | null>(null);
  const selected = HELMETS.find(item => item.id === selectedId) ?? HELMETS[0];
  const visible = useMemo(() => {
    const items = HELMETS.filter(item => filter === 'all' || item.rarity === filter);
    if (sort === 'low') items.sort((a, b) => a.price - b.price);
    if (sort === 'high') items.sort((a, b) => b.price - a.price);
    if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [filter, sort]);
  const move = (step: number) => {
    const current = HELMETS.findIndex(item => item.id === selectedId);
    setSelectedId(HELMETS[(current + step + HELMETS.length) % HELMETS.length].id);
    setNotice(null);
  };
  const choose = (id: string) => { setSelectedId(id); setNotice(null); };
  const styleFor = (item: Helmet) => ({ '--helmet-accent': item.accent } as CSSProperties);

  return <section className="bk-helmets" aria-label="BK Helmet Collection" data-helmet-store="true">
    <div className="bk-h-shell">
      <aside className="bk-h-side" aria-label="Store navigation">
        <button type="button" className="bk-h-brand" onClick={() => onNavigate('featured')}><ShoppingCart size={22}/><strong>BK Store</strong></button>
        <nav aria-label="Shop departments" className="bk-h-side-nav">
          {sideLinks.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={id === 'helmets' ? 'page' : undefined} onClick={() => id !== 'helmets' && onNavigate(id)}><Icon size={19} aria-hidden="true"/><span>{label}</span></button>)}
        </nav>
        <div className="bk-h-promo"><Crown size={35} aria-hidden="true"/><strong>BK<br/> Premium Gear</strong><small>Exclusive drops<br/> Limited time only</small></div>
      </aside>

      <div className="bk-h-main">
        <button type="button" className="bk-h-mobile-back" onClick={() => onNavigate('featured')}><ArrowLeft size={16}/> Back to Store</button>
        <div className="bk-h-hero" role="img" aria-label="Ball Knower Helmet Collection: elite gear, next-level style"><img src="/store/bk-helmet-hero.webp" alt="" fetchPriority="high"/><span className="bk-h-hero-reader">BK Helmet Collection · Elite gear. Next level style.</span></div>
        <div className="bk-h-toolbar">
          <div className="bk-h-filters" role="group" aria-label="Filter helmets by rarity">
            {(['all', 'legendary', 'elite', 'rare', 'common'] as Filter[]).map(kind =>
              <button type="button" key={kind} data-rarity={kind} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{kind === 'legendary' && <Crown size={14} aria-hidden="true"/>}{kind === 'elite' && <Gem size={14} aria-hidden="true"/>}{kind === 'rare' && <span className="bk-h-triangle" aria-hidden="true">△</span>}{kind.charAt(0).toUpperCase() + kind.slice(1)}</button>)}
          </div>
          <label className="bk-h-sort"><span className="bk-h-sr">Sort helmets</span><select aria-label="Sort helmets" value={sort} onChange={event => setSort(event.target.value as Sort)}><option value="newest">Sort: Newest</option><option value="low">Price: Low to High</option><option value="high">Price: High to Low</option><option value="name">Name: A-Z</option></select></label>
        </div>
        {visible.length === 0 ? <p className="bk-h-empty" role="status">No helmets in this rarity tier yet.</p> : <div className="bk-h-grid" aria-label="Ten premium helmets">
          {visible.map(item => <div className="bk-store-card-with-action" key={item.id}><button className="bk-h-item" type="button" style={styleFor(item)} aria-pressed={selectedId === item.id} onClick={() => choose(item.id)} data-helmet={item.id}>
            <span className="bk-h-item-image"><img src={helmetImage(item.id)} alt={`${item.name} BK football helmet`} loading="lazy" decoding="async"/></span>
            <span className="bk-h-tier" data-rarity={item.rarity}>{item.rarity === 'legendary' ? <Crown size={12}/> : item.rarity === 'elite' ? <Gem size={12}/> : <span aria-hidden="true">△</span>}{item.rarity}</span>
            <strong>{item.name}</strong><span className="bk-h-cost"><span className="bk-h-coin">BK</span>{formatCoins(item.price)}</span>
          </button>{cartAction(item.id, item.name)}</div>)}
        </div>}
      </div>

      <aside className="bk-h-detail" style={styleFor(selected)} aria-label={`${selected.name} helmet details`}>
        <div className="bk-h-detail-image" data-gold={selected.id === 'gold-standard' ? 'true' : undefined}>
          <button type="button" className="bk-h-360" onClick={() => setNotice('three-d')} aria-label="360-degree preview status"><RotateCcw size={22}/><span>360°</span></button>
          <img key={selected.id} src={selected.id === 'gold-standard' ? '/store/bk-helmet-gold-preview.webp' : helmetImage(selected.id)} alt={`${selected.name} helmet concept artwork`}/>
          <button type="button" className="bk-h-step bk-h-step-left" onClick={() => move(-1)} aria-label="Previous helmet"><ChevronLeft size={29}/></button>
          <button type="button" className="bk-h-step bk-h-step-right" onClick={() => move(1)} aria-label="Next helmet"><ChevronRight size={29}/></button>
        </div>
        <div className="bk-h-details-body">
          <h2><Crown size={25} aria-hidden="true"/>{selected.name}</h2>
          <div className="bk-h-detail-tier">{selected.rarity} helmet</div>
          <p className="bk-h-desc">{selected.description}</p>
          {cartAction(selected.id)}
          {notice && <p className="bk-h-notice" role="status">{notice === 'three-d' ? '360° model is not available yet. This is the approved helmet artwork.' : 'Matching gear is a visual preview. Accessories are not for sale yet.'}</p>}
          <div className="bk-h-matching"><h3>Complete the Look</h3><div className="bk-h-matching-grid">
            {matchingGear.map(({ name, price }, index) => <button type="button" key={name} onClick={() => setNotice('gear')} aria-label={`${name}, ${formatCoins(price)} proposed BK Coins`}><span className="bk-h-matching-pic" style={{ backgroundPosition: `${index * 100 / 3}% center` }} aria-hidden="true"/><span className="bk-h-mini-price"><span className="bk-h-coin">BK</span>{formatCoins(price)}</span></button>)}
          </div></div>
          <p className="bk-h-disclaimer">Helmet artwork is a store concept. 3D wearables and coin purchases are not active yet.</p>
        </div>
      </aside>
    </div>
  </section>;
}