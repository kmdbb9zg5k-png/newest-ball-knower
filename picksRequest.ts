/** A real deadline, even when the native fetch implementation ignores abort. */
export async function withPicksDeadline<T>(work:(signal:AbortSignal)=>Promise<T>,timeoutMs=20_000,parent?:AbortSignal):Promise<T>{
  const controller=new AbortController();
  let timer:ReturnType<typeof setTimeout>|undefined;
  let abortParent=()=>{};
  const interrupted=new Promise<never>((_,reject)=>{
    const stop=(reason:Error)=>{controller.abort(reason);reject(reason)};
    abortParent=()=>stop(new DOMException('Request cancelled','AbortError'));
    if(parent?.aborted){abortParent();return}
    parent?.addEventListener('abort',abortParent,{once:true});
    timer=setTimeout(()=>stop(new Error('Picks request timed out')),timeoutMs);
  });
  try{
    return await Promise.race([interrupted,Promise.resolve().then(()=>{
      if(controller.signal.aborted)throw controller.signal.reason;
      return work(controller.signal);
    })]);
  }finally{
    clearTimeout(timer);parent?.removeEventListener('abort',abortParent);
  }
}
