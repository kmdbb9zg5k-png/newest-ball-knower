import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { combineAthlete, readResults, RULESET } from './dash.js';

const Combine = lazy(() => import('./CombineExperience'));
export type CombinePlayer = { id: string; name: string; position: string; speed?: number; grade?: number; attributes?: { athleticism: number } };
export function FranchiseCombine({ prospects, roster, context, year }: { prospects: CombinePlayer[]; roster: CombinePlayer[]; context: string; year: number }) {
  const [records, setRecords] = useState<any[]>(() => readResults());
  const latest = Array.from(new Set(records.filter(r => r.context === context && r.ruleset === RULESET).map(r => r.playerId))).map(id => records.filter(r => r.context === context && r.ruleset === RULESET && r.playerId === id).sort((a,b) => a.splits[2] - b.splits[2])[0]).sort((a,b) => a.splits[2] - b.splits[2]).slice(0,5);
  return <section className="mb-4 rounded-2xl border border-emerald-200/20 bg-[#112026] p-4" aria-label="Franchise Combine"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-black text-emerald-100">{year} COMBINE</h2><p className="mt-1 text-xs text-zinc-400">Scout draft prospects or test your roster in the 40-yard dash.</p></div><div className="flex flex-wrap gap-2"><CombineLauncher players={prospects} context={context} label="Scout prospects" onResults={() => setRecords(readResults())} /><CombineLauncher players={roster} context={context} label="Test roster" onResults={() => setRecords(readResults())} /></div></div>{latest.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><caption className="py-2 text-left text-zinc-400">Your recorded bests · this Combine</caption><thead><tr className="text-zinc-400"><th className="py-2">Player</th><th>Pos</th><th>10 yd</th><th>20 yd</th><th>40 yd</th></tr></thead><tbody>{latest.map(r => <tr key={r.playerId} className="border-t border-white/10"><th className="py-2 font-semibold">{r.name}</th><td>{r.position}</td>{r.splits.map((s:number,i:number)=><td key={i}>{s.toFixed(2)}s</td>)}</tr>)}</tbody></table></div>}</section>;
}
export function CombineLauncher({ players, context, label = '40-Yard Dash', onResults }: { players: CombinePlayer[]; context: string; label?: string; onResults?: () => void }) {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-emerald-300/30 bg-emerald-950 px-4 py-3 text-sm font-bold text-emerald-100" disabled={!players.length}>{label} <span aria-hidden="true">↗</span></button>
    {open && createPortal(<CombineModal close={() => { setOpen(false); onResults?.(); }}><Combine players={players.map(combineAthlete)} context={context} onClose={() => { setOpen(false); onResults?.(); }} /></CombineModal>, document.body)}</>;
}
class CombineError extends React.Component<{ children: React.ReactNode; close: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div style={{padding:24,color:'white'}}><p>The Combine couldn’t load. Close it and try again.</p><button onClick={this.props.close}>Back to franchise</button></div> : this.props.children; }
}
function CombineModal({ children, close }: { children: React.ReactNode; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.current?.showModal(); return () => { document.body.style.overflow = previous; }; }, []);
  return <dialog ref={dialog} aria-label="Combine 40-yard dash" onCancel={close} style={{position:'fixed',inset:0,width:'100vw',maxWidth:'none',height:'100dvh',maxHeight:'none',margin:0,padding:0,border:0,background:'#10171b'}}><CombineError close={close}><Suspense fallback={<div style={{padding:24,color:'white'}}>Preparing Combine… <button onClick={close}>Back</button></div>}>{children}</Suspense></CombineError></dialog>;
}
