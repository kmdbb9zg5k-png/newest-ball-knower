import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp, X } from 'lucide-react';

type Props = {
  storageKey: string;
  title: string;
  summary: string;
  steps: string[];
};

export const ModeGuide: React.FC<Props> = ({ storageKey, title, summary, steps }) => {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(storageKey) !== 'seen'; } catch { return true; }
  });

  const close = () => {
    try { localStorage.setItem(storageKey, 'seen'); } catch { /* The guide can safely reappear. */ }
    setOpen(false);
  };

  const guide = open ? <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/80 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm">
    <section role="dialog" aria-modal="true" aria-label={`${title} instructions`} className="my-auto w-full max-w-lg rounded-[2rem] border border-[#D4AF37]/30 bg-[#0c1016] p-5 text-white shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-[.25em] text-[#D4AF37]">Quick explanation</div><h2 className="mt-2 text-3xl font-black uppercase">{title}</h2></div><button type="button" onClick={close} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10" aria-label="Close instructions"><X /></button></div>
      <p className="mt-4 text-sm font-semibold leading-6 text-zinc-300">{summary}</p>
      <ol className="mt-5 space-y-3">{steps.map((step, index) => <li key={step} className="flex gap-3 rounded-2xl bg-white/[.04] p-3 text-sm font-semibold text-zinc-300"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#D4AF37] text-xs font-black text-black">{index + 1}</span><span className="pt-1">{step}</span></li>)}</ol>
      <button type="button" onClick={close} className="mt-6 min-h-12 w-full rounded-2xl bg-[#D4AF37] px-5 text-sm font-black uppercase text-black">Got it — start</button>
    </section>
  </div> : null;

  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 text-[10px] font-black uppercase tracking-wider text-zinc-300">
      <CircleHelp className="h-4 w-4" /> How it works
    </button>
    {guide ? createPortal(guide, document.body) : null}
  </>;
};
