import { ensureOnlineSession, supabase } from './supabase';

export async function counterTradeV2(
  tradeId:string,
  offeredPlayerIds:string[],
  requestedPlayerIds:string[],
  proposerDropPlayerIds:string[]=[],
  note='',
):Promise<string>{
  if(!supabase) throw new Error('Online league services are not configured.');
  await ensureOnlineSession();
  if(!offeredPlayerIds.length||!requestedPlayerIds.length) throw new Error('Choose at least one player from each team.');
  if(offeredPlayerIds.length>3||requestedPlayerIds.length>3) throw new Error('Trade packages can include up to three players on each side.');
  const {data,error}=await supabase.rpc('counter_ball_knower_trade_v2',{
    p_trade_id:tradeId,
    p_offered_player_ids:offeredPlayerIds,
    p_requested_player_ids:requestedPlayerIds,
    p_proposer_drop_player_ids:proposerDropPlayerIds,
    p_note:note||null,
  });
  if(error) throw error;
  const id=String(data||'');
  if(!id) throw new Error('The counter offer was not created.');
  return id;
}
