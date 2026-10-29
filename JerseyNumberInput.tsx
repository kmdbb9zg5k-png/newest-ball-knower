import React,{useEffect,useState} from 'react';

/** Keep the editing string separate so Backspace can clear a valid zero. */
export default function JerseyNumberInput({value,onChange,className,ariaLabel='Jersey number'}:{value:number;onChange:(value:number)=>void;className?:string;ariaLabel?:string}){
  const [draft,setDraft]=useState(String(value));
  useEffect(()=>setDraft(String(value)),[value]);
  return <input aria-label={ariaLabel} type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={draft} className={className} onChange={event=>{const next=event.target.value.replace(/\D/g,'').slice(0,2);setDraft(next);if(next!=='')onChange(Number(next));}} onBlur={()=>{const next=draft===''?0:Number(draft);setDraft(String(next));onChange(next);}}/>;
}
