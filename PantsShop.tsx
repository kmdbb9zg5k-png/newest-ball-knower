import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Coins, Crown, Footprints, Gem, Glasses, Hand, HardHat, Package, RotateCcw, Shirt, ShoppingCart, Star, UserRound } from 'lucide-react';
import { PANTS, type StorePants as Pants } from './storeGearCatalog';
import type { StoreGearCartAction } from './storeCart';
import './pantsShop.css';

type Rarity = 'legendary' | 'elite' | 'rare';
type Filter = 'all' | Rarity | 'common';
type Sort = 'newest' | 'low' | 'high' | 'name';
export type PantsNavigation = 'featured' | 'characters' | 'clothing' | 'helmets' | 'jerseys' | 'pants' | 'accessories' | 'cleats' | 'bundles' | 'coins';

const formatCoins = (price: number) => price.toLocaleString('en-US');
const pantsImage = (id: string) => `/store/bk-pants-${id}.webp`;
const sideLinks: { id: PantsNavigation; label: string; icon: typeof Star }[] = [
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
  { name: 'Gold Helmet', price: 750, icon: HardHat },
  { name: 'Gold Jersey', price: 2500, icon: Shirt },
  { name: 'Gold Cleats', price: 1250, icon: Footprints },
  { name: 'Gold Gloves', price: 500, icon: Hand },
] as const;

export default function PantsShop({ onNavigate, cartAction }: { cartAction: StoreGearCartAction; onNavigate: (destination: PantsNavigation) => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('newest');
  const [selectedId, setSelectedId] = useState('gold-standard');
  const [notice, setNotice] = useState<'three-d' | 'gear' | null>(null);
  const selected = PANTS.find(item => item.id === selectedId) ?? PANTS[0];
  const visible = useMemo(() => {
    const items = PANTS.filter(item => filter === 'all' || item.rarity === filter);
    if (sort === 'low') items.sort((a, b) => a.price - b.price);
    if (sort === 'high') items.sort((a, b) => b.price - a.price);
    if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
    return items;
  }, [filter, sort]);
  const move = (step: number) => {
    const current = PANTS.findIndex(item => item.id === selectedId);
    setSelectedId(PANTS[(current + step + PANTS.length) % PANTS.length].id);
    setNotice(null);
  };
  const choose = (id: string) => { setSelectedId(id); setNotice(null); };
  const styleFor = (item: Pants) => ({ '--pants-accent': item.accent } as CSSProperties);

  return <section className="bk-pants" aria-label="BK Pants Collection" data-pants-store="true">
    <div className="bk-p-shell">
      <aside className="bk-p-side" aria-label="Store navigation">
        <button type="button" className="bk-p-brand" onClick={() => onNavigate('featured')}><ShoppingCart size={22}/><strong>BK Store</strong></button>
        <nav aria-label="Shop departments" className="bk-p-side-nav">
          {sideLinks.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={id === 'pants' ? 'page' : undefined} onClick={() => id !== 'pants' && onNavigate(id)}><Icon size={19} aria-hidden="true"/><span>{label}</span></button>)}
        </nav>
        <div className="bk-p-promo"><Crown size={35} aria-hidden="true"/><strong>BK<br/> Premium Gear</strong><small>Exclusive drops<br/> Limited time only</small></div>
      </aside>

      <div className="bk-p-main">
        <button type="button" className="bk-p-mobile-back" onClick={() => onNavigate('featured')}><ArrowLeft size={16}/> Back to Store</button>
        <div className="bk-p-hero" role="img" aria-label="Ball Knower Pants Collection: elite gear, next-level style"><img src="/store/bk-pants-hero.webp" alt="" fetchPriority="high"/><span className="bk-p-hero-reader">BK Pants Collection · Elite leg gear. Next level style.</span></div>
        <div className="bk-p-toolbar">
          <div className="bk-p-filters" role="group" aria-label="Filter pants by rarity">
            {(['all', 'legendary', 'elite', 'rare', 'common'] as Filter[]).map(kind =>
              <button type="button" key={kind} data-rarity={kind} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>{kind === 'legendary' && <Crown size={14} aria-hidden="true"/>}{kind === 'elite' && <Gem size={14} aria-hidden="true"/>}{kind === 'rare' && <span className="bk-p-triangle" aria-hidden="true">△</span>}{kind.charAt(0).toUpperCase() + kind.slice(1)}</button>)}
          </div>
          <label className="bk-p-sort"><span className="bk-p-sr">Sort pants</span><select aria-label="Sort pants" value={sort} onChange={event => setSort(event.target.value as Sort)}><option value="newest">Sort: Newest</option><option value="low">Price: Low to High</option><option value="high">Price: High to Low</option><option value="name">Name: A-Z</option></select></label>
        </div>
        {visible.length === 0 ? <p className="bk-p-empty" role="status">No pants in this rarity tier yet.</p> : <div className="bk-p-grid" aria-label="Ten premium pants">
          {visible.map(item => <div className="bk-store-card-with-action" key={item.id}><button className="bk-p-item" type="button" style={styleFor(item)} aria-pressed={selectedId === item.id} onClick={() => choose(item.id)} data-pants={item.id}>
            <span className="bk-p-item-image"><img src={pantsImage(item.id)} alt={`${item.name} BK football pants`} loading="lazy" decoding="async"/></span>
            <span className="bk-p-tier" data-rarity={item.rarity}>{item.rarity === 'legendary' ? <Crown size={12}/> : item.rarity === 'elite' ? <Gem size={12}/> : <span aria-hidden="true">△</span>}{item.rarity}</span>
            <strong>{item.name}</strong><span className="bk-p-cost"><span className="bk-p-coin">BK</span>{formatCoins(item.price)}</span>
          </button>{cartAction(item.id, item.name)}</div>)}
        </div>}
      </div>

      <aside className="bk-p-detail" style={styleFor(selected)} aria-label={`${selected.name} pants details`}>
        <div className="bk-p-detail-image" data-gold={selected.id === 'gold-standard' ? 'true' : undefined}>
          <button type="button" className="bk-p-360" onClick={() => setNotice('three-d')} aria-label="360-degree preview status"><RotateCcw size={22}/><span>360°</span></button>
          <img key={selected.id} src={pantsImage(selected.id)} alt={`${selected.name} pants concept artwork`}/>
          <button type="button" className="bk-p-step bk-p-step-left" onClick={() => move(-1)} aria-label="Previous pants"><ChevronLeft size={29}/></button>
          <button type="button" className="bk-p-step bk-p-step-right" onClick={() => move(1)} aria-label="Next pants"><ChevronRight size={29}/></button>
        </div>
        <div className="bk-p-details-body">
          <h2><Crown size={25} aria-hidden="true"/>{selected.name}</h2>
          <div className="bk-p-detail-tier">{selected.rarity} pants</div>
          <p className="bk-p-desc">{selected.description}</p>
          {cartAction(selected.id)}
          {notice && <p className="bk-p-notice" role="status">{notice === 'three-d' ? '360° pants model is not available yet. This view shows the approved front and back artwork.' : 'Matching gear is a visual preview. Accessories are not for sale yet.'}</p>}
          <div className="bk-p-matching"><h3>Complete the Look</h3><div className="bk-p-matching-grid">
            {matchingGear.map(({ name, price }, index) => <button type="button" key={name} onClick={() => setNotice('gear')} aria-label={`${name}, ${formatCoins(price)} proposed BK Coins`}><span className="bk-p-matching-pic" style={{ backgroundPosition: `${index * 100 / 3}% center` }} aria-hidden="true"/><span className="bk-p-mini-price"><span className="bk-p-coin">BK</span>{formatCoins(price)}</span></button>)}
          </div></div>
          <p className="bk-p-disclaimer">Pants artwork is a store concept. 3D wearable pants and BK Coin purchases are not active yet.</p>
        </div>
      </aside>
    </div>
  </section>;
}