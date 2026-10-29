import React,{useEffect,useRef} from 'react';
import {ArrowLeft,RotateCcw} from 'lucide-react';
import './careerCreator.css';

export default function CareerCreatorDialog({onBack,onReset,children}:{onBack:()=>void;onReset:()=>void;children:React.ReactNode}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current!,overflow=document.body.style.overflow;element.showModal();document.body.style.overflow='hidden';return()=>{element.close();document.body.style.overflow=overflow;};},[]);
  return <dialog ref={dialog} className="bk-career-creator" aria-label="Create your career player" onCancel={event=>{event.preventDefault();onBack();}}>
    <header><button type="button" onClick={onBack} aria-label="Back to Solo Franchise Hub"><ArrowLeft size={20}/></button><div><span>MY PLAYER CAREER</span><h1>Create your athlete</h1></div><button type="button" onClick={onReset} aria-label="Create a new player"><RotateCcw size={18}/></button></header>
    {children}
  </dialog>;
}
