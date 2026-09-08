import { BroadcastStage } from './BroadcastScene';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crown, Package, Shirt, ShoppingBag } from 'lucide-react';
import { equipLockerItem, fetchLockerExperience, formatStorePrice, LockerState, PassProgress, StoreItem } from './lockerCloud';
import { useBallKnower } from './BallKnowerContext';
import { ProgressionProfileCard } from './ProgressionProfileCard';
import { ProfilePhotoEditor } from './ProfilePhotoEditor';
import { LockerManagerIllustration } from './ProfileLockerArt';
import './profileLocker.css';

type Tab='locker'|'collections';
const lockerSlots: Record<string, keyof LockerState> = { profile_frame: 'equippedProfileFrame', nameplate: 'equippedNameplate', league_theme: 'equippedLeagueTheme', trivia_effect: 'equippedTriviaEffect', my_player_cosmetic: 'equippedMyPlayerCosmetic' };
const getLockerSlot = (item: StoreItem) => lockerSlots[String(item.metadata.slot || '')];

export const LockerHub: React.FC = () => {
  const { currentUser } = useBallKnower();
  return <LockerSession key={currentUser?.id || 'guest'}/>;
};

const LockerSession: React.FC = () => {
  const { showToast, currentUser } = useBallKnower();
  const [tab, setTab] = useState<Tab>('locker');
  const [catalog, setCatalog] = useState<StoreItem[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [locker, setLocker] = useState<LockerState>({});
  const [pass, setPass] = useState<PassProgress | null>(null);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  const refresh = async () => {
    const version = ++requestVersion.current;
    try {
      const data = await fetchLockerExperience();
      if (version !== requestVersion.current) return;
      setCatalog([...data.catalog]);
      setOwned(new Set(data.entitlements.map(item => item.sku)));
      setLocker(data.locker);
      setPass(data.pass);
      setError('');
    } catch (cause: any) {
      if (version === requestVersion.current) setError(cause?.message || 'Profile extras could not sync.');
    }
  };
  useEffect(() => { void refresh(); return () => { requestVersion.current += 1; }; }, []);
  const tabs: [Tab, string][] = [['locker', 'Locker'], ['collections', 'Collection']];
  const equip = async (item: StoreItem) => {
    const slot = getLockerSlot(item);
    if (!slot) { showToast('This collectible is owned but is not an equippable Locker item.'); return; }
    try { await equipLockerItem(slot, item.sku); showToast(`${item.title} equipped.`); await refresh(); }
    catch (cause: any) { showToast(cause?.message || 'Could not equip item.'); }
  };
  const ownedItems = useMemo(() => catalog.filter(item => owned.has(item.sku)), [catalog, owned]);
  const ownedCollectibles = useMemo(() => ownedItems.filter(x=>x.category==='collectible'), [ownedItems]);

  return <BroadcastStage scene="locker" page="profile" className="bk-profile-page relative isolate min-h-[calc(100dvh-7rem)] overflow-hidden px-3 pb-8 pt-4 sm:px-6 sm:pt-6">
    <div className="mx-auto max-w-5xl">
      <header className="bk-locker-masthead"><h1>Your Locker</h1><span>Football minds build more<i aria-hidden="true"/></span></header>
      <div className="bk-profile-identity" data-testid="locker-identity">
        <ProfilePhotoEditor/>
        <LockerManagerIllustration/>
        {currentUser?.id && <details className="bk-locker-account"><summary>Account ID · …{currentUser.id.slice(-8)}</summary><code>{currentUser.id}</code></details>}
      </div>
      <ProgressionProfileCard/>
      <details className="bk-profile-extras">
        <summary className="bk-profile-extras-heading">Locker &amp; collection</summary>
        <div aria-label="Locker and collection">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-1.5 no-scrollbar">{tabs.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)} className={`min-h-11 shrink-0 rounded-lg px-3 text-[10px] font-black uppercase tracking-wider transition ${tab === id ? 'bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}>{label}</button>)}</div>
        {error && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs font-bold text-red-300"><span>{error}</span><button onClick={() => void refresh()} className="min-h-11 rounded-lg border border-red-400/30 px-4 text-[10px] font-black uppercase">Retry</button></div>}
        {tab === 'locker' && <div className="mt-3 space-y-3"><div className="grid grid-cols-3 gap-2"><Stat label="Owned" value={String(owned.size)}/><Stat label="Pass Lv" value={pass ? String(pass.level) : '—'}/><Stat label="Pass XP" value={pass ? String(pass.xp) : '—'}/></div><div className="rounded-2xl border border-white/10 bg-black/30 p-4"><div className="text-[10px] font-black uppercase">Equipped</div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{Object.entries(locker).map(([key, value]) => <div key={key} className="rounded-xl border border-white/5 bg-black/25 p-3"><div className="text-[9px] font-black uppercase text-zinc-400">{key.replace('equipped', '').replace(/([A-Z])/g, ' $1')}</div><div className="mt-1 truncate text-[11px] font-black">{value || 'Default'}</div></div>)}</div></div><ItemGrid items={ownedItems} owned={owned} onEquip={equip}/></div>}
        {tab === 'collections' && <div className="mt-3">{ownedCollectibles.length ? <ItemGrid items={ownedCollectibles} owned={owned} onEquip={equip}/> : <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center"><Package className="mx-auto h-6 w-6 text-[var(--bk-team-accent)]"/><div className="mt-3 text-sm font-black uppercase">No collectibles yet</div><p className="mt-1 text-xs text-zinc-400">Anything you earn will appear here.</p></div>}</div>}
        </div>
      </details>
    </div>
  </BroadcastStage>;
};

const ItemGrid = ({ items, owned, onEquip }: { items: StoreItem[]; owned: Set<string>; onEquip: (item: StoreItem) => void }) => <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{items.map(item => {
  const equippable = Boolean(getLockerSlot(item));
  return <div key={item.sku} className="rounded-2xl border border-white/10 bg-black/30 p-4"><div className="flex items-center justify-between"><CategoryIcon category={item.category}/><span className="text-[9px] font-black uppercase text-[var(--bk-team-accent)]">{item.rarity}</span></div><div className="mt-3 text-sm font-black uppercase">{item.title}</div><div className="mt-1 min-h-8 text-[11px] leading-4 text-zinc-400">{item.description}</div><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs font-black">{formatStorePrice(item)}</span>{owned.has(item.sku) ? equippable ? <button onClick={() => onEquip(item)} className="min-h-11 rounded-lg bg-[var(--bk-team-accent)] px-3 text-[10px] font-black uppercase text-[var(--bk-on-accent)]">Equip</button> : <span className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-black uppercase text-zinc-400">Owned</span> : <span className="rounded-lg border border-white/10 px-3 py-2 text-[9px] font-black uppercase text-zinc-400">{item.priceCents == null ? 'Included' : 'Billing Required'}</span>}</div></div>;
})}</div>;
const CategoryIcon = ({ category }: { category: string }) => category === 'collectible' ? <Package className="h-4 w-4 text-[var(--bk-team-accent)]"/> : category.includes('cosmetic') ? <Shirt className="h-4 w-4 text-[var(--bk-team-accent)]"/> : category === 'subscription' ? <Crown className="h-4 w-4 text-[var(--bk-team-accent)]"/> : <ShoppingBag className="h-4 w-4 text-[var(--bk-team-accent)]"/>;
const Stat = ({ label, value }: { label: string; value: string }) => <div className="rounded-xl border border-white/10 bg-black/30 p-3"><div className="text-[9px] font-black uppercase text-zinc-400">{label}</div><div className="mt-1 text-xl font-black text-[var(--bk-team-accent)]">{value}</div></div>;
