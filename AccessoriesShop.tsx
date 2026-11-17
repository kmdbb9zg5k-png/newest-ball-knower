import { useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowLeft, ChevronRight, Coins, Crown, Footprints, Gem, Glasses,
  Hand, HardHat, LockKeyhole, Package, Shield, Shirt, ShoppingCart, Sparkles,
  Star, UserRound,
} from 'lucide-react';
import './accessoriesShop.css';

export type AccessoriesNavigation = 'featured' | 'characters' | 'clothing' | 'helmets' | 'jerseys' | 'pants' | 'cleats' | 'accessories' | 'bundles' | 'coins';
type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
type Filter = 'all' | Rarity;
type Sort = 'newest' | 'price-low' | 'price-high' | 'name';
type AccessorySet = {
  id: string;
  name: string;
  rarity: Rarity;
  price: number;
  accent: string;
  description: string;
};

const SETS: readonly AccessorySet[] = [
  { id: 'gold-standard', name: 'Gold Standard', rarity: 'legendary', price: 3500, accent: '#f6cb53', description: 'Premium metallic-gold on-field essentials. The signature BK statement set.' },
  { id: 'volt', name: 'Volt', rarity: 'epic', price: 2750, accent: '#a3ff00', description: 'Black-and-electric-lime gear, designed for an explosive look.' },
  { id: 'frostbite', name: 'Frostbite', rarity: 'epic', price: 2750, accent: '#6fd6ff', description: 'Ice-white sleeves and blue-tinted accessories with frosted detailing.' },
  { id: 'inferno', name: 'Inferno', rarity: 'rare', price: 2250, accent: '#ff4939', description: 'Fiery red-on-black gear with bold, sharp accents.' },
  { id: 'night-ops', name: 'Night Ops', rarity: 'rare', price: 2250, accent: '#8797bd', description: 'A stealth-ready charcoal and black accessory combination.' },
  { id: 'royal', name: 'Royal', rarity: 'uncommon', price: 1750, accent: '#aa55ff', description: 'Purple-and-gold performance accessories with a royal finish.' },
  { id: 'ocean-wave', name: 'Ocean Wave', rarity: 'uncommon', price: 1750, accent: '#37e6db', description: 'Clean teal and aqua accessories with bright matching details.' },
  { id: 'crimson-strike', name: 'Crimson Strike', rarity: 'common', price: 1250, accent: '#ff5355', description: 'Crimson red gloves, sleeve, visor, and sideline essentials.' },
  { id: 'stealth', name: 'Stealth', rarity: 'common', price: 1250, accent: '#9ea3b2', description: 'The understated blacked-out essentials set.' },
  { id: 'galaxy', name: 'Galaxy', rarity: 'mythic', price: 4500, accent: '#f34dfb', description: 'A cosmic violet and electric-blue look for the boldest BK athletes.' },
];
const RARITIES: readonly Filter[] = ['all','common','uncommon','rare','epic','legendary','mythic'];
const INCLUDED = [
  { label: 'Gloves', icon: Hand },
  { label: 'Arm Sleeves', icon: Shirt },
  { label: 'Visor', icon: Glasses },
  { label: 'Mouthguard', icon: Shield },
  { label: 'Towel', icon: Package },
  { label: 'Wrist Bands', icon: Sparkles },
] as const;
const NAVIGATION: {id: AccessoriesNavigation; label: string; icon: typeof Star}[] = [
  {id: 'featured', label: 'Featured', icon: Star},
  {id: 'characters', label: 'Characters', icon: UserRound},
  {id: 'clothing', label: 'Active Wear', icon: Shirt},
  {id: 'helmets', label: 'Helmets', icon: HardHat},
  {id: 'jerseys', label: 'Jerseys', icon: Shirt},
  {id: 'pants', label: 'Pants', icon: Shirt},
  {id: 'cleats', label: 'Cleats', icon: Footprints},
  {id: 'accessories', label: 'Accessories', icon: Hand},
  {id: 'bundles', label: 'Bundles', icon: Package},
  {id: 'coins', label: 'BK Coins', icon: Coins},
];
const LOOK_LINKS: {id: AccessoriesNavigation;label:string;icon:typeof Star}[] = [
  {id:'helmets',label:'Helmets',icon:HardHat},
  {id:'jerseys',label:'Jerseys',icon:Shirt},
  {id:'pants',label:'Pants',icon:Shirt},
  {id:'cleats',label:'Cleats',icon:Footprints},
];
const imageFor = (id:string) => `/store/bk-accessory-${id}.webp`;
const coins = (price:number) => price.toLocaleString('en-US');

export default function AccessoriesShop({onNavigate}:{onNavigate:(page:AccessoriesNavigation)=>void}) {
  const [filter,setFilter] = useState<Filter>('all');
  const [sort,setSort] = useState<Sort>('newest');
  const [selectedId,setSelectedId] = useState('gold-standard');
  const selected = SETS.find(set => set.id === selectedId) ?? SETS[0];
  const visible = useMemo(() => {
    const filtered = SETS.filter(set => filter === 'all' || set.rarity === filter);
    if(sort === 'price-low') filtered.sort((a,b)=>a.price-b.price);
    if(sort === 'price-high') filtered.sort((a,b)=>b.price-a.price);
    if(sort === 'name') filtered.sort((a,b)=>a.name.localeCompare(b.name));
    return filtered;
  },[filter,sort]);
  const accent = (set:AccessorySet) => ({'--bk-acc-accent':set.accent} as CSSProperties);

  return <section className="bk-accessories" aria-label="BK Accessories Collection" data-accessories-store="true">
    <div className="bk-a-shell">
      <aside className="bk-a-sidebar" aria-label="Store departments">
        <button type="button" className="bk-a-store-home" onClick={()=>onNavigate('featured')}><ShoppingCart size={23} aria-hidden="true"/> BK Store</button>
        <nav className="bk-a-nav" aria-label="Shop categories">
          {NAVIGATION.map(({id,label,icon:Icon})=><button type="button" key={id} onClick={()=>id!=='accessories' && onNavigate(id)} aria-current={id==='accessories'?'page':undefined}>
            <Icon size={19} aria-hidden="true"/><span>{label}</span>
          </button>)}
        </nav>
        <img className="bk-a-promo" src="/store/bk-accessory-promo.webp" alt="BK premium gear: Exclusive drops and limited-time offers" loading="lazy"/>
      </aside>

      <div className="bk-a-main">
        <button type="button" className="bk-a-back" onClick={()=>onNavigate('featured')}><ArrowLeft size={17}/> Back to Store</button>
        <div className="bk-a-banner" role="img" aria-label="BK Accessories Collection, premium on-field accessories to complete your look">
          <img src="/store/bk-accessory-hero.webp" alt="" fetchPriority="high"/>
        </div>
        <p className="bk-a-intro">Premium on-field accessories to complete your look. Stand out. Ball Knower style.</p>
        <div className="bk-a-toolbar">
          <div className="bk-a-filters" role="group" aria-label="Filter accessories by rarity">
            {RARITIES.map(rarity => <button type="button" key={rarity} data-rarity={rarity} aria-pressed={filter===rarity} onClick={()=>setFilter(rarity)}>
              {rarity==='all' ? `All (${SETS.length})` : `${rarity} (${SETS.filter(set=>set.rarity===rarity).length})`}
            </button>)}
          </div>
          <label className="bk-a-sort"><span>Sort</span><select aria-label="Sort accessory sets" value={sort} onChange={event=>setSort(event.target.value as Sort)}>
            <option value="newest">Newest</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option><option value="name">Name: A-Z</option>
          </select></label>
        </div>
        <div className="bk-a-grid" aria-label="Premium accessory sets">
          {visible.map(set=><button type="button" className="bk-a-card" key={set.id} style={accent(set)} data-rarity={set.rarity} data-accessory={set.id} aria-pressed={selectedId===set.id} onClick={()=>setSelectedId(set.id)}>
            <span className="bk-a-card-image"><img src={imageFor(set.id)} alt={`${set.name} accessories: sleeve, visor, mouthguard, gloves and towel`} loading="lazy" decoding="async"/></span>
            <strong>{set.name}</strong><span className="bk-a-card-rarity">{set.rarity}</span>
            <span className="bk-a-price"><span className="bk-a-coin">BK</span>{coins(set.price)}</span>
          </button>)}
        </div>
        <section className="bk-a-complete" aria-label="Complete the Look">
          <div><strong>Complete<br/> the Look</strong><p>Build your full BK loadout.</p></div>
          <div className="bk-a-complete-links">
            {LOOK_LINKS.map(({id,label,icon:Icon})=><button type="button" key={id} onClick={()=>onNavigate(id)}><Icon size={27} aria-hidden="true"/><span>{label}</span><ChevronRight size={16} aria-hidden="true"/></button>)}
          </div>
        </section>
      </div>

      <aside className="bk-a-detail" style={accent(selected)} aria-label={`${selected.name} accessory set preview`}>
        <div className="bk-a-detail-top"><span className="bk-a-detail-rarity" data-rarity={selected.rarity}>{selected.rarity==='legendary' && <Crown size={17} aria-hidden="true"/>}{selected.rarity} </span>
          <h2>{selected.name}</h2><p>Accessory Set</p><div className="bk-a-detail-price"><span className="bk-a-coin">BK</span>{coins(selected.price)}</div>
        </div>
        <div className={'bk-a-detail-photo'+(selected.id==='gold-standard'?' bk-a-detail-photo-player':'')}>
          <img key={selected.id} src={selected.id==='gold-standard'?'/store/bk-accessory-gold-player.webp':imageFor(selected.id)} alt={selected.id==='gold-standard'?'Football athlete modeling the Gold Standard accessory set':`${selected.name} full accessory set product artwork`}/>
        </div>
        <p className="bk-a-detail-description">{selected.description}</p>
        <div className="bk-a-includes"><h3>Includes (6 Pieces)</h3><div className="bk-a-includes-grid">
          {INCLUDED.map(({label,icon:Icon})=><div key={label}><span><Icon size={24} aria-hidden="true"/></span><small>{label}</small></div>)}
        </div></div>
        <div className="bk-a-locked"><span><LockKeyhole size={19} aria-hidden="true"/> Coming Soon</span><small>BK Coin purchases and equipping are not yet available.</small></div>
      </aside>
    </div>
  </section>;
}