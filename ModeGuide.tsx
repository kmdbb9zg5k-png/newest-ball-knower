import {useBroadcastFocus} from './broadcastFocus';
import React, { useEffect, useId, useState } from 'react';
import { CircleHelp, X } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

type Props = {
  storageKey: string;
  title: string;
  summary: string;
  steps: readonly string[];
  sections?: readonly { title: string; body: string }[];
  autoOpen?: boolean;
  triggerRef?: React.Ref<HTMLButtonElement>;
};

export const ModeGuide: React.FC<Props> = ({ storageKey, title, summary, steps, sections = [], autoOpen = true, triggerRef }) => {
  const hasSeen = () => { try { return localStorage.getItem(storageKey) === 'seen'; } catch { return false; } };
  const [openKey, setOpenKey] = useState<string | null>(() => autoOpen && !hasSeen() ? storageKey : null);
  const open = openKey === storageKey;
  const titleId = useId();
  const summaryId = useId();

  useEffect(() => {
    setOpenKey(autoOpen && !hasSeen() ? storageKey : null);
  }, [storageKey, autoOpen]);

  useBroadcastFocus(open);

  const close = () => {
    try { localStorage.setItem(storageKey, 'seen'); } catch { /* The guide can safely reappear. */ }
    setOpenKey(null);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, storageKey]);

  const guide = open ? <ModalPortal><div className="absolute inset-0 flex min-h-0 items-start justify-center overflow-y-auto bg-black/80 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm">
    <section role="dialog" aria-modal="true" aria-label={`${title} instructions`} aria-describedby={summaryId} className="my-auto w-full max-w-lg rounded-[2rem] border border-[#D4AF37]/30 bg-[#0c1016] p-5 text-white shadow-2xl sm:p-7">
      <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-bold uppercase tracking-[.2em] text-[#D4AF37]">How it works</div><h2 id={titleId} className="mt-2 text-3xl font-black">{title}</h2></div><button type="button" onClick={close} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37]" aria-label="Close instructions"><X /></button></div>
      <p id={summaryId} className="mt-4 text-sm leading-6 text-zinc-300">{summary}</p>
      <ol className="mt-5 space-y-3">{steps.map((step, index) => <li key={step} className="flex gap-3 rounded-2xl bg-white/[.04] p-3 text-sm font-semibold text-zinc-300"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#D4AF37] text-xs font-black text-black">{index + 1}</span><span className="pt-1">{step}</span></li>)}</ol>
      {sections.length > 0 && <div className="mt-5 space-y-4 border-t border-white/10 pt-5">{sections.map(section => <div key={section.title}><h3 className="text-sm font-bold text-[#E2C57D]">{section.title}</h3><p className="mt-1 text-sm leading-6 text-zinc-300">{section.body}</p></div>)}</div>}
      <button type="button" onClick={close} className="mt-6 min-h-12 w-full rounded-2xl bg-[#D4AF37] px-5 text-sm font-black text-black">Got it</button>
    </section>
  </div></ModalPortal> : null;

  return <>
    <button ref={triggerRef} type="button" onClick={() => setOpenKey(storageKey)} className="bk-mode-guide-button inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-black/40 px-4 text-xs font-bold text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D4AF37]">
      <CircleHelp className="h-4 w-4" /> How it works
    </button>
    {guide}
  </>;
};
