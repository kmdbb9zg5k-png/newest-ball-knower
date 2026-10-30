import React,{createContext,useContext,useEffect,useId,useRef,useState} from 'react';
import './careerTabs.css';
export type CareerTab='story'|'player'|'career'|'stats';
const Navigate=createContext<((tab:CareerTab)=>void)|null>(null);
export function CareerTabLink({tab,children}:{tab:CareerTab;children:React.ReactNode}){const navigate=useContext(Navigate);return navigate?<button className="career-primary" onClick={()=>navigate(tab)}>{children}</button>:null;}
const Context=createContext<CareerTab|null>(null);
export function CareerSection({tab,children}:{tab:CareerTab;children:React.ReactNode}){
 const active=useContext(Context);
 return <div className="career-tab-section" hidden={active!==null&&active!==tab}>{children}</div>;
}
export function CareerTabs({children,title,onBack,metrics,stepKey,stats}:{children:React.ReactNode;title:string;onBack:()=>void;metrics:[string,number][];stepKey?:string;stats?:React.ReactNode}){
 const [tab,setTab]=useState<CareerTab>('story'),id=useId(),root=useRef<HTMLDivElement>(null);
 const tabs:[CareerTab,string][]=[['story','Story'],['player','My Player'],['career','Career'],...(stats?[["stats","Stats"] as [CareerTab,string]]:[])];
 useEffect(()=>{root.current?.scrollIntoView({block:'start',behavior:'instant'});},[tab,stepKey]);
 return <Navigate.Provider value={setTab}><Context.Provider value={tab}><div ref={root} className="career-tab-hub">
  <header className="career-tab-heading"><button onClick={onBack} aria-label="Back to Solo">← Solo</button><span>{title}</span></header>
  <div className="career-tab-nav" role="tablist" aria-label="My Player sections">{tabs.map(([key,label],index)=><button key={key} id={`${id}-${key}`} role="tab" aria-selected={tab===key} aria-controls={`${id}-panel`} tabIndex={tab===key?0:-1} onClick={()=>setTab(key)} onKeyDown={event=>{const next=event.key==='ArrowRight'?(index+1)%tabs.length:event.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:event.key==='Home'?0:event.key==='End'?tabs.length-1:-1;if(next<0)return;event.preventDefault();setTab(tabs[next][0]);document.getElementById(`${id}-${tabs[next][0]}`)?.focus();}}>{label}</button>)}</div>
  <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${tab}`} tabIndex={0} className="career-tab-content">{children}{tab==='stats'&&stats}</div>
  <footer className="career-tab-status" aria-label="Career relationship stats">{metrics.map(([label,value])=><div key={label}><span>{label}</span><b>{value}<small>/100</small></b><meter min={0} max={100} value={value} aria-label={label}/></div>)}</footer>
 </div></Context.Provider></Navigate.Provider>;
}
