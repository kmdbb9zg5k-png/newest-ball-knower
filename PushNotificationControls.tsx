import React,{useEffect,useRef,useState} from 'react';
import {DEFAULT_PUSH_SETTINGS,PUSH_STATE_EVENT,type PushDevice,type PushReadiness,type PushSettings} from './pushContracts';
import {disablePush,enablePush,getPushDevices,getPushDeviceState,getPushReadiness,getPushSettings,revokePushDevice,savePushSettings} from './pushClient';

const minuteText=(value:number)=>`${Math.floor(value/60).toString().padStart(2,'0')}:${(value%60).toString().padStart(2,'0')}`;
const fromTime=(value:string)=>{const [hours,minutes]=value.split(':').map(Number);return hours*60+minutes;};
export default function PushNotificationControls({userId}:{userId:string}){
  const [settings,setSettings]=useState<PushSettings>(DEFAULT_PUSH_SETTINGS);
  const [readiness,setReadiness]=useState<PushReadiness|null>(null);
  const [state,setState]=useState<Awaited<ReturnType<typeof getPushDeviceState>>|null>(null);
  const [devices,setDevices]=useState<PushDevice[]>([]);
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
  const owner=useRef(userId);owner.current=userId;
  const loadId=useRef(0);
  const load=async()=>{
    const id=++loadId.current,requestedOwner=userId;setError('');
    try{
      const [nextSettings,nextReadiness,nextState,nextDevices]=await Promise.all([getPushSettings(userId),getPushReadiness(),getPushDeviceState(userId),getPushDevices(userId)]);
      if(id!==loadId.current||owner.current!==requestedOwner)return;
      setSettings(nextSettings);setReadiness(nextReadiness);setState(nextState);setDevices(nextDevices);setReady(true);
    }catch(err:any){if(id===loadId.current&&owner.current===requestedOwner)setError(err?.message||'Device settings could not load.');}
  };
  useEffect(()=>{
    setReady(false);setBusy('');setMessage('');setSettings(DEFAULT_PUSH_SETTINGS);setDevices([]);setState(null);void load();
    const changed=()=>{void getPushDeviceState(userId).then(next=>{if(owner.current===userId)setState(next);}).catch(()=>undefined);};
    window.addEventListener(PUSH_STATE_EVENT,changed);
    return()=>{loadId.current++;window.removeEventListener(PUSH_STATE_EVENT,changed);};
  },[userId]);
  const run=async(key:string,action:()=>Promise<unknown>,success:string)=>{
    if(busy)return;const requestedOwner=userId;setBusy(key);setError('');setMessage('');
    try{await action();if(owner.current!==requestedOwner)return;setMessage(success);await load();}
    catch(err:any){if(owner.current===requestedOwner)setError(err?.message||'Push settings could not be saved.');}
    finally{if(owner.current===requestedOwner){setBusy('');void getPushDeviceState(userId).then(next=>{if(owner.current===userId)setState(next);}).catch(()=>undefined);}}
  };
  const transportReady=Boolean(state?.native?readiness?.apns.ready:readiness?.web.ready);
  const enabledHere=Boolean(state?.enabled&&devices.some(device=>!device.revokedAt&&device.installationId===state.installationId));
  const zones=(()=>{try{return [...new Set([settings.timeZone,Intl.DateTimeFormat().resolvedOptions().timeZone,'UTC',...((Intl as typeof Intl&{supportedValuesOf?:(kind:string)=>string[]}).supportedValuesOf?.('timeZone')||[])])];}catch{return [settings.timeZone,'UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Europe/London'];}})();
  return <div className="space-y-4 rounded-xl border border-white/10 bg-black/20 p-3 sm:p-4">
    <div><h3 className="text-[11px] font-black uppercase text-white">Push on this device</h3><p className="mt-1 text-xs leading-5 text-zinc-400">Get selected fantasy alerts when Ball Knower is closed. Your category choices and quiet hours follow your account.</p></div>
    {error&&<div role="alert" className="space-y-2 rounded-lg border border-amber-400/25 p-3 text-xs text-amber-200"><p>{error}</p>{!ready&&<button type="button" onClick={()=>void load()} className="min-h-11 rounded-lg border border-amber-400/25 px-4 text-xs font-bold">Retry device settings</button>}</div>}
    {message&&<p role="status" className="text-xs text-emerald-300">{message}</p>}
    {!ready&&!error&&<p aria-live="polite" className="text-xs text-zinc-400">Loading device settings…</p>}
    {ready&&<>
      <p className="text-xs leading-5 text-zinc-400">{enabledHere?'Push is enabled for this account on this device.':state?.detail||(!transportReady?'Push delivery for this device is awaiting server setup. In-app alerts are available.':state?.permission==='denied'?'Notifications are blocked. Allow Ball Knower in your browser or device notification settings, then return here.':'Push is off on this device. Enabling opens the notification permission request if needed.')}</p>
      <button type="button" disabled={Boolean(busy)||!state?.supported||!enabledHere&&(!transportReady||state.permission==='denied')} onClick={()=>void run('device',()=>enabledHere?disablePush(userId):enablePush(userId,readiness!),enabledHere?'Push disabled on this device.':'Push enabled on this device.')} className="min-h-11 w-full rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 text-xs font-black text-[#D4AF37] disabled:opacity-50">{busy==='device'?'Saving device…':enabledHere?'Disable on this device':'Enable on this device'}</button>
      <form onSubmit={event=>{event.preventDefault();void run('quiet',()=>savePushSettings(settings,userId),'Quiet hours saved.');}} className="space-y-3 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between gap-3"><label htmlFor={`quiet-${userId}`} className="flex min-h-11 items-center text-xs font-bold text-white">Quiet hours</label><input id={`quiet-${userId}`} type="checkbox" checked={settings.quietEnabled} disabled={Boolean(busy)} onChange={event=>setSettings(previous=>({...previous,quietEnabled:event.target.checked}))} className="h-6 w-6 accent-[#D4AF37]"/></div>
        <p className="text-[11px] leading-5 text-zinc-400">Pause all push alerts during these local hours. Time-sensitive alerts that expire while paused are skipped. In-app alerts still appear.</p>
        <div className="grid grid-cols-2 gap-3"><label className="min-w-0 text-xs text-zinc-300">From<input aria-label="Quiet hours start" type="time" required value={minuteText(settings.startMinute)} disabled={Boolean(busy)} onChange={event=>setSettings(previous=>({...previous,startMinute:fromTime(event.target.value)}))} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-[#121923] px-2 text-sm text-white [color-scheme:dark]"/></label><label className="min-w-0 text-xs text-zinc-300">Until<input aria-label="Quiet hours end" type="time" required value={minuteText(settings.endMinute)} disabled={Boolean(busy)} onChange={event=>setSettings(previous=>({...previous,endMinute:fromTime(event.target.value)}))} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-[#121923] px-2 text-sm text-white [color-scheme:dark]"/></label></div>
        <label className="block text-xs text-zinc-300">Timezone<select aria-label="Quiet hours timezone" value={settings.timeZone} disabled={Boolean(busy)} onChange={event=>setSettings(previous=>({...previous,timeZone:event.target.value}))} className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-white/15 bg-[#121923] px-2 text-xs text-white">{zones.map(zone=><option key={zone} value={zone}>{zone.replace(/_/g,' ')}</option>)}</select></label>
        <button type="submit" disabled={Boolean(busy)||settings.startMinute===settings.endMinute} className="min-h-11 w-full rounded-lg border border-white/15 px-3 text-xs font-bold text-white disabled:opacity-50">{busy==='quiet'?'Saving quiet hours…':'Save quiet hours'}</button>
        {settings.startMinute===settings.endMinute&&<p role="alert" className="text-xs text-amber-200">Choose different start and end times.</p>}
      </form>
      {devices.some(device=>!device.revokedAt)&&<details className="border-t border-white/10 pt-3"><summary className="min-h-11 cursor-pointer text-xs font-bold text-zinc-300">Manage registered devices</summary><ul className="space-y-2">{devices.filter(device=>!device.revokedAt).map(device=><li key={device.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-2"><div className="min-w-0"><p className="break-words text-xs text-white">{device.label}</p><p className="mt-1 text-[10px] text-zinc-500">Last active {new Date(device.lastSeenAt).toLocaleDateString()}</p></div><button type="button" disabled={Boolean(busy)} onClick={()=>void run(device.id,()=>revokePushDevice(device.id,userId),'Device removed.')} className="min-h-11 rounded-lg border border-white/15 px-3 text-xs text-zinc-300 disabled:opacity-50">Remove</button></li>)}</ul></details>}
    </>}
  </div>;
}
