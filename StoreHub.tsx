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
import StoreCart, { useStoreCart } from './StoreCart';
import './store.css';
import './bkf-drop.css';

const AthleteLivePreview = lazy(() => import('./AthleteLivePreview'));
const StoreRewards = lazy(() => import('./StoreRewards'));
const BKFYoungBoyPose = lazy(() => import('./BKFYoungBoyPose'));
const BKFFrostbitePose = lazy(() => import('./BKFFrostbitePose'));

type StorePage = 'featured' | 'catalog' | 'rewards';
type Selection = { product: StoreProduct };
const campaignCards = ['tunnel-fit', 'gold-standard', 'bkf-youngboy', 'frostbite', 'chrome-grip'].map(id => STORE_PRODUCTS.find(product => product.id === id)!);
const tunnelPhotos = [
  { file: 'tunnel-look', label: 'Full outfit', alt: 'Athlete wearing the graphite Tunnel Fit in a stadium tunnel' },
  { file: 'tunnel-hoodie', label: 'Hoodie detail', alt: 'Graphite fleece, warm gold drawcord tips and chest embroidery' },
  { file: 'tunnel-sweats', label: 'Sweats detail', alt: 'Graphite jogger pocket and stitching' },
  { file: 'tunnel-trainers', label: 'Trainer detail', alt: 'Slate trainer with a mesh upper and layered sole' },
] as const;

const goldPhotos = [
  { file: 'gold-standard', label: 'Full outfit', alt: 'Gold Standard tracksuit on the detailed showroom athlete' },
] as const;

function ProductCard({ product, onOpen }: { product: StoreProduct; onOpen: (product: StoreProduct) => void }) {
  return <button className="bk-store-product" type="button" data-store-product={product.id} onClick={() => onOpen(product)}>
    {product.id === 'frostbite' ? <span className="bk-store-frostbite-poster"><img src={storeImage('frostbite')} alt="" loading="lazy" decoding="async"/></span> : <img src={storeImage(product.id === 'tunnel-fit' ? 'tunnel-kit' : product.id)} alt="" loading="lazy" decoding="async"/>}
    <span className="bk-store-product-text">
      <strong>{product.name}</strong>
      <span>{product.summary}</span>
      <b>{storePrice(product)}</b>
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
      />
  </Suspense>;
}

const FROSTBITE_PREVIEW_FALLBACK = 'https://v3b.fal.media/files/b/0ab1eab2/PuPh4vtWpnfEVTwvd_xXM_preview.png';

function BKFConceptDialog({ product, onClose }: { product: StoreProduct; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const isFrostbite = product.id === 'frostbite';
  const [view, setView] = useState<'photos' | '3d'>('photos');
  const [art, setArt] = useState(() => storeImage(isFrostbite ? 'frostbite-look' : product.id));
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
  }, []);
  return <dialog ref={dialog} className={'bk-store-dialog bkf-drop-modal' + (isFrostbite ? ' bkf-drop-modal--frostbite' : '')}
    aria-labelledby="bkf-drop-title" data-bkf-collection={product.id}
    onClose={onClose} onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
    <div className="bkf-drop-shell">
      <header className="bkf-drop-header">
        <div className="bkf-drop-brand"><Crown size={23} aria-hidden="true"/><span><strong>Ball Knower</strong><small>Clothing Package</small></span></div>
        <button type="button" className="bkf-drop-close" aria-label="Close product" onClick={() => dialog.current?.close()}><X size={25} aria-hidden="true"/></button>
      </header>
      <div className="bkf-drop-heading">
        <p>{isFrostbite ? 'Icebound Concept Collection' : 'Streetwear Concept Collection'}</p>
        <h2 id="bkf-drop-title" className="bkf-drop-title"><span>BKF</span> {isFrostbite ? 'Frostbite' : 'YoungBoy'}</h2>
      </div>
      <div className="bkf-drop-tabs" role="group" aria-label="Product view">
        <button type="button" aria-pressed={view === 'photos'} onClick={() => setView('photos')}><ImageIcon size={18} aria-hidden="true"/> Product photos</button>
        <button type="button" aria-pressed={view === '3d'} onClick={() => setView('3d')}><BoxIcon size={18} aria-hidden="true"/> 3D try-on</button>
      </div>
      <div className="bkf-drop-hero" data-bkf-display={view}>
        {view === 'photos'
          ? <img src={art} alt={isFrostbite
            ? 'Frostbite realistic full-body look wearing a silver-white puffer jacket, white mask, chain, cargo pants and boots'
            : 'BKF YoungBoy original luxury black-and-gold artwork: masked athlete crouching in a black hoodie, gold chain and watch, baggy brown cargos and tan boots'}
            onError={() => {
              const fallback = isFrostbite ? FROSTBITE_PREVIEW_FALLBACK : '/store/bkf-youngboy.svg';
              if (art !== fallback) setArt(fallback);
            }}/>
          : <Suspense fallback={<div className="bkf-drop-load" role="status">Preparing {product.name}'s 3D showroom…</div>}>
              {isFrostbite ? <BKFFrostbitePose/> : <BKFYoungBoyPose/>}
            </Suspense>}
      </div>
      <p className="bkf-drop-description">{isFrostbite
        ? 'Glacier-white puffer. White knit shiesty mask. Iced silver chain and watch. Loose ice-gray cargos and white high-top boots. One seriously cold streetwear look.'
        : 'Black shiesty mask. Heavy gold chain. Diamond-style watch. Oversized black hoodie, baggy brown cargos and tan boots. One signature streetwear look.'}</p>
      <div className="bkf-drop-includes">
        <h3><span>Included</span></h3>
        <ul>{product.includes.map(item=><li key={item}>{item}</li>)}</ul>
      </div>
      <footer className="bkf-drop-footer">
        <button type="button" className="bkf-drop-cta" onClick={() => setView(view === 'photos' ? '3d' : 'photos')}>
          <BoxIcon size={21} aria-hidden="true"/>{view === 'photos' ? 'Preview in 3D' : isFrostbite ? 'View product photos' : 'View cover art'}
        </button>
        <div><strong>Coming Soon</strong><span>Concept Collection</span></div>
      </footer>
      <p className="bkf-drop-disclaimer">3D is a prototype. Wearable items and checkout are not available yet.</p>
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

function TunnelProductPage({ product, onBack, inCart, onAdd, onCart }: { product: StoreProduct; onBack: () => void; inCart: boolean; onAdd: () => void; onCart: () => void }) {
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
      <h1 id="bk-tunnel-title" ref={title} tabIndex={-1}>{product.name}</h1><button className="bk-store-button" type="button" onClick={onCart}>Cart</button>
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
        <button className="bk-store-button bk-store-button-gold bk-tunnel-try-on" type="button" onClick={inCart ? onCart : onAdd}>{inCart ? "View cart" : "Add to cart"}</button><p className="bk-store-purchase-status" role="status">{inCart ? "Added to your cart" : "Digital outfit · One per account"}</p>
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
  const cart = useStoreCart();
  const [cartOpen, setCartOpen] = useState(() => new URLSearchParams(window.location.search).has('store_checkout'));
  const cartDialog = cartOpen ? <StoreCart cart={cart} onClose={() => setCartOpen(false)}/> : null;
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
    if (product.id === 'tunnel-fit' || product.id === 'gold-standard') {
      returnToCard.current = { id: product.id, top: window.scrollY };
      setTunnelProduct(product);
    } else {
      setSelection({ product });
    }
  };
  const matchingProducts = filter === 'all' ? STORE_PRODUCTS : STORE_PRODUCTS.filter(product => product.categories.includes(filter));
  const heading = page === 'featured' ? 'Store' : page === 'catalog' ? 'Shop the Store' : 'Earn Free Gear';

  const categoryButtons = <div className="bk-store-filters" role="group" aria-label="Shop categories">
    {[{ id: 'all', label: 'All' } as const, ...STORE_CATEGORIES].map(category =>
      <button type="button" key={category.id} aria-pressed={filter === category.id} onClick={() => setFilter(category.id)}>{category.label}</button>)}
  </div>;

  if (tunnelProduct) return <><TunnelProductPage product={tunnelProduct} onBack={() => setTunnelProduct(null)} inCart={cart.ids.includes(tunnelProduct.id)} onAdd={() => cart.add(tunnelProduct.id)} onCart={() => setCartOpen(true)}/>{cartDialog}</>;

  return <section className="bk-store" ref={store} aria-labelledby="bk-store-title">
    {page !== 'featured' && <button className="bk-store-back" type="button" onClick={() => openPage('featured')}><ArrowLeft size={17} aria-hidden="true"/> Back to Store</button>}
    <header className="bk-store-header">
      <h1 id="bk-store-title" ref={title} tabIndex={-1}>{heading}</h1>
      <button type="button" className="bk-store-button" onClick={() => setCartOpen(true)}>Cart ({cart.ids.length})</button>
      <button type="button" className="bk-store-button bk-store-locker" onClick={onOpenLocker}><Archive size={17} aria-hidden="true"/> My Locker</button>
    </header>

    {page === 'featured' && <>
      <section className="bk-store-featured" aria-labelledby="bk-store-featured-title">
        <img className="bk-store-hero-art" src={storeImage('campaign-blackout')} alt="" fetchPriority="high"/>
        <div className="bk-store-featured-copy">
          <span className="bk-store-kicker">Featured Drop</span>
          <h2 id="bk-store-featured-title">Blackout<br/>Gear Kit</h2>
          <div className="bk-store-featured-actions">
            <button className="bk-store-button bk-store-button-gold" type="button" onClick={() => showProduct(BLACKOUT_KIT)}>Explore Drop</button>
          </div>
        </div>
      </section>
      {categoryButtons}
      <section aria-labelledby="bk-store-shop-title" className="bk-store-shop">
        <header className="bk-store-shop-header">
          <h2 id="bk-store-shop-title">Shop the Store</h2>
          <button ref={viewAll} className="bk-store-button bk-store-view-all" type="button" onClick={() => openPage('catalog')}>
            View All <ChevronRight size={17} aria-hidden="true"/>
          </button>
        </header>
        <div className="bk-store-grid">{(filter === 'all' ? campaignCards : matchingProducts).map(product => <ProductCard key={product.id} product={product} onOpen={showProduct}/>)}</div>
      </section>
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

    {cartDialog}
    {selection && ((selection.product.id === 'bkf-youngboy' || selection.product.id === 'frostbite') ? <BKFConceptDialog product={selection.product} onClose={() => setSelection(null)}/> : <ProductDialog selection={selection} onClose={() => setSelection(null)}/>)}
  </section>;
}
