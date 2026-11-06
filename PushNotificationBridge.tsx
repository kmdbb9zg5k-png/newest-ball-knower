import React,{useEffect,useRef,useState} from 'react';
import {useBallKnower} from './BallKnowerContext';
import {initializePushClient,resolvePushTarget} from './pushClient';
import {PUSH_DESTINATION_EVENT,PUSH_OPEN_EVENT,UUID_PATTERN,type PushTarget} from './pushContracts';

const TARGET_KEY='ballknower_push_target_v1';
export default function PushNotificationBridge({onOpen}:{onOpen:(target:PushTarget)=>void}){
  const {currentUser,activeLeague,showToast}=useBallKnower();
  const [pending,setPending]=useState('');
  const [target,setTarget]=useState<(PushTarget&{ownerId:string})|null>(null);
  const currentRef=useRef(currentUser?.id);currentRef.current=currentUser?.id;
  const openRef=useRef(onOpen);openRef.current=onOpen;
  useEffect(()=>{
    void initializePushClient().catch(()=>undefined);
    const open=(event:Event)=>{const id=(event as CustomEvent).detail?.notificationId;if(typeof id==='string'&&UUID_PATTERN.test(id)){setPending(id);try{sessionStorage.setItem(TARGET_KEY,id);}catch{}}};
    window.addEventListener(PUSH_OPEN_EVENT,open);
    const url=new URL(location.href),fromUrl=url.searchParams.get('pushNotification');
    let stored='';try{stored=sessionStorage.getItem(TARGET_KEY)||'';}catch{}
    const id=fromUrl||stored;
    if(id&&UUID_PATTERN.test(id))setPending(id);
    if(fromUrl){url.searchParams.delete('pushNotification');history.replaceState(history.state,'',url.pathname+url.search+url.hash);}
    return()=>window.removeEventListener(PUSH_OPEN_EVENT,open);
  },[]);
  useEffect(()=>{
    if(!pending||!currentUser?.id||currentUser.isAnonymous!==false)return;
    const owner=currentUser.id;let cancelled=false;
    void resolvePushTarget(pending,owner).then(next=>{
      if(cancelled||currentRef.current!==owner)return;
      setTarget({...next,ownerId:owner});setPending('');try{sessionStorage.removeItem(TARGET_KEY);}catch{}
      openRef.current(next);
    }).catch(error=>{if(!cancelled&&currentRef.current===owner){setPending('');try{sessionStorage.removeItem(TARGET_KEY);}catch{}showToast(error?.message||'This alert could not be opened.');}});
    return()=>{cancelled=true;};
  },[pending,currentUser?.id,currentUser?.isAnonymous]);
  useEffect(()=>{
    if(target&&(target.destination==='draft'||target.destination==='results')){setTarget(null);return;}
    if(!target||target.ownerId!==currentUser?.id||activeLeague?.id!==target.leagueId||!activeLeague.members.some(member=>member.userId===currentUser?.id&&!member.isAi))return;
    // HQ may be a lazy chunk; keep the authorized target until its consumer mounts.
    const payload={...target,ownerId:currentUser.id};
    try{sessionStorage.setItem('ballknower_push_destination_v1',JSON.stringify(payload));}catch{}
    window.dispatchEvent(new CustomEvent(PUSH_DESTINATION_EVENT,{detail:payload}));setTarget(null);
  },[target,activeLeague,currentUser?.id]);
  return null;
}
