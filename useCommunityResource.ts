import {useCallback,useEffect,useRef,useState} from 'react';
import {createRequestGate} from './communityState';

/** Each resource is mounted for one account/conversation. Ignore late and overlapping reads. */
export function useCommunityResource<T>(fetcher:()=>Promise<T>) {
  const fetchRef=useRef(fetcher);fetchRef.current=fetcher;
  const gate=useRef(createRequestGate());
  const running=useRef<Promise<void>|null>(null);
  const [data,setData]=useState<T|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const refresh=useCallback(async function refresh(force=false):Promise<void>{
    if(running.current){const current=running.current;await current;if(!force)return;}
    const version=gate.current.next();
    const request=(async()=>{
      try {const next=await fetchRef.current();if(gate.current.isCurrent(version)){setData(next);setError('');}}
      catch(reason){if(gate.current.isCurrent(version))setError(reason instanceof Error?reason.message:'Could not refresh. Please retry.');}
      finally{if(gate.current.isCurrent(version))setLoading(false);}
    })();
    running.current=request;
    void request.finally(()=>{if(running.current===request)running.current=null;});
    return request;
  },[]);
  useEffect(()=>{void refresh();return()=>{gate.current.invalidate();running.current=null;};},[refresh]);
  return {data,loading,error,refresh};
}
