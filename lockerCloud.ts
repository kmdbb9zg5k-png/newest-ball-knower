import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureOnlineSession, supabase } from './supabase';

export type StoreCategory='profile_cosmetic'|'trivia_cosmetic'|'league_cosmetic'|'my_player_cosmetic'|'collectible'|'season_pass'|'subscription';
export type StoreItem={sku:string;title:string;description:string;category:StoreCategory;rarity:'common'|'rare'|'epic'|'legendary';priceCents?:number;currency:string;season?:string;metadata:Record<string,unknown>};
export type Entitlement={sku:string;source:string;grantedAt:string;expiresAt?:string};
export type LockerState={equippedProfileFrame?:string;equippedNameplate?:string;equippedLeagueTheme?:string;equippedTriviaEffect?:string;equippedMyPlayerCosmetic?:string};
export type PassProgress={season:string;xp:number;level:number;premiumUnlocked:boolean;claimedFree:number[];claimedPremium:number[]};

type Json = string | number | boolean | null | { [key:string]: Json | undefined } | Json[];
type StoreCatalogRow={sku:string;title:string;description:string;category:StoreCategory;rarity:'common'|'rare'|'epic'|'legendary';price_cents:number|null;currency:string|null;season:string|null;metadata:Json|null;active:boolean};
type EntitlementRow={sku:string;source:string;granted_at:string;expires_at:string|null;auth_user_id:string};
type LockerRow={auth_user_id:string;equipped_profile_frame:string|null;equipped_nameplate:string|null;equipped_league_theme:string|null;equipped_trivia_effect:string|null;equipped_my_player_cosmetic:string|null};
type PassProgressRow={auth_user_id:string;season:string;xp:number|null;level:number|null;premium_unlocked:boolean|null;claimed_free:number[]|null;claimed_premium:number[]|null};
type LockerDatabase={public:{Tables:{
  ball_knower_store_catalog:{Row:StoreCatalogRow;Insert:Partial<StoreCatalogRow>;Update:Partial<StoreCatalogRow>;Relationships:[]};
  ball_knower_entitlements:{Row:EntitlementRow;Insert:Partial<EntitlementRow>;Update:Partial<EntitlementRow>;Relationships:[]};
  ball_knower_locker:{Row:LockerRow;Insert:Partial<LockerRow>;Update:Partial<LockerRow>;Relationships:[]};
  ball_knower_pass_progress:{Row:PassProgressRow;Insert:Partial<PassProgressRow>;Update:Partial<PassProgressRow>;Relationships:[]};
};Views:{};Functions:{equip_ball_knower_locker_item:{Args:{p_slot:string;p_sku:string|null};Returns:undefined}};Enums:{};CompositeTypes:{}}};

const mapItem=(x:StoreCatalogRow):StoreItem=>({sku:x.sku,title:x.title,description:x.description,category:x.category,rarity:x.rarity,priceCents:x.price_cents??undefined,currency:x.currency||'USD',season:x.season||undefined,metadata:(x.metadata&&typeof x.metadata==='object'&&!Array.isArray(x.metadata)?x.metadata:{}) as Record<string,unknown>});
const mapLocker=(x:LockerRow|null):LockerState=>({equippedProfileFrame:x?.equipped_profile_frame||undefined,equippedNameplate:x?.equipped_nameplate||undefined,equippedLeagueTheme:x?.equipped_league_theme||undefined,equippedTriviaEffect:x?.equipped_trivia_effect||undefined,equippedMyPlayerCosmetic:x?.equipped_my_player_cosmetic||undefined});

export async function fetchLockerExperience(){
  if(!supabase) throw new Error('Locker is unavailable because online services are not configured.');
  const auth=await ensureOnlineSession();
  const lockerClient=supabase as SupabaseClient<LockerDatabase>;
  const [catalog,entitlements,locker,pass]=await Promise.all([
    lockerClient.from('ball_knower_store_catalog').select('*').eq('active',true).order('category').order('price_cents'),
    lockerClient.from('ball_knower_entitlements').select('sku,source,granted_at,expires_at,auth_user_id').eq('auth_user_id',auth.id),
    lockerClient.from('ball_knower_locker').select('*').eq('auth_user_id',auth.id).maybeSingle(),
    lockerClient.from('ball_knower_pass_progress').select('*').eq('auth_user_id',auth.id).eq('season','2026').maybeSingle(),
  ]);
  const err=[catalog.error,entitlements.error,locker.error,pass.error].find(Boolean); if(err) throw err;
  const now=Date.now();
  const activeEntitlements=(entitlements.data||[])
    .map((x:EntitlementRow):Entitlement=>({sku:x.sku,source:x.source,grantedAt:x.granted_at,expiresAt:x.expires_at||undefined}))
    .filter((x:Entitlement)=>!x.expiresAt || new Date(x.expiresAt).getTime()>now);
  return {
    catalog:(catalog.data||[]).map(mapItem),
    entitlements:activeEntitlements,
    locker:mapLocker(locker.data),
    pass:pass.data?{season:pass.data.season,xp:Number(pass.data.xp)||0,level:Number(pass.data.level)||1,premiumUnlocked:Boolean(pass.data.premium_unlocked),claimedFree:pass.data.claimed_free||[],claimedPremium:pass.data.claimed_premium||[]} as PassProgress:null,
  };
}

export async function equipLockerItem(slot:keyof LockerState,sku:string|null){
  if(!supabase) throw new Error('Locker is unavailable because online services are not configured.');
  await ensureOnlineSession();
  const lockerClient=supabase as SupabaseClient<LockerDatabase>;
  const rpcSlot:Record<keyof LockerState,string>={equippedProfileFrame:'profile_frame',equippedNameplate:'nameplate',equippedLeagueTheme:'league_theme',equippedTriviaEffect:'trivia_effect',equippedMyPlayerCosmetic:'my_player_cosmetic'};
  const {error}=await lockerClient.rpc('equip_ball_knower_locker_item',{p_slot:rpcSlot[slot],p_sku:sku});
  if(error) throw error;
}

export const formatStorePrice=(item:StoreItem)=>item.priceCents==null?'Included':new Intl.NumberFormat('en-US',{style:'currency',currency:item.currency||'USD'}).format(item.priceCents/100);
