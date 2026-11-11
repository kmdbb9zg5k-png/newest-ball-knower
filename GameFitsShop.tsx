import { useMemo, useState, type CSSProperties } from 'react';
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Coins, Crown, Footprints, Gem, Hand, HardHat, Package, Shirt, Shield, Sparkles, Star, UserRound } from 'lucide-react';
import './gameFitsShop.css';

type Rarity = 'legendary' | 'elite' | 'rare';
type Filter = 'all' | Rarity;
type Sort = 'featured' | 'price-low' | 'price-high' | 'name';
type Department = 'featured' | 'characters' | 'clothing' | 'helmets' | 'jerseys' | 'pants' | 'cleats' | 'accessories' | 'game-fits' | 'bundles' | 'coins';
type Fit = { id:string; name:string; rarity:Rarity; accent:string; price:number; detail:string; accessory:string; label:string };
const FITS: readonly Fit[] = [
  {id:'gold-standard',name:'Gold Standard',rarity:'legendary',accent:'#f0bc4e',price:12500,accessory:'gold-standard',label:'Signature gold',detail:'The crown-jewel full BK look: black-and-gold helmet, matching jersey, pants, cleats and gold accessories.'},
  {id:'frostbite',name:'Frostbite',rarity:'elite',accent:'#7cdbff',price:10500,accessory:'frostbite',label:'Ice cold',detail:'Icy silver and electric-blue game gear from helmet to cleats, finished with Frostbite accessories.'},
  {id:'shadow-ops',name:'Shadow Ops',rarity:'elite',accent:'#b0b5c3',price:10000,accessory:'night-ops',label:'Stealth mode',detail:'Black-on-black carbon style with smoked details, built around a complete shadow-game aesthetic.'},
  {id:'bloodline',name:'Bloodline',rarity:'legendary',accent:'#ff3655',price:12000,accessory:'crimson-strike',label:'Redline ready',detail:'Black and crimson lightning across every piece, with fierce matching red accessory accents.'},
  {id:'purple-reign',name:'Purple Reign',rarity:'elite',accent:'#c77bff',price:11500,accessory:'royal',label:'Royal energy',detail:'Royal violet and metallic-gold gear with a matching purple accessories set.'},
  {id:'camo-elite',name:'Camo Elite',rarity:'rare',accent:'#9ab465',price:8500,accessory:'stealth',label:'Built different',detail:'Woodland camouflage from the helmet to the cleats, with stealth-black finishing details.'},
  {id:'neon-strike',name:'Neon Strike',rarity:'elite',accent:'#dbfc35',price:10000,accessory:'volt',label:'Voltage up',detail:'Electric neon-lime and jet-black equipment with high-energy Volt accessories.'},
  {id:'chrome-phantom',name:'Chrome Phantom',rarity:'legendary',accent:'#e1e6f0',price:12500,accessory:'night-ops',label:'Mirror finish',detail:'Polished chrome and silver game-day gear with smoked-black accessory accents.'},
  {id:'desert-storm',name:'Desert Storm',rarity:'rare',accent:'#dcb58a',price:9000,accessory:'stealth',label:'Sandstorm',detail:'Desert-tan camouflage equipment with black trims and understated accessories.'},
  {id:'titanium-edge',name:'Titanium Edge',rarity:'elite',accent:'#57baff',price:10500,accessory:'ocean-wave',label:'Blue lightning',detail:'Black carbon texture with electric-blue detailing, completed by ice-blue accessories.'},
];
const parts = [
  {id:'helmets' as const,label:'Helmet',icon:HardHat,prefix:'bk-helmet'},
  {id:'jerseys' as const,label:'Jersey',icon:Shirt,prefix:'bk-jersey'},
  {id:'pants' as const,label:'Pants',icon:Shield,prefix:'bk-pants'},
  {id:'cleats' as const,label:'Cleats',icon:Footprints,prefix:'bk-cleat'},
];
const image = (category:string,id:string)=>'/store/'+category+'-'+id+'.webp';
const formatCoins=(n:number)=>n.toLocaleString('en-US');
const style=(fit:Fit)=>({'--bk-fit-color':fit.accent} as CSSProperties);

function FitArtwork({fit,large=false}:{fit:Fit;large?:boolean}) {
  return <div className={'bk-game-fit-art'+(large?' bk-game-fit-art--large':'')} style={style(fit)}>
    <span className="bk-game-fit-light" aria-hidden="true"/>
    <img className="bk-game-fit-helmet" src={image('bk-helmet',fit.id)} alt="" loading="lazy"/>
    <img className="bk-game-fit-jersey" src={image('bk-jersey',fit.id)} alt="" loading="lazy"/>
    <img className="bk-game-fit-pants" src={image('bk-pants',fit.id)} alt="" loading="lazy"/>
    <img className="bk-game-fit-cleat" src={image('bk-cleat',fit.id)} alt="" loading="lazy"/>
  </div>;
}

export function GameFitsPreview({onExplore}:{onExplore:()=>void}) {
  return <section className="bk-game-fit-preview" aria-labelledby="bk-game-fit-preview-title">
    <header className="bk-game-fit-preview-head">
      <div><span className="bk-game-fit-eyebrow"><Crown size={14}/> On-field style · New</span><h2 id="bk-game-fit-preview-title">COMPLETE GAME FITS</h2><p>Your helmet, jersey, pants and cleats. All matching.</p></div>
      <button type="button" onClick={onExplore}>See all 10 <ArrowRight size={16}/></button>
    </header>
    <div className="bk-game-fit-preview-scroll" role="group" aria-label="Preview game-fit collections">
      {FITS.map(fit=><button type="button" key={fit.id} onClick={onExplore} className="bk-game-fit-preview-card" style={style(fit)} aria-label={'Explore '+fit.name+' complete game fit'}>
        <FitArtwork fit={fit}/>
        <span className="bk-game-fit-preview-label"><strong>{fit.name}</strong><small>{fit.rarity} · 5 pieces</small></span>
      </button>)}
    </div>
    <small className="bk-game-fit-disclaimer">Concept bundles only. No BK Coins are charged; ownership and equip actions are not active.</small>
  </section>;
}

const nav: {id:Department;label:string;icon:typeof Star}[] = [
  {id:'featured',label:'Featured',icon:Star},{id:'game-fits',label:'Game Fits',icon:Shield},{id:'characters',label:'Characters',icon:UserRound},{id:'clothing',label:'Tunnel Fits',icon:Shirt},{id:'helmets',label:'Helmets',icon:HardHat},{id:'jerseys',label:'Jerseys',icon:Shirt},{id:'pants',label:'Pants',icon:Shield},{id:'cleats',label:'Cleats',icon:Footprints},{id:'accessories',label:'Accessories',icon:Hand},{id:'bundles',label:'Bundles',icon:Package},{id:'coins',label:'BK Coins',icon:Coins}
];
export default function GameFitsShop({onNavigate}:{onNavigate:(destination:Department)=>void}) {
  const [selectedId,setSelectedId]=useState('gold-standard');
  const [filter,setFilter]=useState<Filter>('all');
  const [sort,setSort]=useState<Sort>('featured');
  const selected=FITS.find(f=>f.id===selectedId)??FITS[0];
  const visible=useMemo(()=>{
    const items=FITS.filter(fit=>filter==='all'||fit.rarity===filter);
    if(sort==='price-low')items.sort((a,b)=>a.price-b.price);
    if(sort==='price-high')items.sort((a,b)=>b.price-a.price);
    if(sort==='name')items.sort((a,b)=>a.name.localeCompare(b.name));
    return items;
  },[filter,sort]);
  const cycle=(step:number)=>{const i=FITS.findIndex(f=>f.id===selected.id);setSelectedId(FITS[(i+step+FITS.length)%FITS.length].id);};
  return <section className="bk-game-fits" aria-label="Complete Game Fits" data-game-fits-store="true">
    <div className="bk-game-fits-shell">
      <aside className="bk-game-fits-sidebar" aria-label="Store departments">
        <button type="button" className="bk-game-fits-brand" onClick={()=>onNavigate('featured')}><Crown size={25}/> BK STORE</button>
        {nav.map(({id,label,icon:Icon})=><button type="button" key={id} className="bk-game-fits-nav" aria-current={id==='game-fits'?'page':undefined} onClick={()=>id!=='game-fits'&&onNavigate(id)}><Icon size={18}/>{label}</button>)}
      </aside>
      <div className="bk-game-fits-main">
        <button type="button" className="bk-game-fits-back" onClick={()=>onNavigate('featured')}><ArrowLeft size={16}/> Back to Store</button>
        <div className="bk-game-fits-banner"><div><span><Crown size={20}/> BK COLLECTION</span><h1>GAME FITS</h1><p>THE WHOLE LOADOUT. ONE LOOK.</p></div><img src={image('bk-helmet','gold-standard')} alt="Gold Standard helmet" fetchPriority="high"/></div>
        <div className="bk-game-fits-toolbar">
          <div role="group" aria-label="Filter game fits by rarity" className="bk-game-fits-filters">{(['all','legendary','elite','rare'] as Filter[]).map(kind=><button key={kind} type="button" aria-pressed={filter===kind} onClick={()=>setFilter(kind)}>{kind==='all'?'All (10)':kind}</button>)}</div>
          <select aria-label="Sort game fits" value={sort} onChange={e=>setSort(e.target.value as Sort)}>
            <option value="featured">Featured</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option><option value="name">Name A–Z</option>
          </select>
        </div>
        <div className="bk-game-fits-grid">{visible.map(fit=><button type="button" key={fit.id} style={style(fit)} className="bk-game-fits-card" aria-pressed={selected.id===fit.id} onClick={()=>setSelectedId(fit.id)}>
          <FitArtwork fit={fit}/><div className="bk-game-fits-card-info"><span className="bk-game-fits-tier">{fit.rarity}</span><strong>{fit.name}</strong><small>{fit.label} · 5-piece set</small><span className="bk-game-fits-price"><Coins size={15}/> {formatCoins(fit.price)} <small>proposed</small></span></div>
        </button>)}</div>
      </div>
      <aside className="bk-game-fits-detail" style={style(selected)} aria-label={selected.name+' fit details'}>
        <div className="bk-game-fits-detail-top"><span className="bk-game-fits-detail-tier"><Gem size={16}/>{selected.rarity}</span><h2>{selected.name}</h2><small>Complete game-day look</small></div>
        <div className="bk-game-fits-detail-image"><FitArtwork fit={selected} large/><button type="button" className="bk-game-fit-prev" onClick={()=>cycle(-1)} aria-label="Previous fit"><ChevronLeft size={24}/></button><button type="button" className="bk-game-fit-next" onClick={()=>cycle(1)} aria-label="Next fit"><ChevronRight size={24}/></button></div>
        <p className="bk-game-fits-description">{selected.detail}</p>
        <h3>Included in this fit</h3>
        <div className="bk-game-fits-parts">{parts.map(part=><button key={part.id} type="button" onClick={()=>onNavigate(part.id)} title={'Shop '+part.label}>
          <img src={image(part.prefix,selected.id)} alt={selected.name+' '+part.label}/><span>{part.label}<ChevronRight size={14}/></span>
        </button>)}
        <button type="button" onClick={()=>onNavigate('accessories')} title="Shop matching accessories">
          <img src={image('bk-accessory',selected.accessory)} alt="Coordinating accessories"/><span>Accessories<ChevronRight size={14}/></span>
        </button></div>
        <div className="bk-game-fits-proposed"><span><Coins size={18}/> {formatCoins(selected.price)} BK Coins</span><small>Proposed bundle price</small></div>
        <div className="bk-game-fits-coming"><Sparkles size={17}/> Coming Soon</div>
        <p className="bk-game-fit-disclaimer">Visual collection preview. Wearable set ownership, BK Coin checkout, and 3D equip are not active yet.</p>
      </aside>
    </div>
  </section>;
}