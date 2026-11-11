import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Coins, Crown, Footprints, Hand, HardHat, Home, Package, Shield, Shirt, Star, UserRound } from 'lucide-react';
import { STORE_PRODUCTS, storeImage, storePrice, type StoreFilter, type StoreProduct } from './storeCatalog';
import './storeLandingShowcase.css';
type Dest = 'featured'|'game-fits'|'clothing'|'characters'|'helmets'|'jerseys'|'pants'|'cleats'|'accessories';
const find=(id:string)=>STORE_PRODUCTS.find(p=>p.id===id);
const equipment=[
 {id:'helmets' as const,title:'Helmets',desc:'Build your look',img:'/store/bk-helmet-gold-standard.webp'},
 {id:'jerseys' as const,title:'Jerseys',desc:'Game ready',img:'/store/bk-jersey-gold-standard.webp'},
 {id:'pants' as const,title:'Pants',desc:'Custom fits',img:'/store/bk-pants-gold-standard.webp'},
 {id:'cleats' as const,title:'Cleats',desc:'On-field edge',img:'/store/bk-cleat-gold-standard.webp'},
 {id:'accessories' as const,title:'Accessories',desc:'Gloves & more',img:'/store/bk-accessory-gold-standard.webp'}
];
const tunnel=[
 {id:'gold-standard',name:'Gold Standard',rarity:'Legendary',color:'#e8b94c',img:storeImage('gold-standard-realistic')},
 {id:'tunnel-fit',name:'Gray Standard',rarity:'Epic',color:'#d18aff',img:storeImage('tunnel-look')},
 {id:'ivory-standard',name:'Ivory Standard',rarity:'Epic',color:'#d18aff',img:storeImage('ivory-standard-look')},
 {id:'bkf-lowrider',name:'BKF Lowrider',rarity:'Rare',color:'#73d4ff',img:storeImage('bkf-lowrider-look')},
 {id:'bkf-kickflip',name:'BKF Kickflip',rarity:'Rare',color:'#73d4ff',img:storeImage('bkf-kickflip-look')},
 {id:'frostbite',name:'Frostbite',rarity:'Epic',color:'#d18aff',img:storeImage('frostbite-look')}
];
// Only original artwork already saved in the Ball Knower catalog/repository.
// The cast can use different existing campaign poses without redrawing characters.
const heroCast=[
 {id:'gold-standard',name:'Gold Standard',img:storeImage('gold-standard-realistic')},
 {id:'bk-femme',name:'BKF Nicki',img:'/store/bkf-nicki-apose-v1.webp'},
 {id:'bfk-dee',name:'BKF Dee',img:'/store/bfk-dee-standing-reference-v1.webp'},
 {id:'bkf-youngboy',name:'BKF YoungBoy',img:'/store/bkf-youngboy-cover.webp'},
 {id:'bkf-outlaw',name:'Country Boy',img:'/store/bkf-outlaw-look.webp'},
 {id:'bkf-kickflip',name:'Skater',img:'/store/bkf-kickflip-look.webp'},
 {id:'frostbite',name:'Frostbite',img:storeImage('frostbite')},
 {id:'bkf-phantom',name:'Phantom',img:storeImage('bkf-phantom')},
 {id:'bkf-lowrider',name:'Lowrider',img:'/store/bkf-lowrider-look.webp'},
 {id:'bkf-iron-wolf',name:'Iron Wolf',img:'/store/bkf-iron-wolf-look.webp'},
 {id:'bkf-street-boss',name:'Street Boss',img:'/store/bkf-street-boss-cover.webp'}
] as const;
const extras=['chrome-grip','ink-pack','blackout','profile-pack','founders-pack','end-zone-backflip'];
const nav=[
 {id:'featured' as const,title:'Store Home',Icon:Home},
 {id:'game-fits' as const,title:'Game Fits',Icon:Shield},
 {id:'clothing' as const,title:'Tunnel Fits',Icon:Shirt},
 {id:'characters' as const,title:'Characters',Icon:UserRound},
 {id:'helmets' as const,title:'Equipment',Icon:HardHat},
 {id:'accessories' as const,title:'Accessories',Icon:Hand}
];
export default function StoreLandingShowcase({onNavigate,onProduct,onCatalog,onRewards}:{
 onNavigate:(dest:Dest)=>void;
 onProduct:(item:StoreProduct)=>void;
 onCatalog:(filter?:StoreFilter)=>void;
 onRewards:()=>void;
}){
 const rail=useRef<HTMLDivElement>(null);
 const open=(id:string)=>{const item=find(id);if(item)onProduct(item)};
 return <div className="bk-cinema">
 <aside className="bk-cinema-sidebar" aria-label="Store navigation">
  <span className="bk-cinema-brand"><Crown size={25}/> BK <strong>STORE</strong></span>
  {nav.map(({id,title,Icon})=><button type="button" key={id} className={id==='featured'?'is-active':''} onClick={()=>onNavigate(id)}><Icon size={17}/>{title}</button>)}
  <button type="button" onClick={()=>onCatalog('bundles')}><Package size={17}/>Bundles</button>
  <button type="button" onClick={onRewards}><Coins size={17}/>BK Coins & Rewards</button>
 </aside>
 <div className="bk-cinema-main">
  <section className="bk-cinema-hero" aria-labelledby="bk-cinema-hero-title">
   <div className="bk-cinema-hero-cast" aria-label="Original Ball Knower character collection">
    {heroCast.map((character,i)=><button key={character.id} type="button" className={`bk-cinema-hero-person bk-cinema-hero-person-${i}`} title={`See ${character.name}`} onClick={()=>open(character.id)}>
     <img src={character.img} alt={character.name+' original character artwork'} loading={i<4?'eager':'lazy'} draggable={false} onError={e=>{e.currentTarget.style.opacity='0'}}/>
     <span className="bk-cinema-hero-person-label">{character.name}</span>
    </button>)}
   </div>
   <div className="bk-cinema-hero-copy">
    <small>B A L L &nbsp; K N O W E R</small>
    <h2 id="bk-cinema-hero-title"><em>BK</em> STORE</h2>
    <p>TUNNEL FITS <b>•</b> GAME GEAR <b>•</b> CHARACTERS <b>•</b> EXTRAS</p>
    <button type="button" className="bk-cinema-cta" onClick={()=>open('gold-standard')}>Shop Gold Standard <ArrowRight size={16}/></button>
   </div>
   <div className="bk-cinema-hero-feature"><strong>THE BKF<br/>LINEUP</strong><small>ORIGINAL BKF CHARACTERS</small><button type="button" onClick={()=>onNavigate('characters')}>SHOP CHARACTERS <ChevronRight size={15}/></button></div>
  </section>
  <nav className="bk-cinema-equipment" aria-label="Browse equipment">
   {equipment.map(item=><button type="button" key={item.id} onClick={()=>onNavigate(item.id)}>
    <img src={item.img} alt="" loading="lazy"/><span><strong>{item.title}</strong><small>{item.desc}</small></span>
   </button>)}
  </nav>
  <section className="bk-cinema-tunnel" aria-labelledby="bk-cinema-tunnel-title">
   <header className="bk-cinema-section-head"><div><h2 id="bk-cinema-tunnel-title"><Crown size={24}/> TUNNEL FITS <b>///</b></h2><p>PRE-GAME FASHION. GAME-DAY ENERGY.</p></div><button type="button" className="bk-cinema-ghost" onClick={()=>onNavigate('clothing')}>VIEW ALL TUNNEL FITS <ChevronRight size={16}/></button></header>
   <div className="bk-cinema-rail-wrap">
    <button type="button" className="bk-cinema-scroll-button" onClick={()=>rail.current?.scrollBy({left:-300,behavior:'smooth'})} aria-label="Scroll tunnel outfits left"><ChevronLeft size={23}/></button>
    <div className="bk-cinema-rail" ref={rail}>
     {tunnel.map(fit=>{const p=find(fit.id);return <button key={fit.id} type="button" className="bk-cinema-fit" style={{'--rarity':fit.color} as CSSProperties} onClick={()=>open(fit.id)}>
      <span className="bk-cinema-rarity"><Crown size={10}/>{fit.rarity}</span><img loading="lazy" alt={fit.name+' tunnel outfit'} src={fit.img} onError={e=>{e.currentTarget.onerror=null;e.currentTarget.src=storeImage(fit.id)}}/>
      <span className="bk-cinema-fit-info"><strong>{fit.name}</strong><small>{p?storePrice(p):'Coming Soon'} <em>preview</em></small></span>
     </button>})}
    </div><button type="button" className="bk-cinema-scroll-button" onClick={()=>rail.current?.scrollBy({left:300,behavior:'smooth'})} aria-label="Scroll tunnel outfits right"><ChevronRight size={23}/></button>
   </div>
   <span className="bk-cinema-swipe">SWIPE TO EXPLORE <ArrowRight size={12}/></span>
  </section>
  <div className="bk-cinema-promos">
   <section className="bk-cinema-promo bk-cinema-characters">
    <div className="bk-cinema-character-art" aria-hidden="true"><img src="/store/bkf-street-boss-cover.webp" alt="" loading="lazy"/><img src="/store/bkf-youngboy-cover.webp" alt="" loading="lazy"/><img src="/store/bkf-outlaw-look.webp" alt="" loading="lazy"/></div>
    <div className="bk-cinema-promo-copy"><h2>CHARACTER PACKS</h2><p>Unique styles. Real personality.<br/> BK originals.</p><button type="button" onClick={()=>onNavigate('characters')}>BROWSE CHARACTERS <ChevronRight size={15}/></button></div>
   </section>
   <section className="bk-cinema-promo bk-cinema-uniforms">
    <img src="/store/bk-jersey-gold-standard.webp" alt="" loading="lazy"/>
    <div className="bk-cinema-promo-copy"><h2>GAME FITS <b>///</b></h2><p>Complete on-field uniform sets<br/> with matching gear.</p><button type="button" onClick={()=>onNavigate('game-fits')}>SHOP GAME FITS <ChevronRight size={15}/></button></div>
   </section>
  </div>
  <section className="bk-cinema-extras" aria-labelledby="bk-cinema-extras-title">
   <header className="bk-cinema-section-head"><div><h2 id="bk-cinema-extras-title">GEAR &amp; EXTRAS</h2><p>CUSTOMIZE. FLEX. STAND OUT.</p></div><button type="button" className="bk-cinema-ghost" onClick={()=>onCatalog()}>VIEW ALL EXTRAS <ChevronRight size={16}/></button></header>
   <div className="bk-cinema-extra-grid">{extras.map(id=>{const p=find(id);if(!p)return null;return <button type="button" key={id} onClick={()=>onProduct(p)}>
    <img src={storeImage(id)} alt="" loading="lazy"/><span><strong>{p.name}</strong><small>{storePrice(p)} <em>proposed</em></small></span>
   </button>})}</div>
  </section>
  <p className="bk-cinema-note"><Star size={13}/> Store artwork and prices are previews. No purchase, BK Coin debit or new 3D outfit ownership is enabled.</p>
 </div>
 </div>
}
