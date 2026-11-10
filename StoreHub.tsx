import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, ChevronRight, Shirt, Trophy, X } from 'lucide-react';
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

const AthleteLivePreview = lazy(() => import('./AthleteLivePreview'));
const StoreRewards = lazy(() => import('./StoreRewards'));

type StorePage = 'featured' | 'catalog' | 'rewards';
type Selection = { product: StoreProduct };
const campaignCards = ['tunnel-fit', 'gold-standard', 'chrome-grip'].map(id => STORE_PRODUCTS.find(product => product.id === id)!);
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
    <img src={storeImage(product.id === 'tunnel-fit' ? 'tunnel-kit' : product.id)} alt="" loading="lazy" decoding="async"/>
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
      {trying && product.tryOn
        ? <div className="bk-store-try-on">
            <div className="bk-store-try-on-label"><Shirt size={15} aria-hidden="true"/> <strong>{athlete ? athlete.name : 'Sample athlete'}</strong> <span>Try-on preview</span></div>
            <TryOnPreview athlete={athlete} preview={product.tryOn}/>
          </div>
        : <img className="bk-store-detail-art" src={storeImage(product.id)} alt={product.summary}/>}
      <p className="bk-store-detail-description">{product.description}</p>
      <h3>Included</h3>
      <ul className="bk-store-includes">{product.includes.map(item => <li key={item}>{item}</li>)}</ul>
      <div className="bk-store-dialog-actions">
        {product.tryOn && <button type="button" className="bk-store-button" onClick={() => setTrying(value => !value)}>{trying ? 'View product art' : 'Try on'}</button>}
        <div className="bk-store-price-status">
          <strong>{storePrice(product)}</strong><span>Planned price</span>
        </div>
      </div>
      <p className="bk-store-purchase-status">Catalog preview · Checkout opens at launch.</p>
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

  if (tunnelProduct) return <TunnelProductPage product={tunnelProduct} onBack={() => setTunnelProduct(null)}/>;

  return <section className="bk-store" ref={store} aria-labelledby="bk-store-title">
    {page !== 'featured' && <button className="bk-store-back" type="button" onClick={() => openPage('featured')}><ArrowLeft size={17} aria-hidden="true"/> Back to Store</button>}
    <header className="bk-store-header">
      <h1 id="bk-store-title" ref={title} tabIndex={-1}>{heading}</h1>
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

    {selection && <ProductDialog selection={selection} onClose={() => setSelection(null)}/>}
  </section>;
}
