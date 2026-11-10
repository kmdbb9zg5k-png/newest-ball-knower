import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, Box as BoxIcon, ChevronRight, Crown, Image as ImageIcon, Shirt, Trophy, X } from 'lucide-react';
import { DEFAULT_ATHLETE_APPEARANCE } from './athleteAppearance';
import { recommendedAthleteBuild } from './athleteBuild';
import { readAthletePassport, type AthletePassport } from './athletePassport';
import GameGearPreview from './GameGearPreview';
import { sanitizeGameGear } from './playerGameGear';
import { readOutfit } from './playerWardrobe';
import {
  BLACKOUT_KIT, STORE_CATEGORIES, STORE_PRODUCTS,
  storeImage, storePrice, type StoreCategory, type StoreFilter, type StoreProduct,
} from './storeCatalog';
import './store.css';
import './bkf-drop.css';

const AthleteLivePreview = lazy(() => import('./AthleteLivePreview'));
const StoreRewards = lazy(() => import('./StoreRewards'));
const BKFYoungBoyPose = lazy(() => import('./BKFYoungBoyPose'));
const StoreCharacterPreview = lazy(() => import('./StoreCharacterPreview'));
const BKFFrostbitePose = lazy(() => import('./BKFFrostbitePose'));

type StorePage = 'featured' | 'catalog' | 'rewards';
type Selection = { product: StoreProduct };
type ShopDepartment = 'featured' | 'characters' | 'clothing' | 'accessories' | 'all';
const departments = [
  { id: 'featured', label: 'Featured' }, { id: 'characters', label: 'Characters' },
  { id: 'clothing', label: 'Clothing' }, { id: 'accessories', label: 'Accessories' },
  { id: 'all', label: 'All Items' },
] as const;
const isCharacter = (product: StoreProduct) => Boolean(product.showcase) || ['bkf-youngboy', 'frostbite'].includes(product.id);
const characterProducts = STORE_PRODUCTS.filter(isCharacter);
const clothingProducts = STORE_PRODUCTS.filter(product => product.categories.includes('tunnel-fits') && !isCharacter(product) && product.id !== 'ink-pack');
const accessoryProducts = STORE_PRODUCTS.filter(product => product.id === 'chrome-grip' || product.id === 'ink-pack');
const otherProducts = STORE_PRODUCTS.filter(product => !characterProducts.includes(product) && !clothingProducts.includes(product) && !accessoryProducts.includes(product));

const tunnelPhotos = [
  { file: 'tunnel-look', label: 'Full outfit', alt: 'Athlete wearing the graphite Gray Standard in a stadium tunnel' },
  { file: 'tunnel-hoodie', label: 'Hoodie detail', alt: 'Graphite fleece, warm gold drawcord tips and chest embroidery' },
  { file: 'tunnel-sweats', label: 'Sweats detail', alt: 'Graphite jogger pocket and stitching' },
  { file: 'tunnel-trainers', label: 'Trainer detail', alt: 'Slate trainer with a mesh upper and layered sole' },
] as const;

const goldPhotos = [
  { file: 'gold-standard', label: 'Full outfit', alt: 'Gold Standard tracksuit on the detailed showroom athlete' },
] as const;

function ProductCard({ product, onOpen }: { product: StoreProduct; onOpen: (product: StoreProduct) => void }) {
  return <button className="bk-store-product" type="button" data-store-product={product.id} onClick={() => onOpen(product)}>
    <span className={"bk-store-card-art" + (isCharacter(product) || product.id === 'gold-standard' || product.id === 'tunnel-fit' ? ' bk-store-card-art--portrait' : '')}>
      <img src={storeImage(product.id === 'tunnel-fit' ? 'tunnel-look' : product.id === 'gold-standard' ? 'gold-standard-realistic' : product.id)} alt="" loading="lazy" decoding="async"
        onError={event => { const fallback = product.showcase?.look ?? storeImage(product.id); if (event.currentTarget.getAttribute('src') !== fallback) event.currentTarget.src = fallback; }}/>
    </span>
    <span className="bk-store-product-text">
      <strong>{product.name}</strong>
      <span>{product.summary}</span>
      <b>{storePrice(product)}{product.priceCents > 0 && <small> proposed</small>}</b>
    </span>
  </button>;
}

function TryOnPreview({ athlete, preview }: { athlete: AthletePassport | null; preview: NonNullable<StoreProduct['tryOn']> }) {
  const [rotation, setRotation] = useState(20);

  if ('gear' in preview) {
    const gear = { ...sanitizeGameGear(athlete?.gameGear), ...preview.gear };
    return <div className="bk-store-game-preview">
      <GameGearPreview athlete={athlete} gear={gear} rotation={rotation} blackout/>
      <label>Rotate player<input type="range" min={-180} max={180} value={rotation} onChange={event => setRotation(Number(event.target.value))}/></label>
    </div>;
  }

  const outfit = { ...readOutfit(), ...preview.outfit };
  const profile = {
    ...(athlete?.build ?? recommendedAthleteBuild('WR')),
    ...(athlete?.appearance ?? DEFAULT_ATHLETE_APPEARANCE),
    name: athlete?.name ?? 'Sample athlete',
    number: athlete?.number ?? 1,
    combineId: athlete?.id ?? 'store-sample',
    showroomSample: !athlete,
  };
  return <Suspense fallback={<p className="bk-store-preview-loading" role="status">Preparing your athlete…</p>}>
    <AthleteLivePreview profile={profile} previewOutfit={outfit} showroom={preview.outfit.top === 'top-tunnel-fit' || preview.outfit.top === 'top-gold-standard'}
      fallbackImage={preview.outfit.top === 'top-gold-standard' ? storeImage('gold-standard-realistic') : undefined}
      hideFaceDetail={preview.outfit.top === 'top-gold-standard'}
      />
  </Suspense>;
}

const FROSTBITE_PREVIEW_FALLBACK = 'https://v3b.fal.media/files/b/0ab1eab2/PuPh4vtWpnfEVTwvd_xXM_preview.png';

function BKFConceptDialog({ product, onClose }: { product: StoreProduct; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const showcase = product.showcase;
  const isFrostbite = product.id === 'frostbite';
  const isGold = product.id === 'gold-standard';
  const [view, setView] = useState<'poster' | 'realistic' | '3d'>('poster');
  const [art, setArt] = useState(() => storeImage(product.id));
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
  }, []);
  return <dialog ref={dialog} className={'bk-store-dialog bkf-drop-modal' + (showcase ? ' bkf-drop-modal--character bkf-drop-modal--' + showcase.theme : isFrostbite ? ' bkf-drop-modal--frostbite' : isGold ? ' bkf-drop-modal--gold' : '')}
    aria-labelledby="bkf-drop-title" data-bkf-collection={product.id}
    onClose={onClose} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
    <div className="bkf-drop-shell">
      <header className="bkf-drop-header">
        <div className="bkf-drop-brand"><Crown size={23} aria-hidden="true"/><span><strong>Ball Knower</strong><small>Clothing Package</small></span></div>
        <button type="button" className="bkf-drop-close" aria-label="Close product" onClick={() => dialog.current?.close()}><X size={25} aria-hidden="true"/></button>
      </header>
      <div className="bkf-drop-heading">
        <p>{showcase ? showcase.collection : isGold ? 'Gold Standard Outfit Collection' : isFrostbite ? 'Icebound Concept Collection' : 'Streetwear Concept Collection'}</p>
        <h2 id="bkf-drop-title" className="bkf-drop-title">{showcase ? product.name : isGold ? <>Gold <span>Standard</span></> : <><span>BKF</span> {isFrostbite ? 'Frostbite' : 'YoungBoy'}</>}</h2>
      </div>

      <div className="bkf-drop-tabs bkf-drop-tabs--triple" role="group" aria-label="Product view">
        <button type="button" aria-pressed={view === 'poster'} onClick={() => { setArt(storeImage(product.id)); setView('poster'); }}>Full poster</button>
        <button type="button" aria-pressed={view === 'realistic'} onClick={() => { setArt(showcase?.look ?? storeImage(isGold ? 'gold-standard-realistic' : isFrostbite ? 'frostbite-look' : 'bkf-youngboy-look')); setView('realistic'); }}>Realistic view</button>
        <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}><BoxIcon size={16} aria-hidden="true"/> 3D preview</button>
      </div>
      <div className="bkf-drop-hero" data-bkf-display={view === '3d' ? '3d' : 'photos'} data-bkf-photo={view === '3d' ? undefined : view}>
        {view !== '3d'
          ? <img src={art} alt={view === 'poster'
              ? (showcase ? 'Full ' + product.name + ' promotional outfit poster' : isGold ? 'Full Gold Standard black-and-gold outfit collection poster' : isFrostbite ? 'Full Frostbite promotional poster with icy outfit and collection details' : 'Full BKF YoungBoy black-and-gold outfit poster')
              : (showcase ? 'Realistic full-body ' + product.name + ' showcase character' : isGold ? 'Realistic standing Gold Standard sample athlete in metallic gold jacket and black-gold trainers' : isFrostbite ? 'Realistic standing Frostbite showroom model in silver puffer, white mask, cargo pants and boots' : 'Realistic standing BKF YoungBoy showroom model with black ski mask, hoodie, gold chain, brown cargos and tan work boots')}
              onError={() => {
                const fallback = showcase ? (view === 'realistic' ? storeImage(product.id) : showcase.look) : isGold
                  ? (view === 'realistic' ? '/store/gold-standard.webp' : storeImage('gold-standard-realistic'))
                  : isFrostbite
                    ? (view === 'realistic' ? FROSTBITE_PREVIEW_FALLBACK : storeImage('frostbite-look'))
                    : (view === 'realistic' ? '/store/bkf-youngboy-cover.webp' : '/store/bkf-youngboy.svg');
                if (art !== fallback) setArt(fallback);
              }}/>
          : <Suspense fallback={<div className="bkf-drop-load" role="status">Preparing {product.name}'s 3D showroom…</div>}>
              {showcase ? <StoreCharacterPreview name={product.name} model={showcase.model} look={showcase.look}/> : isGold && product.tryOn ? <div className="bkf-gold-showroom-3d"><TryOnPreview athlete={null} preview={product.tryOn}/></div> : isFrostbite ? <BKFFrostbitePose/> : <BKFYoungBoyPose/>}
            </Suspense>}
      </div>
      {view === '3d' && <p className="bkf-showroom-model-note">Standard showcase character · Not your saved player</p>}
      <p className="bkf-drop-description">{showcase ? product.description : isGold
        ? 'A metallic-gold and black tracksuit with matching joggers and black-and-gold trainers. Preview the entire look on our standard showcase athlete.'
        : isFrostbite
        ? 'Glacier-white puffer. White knit shiesty mask. Iced silver chain and watch. Loose ice-gray cargos and white high-top boots. One seriously cold streetwear look.'
        : 'Black shiesty mask. Heavy gold chain. Diamond-style watch. Oversized black hoodie, baggy brown cargos and tan boots. One signature streetwear look.'}</p>
      <div className="bkf-drop-includes">
        <h3><span>Included</span></h3>
        <ul>{product.includes.map(item=><li key={item}>{item}</li>)}</ul>
      </div>
      <footer className="bkf-drop-footer">
        <button type="button" className="bkf-drop-cta" onClick={() => {
          if (view === '3d') { setArt(storeImage(product.id)); setView('poster'); }
          else setView('3d');
        }}>
          <BoxIcon size={21} aria-hidden="true"/>{view === '3d' ? 'View full poster' : 'Preview in 3D'}
        </button>
        <div><strong>{isGold ? storePrice(product) : 'Coming Soon'}</strong><span>{isGold ? 'Planned price' : 'Concept Collection'}</span></div>
      </footer>
      <p className="bkf-drop-disclaimer">{isGold ? '3D uses the standard showcase athlete, not your saved player. Checkout is not available yet.' : '3D is a prototype. Wearable items and checkout are not available yet.'}</p>
    </div>
  </dialog>;
}

function ProductDialog({ selection, onClose }: { selection: Selection; onClose: () => void }) {
  const { product } = selection;
  const dialog = useRef<HTMLDialogElement>(null);
  const [athlete] = useState(readAthletePassport);
  const [trying, setTrying] = useState(false);

  useEffect(() => {
    if (dialog.current && !dialog.current.open) dialog.current.showModal();
  }, []);

  return <dialog ref={dialog} className="bk-store-dialog" aria-labelledby="bk-store-product-title"
    onClose={onClose} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
    <div className="bk-store-dialog-content">
      <header className="bk-store-dialog-header">
        <div><span className="bk-store-kicker">{product.use}</span><h2 id="bk-store-product-title">{product.name}</h2></div>
        <button className="bk-store-icon-button" type="button" aria-label="Close product" onClick={() => dialog.current?.close()}><X size={20} aria-hidden="true"/></button>
      </header>
      {trying && product.id === 'bkf-youngboy'
        ? <Suspense fallback={<p role="status">Preparing YoungBoy's 3D preview…</p>}><BKFYoungBoyPose/></Suspense>
        : trying && product.tryOn
        ? <div className="bk-store-try-on">
            <div className="bk-store-try-on-label"><Shirt size={15} aria-hidden="true"/> <strong>{athlete ? athlete.name : 'Sample athlete'}</strong> <span>Try-on preview</span></div>
            <TryOnPreview athlete={athlete} preview={product.tryOn}/>
          </div>
        : <img className="bk-store-detail-art" src={storeImage(product.id)} alt={product.summary}/>}
      <p className="bk-store-detail-description">{product.description}</p>
      <h3>Included</h3>
      <ul className="bk-store-includes">{product.includes.map(item => <li key={item}>{item}</li>)}</ul>
      <div className="bk-store-dialog-actions">
        {(product.tryOn || product.id === 'bkf-youngboy') && <button type="button" className="bk-store-button" onClick={() => setTrying(value => !value)}>{trying ? 'View product art' : product.id === 'bkf-youngboy' ? 'Preview in 3D' : 'Try on'}</button>}
        <div className="bk-store-price-status">
          <strong>{storePrice(product)}</strong><span>{product.id === 'bkf-youngboy' ? 'Concept collection' : 'Planned price'}</span>
        </div>
      </div>
      <p className="bk-store-purchase-status">{product.id === 'bkf-youngboy' ? 'Concept preview · Wearable 3D garments and checkout are not available yet.' : 'Catalog preview · Checkout opens at launch.'}</p>
    </div>
  </dialog>;
}

function TunnelShowroom({ product, onExit }: { product: StoreProduct; onExit: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) {
      element.showModal();
      title.current?.focus({ preventScroll: true });
    }
  }, []);

  const close = () => dialog.current?.close();

  return <dialog className="bk-store-dialog bk-tunnel-showroom" ref={dialog} aria-labelledby="bk-showroom-title" onClose={onExit}>
    <div className="bk-tunnel-showroom-layout">
      <header className="bk-tunnel-showroom-header">
        <button type="button" className="bk-store-product-back" aria-label="Back to product" onClick={close}><ArrowLeft size={23} aria-hidden="true"/></button>
        <div><h2 id="bk-showroom-title" ref={title} tabIndex={-1}>{product.name}</h2><p>3D showroom</p></div>
      </header>
      <div className="bk-tunnel-modes bk-tunnel-showroom-modes" role="group" aria-label="Product view">
        <button type="button" aria-pressed="false" onClick={close}>Product photos</button>
        <button type="button" aria-pressed="true">3D try-on</button>
      </div>
      {product.tryOn && <div className="bk-tunnel-showroom-preview">
        <TryOnPreview athlete={null} preview={product.tryOn}/>
      </div>}
      <footer className="bk-tunnel-showroom-footer">
        <strong>{product.name}</strong>
        <div className="bk-store-price-status"><strong>{storePrice(product)}</strong><span>Planned price</span></div>
      </footer>
    </div>
  </dialog>;
}

function TunnelProductPage({ product, onBack }: { product: StoreProduct; onBack: () => void }) {
  const [trying, setTrying] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const photos = product.id === 'gold-standard' ? goldPhotos : tunnelPhotos;
  const title = useRef<HTMLHeadingElement>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    title.current?.focus({ preventScroll: true });
  }, []);

  function selectPhoto(index: number) {
    const rail = track.current;
    if (!rail) return;
    setActivePhoto(index);
    rail.scrollTo({ left: rail.clientWidth * index, behavior: 'instant' });
  }

  return <section className="bk-store bk-store-product-page" aria-labelledby="bk-tunnel-title">
    <header className="bk-store-product-header">
      <button className="bk-store-product-back" type="button" onClick={onBack} aria-label="Back to shop"><ArrowLeft size={22} aria-hidden="true"/></button>
      <h1 id="bk-tunnel-title" ref={title} tabIndex={-1}>{product.name}</h1>
    </header>
    <div className="bk-tunnel-layout">
      <div className="bk-tunnel-showcase">
        <div className="bk-tunnel-gallery" ref={track} onScroll={event => {
          const rail = event.currentTarget;
          if (!rail.clientWidth) return;
          const index = Math.min(photos.length - 1, Math.max(0, Math.round(rail.scrollLeft / rail.clientWidth)));
          setActivePhoto(index);
        }}>
          {photos.map(({ file, alt }, index) =>
            <img key={file} src={storeImage(file)} alt={alt} aria-hidden={activePhoto !== index} loading={index === 0 ? 'eager' : 'lazy'} decoding="async"/>)}
        </div>
        <div className="bk-tunnel-thumbnails" role="group" aria-label="Product photo gallery">
          {photos.map(({ file, label }, index) =>
            <button key={file} type="button" aria-label={label} aria-pressed={activePhoto === index} onClick={() => selectPhoto(index)}>
              <img src={storeImage(file)} alt="" loading="lazy" decoding="async"/>
            </button>)}
        </div>
        <div className="bk-tunnel-modes" role="group" aria-label="Product view">
          <button type="button" aria-pressed="true">Product photos</button>
          <button type="button" aria-pressed="false" onClick={() => setTrying(true)}>3D try-on</button>
        </div>
      </div>
      <div className="bk-tunnel-product-info">
        <div className="bk-tunnel-product-heading">
          <div><h2>{product.name}</h2><p>{product.summary}</p></div>
          <div className="bk-store-price-status"><strong>{storePrice(product)}</strong><span>Planned price</span></div>
        </div>
        <button className="bk-store-button bk-store-button-gold bk-tunnel-try-on" type="button" onClick={() => setTrying(true)}>Try on in 3D</button>
        <p className="bk-store-purchase-status">Catalog preview · Purchases are not available yet.</p>
        <details className="bk-tunnel-details">
          <summary>What’s included</summary>
          <p>{product.description}</p>
          <ul className="bk-store-includes">{product.includes.map(item => <li key={item}>{item}</li>)}</ul>
        </details>
      </div>
    </div>
    {trying && <TunnelShowroom product={product} onExit={() => setTrying(false)}/>}
  </section>;
}

export default function StoreHub({ initialCategory, onOpenLocker, onOpenGauntlet }: {
  initialCategory?: StoreCategory;
  onOpenLocker: () => void;
  onOpenGauntlet: () => void;
}) {
  const [department, setDepartment] = useState<ShopDepartment>(initialCategory ? 'all' : 'featured');
  const [page, setPage] = useState<StorePage>(initialCategory ? 'catalog' : 'featured');
  const [filter, setFilter] = useState<StoreFilter>(initialCategory ?? 'all');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [tunnelProduct, setTunnelProduct] = useState<StoreProduct | null>(null);
  const store = useRef<HTMLElement>(null);
  const returnToCard = useRef<{ id: string; top: number } | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const viewAll = useRef<HTMLButtonElement>(null);
  const navigated = useRef(false);

  function openPage(next: StorePage) {
    navigated.current = true;
    setPage(next);
  }

  useEffect(() => {
    if (!navigated.current) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    (page === 'featured' ? viewAll.current : title.current)?.focus({ preventScroll: true });
  }, [page]);

  useEffect(() => {
    if (tunnelProduct || !returnToCard.current) return;
    const { id, top } = returnToCard.current;
    returnToCard.current = null;
    window.scrollTo({ top, behavior: 'instant' });
    store.current?.querySelector<HTMLButtonElement>('[data-store-product="' + id + '"]')?.focus({ preventScroll: true });
  }, [tunnelProduct]);

  const showProduct = (product: StoreProduct) => {
    if (product.id === 'tunnel-fit') {
      returnToCard.current = { id: product.id, top: window.scrollY };
      setTunnelProduct(product);
    } else {
      setSelection({ product });
    }
  };
  const matchingProducts = filter === 'all' ? STORE_PRODUCTS : STORE_PRODUCTS.filter(product => product.categories.includes(filter));
  const heading = page === 'featured' ? 'The Locker' : page === 'catalog' ? 'Shop the Store' : 'Earn Free Gear';

  const categoryButtons = <div className="bk-store-filters" role="group" aria-label="Shop categories">
    {[{ id: 'all', label: 'All' } as const, ...STORE_CATEGORIES].map(category =>
      <button type="button" key={category.id} aria-pressed={filter === category.id} onClick={() => setFilter(category.id)}>{category.label}</button>)}
  </div>;

  if (tunnelProduct) return <TunnelProductPage product={tunnelProduct} onBack={() => setTunnelProduct(null)}/>;

  return <section className="bk-store bk-store-locker-shop" ref={store} aria-label="Store">
    {page !== 'featured' && <button className="bk-store-back" type="button" onClick={() => { setDepartment('featured'); openPage('featured'); }}><ArrowLeft size={17} aria-hidden="true"/> Back to Store</button>}
    <header className="bk-store-header">
      <div><span className="bk-store-brand">Ball Knower</span><h1 id="bk-store-title" ref={title} tabIndex={-1}>{heading}</h1></div>
      <button type="button" className="bk-store-button bk-store-locker" onClick={onOpenLocker}><Archive size={17} aria-hidden="true"/> My Locker</button>
    </header>

    {page !== 'rewards' && <div className="bk-store-departments" role="group" aria-label="Shop departments">
      {departments.map(item => <button key={item.id} type="button" aria-pressed={department === item.id}
        onClick={() => { setDepartment(item.id); setFilter('all'); setPage(item.id === 'all' ? 'catalog' : 'featured'); }}>{item.label}</button>)}
    </div>}
    {page === 'featured' && <>
      {department === 'featured' && <section className="bk-store-featured" aria-labelledby="bk-store-featured-title">
        <img className="bk-store-hero-art" src={storeImage('campaign-blackout')} alt="" fetchPriority="high"/>
        <div className="bk-store-featured-copy">
          <span className="bk-store-kicker">The signature collection</span>
          <h2 id="bk-store-featured-title">Blackout<br/>Gear Kit</h2>
          <div className="bk-store-featured-actions"><button className="bk-store-button bk-store-button-gold" type="button" onClick={() => showProduct(BLACKOUT_KIT)}>Explore Drop</button></div>
        </div>
      </section>}
      {[
        { id: 'characters', title: 'New character collections', kicker: 'Featured drop', products: characterProducts },
        { id: 'clothing', title: 'Build your tunnel fit', kicker: 'Clothing', products: clothingProducts },
        { id: 'accessories', title: 'Make it your own', kicker: 'Accessories', products: accessoryProducts },
        { id: 'more', title: 'More for your game', kicker: 'Gear & extras', products: otherProducts },
      ].filter(group => department === 'featured' || department === group.id).map(group => <section key={group.id} aria-labelledby={'bk-store-' + group.id + '-title'} className="bk-store-shop">
        <span className="bk-store-kicker">{group.kicker}</span>
        <header className="bk-store-shop-header"><h2 id={'bk-store-' + group.id + '-title'}>{group.title}</h2></header>
        <div className="bk-store-grid">{group.products.map(product => <ProductCard key={product.id} product={product} onOpen={showProduct}/>)}</div>
      </section>)}
      <button ref={viewAll} className="bk-store-button bk-store-view-all" type="button" onClick={() => { setDepartment('all'); setFilter('all'); openPage('catalog'); }}>View All Items <ChevronRight size={17} aria-hidden="true"/></button>
      <button className="bk-store-reward-link" type="button" onClick={() => openPage('rewards')}>
        <Trophy size={25} aria-hidden="true"/><span><strong>Earn Free Gear</strong><small>Combine &amp; Gauntlet rewards</small></span><ChevronRight size={20} aria-hidden="true"/>
      </button>
    </>}

    {page === 'catalog' && <div className="bk-store-catalog">
      <p className="bk-store-intro">Find game-day gear, tunnel outfits, profile packs, and more. Pick an item to see what comes with it.</p>
      {categoryButtons}
      <p className="bk-store-count" role="status">{matchingProducts.length} {matchingProducts.length === 1 ? 'item' : 'items'} · Catalog preview</p>
      <div className="bk-store-grid bk-store-catalog-grid" aria-label="Catalog products">
        {matchingProducts.map(product => <ProductCard key={product.id} product={product} onOpen={showProduct}/>)}
      </div>
    </div>}

    {page === 'rewards' && <Suspense fallback={<p role="status">Loading gear rewards…</p>}>
      <StoreRewards onOpenLocker={onOpenLocker} onOpenGauntlet={onOpenGauntlet}/>
    </Suspense>}

    {selection && ((selection.product.showcase || selection.product.id === 'bkf-youngboy' || selection.product.id === 'frostbite' || selection.product.id === 'gold-standard') ? <BKFConceptDialog product={selection.product} onClose={() => setSelection(null)}/> : <ProductDialog selection={selection} onClose={() => setSelection(null)}/>)}
  </section>;
}
