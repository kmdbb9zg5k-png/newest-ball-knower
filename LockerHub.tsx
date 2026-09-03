import React,{useEffect,useMemo,useState} from 'react';
import {Crown,Package,Shirt,ShoppingBag} from 'lucide-react';
import {equipLockerItem,fetchLockerExperience,formatStorePrice,LockerState,PassProgress,StoreItem} from './lockerCloud';
import {useBallKnower} from './BallKnowerContext';
import {ProgressionProfileCard} from './ProgressionProfileCard';
import {ProfilePhotoEditor} from './ProfilePhotoEditor';

type Tab='locker'|'collections';
const lockerSlots:Record<string,keyof LockerState>={profile_frame:'equippedProfileFrame',nameplate:'equippedNameplate',league_theme:'equippedLeagueTheme',trivia_effect:'equippedTriviaEffect',my_player_cosmetic:'equippedMyPlayerCosmetic'};
const getLockerSlot=(item:StoreItem)=>lockerSlots[String(item.metadata.slot||'')];

export const LockerHub:React.FC=()=>{
 const {showToast}=useBallKnower();
 const [tab,setTab]=useState<Tab>('locker');
 const [catalog,setCatalog]=useState<StoreItem[]>([]);
 const [owned,setOwned]=useState<Set<string>>(new Set());
 const [locker,setLocker]=useState<LockerState>({});
 const [pass,setPass]=useState<PassProgress|null>(null);
 const [error,setError]=useState('');
 const refresh=async()=>{try{const d=await fetchLockerExperience();setCatalog([...d.catalog]);setOwned(new Set(d.entitlements.map(e=>e.sku)));setLocker(d.locker);setPass(d.pass);setError('');}catch(e:any){setError(e?.message||'Profile extras could not sync.');}};
 useEffect(()=>{void refresh()},[]);
 const tabs:[Tab,string][]=[['locker','Locker'],['collections','Collection']];
 const equip=async(item:StoreItem)=>{const slot=getLockerSlot(item);if(!slot){showToast('This collectible is owned but is not an equippable Locker item.');return;}try{await equipLockerItem(slot,item.sku);showToast(`${item.title} equipped.`);await refresh();}catch(e:any){showToast(e?.message||'Could not equip item.');}};
 const ownedItems=useMemo(()=>catalog.filter(x=>owned.has(x.sku)),[catalog,owned]);
 const ownedCollectibles=useMemo(()=>ownedItems.filter(x=>x.category==='collectible'),[ownedItems]);

 return <div className="relative isolate min-h-[calc(100dvh-7rem)] overflow-hidden px-3 pb-8 pt-4 sm:px-6 sm:pt-6">
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-20 bg-[linear-gradient(180deg,#05070a_0%,#070a0f_44%,#030406_100%)]"/>
  <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_14%_2%,rgb(var(--bk-team-primary-rgb)/.28),transparent_36%),radial-gradient(ellipse_at_88%_8%,rgb(var(--bk-team-secondary-rgb)/.16),transparent_34%)]"/>
  <div className="mx-auto max-w-5xl">
   <header className="mb-3">
    <div className="text-[9px] font-black uppercase tracking-[.24em] text-[var(--bk-team-accent)]">Your identity</div>
    <h1 className="mt-1 font-display text-3xl font-black uppercase sm:text-5xl">Ball Knower Profile</h1>
    <p className="mt-1 max-w-2xl text-xs font-semibold text-zinc-500">Your rating is the résumé. Cosmetics and extras stay secondary.</p>
   </header>

   <ProfilePhotoEditor/>
   <ProgressionProfileCard/>

   <div className="mt-3 flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-1.5 no-scrollbar">{tabs.map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id)} className={`min-h-10 shrink-0 rounded-lg px-3 text-[9px] font-black uppercase tracking-wider transition ${tab===id?'bg-[var(--bk-team-accent)] text-[var(--bk-on-accent)]':'text-zinc-500 hover:bg-white/5 hover:text-white'}`}>{label}</button>)}</div>
   {error&&<div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-xs font-bold text-red-300"><span>{error}</span><button onClick={()=>void refresh()} className="min-h-10 rounded-lg border border-red-400/30 px-4 text-[9px] font-black uppercase">Retry</button></div>}

   {tab==='locker'&&<div className="mt-3 space-y-3"><div className="grid grid-cols-3 gap-2"><Stat label="Owned" value={String(owned.size)}/><Stat label="Pass Lv" value={String(pass?.level||1)}/><Stat label="XP" value={String(pass?.xp||0)}/></div><div className="rounded-2xl border border-white/10 bg-black/30 p-4"><div className="text-[10px] font-black uppercase">Equipped</div><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">{Object.entries(locker).map(([k,v])=><div key={k} className="rounded-xl border border-white/5 bg-black/25 p-3"><div className="text-[8px] font-black uppercase text-zinc-600">{k.replace('equipped','').replace(/([A-Z])/g,' $1')}</div><div className="mt-1 truncate text-[11px] font-black">{v||'Default'}</div></div>)}</div></div><ItemGrid items={ownedItems} owned={owned} onEquip={equip}/></div>}
   {tab==='collections'&&<div className="mt-3">{ownedCollectibles.length?<ItemGrid items={ownedCollectibles} owned={owned} onEquip={equip}/>:<div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-center"><Package className="mx-auto h-6 w-6 text-[var(--bk-team-accent)]"/><div className="mt-3 text-sm font-black uppercase">No collectibles yet</div><p className="mt-1 text-xs text-zinc-500">Anything you earn will appear here.</p></div>}</div>}
  </div>
 </div>;
};

const ItemGrid=({items,owned,onEquip}:{items:StoreItem[];owned:Set<string>;onEquip:(x:StoreItem)=>void})=><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{items.map(i=>{const equippable=Boolean(getLockerSlot(i));return <div key={i.sku} className="rounded-2xl border border-white/10 bg-black/30 p-4"><div className="flex items-center justify-between"><CategoryIcon category={i.category}/><span className="text-[8px] font-black uppercase text-[var(--bk-team-accent)]">{i.rarity}</span></div><div className="mt-3 text-sm font-black uppercase">{i.title}</div><div className="mt-1 min-h-8 text-[10px] leading-4 text-zinc-600">{i.description}</div><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs font-black">{formatStorePrice(i)}</span>{owned.has(i.sku)?equippable?<button onClick={()=>onEquip(i)} className="min-h-10 rounded-lg bg-white px-3 text-[9px] font-black uppercase text-black">Equip</button>:<span className="rounded-lg border border-white/10 px-3 py-2 text-[9px] font-black uppercase text-zinc-500">Owned</span>:<span className="rounded-lg border border-white/10 px-3 py-2 text-[8px] font-black uppercase text-zinc-600">{i.priceCents==null?'Included':'Billing Required'}</span>}</div></div>})}</div>;
const CategoryIcon=({category}:{category:string})=>category==='collectible'?<Package className="h-4 w-4 text-[var(--bk-team-accent)]"/>:category.includes('cosmetic')?<Shirt className="h-4 w-4 text-[var(--bk-team-accent)]"/>:category==='subscription'?<Crown className="h-4 w-4 text-[var(--bk-team-accent)]"/>:<ShoppingBag className="h-4 w-4 text-[var(--bk-team-accent)]"/>;
const Stat=({label,value}:{label:string;value:string})=><div className="rounded-xl border border-white/10 bg-black/30 p-3"><div className="text-[8px] font-black uppercase text-zinc-600">{label}</div><div className="mt-1 text-xl font-black text-[var(--bk-team-accent)]">{value}</div></div>;
