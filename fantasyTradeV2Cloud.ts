import { ensureOnlineSession, supabase } from './supabase';
import { assertStandardFantasyTradePackage } from './fantasySeasonCloud';

export async function counterTradeV2(
  tradeId:string,
  offeredPlayerIds:string[],
  requestedPlayerIds:string[],
  proposerDropPlayerIds:string[]=[],
  note='',
):Promise<string>{
  if(!supabase) throw new Error('Online league services are not configured.');
  await ensureOnlineSession();
  assertStandardFantasyTradePackage(offeredPlayerIds,requestedPlayerIds);
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
