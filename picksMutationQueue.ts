import {withPicksDeadline} from './picksRequest';

/** Bound the caller's wait without releasing a write still awaiting its server response. */
export function createPicksMutationQueue(timeoutMs=20_000){
  let chain:Promise<void>=Promise.resolve();
  return {
    run<T>(work:(beforeSend:AbortSignal)=>Promise<T>):Promise<T>{
      return withPicksDeadline(signal=>{
        const operation=chain.then(()=>{
          // An expired queued click must never be submitted later without the user knowing.
          if(signal.aborted)throw signal.reason;
          return work(signal);
        });
        // Track the actual request, not the caller's deadline. Do not use this signal
        // to abort a POST after submission: abort cannot roll back a server-side write.
        chain=operation.then(()=>undefined,()=>undefined);
        return operation;
      },timeoutMs);
    },
    whenIdle:()=>chain,
  };
}
