import React from 'react';
import type {LeagueNotification} from './leagueCloud';
import {notificationDestination,visibleLeagueNotifications,type FantasyNotificationDestination} from './fantasyNotificationRouting';

const DESTINATION_LABEL:Record<FantasyNotificationDestination,string>={draft:'Draft',roster:'Roster',trades:'Trades',waivers:'Waivers',messages:'Messages',matchup:'Matchup',results:'Results',activity:'Activity',league:'League'};
const age=(iso:string)=>{const seconds=Math.max(0,(Date.now()-new Date(iso).getTime())/1000);return !Number.isFinite(seconds)?'':seconds<60?`${Math.floor(seconds)}s ago`:seconds<3600?`${Math.floor(seconds/60)}m ago`:seconds<86400?`${Math.floor(seconds/3600)}h ago`:`${Math.floor(seconds/86400)}d ago`;};
type Props={
 leagueId:string;notifications:LeagueNotification[];disabled?:boolean;
 onMarkRead:(id:string)=>Promise<unknown>;
 onOpenDestination:(destination:FantasyNotificationDestination,notification:LeagueNotification)=>void;
 onError:(message:string)=>void;
};

export function FantasyNotificationInbox({leagueId,notifications,disabled,onMarkRead,onOpenDestination,onError}:Props){
 const visible=visibleLeagueNotifications(notifications,leagueId);
 if(!visible.length)return <p className="py-4 text-xs text-zinc-500">No notifications for this league yet.</p>;
 return <div className="space-y-2">{visible.map(notification=>{
  const destination=notificationDestination(notification),label=DESTINATION_LABEL[destination];
  return <button key={notification.id} type="button" disabled={disabled} onClick={()=>{
   onOpenDestination(destination,notification);
   // Opening an alert must still work if its read receipt cannot be saved.
   if(!notification.readAt)void onMarkRead(notification.id).catch(error=>onError(error?.message||'The alert opened, but could not be marked as read.'));
  }} aria-label={`Open ${label}: ${notification.title}`} className={`min-h-14 w-full rounded-xl border p-3 text-left disabled:opacity-50 ${notification.readAt?'border-white/5 bg-black/20':'border-[#D4AF37]/25 bg-[#D4AF37]/5'}`}>
   <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase">{notification.title}</div><p className="mt-1 text-xs text-zinc-400">{notification.body}</p></div>{!notification.readAt&&<span aria-label="Unread" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#D4AF37]"/>}</div>
   <div className="mt-2 flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-wider"><span className="text-zinc-500">{notification.category} · <time dateTime={notification.createdAt}>{age(notification.createdAt)}</time></span><span className="text-[#D4AF37]">Open {label} →</span></div>
  </button>;
 })}</div>;
}
