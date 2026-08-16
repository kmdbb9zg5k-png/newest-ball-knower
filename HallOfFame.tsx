import React, { useEffect, useState } from 'react';
import { Crown, Trophy, Medal, Wifi, WifiOff } from 'lucide-react';
import { fetchLeaderboard } from '../services/leaderboardCloud';
import { isCloudConfigured } from '../lib/supabase';
import { defaultCareer, CareerProfile } from '../utils/soloSeasonEngine';

const CAREER_KEY='ballknower_solo_career_v1';

export const HallOfFame:React.FC=()=>{
 const [rows,setRows]=useState<any[]>([]);
 const [career]=useState<CareerProfile>(()=>{try{return JSON.parse(localStorage.getItem(CAREER_KEY)||'null')||defaultCareer()}catch{return defaultCareer()}});
 const [loading,setLoading]=useState(isCloudConfigured);
 useEffect(()=>{if(!isCloudConfigured)return;fetchLeaderboard().then(setRows).catch(()=>setRows([])).finally(()=>setLoading(false))},[]);
 return <div className="min-h-screen bg-[#090909] text-white px-4 sm:px-8 py-10"><div className="max-w-5xl mx-auto">
  <div className="text-center mb-8"><Crown className="mx-auto text-[#D4AF37]" size={55}/><div className="text-xs text-[#D4AF37] font-black tracking-[.3em] mt-3">BALL KNOWER LEGACY</div><h2 className="text-5xl font-black">HALL OF FAME</h2><p className="text-zinc-400 mt-2">Championships, career wins, perfect seasons, and the highest Ball Knower scores.</p></div>
  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
   <Stat l="Your Titles" v={career.championships}/><Stat l="Career W-L" v={`${career.regularWins}-${career.regularLosses}`}/><Stat l="Playoff Wins" v={career.playoffWins}/><Stat l="Best Record" v={career.bestRecord}/><Stat l="Best BK" v={career.bestScore}/><Stat l="Perfect Seasons" v={career.perfectSeasons}/>
  </div>
  <div className="bg-[#111] border border-white/10">
   <div className="p-4 border-b border-white/10 flex justify-between items-center"><h3 className="font-black text-xl flex gap-2 items-center"><Trophy className="text-[#D4AF37]"/>GLOBAL LEADERBOARD</h3><span className={`text-xs font-black flex gap-1 items-center ${isCloudConfigured?'text-green-400':'text-amber-300'}`}>{isCloudConfigured?<><Wifi size={14}/> ONLINE</>:<><WifiOff size={14}/> CONNECT SUPABASE</>}</span></div>
   {!isCloudConfigured?<div className="p-10 text-center text-zinc-500">Connect the included Supabase backend and completed Solo runs will automatically publish here.</div>:loading?<div className="p-10 text-center text-zinc-500">Loading legends...</div>:rows.length===0?<div className="p-10 text-center text-zinc-500">No published runs yet. Be the first.</div>:
   <div className="divide-y divide-white/5">{rows.map((r,i)=><div key={r.auth_user_id} className="grid grid-cols-[50px_1fr_repeat(3,auto)] gap-4 items-center p-4"><div className="text-xl font-black text-[#D4AF37]">{i===0?'👑':i===1?'🥈':i===2?'🥉':`#${i+1}`}</div><div><div className="font-black">{r.display_name}</div><div className="text-xs text-zinc-500">{r.best_record} best record</div></div><Cell l="RINGS" v={r.championships}/><Cell l="WINS" v={r.career_wins}/><Cell l="BK" v={r.best_ball_knower_score}/></div>)}</div>}
  </div>
  {career.achievements.length>0&&<div className="mt-8 bg-[#111] border border-white/10 p-5"><h3 className="font-black text-[#D4AF37] mb-3">YOUR TROPHY CASE</h3><div className="flex flex-wrap gap-2">{career.achievements.map(a=><span key={a} className="border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 py-2 text-xs font-black">🏆 {a}</span>)}</div></div>}
 </div></div>
}
const Stat=({l,v}:{l:string,v:any})=><div className="bg-[#121212] border border-white/10 p-3"><div className="text-[9px] text-zinc-500 font-black">{l}</div><div className="text-xl font-black">{v}</div></div>;
const Cell=({l,v}:{l:string,v:any})=><div className="text-right min-w-[55px]"><div className="text-[8px] text-zinc-600 font-black">{l}</div><div className="font-black">{v}</div></div>;
