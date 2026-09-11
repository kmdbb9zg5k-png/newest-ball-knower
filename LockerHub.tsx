import { BroadcastStage } from './BroadcastScene';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Crown, Maximize2, Package, Shirt, ShoppingBag, X } from 'lucide-react';
import { equipLockerItem, fetchLockerExperience, formatStorePrice, LockerState, PassProgress, StoreItem } from './lockerCloud';
import { useBallKnower } from './BallKnowerContext';
import { ModalPortal } from './ModalPortal';
import { ProgressionProfileCard } from './ProgressionProfileCard';
import { ProfilePhotoEditor } from './ProfilePhotoEditor';
import { LockerManagerIllustration } from './ProfileLockerArt';
import './profileLocker.css';
import type { LeagueMember } from './types';

type Tab='locker'|'collections';
const lockerSlots: Record<string, keyof LockerState> = { profile_frame: 'equippedProfileFrame', nameplate: 'equippedNameplate', league_theme: 'equippedLeagueTheme', trivia_effect: 'equippedTriviaEffect', my_player_cosmetic: 'equippedMyPlayerCosmetic' };
const getLockerSlot = (item: StoreItem) => lockerSlots[String(item.metadata.slot || '')];

type LockerHubProps = { onOpenAuth?: () => void; viewedMember?: LeagueMember | null; onBack?: () => void };

const possessiveLockerTitle = (name: string) => `${name}${name.trim().toLowerCase().endsWith('s') ? "'" : "'s"} Locker`;

export const LockerHub: React.FC<LockerHubProps> = ({ onOpenAuth, viewedMember, onBack }) => {
  const { currentUser } = useBallKnower();
  if (viewedMember?.userId) {
    return <PublicLocker member={viewedMember} onBack={onBack}/>;
  }
  return <LockerSession key={currentUser?.id || 'guest'} onOpenAuth={onOpenAuth}/>;
};

const PublicLocker: React.FC<{ member: LeagueMember; onBack?: () => void }> = ({ member, onBack }) => {
  const name = member.userName?.trim() || 'Manager';
  const avatar = member.userAvatar?.trim() || '';
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoUnavailable, setPhotoUnavailable] = useState(false);
  useEffect(() => {
    setPhotoOpen(false);
    setPhotoUnavailable(false);
  }, [avatar, member.userId]);
  const closeUnavailablePhoto = () => {
    setPhotoUnavailable(true);
    setPhotoOpen(false);
  };

  return <><BroadcastStage scene="locker" page="profile" className="bk-profile-page relative isolate min-h-[calc(100dvh-7rem)] overflow-hidden px-3 pb-8 pt-4 sm:px-6 sm:pt-6">
    <div className="mx-auto max-w-5xl">
      <header className="bk-locker-masthead">
        <button type="button" onClick={onBack} aria-label="Back to league" className="bk-locker-back"><ArrowLeft aria-hidden="true"/></button>
        <h1>{possessiveLockerTitle(name)}</h1>
        <span>Football minds build more<i aria-hidden="true"/></span>
      </header>
      <div className="bk-profile-identity" data-testid="locker-identity">
        <section className="bk-member-locker-identity" aria-label={`${name}'s Ball Knower profile`}>
          <div className="bk-member-locker-portrait">
            {name.slice(0, 2).toUpperCase()}
            {avatar && !photoUnavailable && <button type="button" className="bk-member-locker-photo-trigger" aria-label={`Expand ${name}'s profile photo`} aria-haspopup="dialog" onClick={() => setPhotoOpen(true)}>
              <img src={avatar} alt="" referrerPolicy="no-referrer" onError={closeUnavailablePhoto}/>
              <span aria-hidden="true"><Maximize2/></span>
            </button>}
          </div>
          <div className="bk-member-locker-copy"><div>{name}</div><div>League manager · verified Ball Knower profile</div></div>
        </section>
        <LockerManagerIllustration/>
      </div>
      <ProgressionProfileCard targetUserId={member.userId} targetDisplayName={name}/>
    </div>
  </BroadcastStage>
  {photoOpen && avatar && <ExpandedProfilePhoto name={name} src={avatar} onClose={() => setPhotoOpen(false)} onError={closeUnavailablePhoto}/>}
  </>;
};

const ExpandedProfilePhoto: React.FC<{ name: string; src: string; onClose: () => void; onError: () => void }> = ({ name, src, onClose, onError }) => {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return <ModalPortal><div className="fixed inset-0 z-[9999] grid place-items-center bg-black/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label={`${name}'s profile photo`} className="relative flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[#e4c77f]/45 bg-[#080d12] shadow-2xl" onClick={event => event.stopPropagation()}>
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-white/10 px-4">
        <div className="min-w-0"><div className="truncate text-base font-black text-white">{name}</div><div className="text-[9px] font-black uppercase tracking-[.18em] text-[#e4c77f]">Profile photo</div></div>
        <button type="button" aria-label="Close profile photo" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white"><X className="h-5 w-5"/></button>
      </header>
      <div className="grid min-h-0 flex-1 place-items-center bg-black p-2 sm:p-4"><img src={src} alt={`${name}'s profile photo`} referrerPolicy="no-referrer" onError={onError} className="max-h-[calc(100dvh-8rem)] w-full object-contain"/></div>
    </section>
  </div></ModalPortal>;
};

const LockerSession: React.FC<{ onOpenAuth?: () => void }> = ({ onOpenAuth }) => {
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
        <ProfilePhotoEditor onOpenAuth={onOpenAuth}/>
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
