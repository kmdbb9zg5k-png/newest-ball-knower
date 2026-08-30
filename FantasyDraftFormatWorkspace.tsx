import React,{useMemo,useState} from 'react';
import {FileInput,RefreshCw,ShieldCheck} from 'lucide-react';
import {League,Player} from './types';
import {PLAYERS_DATABASE} from './players';
import {importOfflineFantasyDraft} from './leagueCloud';
import {CPU_LIVE_FANTASY_POSITION_LIMITS} from './liveFantasyRules';

type Pick={memberId:string;playerId:string};

export const FantasyDraftFormatWorkspace=({league,onImported}:{league:League;onImported:()=>void})=>{
  const format=league.settings?.draftFormat;
  if(format==='offline')return <OfflineWorkspace league={league} onImported={onImported}/>;
  if(format==='mock')return <MockWorkspace league={league}/>;
  if(format==='auction')return <AuctionSafetyNotice/>;
  return null;
};

const OfflineWorkspace=({league,onImported}:{league:League;onImported:()=>void})=>{
  const [raw,setRaw]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const expected=league.members.length*(league.settings?.rosterSize||15);
  const submit=async()=>{setBusy(true);setError('');try{const picks=parseOfflinePicks(raw);if(picks.length!==expected)throw new Error(`Enter exactly ${expected} picks.`);await importOfflineFantasyDraft(league.id,picks);onImported();}catch(cause){setError(cause instanceof Error?cause.message:'Import failed.');}finally{setBusy(false);}};
  return <section className="mt-4 rounded-2xl border border-[#D4AF37]/30 bg-black/25 p-4"><div className="flex items-center gap-2 text-xs font-black uppercase text-[#D4AF37]"><FileInput className="h-4 w-4"/>Offline Draft Results</div><p className="mt-2 text-[10px] leading-4 text-zinc-500">Commissioner-only. Paste one pick per line as <code>memberId,playerId</code>, in overall-pick order. The server rejects duplicates, unknown players, missing teams, and non-{expected}-pick results before changing rosters.</p><textarea aria-label="Offline draft results" value={raw} onChange={event=>setRaw(event.target.value)} rows={8} placeholder={league.members.slice(0,2).map(member=>`${member.id},player-id`).join('\n')} className="mt-3 w-full rounded-xl bg-[#090b0e] p-3 font-mono text-xs"/><button disabled={busy} onClick={()=>void submit()} className="mt-2 min-h-11 w-full rounded-xl bg-[#D4AF37] text-[10px] font-black uppercase text-black disabled:opacity-40">{busy?'Validating…':'Validate & Import Results'}</button>{error&&<p className="mt-2 text-xs text-red-300">{error}</p>}</section>;
};

const MockWorkspace=({league}:{league:League})=>{const [seed,setSeed]=useState(1);const picks=useMemo(()=>buildMockDraft(league,seed),[league,seed]);return <section className="mt-4 rounded-2xl border border-sky-300/25 bg-black/25 p-4"><div className="flex items-center gap-2 text-xs font-black uppercase text-sky-300"><RefreshCw className="h-4 w-4"/>Practice Mock Draft</div><p className="mt-2 text-[10px] leading-4 text-zinc-500">A private practice simulation. It never writes rosters, standings, transactions, or league history. Rerun it to rehearse different boards.</p><button onClick={()=>setSeed(value=>value+1)} className="mt-3 min-h-11 rounded-xl bg-sky-300 px-4 text-[10px] font-black uppercase text-black">Run Another Mock</button><div className="mt-3 max-h-72 space-y-1 overflow-y-auto">{picks.slice(0,Math.min(picks.length,60)).map((pick,index)=>{const member=league.members.find(item=>item.id===pick.memberId);const player=PLAYERS_DATABASE.find(item=>item.id===pick.playerId);return <div key={`${index}:${pick.playerId}`} className="flex items-center rounded-lg bg-black/30 px-3 py-2 text-[10px]"><b className="w-8 text-[#D4AF37]">#{index+1}</b><span className="min-w-0 flex-1 truncate">{member?.userName}</span><span className="truncate text-zinc-400">{player?.position} {player?.name}</span></div>})}</div></section>;};

const AuctionSafetyNotice=()=> <section className="mt-4 rounded-2xl border border-amber-300/25 bg-black/25 p-4"><div className="flex items-center gap-2 text-xs font-black uppercase text-amber-300"><ShieldCheck className="h-4 w-4"/>Live Auction Safety Gate</div><p className="mt-2 text-[10px] leading-4 text-zinc-400">Auction is intentionally gated while concurrent bidding, nomination clocks, budget/roster feasibility, reconnect recovery, and server-close ownership are hardened. This is separate from Ball Knower’s Draft Order Game salary-cap roster mode. Choose Live Snake, Autopick Only, Offline Results, or Mock for a production league.</p></section>;

function parseOfflinePicks(raw:string):Pick[]{return raw.split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map((line,index)=>{const [memberId,playerId,...rest]=line.split(',').map(value=>value.trim());if(!memberId||!playerId||rest.length)throw new Error(`Line ${index+1} must be memberId,playerId.`);return{memberId,playerId};});}

function buildMockDraft(league:League,seed:number):Pick[]{
  const rounds=league.settings?.rosterSize||15;const order=[...(league.seasonResult?.draftOrder||[])].sort((a,b)=>a.pickNumber-b.pickNumber).map(item=>item.memberId);if(!order.length)return[];
  const available=PLAYERS_DATABASE.filter(player=>['QB','RB','WR','TE','K','DST'].includes(player.position)).sort((a,b)=>mockScore(b,seed)-mockScore(a,seed));const picks:Pick[]=[];const counts=new Map<string,Record<string,number>>();
  for(let round=0;round<rounds;round++){const row=round%2===0?order:[...order].reverse();for(const memberId of row){const memberCounts=counts.get(memberId)||{};const remaining=rounds-round;const missing=['QB','RB','RB','WR','WR','TE','K','DST'].filter(position=>(memberCounts[position]||0)<({QB:1,RB:2,WR:2,TE:1,K:1,DST:1} as Record<string,number>)[position]);const required=remaining<=missing.length;const index=available.findIndex(player=>(memberCounts[player.position]||0)<CPU_LIVE_FANTASY_POSITION_LIMITS[player.position as keyof typeof CPU_LIVE_FANTASY_POSITION_LIMITS]&&(!required||missing.includes(player.position)));if(index<0)continue;const player=available.splice(index,1)[0];if(!player)continue;picks.push({memberId,playerId:player.id});memberCounts[player.position]=(memberCounts[player.position]||0)+1;counts.set(memberId,memberCounts);}}
  return picks;
}
function mockScore(player:Player,seed:number){let hash=seed;for(const char of player.id)hash=(hash*31+char.charCodeAt(0))>>>0;return (player.ovr||0)*100+(hash%97);}
