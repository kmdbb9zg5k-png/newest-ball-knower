import { ensureOnlineSession, supabase } from './supabase';

export type StoreCategory='profile_cosmetic'|'trivia_cosmetic'|'league_cosmetic'|'my_player_cosmetic'|'collectible'|'season_pass'|'subscription';
export type StoreItem={sku:string;title:string;description:string;category:StoreCategory;rarity:'common'|'rare'|'epic'|'legendary';priceCents?:number;currency:string;season?:string;metadata:Record<string,unknown>};
export type Entitlement={sku:string;source:string;grantedAt:string;expiresAt?:string};
export type LockerState={equippedProfileFrame?:string;equippedNameplate?:string;equippedLeagueTheme?:string;equippedTriviaEffect?:string;equippedMyPlayerCosmetic?:string};
export type PassProgress={season:string;xp:number;level:number;premiumUnlocked:boolean;claimedFree:number[];claimedPremium:number[]};

const mapItem=(x:any):StoreItem=>({sku:x.sku,title:x.title,description:x.description,category:x.category,rarity:x.rarity,priceCents:x.price_cents??undefined,currency:x.currency||'USD',season:x.season||undefined,metadata:x.metadata||{}});
const mapLocker=(x:any):LockerState=>({equippedProfileFrame:x?.equipped_profile_frame||undefined,equippedNameplate:x?.equipped_nameplate||undefined,equippedLeagueTheme:x?.equipped_league_theme||undefined,equippedTriviaEffect:x?.equipped_trivia_effect||undefined,equippedMyPlayerCosmetic:x?.equipped_my_player_cosmetic||undefined});

export async function fetchLockerExperience(){
  if(!supabase) return {catalog:[],entitlements:[],locker:{},pass:null} as const;
  const auth=await ensureOnlineSession();
  const [catalog,entitlements,locker,pass]=await Promise.all([
    supabase.from('ball_knower_store_catalog').select('*').eq('active',true).order('category').order('price_cents'),
    supabase.from('ball_knower_entitlements').select('sku,source,granted_at,expires_at').eq('auth_user_id',auth.id),
    supabase.from('ball_knower_locker').select('*').eq('auth_user_id',auth.id).maybeSingle(),
    supabase.from('ball_knower_pass_progress').select('*').eq('auth_user_id',auth.id).eq('season','2026').maybeSingle(),
  ]);
  const err=[catalog.error,entitlements.error,locker.error,pass.error].find(Boolean); if(err) throw err;
  return {
    catalog:(catalog.data||[]).map(mapItem),
    entitlements:(entitlements.data||[]).map((x:any)=>({sku:x.sku,source:x.source,grantedAt:x.granted_at,expiresAt:x.expires_at||undefined})),
    locker:mapLocker(locker.data),
    pass:pass.data?{season:pass.data.season,xp:Number(pass.data.xp)||0,level:Number(pass.data.level)||1,premiumUnlocked:Boolean(pass.data.premium_unlocked),claimedFree:pass.data.claimed_free||[],claimedPremium:pass.data.claimed_premium||[]} as PassProgress:null,
  };
}

export async function equipLockerItem(slot:keyof LockerState,sku:string|null){
  if(!supabase) return; const auth=await ensureOnlineSession();
  const column:Record<keyof LockerState,string>={equippedProfileFrame:'equipped_profile_frame',equippedNameplate:'equipped_nameplate',equippedLeagueTheme:'equipped_league_theme',equippedTriviaEffect:'equipped_trivia_effect',equippedMyPlayerCosmetic:'equipped_my_player_cosmetic'};
  if(sku){
    const {data,error}=await supabase.from('ball_knower_entitlements').select('id').eq('auth_user_id',auth.id).eq('sku',sku).limit(1);
    if(error) throw error; if(!data?.length) throw new Error('You do not own that Locker item.');
  }
  const {error}=await supabase.from('ball_knower_locker').upsert({auth_user_id:auth.id,[column[slot]]:sku,updated_at:new Date().toISOString()},{onConflict:'auth_user_id'});
  if(error) throw error;
}

export const formatStorePrice=(item:StoreItem)=>item.priceCents==null?'Included':new Intl.NumberFormat('en-US',{style:'currency',currency:item.currency||'USD'}).format(item.priceCents/100);
