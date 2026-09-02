import React, { useEffect, useRef, useState } from "react";
import {
  FantasyNotificationCategory,
  FantasyNotificationPreference,
  fetchMyNotificationPreferences,
  saveMyNotificationPreference,
} from "./leagueCloud";
import { isCloudConfigured } from "./supabase";

const CATEGORY_COPY: Record<FantasyNotificationCategory, {label:string; detail:string}> = {
  draft: {label:"Draft", detail:"Reminders, started, on deck, on clock and autopicks"},
  roster: {label:"Roster", detail:"Player status, lineup warnings and matchup kickoff"},
  transactions: {label:"Transactions", detail:"Trades, counters, waivers and watched players"},
  league: {label:"League", detail:"Messages, results, playoffs and commissioner updates"},
};

const ORDER: FantasyNotificationCategory[] = ["draft","roster","transactions","league"];

export const FantasyNotificationPreferences: React.FC<{userId?:string}> = ({userId}) => {
  const [preferences,setPreferences]=useState<FantasyNotificationPreference[]>([]);
  const [busy,setBusy]=useState<string>("");
  const [error,setError]=useState<string>("");
  const [ready,setReady]=useState(false);
  const requestRef=useRef(0);
  const userIdRef=useRef(userId);
  userIdRef.current=userId;

  const load=async()=>{
    const requestId=++requestRef.current;
    try{
      const next=await fetchMyNotificationPreferences();
      if(requestId!==requestRef.current)return;
      setPreferences(next);setError("");setReady(true);
    }catch(err:any){
      if(requestId!==requestRef.current)return;
      setError(err?.message||"Notification preferences could not be loaded.");
    }
  };

  useEffect(()=>{
    setPreferences([]);setError("");setBusy("");setReady(false);
    if(userId)void load();
    return()=>{requestRef.current+=1;};
  },[userId]);

  const preferenceFor=(category:FantasyNotificationCategory)=>preferences.find(item=>item.category===category)||{
    category,inAppEnabled:true,pushEnabled:true,
  };
  const toggle=async(category:FantasyNotificationCategory,channel:"inAppEnabled"|"pushEnabled")=>{
    if(busy)return;
    const requestedUserId=userId;
    const current=preferenceFor(category);
    const next={...current,[channel]:!current[channel]};
    setBusy(`${category}-${channel}`);setError("");
    try{
      await saveMyNotificationPreference(next);
      if(userIdRef.current!==requestedUserId)return;
      setPreferences(previous=>[
        ...previous.filter(item=>item.category!==category),next,
      ]);
    }catch(err:any){if(userIdRef.current===requestedUserId)setError(err?.message||"Notification preference could not be saved.");}
    finally{if(userIdRef.current===requestedUserId)setBusy("");}
  };

  if(!isCloudConfigured||!userId)return null;
  return <section className="space-y-3 border-t border-white/10 pt-4">
    <div>
      <div className="text-xs font-black uppercase text-white">Your Alert Preferences</div>
      <p className="mt-1 text-[10px] leading-4 text-zinc-500">These choices follow your account across fantasy leagues. Push delivery begins only after notifications are enabled on a supported Ball Knower mobile app.</p>
    </div>
    {error&&<div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-[10px] font-bold text-amber-200"><span>{error}</span><button type="button" onClick={()=>void load()} className="min-h-9 shrink-0 rounded-lg border border-amber-400/25 px-3 font-black uppercase">Retry</button></div>}
    {!ready&&!error&&<div aria-live="polite" className="rounded-xl border border-white/10 bg-black/20 p-3 text-[10px] font-bold text-zinc-500">Loading alert preferences…</div>}
    <div className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <div className="grid grid-cols-[minmax(0,1fr)_54px_54px] items-center gap-2 px-3 py-2 text-center text-[8px] font-black uppercase tracking-wider text-zinc-600"><span className="text-left">Category</span><span>In App</span><span>Push</span></div>
      {ORDER.map(category=>{
        const preference=preferenceFor(category);
        const copy=CATEGORY_COPY[category];
        return <div key={category} className="grid min-h-16 grid-cols-[minmax(0,1fr)_54px_54px] items-center gap-2 px-3 py-2">
          <div className="min-w-0"><div className="text-[11px] font-black uppercase text-zinc-200">{copy.label}</div><div className="mt-0.5 text-[9px] leading-3.5 text-zinc-600">{copy.detail}</div></div>
          <PreferenceSwitch label={`${copy.label} in-app alerts`} checked={preference.inAppEnabled} disabled={Boolean(busy)||!ready} onClick={()=>void toggle(category,"inAppEnabled")}/>
          <PreferenceSwitch label={`${copy.label} push alerts`} checked={preference.pushEnabled} disabled={Boolean(busy)||!ready} onClick={()=>void toggle(category,"pushEnabled")}/>
        </div>;
      })}
    </div>
  </section>;
};

const PreferenceSwitch=({label,checked,disabled,onClick}:{label:string;checked:boolean;disabled:boolean;onClick:()=>void})=><button type="button" role="switch" aria-label={label} aria-checked={checked} disabled={disabled} onClick={onClick} className={`mx-auto flex h-8 w-12 items-center rounded-full border p-1 transition disabled:opacity-50 ${checked?"border-[#D4AF37]/40 bg-[#D4AF37]/20":"border-white/10 bg-white/5"}`}><span className={`h-5 w-5 rounded-full transition ${checked?"translate-x-4 bg-[#D4AF37]":"translate-x-0 bg-zinc-600"}`}/></button>;
