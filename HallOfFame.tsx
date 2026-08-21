import React, { useEffect, useState } from 'react';
import { Bot, Crown, Trophy } from 'lucide-react';
import { fetchLeaderboard, publishCareer } from './leaderboardCloud';
import { defaultCareer, CareerProfile } from './soloSeasonEngine';
import { useBallKnower } from './BallKnowerContext';
import { CloudSyncBadge, useCloudSyncStatus } from './CloudSyncProvider';

const CAREER_KEY='ballknower_solo_career_v1';
const RIVAL_POOL = [
 ['PhillyPressure',3,42,92],['Cover2Chris',2,38,89],['SundaySavage',2,35,87],
 ['FourthDownFrank',1,31,84],['PocketPresence',1,28,82],['RouteTreeRay',1,26,80],
 ['BlitzPickup',0,24,78],['CapSpaceKing',0,21,76],['RedZoneRico',0,19,74],['FilmRoomTee',0,17,72],
] as const;

function simulatedRivals(){
 const cycle=Math.floor(Date.now()/(7*86400000));
 return RIVAL_POOL.map(([display_name,championships,career_wins,score],i)=>({
  auth_user_id:`ai-rival-${i}`,display_name,championships,career_wins:career_wins+((cycle+i)%4),
  career_losses:12+((cycle*3+i)%9),playoff_wins:Math.max(0,championships*2),
  best_ball_knower_score:Math.min(99,score+((cycle+i*2)%5)),best_record:`${11+(i%4)}-${6-(i%4)}`,
  perfect_seasons:0,is_ai_rival:true,
 }));
}

export const HallOfFame:React.FC=()=>{
 const {currentUser}=useBallKnower();
 const cloudStatus=useCloudSyncStatus();
 const [rows,setRows]=useState<any[]>([]);
 const [career]=useState<CareerProfile>(()=>{try{return JSON.parse(localStorage.getItem(CAREER_KEY)||'null')||defaultCareer()}catch{return defaultCareer()}});
 const [loading,setLoading]=useState(cloudStatus==='connecting');
 useEffect(()=>{
  let active=true;
  const rivals=simulatedRivals();
  if(cloudStatus!=='online'){setRows(rivals);setLoading(false);return()=>{active=false};}
  setLoading(true);
  publishCareer(currentUser?.name||'Ball Knower GM',career)
   .then(()=>fetchLeaderboard())
   .then(real=>{if(active)setRows([...real,...rivals].sort((a,b)=>b.championships-a.championships||b.best_ball_knower_score-a.best_ball_knower_score).slice(0,50))})
   .catch(()=>{if(active)setRows(rivals)})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[cloudStatus,currentUser?.id,currentUser?.name]);
 return <div className="min-h-[100dvh] bg-[#090909] text-white px-4 sm:px-8 py-10"><div className="max-w-5xl mx-auto">
  <div className="text-center mb-8"><Crown className="mx-auto text-[#D4AF37]" size={55}/><div className="text-xs text-[#D4AF37] font-black tracking-[.3em] mt-3">BALL KNOWER LEGACY</div><h2 className="text-5xl font-black">HALL OF FAME</h2><p className="text-zinc-400 mt-2">Championships, career wins, perfect seasons, and the highest Ball Knower scores.</p></div>
  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
   <Stat l="Your Titles" v={career.championships}/><Stat l="Career W-L" v={`${career.regularWins}-${career.regularLosses}`}/><Stat l="Playoff Wins" v={career.playoffWins}/><Stat l="Best Record" v={career.bestRecord}/><Stat l="Best BK" v={career.bestScore}/><Stat l="Perfect Seasons" v={career.perfectSeasons}/>
  </div>
  <div className="bg-[#111] border border-white/10">
   <div className="p-4 border-b border-white/10 flex flex-wrap justify-between items-center gap-3"><h3 className="font-black text-xl flex gap-2 items-center"><Trophy className="text-[#D4AF37]"/>GLOBAL LEADERBOARD</h3><CloudSyncBadge/></div>
   {loading?<div className="p-10 text-center text-zinc-500">Loading legends...</div>:rows.length===0?<div className="p-10 text-center text-zinc-500">No published runs yet. Be the first.</div>:
   <div className="divide-y divide-white/5">{rows.map((r,i)=><div key={r.auth_user_id} className="grid grid-cols-[42px_1fr_repeat(3,auto)] gap-2 sm:gap-4 items-center p-3 sm:p-4"><div className="text-lg sm:text-xl font-black text-[#D4AF37]">{i===0?'👑':i===1?'🥈':i===2?'🥉':`#${i+1}`}</div><div className="min-w-0"><div className="truncate font-black">{r.display_name} {r.is_ai_rival&&<span className="ml-1 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-1.5 py-0.5 text-[8px] text-cyan-300">AI RIVAL</span>}</div><div className="text-xs text-zinc-500">{r.best_record} best record</div></div><Cell l="RINGS" v={r.championships}/><Cell l="WINS" v={r.career_wins}/><Cell l="BK" v={r.best_ball_knower_score}/></div>)}</div>}
   <div className="border-t border-white/10 px-4 py-3 text-[10px] font-bold text-zinc-500"><Bot className="mr-1 inline h-3 w-3"/> AI RIVALS are simulated opponents—not human accounts. Verified players publish through Supabase.</div>
  </div>
  {career.achievements.length>0&&<div className="mt-8 bg-[#111] border border-white/10 p-5"><h3 className="font-black text-[#D4AF37] mb-3">YOUR TROPHY CASE</h3><div className="flex flex-wrap gap-2">{career.achievements.map(a=><span key={a} className="border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-2 text-xs font-black">🏆 {a}</span>)}</div></div>}
 </div></div>
}
const Stat=({l,v}:{l:string,v:any})=><div className="bg-[#121212] border border-white/10 p-3"><div className="text-[9px] text-zinc-500 font-black">{l}</div><div className="text-xl font-black">{v}</div></div>;
const Cell=({l,v}:{l:string,v:any})=><div className="text-right min-w-[55px]"><div className="text-[8px] text-zinc-600 font-black">{l}</div><div className="font-black">{v}</div></div>;
