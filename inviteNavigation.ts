/** Finish an invite join without letting a late response replace the user's current screen. */
export async function completeInviteJoin<T>({code,join,isCurrent,onReady}:{
  code:string;
  join:(code:string,options:{activate:false})=>Promise<{success:boolean;league?:T}>;
  isCurrent:()=>boolean;
  onReady:(league:T)=>void;
}):Promise<void>{
  const result=await join(code,{activate:false});
  if(result.success&&result.league&&isCurrent())onReady(result.league);
}

/** A pending invitation must not replace a menu the user has started using. */
export function watchInviteInteraction(target:EventTarget){
 let interacted=false;
 const markInteracted=()=>{interacted=true;};
 const events=['pointerdown','keydown','click'];
 for(const event of events)target.addEventListener(event,markInteracted,{capture:true});
 return {isUntouched:()=>!interacted,dispose:()=>{for(const event of events)target.removeEventListener(event,markInteracted,{capture:true});}};
}
