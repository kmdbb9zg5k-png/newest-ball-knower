import {useEffect} from 'react';
import {supabase} from './supabase';
import {readLockerState,refreshLocker,resetLockerIdentity} from './lockerCommerceClient';
export default function LockerAccountSync(){
 useEffect(()=>{
  let active=true;
  const refresh=()=>{if(active)void refreshLocker();};
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
   resetLockerIdentity(session&&!session.user.is_anonymous?session.user.id:null);
   // Keep async auth calls out of the Supabase auth callback lock.
   queueMicrotask(refresh);
  });
  refresh();window.addEventListener('focus',refresh);
  const timer=window.setInterval(()=>{if(readLockerState().available)refresh();},60000);
  return()=>{active=false;subscription.unsubscribe();window.removeEventListener('focus',refresh);clearInterval(timer);resetLockerIdentity(null);};
 },[]);
 return null;
}
