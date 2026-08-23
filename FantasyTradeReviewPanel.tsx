import React,{useEffect,useState} from 'react';
import {Check,Gavel,RefreshCw,X} from 'lucide-react';
import {League} from './types';
import {useBallKnower} from './BallKnowerContext';
import {fetchSeasonOperations,resolveTrade,TradeOffer} from './fantasySeasonCloud';

export const FantasyTradeReviewPanel:React.FC<{league:League}>=({league})=>{
  const {currentUser,showToast}=useBallKnower();
  const isCommissioner=currentUser?.id===league.commissionerId;
  const reviewEnabled=(league.settings as any)?.tradeReview==='commissioner';
  const [trades,setTrades]=useState<TradeOffer[]>([]);
  const [busy,setBusy]=useState(false);
  const refresh=async()=>{try{const data=await fetchSeasonOperations(league.id);setTrades(data.trades.filter(trade=>trade.status==='accepted_pending_review'));}catch(err:any){showToast(err?.message||'Could not load trade review queue.');}};
  useEffect(()=>{if(isCommissioner&&reviewEnabled)void refresh();},[league.id,isCommissioner,reviewEnabled]);
  if(!isCommissioner||!reviewEnabled)return null;
  const memberName=(id:string)=>league.members.find(member=>member.id===id)?.userName||'Owner';
  const act=async(id:string,action:'approved'|'vetoed')=>{if(busy)return;setBusy(true);try{await resolveTrade(id,action as any);showToast(action==='approved'?'Trade approved and completed.':'Trade vetoed.');await refresh();}catch(err:any){showToast(err?.message||'Trade review failed.');}finally{setBusy(false);}};
  return <section className="mt-5 rounded-2xl border border-[#D4AF37]/20 bg-[#101318] p-4"><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-black uppercase text-[#D4AF37]"><Gavel className="h-4 w-4"/>Commissioner Trade Review</div><p className="mt-1 text-[11px] text-zinc-500">Accepted trades wait here until you approve or veto them.</p></div><button onClick={()=>void refresh()} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10"><RefreshCw className="h-4 w-4"/></button></div><div className="mt-4 space-y-2">{trades.length?trades.map(trade=><div key={trade.id} className="flex flex-col gap-3 rounded-xl bg-black/30 p-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-xs font-black uppercase">{memberName(trade.proposerMemberId)} ↔ {memberName(trade.recipientMemberId)}</div><div className="mt-1 text-[9px] uppercase text-zinc-500">{trade.offeredPlayerIds.length} player{trade.offeredPlayerIds.length===1?'':'s'} each side · accepted by recipient</div></div><div className="flex gap-2"><button disabled={busy} onClick={()=>void act(trade.id,'approved')} className="min-h-10 rounded-lg bg-emerald-500/15 px-3 text-[9px] font-black uppercase text-emerald-300 disabled:opacity-40"><Check className="mr-1 inline h-3.5 w-3.5"/>Approve</button><button disabled={busy} onClick={()=>void act(trade.id,'vetoed')} className="min-h-10 rounded-lg bg-red-500/10 px-3 text-[9px] font-black uppercase text-red-300 disabled:opacity-40"><X className="mr-1 inline h-3.5 w-3.5"/>Veto</button></div></div>):<div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs font-semibold text-zinc-600">No accepted trades are waiting for review.</div>}</div></section>;
};
