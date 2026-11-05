import React from 'react';
import './careerWorkspace.css';

export function CareerModeNav<T extends string>({label,items,value,onChange}:{
  label:string;
  items:ReadonlyArray<{id:T;label:string;count?:number}>;
  value:T;
  onChange:(value:T)=>void;
}) {
  return <nav className="career-mode-nav" aria-label={label}>
    {items.map(item=><button key={item.id} type="button" aria-pressed={value===item.id} onClick={()=>onChange(item.id)}>
      <span>{item.label}</span>{item.count!==undefined&&<span className="career-mode-count">{item.count}</span>}
    </button>)}
  </nav>;
}
