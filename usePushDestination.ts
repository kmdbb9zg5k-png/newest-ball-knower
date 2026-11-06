import {useEffect,useRef} from 'react';
import {PUSH_DESTINATION_EVENT,type PushTarget} from './pushContracts';

export function usePushDestination(leagueId:string,ownerId:string|undefined,isMember:boolean,open:(destination:PushTarget['destination'])=>void){
  const openRef=useRef(open);openRef.current=open;
  useEffect(()=>{
    const consume=(target:PushTarget&{ownerId:string})=>{
      if(!isMember||target?.leagueId!==leagueId||target?.ownerId!==ownerId)return;
      if(!['draft','roster','trades','waivers','messages','matchup','results','activity','league'].includes(target.destination))return;
      try{sessionStorage.removeItem('ballknower_push_destination_v1');}catch{}
      openRef.current(target.destination);
    };
    const listener=(event:Event)=>consume((event as CustomEvent).detail);
    window.addEventListener(PUSH_DESTINATION_EVENT,listener);
    try{const stored=sessionStorage.getItem('ballknower_push_destination_v1');if(stored)consume(JSON.parse(stored));}catch{}
    return()=>window.removeEventListener(PUSH_DESTINATION_EVENT,listener);
  },[leagueId,ownerId,isMember]);
}
