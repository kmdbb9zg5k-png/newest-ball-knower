import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Archive, ArrowLeft, ChevronRight, Shirt, Trophy, X } from 'lucide-react';
import { DEFAULT_ATHLETE_APPEARANCE } from './athleteAppearance';
import { recommendedAthleteBuild } from './athleteBuild';
import { readAthletePassport, type AthletePassport } from './athletePassport';
import GameGearPreview from './GameGearPreview';
import { sanitizeGameGear } from './playerGameGear';
import { readOutfit } from './playerWardrobe';
import {
  BLACKOUT_KIT, FEATURED_PACKS, STORE_CATEGORIES, STORE_PRODUCTS,
  storeImage, storePrice, type StoreCategory, type StoreFilter, type StoreProduct,
} from './storeCatalog';
import './store.css';

const AthleteLivePreview = lazy(() => import('./AthleteLivePreview'));
const StoreRewards = lazy(() => import('./StoreRewards'));

type StorePage = 'featured' | 'catalog' | 'rewards';
type Selection = { product: StoreProduct; tryOn?: boolean };

function ProductCard({ product, onOpen }: { product: StoreProduct; onOpen: (product: StoreProduct) => void }) {
  return <button className="bk-store-product" type="button" onClick={() => onOpen(product)}>
    <img src={storeImage(product.id)} alt="" loading="lazy" decoding="async"/>
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
      <p className="bk-store-visor-note">See the smoked visor in the product art.</p>
    </div>;
  }

  const outfit = { ...readOutfit(), ...preview.outfit };
  const profile = {
    ...(athlete?.build ?? recommendedAthleteBuild('WR')),
    ...(athlete?.appearance ?? DEFAULT_ATHLETE_APPEARANCE),
    name: athlete?.name ?? 'Sample athlete',
    number: athlete?.number ?? 1,
    combineId: athlete?.id ?? 'store-sample',
  };
  return <Suspense fallback={<p className="bk-store-preview-loading" role="status">Preparing your athlete…</p>}>
    <AthleteLivePreview profile={profile} previewOutfit={outfit}/>
  </Suspense>;
}

function ProductDialog({ selection, onClose }: { selection: Selection; onClose: () => void }) {
  const { product } = selection;
  const dialog = useRef<HTMLDialogElement>(null);
  const [athlete] = useState(readAthletePassport);
  const [trying, setTrying] = useState(Boolean(selection.tryOn));

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

export default function StoreHub({ initialCategory, onOpenLocker, onOpenGauntlet }: {
  initialCategory?: StoreCategory;
  onOpenLocker: () => void;
  onOpenGauntlet: () => void;
}) {
  const [page, setPage] = useState<StorePage>(initialCategory ? 'catalog' : 'featured');
  const [filter, setFilter] = useState<StoreFilter>(initialCategory ?? 'all');
  const [selection, setSelection] = useState<Selection | null>(null);
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

  const showProduct = (product: StoreProduct) => setSelection({ product });
  const matchingProducts = filter === 'all' ? STORE_PRODUCTS : STORE_PRODUCTS.filter(product => product.categories.includes(filter));
  const heading = page === 'featured' ? 'Store' : page === 'catalog' ? 'Shop the Store' : 'Earn Free Gear';

  return <section className="bk-store" aria-labelledby="bk-store-title">
    {page !== 'featured' && <button className="bk-store-back" type="button" onClick={() => openPage('featured')}><ArrowLeft size={17} aria-hidden="true"/> Back to Store</button>}
    <header className="bk-store-header">
      <h1 id="bk-store-title" ref={title} tabIndex={-1}>{heading}</h1>
      <button type="button" className="bk-store-button bk-store-locker" onClick={onOpenLocker}><Archive size={17} aria-hidden="true"/> My Locker</button>
    </header>

    {page === 'featured' && <>
      <section className="bk-store-featured" aria-labelledby="bk-store-featured-title">
        <img className="bk-store-hero-art" src={storeImage(BLACKOUT_KIT.id)} alt="" fetchPriority="high"/>
        <div className="bk-store-featured-copy">
          <span className="bk-store-kicker">Featured Drop</span>
          <h2 id="bk-store-featured-title">Blackout<br/>Gear Kit</h2>
          <p>{BLACKOUT_KIT.summary}</p>
          <div className="bk-store-featured-actions">
            <button className="bk-store-button" type="button" onClick={() => setSelection({ product: BLACKOUT_KIT, tryOn: true })}>Try On</button>
            <button className="bk-store-button bk-store-button-gold" type="button" onClick={() => showProduct(BLACKOUT_KIT)}>View Kit · {storePrice(BLACKOUT_KIT)}</button>
          </div>
        </div>
      </section>
      <section aria-labelledby="bk-store-shop-title" className="bk-store-shop">
        <header className="bk-store-shop-header">
          <h2 id="bk-store-shop-title">Shop the Store</h2>
          <button ref={viewAll} className="bk-store-button bk-store-view-all" type="button" onClick={() => { setFilter('all'); openPage('catalog'); }}>
            View All <ChevronRight size={17} aria-hidden="true"/>
          </button>
        </header>
        <div className="bk-store-grid">{FEATURED_PACKS.map(product => <ProductCard key={product.id} product={product} onOpen={showProduct}/>)}</div>
      </section>
      <button className="bk-store-reward-link" type="button" onClick={() => openPage('rewards')}>
        <Trophy size={25} aria-hidden="true"/><span><strong>Earn Free Gear</strong><small>Combine &amp; Gauntlet rewards</small></span><ChevronRight size={20} aria-hidden="true"/>
      </button>
    </>}

    {page === 'catalog' && <div className="bk-store-catalog">
      <p className="bk-store-intro">Find game-day gear, tunnel outfits, profile packs, and more. Pick an item to see what comes with it.</p>
      <div className="bk-store-filters" role="group" aria-label="Shop categories">
        {[{ id: 'all', label: 'All' } as const, ...STORE_CATEGORIES].map(category =>
          <button type="button" key={category.id} aria-pressed={filter === category.id} onClick={() => setFilter(category.id)}>{category.label}</button>)}
      </div>
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
